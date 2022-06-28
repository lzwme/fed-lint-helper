/*
 * @Author: lzw
 * @Date: 2021-08-15 22:39:01
 * @LastEditors: lzw
 * @LastEditTime: 2022-06-28 22:49:30
 * @Description:  jest check
 */

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { color } from 'console-log-colors';
import glob from 'fast-glob';
import { runCLI } from '@jest/core';
import type { Config } from '@jest/types';
import { fixToshortPath, md5, assign, getLogger, getTimeCost } from './utils';
import { createForkThread } from './utils/fork';
import { JestCheckConfig, getConfig } from './config';
import { exit } from './exit';

const { bold, redBright, greenBright } = color;
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
  /** 检测缓存文件的路径。不应提交至 git 仓库:
   * 默认为 `<config.rootDir>/node_modules/.cache/flh/jestcache.json`
   */
  private cacheFilePath = '';
  private logger: ReturnType<typeof getLogger>;

  constructor(private config: JestCheckConfig = {}) {
    config = this.parseConfig(config);
    this.logger.debug('config', this.config);
    if (this.config.checkOnInit) this.start();
  }
  /** 获取初始化的统计信息 */
  private getInitStats() {
    const stats = {
      /** 最近一次处理是否成功 */
      isPassed: false,
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
    this.cacheFilePath = path.resolve(this.config.rootDir, baseConfig.cacheLocation, 'jestcache.json');

    const level = this.config.silent ? 'silent' : this.config.debug ? 'debug' : 'log';
    this.logger = getLogger(`[Jest]`, level);
    return this.config;
  }
  private init() {
    const config = this.config;

    if (fs.existsSync(this.cacheFilePath) && config.removeCache) fs.unlinkSync(this.cacheFilePath);

    // 文件列表过滤
    // 必须以 spec|test.ts|js 结尾
    config.fileList = config.fileList.filter(filepath => /\.(spec|test)\.(ts|js)x?$/i.test(filepath));
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
  private async getSpecFileList(specFileList = this.config.fileList) {
    const config = this.config;
    const jestPassedFiles = this.stats.cacheInfo.passed;

    if (!specFileList || specFileList.length === 0) {
      specFileList = [];

      for (const d of this.config.src) {
        const p = path.resolve(config.rootDir, d);
        if (!fs.existsSync(p) && fs.statSync(p).isDirectory()) continue;

        const files = await glob('**/*.{spec,test}.{ts,js,tsx,jsx}', { cwd: p, absolute: true });
        specFileList.push(...files);
      }
    } else {
      specFileList = specFileList.filter(filepath => /\.(spec|test)\./.test(filepath));
    }

    const totalFiles = specFileList.length;
    let cacheHits = 0;

    this.logger.debug('total test files:', color.magentaBright(specFileList.length));

    if (specFileList.length > 0 && config.cache && fs.existsSync(this.cacheFilePath)) {
      Object.assign(jestPassedFiles, JSON.parse(fs.readFileSync(this.cacheFilePath, 'utf8')));

      specFileList = specFileList.filter(filepath => {
        filepath = fixToshortPath(filepath, config.rootDir);

        const item = jestPassedFiles[filepath];
        if (!item) return true;

        const tsFilePath = filepath.replace(/\.(spec|test)\./, '.');
        // 同名业务文件 md5 发生改变
        if (fs.existsSync(tsFilePath) && item.md5 && md5(tsFilePath, true) !== item.md5) {
          return true;
        }

        return md5(filepath, true) !== item.specMd5;
      });

      cacheHits = totalFiles - specFileList.length;

      if (cacheHits) this.logger.info(` - Cache hits:`, cacheHits);
    }

    this.stats.totalFiles = totalFiles;
    this.stats.cacheHits = cacheHits;

    return specFileList;
  }
  /**
   * 执行 jest 校验
   */
  private async check(specFileList = this.config.fileList): Promise<JestCheckResult> {
    this.logger.info('start checking');
    this.init();

    const { logger, stats, config, cacheFilePath } = this;
    const isCheckAll = config.fileList.length === 0;
    const info: JestCheckResult = {
      isPassed: true,
      /** 文件总数 */
      // total: results.length,
    };

    // 全量检测默认使用 jest-cli
    if (isCheckAll && config.useJestCli == null) this.config.useJestCli = true;

    stats.isPassed = true;
    logger.debug('[options]:', config, specFileList);
    specFileList = await this.getSpecFileList(specFileList);

    if (specFileList.length === 0) return info;

    logger.info(`Total Spec Files:`, specFileList.length);
    logger.debug(specFileList);

    if (config.silent || config.useJestCli) {
      const files = isCheckAll ? config.src : specFileList;

      stats.isPassed = await new Promise(resolve => {
        exec(
          `node --max_old_space_size=4096 ./node_modules/jest/bin/jest.js --unhandled-rejections=strict --forceExit ${files
            .map(f => f.replace(/\\/g, '\\\\'))
            .join(' ')}`,
          (error, _stdout, _stderr) => {
            if (error) {
              this.logger.error(error);
              return resolve(false);
            }
            resolve(true);
          }
        );
      });
    } else {
      const options = this.getJestOptions(specFileList);
      const data = await runCLI(options, ['.']);
      const jestPassedFiles = stats.cacheInfo.passed;

      for (const d of data.results.testResults) {
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
      }

      fs.writeFileSync(cacheFilePath, JSON.stringify(stats.cacheInfo, undefined, 2));

      stats.isPassed = data.results.success && !data.results.numFailedTestSuites;
      logger.debug(data);
    }

    logger.info(bold(stats.isPassed ? greenBright('Verification passed!') : redBright('Verification failed!')));
    this.logger.info(getTimeCost(stats.startTime));

    if (!info.isPassed && config.exitOnError) exit(-1, 0, 'JestCheck');

    return info;
  }
  /**
   * 在 fork 子进程中执行
   */
  private checkInChildProc() {
    this.logger.info('start fork child progress');

    return createForkThread<JestCheckResult>({
      type: 'jest',
      debug: this.config.debug,
      jestConfig: this.config,
    }).catch(error => {
      this.logger.error('checkInChildProc error, code:', error);
      return { isPassed: false } as JestCheckResult;
    });
  }
  /**
   * 在 work_threads 子线程中执行
   */
  private checkInWorkThreads() {
    this.logger.info('start create work threads');

    return import('./utils/worker-threads').then(({ createWorkerThreads }) => {
      return createWorkerThreads<JestCheckResult>({
        type: 'jest',
        debug: this.config.debug,
        jestConfig: this.config,
      }).catch(error => {
        this.logger.error('checkInWorkThreads error, code:', error);
        return { isPassed: false } as JestCheckResult;
      });
    });
  }
  /** 执行 jest 校验 */
  async start(fileList?: string[]) {
    const { config, logger, stats } = this;
    if (fileList && fileList !== config.fileList) config.fileList = fileList;
    this.init();

    let result: JestCheckResult = { isPassed: true };

    if (config.fileList.length === 0 && (fileList || config.src.length === 0)) {
      logger.info('No files to process\n');
      return result;
    }

    if (config.mode === 'proc') result = await this.checkInChildProc();
    else if (config.mode === 'thread') result = await this.checkInWorkThreads();
    else result = await this.check();

    stats.isPassed = !!result.isPassed;
    logger.debug('result', result);
    if (!result.isPassed && config.exitOnError) exit(-1, 0, 'JestCheck');

    return result;
  }
}
