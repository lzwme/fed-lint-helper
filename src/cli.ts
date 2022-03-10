/*
 * @Author: lzw
 * @Date: 2021-09-25 15:45:24
 * @LastEditors: lzw
 * @LastEditTime: 2022-03-10 17:16:29
 * @Description: cli 工具
 */
import { Option, program } from 'commander';
import { color } from 'console-log-colors';
import path from 'path';
import fs from 'fs';
import { getHeadDiffFileList } from './utils';
import { getConfig, config, mergeCommConfig } from './config';
import type { FlhConfig, TsCheckConfig, JiraCheckConfig, CommitLintOptions } from './config';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pkg = require('../../package.json');

interface POptions
  extends Pick<TsCheckConfig, 'toWhiteList'>,
    Pick<JiraCheckConfig, 'jiraHome' | 'projectName'>,
    Pick<FlhConfig, 'configPath' | 'debug' | 'silent' | 'printDetail' | 'cache' | 'removeCache' | 'exitOnError' | 'src' | 'mode'> {
  /** 是否仅检测 git 变化的文件 */
  onlyChanges?: boolean;
  /** 是否执行 tscheck */
  tscheck?: boolean;
  /** 是否执行 eslint */
  eslint?: boolean;
  /** 是否执行 jest */
  jest?: boolean;
  /** 是否执行 jira check */
  jira?: boolean;
  /** 是否执行 commitlint */
  commitlint?: boolean | string;
  /** 执行 jira check 的类型 */
  jiraType?: FlhConfig['jira']['type'];
  commitEdit?: FlhConfig['jira']['COMMIT_EDITMSG'];
}

program
  // .aliases(['flh'])
  .version(pkg.version, '-v, --version')
  .description(color.cyanBright(pkg.description))
  .option('-c, --config-path <filepath>', `配置文件 ${color.yellow('.flh.config.js')} 的路径`)
  .option('--silent', `开启静默模式。`, false)
  .option('--debug', `开启调试模式。`, false)
  .addOption(new Option('--mode <mode>', `执行模式。`).choices(['current', 'proc', 'thread']))
  .option('--no-print-detail', `不打印异常详情。`)
  .option('--src <src...>', `指定要检测的源码目录。默认为 src`)
  .option('--only-changes', `只检测 git 仓库变更的文件`, false)
  .option('--cache', `开启缓存模式。`, false)
  .option('--remove-cache', `移除已存在的缓存。`)
  .option('--no-exit-on-error', `检测到异常时，不以非 0 值立即退出。`)
  .option('--toWhiteList', `是否将检测到异常的文件输出到白名单文件列表中。`, false)
  .option('--tscheck', `执行 TypeScript Diagnostics check`)
  .option('--eslint', `执行 eslint 检查`)
  .option('--commitlint [verifyReg]', `执行 commitlint 检查`)
  .option('--jira', `执行 jira 检查`)
  .option('--jira-home', `指定 jira 首页 url 地址`)
  .option('--projectName', `指定 git 仓库项目名`)
  .option('--commit-edit', `指定 git commit msg 的文件路径。默认为 ${color.yellowBright('./.git/COMMIT_EDITMSG')}`)
  .addOption(new Option('--jira-type <type>', `执行 jira 检查的类型。可选值：`).choices(['commit', 'pipeline']))
  .option('--jest', `执行 jest 单元测试`)
  .action((opts: POptions) => {
    const options: FlhConfig = {
      exitOnError: opts.exitOnError !== false,
      cache: !!opts.cache,
      removeCache: opts.removeCache,
      checkOnInit: false,
      silent: !opts.debug && opts.silent,
      debug: opts.debug,
      printDetail: opts.printDetail !== false,
      mode: opts.mode || 'proc',
      tscheck: {
        toWhiteList: opts.toWhiteList,
        mode: opts.mode || 'proc',
      },
      eslint: {
        // tsConfigFileName: 'tsconfig.eslint.json',
        toWhiteList: opts.toWhiteList,
      },
      jest: {
        mode: opts.mode || 'proc',
      },
      jira: {
        type: opts.jiraType === 'pipeline' ? 'pipeline' : 'commit',
        mode: opts.mode || 'current',
      },
    };

    if (opts.src) options.src = Array.isArray(opts.src) ? opts.src : [opts.src];
    if (opts.jiraHome) options.jira.jiraHome = opts.jiraHome;
    if (opts.projectName) options.jira.projectName = opts.projectName;
    if (opts.commitEdit) options.jira.COMMIT_EDITMSG = opts.commitEdit;

    let changeFiles: string[] = null;
    if (opts.onlyChanges) {
      changeFiles = getHeadDiffFileList();
      if (opts.debug) console.log('changeFiles:', changeFiles);
    }

    const baseConfig = getConfig(mergeCommConfig(options, false));
    let hasAction = false;

    if (opts.debug) console.log(opts, baseConfig);

    if (opts.tscheck) {
      hasAction = true;
      import('./ts-check').then(({ TsCheck }) => {
        const tsCheck = new TsCheck(baseConfig.tscheck);
        tsCheck.start(changeFiles).then(res => opts.debug && console.log('tscheck done!', res));
      });
    }

    if (opts.eslint) {
      hasAction = true;
      import('./eslint-check').then(({ ESLintCheck }) => {
        const eslintCheck = new ESLintCheck(baseConfig.eslint);
        eslintCheck.start(changeFiles).then(res => opts.debug && console.log('eslint done!', res));
      });
    }

    if (opts.jest) {
      hasAction = true;
      import('./jest-check').then(({ JestCheck }) => {
        const jestCheck = new JestCheck(baseConfig.jest);
        jestCheck.start(changeFiles).then(res => opts.debug && console.log('jestCheck done!', res));
      });
    }

    if (opts.jira) {
      hasAction = true;
      import('./jira-check').then(({ JiraCheck }) => {
        const jestCheck = new JiraCheck(baseConfig.jira);
        jestCheck.start().then(res => opts.debug && console.log('jestCheck done!', res));
      });
    }

    if (opts.commitlint) {
      hasAction = true;
      import('./commit-lint').then(({ commitMsgVerify }) => {
        const cmvOpts: CommitLintOptions = { msgPath: opts.commitEdit, exitOnError: opts.exitOnError };
        if (typeof opts.commitlint === 'string') cmvOpts.verify = opts.commitlint;
        commitMsgVerify(cmvOpts);
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
    if (!opts.config) return destination.help();

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
