/*
 * @Author: lzw
 * @Date: 2021-08-15 22:39:01
 * @LastEditors: lzw
 * @LastEditTime: 2022-11-25 10:45:36
 * @Description: typescript Diagnostics report
 */

import { resolve, dirname, normalize } from 'node:path';
import { existsSync, statSync } from 'node:fs';
import { bold, redBright, yellowBright, cyanBright, red, cyan } from 'console-log-colors';
import type { Diagnostic, DiagnosticCategory, CompilerOptions } from 'typescript';
import glob from 'fast-glob';
import micromatch from 'micromatch';
import { md5, fixToshortPath } from '@lzwme/fe-utils';
import type { TsCheckConfig, LintResult, WhiteListInfo, LintCacheInfo } from '../types.js';
import { LintBase } from './LintBase.js';
import { arrayToObject, fileListToString } from '../utils/common.js';

export interface TsCheckResult extends LintResult {
  /** 异常类型数量统计 */
  diagnosticsCategory: Partial<Record<keyof typeof DiagnosticCategory, number>>;
  /** 异常总数 */
  totalDiagnostics: number;
  errorTSCodes: { [code: number]: number };
}
export type TSCheckWhiteList = WhiteListInfo<{ md5: string; tscodes: { [code: number]: number } }>;
export class TsCheck extends LintBase<TsCheckConfig, TsCheckResult> {
  protected override whiteList: TSCheckWhiteList = { list: {} };
  protected override cacheInfo: LintCacheInfo<{ md5: string; updateTime: number }> = { list: {} };
  private cache: {
    /** 检测到异常且需要 report 的文件列表 */
    allDiagnosticsFileMap: { [file: string]: Diagnostic[] };
    /** 源文件列表缓存 */
    sourceFiles: Set<string>;
    /** 检测通过的文件列表是否有变动(记录变动文件数)，用于标记是否需要写回缓存 */
    passedChanged: number;
  };
  constructor(config: TsCheckConfig = {}) {
    super('tscheck', config);
  }
  protected override getInitStats() {
    this.stats = {
      ...super.getInitStats(),
      errorTSCodes: {},
      totalDiagnostics: 0,
      diagnosticsCategory: {},
    };
    this.cache = {
      allDiagnosticsFileMap: {},
      passedChanged: 0,
      sourceFiles: new Set(),
    };
    this.cacheInfo = { list: {} };

    return this.stats;
  }
  protected override init() {
    super.init();
    Object.assign(this.cacheInfo, this.getCacheInfo());
  }
  /** 返回可检测的子项目路径 */
  private getCheckProjectDirs(source = this.config.src) {
    return source.filter(d => {
      const p = resolve(this.config.rootDir, d);
      return existsSync(p) && statSync(p).isDirectory();
    });
  }
  private async compile(sourceFiles: string[], subDirection: string) {
    const { config, stats, logger } = this;
    const total = sourceFiles.length;
    const passed = this.cacheInfo.list;
    const TS = await import('typescript');

    console.log();
    logger.info(bold(cyanBright('Checking in')), subDirection);
    logger.info(' - Total Files:', cyanBright(total));

    /** 缓存命中数量 */
    let cacheHits = 0;
    /** 白名单命中数量 */
    let whiteListHits = 0;

    sourceFiles = sourceFiles.filter(filepath => {
      const fileMd5 = md5(filepath, true);
      const shortpath = fixToshortPath(filepath, config.rootDir);

      this.cache.sourceFiles.add(shortpath);

      if (!config.toWhiteList && this.whiteList.list[shortpath]) {
        if (this.whiteList.list[shortpath].md5 === fileMd5) {
          whiteListHits++;
          return false;
        }

        // 兼容旧格式
        if (typeof this.whiteList.list[shortpath] === 'string') {
          this.whiteList.list[shortpath] = { md5: fileMd5, tscodes: {} };
        }

        this.whiteList.list[shortpath].md5 = fileMd5;

        // 白名单中的文件有修改，需要更新 whiteList
        if (!stats.cacheFiles[config.whiteListFilePath]) {
          stats.cacheFiles[config.whiteListFilePath] = { updated: this.whiteList };
        }
      }

      if (passed[shortpath] && config.cache && passed[shortpath].md5 === fileMd5) {
        cacheHits++;
        return false;
      }

      passed[shortpath] = { md5: fileMd5, updateTime: null };

      return true;
    });

    if (cacheHits) logger.info(` - Cache hits:`, cacheHits);
    if (whiteListHits) logger.info(` - WhiteList hits:`, whiteListHits);

    if (sourceFiles.length === 0) return;

    const subConfigFile = resolve(subDirection, config.tsConfigFileName);
    const hasSubConfig = existsSync(subConfigFile);
    const tsConfig = TS.readConfigFile(hasSubConfig ? subConfigFile : config.tsConfigFileName, TS.sys.readFile);
    const options = Object.assign<CompilerOptions, CompilerOptions>({ forceConsistentCasingInFileNames: true }, tsConfig.config);
    const cfg = TS.parseJsonConfigFileContent(options, TS.sys, hasSubConfig ? subDirection : dirname(config.tsConfigFileName));
    const host = TS.createCompilerHost(cfg.options);
    const program = TS.createProgram(sourceFiles, cfg.options, host);

    const temporaryDiagnostics = [...TS.getPreEmitDiagnostics(program), ...program.getSyntacticDiagnostics()].filter(item => {
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
          if (micromatch.isMatch(shortpath, p, { debug: config.debug })) return false;
        }
      }

      return true;
    });

    if (temporaryDiagnostics.length > 0) {
      stats.totalDiagnostics += temporaryDiagnostics.length;

      const errorDiagnostics: Diagnostic[] = [];
      const errFileCodes: TSCheckWhiteList['list'] = {};

      for (const item of temporaryDiagnostics) {
        if (!item.file) {
          errorDiagnostics.push(item);
          continue;
        }

        const shortpath = item.file.moduleName || fixToshortPath(normalize(item.file.fileName));

        if (!this.whiteList.list[shortpath]) {
          if (!this.cache.allDiagnosticsFileMap[shortpath]) this.cache.allDiagnosticsFileMap[shortpath] = [];
          this.cache.allDiagnosticsFileMap[shortpath].push(item);
          errorDiagnostics.push(item);
        }

        if (!stats.errorTSCodes[item.code]) stats.errorTSCodes[item.code] = 0;
        stats.errorTSCodes[item.code]++;

        if (!errFileCodes[shortpath]) {
          errFileCodes[shortpath] = { md5: this.cacheInfo.list[shortpath]?.md5 || this.whiteList.list[shortpath]?.md5, tscodes: {} };
        }
        if (!errFileCodes[shortpath].tscodes[item.code]) errFileCodes[shortpath].tscodes[item.code] = 0;
        errFileCodes[shortpath].tscodes[item.code]++;

        if (passed[shortpath]) {
          // 从已有中移除缓存，需标记缓存有变更
          if (passed[shortpath].updateTime != null) this.cache.passedChanged++;
          delete passed[shortpath];
        }
      }

      if (errorDiagnostics.length > 0) {
        const fileList = [...new Set(errorDiagnostics.filter(d => d.file).map(d => fixToshortPath(d.file.fileName)))];

        logger.info(
          bold(redBright(`Diagnostics of need repair(not in whitelist)[${fileList.length} files]:\n`)),
          config.printDetail ? TS.formatDiagnosticsWithColorAndContext(errorDiagnostics, host) : fileListToString(fileList)
        );
      } else {
        const fileList = [...new Set(temporaryDiagnostics.filter(d => d.file).map(d => fixToshortPath(d.file.fileName)))];

        if (fileList.length > 0) {
          if (config.printDetail && config.printDetialOnSuccessed) {
            logger.info('\n', TS.formatDiagnosticsWithColorAndContext(temporaryDiagnostics, host));
          }

          logger.info(
            bold(yellowBright(`Diagnostics in whitelist[${redBright(fileList.length)}`)),
            bold(yellowBright(`files]:\n`)),
            fileListToString(fileList)
          );
        }
      }

      if (config.toWhiteList) Object.assign(this.whiteList.list, errFileCodes);
      logger.debug('errFileCodes', errFileCodes);
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

    return { fileList, subDirection };
  }
  private updateCache() {
    const { cache, cacheInfo, config, stats } = this;
    /** 在白名单列表中但本次检测无异常的文件列表（将从白名单列表中移除） */
    const removeFromWhiteList: string[] = [];
    const deleted = {} as Record<string, unknown>;

    for (const shortpath of Object.keys(cacheInfo.list)) {
      const item = cacheInfo.list[shortpath];
      if (!item.updateTime) {
        item.updateTime = stats.startTime;
        cache.passedChanged++;

        if (this.whiteList.list[shortpath]) {
          delete this.whiteList.list[shortpath];
          removeFromWhiteList.push(shortpath);
        }
      } else if (this.whiteList.list[shortpath]) {
        // 在白名单中的旧缓存，可能有规则更新，缓存已不适用
        delete cacheInfo.list[shortpath];
        deleted[shortpath] = 1;
        cache.passedChanged++;
      }
    }

    if (cache.passedChanged) {
      stats.cacheFiles[this.cacheFilePath] = { updated: this.cacheInfo, deleted };
      this.logger.info(`update cache(${cache.passedChanged}):`, cyanBright(fixToshortPath(this.cacheFilePath, config.rootDir)));
    }

    return { removeFromWhiteList };
  }
  public async check(fileList = this.config.fileList) {
    const { config, stats, logger } = this;
    const TS = await import('typescript');
    const directionMap = {
      // 没有 tsconfig.json 独立配置文件的子目录文件，也将全部放到这里一起编译
      [config.rootDir]: fileList || [],
    };

    logger.debug('config:', config);

    // 没有指定 fileList 文件列表，才按 src 指定规则匹配
    if (directionMap[config.rootDir].length === 0) {
      const directories = this.getCheckProjectDirs(config.src);
      if (!directories) {
        logger.info('No files or directories to process\n');
        return { isPassed: true } as TsCheckResult;
      }

      logger.debug('本次检测的子目录包括：', directories);
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

    for (const d of Object.entries(directionMap)) await this.compile(d[1], d[0]);

    const { removeFromWhiteList } = this.updateCache();

    if (config.toWhiteList) {
      stats.cacheFiles[config.whiteListFilePath] = { updated: this.whiteList };
      logger.info(
        `[ADD]write to whitelist(${Object.keys(this.whiteList).length}):`,
        cyanBright(fixToshortPath(config.whiteListFilePath, config.rootDir))
      );
    } else {
      if (removeFromWhiteList.length > 0) {
        logger.info(
          `[REMOVE]write to whitelist(${Object.keys(this.whiteList).length}):`,
          cyanBright(fixToshortPath(config.whiteListFilePath, config.rootDir))
        );
        stats.cacheFiles[config.whiteListFilePath] = {
          updated: this.whiteList,
          deleted: arrayToObject(removeFromWhiteList),
        };
        logger.info(`remove from whilelist(${removeFromWhiteList.length}):${fileListToString(removeFromWhiteList)}`);
      }
    }

    const errorFileList = Object.keys(this.cache.allDiagnosticsFileMap);

    stats.totalFilesNum = this.cache.sourceFiles.size;
    stats.passedFilesNum = [...this.cache.sourceFiles].filter(d => !errorFileList.includes(d)).length;
    stats.failedFilesNum = errorFileList.length;
    stats.isPassed = config.toWhiteList || stats.failedFilesNum === 0;

    // 异常类型统计
    if (!stats.isPassed) {
      if (config.printDetail) logger.error(red('Failed Files:'), fileListToString(errorFileList));

      for (const shortpath of errorFileList) {
        const d = this.cache.allDiagnosticsFileMap[shortpath];
        d.forEach(item => {
          const cateString = TS.DiagnosticCategory[item.category] as keyof typeof DiagnosticCategory;
          stats.diagnosticsCategory[cateString] = (stats.diagnosticsCategory[cateString] || 0) + 1;
        });
      }
      for (const keyString of Object.keys(stats.diagnosticsCategory)) {
        logger.info(bold(cyan(` -- ${keyString} Count：`)), bold(yellowBright(stats.diagnosticsCategory[keyString as never])));
      }
    }

    return stats;
  }
  beforeStart(): boolean {
    if (this.isCheckAll) return true;
    this.config.fileList = this.config.fileList.filter(filepath => {
      return /\.tsx?$/i.test(filepath) && !filepath.endsWith('.d.ts');
    });
    return this.config.fileList.length > 0;
  }
}
