import { existsSync } from 'node:fs';
/*
 * @Author: lzw
 * @Date: 2021-09-25 15:45:24
 * @LastEditors: renxia
 * @LastEditTime: 2025-06-03 08:47:54
 * @Description: cli 工具
 */
import { resolve } from 'node:path';
import { assign, getHeadDiffFileList, wxWorkNotify } from '@lzwme/fe-utils';
import { Option, program } from 'commander';
import { cyanBright, green, greenBright, red, yellowBright } from 'console-log-colors';
import { FlhPkgInfo, commConfig, getConfig, mergeCommConfig } from './config.js';
import { rmdir } from './tools/rmdir.js';
import { type AnyObject, type CommitLintOptions, type FlhConfig, LintTypes } from './types';
import type { JiraCheckConfig } from './types/jira';
import { formatWxWorkKeys, getGitStaged, getLogger } from './utils/index.js';
import { lintStartAsync } from './worker/lintStartAsync.js';

const logger = getLogger();

interface POptions
  extends Pick<JiraCheckConfig, 'jiraHome' | 'projectName'>,
    Pick<
      FlhConfig,
      | 'cache'
      | 'ci'
      | 'configPath'
      | 'debug'
      | 'exitOnError'
      | 'fix'
      | 'mode'
      | 'ignoreWhiteList'
      | 'onlyChanges'
      | 'onlyStaged'
      | 'removeCache'
      | 'silent'
      | 'src'
      | 'toWhiteList'
      | 'printDetail'
      | 'wxWorkKeys'
    > {
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
  commitEdit?: FlhConfig['jira']['commitEdit'];
  biome?: boolean;
}

program
  // .aliases(['flh'])
  .version(FlhPkgInfo.version, '-v, --version')
  .description(cyanBright(FlhPkgInfo.description))
  .option('-c, --config-path <filepath>', `配置文件 ${yellowBright('.flh.config.cjs')} 的路径`)
  .option('--silent', `开启静默模式。`)
  .option('--debug', `开启调试模式。`)
  .option('--ci', `Whether to run task in continuous integration (CI) mode.`)
  .addOption(new Option('-m, --mode <mode>', `执行模式。`).choices(['current', 'proc', 'thread']))
  .option('--no-print-detail', `不打印异常详情。`)
  .option('--src <src...>', `指定要检测的源码目录。默认为 src`)
  .option('--only-changes', `只检测 git 仓库变更的文件`, false)
  .option('--only-staged', `只检测 git add 添加到缓冲区中的文件（支持部分提交模式）`, false)
  .option('--cache', `开启缓存模式。`)
  .option('--no-cache', `禁用缓存模式。`)
  .option('--remove-cache', `移除已存在的缓存。`)
  .option('--no-exit-on-error', `检测到异常时，不以非 0 值立即退出。`)
  .option('--toWhiteList', `是否将检测到异常的文件输出到白名单文件列表中。`, false)
  .option('--ignoreWhiteList', `是否忽略白名单。适用于不更新白名单，仅了解所有异常的场景`, false)
  .option('--fix', `是否修正可自动修正的异常。如 eslint --fix 等`)
  .option('--no-fix', `禁用自动修正。`)
  .option('--wx-work-keys <key...>', '发送至企业微信机器人，需指定 webhook key 的值，可指定多个机器人')
  .option('--tscheck', `执行 TypeScript Diagnostics check`)
  .option('--eslint', `执行 eslint 检查`)
  .option('--commitlint [verifyReg|help]', '执行 commitlint 检查。值为 `help` 时仅打印帮助信息，否则为自定义正则验证规则')
  .option(
    '--commit-edit <filepath|N>',
    `指定 git commit msg 的获取方式。可以是：COMMIT_EDITMSG 文件路径、commitId、数字(1-99，表示取最近N条日志全部验证)。默认为 ${yellowBright(
      './.git/COMMIT_EDITMSG'
    )}`
  )
  .option('--jira', `执行 jira 检查`)
  .option('--jira-home', `指定 jira 首页 url 地址`)
  .addOption(new Option('--jira-type <type>', `执行 jira 检查的类型。可选值：`).choices(['commit', 'pipeline']))
  .option('--projectName', `指定 git 仓库项目名（用于 jira check）`)
  .option('--jest', `执行 jest 单元测试`)
  .option('--use-jest-cli [value]', `执行单元测试时是否使用 jest-cli 模式。1 是(默认)，0 否`)
  .option('--prettier', `执行 prettier 编码风格检查`)
  .option('--use-prettier-cli [value]', `执行代码风格检查时是否使用 prettier cli 模式。1 是，0 否(默认)`)
  .option('--biome', '执行 biome 检查')
  .action(() => {
    const options = getProgramOptions();
    const config: FlhConfig = {
      exitOnError: options.exitOnError ?? true,
      checkOnInit: false,
      onlyStaged: options.onlyStaged,
      onlyChanges: options.onlyChanges,
      silent: !options.debug && options.silent,
      printDetail: options.printDetail ?? true,
      tscheck: {},
      eslint: {},
      jest: {},
      jira: {
        type: options.jiraType === 'pipeline' ? 'pipeline' : 'commit',
      },
      prettier: {},
      biome: {},
    };

    const commKeys = ['wxWorkKeys', 'ci', ...(Object.keys(commConfig) as (keyof typeof commConfig)[])] as const;

    for (const key of commKeys) {
      // @ts-ignore
      if (options[key] != null) config[key] = options[key] as never;
    }

    if (options.jiraHome) config.jira.jiraHome = options.jiraHome;
    if (options.projectName) config.jira.projectName = options.projectName;
    if (options.commitEdit) config.jira.commitEdit = options.commitEdit;
    if ('useJestCli' in options) config.jest.useJestCli = Boolean(+options.useJestCli);
    if ('usePrettierCli' in options) config.prettier.useCli = Boolean(+options.usePrettierCli);
    if ('fix' in options) config.fix = config.eslint.fix = Boolean(options.fix);

    const baseConfig = getConfig(mergeCommConfig(config, false));
    let hasAction = false;
    let changeFiles: string[] = options.onlyStaged
      ? getGitStaged(baseConfig.rootDir)
      : options.onlyChanges
        ? getHeadDiffFileList(0, baseConfig.rootDir)
        : null;

    if (changeFiles) {
      changeFiles = changeFiles.filter(d => existsSync(resolve(baseConfig.rootDir, d)));
    }

    logger.debug('argv:', options, '\nflhConfig:', baseConfig);
    if (changeFiles) logger.debug('changeFiles:', changeFiles);

    for (const type of LintTypes) {
      if (options[type]) {
        hasAction = true;
        if (changeFiles) baseConfig[type].fileList = changeFiles;
        lintStartAsync(type, baseConfig[type], false, result => logger.debug(`lint for ${type} done!`, result));
      }
    }

    if (options.commitlint) {
      hasAction = true;
      import('./lint/commit-lint.js').then(({ commitMessageVerify }) => {
        const cmvOptions: CommitLintOptions = { msgPath: options.commitEdit, exitOnError: options.exitOnError };
        if (typeof options.commitlint === 'string') {
          if (options.commitlint === 'help') cmvOptions.help = true;
          else cmvOptions.verify = options.commitlint;
        }
        commitMessageVerify(cmvOptions);
      });
    }

    if (!hasAction) program.help();
  });

program
  .command('init')
  .description('执行 flh、ESLint、Prettier、TypeScript、jest、husky、vscode 等工具的配置初始化')
  .option('--force', '是否强制执行(配置文件已存在，则覆盖生成)')
  .action(options => {
    import('./init/flh-init.js').then(({ flhInit }) => flhInit(options, FlhPkgInfo));
  });

program
  .command('rm <filepath...>')
  .description('[utils]删除指定的文件或目录， 跨平台的 rm 命令简化版')
  .option('-s, --silent', '是否静默执行', false)
  .option('-f, --force', '是否强制执行', false)
  .option('-O, --only-empty', '仅删除空目录', false)
  .option('--show-size', '打印日志时，是否打印文件大小', false)
  .option('--dry-run', '是否仅测试执行，不真实删除文件', false)
  .action((list: string[], options) => {
    getProgramOptions();
    rmdir(list, options);
  });

program
  .command('notify <message>')
  .description('[utils]发送消息通知（当前仅支持企业微信机器人通知）')
  .option('--wx-work-keys <key...>', '发送至企业微信机器人，需指定 webhook key 的值，可指定多个机器人')
  .action((message: string, options) => {
    options = getProgramOptions(options);
    if (!options.wxWorkKeys && process.env.WX_WORK_KEYS) options.wxWorkKeys = process.env.WX_WORK_KEYS.split(',');
    logger.debug(message, options);
    if (options.wxWorkKeys) {
      options.wxWorkKeys = formatWxWorkKeys(options.wxWorkKeys);
      if (options.wxWorkKeys.length === 0) {
        logger.log('企业微信机器人 webhook 格式不正确');
        process.exit(-1);
      } else {
        wxWorkNotify(message, options.wxWorkKeys, options.debug).then(list => {
          logger.info(
            list
              .map((d, i) => `${i + 1}. [${d.errcode}]${d.errcode === 200 ? green(d.errmsg) : red(d.errmsg || JSON.stringify(d))}`)
              .join('\n')
          );
        });
      }
    } else logger.error('请指定 wx-work-keys 参数');
  });

program
  .command('pmcheck [packageManagerName]')
  .description(
    `[utils]用于包管理工具约束，可配置为 ${greenBright('scripts.preinstall')} 命令。\n\t 例如，限制只可使用 pnpm: ${green(
      `"preinstall": "npx @lzwme/fed-lint-helper pmcheck pnpm"`
    )}`
  )
  .action((pmName: string) => {
    const programOptions = getProgramOptions();
    if (!pmName) {
      const baseConfig = getConfig({}, false);
      pmName = baseConfig.pmcheck;
    }
    import('./tools/pm-check.js').then(({ packageManagerCheck }) => packageManagerCheck(pmName, programOptions.debug));
  });

program
  .command('stats [src...]')
  .alias('s')
  .description(`文件类型数量统计`)
  .option('--root-dir', '指定统计的根目录。默认为当前目录')
  .option('--ext <ext...>', '需统计的文件类型后缀列表')
  .option('-e, --exclude <rules...>', '文件排除规则')
  .option('--topN <number>', 'Line/Size Top N 统计的数量')
  .option('--json', '是否输出为 json 格式')
  .option('--json-file <filepath>', '输出为 json 格式时写入文件')
  .option('--show-files', '是否打印文件列表')
  .option('--show-full-path', '打印文件路径时，是否显示为完整路径')
  .option('--show-dup-files', '检测到重复文件时，是否显示重复文件列表')
  .action((src: string[], options) => {
    import('./stats/index.js').then(({ stats }) => {
      const opts = getProgramOptions();
      const config = getConfig({ debug: opts.debug });
      logger.debug(opts, options);
      logger.debug(src);
      if (options.ext) options.extensions = options.ext;
      if (src.length > 0) options.src = src;
      stats({ rootDir: config.rootDir, ...options });
    });
  });

program.parse(process.argv);

function getProgramOptions(opts?: AnyObject) {
  const options = program.opts<POptions>();

  if (opts) assign(options, opts);
  if (options.debug) logger.updateOptions({ levelType: 'debug' });

  return options;
}
