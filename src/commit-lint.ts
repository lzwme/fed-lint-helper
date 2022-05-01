// @see https://github.com/umijs/umi-next/blob/master/scripts/verifyCommit.ts

import { readFileSync } from 'fs';
import { color } from 'console-log-colors';
import { config, CommitLintOptions } from './config';
import { getLogger } from './utils/get-logger';

export function commitMessageVerify(options?: CommitLintOptions) {
  let isPass = true;
  const commitRE = /^(revert: )?(feat|fix|docs|style|refactor|perf|test|workflow|build|ci|chore|types|wip|release|dep)(\(.+\))?: .{1,50}/;

  options = Object.assign({ exitOnError: true, useAngularStyle: true } as CommitLintOptions, config.commitlint, options);

  if (!options.msgPath) options.msgPath = process.env.GIT_PARAMS || process.env.COMMIT_EDITMSG || './.git/COMMIT_EDITMSG';
  const message = readFileSync(options.msgPath, 'utf8').trim();
  const logger = getLogger('[commitlint]', config.debug ? 'debug' : 'log');

  if (!config.silent) logger.info('[msg] =>', message);
  logger.debug('options =>', options);

  if (options.verify) {
    if (typeof options.verify === 'function') {
      const result = options.verify(message);
      isPass = result === true;
      if (!isPass) logger.error(`Failed by options.verify.`, result);
    } else if (typeof options.verify === 'string') {
      isPass = new RegExp(options.verify).test(message);
      if (!isPass) logger.error(`Failed by options.verify:`, color.magentaBright(options.verify));
    }
  } else {
    options.useAngularStyle = true;
  }

  if (isPass && options.useAngularStyle && !commitRE.test(message)) {
    isPass = false;
    // console.log();
    logger.error(
      [
        ` ${color.red(`Invalid commit message format.`)}\n`,
        color.red(`  Proper commit message format is required for automated changelog generation. Examples:\n`),
        `    ${color.green(`feat(compiler): add 'comments' option`)}`,
        `    ${color.green(`fix(v-model): handle events on blur (close #28)`)}\n`,
        // color.red(`  See .github/commit-convention.md for more details.`),
      ].join('\n')
    );
  }

  if (!isPass && options.exitOnError !== false) process.exit(1);
  if (!config.silent) logger.info('Passed!');

  return isPass;
}

if (require.main === module) commitMessageVerify({ msgPath: process.argv.slice(2)[0] });
