/*
 * @Author: lzw
 * @Date: 2021-08-25 13:31:22
 * @LastEditors: lzw
 * @LastEditTime: 2021-11-10 13:30:51
 * @Description: fork 子进程的具体调用逻辑实现
 */

import type { CreateThreadOptions, WorkerMsgBody } from './fork';

process.on('message', (config: CreateThreadOptions) => {
  if (config.debug) console.log('ForkWorker received:', config);

  switch (config.type) {
    case 'tscheck':
      if (config.tsCheckConfig) {
        import('../ts-check').then(({ TsCheck }) => {
          config.tsCheckConfig.checkOnInit = false;
          config.tsCheckConfig.mode = 'current';

          const tsCheck = new TsCheck(config.tsCheckConfig);
          tsCheck.start().then(d => {
            process.send({
              type: 'tscheck',
              data: d,
              end: true,
            } as WorkerMsgBody);
            process.exit(0);
          });
        });
      }
      break;
    case 'eslint':
      if (config.eslintConfig) {
        import('../eslint-check').then(({ ESLintCheck }) => {
          config.eslintConfig.checkOnInit = false;
          config.eslintConfig.mode = 'current';

          const eslintCheck = new ESLintCheck(config.eslintConfig);
          eslintCheck.start().then(d => {
            process.send({
              type: 'eslint',
              data: d,
              end: true,
            } as WorkerMsgBody);
            process.exit(0);
          });
        });
      }
      break;
    case 'jest':
      if (config.jestConfig) {
        import('../jest-check').then(({ JestCheck }) => {
          config.jestConfig.checkOnInit = false;
          config.jestConfig.mode = 'current';

          const jestCheck = new JestCheck(config.jestConfig);
          jestCheck.start().then(d => {
            process.send({
              type: 'jest',
              data: d,
              end: true,
            } as WorkerMsgBody);
            process.exit(0);
          });
        });
      }
      break;
    case 'jira':
      console.log('TODO: jira');
      break;
    default:
      console.log('TODO');
  }
});
