/**
 * @type {import('./src/config').FlhConfig}
 */
module.exports = {
  src: ['src'],
  debug: false,
  silent: false,
  printDetail: true,
  exitOnError: true,
  cache: true,
  removeCache: false,
  wxWorkKeys: [],
  wxWorkMessageFormat: (type) => {
    const cn = require('child_process').execSync(`git log -1 --pretty="%cn"`, { encoding: 'utf8' }).trim();
    return `[gitlab-ci]${type}任务执行失败，请检查 @${cn}`;
  },
  fix: false,
  tscheck: {
    whiteListFilePath: 'config/tsCheckWhiteList.json',
  },
  eslint: {
    fix: false,
    whiteListFilePath: 'config/eslintWhitelist.json',
  },
  jest: {
    src: ['src'],
    // silent: true,
    // fileList: glob.sync('src/**/**.spec.ts'),
  },
  // commitlint: {
  //   verify: (message) => {
  //     return /#\d+/.test(message);
  //   }
  // },
  // pmcheck: 'pnpm',
};
