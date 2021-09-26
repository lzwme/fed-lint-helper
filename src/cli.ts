/*
 * @Author: lzw
 * @Date: 2021-09-25 15:45:24
 * @LastEditors: lzw
 * @LastEditTime: 2021-09-25 18:24:37
 * @Description: cli 工具
 */
import { program } from 'commander';
import chalk from 'chalk';
import { getConfig, IConfig } from './config';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pkg = require('../../package.json');

interface POptions extends Pick<IConfig, 'configPath' | 'debug' | 'silent' | 'cache' | 'removeCache' | 'exitOnError' | 'src'> {
  tscheck?: boolean;
  eslint?: boolean;
  jest?: boolean;
}

program
  // .aliases(['flh'])
  .version(pkg.version, '-v, --version')
  .description(chalk.cyanBright(pkg.description))
  .option('-c, --config-path <filepath>', `配置文件 ${chalk.yellow('.flh.config.js')} 的路径`)
  .option('--silent', `开启静默模式。`)
  .option('--debug', `开启调试模式。`)
  .option('--src <src...>', `指定要检测的源码目录。默认为 src`)
  .option('--cache', `开启缓存。默认为 true`)
  .option('--remove-cache', `移除已存在的缓存。`)
  .option('--exit-on-error', `检测到异常时，是否以非 0 值立即退出。`, true)
  .option('--tscheck', `执行 TypeScript Diagnostics check`)
  .option('--eslint', `执行 eslint`)
  .option('--jest', `执行 jest 单元测试`)
  .action((opts: POptions) => {
    const baseConfig = getConfig({
      exitOnError: opts.exitOnError,
      src: Array.isArray(opts.src) ? opts.src : [opts.src || 'src'],
      cache: opts.cache,
      removeCache: opts.removeCache,
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
      jest: {
        mode: 'current',
      },
    });

    if (opts.debug) console.log(opts, baseConfig);

    if (opts.tscheck) {
      import('./ts-check').then(({ TsCheck }) => {
        const tsCheck = new TsCheck(baseConfig.tscheck);
        tsCheck.start().then(res => console.log('tscheck done!', res));
      });
    }

    if (opts.eslint) {
      import('./eslint-check').then(({ ESLintCheck }) => {
        const eslintCheck = new ESLintCheck(baseConfig.eslint);
        eslintCheck.start().then(res => console.log('eslint done!', res));
      });
    }

    if (opts.jest) {
      import('./jest-check').then(({ JestCheck }) => {
        const jestCheck = new JestCheck(baseConfig.jest);
        jestCheck.start().then(res => console.log('jestCheck done!', res));
      });
    }
  });

program.parse(process.argv);
