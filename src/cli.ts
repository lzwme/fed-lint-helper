/*
 * @Author: lzw
 * @Date: 2021-09-25 15:45:24
 * @LastEditors: lzw
 * @LastEditTime: 2021-10-26 21:59:45
 * @Description: cli 工具
 */
import { program } from 'commander';
import { color } from 'console-log-colors';
import { getConfig, FlhConfig, TsCheckConfig, config } from './config';
import path from 'path';
import fs from 'fs';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pkg = require('../../package.json');

interface POptions
  extends Pick<FlhConfig, 'configPath' | 'debug' | 'silent' | 'printDetail' | 'cache' | 'removeCache' | 'exitOnError' | 'src'>,
    Pick<TsCheckConfig, 'toWhiteList'> {
  tscheck?: boolean;
  eslint?: boolean;
  jest?: boolean;
}

program
  // .aliases(['flh'])
  .version(pkg.version, '-v, --version')
  .description(color.cyanBright(pkg.description))
  .option('-c, --config-path <filepath>', `配置文件 ${color.yellow('.flh.config.js')} 的路径`)
  .option('--silent', `开启静默模式。`, false)
  .option('--debug', `开启调试模式。`, false)
  .option('--no-print-detail', `不打印异常详情。`, false)
  .option('--src <src...>', `指定要检测的源码目录。默认为 src`)
  .option('--cache', `开启缓存。默认为 true`)
  .option('--remove-cache', `移除已存在的缓存。`)
  .option('--no-exit-on-error', `检测到异常时，不以非 0 值立即退出。`, false)
  .option('--toWhiteList', `是否将检测到异常的文件输出到白名单文件列表中。`, false)
  .option('--tscheck', `执行 TypeScript Diagnostics check`)
  .option('--eslint', `执行 eslint`)
  .option('--jest', `执行 jest 单元测试`)
  .action((opts: POptions) => {
    const baseConfig = getConfig({
      exitOnError: opts.exitOnError,
      src: Array.isArray(opts.src) ? opts.src : [opts.src || 'src'],
      cache: opts.cache,
      removeCache: opts.removeCache,
      checkOnInit: false,
      silent: !opts.debug && opts.silent,
      debug: opts.debug,
      printDetail: opts.printDetail,
      tscheck: {
        toWhiteList: opts.toWhiteList,
        mode: 'proc',
      },
      eslint: {
        // tsConfigFileName: 'tsconfig.eslint.json',
        toWhiteList: opts.toWhiteList,
      },
      jest: {
        // mode: 'proc',
      },
    });
    let hasAction = false;

    if (opts.debug) console.log(opts, baseConfig);

    if (opts.tscheck) {
      hasAction = true;
      import('./ts-check').then(({ TsCheck }) => {
        const tsCheck = new TsCheck(baseConfig.tscheck);
        tsCheck.start().then(res => opts.debug && console.log('tscheck done!', res));
      });
    }

    if (opts.eslint) {
      hasAction = true;
      import('./eslint-check').then(({ ESLintCheck }) => {
        const eslintCheck = new ESLintCheck(baseConfig.eslint);
        eslintCheck.start().then(res => opts.debug && console.log('eslint done!', res));
      });
    }

    if (opts.jest) {
      hasAction = true;
      import('./jest-check').then(({ JestCheck }) => {
        const jestCheck = new JestCheck(baseConfig.jest);
        jestCheck.start().then(res => opts.debug && console.log('jestCheck done!', res));
      });
    }

    if (!hasAction) program.help();
  });

program
  .command('init')
  .description('执行初始化操作')
  .option('--config', '在当前目录下生成默认的配置文件')
  .option('--force', '是否强制执行(配置文件已存在，则覆盖生成)')
  .action((opts, destination) => {
    if (!opts.config) {
      return destination.help();
    }

    if (opts.config) {
      if (fs.existsSync(config.configPath) && !opts.force) {
        return console.log(color.yellowBright(`当前目录下已存在配置文件：`), color.cyan(config.configPath));
      }

      const tpl = path.resolve(__dirname, '../../.flh.config.sample.js');
      const cfgInfo = fs.readFileSync(tpl, 'utf8').replace(`import('./')`, `import('${pkg.name}')`);
      fs.writeFileSync(config.configPath, cfgInfo, 'utf8');
      console.log(`已在当前目录下生成配置文件：`, color.cyan(config.configPath));
    }
  });

program.parse(process.argv);
