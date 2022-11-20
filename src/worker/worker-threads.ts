/*
 * @Author: lzw
 * @Date: 2021-08-25 10:12:21
 * @LastEditors: lzw
 * @LastEditTime: 2022-11-01 11:13:55
 * @Description: worker_threads 实现在 worker 线程中执行
 *
 * - worker_threads 比 child_process 和 cluster 更为轻量级的并行性，而且 worker_threads 可有效地共享内存
 * - eslint-plugins 也使用了 worker_threads，会有一些异常现象
 */
import { resolve } from 'node:path';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { flhSrcDir } from '../config.js';
import type { ILintTypes } from '../types.js';
import { getLogger } from '../utils/get-logger.js';
import { lintStartAsync } from './lintStartAsync.js';
import { type CreateThreadOptions, handlerForCTOptions } from './utils.js';

interface WorkerMessageBody<T = unknown> {
  type: ILintTypes;
  data: T;
  end: boolean;
}

export function createWorkerThreads<T, C = unknown>(
  options: CreateThreadOptions<C>,
  onMessage?: (d: WorkerMessageBody<T>) => void
): Promise<T> {
  return new Promise((rs, reject) => {
    if (!isMainThread) return reject(-2);
    const _filename = resolve(flhSrcDir, './worker/worker-threads.js');
    const worker = new Worker(_filename, {
      workerData: handlerForCTOptions(options, 'send'),
      // stderr: true,
      // stdout: true,
    });

    worker.on('message', (info: WorkerMessageBody<T>) => {
      getLogger().debug(`[${options.type}] received from worker thread:`, info);
      if (onMessage) onMessage(info);

      if (info.end) {
        setTimeout(() => worker.terminate(), 100);
        rs(info.data);
      }
    });

    worker.on('exit', code => {
      getLogger().debug(`[${options.type}] exit worker with code:`, code);
      if (code !== 0) reject(code);
    });
  });
}

if (!isMainThread) {
  globalThis.isInChildProcess = true;
  const options: CreateThreadOptions = handlerForCTOptions(workerData, 'receive');
  getLogger().debug('workerData:', options);
  const done = (data: unknown) => {
    const info: WorkerMessageBody = { type: options.type, data, end: true };
    getLogger().debug('emit msg from worker thread:', info);
    // 等待写文件和日志完成
    setTimeout(() => parentPort.postMessage(info), 50);
  };

  lintStartAsync(options.type, options.config, true, done);
}
