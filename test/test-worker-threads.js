/*
 * @Author: lzw
 * @Date: 2021-08-25 15:12:46
 * @LastEditors: lzw
 * @LastEditTime: 2021-08-25 16:45:06
 * @Description: 基于 worker_threads 的子线程功能测试
 */
// @ts-check

const { createWorkerThreads } = require('../build/main/utils/worker-threads');
const argv = process.argv.slice(2).map(d => d.replace('--', ''));

// eslint 插件也使用了 worker_threads，会存在怪异现象
createWorkerThreads({
  type: 'eslint',
  debug: argv.includes('debug'),
  eslintConfig: {
    exitOnError: false,
    mode: 'thread',
    src: ['test'],
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
  console.log('执行结束：', d);
}).catch(err => {
  console.log('worker-threads for eslint err:', err);
});

createWorkerThreads({
  type: 'tscheck',
  debug: argv.includes('debug'),
  tsCheckConfig: {
    rootDir: process.cwd(),
    exitOnError: false,
    mode: 'thread',
    src: ['src'],
    cache: argv.includes('cache'),
    removeCache: argv.includes('nocache'),
    // tsConfigFileName: 'tsconfig.eslint.json',
    checkOnInit: false,
    silent: argv.includes('silent'),
    debug: argv.includes('debug'),
    toWhiteList: true,
  },
}).then(d => {
  console.log('执行结束：', d);
}).catch(err => {
  console.log('worker-threads for eslint err:', err);
});
