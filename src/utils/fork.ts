/*
 * @Author: lzw
 * @Date: 2021-08-25 10:12:21
 * @LastEditors: lzw
 * @LastEditTime: 2021-11-10 15:22:34
 * @Description: 在 fork 子进程中执行 Check 任务
 */

import { fork } from 'child_process';
import path from 'path';
import type { TsCheckConfig, ESLintCheckConfig, JestCheckConfig, JiraCheckConfig, ILintTypes } from '../config';

export interface CreateThreadOptions {
  /** 启动的类型。eslint 存在插件报错异常，暂不支持 */
  type: ILintTypes;
  debug?: boolean;
  eslintConfig?: ESLintCheckConfig;
  tsCheckConfig?: TsCheckConfig;
  jestConfig?: JestCheckConfig;
  jiraConfig?: JiraCheckConfig;
}

export interface WorkerMsgBody<T = unknown> {
  type: ILintTypes;
  data?: T;
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

    worker.on('error', err => console.log(`[worker][${options.type}]err:`, err));
    worker.on('exit', code => {
      if (options.debug) console.log(`[worker][${options.type}]exit worker`, code);
      if (code !== 0) reject(code);
    });

    if (options.debug) {
      worker.once('close', code => console.log(`[worker][${options.type}]Child exited with code ${code}`));
    }
  });
}
