/*
 * @Author: lzw
 * @Date: 2021-08-25 13:31:22
 * @LastEditors: lzw
 * @LastEditTime: 2022-11-01 11:16:37
 * @Description: fork 子进程的具体调用逻辑实现
 */

import type { WorkerMessageBody } from './fork.js';
import { type CreateThreadOptions, handlerForCTOptions } from './utils.js';
import { lintStartAsync } from './lintStartAsync.js';

globalThis.isInChildProcess = true;
process.on('message', (options: CreateThreadOptions) => {
  /* eslint-disable-next-line no-console */
  if (options.debug) console.log('ForkWorker received:', options);
  options = handlerForCTOptions(options, 'receive');
  const done = (data: unknown) => {
    process.send({ type: options.type, data, end: true } as WorkerMessageBody);
    process.exit(0);
  };

  lintStartAsync(options.type, options.config, true, done);
});
