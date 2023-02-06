/*
 * @Author: lzw
 * @Date: 2021-08-25 10:12:21
 * @LastEditors: lzw
 * @LastEditTime: 2022-11-01 11:10:55
 * @Description: 在 fork 子进程中执行 Check 任务
 */

import { fork } from 'child_process';
import { resolve } from 'node:path';
import { flhSrcDir } from '../config.js';
import type { ILintTypes } from '../types.js';
import { type CreateThreadOptions, handlerForCTOptions } from './utils.js';
import { getLogger } from '../utils/get-logger';

export interface WorkerMessageBody<T = unknown> {
  type: ILintTypes;
  data?: T;
  end?: boolean;
}

export function createForkThread<T, C = unknown>(
  options: CreateThreadOptions<C>,
  onMessage?: (d: WorkerMessageBody<T>) => void
): Promise<T> {
  const logger = getLogger();

  return new Promise((rs, reject) => {
    // const _dirname = typeof __dirname !== 'undefined' ? __dirname : dirname(fileURLToPath(import.meta.url));
    const worker = fork(resolve(flhSrcDir, './worker/forked-process.js'), { silent: false });
    worker.send(handlerForCTOptions(options, 'send'));

    worker.on('message', (info: WorkerMessageBody<T>) => {
      if (typeof info === 'string') info = JSON.parse(info);
      if (options.debug) logger.log('received from child proc:', info);
      if (onMessage) onMessage(info);

      if (info.end) {
        worker.kill();
        rs(info.data as never as T);
      }
    });

    worker.on('error', error => logger.log(`[worker][${options.type}]err:`, error));
    worker.on('exit', code => {
      if (options.debug) logger.debug(`[worker][${options.type}]exit worker`, code);
      if (code !== 0) reject(code);
    });

    if (options.debug) {
      worker.once('close', code => logger.debug(`[worker][${options.type}]Child exited with code ${code}`));
    }
  });
}
