/*
 * @Author: lzw
 * @Date: 2021-08-25 13:31:22
 * @LastEditors: lzw
 * @LastEditTime: 2021-09-25 18:30:12
 * @Description: fork 子进程的具体调用逻辑实现
 */

import type { CreateThreadOptions, WorkerMsgBody } from './fork';

process.on('message', (config: CreateThreadOptions) => {
  if (config.debug) console.log('ForkWorker received:', config);

  if (config.type === 'tscheck' && config.tsCheckConfig) {
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
  } else if (config.type === 'eslint' && config.eslintConfig) {
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
  } else if (config.type === 'jest' && config.jestConfig) {
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

    // console.log('TODO');
    // // config.jestConfig.mode = 'current';
    // process.send({
    //   type: 'jest',
    //   data: { msg: 'todo' },
    //   end: true,
    // } as WorkerMsgBody);
    // process.exit(0);
  }
});
