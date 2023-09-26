// @see https://github.com/umijs/umi-next/blob/master/scripts/verifyCommit.ts

import { assign } from '@lzwme/fe-utils';
import { color } from 'console-log-colors';
import { config } from '../config.js';
import { getLogger } from '../utils/get-logger.js';
import type { CommitLintOptions } from '../types';
import { checkUserEmial, getCommitMsg } from '../utils/index.js';

const helpTipsDefault: Record<string, string> = {
  build: '构建相关',
  ci: '持续集成',
  docs: '文档/注释修改',
  feat: '增加新功能',
  fix: '修复问题',
  perf: '优化/性能提升',
  refactor: '重构。即无bug修复，也无功能新增',
  test: '测试相关',
  // ---
  chore: '依赖更新/脚手架配置修改等',
  dep: '依赖更新',
  example: '示例修改',
  locale: '多语言国际化修改',
  mod: '不确定分类的修改',
  release: '版本发布',
  revert: '撤销修改',
  style: '代码风格相关，但影响运行结果',
  types: '类型修改',
  typos: '微小的错误修复，如错别字更正等',
  wip: '开发中',
  workflow: '工作流改进',
};

export function angularCommitStyleLint(message: string, allowTypes: string[] = Object.keys(helpTipsDefault)) {
  if (shouldIgnoreCommitLint(message)) return true;

  const types = [...new Set([...allowTypes, 'Merge', 'UI'])].join('|');
  return new RegExp(
    `^(((\uD83C[\uDF00-\uDFFF])|(\uD83D[\uDC00-\uDE4F\uDE80-\uDEFF])|[\u2600-\u2B55]) )?(revert: )?(${types})((.+))?: .{1,100}`
  ).test(message);
}

export function commitMessageVerify(options?: CommitLintOptions): boolean | void {
  let isPass = true;
  let helpTips = { ...helpTipsDefault };
  const logger = getLogger('[commitlint]', options.debug ? 'debug' : 'log');

  if (config.userEmailRule) {
    const errmsg = checkUserEmial(config.userEmailRule, false, config.rootDir);
    if (errmsg) {
      logger.error(errmsg);
      isPass = false;
    }
  }

  if (isPass) {
    options = assign({ exitOnError: true, useAngularStyle: true } as CommitLintOptions, config.commitlint, options);

    if (options.allowTypes) {
      if (Array.isArray(options.allowTypes)) {
        options.allowTypes = options.allowTypes.reduce(
          (o, type) => {
            o[type] = helpTips[type] || type;
            return o;
          },
          {} as Record<string, string>
        );
      }

      helpTips = options.allowTypes;
    }

    if (options.customTypes) Object.assign(helpTips, options.customTypes);

    if (options.help) return showHelp(helpTips);

    const message = options.message || getCommitMsg(options.msgPath, config.rootDir).commitMessage;

    if (Array.isArray(message)) {
      return message.every(m => commitMessageVerify({ ...options, message: m }));
    }

    if (!config.silent) logger.info('[msg] =>', color.green(message));
    logger.debug('options =>', options);

    if (options.verify) {
      if (typeof options.verify === 'function') {
        const result = options.verify(message);
        isPass = result === true;
        if (!isPass) logger.error(`Failed by options.verify.`, result);
      } else {
        isPass = new RegExp(options.verify).test(message);
        if (!isPass) logger.error(`Failed by options.verify:`, color.magentaBright(options.verify));
      }
    } else {
      options.useAngularStyle = true;
    }

    if (isPass && options.useAngularStyle && !angularCommitStyleLint(message, Object.keys(helpTips))) {
      isPass = false;
      logger.error(color.red(`提交日志不符合规范。\n`));
      showHelp(helpTips);
    }
  }

  if (!isPass && options.exitOnError !== false) process.exit(1);
  if (!config.silent) logger.info('Passed!');

  return isPass;
}

export function shouldIgnoreCommitLint(msg: string) {
  /**
   * {@see https://github.com/conventional-changelog/commitlint/blob/master/%40commitlint/is-ignored/src/defaults.ts | 忽略规则参考}
   */
  const ignoredCommitList = [
    /^((Merge pull request)|(Merge (.*?) into (.*?)|(Merge branch (.*?)))(?:\r?\n)*$)/m,
    /^(R|r)evert (.*)/,
    /^(fixup|squash)!/,
    /^(Merged (.*?)(in|into) (.*)|Merged PR (.*): (.*))/,
    /^Merge remote-tracking branch (.*)/,
    /^Automatic merge(.*)/,
    /^Auto-merged (.*?) into (.*)/,
  ];
  return ignoredCommitList.some(r => r.test(msg));
}

function showHelp(helpTips = helpTipsDefault) {
  /* eslint-disable no-console */
  console.log(
    [
      // color.red(`Invalid commit message format.\n`),
      // color.red(`  Proper commit message format is required for automated changelog generation. Examples:\n`),
      color.magentaBright(`  合法的提交日志格式如下(emoji 和 scope 可选填)：\n`),
      color.greenBright(`  [(emoji)?] [revert: ?]<type>[(scope)?]: <message>\n`),
      color.green(`    💥 feat(compiler): add 'comments' option`),
      color.green(`    🐛 fix(v-model): handle events on blur (close #28)\n\n`),
      color.cyanBright(`  [type] 详细参考：\n`),
      ...Object.entries(helpTips).map(([key, val]) => `    ${color.green(`${key}: ${val}`)}`),
    ].join('\n')
  );
}

// if (require.main === module) commitMessageVerify({ help: process.argv.slice(2).includes('-h') });
