/*
 * @Author: lzw
 * @Date: 2021-08-15 22:39:01
 * @LastEditors: lzw
 * @LastEditTime: 2022-07-06 18:15:25
 * @Description:  jest check
 */

import { existsSync, unlinkSync } from 'fs';
import { getLogger, getTimeCost } from './utils';
import { createForkThread } from './utils/fork';
import { CommConfig, ILintTypes } from './config';
import { exit } from './exit';
import { assign } from './utils/assgin';
import { color } from 'console-log-colors';

export interface LintResult {
  /** 是否检测通过 */
  isPassed: boolean;
  /** 开始处理时间 */
  startTime?: number;
  /** 处理的文件总数 */
  totalFiles?: number;
  // /** 失败文件数 */
  // errorCount?: number;
  /** 检测通过的文件数 */
  passedFilesNum?: number;
  /** 失败的文件数 */
  failedFilesNum?: number;
  /** 缓存命中的数量 */
  cacheHits?: number;
}

export abstract class LintBase<C extends CommConfig, R extends LintResult = LintResult> {
  /** 统计信息 */
  protected stats = this.getInitStats() as R;
  /**
   * 检测缓存文件的路径。不应提交至 git 仓库
   */
  protected cacheFilePath = '';
  protected logger: ReturnType<typeof getLogger>;

  /** 配置参数格式化 */
  public abstract parseConfig(config: C): C;
  /** start 之前调用。返回 false 则终止继续执行 */
  protected abstract beforeStart(fileList?: string[]): boolean;
  /** 执行校验 */
  protected abstract check(): Promise<R>;
  protected abstract init(): void;

  constructor(protected tag: ILintTypes, protected config?: C) {
    config = this.parseConfig(config);
    const level = this.config.silent ? 'silent' : this.config.debug ? 'debug' : 'log';
    this.logger = getLogger(this.tag, level);
    this.logger.debug('config', this.config);

    if (existsSync(this.cacheFilePath) && this.config.removeCache) unlinkSync(this.cacheFilePath);

    if (this.config.checkOnInit) this.start();
  }
  /** 获取初始化的统计信息 */
  protected getInitStats(): LintResult {
    const stats: LintResult = {
      isPassed: true,
      startTime: Date.now(),
      totalFiles: 0,
      passedFilesNum: 0,
      failedFilesNum: 0,
      cacheHits: 0,
    };

    return stats;
  }
  /** 返回执行结果统计信息 */
  public get statsInfo() {
    return this.stats;
  }
  /**
   * 在 fork 子进程中执行
   */
  protected checkInChildProc() {
    this.logger.info('start fork child progress');
    return createForkThread<R, C>({
      type: this.tag,
      debug: this.config.debug,
      config: this.config,
    }).catch(error => {
      this.logger.error('checkInChildProc error, code:', error);
      return { isPassed: false } as R;
    });
  }
  /**
   * 在 work_threads 子线程中执行
   */
  protected checkInWorkThreads() {
    this.logger.info('start create work threads');
    return import('./utils/worker-threads').then(({ createWorkerThreads }) => {
      return createWorkerThreads<R, C>({
        type: this.tag,
        debug: this.config.debug,
        config: this.config,
      }).catch(error => {
        this.logger.error('checkInWorkThreads error, code:', error);
        return { isPassed: false } as R;
      });
    });
  }
  /** 执行 jest 校验 */
  async start(fileList?: string[]) {
    const { config, logger, stats } = this;
    this.init();

    let result: R = this.stats;

    if (!this.beforeStart(fileList)) {
      logger.info('No files to process\n');
      return result;
    }

    if (config.mode === 'proc') result = await this.checkInChildProc();
    else if (config.mode === 'thread') result = await this.checkInWorkThreads();
    else result = await this.check();

    result.startTime = stats.startTime;
    result = assign(stats, result);

    if (!globalThis.isChildProc) {
      logger.debug('result', stats);

      const tip = stats.isPassed ? color.greenBright('Verification passed!') : color.redBright('Verification failed!');
      this.logger.info(color.bold(tip));
      logger.info(getTimeCost(stats.startTime));
      if (!stats.isPassed && config.exitOnError) exit(stats.failedFilesNum || -1, this.tag);
    }

    return stats;
  }
}
