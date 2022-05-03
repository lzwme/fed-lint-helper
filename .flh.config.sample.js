/**
 * @type {import('./').FlhConfig}
 */
module.exports = {
  src: ['src'],
  debug: false,
  silent: false,
  printDetail: true,
  exitOnError: true,
  cache: true,
  removeCache: false,
  tscheck: {
    whiteListFilePath: 'config/tsCheckWhiteList.json',
  },
  eslint: {
    fix: process.argv.slice(2).includes('--fix'),
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
  // }
};
