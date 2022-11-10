/*
 * @Author: lzw
 * @Date: 2021-08-18 10:33:52
 * @LastEditors: lzw
 * @LastEditTime: 2022-07-28 09:50:28
 * @Description: eslint 测试
 */
// @ts-check

const { ESLintCheck } = require('../cjs/eslint-check');

const argv = process.argv.slice(2).map(d => d.replace('--', ''));

const eslintCheck = new ESLintCheck({
  exitOnError: false,
  src: ['src'],
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
});

eslintCheck
  .start()
  .then(res => res && console.log('eslint test1:', res))
  .then(() => {
    eslintCheck.parseConfig({ mode: 'current' });
    return eslintCheck.start(['test/test-cases/ts-check-test-1.ts', 'src/ts-check.ts']).then(res => console.log('eslint test2:', res));
  })
  .catch(err => console.log('failed!', err));
