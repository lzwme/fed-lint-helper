/*
 * @Author: lzw
 * @Date: 2021-08-15 22:39:01
 * @LastEditors: lzw
 * @LastEditTime: 2021-09-25 18:03:48
 * @Description:  jest check
 */

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import chalk from 'chalk';
import glob from 'glob';
import { runCLI } from '@jest/core';
import type { Config } from '@jest/types';
import { fixToshortPath, md5, exit, createForkThread, assign } from './utils';
import { JestCheckConfig, getConfig } from './config';

export interface JestCheckResult {
  /** 是否检测通过 */
  isPassed: boolean;
  // total: number;
  // errorCount: number;
  // fileList: string[];
  // errorFiles: string[];
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
    const baseConfig = getConfig();

    if (config !== this.config) config = assign<JestCheckConfig>({}, this.config, config);
    this.config = assign<JestCheckConfig>({}, baseConfig.jest, config);
    this.config.cacheFilePath = path.resolve(this.config.rootDir, this.config.cacheFilePath);
    if (this.config.debug) this.config.silent = false;
    if (this.config.debug) this.printLog(this.config);
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
    const option: Config.Argv = {
      ...config.jestOptions,
      $0: '',
      _: config.cache ? specFileList : [],
      runTestsByPath: config.cache,
      nonFlagArgs: specFileList,
      cache: config.cache,
      clearCache: config.removeCache,
      silent: config.silent,
      debug: config.debug,
      onlyChanged: config.cache,
      forceExit: config.exitOnError,
      verbose: config.debug,
    };

    return option;
  }
  private getSpecFileList(specFileList = this.config.fileList) {
    const config = this.config;
    const jestPassedFiles = this.stats.cacheInfo.passed;

    if (!specFileList || !specFileList.length) {
      specFileList = [];

      this.config.src.forEach(d => {
        const p = path.resolve(config.rootDir, d);
        if (!fs.existsSync(p) && fs.statSync(p).isDirectory()) return;

        const files = glob.sync('**/*.spec.{ts,js,tsx,jsx}', { cwd: p, realpath: true });
        specFileList.push(...files);
      });
    }

    const totalFiles = specFileList.length;
    let cacheHits = 0;

    this.printLog('total test files:', specFileList.length);

    if (config.cache && fs.existsSync(config.cacheFilePath)) {
      Object.assign(jestPassedFiles, JSON.parse(fs.readFileSync(config.cacheFilePath, 'utf8')));

      specFileList = specFileList.filter(filepath => {
        filepath = fixToshortPath(filepath, config.rootDir);

        const item = jestPassedFiles[filepath];
        if (!item) return true;

        const tsFilePath = filepath.replace('.spec.', '.');
        // 同名业务文件 md5 发生改变
        if (fs.existsSync(tsFilePath) && item.md5 && md5(tsFilePath, true) !== item.md5) {
          return true;
        }

        return md5(filepath, true) !== item.specMd5;
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
    stats.success = true;

    if (config.debug) this.printLog('[options]:', config, specFileList);
    // if (config.debug) this.printLog('[debug]', `TOTAL:`, fileList.length, `, Files:\n`, fileList);

    specFileList = this.getSpecFileList(specFileList);

    if (!specFileList.length) return stats.success;

    this.printLog(`Total Spec Files:`, specFileList.length);
    if (config.debug) this.printLog(specFileList);

    if (config.silent) {
      stats.success = await new Promise(resolve => {
        exec(
          `node --max_old_space_size=4096 ./node_modules/jest/bin/jest.js --unhandled-rejections=strict --forceExit ${specFileList
            .map(f => f.replace(/[\\]/g, '\\\\'))
            .join(' ')}`,
          (err, _stdout, _stderr) => {
            if (err) {
              console.error(err);
              if (this.config.exitOnError) exit(-1, stats.startTime, '[JestCheck]');
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
        const testFilePath = fixToshortPath(d.testFilePath, config.rootDir);
        // console.log(testFilePath, d.testFilePath);
        if (d.numFailingTests) {
          if (jestPassedFiles[testFilePath]) delete jestPassedFiles[testFilePath];
        } else {
          const tsFilePath = d.testFilePath.replace('.spec.', '.');
          jestPassedFiles[testFilePath] = {
            md5: fs.existsSync(tsFilePath) ? md5(tsFilePath, true) : '',
            specMd5: md5(d.testFilePath, true),
            updateTime: data.results.startTime,
          };
        }
      });

      const cacheDir = path.dirname(config.cacheFilePath);
      if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
      fs.writeFileSync(config.cacheFilePath, JSON.stringify(this.stats.cacheInfo, null, 2));

      stats.success = data.results.success && !data.results.numFailedTestSuites;
      if (this.config.debug) this.printLog(data);
    }

    const info: JestCheckResult = {
      isPassed: stats.success,
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
      if (this.config.exitOnError) exit(code, this.stats.startTime, '[JestCheck]');
    });
  }
  /**
   * 在 work_threads 子线程中执行
   */
  private checkInWorkThreads() {
    this.printLog('start create work threads');

    return import('./utils/worker-threads').then(({ createWorkerThreads }) => {
      return createWorkerThreads<JestCheckResult>({
        type: 'jest',
        debug: this.config.debug,
        jestConfig: this.config,
      }).catch(code => {
        if (this.config.exitOnError) exit(code, this.stats.startTime, '[JestCheck]');
      });
    });
  }
  /**
   * 启动 jest 校验
   */
  async start(fileList = this.config.fileList) {
    if (fileList !== this.config.fileList) this.config.fileList = fileList;
    this.init();

    if (!fileList.length && !this.config.src.length) {
      this.printLog('No files to process\n');
      return false;
    }

    if (this.config.mode === 'current') return this.check();
    if (this.config.mode === 'thread') return this.checkInWorkThreads();
    return this.checkInChildProc();
  }
}
