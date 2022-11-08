/*
 * @Author: lzw
 * @Date: 2021-09-25 15:45:24
 * @LastEditors: lzw
 * @LastEditTime: 2022-11-08 09:20:27
 * @Description: cli 工具
 */
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { Option, program } from 'commander';
import { color } from 'console-log-colors';
import { getHeadDiffFileList } from '@lzwme/fe-utils';
import { FlhConfig, TsCheckConfig, JiraCheckConfig, CommitLintOptions, LintTypes } from './types';
import { formatWxWorkKeys } from './utils';
import { commConfig, getConfig, mergeCommConfig } from './config';
import { rmdir } from './rmdir';
import { getLogger } from './utils';
import { lintStartAsync } from './worker/lintStartAsync';
import { flhInit } from './init';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const packageInfo = require('../package.json');
const logger = getLogger();

interface POptions
  extends Pick<TsCheckConfig, 'toWhiteList'>,
    Pick<JiraCheckConfig, 'jiraHome' | 'projectName'>,
    Pick<
      FlhConfig,
      | 'cache'
      | 'ci'
      | 'configPath'
      | 'debug'
      | 'exitOnError'
      | 'fix'
      | 'mode'
      | 'printDetail'
      | 'removeCache'
      | 'silent'
      | 'src'
      | 'wxWorkKeys'
    > {
  /** 是否仅检测 git 变化的文件 */
  onlyChanges?: boolean;
  /** 是否执行 tscheck */
  tscheck?: boolean;
  /** 是否执行 eslint */
  eslint?: boolean;
  /** 是否执行 jest */
  jest?: boolean;
  useJestCli?: boolean | string;
  prettier?: boolean;
  usePrettierCli?: boolean | string;
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
  .option('--ci', `Whether to run task in continuous integration (CI) mode.`)
  .addOption(new Option('-m, --mode <mode>', `执行模式。`).choices(['current', 'proc', 'thread']))
  .option('--no-print-detail', `不打印异常详情。`)
  .option('--src <src...>', `指定要检测的源码目录。默认为 src`)
  .option('--only-changes', `只检测 git 仓库变更的文件`, false)
  .option('--cache', `开启缓存模式。`)
  .option('--no-cache', `禁用缓存模式。`)
  .option('--remove-cache', `移除已存在的缓存。`)
  .option('--no-exit-on-error', `检测到异常时，不以非 0 值立即退出。`)
  .option('--toWhiteList', `是否将检测到异常的文件输出到白名单文件列表中。`, false)
  .option('--fix', `是否修正可自动修正的异常。如 eslint --fix 等`)
  .option('--no-fix', `禁用自动修正。`)
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
  .option('--use-jest-cli [value]', `执行单元测试时是否使用 jest-cli 模式。1 是(默认)，0 否`)
  .option('--prettier', `执行 prettier 编码风格检查`)
  .option('--use-prettier-cli [value]', `执行代码风格检查时是否使用 prettier cli 模式。1 是，0 否(默认)`)
  .action(() => {
    const options = getProgramOptions();
    const config: FlhConfig = {
      exitOnError: options.exitOnError !== false,
      checkOnInit: false,
      silent: !options.debug && options.silent,
      printDetail: options.printDetail !== false,
      tscheck: {},
      eslint: {},
      jest: {},
      jira: {
        type: options.jiraType === 'pipeline' ? 'pipeline' : 'commit',
      },
      prettier: {},
    };

    const commKeys = ['wxWorkKeys', 'ci', ...(Object.keys(commConfig) as (keyof typeof commConfig)[])] as const;

    for (const key of commKeys) {
      // @ts-ignore
      if (options[key] != null) config[key] = options[key] as never;
    }

    if (options.jiraHome) config.jira.jiraHome = options.jiraHome;
    if (options.projectName) config.jira.projectName = options.projectName;
    if (options.commitEdit) config.jira.COMMIT_EDITMSG = options.commitEdit;
    if ('useJestCli' in options) config.jest.useJestCli = Boolean(+options.useJestCli);
    if ('usePrettierCli' in options) config.prettier.useCli = Boolean(+options.usePrettierCli);
    if ('fix' in options) config.fix = config.eslint.fix = Boolean(options.fix);

    const baseConfig = getConfig(mergeCommConfig(config, false));
    let hasAction = false;
    let changeFiles: string[] = options.onlyChanges ? getHeadDiffFileList(0, baseConfig.rootDir) : null;

    if (changeFiles) {
      changeFiles = changeFiles.filter(d => existsSync(resolve(baseConfig.rootDir, d)));
    }

    logger.debug(options, baseConfig);
    if (options.onlyChanges) logger.debug('changeFiles:', changeFiles);

    for (const type of LintTypes) {
      if (options[type]) {
        hasAction = true;
        if (changeFiles) baseConfig[type].fileList = changeFiles;
        lintStartAsync(type, baseConfig[type], false, result => logger.debug(`lint for ${type} done!`, result));
      }
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
  .option('--force', '是否强制执行(配置文件已存在，则覆盖生成)')
  .action(options => {
    flhInit(options, packageInfo);
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

program
  .command('stats [src...]')
  .alias('s')
  .description(`文件类型数量统计`)
  .option('--root-dir', '指定统计的根目录。默认为当前目录')
  .option('--ext <ext...>', '需统计的文件类型后缀列表')
  .option('--json', '是否输出为 json 格式')
  .option('--json-file <filepath>', '输出为 json 格式时写入文件')
  .option('--show-files', '是否打印文件列表')
  .action((src: string[], options) => {
    import('./stats').then(({ stats }) => {
      const opts = getProgramOptions();
      const config = getConfig({ debug: opts.debug });
      logger.debug(opts, options);
      logger.debug(src);
      if (options.ext) options.extensions = options.ext;
      stats({ src, rootDir: config.rootDir, ...options });
    });
  });

program.parse(process.argv);

function getProgramOptions() {
  const options = program.opts<POptions>();

  if (options.debug) logger.updateOptions({ levelType: 'debug' });

  return options;
}
