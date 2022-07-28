/*
 * @Author: lzw
 * @Date: 2021-08-25 11:13:47
 * @LastEditors: lzw
 * @LastEditTime: 2022-07-28 09:56:54
 * @Description:  child_process.fork 子线程执行测试
 */

const { createForkThread } = require('../cjs/worker/fork');

const argv = process.argv.slice(2).map(d => d.replace('--', ''));
createForkThread({
  type: 'eslint',
  debug: argv.includes('debug'),
  eslintConfig: {
    rootDir: process.cwd(),
    exitOnError: false,
    src: ['src'],
    // mode: 'proc',
    cache: argv.includes('cache'),
    removeCache: argv.includes('nocache'),
    // tsConfigFileName: 'tsconfig.eslint.json',
    checkOnInit: false,
    silent: argv.includes('silent'),
    debug: argv.includes('debug'),
    toWhiteList: argv.includes('whitelist'),
    allowErrorToWhiteList: true,
    fix: argv.includes('fix'),
    eslintOptions: {
      overrideConfig: {
        rules: { eqeqeq: 'warn' },
      },
    },
  },
}).then(d => {
  console.log('worker 执行结束：', d);
});

createForkThread({
  type: 'tscheck',
  debug: argv.includes('debug'),
  tsCheckConfig: {
    rootDir: process.cwd(),
    exitOnError: false,
    src: ['src'],
    // mode: 'proc',
    cache: argv.includes('cache'),
    removeCache: argv.includes('nocache'),
    // tsConfigFileName: 'tsconfig.eslint.json',
    checkOnInit: false,
    silent: argv.includes('silent'),
    debug: argv.includes('debug'),
    toWhiteList: true,
  },
}).then(d => {
  console.log('worker 执行结束：', d);
});
