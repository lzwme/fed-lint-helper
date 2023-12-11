/*
 * @Author: lzw
 * @Date: 2021-08-15 22:39:01
 * @LastEditors: renxia
 * @LastEditTime: 2023-12-11 16:52:09
 * @Description:  jest check
 */

import { existsSync, unlinkSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { bold, cyan, red, redBright, greenBright, yellowBright } from 'console-log-colors';
import {
  assign,
  createFilePathFilter,
  execSync,
  getHeadCommitId,
  getObjectKeysUnsafe,
  isGitRepo,
  isObject,
  mkdirp,
  readJsonFileSync,
} from '@lzwme/fe-utils';
import { getIndentSize, getTimeCost, globMatcher, padSpace } from '../utils/common.js';
import { getLogger } from '../utils/get-logger.js';
import { createForkThread } from '../worker/fork.js';
import { getConfig, FlhPkgInfo } from '../config.js';
import type { CommConfig, ILintTypes, LintCacheInfo, LintResult, WhiteListInfo } from '../types';
import { exit } from '../exit.js';

export abstract class LintBase<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  C extends CommConfig & Record<string, any>,
  R extends LintResult = LintResult,
  // LintCacheInfo<I>
  I = Record<string, unknown>,
> {
  /** 统计信息 */
  protected stats = this.getInitStats() as R;
  /** 检测缓存文件的路径。不应提交至 git 仓库 */
  protected cacheFilePath = '';
  protected isCheckAll = false;
  protected logger: ReturnType<typeof getLogger>;
  protected whiteList: WhiteListInfo = { list: {} };
  /** 要缓存到 cacheFilePath 的信息 */
  protected cacheInfo: LintCacheInfo<I> = { list: {} };

  /** start 之前调用。返回 true 才会继续执行 */
  protected abstract beforeStart(fileList?: string[]): boolean | string | Promise<boolean | string>;
  /** 执行检测 */
  protected abstract check(fileList?: string[]): Promise<R>;

  constructor(
    protected tag: ILintTypes,
    protected config?: C
  ) {
    const baseConfig = getConfig({ [tag]: config || {} }, false);
    this.config = assign({ whiteListFilePath: `config/whitelist-${tag}.json` } as C, baseConfig[tag]);
    this.parseConfig(this.config);

    if (this.config.extensions?.length > 0) {
      this.config.extensions = this.config.extensions.map(ext => (ext.startsWith('.') ? ext : `.${ext}`));
    }

    for (const key of ['exclude', 'include'] as const) {
      if (baseConfig[key] !== this.config[key]) {
        this.config[key] = [...new Set([...(baseConfig[key] || []), ...(this.config[key] || [])])];
      }
    }

    const level = this.config.silent ? 'silent' : this.config.debug ? 'debug' : 'log';
    this.logger = getLogger(`[${this.tag}]`, level, baseConfig.logDir);

    this.config.whiteListFilePath = resolve(this.config.rootDir, this.config.whiteListFilePath);
    this.cacheFilePath = resolve(this.config.rootDir, baseConfig.cacheLocation, `${tag}Cache.json`);

    if (this.config.checkOnInit) this.start();
  }
  protected init(): void {
    this.cacheInfo = { list: {} };
    const whiteListFilePath = this.config.whiteListFilePath;
    if (existsSync(whiteListFilePath) && !this.config.toWhiteList && !this.config.ignoreWhiteList) {
      const list = JSON.parse(readFileSync(whiteListFilePath, 'utf8'));
      this.whiteList = list.list ? list : { list }; // 兼容旧格式
      this.logger.debug('load whiteList:', whiteListFilePath);
    }
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
    return import('../worker/worker-threads.js').then(({ createWorkerThreads }) => {
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
  private commitId = '';
  getCommitId() {
    if (!this.commitId && isGitRepo(this.config.rootDir)) this.commitId = getHeadCommitId();
    return this.commitId;
  }
  protected getCacheInfo() {
    let cacheInfo: LintCacheInfo<I> = { list: {} };
    if (this.config.cache && existsSync(this.cacheFilePath)) {
      try {
        const info = readJsonFileSync<LintCacheInfo<I>>(this.cacheFilePath);
        if (!info.list || (info.version && info.version !== FlhPkgInfo.version)) {
          unlinkSync(this.cacheFilePath);
        } else {
          this.logger.debug('load cache from', this.cacheFilePath);
          cacheInfo = info;
        }
      } catch (error) {
        this.logger.error(error);
      }
    }
    return cacheInfo;
  }
  protected saveCache(filepath: string, info: unknown, isReset = false) {
    const baseConfig = getConfig();
    const isWhiteList = filepath === this.config.whiteListFilePath;

    // 忽略白名单，不写入文件
    if (isWhiteList && this.config.ignoreWhiteList) return;

    if (!isReset && existsSync(filepath)) info = assign(JSON.parse(readFileSync(filepath, 'utf8')), info);

    if (isObject(info) && !Array.isArray(info) && !isWhiteList) {
      Object.assign(info, { $commitId: this.getCommitId() });
    }

    mkdirp(dirname(filepath));
    writeFileSync(filepath, JSON.stringify(info, null, getIndentSize(this.config.rootDir)), { encoding: 'utf8' });

    if (!baseConfig.ci && !filepath.includes('node_modules') && isGitRepo(this.config.rootDir)) {
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
          if (pkgsCfg[pkgpath]) {
            pkgsCfg[pkgpath].src.push(srcpath);
          } else {
            pkgsCfg[pkgpath] = { src: [srcpath], fileList: [] };
          }
        }
      } else {
        for (let filepath of config.fileList) {
          filepath = resolve(config.rootDir, filepath);
          const pkgpath = pkgs.find(d => filepath.startsWith(d)) || config.rootDir;
          if (pkgsCfg[pkgpath]) {
            pkgsCfg[pkgpath].fileList.push(filepath);
          } else {
            pkgsCfg[pkgpath] = { src: [], fileList: [filepath] };
          }
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
    this.logger.info(cyan('start checking in'), greenBright(this.config.rootDir));
    if (this.init) this.init();
    return this.check();
  }
  async start(fileList: string[] = this.config.fileList) {
    let result: R = (this.stats = this.getInitStats());
    const { config, logger, stats } = this;
    const baseConfig = getConfig();

    if (!Array.isArray(config.fileList)) config.fileList = [];
    if (!Array.isArray(fileList) || fileList.length === 0) fileList = config.fileList;
    if (fileList !== config.fileList) config.fileList = fileList;

    this.isCheckAll = !(baseConfig.onlyChanges || baseConfig.onlyStaged || fileList.length > 0);

    if (!this.isCheckAll && config.fileList.length > 0) config.fileList = this.filesFilter(config.fileList);

    let hasFiles: boolean | string = this.isCheckAll ? this.config.src.length > 0 : config.fileList.length > 0;

    if (hasFiles) hasFiles = await this.beforeStart(config.fileList);
    if (hasFiles !== true) {
      logger.info(typeof hasFiles === 'string' ? hasFiles : 'No files to process', '\n');
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
      logger.debug('result', stats);
      logger.info(cyan(`[${config.mode}]`), bold(stats.isPassed ? greenBright('Verification passed!') : redBright('Verification failed!')));
      if (stats.totalFilesNum) {
        if (stats.warningCount) logger.info(cyan(` - ${padSpace('warningCount', 15, false)}:`), bold(yellowBright(stats.warningCount)));
        if (stats.errorCount) logger.info(cyan(` - ${padSpace('errorCount', 15, false)}:`), bold(redBright(stats.errorCount)));
        if (stats.failedFilesNum) logger.info(red(` - ${padSpace('Failed Files', 15, false)}:`), bold(red(stats.failedFilesNum)));
        if (stats.passedFilesNum) logger.info(cyan(` - ${padSpace('Passed Files', 15, false)}:`), bold(greenBright(stats.passedFilesNum)));
        logger.info(cyan(` - ${padSpace('Total Files', 15, false)}:`), stats.totalFilesNum);
      }

      for (const [filepath, info] of Object.entries(stats.cacheFiles)) {
        const allInfo = info.updated; // info.all
        if (!info.type && filepath === this.cacheFilePath) {
          info.type = 'cache';
        }

        if (info.type === 'cache') {
          allInfo.success = stats.isPassed;
          allInfo.version = FlhPkgInfo.version;
        }

        if (info.deleted) {
          Object.keys(info.deleted).forEach(filepath => {
            if (allInfo.list) {
              if (allInfo.list[filepath as never]) delete allInfo.list[filepath as never];
            } else if (allInfo[filepath]) delete allInfo[filepath];
          });
        }

        this.saveCache(filepath, allInfo, true);
      }

      logger.info(getTimeCost(stats.startTime));
      if (!stats.isPassed && config.exitOnError) exit(stats.errorCount || stats.failedFilesNum || -1, this.tag);
    }

    return stats;
  }
  /** 配置参数格式化 */
  public parseConfig(config: C): C {
    if (config && config !== this.config) config = assign<C>(this.config, config);
    return this.config;
  }
}
