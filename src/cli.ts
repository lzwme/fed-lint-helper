/*
 * @Author: lzw
 * @Date: 2021-09-25 15:45:24
 * @LastEditors: lzw
 * @LastEditTime: 2021-09-25 18:24:37
 * @Description: cli 工具
 */
import { program } from 'commander';
import chalk from 'chalk';
import { TsCheck } from './ts-check';
import { ESLintCheck } from './eslint-check';
import { getConfig } from './config';
import { JestCheck } from './jest-check';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pkg = require('../../package.json');

interface POptions {
  debug?: boolean;
  silent?: boolean;
  cache?: boolean;
  removeCache?: boolean;
  ts?: boolean;
  eslint?: boolean;
  jest?: boolean;
}

program
  // .aliases(['flh'])
  .version(pkg.version, '-v, --version')
  .description(chalk.cyanBright(pkg.description))
  // .option('-c, --config-path [filepath]', `配置文件 ${chalk.yellow(config.configPath)} 的路径`)
  .option('--silent', `开启静默模式。`)
  .option('--debug', `开启调试模式。`)
  .option('--ts', `执行 TypeScript Diagnostics check`)
  .option('--eslint', `执行 eslint`)
  .option('--jest', `执行 jest 单元测试`)
  .action((opts: POptions) => {
    if (opts.debug) console.log(opts);

    const baseConfig = getConfig({
      exitOnError: false,
      src: ['src'],
      cache: !!opts.cache,
      removeCache: !!opts.removeCache,
      // tsConfigFileName: 'tsconfig.eslint.json',
      checkOnInit: false,
      silent: opts.silent,
      debug: opts.debug,
      tscheck: {
        toWhiteList: true,
      },
      eslint: {
        // tsConfigFileName: 'tsconfig.eslint.json',
        toWhiteList: true,
      },
      jest: {},
    });

    if (opts.ts) {
      const tsCheck = new TsCheck(baseConfig.tscheck);
      tsCheck.start().then(res => res && console.log('tscheck', res));
    }

    if (opts.eslint) {
      const eslintCheck = new ESLintCheck(baseConfig.eslint);
      eslintCheck.start().then(res => res && console.log('eslintCheck:', res));
    }

    if (opts.jest) {
      const jestCheck = new JestCheck(baseConfig.jest);
      jestCheck.start().then(res => res && console.log('jestCheck:', res));
    }
  });

program.parse(process.argv);
