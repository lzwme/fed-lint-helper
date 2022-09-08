/*
 * @Author: lzw
 * @Date: 2021-08-25 10:12:21
 * @LastEditors: lzw
 * @LastEditTime: 2022-07-07 13:49:05
 * @Description: 在 fork 子进程中执行 Check 任务
 */

import { fork } from 'child_process';
import { resolve } from 'node:path';
import type { ILintTypes } from '../types';

export interface CreateThreadOptions<C = unknown> {
  /** 启动的类型。eslint 存在插件报错异常，暂不支持 */
  type: ILintTypes;
  debug?: boolean;
  config?: C;
}

export interface WorkerMessageBody<T = unknown> {
  type: ILintTypes;
  data?: T;
  end?: boolean;
}

export function createForkThread<T, C = unknown>(
  options: CreateThreadOptions<C>,
  onMessage?: (d: WorkerMessageBody<T>) => void
): Promise<T> {
  return new Promise((rs, reject) => {
    const worker = fork(resolve(__dirname, './forked-process.js'), { silent: false });
    worker.send(options);

    worker.on('message', (info: WorkerMessageBody<T>) => {
      if (typeof info === 'string') info = JSON.parse(info);
      if (options.debug) console.log('received from child proc:', info);
      if (onMessage) onMessage(info);

      if (info.end) {
        worker.kill();
        rs(info.data as never as T);
      }
    });

    worker.on('error', error => console.log(`[worker][${options.type}]err:`, error));
    worker.on('exit', code => {
      if (options.debug) console.log(`[worker][${options.type}]exit worker`, code);
      if (code !== 0) reject(code);
    });

    if (options.debug) {
      worker.once('close', code => console.log(`[worker][${options.type}]Child exited with code ${code}`));
    }
  });
}
