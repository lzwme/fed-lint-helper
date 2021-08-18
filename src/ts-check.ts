/*
 * @Author: lzw
 * @Date: 2021-08-15 22:39:01
 * @LastEditors: lzw
 * @LastEditTime: 2021-08-18 14:42:44
 * @Description: typescript Diagnostics report
 */

import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import * as ts from 'typescript';
import glob from 'glob';
import { fixToshortPath, logTimeCost, md5, exit } from './utils';

export interface TsCheckConfig {
  /** 项目源码目录，支持配置多个子项目(存在独立的 tsconfig.json)路径，默认为 ['src'] */
  src?: string[];
  /** ts 文件列表。当设置并存在内容时，只对该列表中的文件进行检测。主要用于 git hook 获取 commit 文件列表的场景 */
  tsFiles?: string[];
  /** 文件排除列表， glob 规则。用于过滤一些不需要检测的文件 */
  exclude?: string | string[];
  /** 项目根目录，默认为当前工作目录 */
  rootDir?: string;
  /** 本次 check 是否使用缓存。为 false 则进行全量文件检测，否则不检测已缓存通过的文件。默认为 true。当 ts 升级、规则变更、CI 执行 MR 时建议设置为 false */
  cache?: boolean;
  /** 是否移除缓存文件。设置为 true 将移除缓存并生成新的。默认 false */
  removeCache?: boolean;
  /** ts 检测通过文件的缓存。不应提交至 git 仓库。默认为 `<config.rootDir>/node_modules/.cache/flh/tsCheckCache.json` */
  cacheFilePath?: string;
  /** 白名单列表文件保存的路径，用于过滤允许出错的历史文件。默认为 `<config.rootDir>/tsCheckWhiteList.json` 文件 */
  whiteListFilePath?: string;
  /** tsconfig 配置文件的文件名。默认为 tsconfig.json */
  tsConfigFileName?: string;
  /** 初始化即执行check。默认为 true。设置为 false 则需自行调用 start 方法 */
  checkOnInit?: boolean;
  /**
   * 要检测的 ignoreDiagnostics code 列表。如设置，则仅检查包含于此列表中的异常
   * @see https://www.tslang.cn/docs/handbook/error.html
   */
  tsCodeCheck?: number[];
  /**
   * 要忽略的 ignoreDiagnostics code 列表
   * @see https://www.tslang.cn/docs/handbook/error.html
   */
  tsCodeIgnore?: number[];
  /** 是否开启调试模式(打印更多的细节) */
  debug?: boolean;
  /** 静默模式。不打印任何信息，一般用于接口调用 */
  silent?: boolean;
  /** 执行完成时存在 lint 异常，是否退出程序。默认为 true */
  exitOnError?: boolean;
  /** 是否将异常文件输出至白名单列表文件中（追加模式，如需全新生成，应先删除白名单文件）。初始化、规则变更、版本升级导致新增异常，但又不能立即修复的情况下可设置为 true */
  toWhiteList?: boolean;
}

export class TsCheck {
  private stats = this.getInitStats();
  /** 白名单列表 */
  private whiteList = {} as { [filepath: string]: string }; // ts.DiagnosticCategory

  constructor(private config: TsCheckConfig = {}) {
    this.parseConfig(config);
    if (this.config.checkOnInit) this.start();
  }
  /** 打印日志 */
  private printLog(...args) {
    if (this.config.silent) return;
    console.log(...args);
  }
  private getInitStats() {
    const stats = {
      startTime: Date.now(),
      /** 匹配到的 ts 文件总数 */
      totalFiles: 0,
      /** 异常类型数量统计 */
      allDiagnosticsCategory: new Map<ts.DiagnosticCategory, number>(),
      /** 检测到异常且需要 report 的文件列表 */
      allDiagnosticsFileMap: {} as { [file: string]: ts.Diagnostic },
      /** 要缓存到 cacheFilePath 的信息 */
      tsCache: {
        /** 已经检测且无异常的文件列表 */
        tsCheckFilesPassed: {} as { [filepath: string]: { md5: string; updateTime: number } },
      },
      /** 检测通过的文件列表是否有变动，用于标记是否需要写回缓存 */
      tsCheckFilesPassedChanged: false,
    };
    this.stats = stats;
    return stats;
  }
  private parseConfig(config: TsCheckConfig) {
    this.config = Object.assign(
      {
        rootDir: process.cwd(),
        src: ['src'],
        exclude: ['**/*.test.{ts,tsx}', '**/*/*.mock.{ts,tsx}', '**/*/*.d.ts'],
        cache: true,
        removeCache: false,
        cacheFilePath: 'node_modules/.cache/flh/tsCheckCache.json',
        whiteListFilePath: 'tsCheckWhiteList.json',
        tsConfigFileName: 'tsconfig.json',
        tsCodeCheck: [],
        tsCodeIgnore: [],
        debug: !!process.env.DEBUG,
        exitOnError: true,
        checkOnInit: true,
      } as TsCheckConfig,
      config
    );

    this.config.cacheFilePath = path.resolve(this.config.rootDir, this.config.cacheFilePath);
    this.config.whiteListFilePath = path.resolve(this.config.rootDir, this.config.whiteListFilePath);
  }
  private init() {
    const { cacheFilePath, whiteListFilePath, removeCache, cache } = this.config;

    if (fs.existsSync(cacheFilePath)) {
      try {
        if (removeCache) {
          fs.unlinkSync(cacheFilePath);
        } else if (cache) {
          const cacheInfo = JSON.parse(fs.readFileSync(cacheFilePath, { encoding: 'utf-8' }));
          if (cacheInfo.tsCheckFilesPassed) this.stats.tsCache = cacheInfo;
        }
      } catch (e) {
        console.log(e.message || e.stack || e);
      }
    }

    // 读取白名单列表
    if (fs.existsSync(whiteListFilePath)) {
      try {
        this.whiteList = JSON.parse(fs.readFileSync(whiteListFilePath, { encoding: 'utf-8' }));
      } catch (e) {
        console.log(e.message || e.stack || e);
      }
    }
  }
  /** 返回可检测的子项目路径 */
  private getCheckProjectDirs() {
    const { rootDir, src } = this.config;
    return src.filter(d => fs.existsSync(path.resolve(rootDir, d)));
  }

  /** ts 编译 */
  private compile(sourceFiles: string[], subDir: string): void {
    const total = sourceFiles.length;
    const { config, stats } = this;
    const { tsCheckFilesPassed } = this.stats.tsCache;

    this.stats.totalFiles += total;

    this.printLog();
    this.printLog(chalk.bold.cyanBright('Checking'), subDir);
    this.printLog(' - Total Number Of Files:', total);

    /** 缓存命中数量 */
    let cacheHits = 0;
    /** 白名单命中数量 */
    let whiteListHits = 0;

    sourceFiles = sourceFiles.filter(name => {
      const shortpath = fixToshortPath(name, config.rootDir);

      // 缓存过滤
      if (config.cache) {
        if (tsCheckFilesPassed[shortpath]) {
          // tsCheckFilesPassed[shortpath].updateTime = startTime;
          cacheHits++;
          if (tsCheckFilesPassed[shortpath].md5 === md5(name, true)) return false;
        }

        // 先放到 tsCheckFilesPassed 中
        tsCheckFilesPassed[shortpath] = { md5: '', updateTime: stats.startTime };
      }

      if (this.whiteList[shortpath]) {
        whiteListHits++;
        return false;
      }

      return true;
    });

    if (cacheHits) this.printLog(` - Cache hits:`, cacheHits);
    if (whiteListHits) this.printLog(` - WhiteList hits:`, whiteListHits);

    if (!sourceFiles.length) return;

    const subConfigFile = path.resolve(subDir, config.tsConfigFileName);
    const hasSubConfig = fs.existsSync(subConfigFile);

    const options: ts.CompilerOptions = ts.readConfigFile(hasSubConfig ? subConfigFile : config.tsConfigFileName, ts.sys.readFile).config;
    const cfg = ts.parseJsonConfigFileContent(options, ts.sys, hasSubConfig ? subDir : path.dirname(config.tsConfigFileName));

    const host = ts.createCompilerHost(cfg.options);
    const program = ts.createProgram(sourceFiles, cfg.options, host);

    const tempDiagnostics = ts
      .getPreEmitDiagnostics(program)
      .concat(program.getSyntacticDiagnostics())
      .filter(item => {
        // code 忽略列表
        if (config.tsCodeIgnore.length && config.tsCodeIgnore.includes(item.code)) return false;
        // code 白名单
        if (config.tsCodeCheck.length && !config.tsCodeCheck.includes(item.code)) return false;

        return true;
      });

    if (tempDiagnostics.length) {
      this.printLog(ts.formatDiagnosticsWithColorAndContext(tempDiagnostics, host));

      tempDiagnostics.forEach(d => {
        stats.allDiagnosticsCategory.set(d.category, (stats.allDiagnosticsCategory.get(d.category) || 0) + 1);
        const shortpath = fixToshortPath(path.normalize(d.file.fileName));
        const key = shortpath; // d.file.id ||

        stats.allDiagnosticsFileMap[key] = d;
        if (tsCheckFilesPassed[shortpath]) {
          // 移除缓存
          if (tsCheckFilesPassed[shortpath].md5) stats.tsCheckFilesPassedChanged = true;
          delete tsCheckFilesPassed[shortpath];
        }

        if (config.toWhiteList) {
          // Error 级别最高
          if (this.whiteList[key] !== 'Error') this.whiteList[key] = ts.DiagnosticCategory[d.category];
        }
      });
    }
  }
  /** 返回指定子目录中匹配到的 ts 文件列表 */
  private getTsFiles(subDir: string) {
    if (!fs.existsSync(subDir)) return null;

    const tsFiles = glob.sync('**/*.{ts,tsx}', {
      cwd: subDir,
      ignore: this.config.exclude,
      realpath: true,
    });

    // checkUnUse(tsFiles);
    return { tsFiles, subDir };
  }
  /** 执行 check */
  public start(tsFiles = this.config.tsFiles) {
    this.init();

    const { config, stats } = this;
    const { rootDir, debug } = config;
    const { tsCache } = stats;
    const dirs = this.getCheckProjectDirs();

    if (debug) console.log('本次检测的子目录包括：', dirs);

    // 逐个目录编译，比较慢
    // dirs.map(d => getTsFiles(d)).forEach(d => d?.tsFiles && compile(d.tsFiles, d.subDir));

    const dirMap = {
      // 没有 tsconfig.json 独立配置文件的子目录文件，也将全部放到这里一起编译
      [rootDir]: tsFiles || [],
    };

    // 没有指定 tsFiles 文件列表，才按 src 指定规则匹配
    if (!dirMap[rootDir].length) {
      dirs
        .map(d => this.getTsFiles(d))
        .forEach(info => {
          if (!info || !info.tsFiles.length) return;

          if (fs.existsSync(path.resolve(info.subDir, config.tsConfigFileName))) {
            dirMap[info.subDir] = info.tsFiles;
          } else {
            dirMap[rootDir].push(...info.tsFiles);
          }
        });
    }

    Object.keys(dirMap).forEach(subDir => this.compile(dirMap[subDir], subDir));

    if (config.cache || config.removeCache) {
      const passedFileList = Object.keys(tsCache.tsCheckFilesPassed);
      passedFileList.forEach(shortpath => {
        if (!tsCache.tsCheckFilesPassed[shortpath].md5) {
          tsCache.tsCheckFilesPassed[shortpath].md5 = md5(path.resolve(rootDir, shortpath), true);
          stats.tsCheckFilesPassedChanged = true;
        }
      });

      if (stats.tsCheckFilesPassedChanged) {
        if (!fs.existsSync(path.dirname(config.cacheFilePath))) fs.mkdirSync(path.dirname(config.cacheFilePath), { recursive: true });
        fs.writeFileSync(config.cacheFilePath, JSON.stringify(tsCache, null, 2));
        this.printLog('Write to cache:', chalk.cyanBright(config.cacheFilePath));
      }
    }

    if (config.toWhiteList) {
      if (!fs.existsSync(path.dirname(config.whiteListFilePath))) fs.mkdirSync(path.dirname(config.whiteListFilePath), { recursive: true });
      fs.writeFileSync(config.whiteListFilePath, JSON.stringify(this.whiteList, null, 2));
      this.printLog('Write to WhiteList:', chalk.cyanBright(config.whiteListFilePath));
    }

    const errCount = Object.keys(stats.allDiagnosticsFileMap).length;
    const result = {
      /** 匹配到的文件总数 */
      total: stats.totalFiles,
      /** 检测通过的文件数 */
      passed: stats.totalFiles - errCount,
      /** 失败的文件数 */
      failed: errCount,
      diagnosticCategory: {
        Warning: 0,
        Error: 0,
        Suggestion: 0,
        Message: 0,
      },
    };

    this.printLog();
    this.printLog('Total Files：\t', result.total);
    this.printLog('Passed：\t', chalk.bold.greenBright(result.passed));
    this.printLog('Failed：\t', chalk.bold.red(result.failed));
    stats.allDiagnosticsCategory.forEach((value, key) => {
      const keyStr = ts.DiagnosticCategory[key] as keyof typeof result.diagnosticCategory;
      result.diagnosticCategory[keyStr] = value;

      this.printLog(chalk.bold.cyan(` -- ${keyStr} Count：`), chalk.bold.yellowBright(value));
    });
    // if (!errCount) this.printLog(chalk.bold.bgGreen.white(' BINGO! '));

    if (config.exitOnError && result.failed) {
      exit(result.failed, stats.startTime, '[TsCheck]');
    } else {
      if (!config.silent) logTimeCost(stats.startTime, '[TsCheck]');
    }

    return result;
  }
}
