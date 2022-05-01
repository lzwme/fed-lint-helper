/*
 * @Author: lzw
 * @Date: 2021-08-25 13:31:22
 * @LastEditors: lzw
 * @LastEditTime: 2021-11-18 22:07:19
 * @Description: fork 子进程的具体调用逻辑实现
 */

import type { CreateThreadOptions, WorkerMessageBody } from './fork';

process.on('message', (config: CreateThreadOptions) => {
  if (config.debug) console.log('ForkWorker received:', config);
  const done = (data: unknown) => {
    process.send({ type: config.type, data, end: true } as WorkerMessageBody);
    process.exit(0);
  };
  const resetConfig = {
    checkOnInit: false,
    exitOnError: false,
    mode: 'current',
  };

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
});
