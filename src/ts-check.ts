/*
 * @Author: lzw
 * @Date: 2021-08-15 22:39:01
 * @LastEditors: lzw
 * @LastEditTime: 2022-06-29 16:57:50
 * @Description: typescript Diagnostics report
 */

import { color } from 'console-log-colors';
import fs from 'fs';
import path from 'path';
import * as ts from 'typescript';
import glob from 'fast-glob';
import minimatch from 'minimatch';
import { fixToshortPath, md5, assign, getLogger, execSync, getTimeCost } from './utils';
import { createForkThread } from './utils/fork';
import { TsCheckConfig, getConfig, VERSION } from './config';
import { exit } from './exit';

const { bold, redBright, yellowBright, cyanBright, red, greenBright, cyan } = color;
export interface TsCheckResult {
  /**是否检测通过 */
  isPassed: boolean;
  /** 匹配到的文件总数 */
  total: number;
  /** 检测通过的文件数 */
  passed: number;
  /** 失败的文件数 */
  failed: number;
  diagnosticCategory: Record<keyof typeof ts.DiagnosticCategory, number>;
}
export class TsCheck {
  private stats = this.getInitStats();
  /** 白名单列表 */
  private whiteList = {} as Record<string, keyof typeof ts.DiagnosticCategory>; // ts.DiagnosticCategory
  /** 检测缓存文件的路径。不应提交至 git 仓库: 默认为 <config.rootDir>/node_modules/.cache/flh/tsCheckCache.json */
  private cacheFilePath = 'node_modules/.cache/flh/tscheckcache.json';
  private logger: ReturnType<typeof getLogger>;

  constructor(private config: TsCheckConfig = {}) {
    config = this.parseConfig(config);
    this.logger.debug('config', this.config);
    if (config.checkOnInit) this.start();
  }
  private getInitStats() {
    const stats = {
      /** 最近一次处理是否成功 */
      success: false,
      /** 最近一次处理的开始时间 */
      startTime: Date.now(),
      /** 匹配到的 ts 文件总数 */
      totalFiles: 0,
      /** 异常总数 */
      totalDiagnostics: 0,
      /** 异常类型数量统计 */
      allDiagnosticsCategory: {} as Record<keyof typeof ts.DiagnosticCategory, number>,
      /** 检测到异常且需要 report 的文件列表 */
      allDiagnosticsFileMap: {} as { [file: string]: ts.Diagnostic },
      /** 要缓存到 cacheFilePath 的信息 */
      tsCache: {
        /** 已经检测且无异常的文件列表 */
        tsCheckFilesPassed: {} as { [filepath: string]: { md5: string; updateTime: number } },
        version: VERSION,
      },
      /** 检测通过的文件列表是否有变动(记录变动文件数)，用于标记是否需要写回缓存 */
      tsCheckFilesPassedChanged: 0,
    };
    this.stats = stats;
    return stats;
  }
  /** 返回执行结果统计信息 */
  public get statsInfo() {
    return this.stats;
  }
  /** 配置参数格式化 */
  public parseConfig(config: TsCheckConfig) {
    const baseConfig = getConfig({ tscheck: config });

    this.config = assign<TsCheckConfig>({}, baseConfig.tscheck);
    this.cacheFilePath = path.resolve(this.config.rootDir, baseConfig.cacheLocation, 'tsCheckCache.json');
    this.config.whiteListFilePath = path.resolve(this.config.rootDir, this.config.whiteListFilePath);

    const level = this.config.silent ? 'silent' : this.config.debug ? 'debug' : 'log';
    this.logger = getLogger(`[TSCheck]`, level, baseConfig.logDir);
    return this.config;
  }
  private init() {
    const { whiteListFilePath, removeCache } = this.config;

    if (fs.existsSync(this.cacheFilePath)) {
      try {
        if (removeCache) {
          fs.unlinkSync(this.cacheFilePath);
        } else {
          const cacheInfo = JSON.parse(fs.readFileSync(this.cacheFilePath, { encoding: 'utf8' }));
          if (cacheInfo.version !== VERSION) fs.unlinkSync(this.cacheFilePath);
          else if (cacheInfo.tsCheckFilesPassed) this.stats.tsCache = cacheInfo;
        }
      } catch (error) {
        this.logger.error(error.message || error.stack || error);
      }
    }

    // 读取白名单列表
    if (!this.config.toWhiteList && fs.existsSync(whiteListFilePath)) {
      try {
        this.whiteList = JSON.parse(fs.readFileSync(whiteListFilePath, { encoding: 'utf8' }));
      } catch (error) {
        this.logger.error(error.message || error.stack || error);
      }
    }

    // 文件列表过滤
    this.config.tsFiles = this.config.tsFiles.filter(filepath => {
      // 过滤 .d.ts 文件
      if (filepath.endsWith('.d.ts')) return false;
      // 必须以 .tsx? 结尾
      if (!/\.tsx?$/i.test(filepath)) return false;
      return true;
    });
  }
  /** 返回可检测的子项目路径 */
  private getCheckProjectDirs(source = this.config.src) {
    const { rootDir } = this.config;
    return source.filter(d => {
      const p = path.resolve(rootDir, d);
      return fs.existsSync(p) && fs.statSync(p).isDirectory();
    });
  }

  /** ts 编译 */
  private compile(sourceFiles: string[], subDirection: string): void {
    const total = sourceFiles.length;
    const { config, stats } = this;
    const { tsCheckFilesPassed } = this.stats.tsCache;

    this.stats.totalFiles += total;

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

    const subConfigFile = path.resolve(subDirection, config.tsConfigFileName);
    const hasSubConfig = fs.existsSync(subConfigFile);

    const options: ts.CompilerOptions = ts.readConfigFile(hasSubConfig ? subConfigFile : config.tsConfigFileName, ts.sys.readFile).config;
    const cfg = ts.parseJsonConfigFileContent(options, ts.sys, hasSubConfig ? subDirection : path.dirname(config.tsConfigFileName));

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
        const shortpath = fixToshortPath(path.normalize(item.file.fileName));
        item.file.moduleName = shortpath;

        // 过滤间接依赖进来的文件
        if (shortpath.includes('node_modules') || shortpath.endsWith('.d.ts')) return false;
        for (const p of config.exclude) {
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

        const shortpath = item.file.moduleName || fixToshortPath(path.normalize(item.file.fileName));

        if (!this.whiteList[shortpath]) {
          stats.allDiagnosticsFileMap[shortpath] = item;
          errorDiagnostics.push(item);
        }

        // // Error 级别最高，不能被覆盖
        if (config.toWhiteList && this.whiteList[shortpath] !== 'Error') {
          this.whiteList[shortpath] = ts.DiagnosticCategory[item.category] as never;
        }

        if (tsCheckFilesPassed[shortpath]) {
          // 从已有中移除缓存，需标记缓存有变更
          if (tsCheckFilesPassed[shortpath].updateTime != null) stats.tsCheckFilesPassedChanged++;
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
    if (!fs.existsSync(subDirection)) return void 0;

    const tsFiles = await glob('**/*.{ts,tsx}', {
      cwd: subDirection,
      ignore: this.config.exclude as string[],
      absolute: true,
    });

    // checkUnUse(tsFiles);
    return { tsFiles, subDirection };
  }
  private updateCache() {
    const { config, stats } = this;
    const passedFileList = Object.keys(stats.tsCache.tsCheckFilesPassed);
    /** 在白名单列表中但本次检测无异常的文件列表（将从白名单列表中移除） */
    const removeFromWhiteList: string[] = [];

    for (const shortpath of passedFileList) {
      const item = stats.tsCache.tsCheckFilesPassed[shortpath];
      if (!item.updateTime) {
        item.updateTime = stats.startTime;
        stats.tsCheckFilesPassedChanged++;

        if (this.whiteList[shortpath]) {
          delete this.whiteList[shortpath];
          removeFromWhiteList.push(shortpath);
        }
      } else if (this.whiteList[shortpath]) {
        // 在白名单中的旧缓存，可能有规则更新，缓存已不适用
        delete stats.tsCache.tsCheckFilesPassed[shortpath];
        stats.tsCheckFilesPassedChanged++;
      }
    }

    if (stats.tsCheckFilesPassedChanged) {
      fs.writeFileSync(this.cacheFilePath, JSON.stringify(stats.tsCache, void 0, 2));
      this.logger.info(`update cache(${stats.tsCheckFilesPassedChanged}):`, cyanBright(fixToshortPath(this.cacheFilePath, config.rootDir)));
    }

    return { removeFromWhiteList };
  }
  /** 执行 ts check */
  public async check(tsFiles = this.config.tsFiles) {
    this.logger.info('start checking');
    this.init();

    const { config, stats } = this;
    const directionMap = {
      // 没有 tsconfig.json 独立配置文件的子目录文件，也将全部放到这里一起编译
      [config.rootDir]: tsFiles || [],
    };

    this.logger.debug('config:', config);

    // 没有指定 tsFiles 文件列表，才按 src 指定规则匹配
    if (directionMap[config.rootDir].length === 0) {
      const directories = this.getCheckProjectDirs(config.src);
      if (!directories) {
        this.logger.info('No files or directories to process\n');
        return { isPassed: true } as TsCheckResult;
      }

      this.logger.debug('本次检测的子目录包括：', directories);
      const allTsFiles = await Promise.all(directories.map(d => this.getTsFiles(d)));
      for (const info of allTsFiles) {
        if (!info || info.tsFiles.length === 0) continue;

        if (fs.existsSync(path.resolve(info.subDirection, config.tsConfigFileName))) {
          directionMap[info.subDirection] = info.tsFiles;
        } else {
          directionMap[config.rootDir].push(...info.tsFiles);
        }
      }
    }

    for (const d of Object.keys(directionMap)) this.compile(directionMap[d], d);

    const { removeFromWhiteList } = this.updateCache();

    if (config.toWhiteList) {
      if (!fs.existsSync(path.dirname(config.whiteListFilePath))) fs.mkdirSync(path.dirname(config.whiteListFilePath), { recursive: true });
      fs.writeFileSync(config.whiteListFilePath, JSON.stringify(this.whiteList, void 0, 2));
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
        fs.writeFileSync(config.whiteListFilePath, JSON.stringify(this.whiteList, void 0, 2));
        this.logger.info(`remove from whilelist(${removeFromWhiteList.length}):\n` + removeFromWhiteList.join('\n'));
        execSync(`git add ${config.whiteListFilePath}`, void 0, config.rootDir, !config.silent);
      }
    }

    const errorFileList = Object.keys(stats.allDiagnosticsFileMap);
    const result: TsCheckResult = {
      isPassed: errorFileList.length === 0,
      /** 匹配到的文件总数 */
      total: stats.totalFiles,
      /** 检测通过的文件数 */
      passed: stats.totalFiles - errorFileList.length,
      /** 失败的文件数 */
      failed: errorFileList.length,
      diagnosticCategory: stats.allDiagnosticsCategory,
    };

    this.stats.success = result.failed !== 0;

    if (result.failed && config.printDetail) {
      this.logger.info(red('Failed Files:'), `\n - ${errorFileList.join('\n - ')}\n`);
    }

    this.logger.info(cyan('Total :\t'), result.total);
    this.logger.info(cyan('Passed:\t'), bold(greenBright(result.passed)));
    this.logger.info(cyan('Failed:\t'), bold(red(result.failed)));

    // 异常类型统计
    if (result.failed) {
      for (const filepath of errorFileList) {
        const d = stats.allDiagnosticsFileMap[filepath];
        const cateString = ts.DiagnosticCategory[d.category];
        stats.allDiagnosticsCategory[cateString] = (stats.allDiagnosticsCategory[cateString] || 0) + 1;
      }
      for (const keyString of Object.keys(stats.allDiagnosticsCategory)) {
        this.logger.info(bold(cyan(` -- ${keyString} Count：`)), bold(yellowBright(result.diagnosticCategory[keyString])));
      }
    }

    if (!result.failed) {
      this.logger.info(bold(greenBright('Verification passed!')));
    } else {
      this.logger.info(bold(redBright('Verification failed!')));
    }

    return result;
  }
  /**
   * 在 fork 子进程中执行
   */
  private checkInChildProc() {
    this.logger.info('start fork child progress');

    return createForkThread<TsCheckResult>({
      type: 'tscheck',
      debug: this.config.debug,
      tsCheckConfig: this.config,
    }).catch(error => {
      this.logger.error('checkInChildProc error, code:', error);
      return { isPassed: false, failed: error } as TsCheckResult;
    });
  }
  /**
   * 在 work_threads 子线程中执行
   */
  private checkInWorkThreads() {
    this.logger.info('start create work threads');

    return import('./utils/worker-threads').then(({ createWorkerThreads }) => {
      return createWorkerThreads<TsCheckResult>({
        type: 'tscheck',
        debug: this.config.debug,
        tsCheckConfig: this.config,
      }).catch(error => {
        this.logger.error('checkInWorkThreads error, code:', error);
        return { isPassed: false, failed: error } as TsCheckResult;
      });
    });
  }
  /** 执行 check */
  public async start(tsFiles?: string[]) {
    if (tsFiles && tsFiles !== this.config.tsFiles) this.config.tsFiles = tsFiles;
    this.init();

    if (this.config.tsFiles.length === 0 && (tsFiles || this.config.src.length === 0)) {
      this.logger.info('No files to process\n');
      return { isPassed: true } as TsCheckResult;
    }

    let result: TsCheckResult;
    if (this.config.mode === 'proc') result = await this.checkInChildProc();
    else if (this.config.mode === 'thread') result = await this.checkInWorkThreads();
    else result = await this.check(this.config.tsFiles);

    this.stats.success = !!result.isPassed;
    this.logger.debug('result', result);
    this.logger.info(getTimeCost(this.stats.startTime));
    if (!result.isPassed && this.config.exitOnError) exit(result.failed || -1, '[TsCheck]');

    return result;
  }
}
