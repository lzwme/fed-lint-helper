/*
 * @Author: lzw
 * @Date: 2021-08-15 22:39:01
 * @LastEditors: lzw
 * @LastEditTime: 2021-08-26 17:36:51
 * @Description: typescript Diagnostics report
 */

import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import * as ts from 'typescript';
import glob from 'glob';
import { fixToshortPath, md5, exit } from './utils';
import { createForkThread } from './utils/fork';
import { createWorkerThreads } from './utils/worker-threads';

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
  /** 初始化即执行check。默认为 false。设置为 true 则初始化后即调用 start 方法 */
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
  /** 是否打印诊断错误详情。默认为 true */
  printDetail?: boolean;
  /** 执行完成时存在 lint 异常，是否退出程序。默认为 true */
  exitOnError?: boolean;
  /** 是否将异常文件输出至白名单列表文件中（追加模式，如需全新生成，应先删除白名单文件）。初始化、规则变更、版本升级导致新增异常，但又不能立即修复的情况下可设置为 true */
  toWhiteList?: boolean;
  /**
   * 执行检测的方式。默认为 proc
   * @var proc fork 子进程执行
   * @var thread 创建 work_threads 子线程执行。eslint 不要选此选项
   * @var current 在当前进程中执行
   */
  mode?: 'proc' | 'thread' | 'current';
}

export interface TsCheckResult {
  total: number;
  passed: number;
  failed: number;
  diagnosticCategory: Record<keyof typeof ts.DiagnosticCategory, number>;
}
export class TsCheck {
  private stats = this.getInitStats();
  /** 白名单列表 */
  private whiteList = {} as Record<string, keyof typeof ts.DiagnosticCategory>; // ts.DiagnosticCategory

  constructor(private config: TsCheckConfig = {}) {
    this.parseConfig(config);
    if (this.config.checkOnInit) this.start();
  }
  /** 打印日志 */
  private printLog(...args) {
    if (this.config.silent) return;
    // 打印空行
    if (!args.length) console.log();
    else console.log(chalk.cyan('[TSCheck]'), ...args);
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
      },
      /** 检测通过的文件列表是否有变动，用于标记是否需要写回缓存 */
      tsCheckFilesPassedChanged: false,
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
    if (config !== this.config) config = Object.assign({}, this.config, config);
    this.config = Object.assign(
      {
        rootDir: process.cwd(),
        src: ['src'],
        tsFiles: [],
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
        checkOnInit: false,
        printDetail: true,
        mode: 'thread',
      } as TsCheckConfig,
      config
    );

    this.config.cacheFilePath = path.resolve(this.config.rootDir, this.config.cacheFilePath);
    this.config.whiteListFilePath = path.resolve(this.config.rootDir, this.config.whiteListFilePath);
    return this;
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
  private getCheckProjectDirs(src = this.config.src) {
    const { rootDir } = this.config;
    return src.filter(d => {
      const p = path.resolve(rootDir, d);
      return fs.existsSync(p) && fs.statSync(p).isDirectory();
    });
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

      if (this.whiteList[shortpath]) {
        whiteListHits++;
        return false;
      }

      // 缓存过滤
      if (config.cache) {
        if (tsCheckFilesPassed[shortpath]) {
          if (tsCheckFilesPassed[shortpath].md5 === md5(name, true)) {
            cacheHits++;
            return false;
          }
        }

        // 新文件：先放到 tsCheckFilesPassed 中
        tsCheckFilesPassed[shortpath] = { md5: '', updateTime: stats.startTime };
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

    const tmpDiagnostics = ts
      .getPreEmitDiagnostics(program)
      .concat(program.getSyntacticDiagnostics())
      .filter(item => {
        if (item.code) {
          // code 忽略列表
          if (config.tsCodeIgnore.length && config.tsCodeIgnore.includes(item.code)) return false;
          // code 白名单
          if (config.tsCodeCheck.length && !config.tsCodeCheck.includes(item.code)) return false;
        }

        return true;
      });

    if (tmpDiagnostics.length) {
      stats.totalDiagnostics += tmpDiagnostics.length;

      const errDiagnostics: ts.Diagnostic[] = [];
      const whiteListDiagnostics: ts.Diagnostic[] = [];

      tmpDiagnostics.forEach(d => {
        const cateStr = ts.DiagnosticCategory[d.category];
        stats.allDiagnosticsCategory[cateStr] = (stats.allDiagnosticsCategory[cateStr] || 0) + 1;

        if (!d.file) {
          errDiagnostics.push(d);
          return;
        }

        const shortpath = fixToshortPath(path.normalize(d.file.fileName));
        const key = shortpath; // d.file.id ||

        if (!this.whiteList[key]) {
          stats.allDiagnosticsFileMap[key] = d;
          errDiagnostics.push(d);
        } else {
          whiteListDiagnostics[key] = d;
        }

        if (config.toWhiteList) {
          // Error 级别最高
          if (this.whiteList[key] !== 'Error') this.whiteList[key] = ts.DiagnosticCategory[d.category] as never;
        }

        if (tsCheckFilesPassed[key]) {
          // 移除缓存
          if (tsCheckFilesPassed[key].updateTime === stats.startTime) stats.tsCheckFilesPassedChanged = true;
          delete tsCheckFilesPassed[key];
        }
      });

      if (errDiagnostics.length) {
        const fileList = errDiagnostics.filter(d => d.file).map(d => d.file.fileName);

        this.printLog(
          chalk.bold.redBright(`Diagnostics of need repair(not in whitelist)[${chalk.redBright(errDiagnostics.length)} files]:\n`),
          config.printDetail ? ts.formatDiagnosticsWithColorAndContext(errDiagnostics, host) : `\n - ` + fileList.join('\n - ') + '\n'
        );
      } else if (whiteListDiagnostics.length) {
        const fileList = tmpDiagnostics.filter(d => d.file).map(d => d.file.fileName);

        this.printLog(
          chalk.bold.yellowBright(`Diagnostics in whitelist[${chalk.redBright(errDiagnostics.length)} files]:\n`),
          config.printDetail ? ts.formatDiagnosticsWithColorAndContext(tmpDiagnostics, host) : `\n - ` + fileList.join('\n - ') + '\n'
        );
      }
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
  /** 执行 ts check */
  public check(tsFiles = this.config.tsFiles) {
    this.printLog('start');
    this.init();

    const { config, stats } = this;
    const { rootDir, debug } = config;
    const { tsCache } = stats;

    if (debug) this.printLog('config：', config);

    const dirMap = {
      // 没有 tsconfig.json 独立配置文件的子目录文件，也将全部放到这里一起编译
      [rootDir]: tsFiles || [],
    };

    // 没有指定 tsFiles 文件列表，才按 src 指定规则匹配
    if (!dirMap[rootDir].length) {
      const dirs = this.getCheckProjectDirs(config.src);
      if (!dirs) {
        this.printLog('No files or directories to process\n');
        return false;
      }

      if (debug) this.printLog('本次检测的子目录包括：', dirs);
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
        const item = tsCache.tsCheckFilesPassed[shortpath];
        if (!item.md5) {
          item.md5 = md5(path.resolve(config.rootDir, shortpath), true);
          stats.tsCheckFilesPassedChanged = true;
        }
        // if (item.updateTime === stats.startTime) stats.tsCheckFilesPassedChanged = true;
      });

      if (stats.tsCheckFilesPassedChanged) {
        if (!fs.existsSync(path.dirname(config.cacheFilePath))) fs.mkdirSync(path.dirname(config.cacheFilePath), { recursive: true });
        fs.writeFileSync(config.cacheFilePath, JSON.stringify(tsCache, null, 2));
        this.printLog('Write to cache:', chalk.cyanBright(fixToshortPath(config.cacheFilePath, config.rootDir)));
      }
    }

    if (config.toWhiteList) {
      if (!fs.existsSync(path.dirname(config.whiteListFilePath))) fs.mkdirSync(path.dirname(config.whiteListFilePath), { recursive: true });
      fs.writeFileSync(config.whiteListFilePath, JSON.stringify(this.whiteList, null, 2));
      this.printLog('Write to whitelist:', chalk.cyanBright(fixToshortPath(config.whiteListFilePath, config.rootDir)));
    }

    const errFileList = Object.keys(stats.allDiagnosticsFileMap);
    const result = {
      /** 匹配到的文件总数 */
      total: stats.totalFiles,
      /** 检测通过的文件数 */
      passed: stats.totalFiles - errFileList.length,
      /** 失败的文件数 */
      failed: errFileList.length,
      diagnosticCategory: stats.allDiagnosticsCategory,
    };

    this.stats.success = result.failed !== 0;

    if (result.failed && config.printDetail) {
      this.printLog('Failed Files:', '\n - ' + errFileList.join('\n - '), '\n');
    }

    this.printLog('Total Files:\t', result.total);
    this.printLog('Passed:\t', chalk.bold.greenBright(result.passed));
    this.printLog('Failed:\t', chalk.bold.red(result.failed));

    Object.keys(stats.allDiagnosticsCategory).forEach(keyStr => {
      this.printLog(chalk.bold.cyan(` -- ${keyStr} Count：`), chalk.bold.yellowBright(result.diagnosticCategory[keyStr]));
    });

    if (!result.failed) {
      this.printLog(chalk.bold.greenBright('Verification passed!'));
    } else {
      if (config.exitOnError) exit(result.failed, stats.startTime, '[TsCheck]');
      this.printLog(chalk.bold.redBright('Verification failed!'));
    }

    this.printLog(`TimeCost: ${chalk.bold.greenBright(Date.now() - stats.startTime)}ms`);

    return result;
  }
  /**
   * 在 fork 子进程中执行
   */
  private checkInChildProc() {
    this.printLog('start fork child progress');

    return createForkThread<TsCheckResult>({
      type: 'tscheck',
      debug: this.config.debug,
      tsCheckConfig: this.config,
    }).catch(code => {
      if (this.config.exitOnError) process.exit(code);
    });
  }
  /**
   * 在 work_threads 子线程中执行
   */
  private checkInWorkThreads() {
    this.printLog('start create work threads');

    return createWorkerThreads<TsCheckResult>({
      type: 'tscheck',
      debug: this.config.debug,
      tsCheckConfig: this.config,
    }).catch(code => {
      if (this.config.exitOnError) process.exit(code);
    });
  }
  /** 执行 check */
  public async start(tsFiles = this.config.tsFiles) {
    if (tsFiles !== this.config.tsFiles) this.config.tsFiles = tsFiles;
    this.init();

    if (!tsFiles.length && !this.config.src?.length) {
      this.printLog('No files to process\n');
      return false;
    }

    if (this.config.mode === 'current') return this.check(tsFiles);
    if (this.config.mode === 'thread') return this.checkInWorkThreads();
    return this.checkInChildProc();
  }
}
