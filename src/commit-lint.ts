// @see https://github.com/umijs/umi-next/blob/master/scripts/verifyCommit.ts

import { readFileSync } from 'node:fs';
import { color } from 'console-log-colors';
import { config } from './config';
import { getLogger } from './utils/get-logger';
import type { CommitLintOptions } from './types';
import { checkUserEmial } from './utils';

const helpTips = {
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

export function commitMessageVerify(options?: CommitLintOptions) {
  let isPass = true;
  const logger = getLogger('[commitlint]', options.debug ? 'debug' : 'log');

  if (config.userEmailRule) {
    const errmsg = checkUserEmial(config.userEmailRule, false, config.rootDir);
    if (errmsg) {
      logger.error(errmsg);
      isPass = false;
    }
  }

  if (isPass) {
    options = Object.assign({ exitOnError: true, useAngularStyle: true } as CommitLintOptions, config.commitlint, options);
    if (!options.msgPath) options.msgPath = process.env.GIT_PARAMS || process.env.COMMIT_EDITMSG || './.git/COMMIT_EDITMSG';

    const message = readFileSync(options.msgPath, 'utf8').trim();

    if (!config.silent) logger.info('[msg] =>', message);
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

    const types = [...new Set([...Object.keys(helpTips), 'Merge', 'UI'])].join('|');

    const commitRE = new RegExp(
      `^(((\uD83C[\uDF00-\uDFFF])|(\uD83D[\uDC00-\uDE4F\uDE80-\uDEFF])|[\u2600-\u2B55]) )?(revert: )?(${types})((.+))?: .{1,100}`
    );

    if (isPass && options.useAngularStyle && !commitRE.test(message)) {
      isPass = false;
      logger.error(
        [
          // color.red(`Invalid commit message format.\n`),
          // color.red(`  Proper commit message format is required for automated changelog generation. Examples:\n`),
          color.red(`提交日志不符合规范。\n`),
          color.magentaBright(`  合法的提交日志格式如下(emoji 和 scope 可选填)：\n`),
          color.green(`  [(emoji)?] [revert: ?]<type>[(scope)?]: <message>\n`),
          color.green(`    💥 feat(compiler): add 'comments' option`),
          color.green(`    🐛 fix(v-model): handle events on blur (close #28)\n\n`),
          color.cyanBright(`  [type] 详细参考：\n`),
          ...Object.entries(helpTips).map(([key, val]) => `    ${color.green(`${key}: ${val}`)}`),
        ].join('\n')
      );
    }
  }

  if (!isPass && options.exitOnError !== false) process.exit(1);
  if (!config.silent) logger.info('Passed!');

  return isPass;
}

if (require.main === module) commitMessageVerify({ msgPath: process.argv.slice(2)[0] });
