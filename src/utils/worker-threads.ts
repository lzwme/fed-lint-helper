/*
 * @Author: lzw
 * @Date: 2021-08-25 10:12:21
 * @LastEditors: lzw
 * @LastEditTime: 2022-07-06 17:26:21
 * @Description: worker_threads 实现在 worker 线程中执行
 *
 * - worker_threads 比 child_process 和 cluster 更为轻量级的并行性，而且 worker_threads 可有效地共享内存
 * - eslint-plugins 也使用了 worker_threads，会有一些异常现象
 */

import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import type { ESLintCheckConfig, ILintTypes, JestCheckConfig, JiraCheckConfig, TsCheckConfig } from '../config';
import { getLogger } from './get-logger';
interface CreateThreadOptions<C = unknown> {
  debug?: boolean;
  /** 创建线程的类型。eslint 尽量使用该模式，使用 fork 进程方式 */
  type: ILintTypes;
  config: C;
}

interface WorkerMessageBody<T = unknown> {
  type: ILintTypes;
  data: T;
  end: boolean;
}

export function createWorkerThreads<T, C = unknown>(
  options: CreateThreadOptions<C>,
  onMessage?: (d: WorkerMessageBody<T>) => void
): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!isMainThread) return reject(-2);

    const worker = new Worker(__filename, {
      workerData: options,
      // stderr: true,
      // stdout: true,
    });

    worker.on('message', (info: WorkerMessageBody<T>) => {
      getLogger().debug(`[${options.type}] received from worker thread:`, info);
      if (onMessage) onMessage(info);

      if (info.end) {
        resolve(info.data);
        process.nextTick(() => worker.terminate());
      }
    });

    worker.on('exit', code => {
      getLogger().debug(`[${options.type}] exit worker with code:`, code);
      if (code !== 0) reject(code);
    });
  });
}

if (!isMainThread) {
  globalThis.isChildProc = true;
  const options: CreateThreadOptions = workerData;
  if (options.debug) console.log('workerData:', options);
  const done = (data: unknown) => {
    if (options.debug) console.log('emit msg from worker thread:', { type: options.type, data, end: true });
    setTimeout(() => {
      parentPort.postMessage({ type: options.type, data, end: true } as WorkerMessageBody);
    }, 300);
  };
  const resetConfig = { checkOnInit: false, exitOnError: false, mode: 'current' };

  switch (options.type) {
    case 'tscheck':
      if (options.config) {
        import('../ts-check').then(({ TsCheck }) => {
          const inc = new TsCheck(Object.assign(options.config as TsCheckConfig, resetConfig));
          inc.start().then(d => done(d));
        });
      }
      break;
    case 'eslint':
      if (options.config) {
        import('../eslint-check').then(({ ESLintCheck }) => {
          const inc = new ESLintCheck(Object.assign(options.config as ESLintCheckConfig, resetConfig));
          inc.start().then(d => done(d));
        });
      }
      break;
    case 'jest':
      if (options.config) {
        import('../jest-check').then(({ JestCheck }) => {
          const inc = new JestCheck(Object.assign(options.config as JestCheckConfig, resetConfig));
          inc.start().then(d => done(d));
        });
      }
      break;
    case 'jira':
      if (options.config) {
        import('../jira-check').then(({ JiraCheck }) => {
          const inc = new JiraCheck(Object.assign(options.config as JiraCheckConfig, resetConfig));
          inc.start().then(d => done(d));
        });
      }
      break;
    default:
      console.log('TODO', options);
      process.exit(1);
  }
}
