/*
 * @Author: lzw
 * @Date: 2021-08-15 22:39:01
 * @LastEditors: lzw
 * @LastEditTime: 2021-09-01 16:14:39
 * @Description:  jest check
 */

import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import * as utils from './utils';
import { createForkThread } from './utils/fork';
import { createWorkerThreads } from './utils/worker-threads';
import glob from 'glob';
import { exec } from 'child_process';
import { runCLI } from '@jest/core';
import type { Config } from '@jest/types';
import { exit } from './utils/common';

export interface JestCheckConfig {
  /** 要检测的源码目录，默认为 ['src'] */
  src?: string[];
  /** spec 测试文件列表 */
  fileList?: string[];
  /** 项目根目录，默认为当前工作目录 */
  rootDir?: string;
  /** 本次 check 是否使用缓存。默认为 true。当 jest 升级、规则变更、CI 执行 MR 时建议设置为 false */
  cache?: boolean;
  /** 是否移除缓存文件。设置为 true 将移除缓存并生成新的。默认 false */
  removeCache?: boolean;
  /** jest 缓存文件路径（jestOptions.cacheLocation）。不应提交至 git 仓库。默认为 `<config.rootDir>/node_modules/.cache/flh/jestcache.json` */
  cacheFilePath?: string;
  /** 初始化即执行check。默认为 false。设置为 true 则初始化后即调用 start 方法 */
  checkOnInit?: boolean;
  /** 是否开启调试模式(打印更多的细节) */
  debug?: boolean;
  /** 静默模式。不打印任何信息，一般用于接口调用 */
  silent?: boolean;
  /** 执行完成时存在 lint 异常，是否退出程序。默认为 true */
  exitOnError?: boolean;
  /** Jest Options。部分配置项会被内置修正 */
  jestOptions?: Config.Argv & Record<string, unknown>;
  /** 严格模式 */
  strict?: boolean;
  /**
   * 执行检测的方式。默认为 proc
   * @var proc fork 子进程执行
   * @var thread 创建 work_threads 子线程执行。jest 不推荐使用此种方式，打印进度有所缺失
   * @var current 在当前进程中执行
   */
  mode?: 'proc' | 'thread' | 'current';
}

export interface JestCheckResult {
  /** 是否检测通过 */
  isPassed: boolean;
  // total: number;
  // errorCount: number;
  // warningCount: number;
  // fixableErrorCount: number;
  // fixableWarningCount: number;
  // fixedCount: number;
  // fileList: string[];
  // errorFiles: string[];
  // warningFiles: string[];
}

export class JestCheck {
  /** 统计信息 */
  private stats = this.getInitStats();

  constructor(private config: JestCheckConfig = {}) {
    this.parseConfig(config);
    if (this.config.checkOnInit) this.start();
  }
  /** 打印日志 */
  private printLog(...args) {
    if (this.config.silent) return;
    if (!args.length) console.log();
    else console.log(chalk.cyan('[Jest]'), ...args);
  }
  /** 获取初始化的统计信息 */
  private getInitStats() {
    const stats = {
      /** 最近一次处理是否成功 */
      success: false,
      /** 最近一次处理的开始时间 */
      startTime: Date.now(),
      /** 匹配到的 spec 单元测试文件总数 */
      totalFiles: 0,
      /** 缓存命中的数量 */
      cacheHits: 0,
      /** 要缓存到 cacheFilePath 的信息 */
      cacheInfo: {
        /** 已经检测且无异常的文件列表 */
        passed: {} as { [filepath: string]: { md5: string; specMd5: string; updateTime: number } },
      },
    };
    this.stats = stats;
    return stats;
  }
  /** 返回执行结果统计信息 */
  public get statsInfo() {
    return this.stats;
  }
  /** 配置参数格式化 */
  public parseConfig(config: JestCheckConfig) {
    if (config !== this.config) config = Object.assign({}, this.config, config);
    this.config = Object.assign(
      {
        rootDir: process.cwd(),
        src: ['src'],
        cache: true,
        removeCache: false,
        cacheFilePath: 'node_modules/.cache/flh/jestcache.json',
        whiteListFilePath: 'jestWhitelist.json',
        debug: !!process.env.DEBUG,
        exitOnError: true,
        checkOnInit: false,
      } as JestCheckConfig,
      config
    );

    if (this.config.debug) this.config.silent = false;

    this.config.jestOptions = Object.assign(
      {
        config: 'jest.config.js',
        coverageReporters: ['text-summary', 'html'],
        onlyChanged: config.cache,
        forceExit: true,
        detectOpenHandles: true,
        verbose: config.debug,
      } as Partial<Config.Argv>,
      config.jestOptions
    );

    this.config.cacheFilePath = path.resolve(this.config.rootDir, this.config.cacheFilePath);
  }
  private init() {
    const config = this.config;

    if (fs.existsSync(config.cacheFilePath) && config.removeCache) fs.unlinkSync(config.cacheFilePath);
  }
  /**
   * 获取 Jest Options
   */
  private getJestOptions(specFileList: string[]) {
    const config = this.config;
    const runTestsByPath = config.cache;
    const option: Config.Argv = {
      ...config.jestOptions,
      $0: '',
      _: runTestsByPath ? specFileList : [],
      nonFlagArgs: specFileList,
      runTestsByPath,
      // coverage: !!config.jestOptions.coverage,
      // collectCoverage: !!config.jestOptions.coverage,
      // changedFilesWithAncestor: true,
      // lastCommit: !!config.jestOptions.lastCommit,
      // ci: config.jestOptions.ci,
      cache: config.cache,
      silent: config.silent,
      debug: config.debug,
    };

    if (config.debug) this.printLog('jestOption:', option);

    return option;
  }
  private getSpecFileList(specFileList = this.config.fileList) {
    const config = this.config;
    const { rootDir } = this.config;
    const jestPassedFiles = this.stats.cacheInfo.passed;

    if (!specFileList || !specFileList.length) {
      specFileList = [];

      this.config.src.forEach(d => {
        const p = path.resolve(rootDir, d);

        if (!fs.existsSync(p) && fs.statSync(p).isDirectory()) return;

        const files = glob.sync('**/*.spec.{ts,js,tsx,jsx}', {
          cwd: p,
          realpath: true,
        });

        specFileList.push(...files);
      });
    }

    const totalFiles = specFileList.length;
    let cacheHits = 0;

    this.printLog('total test files:', specFileList.length);

    if (config.cache && fs.existsSync(config.cacheFilePath)) {
      Object.assign(jestPassedFiles, JSON.parse(fs.readFileSync(config.cacheFilePath, 'utf8')));

      specFileList = specFileList.filter(filepath => {
        filepath = utils.fixToshortPath(filepath, config.rootDir);

        const item = jestPassedFiles[filepath];
        if (!item) return true;

        const tsFilePath = filepath.replace('.spec.', '.');
        // 同名业务文件 md5 发生改变
        if (fs.existsSync(tsFilePath) && item.md5 && utils.md5(tsFilePath, true) !== item.md5) {
          return true;
        }

        return utils.md5(filepath, true) !== item.specMd5;
      });

      cacheHits = totalFiles - specFileList.length;

      if (cacheHits) this.printLog(` - Cache hits:`, cacheHits);
    }

    this.stats.totalFiles = totalFiles;
    this.stats.cacheHits = cacheHits;

    return specFileList;
  }

  /**
   * 执行 jest 校验
   */
  private async check(specFileList = this.config.fileList) {
    this.printLog('start checking');
    this.init();

    const { config, stats } = this;
    let isPassed = true;

    if (config.debug) this.printLog('[options]:', config, specFileList);
    // if (config.debug) this.printLog('[debug]', `TOTAL:`, fileList.length, `, Files:\n`, fileList);

    specFileList = this.getSpecFileList(specFileList);

    if (!specFileList.length) return isPassed;

    console.log('[JEST TEST]', `Total Spec Files:`, specFileList.length);
    if (config.debug) console.log(specFileList);

    if (config.silent) {
      isPassed = await new Promise(resolve => {
        exec(
          `node --max_old_space_size=4096 "%~dp0/../node_modules/jest/bin/jest.js --unhandled-rejections=strict --forceExit" ${specFileList
            .map(f => f.replace(/[\\]/g, '\\\\'))
            .join(' ')}`,
          (err, _stdout, _stderr) => {
            if (err) {
              console.error(err);
              return resolve(false);
            }

            resolve(true);
          }
        );
      });
    } else {
      const options = this.getJestOptions(specFileList);
      const data = await runCLI(options, ['.']);
      const jestPassedFiles = this.stats.cacheInfo.passed;

      data.results.testResults.forEach(d => {
        const testFilePath = utils.fixToshortPath(d.testFilePath, config.rootDir);
        // console.log(testFilePath, d.testFilePath);
        if (d.numFailingTests) {
          if (jestPassedFiles[testFilePath]) delete jestPassedFiles[testFilePath];
        } else {
          const tsFilePath = d.testFilePath.replace('.spec.', '.');
          jestPassedFiles[testFilePath] = {
            md5: fs.existsSync(tsFilePath) ? utils.md5(tsFilePath, true) : '',
            specMd5: utils.md5(d.testFilePath, true),
            updateTime: data.results.startTime,
          };
        }
      });

      const cacheDir = path.dirname(config.cacheFilePath);
      if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
      fs.writeFileSync(config.cacheFilePath, JSON.stringify(this.stats.cacheInfo, null, 2));

      isPassed = !data.results.success || data.results.numFailedTestSuites > 0;
    }

    // console.log(data);

    // if (data.results.numFailedTestSuites || !data.results.success) {
    //   // console.log('[Jest] : 单元测试不通过 \n');
    // }
    // console.log('[Jest] : 单元测试通过 \n');

    stats.success = isPassed;

    const info: JestCheckResult = {
      isPassed,
      /** 文件总数 */
      // total: results.length,
    };

    if (info.isPassed) {
      this.printLog(chalk.bold.greenBright('Verification passed!'));
    } else {
      if (config.exitOnError) exit(1, stats.startTime, '[JestCheck]');
      this.printLog(chalk.bold.redBright('Verification failed!'));
    }

    this.printLog(`TimeCost: ${chalk.bold.greenBright(Date.now() - stats.startTime)}ms`);

    return info;
  }
  /**
   * 在 fork 子进程中执行
   */
  private checkInChildProc() {
    this.printLog('start fork child progress');

    return createForkThread<JestCheckResult>({
      type: 'jest',
      debug: this.config.debug,
      jestConfig: this.config,
    }).catch(code => {
      if (this.config.exitOnError) process.exit(code);
    });
  }
  /**
   * 在 work_threads 子线程中执行
   */
  private checkInWorkThreads() {
    this.printLog('start create work threads');

    return createWorkerThreads<JestCheckResult>({
      type: 'jest',
      debug: this.config.debug,
      jestConfig: this.config,
    }).catch(code => {
      if (this.config.exitOnError) process.exit(code);
    });
  }
  /**
   * 启动 jest 校验
   */
  async start(fileList = this.config.fileList) {
    // this.printLog('start');
    if (fileList !== this.config.fileList) this.config.fileList = fileList;
    this.init();

    if (!fileList.length && !this.config.src?.length) {
      this.printLog('No files to process\n');
      return false;
    }

    if (this.config.mode === 'current') return this.check();
    if (this.config.mode === 'thread') return this.checkInWorkThreads();
    return this.checkInChildProc();
  }
}
