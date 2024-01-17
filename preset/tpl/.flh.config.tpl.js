const env = process.env;
const isCI = (env.CI_MERGE_REQUEST_ID || env.GITLAB_CI || env.CI) != null || process.argv.slice(2).includes('--ci');
const isMR = isCI && /merge_request/i.test(env.CI_PIPELINE_SOURCE || '');
// const isInGitlabCI = Boolean(env.GITLAB_CI);

/**
 * @type {import('../../src/types').FlhConfig}
 */
module.exports = {
  src: ['src'],
  exclude: [],
  fix: false,
  cache: !isMR,
  eslint: {
    fix: false,
    // eslintOptions: {
    //   extensions: ['ts', 'tsx'],
    //   overrideConfig: {},
    // },
  },
  // tscheck: {
  //   tsConfigFileName: 'tsconfig.eslint.json',
  //   exclude: [
  //     'node_modules',
  //     '**/*.test.{ts,tsx}',
  //     '**/*/*.mock.{ts,tsx}',
  //   ],
  // },
  // jest: {},
  // prettier: {},
  // commitlint: {
  //   verify: (message) => {
  //     return /#\d+/.test(message);
  //   }
  // },
  // pmcheck: 'pnpm',
  // userEmailRule: /@(lz|lzw)\.me$/,
  // wxWorkKeys: isInGitlabCI ? ['xxx'] : ['https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=84770248-xxxx-xxxx-xxxx-6b8686adxxxx'],
  // wxWorkMessageFormat: (type) => {
  //   const cn = require('child_process').execSync(`git log -1 --pretty="%cn"`, { encoding: 'utf8' }).trim();
  //   return `[gitlab-ci]${type}任务执行失败，请检查 @${cn}`;
  // },
};
