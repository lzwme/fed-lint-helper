/*
 * @Author: lzw
 * @Date: 2021-08-25 10:12:21
 * @LastEditors: lzw
 * @LastEditTime: 2021-12-10 11:10:49
 * @Description: worker_threads 实现在 worker 线程中执行
 *
 * - worker_threads 比 child_process 和 cluster 更为轻量级的并行性，而且 worker_threads 可有效地共享内存
 * - eslint-plugins 也使用了 worker_threads，会有一些异常现象
 */

import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import type { TsCheckConfig, ESLintCheckConfig, JestCheckConfig, JiraCheckConfig, ILintTypes } from '../config';
interface CreateThreadOptions {
  debug?: boolean;
  /** 创建线程的类型。eslint 尽量使用该模式，使用 fork 进程方式 */
  type: ILintTypes;
  eslintConfig?: ESLintCheckConfig;
  tsCheckConfig?: TsCheckConfig;
  jestConfig?: JestCheckConfig;
  jiraConfig?: JiraCheckConfig;
}

interface WorkerMsgBody<T = unknown> {
  type: ILintTypes;
  data: T;
  end: boolean;
}

export function createWorkerThreads<T>(options: CreateThreadOptions, onMessage?: (d: WorkerMsgBody<T>) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!isMainThread) return reject(-2);

    const worker = new Worker(__filename, {
      workerData: options,
      // stderr: true,
      // stdout: true,
    });

    worker.on('message', (info: WorkerMsgBody<T>) => {
      if (options.debug) console.log(`received from worker thread:`, info);
      if (onMessage) onMessage(info);

      if (info.end) {
        resolve(info.data);
        process.nextTick(() => worker.terminate());
      }
    });

    worker.on('exit', code => {
      if (options.debug) console.log(`[${options.type}] exit worker with code:`, code);
      if (code !== 0) reject(code);
    });
  });
}

if (!isMainThread) {
  const config: CreateThreadOptions = workerData;
  if (config.debug) console.log('workerData:', config);
  const done = (data: unknown) => {
    if (config.debug) console.log('emit msg from worker thread:', { type: config.type, data, end: true });
    setTimeout(() => {
      parentPort.postMessage({ type: config.type, data, end: true } as WorkerMsgBody);
    }, 300);
  };
  const resetConfig = { checkOnInit: false, exitOnError: false, mode: 'current' };

  switch (config.type) {
    case 'tscheck':
      if (config.tsCheckConfig) {
        import('../ts-check').then(({ TsCheck }) => {
          const inc = new TsCheck(Object.assign(config.tsCheckConfig, resetConfig));
          inc.start().then(d => done(d));
        });
      }
      break;
    case 'eslint':
      if (config.eslintConfig) {
        import('../eslint-check').then(({ ESLintCheck }) => {
          const inc = new ESLintCheck(Object.assign(config.eslintConfig, resetConfig));
          inc.start().then(d => done(d));
        });
      }
      break;
    case 'jest':
      if (config.jestConfig) {
        import('../jest-check').then(({ JestCheck }) => {
          const inc = new JestCheck(Object.assign(config.jestConfig, resetConfig));
          inc.start().then(d => done(d));
        });
      }
      break;
    case 'jira':
      if (config.jiraConfig) {
        import('../jira-check').then(({ JiraCheck }) => {
          const inc = new JiraCheck(Object.assign(config.jiraConfig, resetConfig));
          inc.start().then(d => done(d));
        });
      }
      break;
    default:
      console.log('TODO', config);
      process.exit(1);
  }
}
