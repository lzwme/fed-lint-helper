/*
 * @Author: lzw
 * @Date: 2021-08-25 10:12:21
 * @LastEditors: lzw
 * @LastEditTime: 2021-09-25 17:39:03
 * @Description: worker_threads 实现在 worker 线程中执行
 * worker_threads 比 child_process 和 cluster 更为轻量级的并行性，而且 worker_threads 可有效地共享内存
 * eslint-plugins 也使用了 worker_threads，会有一些异常现象
 */

import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import type { TsCheckConfig, ESLintCheckConfig } from '../config';

interface CreateThreadOptions {
  /** 创建线程的类型。eslint 尽量使用该模式，使用 fork 进程方式 */
  type: 'eslint' | 'tscheck' | 'jest';
  eslintConfig?: ESLintCheckConfig;
  tsCheckConfig?: TsCheckConfig;
  debug?: boolean;
  jestConfig?: unknown;
}

export function createWorkerThreads<T>(options: CreateThreadOptions = { type: 'tscheck' }, onMessage?: (d) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!isMainThread) return;

    if (options.debug) console.log('createWorkerThreads:', options);

    const worker = new Worker(__filename, {
      workerData: options,
      // stderr: true,
      // stdout: true,
    });

    worker.on('message', data => {
      if (options.debug) console.log('onmessage from worker:', data);
      if (onMessage) onMessage(data);

      if (data.end) {
        worker.terminate();
        resolve(data);
      }
    });

    worker.on('exit', code => {
      if (options.debug) console.log('exit worker', code, options.type);
      if (code !== 0) reject(code);
    });
  });
}

if (!isMainThread) {
  const config: CreateThreadOptions = workerData;
  if (config.debug) console.log('workerData:', config, config.type);

  if (config.type === 'tscheck' && config.tsCheckConfig) {
    import('../ts-check').then(({ TsCheck }) => {
      config.tsCheckConfig.mode = 'current';
      const tsCheck = new TsCheck(config.tsCheckConfig);
      tsCheck.start().then(d => {
        parentPort.postMessage({
          type: 'tscheck',
          data: d,
          end: true,
        });
        process.exit(0);
      });
    });
  } else if (config.type === 'eslint' && config.eslintConfig) {
    import('../eslint-check').then(({ ESLintCheck }) => {
      config.eslintConfig.mode = 'current';
      const eslintCheck = new ESLintCheck(config.eslintConfig);
      eslintCheck.start().then(d => {
        parentPort.postMessage({
          type: 'eslint',
          data: d,
          end: true,
        });
        process.exit(0);
      });
    });
  } else if (config.type === 'jest' && config.jestConfig) {
    console.log('TODO');

    parentPort.postMessage({
      type: 'jest',
      data: { msg: 'todo' },
      end: true,
    });
    process.exit(0);
  }
}
