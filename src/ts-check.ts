/*
 * @Author: lzw
 * @Date: 2021-08-15 22:39:01
 * @LastEditors: lzw
 * @LastEditTime: 2022-07-07 15:40:32
 * @Description: typescript Diagnostics report
 */

import { resolve, dirname, normalize } from 'path';
import { existsSync, unlinkSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'fs';
import { color } from 'console-log-colors';
import * as ts from 'typescript';
import glob from 'fast-glob';
import minimatch from 'minimatch';
import { fixToshortPath, md5, assign, execSync } from './utils';
import { getConfig, VERSION } from './config';
import type { TsCheckConfig } from './types';
import { LintBase, LintResult } from './LintBase';

const { bold, redBright, yellowBright, cyanBright, red, cyan } = color;
export interface TsCheckResult extends LintResult {
  /** 异常类型数量统计 */
  diagnosticsCategory: Partial<Record<keyof typeof ts.DiagnosticCategory, number>>;
  /** 异常总数 */
  totalDiagnostics: 0;
}
export class TsCheck extends LintBase<TsCheckConfig, TsCheckResult> {
  /** 白名单列表 */
  private whiteList = {} as Record<string, keyof typeof ts.DiagnosticCategory>; // ts.DiagnosticCategory
  private cache: {
    /** 检测到异常且需要 report 的文件列表 */
    allDiagnosticsFileMap: { [file: string]: ts.Diagnostic };
    /** 要缓存到 cacheFilePath 的信息 */
    tsCache: {
      /** 已经检测且无异常的文件列表 */
      tsCheckFilesPassed: { [filepath: string]: { md5: string; updateTime: number } };
      version: string;
    };
    /** 检测通过的文件列表是否有变动(记录变动文件数)，用于标记是否需要写回缓存 */
    tsCheckFilesPassedChanged: number;
  };
  constructor(override config: TsCheckConfig = {}) {
    super('tscheck', config);
    config = this.parseConfig(config);
    this.logger.debug('config', this.config);
    if (config.checkOnInit) this.start();
  }
  protected override getInitStats() {
    const stats: TsCheckResult = {
      ...super.getInitStats(),
      /** 异常总数 */
      totalDiagnostics: 0,
      diagnosticsCategory: {},
    };
    this.stats = stats;
    this.cache = {
      allDiagnosticsFileMap: {},
      tsCache: {
        tsCheckFilesPassed: {},
        version: VERSION,
      },
      /** 检测通过的文件列表是否有变动(记录变动文件数)，用于标记是否需要写回缓存 */
      tsCheckFilesPassedChanged: 0,
    };

    return stats;
  }
  /** 配置参数格式化 */
  public parseConfig(config: TsCheckConfig) {
    const baseConfig = getConfig({ tscheck: config }, false);

    this.config = assign<TsCheckConfig>({}, baseConfig.tscheck);
    this.config.whiteListFilePath = resolve(this.config.rootDir, this.config.whiteListFilePath);

    return this.config;
  }
  protected init() {
    const { whiteListFilePath, removeCache } = this.config;

    if (existsSync(this.cacheFilePath)) {
      try {
        if (removeCache) {
          unlinkSync(this.cacheFilePath);
        } else {
          const cacheInfo = JSON.parse(readFileSync(this.cacheFilePath, { encoding: 'utf8' }));
          if (cacheInfo.version !== VERSION) unlinkSync(this.cacheFilePath);
          else if (cacheInfo.tsCheckFilesPassed) this.cache.tsCache = cacheInfo;
        }
        // @ts-ignore
      } catch (error: Error) {
        this.logger.error(error.message || error.stack || error);
      }
    }

    // 读取白名单列表
    if (!this.config.toWhiteList && existsSync(whiteListFilePath)) {
      try {
        this.whiteList = JSON.parse(readFileSync(whiteListFilePath, { encoding: 'utf8' }));
        // @ts-ignore
      } catch (error: Error) {
        this.logger.error(error.message || error.stack || error);
      }
    }
  }
  /** 返回可检测的子项目路径 */
  private getCheckProjectDirs(source = this.config.src) {
    const { rootDir } = this.config;
    return source.filter(d => {
      const p = resolve(rootDir, d);
      return existsSync(p) && statSync(p).isDirectory();
    });
  }

  /** ts 编译 */
  private compile(sourceFiles: string[], subDirection: string): void {
    const total = sourceFiles.length;
    const { config, stats } = this;
    const { tsCheckFilesPassed } = this.cache.tsCache;

    this.stats.totalFilesNum += total;

    console.log();
    this.logger.info(bold(cyanBright('Checking')), subDirection);
    this.logger.info(' - Total Files:', total);

    /** 缓存命中数量 */
    let cacheHits = 0;
    /** 白名单命中数量 */
    let whiteListHits = 0;

    sourceFiles = sourceFiles.filter(filepath => {
      const shortpath = fixToshortPath(filepath, config.rootDir);

      if (this.whiteList[shortpath]) {
        whiteListHits++;
        return false;
      }

      const fileMd5 = md5(filepath, true);

      if (!tsCheckFilesPassed[shortpath]) {
        // 新文件：先放到 tsCheckFilesPassed 中
        tsCheckFilesPassed[shortpath] = { md5: fileMd5, updateTime: null };
      } else if (config.cache && tsCheckFilesPassed[shortpath].md5 === fileMd5) {
        // 缓存过滤
        cacheHits++;
        return false;
      }

      return true;
    });

    if (cacheHits) this.logger.info(` - Cache hits:`, cacheHits);
    if (whiteListHits) this.logger.info(` - WhiteList hits:`, whiteListHits);

    if (sourceFiles.length === 0) return;

    const subConfigFile = resolve(subDirection, config.tsConfigFileName);
    const hasSubConfig = existsSync(subConfigFile);

    const options: ts.CompilerOptions = ts.readConfigFile(hasSubConfig ? subConfigFile : config.tsConfigFileName, ts.sys.readFile).config;
    const cfg = ts.parseJsonConfigFileContent(options, ts.sys, hasSubConfig ? subDirection : dirname(config.tsConfigFileName));

    const host = ts.createCompilerHost(cfg.options);
    const program = ts.createProgram(sourceFiles, cfg.options, host);

    const temporaryDiagnostics = [...ts.getPreEmitDiagnostics(program), ...program.getSyntacticDiagnostics()].filter(item => {
      if (item.code) {
        // code 忽略列表
        if (config.tsCodeIgnore.length > 0 && config.tsCodeIgnore.includes(item.code)) return false;
        // code 白名单
        if (config.tsCodeCheck.length > 0 && !config.tsCodeCheck.includes(item.code)) return false;
      }

      if (item.file) {
        const shortpath = fixToshortPath(normalize(item.file.fileName));
        item.file.moduleName = shortpath;

        // 过滤间接依赖进来的文件
        if (shortpath.includes('node_modules') || shortpath.endsWith('.d.ts')) return false;
        for (const p of config.exclude) {
          if (shortpath.includes(p)) return false;
          if (minimatch(shortpath, p, { debug: config.debug })) return false;
        }
      }

      return true;
    });

    if (temporaryDiagnostics.length > 0) {
      stats.totalDiagnostics += temporaryDiagnostics.length;

      const errorDiagnostics: ts.Diagnostic[] = [];

      for (const item of temporaryDiagnostics) {
        if (!item.file) {
          errorDiagnostics.push(item);
          continue;
        }

        const shortpath = item.file.moduleName || fixToshortPath(normalize(item.file.fileName));

        if (!this.whiteList[shortpath]) {
          this.cache.allDiagnosticsFileMap[shortpath] = item;
          errorDiagnostics.push(item);
        }

        // // Error 级别最高，不能被覆盖
        if (config.toWhiteList && this.whiteList[shortpath] !== 'Error') {
          this.whiteList[shortpath] = ts.DiagnosticCategory[item.category] as never;
        }

        if (tsCheckFilesPassed[shortpath]) {
          // 从已有中移除缓存，需标记缓存有变更
          if (tsCheckFilesPassed[shortpath].updateTime != null) this.cache.tsCheckFilesPassedChanged++;
          delete tsCheckFilesPassed[shortpath];
        }
      }

      if (errorDiagnostics.length > 0) {
        let fileList = errorDiagnostics.filter(d => d.file).map(d => d.file.fileName);
        // 去重
        fileList = [...new Set(fileList)];

        this.logger.info(
          bold(redBright(`Diagnostics of need repair(not in whitelist)[${fileList.length} files]:\n`)),
          config.printDetail ? ts.formatDiagnosticsWithColorAndContext(errorDiagnostics, host) : `\n - ` + fileList.join('\n - ') + '\n'
        );
      } else {
        const fileList = temporaryDiagnostics.filter(d => d.file).map(d => d.file.fileName);

        if (fileList.length > 0) {
          this.logger.info(
            bold(yellowBright(`Diagnostics in whitelist[${redBright(fileList.length)}`)),
            bold(yellowBright(`files]:\n`)),
            config.printDetail
              ? ts.formatDiagnosticsWithColorAndContext(temporaryDiagnostics, host)
              : `\n - ` + fileList.join('\n - ') + '\n'
          );
        }
      }
    }
  }
  /** 返回指定子目录中匹配到的 ts 文件列表 */
  private async getTsFiles(subDirection: string) {
    if (!existsSync(subDirection)) return void 0;

    const fileList = await glob('**/*.{ts,tsx}', {
      cwd: subDirection,
      ignore: this.config.exclude,
      absolute: true,
    });

    // checkUnUse(fileList);
    return { fileList, subDirection };
  }
  private updateCache() {
    const { config, stats } = this;
    const passedFileList = Object.keys(this.cache.tsCache.tsCheckFilesPassed);
    /** 在白名单列表中但本次检测无异常的文件列表（将从白名单列表中移除） */
    const removeFromWhiteList: string[] = [];

    for (const shortpath of passedFileList) {
      const item = this.cache.tsCache.tsCheckFilesPassed[shortpath];
      if (!item.updateTime) {
        item.updateTime = stats.startTime;
        this.cache.tsCheckFilesPassedChanged++;

        if (this.whiteList[shortpath]) {
          delete this.whiteList[shortpath];
          removeFromWhiteList.push(shortpath);
        }
      } else if (this.whiteList[shortpath]) {
        // 在白名单中的旧缓存，可能有规则更新，缓存已不适用
        delete this.cache.tsCache.tsCheckFilesPassed[shortpath];
        this.cache.tsCheckFilesPassedChanged++;
      }
    }

    if (this.cache.tsCheckFilesPassedChanged) {
      writeFileSync(this.cacheFilePath, JSON.stringify(this.cache.tsCache, void 0, 2));
      this.logger.info(
        `update cache(${this.cache.tsCheckFilesPassedChanged}):`,
        cyanBright(fixToshortPath(this.cacheFilePath, config.rootDir))
      );
    }

    return { removeFromWhiteList };
  }
  /** 执行 ts check */
  public async check(fileList = this.config.fileList) {
    this.init();

    const { config, stats } = this;
    const directionMap = {
      // 没有 tsconfig.json 独立配置文件的子目录文件，也将全部放到这里一起编译
      [config.rootDir]: fileList || [],
    };

    this.logger.debug('config:', config);

    // 没有指定 fileList 文件列表，才按 src 指定规则匹配
    if (directionMap[config.rootDir].length === 0) {
      const directories = this.getCheckProjectDirs(config.src);
      if (!directories) {
        this.logger.info('No files or directories to process\n');
        return { isPassed: true } as TsCheckResult;
      }

      this.logger.debug('本次检测的子目录包括：', directories);
      const allTsFiles = await Promise.all(directories.map(d => this.getTsFiles(d)));
      for (const info of allTsFiles) {
        if (!info || info.fileList.length === 0) continue;

        if (existsSync(resolve(info.subDirection, config.tsConfigFileName))) {
          directionMap[info.subDirection] = info.fileList;
        } else {
          directionMap[config.rootDir].push(...info.fileList);
        }
      }
    }

    for (const d of Object.keys(directionMap)) this.compile(directionMap[d], d);

    const { removeFromWhiteList } = this.updateCache();

    if (config.toWhiteList) {
      if (!existsSync(dirname(config.whiteListFilePath))) mkdirSync(dirname(config.whiteListFilePath), { recursive: true });
      writeFileSync(config.whiteListFilePath, JSON.stringify(this.whiteList, void 0, 2));
      this.logger.info(
        `[ADD]write to whitelist(${Object.keys(this.whiteList).length}):`,
        cyanBright(fixToshortPath(config.whiteListFilePath, config.rootDir))
      );
      execSync(`git add ${config.whiteListFilePath}`, void 0, config.rootDir, !config.silent);
    } else {
      if (removeFromWhiteList.length > 0) {
        this.logger.info(
          `[REMOVE]write to whitelist(${Object.keys(this.whiteList).length}):`,
          cyanBright(fixToshortPath(config.whiteListFilePath, config.rootDir))
        );
        writeFileSync(config.whiteListFilePath, JSON.stringify(this.whiteList, void 0, 2));
        this.logger.info(`remove from whilelist(${removeFromWhiteList.length}):\n` + removeFromWhiteList.join('\n'));
        execSync(`git add ${config.whiteListFilePath}`, void 0, config.rootDir, !config.silent);
      }
    }

    const errorFileList = Object.keys(this.cache.allDiagnosticsFileMap);

    stats.passedFilesNum = stats.totalFilesNum - errorFileList.length;
    stats.failedFilesNum = errorFileList.length;
    stats.isPassed = stats.failedFilesNum === 0;

    if (!stats.isPassed && config.printDetail) {
      this.logger.error(red('Failed Files:'), `\n - ${errorFileList.join('\n - ')}\n`);
    }

    // 异常类型统计
    if (!stats.isPassed) {
      for (const filepath of errorFileList) {
        const d = this.cache.allDiagnosticsFileMap[filepath];
        const cateString = ts.DiagnosticCategory[d.category] as keyof typeof ts.DiagnosticCategory;
        stats.diagnosticsCategory[cateString] = (stats.diagnosticsCategory[cateString] || 0) + 1;
      }
      for (const keyString of Object.keys(stats.diagnosticsCategory)) {
        this.logger.info(bold(cyan(` -- ${keyString} Count：`)), bold(yellowBright(stats.diagnosticsCategory[keyString as never])));
      }
    }

    return stats;
  }
  beforeStart(fileList?: string[]): boolean {
    this.config.fileList = this.config.fileList.filter(filepath => {
      // 过滤 .d.ts 文件
      // 必须以 .tsx? 结尾
      if (filepath.endsWith('.d.ts') || !/\.tsx?$/i.test(filepath)) return false;
      return true;
    });

    if (this.config.fileList.length === 0 && (fileList || this.config.src.length === 0)) {
      return false;
    }
    return true;
  }
}
