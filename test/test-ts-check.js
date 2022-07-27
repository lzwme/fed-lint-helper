/*
 * @Author: lzw
 * @Date: 2021-08-18 10:33:52
 * @LastEditors: lzw
 * @LastEditTime: 2022-07-27 15:42:20
 * @Description:
 */

const { TsCheck } = require('../build/main/ts-check');

const argv = process.argv.slice(2).map(d => d.replace('--', ''));

const tsCheck = new TsCheck({
  exitOnError: false,
  src: ['src'],
  cache: argv.includes('cache'),
  removeCache: argv.includes('nocache'),
  // tsConfigFileName: 'tsconfig.eslint.json',
  checkOnInit: false,
  silent: argv.includes('silent'),
  debug: argv.includes('debug'),
  toWhiteList: true,
});

await tsCheck.start().then(res => res && console.log(res));

tsCheck
  .start(['test-cases/ts-check-test-1.ts', 'src/ts-check.ts'])
  .then(res => res && console.log(res));
