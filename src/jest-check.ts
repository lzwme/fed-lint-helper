/*
 * @Author: lzw
 * @Date: 2021-08-15 22:39:01
 * @LastEditors: lzw
 * @LastEditTime: 2022-07-07 13:15:05
 * @Description:  jest check
 */

import { resolve } from 'path';
import { cpus } from 'os';
import { existsSync, statSync, readFileSync, writeFileSync } from 'fs';
import { color } from 'console-log-colors';
import glob from 'fast-glob';
import type { Config } from '@jest/types';
import { fixToshortPath, md5, assign, execSync } from './utils';
import { getConfig } from './config';
import type { JestCheckConfig } from './types';
import { LintBase, LintResult } from './LintBase';

export interface JestCheckResult extends LintResult {
  /** 是否检测通过 */
  isPassed: boolean;
  // fileList: string[];
  // errorFiles: string[];
}

export class JestCheck extends LintBase<JestCheckConfig, JestCheckResult> {
  /** 统计信息 */
  protected override stats = this.getInitStats();
  /** 要缓存到 cacheFilePath 的信息 */
  private cacheInfo = {
    /** 已经检测且无异常的文件列表 */
    passed: {} as { [filepath: string]: { md5: string; specMd5: string; updateTime: number } },
  };

  constructor(protected override config: JestCheckConfig = {}) {
    super('jest', config);
  }
  /** 获取初始化的统计信息 */
  protected override getInitStats() {
    const stats: JestCheckResult = {
      ...super.getInitStats(),
    };
    this.stats = stats;
    return stats;
  }
  /** 配置参数格式化 */
  public parseConfig(config: JestCheckConfig) {
    const baseConfig = getConfig();

    if (config !== this.config) config = assign<JestCheckConfig>({}, this.config, config);
    this.config = assign<JestCheckConfig>(baseConfig.jest, config);

    return this.config;
  }
  /**
   * 获取 Jest Options
   */
  protected getJestOptions(specFileList: string[]) {
    const baseConfig = getConfig();
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
      maxWorkers: cpus.length * 2,
      ci: baseConfig.ci,
    };

    return option;
  }
  protected async getSpecFileList(specFileList = this.config.fileList) {
    const config = this.config;
    const jestPassedFiles = this.cacheInfo.passed;

    if (!specFileList || specFileList.length === 0) {
      specFileList = [];

      for (const d of this.config.src) {
        const p = resolve(config.rootDir, d);
        if (!existsSync(p) || !statSync(p).isDirectory()) continue;

        const files = await glob('**/*.{spec,test}.{ts,js,tsx,jsx}', { cwd: p, absolute: true });
        specFileList.push(...files);
      }
    } else {
      specFileList = specFileList.filter(filepath => /\.(spec|test)\./.test(filepath));
    }

    const totalFiles = specFileList.length;
    let cacheHits = 0;

    this.logger.debug('total test files:', color.magentaBright(specFileList.length));

    if (specFileList.length > 0 && config.cache && existsSync(this.cacheFilePath)) {
      Object.assign(jestPassedFiles, JSON.parse(readFileSync(this.cacheFilePath, 'utf8')));

      specFileList = specFileList.filter(filepath => {
        filepath = fixToshortPath(filepath, config.rootDir);

        const item = jestPassedFiles[filepath];
        if (!item) return true;

        const tsFilePath = filepath.replace(/\.(spec|test)\./, '.');
        // 同名业务文件 md5 发生改变
        if (existsSync(tsFilePath) && item.md5 && md5(tsFilePath, true) !== item.md5) {
          return true;
        }

        return md5(filepath, true) !== item.specMd5;
      });

      cacheHits = totalFiles - specFileList.length;

      if (cacheHits) this.logger.info(` - Cache hits:`, cacheHits);
    }

    this.stats.totalFilesNum = totalFiles;
    this.stats.cacheHits = cacheHits;

    return specFileList;
  }
  protected init(): void {
    this.cacheInfo = { passed: {} };
  }
  /**
   * 执行 jest 校验
   */
  protected async check(specFileList = this.config.fileList): Promise<JestCheckResult> {
    const { logger, stats, config } = this;
    const isCheckAll = config.fileList.length === 0;

    // 全量检测默认使用 jest-cli
    if (isCheckAll && config.useJestCli == null) this.config.useJestCli = true;

    logger.debug('[options]:', config, specFileList);
    specFileList = await this.getSpecFileList(specFileList);

    if (specFileList.length === 0) return stats;

    logger.info(`Total Spec Files:`, specFileList.length);
    logger.debug(specFileList);

    if (config.silent || config.useJestCli) {
      const baseConfig = getConfig();
      const files = isCheckAll ? config.src : specFileList;
      const cmd = [
        `node --max_old_space_size=4096 ./node_modules/jest/bin/jest.js`,
        `--unhandled-rejections=strict`,
        `--forceExit`,
        // isCheckAll ? null : `--onlyChanged`,
        config.removeCache ? `--clearCache` : null,
        config.cache ? `--cache` : null,
        config.cache && config.cacheLocation ? `--cacheDirectory="${config.cacheLocation}"` : null,
        config.silent ? ` --silent` : null,
        baseConfig.ci ? `--ci` : null,
        files.map(f => fixToshortPath(f, config.rootDir)).join(' '),
      ]
        .filter(Boolean)
        .join(' ');

      const res = execSync(cmd, config.silent ? 'pipe' : 'inherit', config.rootDir, config.debug);
      this.logger.debug(cmd, res);
      stats.isPassed = !res.stderr;

      // stats.isPassed = await new Promise(resolve => {
      //   exec(cmd, { maxBuffer: 100 * 1024 * 1024 }, (error, _stdout, _stderr) => {
      //     if (error) {
      //       this.logger.error(error);
      //       return resolve(false);
      //     }
      //     resolve(true);
      //   });
      //   // if (!config.silent) {
      //   //   child.stdout.pipe(process.stdin);
      //   //   child.stderr.pipe(process.stderr);
      //   // }
      // });
    } else {
      const options = this.getJestOptions(specFileList);
      const { runCLI } = await import('@jest/core');
      const data = await runCLI(options, ['.']);
      const jestPassedFiles = this.cacheInfo.passed;

      for (const d of data.results.testResults) {
        const testFilePath = fixToshortPath(d.testFilePath, config.rootDir);
        // console.log(testFilePath, d.testFilePath);
        if (d.numFailingTests) {
          if (jestPassedFiles[testFilePath]) delete jestPassedFiles[testFilePath];
          stats.failedFilesNum++;
        } else {
          stats.passedFilesNum++;
          const tsFilePath = d.testFilePath.replace('.spec.', '.');
          jestPassedFiles[testFilePath] = {
            md5: existsSync(tsFilePath) ? md5(tsFilePath, true) : '',
            specMd5: md5(d.testFilePath, true),
            updateTime: data.results.startTime,
          };
        }
      }

      writeFileSync(this.cacheFilePath, JSON.stringify(this.cacheInfo, undefined, 2));
      stats.errorCount = data.results.numFailedTestSuites;
      stats.isPassed = stats.failedFilesNum === 0; // data.results.success && !data.results.numFailedTestSuites;
      logger.debug('result use runCLI:\n', data);
    }

    return stats;
  }
  protected beforeStart(fileList?: string[]): boolean {
    // 文件列表过滤: 必须以 spec|test.ts|js 结尾
    this.config.fileList = this.config.fileList.filter(filepath => /\.(spec|test)\.(ts|js)x?$/i.test(filepath));

    if (this.config.fileList.length === 0 && (fileList || this.config.src.length === 0)) {
      return false;
    }
    return true;
  }
}
