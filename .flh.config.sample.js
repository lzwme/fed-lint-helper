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
  removeCache: process.argv.slice(2).includes('--removeCache'),
  tscheck: {
    src: ['src'],
    whiteListFilePath: 'tsCheckWhiteList.json',
    toWhiteList: process.argv.slice(2).includes('--toWhiteList'),
    // tsFiles: glob.sync('src/**/**.{ts,tsx}'),
  },
  eslint: {
    src: ['src'],
    fix: process.argv.slice(2).includes('--fix'),
    whiteListFilePath: 'eslintWhitelist.json',
    toWhiteList: process.argv.slice(2).includes('--toWhiteList'),
  },
  jest: {
    src: ['src'],
    // silent: true,
    // fileList: glob.sync('src/**/**.spec.ts'),
  },
};
