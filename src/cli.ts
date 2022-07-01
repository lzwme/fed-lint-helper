/*
 * @Author: lzw
 * @Date: 2021-09-25 15:45:24
 * @LastEditors: lzw
 * @LastEditTime: 2022-07-01 15:00:53
 * @Description: cli 工具
 */
import { Option, program } from 'commander';
import { color } from 'console-log-colors';
import path from 'path';
import fs from 'fs';
import type { FlhConfig, TsCheckConfig, JiraCheckConfig, CommitLintOptions } from './config';
import { getHeadDiffFileList, formatWxWorkKeys } from './utils';
import { getConfig, config, mergeCommConfig } from './config';
import { rmdir } from './rmdir';
import { getLogger } from './utils';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const packageInfo = require('../../package.json');
const logger = getLogger();

interface POptions
  extends Pick<TsCheckConfig, 'toWhiteList'>,
    Pick<JiraCheckConfig, 'jiraHome' | 'projectName'>,
    Pick<
      FlhConfig,
      'configPath' | 'debug' | 'silent' | 'printDetail' | 'cache' | 'removeCache' | 'exitOnError' | 'src' | 'mode' | 'fix' | 'wxWorkKeys'
    > {
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
  .version(packageInfo.version, '-v, --version')
  .description(color.cyanBright(packageInfo.description))
  .option('-c, --config-path <filepath>', `配置文件 ${color.yellow('.flh.config.js')} 的路径`)
  .option('--silent', `开启静默模式。`)
  .option('--debug', `开启调试模式。`)
  .addOption(new Option('--mode <mode>', `执行模式。`).choices(['current', 'proc', 'thread']))
  .option('--no-print-detail', `不打印异常详情。`)
  .option('--src <src...>', `指定要检测的源码目录。默认为 src`)
  .option('--only-changes', `只检测 git 仓库变更的文件`, false)
  .option('--cache', `开启缓存模式。`)
  .option('--no-cache', `禁用缓存模式。`)
  .option('--remove-cache', `移除已存在的缓存。`)
  .option('--no-exit-on-error', `检测到异常时，不以非 0 值立即退出。`)
  .option('--toWhiteList', `是否将检测到异常的文件输出到白名单文件列表中。`, false)
  .option('--fix', `是否修正可自动修正的异常。如 eslint --fix 等`)
  .option('--wx-work-keys <key...>', '发送至企业微信机器人，需指定 webhook key 的值，可指定多个机器人')
  .option('--tscheck', `执行 TypeScript Diagnostics check`)
  .option('--eslint', `执行 eslint 检查`)
  .option('--commitlint [verifyReg]', `执行 commitlint 检查`)
  .option('--commit-edit', `指定 git commit msg 的文件路径。默认为 ${color.yellowBright('./.git/COMMIT_EDITMSG')}`)
  .option('--jira', `执行 jira 检查`)
  .option('--jira-home', `指定 jira 首页 url 地址`)
  .addOption(new Option('--jira-type <type>', `执行 jira 检查的类型。可选值：`).choices(['commit', 'pipeline']))
  .option('--projectName', `指定 git 仓库项目名（用于 jira check）`)
  .option('--jest', `执行 jest 单元测试`)
  .action(() => {
    const options = getProgramOptions();
    const config: FlhConfig = {
      exitOnError: options.exitOnError !== false,
      checkOnInit: false,
      silent: !options.debug && options.silent,
      printDetail: options.printDetail !== false,
      mode: options.mode || 'proc',
      tscheck: {
        toWhiteList: options.toWhiteList,
        mode: options.mode || 'proc',
      },
      eslint: {
        // tsConfigFileName: 'tsconfig.eslint.json',
        toWhiteList: options.toWhiteList,
      },
      jest: {
        mode: options.mode || 'proc',
      },
      jira: {
        type: options.jiraType === 'pipeline' ? 'pipeline' : 'commit',
        mode: options.mode || 'current',
      },
    };

    if (options.jiraHome) config.jira.jiraHome = options.jiraHome;
    if (options.projectName) config.jira.projectName = options.projectName;
    if (options.commitEdit) config.jira.COMMIT_EDITMSG = options.commitEdit;

    for (const key of ['src', 'fix', 'wxWorkKeys', 'debug', 'cache', 'removeCache']) {
      if (options[key] != null) config[key] = options[key];
    }

    const baseConfig = getConfig(mergeCommConfig(config, false));
    let hasAction = false;
    const changeFiles: string[] = options.onlyChanges ? getHeadDiffFileList() : null;

    logger.debug(options, baseConfig);
    if (options.onlyChanges) logger.debug('changeFiles:', changeFiles);

    if (options.tscheck) {
      hasAction = true;
      import('./ts-check').then(({ TsCheck }) => {
        const tsCheck = new TsCheck(baseConfig.tscheck);
        tsCheck.start(changeFiles).then(result => logger.debug('tscheck done!', result));
      });
    }

    if (options.eslint) {
      hasAction = true;
      import('./eslint-check').then(({ ESLintCheck }) => {
        const eslintCheck = new ESLintCheck(baseConfig.eslint);
        eslintCheck.start(changeFiles).then(result => logger.debug('eslint done!', result));
      });
    }

    if (options.jest) {
      hasAction = true;
      import('./jest-check').then(({ JestCheck }) => {
        const jestCheck = new JestCheck(baseConfig.jest);
        jestCheck.start(changeFiles).then(result => logger.debug('jestCheck done!', result));
      });
    }

    if (options.jira) {
      hasAction = true;
      import('./jira-check').then(({ JiraCheck }) => {
        const jestCheck = new JiraCheck(baseConfig.jira);
        jestCheck.start().then(result => logger.debug('jestCheck done!', result));
      });
    }

    if (options.commitlint) {
      hasAction = true;
      import('./commit-lint').then(({ commitMessageVerify }) => {
        const cmvOptions: CommitLintOptions = { msgPath: options.commitEdit, exitOnError: options.exitOnError };
        if (typeof options.commitlint === 'string') cmvOptions.verify = options.commitlint;
        commitMessageVerify(cmvOptions);
      });
    }

    if (!hasAction) program.help();
  });

program
  .command('init')
  .description('执行初始化操作')
  .option('--config', '在当前目录下生成默认的配置文件')
  .option('--force', '是否强制执行(配置文件已存在，则覆盖生成)')
  .action((options, destination) => {
    if (!options.config) return destination.help();

    if (options.config) {
      if (fs.existsSync(config.configPath) && !options.force) {
        return logger.log(color.yellowBright(`当前目录下已存在配置文件：`), color.cyan(config.configPath));
      }

      const tpl = path.resolve(__dirname, '../../.flh.config.sample.js');
      const cfgInfo = fs.readFileSync(tpl, 'utf8').replace(`import('./src/config')`, `import('${packageInfo.name}')`);
      fs.writeFileSync(config.configPath, cfgInfo, 'utf8');
      logger.log(`已在当前目录下生成配置文件：`, color.cyan(config.configPath));
    }
  });

program
  .command('rm <filepath...>')
  .description('[utils]删除指定的文件或目录， 跨平台的 rm 命令简化版')
  .option('-s, --silent', '是否静默执行', false)
  .option('-f, --force', '是否强制执行', false)
  .action((list: string[], options) => {
    getProgramOptions();
    rmdir(list, options.silent, options.force);
  });

program
  .command('notify <message>')
  .description('[utils]发送消息通知（当前仅支持企业微信机器人通知）')
  .option('--wx-work-keys <key...>', '发送至企业微信机器人，需指定 webhook key 的值，可指定多个机器人')
  .action((message: string, options) => {
    const programOptions = getProgramOptions();
    logger.debug(message, options, programOptions);
    if (options.wxWorkKeys) {
      options.wxWorkKeys = formatWxWorkKeys(options.wxWorkKeys);
      if (options.wxWorkKeys.length === 0) {
        logger.log('企业微信机器人 webhook 格式不正确');
        process.exit(-1);
      } else {
        import('./lib/WXWork').then(({ wxWorkNotify }) => {
          wxWorkNotify(message, options.wxWorkKeys, programOptions.debug).then(list => {
            if (list.some(d => d.errcode !== 200)) process.exit(-1);
          });
        });
      }
    }
  });

program
  .command('pmcheck [packageManagerName]')
  .description(
    `[utils]用于包管理工具约束，可配置为 ${color.greenBright('scripts.preinstall')} 命令。\n\t 例如，限制只可使用 pnpm: ${color.green(
      `"preinstall": "npx @lzwme/fed-lint-helper pmcheck pnpm"`
    )}`
  )
  .action((pmName: string) => {
    const programOptions = getProgramOptions();
    if (!pmName) {
      const baseConfig = getConfig({}, false);
      pmName = baseConfig.pmcheck;
    }
    import('./pm-check').then(({ packageManagerCheck }) => packageManagerCheck(pmName, programOptions.debug));
  });

program.parse(process.argv);

function getProgramOptions() {
  const options = program.opts<POptions>();

  if (options.debug) logger.updateOptions({ levelType: 'debug' });

  return options;
}
