/*
 * @Author: lzw
 * @Date: 2021-08-25 13:31:22
 * @LastEditors: lzw
 * @LastEditTime: 2022-07-07 14:07:59
 * @Description: fork 子进程的具体调用逻辑实现
 */

import type { CreateThreadOptions, WorkerMessageBody } from './fork';
import { lintStartAsync } from './lintStartAsync';

globalThis.isChildProc = true;
process.on('message', (options: CreateThreadOptions) => {
  if (options.debug) console.log('ForkWorker received:', options);
  const done = (data: unknown) => {
    process.send({ type: options.type, data, end: true } as WorkerMessageBody);
    process.exit(0);
  };

  lintStartAsync(options.type, options.config, true, done);
});
