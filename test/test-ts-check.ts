/*
 * @Author: lzw
 * @Date: 2021-08-18 10:33:52
 * @LastEditors: lzw
 * @LastEditTime: 2021-08-18 14:08:09
 * @Description:
 */

import { TsCheck } from '../src/ts-check';

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
let res = tsCheck.start();
console.log(res);

res = tsCheck.start(['test-cases/ts-check-test-1.ts', 'src/ts-check.ts']);
console.log(res);
