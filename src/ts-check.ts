/*
 * @Author: lzw
 * @Date: 2021-08-15 22:39:01
 * @LastEditors: lzw
 * @LastEditTime: 2021-12-02 21:27:14
 * @Description: typescript Diagnostics report
 */

import { color } from 'console-log-colors';
import fs from 'fs';
import path from 'path';
import * as ts from 'typescript';
import glob from 'glob';
import { fixToshortPath, md5, exit, createForkThread, assign, Logger, execSync } from './utils';
import { TsCheckConfig, getConfig } from './config';

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
  private logger: Logger;

  constructor(private config: TsCheckConfig = {}) {
    config = this.parseConfig(config);
    const level = config.silent ? 'silent' : config.debug ? 'debug' : 'log';
    this.logger = Logger.getLogger(`[TSCheck]`, level);
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
    const baseConfig = getConfig({ tscheck: config });

    this.config = assign<TsCheckConfig>({}, baseConfig.tscheck);
    this.cacheFilePath = path.resolve(this.config.rootDir, baseConfig.cacheLocation, 'tsCheckCache.json');
    this.config.whiteListFilePath = path.resolve(this.config.rootDir, this.config.whiteListFilePath);
    return this.config;
  }
  private init() {
    const { whiteListFilePath, removeCache, cache } = this.config;

    if (fs.existsSync(this.cacheFilePath)) {
      try {
        if (removeCache) {
          fs.unlinkSync(this.cacheFilePath);
        } else if (cache) {
          const cacheInfo = JSON.parse(fs.readFileSync(this.cacheFilePath, { encoding: 'utf-8' }));
          if (cacheInfo.tsCheckFilesPassed) this.stats.tsCache = cacheInfo;
        }
      } catch (e) {
        console.log(e.message || e.stack || e);
      }
    }

    // 读取白名单列表
    if (!this.config.toWhiteList && fs.existsSync(whiteListFilePath)) {
      try {
        this.whiteList = JSON.parse(fs.readFileSync(whiteListFilePath, { encoding: 'utf-8' }));
      } catch (e) {
        console.log(e.message || e.stack || e);
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

    console.log();
    this.logger.info(bold(cyanBright('Checking')), subDir);
    this.logger.info(' - Total Number Of Files:', total);

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

    if (cacheHits) this.logger.info(` - Cache hits:`, cacheHits);
    if (whiteListHits) this.logger.info(` - WhiteList hits:`, whiteListHits);

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

      tmpDiagnostics.forEach(d => {
        if (!d.file) {
          errDiagnostics.push(d);
          return;
        }

        const shortpath = fixToshortPath(path.normalize(d.file.fileName));
        const key = shortpath; // d.file.id ||

        if (!this.whiteList[key]) {
          stats.allDiagnosticsFileMap[key] = d;
          errDiagnostics.push(d);
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
        let fileList = errDiagnostics.filter(d => d.file).map(d => d.file.fileName);
        // 去重
        fileList = Array.from(new Set(fileList));

        this.logger.info(
          bold(redBright(`Diagnostics of need repair(not in whitelist)[${fileList.length} files]:\n`)),
          config.printDetail ? ts.formatDiagnosticsWithColorAndContext(errDiagnostics, host) : `\n - ` + fileList.join('\n - ') + '\n'
        );
      } else {
        const fileList = tmpDiagnostics.filter(d => d.file).map(d => d.file.fileName);

        if (fileList.length) {
          this.logger.info(
            bold(yellowBright(`Diagnostics in whitelist[${redBright(fileList.length)}`)),
            bold(yellowBright(`files]:\n`)),
            config.printDetail ? ts.formatDiagnosticsWithColorAndContext(tmpDiagnostics, host) : `\n - ` + fileList.join('\n - ') + '\n'
          );
        }
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
    this.logger.info('start checking');
    this.init();

    const { config, stats } = this;
    const { tsCache } = stats;
    /** 在白名单列表中但本次检测无异常的文件列表（将从白名单列表中移除） */
    const removeFromWhiteList = [];
    const dirMap = {
      // 没有 tsconfig.json 独立配置文件的子目录文件，也将全部放到这里一起编译
      [config.rootDir]: tsFiles || [],
    };

    this.logger.debug('config：', config);

    // 没有指定 tsFiles 文件列表，才按 src 指定规则匹配
    if (!dirMap[config.rootDir].length) {
      const dirs = this.getCheckProjectDirs(config.src);
      if (!dirs) {
        this.logger.info('No files or directories to process\n');
        return false;
      }

      this.logger.debug('本次检测的子目录包括：', dirs);
      dirs
        .map(d => this.getTsFiles(d))
        .forEach(info => {
          if (!info || !info.tsFiles.length) return;

          if (fs.existsSync(path.resolve(info.subDir, config.tsConfigFileName))) {
            dirMap[info.subDir] = info.tsFiles;
          } else {
            dirMap[config.rootDir].push(...info.tsFiles);
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

        if (this.whiteList[shortpath]) {
          delete this.whiteList[shortpath];
          removeFromWhiteList.push(shortpath);
        }
        // if (item.updateTime === stats.startTime) stats.tsCheckFilesPassedChanged = true;
      });

      if (stats.tsCheckFilesPassedChanged) {
        fs.writeFileSync(this.cacheFilePath, JSON.stringify(tsCache, null, 2));
        this.logger.info('Write to cache:', cyanBright(fixToshortPath(this.cacheFilePath, config.rootDir)));
      }
    }

    if (config.toWhiteList) {
      if (!fs.existsSync(path.dirname(config.whiteListFilePath))) fs.mkdirSync(path.dirname(config.whiteListFilePath), { recursive: true });
      fs.writeFileSync(config.whiteListFilePath, JSON.stringify(this.whiteList, null, 2));
      this.logger.info('[ADD]write to whitelist:', cyanBright(fixToshortPath(config.whiteListFilePath, config.rootDir)));
      execSync(`git add ${config.whiteListFilePath}`, null, config.rootDir, !config.silent);
    } else {
      if (removeFromWhiteList.length) {
        this.logger.info(' [REMOVE]write to whitelist:', cyanBright(fixToshortPath(config.whiteListFilePath, config.rootDir)));
        fs.writeFileSync(config.whiteListFilePath, JSON.stringify(this.whiteList, null, 2));
        this.logger.info(' remove from whilelist:\n' + removeFromWhiteList.join('\n'));
        execSync(`git add ${config.whiteListFilePath}`, null, config.rootDir, !config.silent);
      }
    }

    const errFileList = Object.keys(stats.allDiagnosticsFileMap);
    const result: TsCheckResult = {
      isPassed: !errFileList.length,
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
      this.logger.info('Failed Files:', '\n - ' + errFileList.join('\n - '), '\n');
    }

    this.logger.info('Total :\t', result.total);
    this.logger.info('Passed:\t', bold(greenBright(result.passed)));
    this.logger.info('Failed:\t', bold(red(result.failed)));

    // 异常类型统计
    if (result.failed) {
      errFileList.forEach(filepath => {
        const d = stats.allDiagnosticsFileMap[filepath];
        const cateStr = ts.DiagnosticCategory[d.category];
        stats.allDiagnosticsCategory[cateStr] = (stats.allDiagnosticsCategory[cateStr] || 0) + 1;
      });
      Object.keys(stats.allDiagnosticsCategory).forEach(keyStr => {
        this.logger.info(bold(cyan(` -- ${keyStr} Count：`)), bold(yellowBright(result.diagnosticCategory[keyStr])));
      });
    }

    if (!result.failed) {
      this.logger.info(bold(greenBright('Verification passed!')));
    } else {
      this.logger.info(bold(redBright('Verification failed!')));
      if (config.exitOnError) exit(result.failed, stats.startTime, '[TsCheck]');
    }

    this.logger.info(`TimeCost: ${bold(greenBright(Date.now() - stats.startTime))}ms`);

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
    })
      .then(d => {
        if (!d.isPassed && this.config.exitOnError) process.exit(d.failed || -1);
        return d;
      })
      .catch(code => this.config.exitOnError && process.exit(code));
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
      })
        .then(d => {
          if (!d.isPassed && this.config.exitOnError) process.exit(d.failed || -1);
          return d;
        })
        .catch(code => this.config.exitOnError && process.exit(code));
    });
  }
  /** 执行 check */
  public async start(tsFiles?: string[]) {
    if (tsFiles && tsFiles !== this.config.tsFiles) this.config.tsFiles = tsFiles;
    this.init();

    if (!this.config.tsFiles.length && (tsFiles || !this.config.src.length)) {
      this.logger.info('No files to process\n');
      return false;
    }

    if (this.config.mode === 'current') return this.check(tsFiles);
    if (this.config.mode === 'thread') return this.checkInWorkThreads();
    return this.checkInChildProc();
  }
}
