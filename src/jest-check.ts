/*
 * @Author: lzw
 * @Date: 2021-08-15 22:39:01
 * @LastEditors: lzw
 * @LastEditTime: 2022-11-02 11:51:52
 * @Description:  jest check
 */

import { basename, dirname, extname, resolve } from 'node:path';
import { existsSync, statSync, readFileSync } from 'node:fs';
import { color } from 'console-log-colors';
import glob from 'fast-glob';
import type { Config } from '@jest/types';
import type { FormattedTestResults, formatTestResults } from '@jest/test-result';
import { fixToshortPath, md5, execSync, rmrf, isEmptyObject } from '@lzwme/fe-utils';
import { getConfig } from './config';
import type { JestCheckConfig, LintCacheInfo, LintResult, WhiteListInfo } from './types';
import { LintBase } from './LintBase';
import { fileListToString } from './utils';

export type JestCheckResult = LintResult;

export class JestCheck extends LintBase<JestCheckConfig, JestCheckResult> {
  protected override whiteList: WhiteListInfo<number> = { list: {} };
  protected override stats = this.getInitStats();
  protected override cacheInfo: LintCacheInfo<{ md5: string; specMd5: string; updateTime: number }> = { list: {} };
  /** 要缓存到 cacheFilePath 的信息 */
  private cache = {
    /** 缓存 getSpecFiles 返回的结果 */
    specFiles: null as string[],
  };

  constructor(config: JestCheckConfig = {}) {
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
  protected getJestOptions(specFileList: string[]) {
    const baseConfig = getConfig();
    const config = this.config;
    const outputJsonFile = resolve(config.rootDir, 'node_modules/.cache/flh/jest-result.json');
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
      ci: baseConfig.ci,
      outputFile: outputJsonFile,
      'unhandled-rejections': 'strict',
    };

    return option;
  }
  private jestOptionToArgv(options: Record<string, unknown>) {
    const ignoredKeys = new Set(['_', '$0', 'runTestsByPath', 'nonFlagArgs']);

    return Object.entries(options)
      .map(([key, val]) => {
        if (ignoredKeys.has(key) || !val || Array.isArray(val)) return '';
        if (typeof val === 'boolean') val = val ? '' : '0';
        return `--${key}` + (val ? `="${val}"` : '');
      })
      .filter(Boolean)
      .join(' ');
  }
  protected async getSpecFileList(specFileList: string[]) {
    const { config, cacheInfo } = this;
    const specGlob = '.{spec,test}.{ts,js,tsx,jsx,mjs}';

    if (this.isCheckAll) {
      specFileList = [];

      for (const d of this.config.src) {
        const p = resolve(config.rootDir, d);
        if (!existsSync(p) || !statSync(p).isDirectory()) continue;

        const files = await glob('**/*' + specGlob, { cwd: p, absolute: true });
        specFileList.push(...files);
      }
    } else {
      specFileList = specFileList
        .map(filepath => {
          if (/\.(spec|test)\./.test(filepath)) return filepath;

          const ext = extname(filepath);

          if (!['.js', '.jsx', '.ts', '.tsx', '.mjs', '.vue'].includes(ext)) return '';

          for (const testId of ['spec', 'test'] as const) {
            const specfile = filepath.replace(ext, `.${testId}${ext}`);
            if (existsSync(specfile)) return specfile;
          }

          const fileDir = dirname(filepath);
          // 同目录下存在单测文件
          let files = glob.sync('*' + specGlob, { cwd: fileDir, absolute: true });
          if (files.length > 0) return files[0];

          // 支持查找在父级目录中的同名单测文件
          let filename = basename(filepath).replace(ext, '');
          if (filename === 'index') filename = basename(fileDir);
          files = glob.sync(`**/*/${filename}${specGlob}`, { cwd: dirname(fileDir), absolute: true });
          if (files.length > 0) return files[0];

          return '';
        })
        .filter(Boolean);
    }

    const totalFiles = specFileList.length;
    let cacheHits = 0;

    if (totalFiles && config.cache && existsSync(this.cacheFilePath)) {
      specFileList = specFileList.filter(filepath => {
        filepath = fixToshortPath(filepath, config.rootDir);

        const item = cacheInfo.list[filepath];
        if (!item) return true;

        const tsFilePath = filepath.replace(/\.(spec|test)\./, '.');
        // 同名业务文件 md5 发生改变
        if (existsSync(tsFilePath) && item.md5 && md5(tsFilePath, true) !== item.md5) return true;

        return md5(filepath, true) !== item.specMd5;
      });

      cacheHits = totalFiles - specFileList.length;
    }

    this.stats.totalFilesNum = totalFiles;
    this.stats.cacheHits = cacheHits;

    return specFileList;
  }
  protected override init(): void {
    super.init();
    // todo: 逻辑待优化，暂仅使用 jest cache 全量执行，不读取 cache 文件
    // if (this.config.cache && existsSync(this.cacheFilePath)) {
    //   assign(this.cacheInfo, JSON.parse(readFileSync(this.cacheFilePath, 'utf8')));
    // }
  }
  protected async check(specFileList = this.config.fileList): Promise<JestCheckResult> {
    const { logger, stats, config, cacheInfo } = this;

    // 全量检测默认使用 jest-cli
    if (this.isCheckAll && config.useJestCli == null) this.config.useJestCli = true;

    logger.debug('[options]:', this.isCheckAll, config, specFileList);
    specFileList = await this.getSpecFileList(specFileList);

    if (specFileList.length === 0) return stats;
    logger.info('Total Test Files:', color.magentaBright(stats.totalFilesNum));
    if (stats.cacheHits) this.logger.info(` - Cache hits:`, stats.cacheHits);

    const options = this.getJestOptions(specFileList);
    const outputJsonFile = options.outputFile;
    let results: FormattedTestResults;

    if (existsSync(outputJsonFile)) rmrf(outputJsonFile);

    if (config.silent || config.useJestCli) {
      const files = (this.isCheckAll ? config.src : specFileList).map(f => fixToshortPath(f, config.rootDir));
      const argv = this.jestOptionToArgv({ ...options, json: true, 'unhandled-rejections': 'strict' });
      const cmd = [`node --max_old_space_size=8192 ./node_modules/jest/bin/jest.js`, argv, files.join(' ')].join(' ');

      this.logger.debug('[jest-cli][cmd]', color.cyanBright(cmd));
      const res = execSync(cmd, config.silent ? 'pipe' : 'inherit', config.rootDir, config.debug);
      this.logger.debug('result:\n', res);

      if (existsSync(outputJsonFile)) {
        results = JSON.parse(readFileSync(outputJsonFile, 'utf8')) as FormattedTestResults;
      } else {
        stats.isPassed = !res.stderr;
      }
    } else {
      const { runCLI } = await import('@jest/core');
      const getFTR: () => Promise<typeof formatTestResults> = async () => {
        try {
          const { formatTestResults } = await import('@jest/test-result');
          return formatTestResults;
        } catch {
          const entry = require.resolve('@jest/test-result', { paths: [require.resolve('jest')] });
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          return require(entry).formatTestResults;
        }
      };
      const ftr = await getFTR();
      const data = await runCLI(options, ['.']);
      results = ftr(data.results);
    }

    if (results) {
      const cacheDeleted = {} as typeof cacheInfo.list;
      const whilteListInfo = {
        deleted: {} as Record<string, number>,
        failed: [] as string[],
      };
      // 不在白名单中的失败文件列表
      const failedFiles: string[] = [];

      stats.totalFilesNum = results.testResults.length;

      for (const d of results.testResults) {
        const testFilePath = fixToshortPath(d.name, config.rootDir);

        if (d.status === 'failed') {
          if (cacheInfo.list[testFilePath]) {
            cacheDeleted[testFilePath] = cacheInfo.list[testFilePath];
            delete cacheInfo.list[testFilePath];
          }

          if (config.toWhiteList) {
            this.whiteList.list[testFilePath] = 1;
          } else if (this.whiteList.list[testFilePath]) {
            whilteListInfo.failed.push(testFilePath);
          } else {
            failedFiles.push(testFilePath);
            stats.failedFilesNum++;
          }
        } else {
          if (this.whiteList.list[testFilePath]) {
            whilteListInfo.deleted[testFilePath] = 1;
          }
          stats.passedFilesNum++;
          const tsFilePath = d.name.replace('.spec.', '.');
          this.cacheInfo.list[testFilePath] = {
            md5: existsSync(tsFilePath) ? md5(tsFilePath, true) : '',
            specMd5: md5(d.name, true),
            updateTime: results.startTime,
          };
        }
      }

      const shortWhiteListFilePath = fixToshortPath(config.whiteListFilePath, config.rootDir);
      if (config.toWhiteList) {
        stats.cacheFiles[config.whiteListFilePath] = { updated: this.whiteList };
        logger.info(`[ADD]Update whitelist(${Object.keys(this.whiteList).length}):`, color.cyanBright(shortWhiteListFilePath));
      } else {
        if (!isEmptyObject(whilteListInfo.deleted)) {
          logger.info(`[REMOVE]Update whitelist(${Object.keys(this.whiteList).length}):`, color.cyanBright(shortWhiteListFilePath));
          stats.cacheFiles[config.whiteListFilePath] = {
            updated: this.whiteList,
            deleted: whilteListInfo.deleted,
          };
          const deletedList = Object.keys(whilteListInfo.deleted);
          logger.info(`Remove from whilelist(${deletedList.length}):${fileListToString(deletedList)}`);
        }
      }

      stats.cacheFiles[this.cacheFilePath] = { updated: this.cacheInfo, deleted: cacheDeleted };
      stats.errorCount = results.numFailedTestSuites;
      stats.isPassed = failedFiles.length === 0;
      logger.debug('result use runCLI:\n', results);

      if (whilteListInfo.failed.length > 0) {
        logger.info(
          color.yellowBright(`Failed files(in whitelist)[${whilteListInfo.failed.length} files]:`),
          fileListToString(whilteListInfo.failed)
        );
      }

      if (!stats.isPassed) logger.error(color.redBright('Failed Files(not in whitelist):'), fileListToString(failedFiles));
    }

    return stats;
  }
  protected async beforeStart() {
    if (this.isCheckAll) return true;
    if (!this.cache.specFiles) this.cache.specFiles = await this.getSpecFileList(this.config.fileList);
    return this.cache.specFiles.length > 0;
  }
}
