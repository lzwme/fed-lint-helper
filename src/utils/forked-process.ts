/*
 * @Author: lzw
 * @Date: 2021-08-25 13:31:22
 * @LastEditors: lzw
 * @LastEditTime: 2022-07-07 09:20:25
 * @Description: fork 子进程的具体调用逻辑实现
 */

import type { CreateThreadOptions, WorkerMessageBody } from './fork';
import type { TsCheckConfig, ESLintCheckConfig, JestCheckConfig, JiraCheckConfig } from '../types';

globalThis.isChildProc = true;
process.on('message', (options: CreateThreadOptions) => {
  if (options.debug) console.log('ForkWorker received:', options);
  const done = (data: unknown) => {
    process.send({ type: options.type, data, end: true } as WorkerMessageBody);
    process.exit(0);
  };
  const resetConfig = {
    checkOnInit: false,
    exitOnError: false,
    mode: 'current',
  };

  if (options.config) {
    switch (options.type) {
      case 'tscheck':
        return import('../ts-check').then(({ TsCheck }) => {
          const inc = new TsCheck(Object.assign(options.config as TsCheckConfig, resetConfig));
          inc.start().then(d => done(d));
        });
      case 'eslint':
        return import('../eslint-check').then(({ ESLintCheck }) => {
          const inc = new ESLintCheck(Object.assign(options.config as ESLintCheckConfig, resetConfig));
          inc.start().then(d => done(d));
        });
      case 'jest':
        return import('../jest-check').then(({ JestCheck }) => {
          const inc = new JestCheck(Object.assign(options.config as JestCheckConfig, resetConfig));
          inc.start().then(d => done(d));
        });
      case 'jira':
        return import('../jira-check').then(({ JiraCheck }) => {
          const inc = new JiraCheck(Object.assign(options.config as JiraCheckConfig, resetConfig));
          inc.start().then(d => done(d));
        });
      default:
        console.log('TODO', options);
    }
  }

  process.exit(1);
});
