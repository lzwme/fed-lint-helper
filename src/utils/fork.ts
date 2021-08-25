/*
 * @Author: lzw
 * @Date: 2021-08-25 10:12:21
 * @LastEditors: lzw
 * @LastEditTime: 2021-08-25 16:49:57
 * @Description: 在 fork 子进程中执行 Check 任务
 */

import { fork } from 'child_process';
import path from 'path';
import { ESLintCheckConfig } from '../eslint-check';
import { TsCheckConfig } from '../ts-check';

export interface CreateThreadOptions {
  type: 'tscheck' | 'eslint' | 'jest'; // 'eslint' 存在插件报错异常，暂不支持
  eslintConfig?: ESLintCheckConfig;
  tsCheckConfig?: TsCheckConfig;
  debug?: boolean;
  jestConfig?: unknown;
}

export interface WorkerMsgBody {
  type?: 'tscheck' | 'eslint' | 'jest';
  data?: unknown;
  end?: boolean;
}

export function createForkThread<T>(options: CreateThreadOptions = { type: 'tscheck' }, onMessage?: (d) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const worker = fork(path.resolve(__dirname, './forked-process.js'), { silent: false });
    worker.send(options);

    worker.on('message', data => {
      const info: WorkerMsgBody = typeof data === 'string' ? JSON.parse(data) : data;
      if (options.debug) console.log('received from child proc:', info);
      if (onMessage) onMessage(info);

      if (info.end) {
        worker.kill();
        resolve(info.data as never as T);
      }
    });

    worker.on('error', err => console.log('worker err:', err, options.type));
    worker.on('exit', code => {
      if (options.debug) console.log('exit worker', code);
      if (code !== 0) reject(code);
    });

    if (options.debug) {
      worker.once('close', code => console.log(`[worker]Child exited with code ${code}`, options.type));
    }
  });
}
