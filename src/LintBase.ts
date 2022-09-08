/*
 * @Author: lzw
 * @Date: 2021-08-15 22:39:01
 * @LastEditors: lzw
 * @LastEditTime: 2022-09-08 19:48:13
 * @Description:  jest check
 */

import { existsSync, unlinkSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { color } from 'console-log-colors';
import { assign, getObjectKeysUnsafe, execSync, createFilePathFilter } from '@lzwme/fe-utils';
import { getIndentSize, getTimeCost, globMatcher, isGitRepo } from './utils/common';
import { getLogger } from './utils/get-logger';
import { createForkThread } from './worker/fork';
import { getConfig } from './config';
import type { CommConfig, ILintTypes } from './types';
import { exit } from './exit';

export interface LintResult {
  /** 是否检测通过 */
  isPassed: boolean;
  /** 开始处理时间 */
  startTime?: number;
  /** 处理的文件总数 */
  totalFilesNum?: number;
  /** 异常信息数(一个文件可能包含多个异常) */
  errorCount?: number;
  /** 检测通过的文件数 */
  passedFilesNum?: number;
  /** 失败的文件数 */
  failedFilesNum?: number;
  /** 缓存命中的数量 */
  cacheHits?: number;
  /** 缓存文件与对应的缓存信息。放在最后汇总并写入文件 */
  cacheFiles?: {
    [filepath: string]: {
      updated: Record<string, unknown>;
      deleted?: Record<string, unknown>;
    };
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export abstract class LintBase<C extends CommConfig & Record<string, any>, R extends LintResult = LintResult> {
  /** 统计信息 */
  protected stats = this.getInitStats() as R;
  /**
   * 检测缓存文件的路径。不应提交至 git 仓库
   */
  protected cacheFilePath = '';
  protected isCheckAll = false;
  protected logger: ReturnType<typeof getLogger>;

  /** 配置参数格式化 */
  public abstract parseConfig(config: C): C;
  /** start 之前调用。返回 false 则终止继续执行 */
  protected abstract beforeStart(fileList?: string[]): boolean | Promise<boolean>;
  /** 执行校验 */
  protected abstract check(fileList?: string[]): Promise<R>;
  protected abstract init(): void;

  constructor(protected tag: ILintTypes, protected config?: C) {
    this.config = assign({} as C, this.parseConfig(config));
    const baseConfig = getConfig();

    if (!this.logger) {
      const level = this.config.silent ? 'silent' : this.config.debug ? 'debug' : 'log';
      this.logger = getLogger(`[${this.tag}]`, level);
    }
    this.logger.debug('config', this.config);

    this.cacheFilePath = resolve(this.config.rootDir, baseConfig.cacheLocation, `${tag}Cache.json`);
    if (this.config.checkOnInit) this.start();
  }
  /** 获取初始化的统计信息 */
  protected getInitStats(): R {
    const stats: LintResult = {
      isPassed: true,
      startTime: Date.now(),
      totalFilesNum: 0,
      passedFilesNum: 0,
      failedFilesNum: 0,
      errorCount: 0,
      cacheHits: 0,
      cacheFiles: {},
    };

    return stats as R;
  }
  /** 返回执行结果统计信息 */
  public get statsInfo() {
    return this.stats;
  }
  private filePathFiler: ReturnType<typeof createFilePathFilter>;
  /** 通用文件过滤，基于 include、exclude 和 extensions */
  protected filesFilter(fileList: string | string[], isFilterByExt = true, cacheFilter = true) {
    if (!fileList) fileList = [];
    if (typeof fileList === 'string') fileList = [fileList];

    if (!this.filePathFiler || !cacheFilter) {
      this.filePathFiler = createFilePathFilter({
        include: this.config.include,
        exclude: this.config.exclude,
        extensions: isFilterByExt && Array.isArray(this.config.extensions) ? this.config.extensions : [],
        globMatcher,
        // resolve: this.config.rootDir,
      });
    }

    return fileList.filter(d => this.filePathFiler(d));
  }
  /**
   * 在 fork 子进程中执行
   */
  protected checkInChildProc(config = this.config) {
    // this.logger.info('start fork child progress');
    return createForkThread<R, C>({
      type: this.tag,
      debug: config.debug,
      config,
    }).catch((error: number) => {
      this.logger.error('checkInChildProc error, code:', error);
      return { isPassed: false } as R;
    });
  }
  /**
   * 在 work_threads 子线程中执行
   */
  protected checkInWorkThreads(config = this.config) {
    // this.logger.info('start create work threads');
    return import('./worker/worker-threads').then(({ createWorkerThreads }) => {
      return createWorkerThreads<R, C>({
        type: this.tag,
        debug: config.debug,
        config: config,
      }).catch((error: number) => {
        this.logger.error('checkInWorkThreads error, code:', error);
        return { isPassed: false } as R;
      });
    });
  }
  protected saveCache(filepath: string, info: unknown, isReset = false) {
    if (!isReset && existsSync(filepath)) {
      info = assign(JSON.parse(readFileSync(filepath, 'utf8')), info);
    }

    const pDir = dirname(filepath);
    if (!existsSync(pDir)) mkdirSync(pDir, { recursive: true });

    writeFileSync(filepath, JSON.stringify(info, null, getIndentSize(this.config.rootDir)), { encoding: 'utf8' });
    if (!filepath.includes('node_modules') && isGitRepo(this.config.rootDir)) {
      execSync(`git add ${filepath}`, void 0, this.config.rootDir, !this.config.silent);
    }
  }
  protected async checkForPackages() {
    const { config } = this;
    let result: LintResult;

    // todo: 识别与处理 config.packages
    const baseConfig = getConfig();
    const pkgs = Object.values(baseConfig.packages);
    const pkgsCfg: { [pkgpath: string]: { src: string[]; fileList: string[] } } = {};

    if (pkgs.length === 0 || this.config.detectSubPackages === false) {
      if (config.mode === 'thread') result = await this.checkInWorkThreads();
      else if (config.mode === 'proc') result = await this.checkInChildProc();
      else result = await this.startCheck();
      return result;
    }

    // 文件分类
    if (pkgs.length > 0) {
      if (this.isCheckAll) {
        for (const src of config.src) {
          const srcpath = resolve(config.rootDir, src);
          const pkgpath = pkgs.find(d => srcpath.startsWith(d)) || config.rootDir;
          if (!pkgsCfg[pkgpath]) pkgsCfg[pkgpath] = { src: [srcpath], fileList: [] };
          else pkgsCfg[pkgpath].src.push(srcpath);
        }
      } else {
        for (let filepath of config.fileList) {
          filepath = resolve(config.rootDir, filepath);
          const pkgpath = pkgs.find(d => filepath.startsWith(d)) || config.rootDir;
          if (!pkgsCfg[pkgpath]) pkgsCfg[pkgpath] = { src: [], fileList: [filepath] };
          else pkgsCfg[pkgpath].fileList.push(filepath);
        }
      }
    } else {
      pkgsCfg[config.rootDir] = { src: config.src, fileList: config.fileList };
    }

    const results: Promise<LintResult>[] = [];
    for (const [pkgDir, cfg] of Object.entries(pkgsCfg)) {
      const newConfig = Object.assign({}, config, cfg);
      newConfig.rootDir = pkgDir;
      if (config.mode === 'thread') results.push(this.checkInWorkThreads(newConfig));
      else if (config.mode === 'proc') results.push(this.checkInChildProc(newConfig));
      else {
        this.config = newConfig;
        result = await this.startCheck();
        results.push(Promise.resolve(assign({} as LintResult, result))); // todo: 实现并发执行？
      }
    }

    result = { isPassed: true, startTime: this.stats.startTime };
    const res = await Promise.all(results);
    res.forEach(r => {
      getObjectKeysUnsafe(r).forEach(key => {
        if (key === 'startTime') return;
        if (typeof r[key] === 'number') {
          if (null == result[key]) result[key] = 0 as never;
          result[key as 'totalFilesNum'] += r[key] as number;
        } else if (typeof r[key] === 'boolean') {
          if (null == result[key]) result[key] = true as never;
          result[key] = (result[key] && r[key]) as never;
        } else assign(result[key] as never, r[key] as never);
      });
    });

    return result;
  }
  private startCheck() {
    this.logger.info(color.cyan('start checking in'), color.greenBright(this.config.rootDir));
    if (this.init) this.init();
    return this.check();
  }
  async start(fileList: string[] = this.config.fileList) {
    let result: R = (this.stats = this.getInitStats());
    const { config, logger, stats } = this;

    if (!Array.isArray(config.fileList)) config.fileList = [];
    if (!Array.isArray(fileList) || fileList.length === 0) fileList = config.fileList;
    if (fileList !== config.fileList) config.fileList = fileList;

    this.isCheckAll = !(config.onlyChanges || fileList.length > 0);

    if (!this.isCheckAll && config.fileList.length > 0) {
      config.fileList = this.filesFilter(config.fileList);
    }

    const isNoFiles = this.isCheckAll ? config.src.length === 0 : !(await this.beforeStart(config.fileList));
    if (isNoFiles) {
      logger.info('No files to process\n');
      return result;
    }

    if (globalThis.isInChildProcess) {
      config.exitOnError = false;
      result = await this.startCheck();
    } else {
      if (existsSync(this.cacheFilePath) && config.removeCache) unlinkSync(this.cacheFilePath);
      result = (await this.checkForPackages()) as R;
    }

    result.startTime = stats.startTime;
    result = assign(stats, result);

    if (!globalThis.isInChildProcess) {
      const { bold, cyan, red, redBright, greenBright } = color;
      logger.debug('result', stats);
      logger.info(cyan(`[${config.mode}]`), bold(stats.isPassed ? greenBright('Verification passed!') : redBright('Verification failed!')));
      if (stats.totalFilesNum) {
        if (stats.errorCount) logger.info(cyan(' - errorCount:\t'), bold(redBright(stats.errorCount)));
        logger.info(cyan(' - Failed:\t'), bold(red(stats.failedFilesNum)));
        if (stats.passedFilesNum) logger.info(cyan(' - Passed:\t'), bold(greenBright(stats.passedFilesNum)));
        logger.info(cyan(' - Total :\t'), stats.totalFilesNum);
      }

      for (const [filepath, info] of Object.entries(stats.cacheFiles)) {
        const allInfo = info.updated; // info.all

        if (info.deleted) {
          Object.keys(info.deleted).forEach(filepath => {
            if (allInfo[filepath]) delete allInfo[filepath];
          });
        }

        this.saveCache(filepath, allInfo, true);
      }

      logger.info(getTimeCost(stats.startTime));
      if (!stats.isPassed && config.exitOnError) exit(stats.errorCount || stats.failedFilesNum || -1, this.tag);
    }

    return stats;
  }
}
