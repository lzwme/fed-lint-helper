module.exports = {
  // displayName: 'flh',
  // coveragePathIgnorePatterns: ['/node_modules/'],
  coverageReporters: ['html', 'text-summary', 'text'],
  pretset: 'ts-jest',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'json', 'node'],
  testEnvironment: 'jsdom',
  testMatch: ['**/src/**/+(*.)+(spec|test).+(ts|js)?(x)'],
  moduleNameMapper: {
    // '\\.svg(.*)$': path.resolve(jestMocksDir, 'svgrMocks.tsx'),
    '\\.svg(.*)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$': 'identity-obj-proxy',
    '\\.module.(css|less|sass|scss)$': 'identity-obj-proxy',
    // '\\.(css|less|sass|scss)$': path.resolve(jestMocksDir, 'styleMock.js')
  },
  extensionsToTreatAsEsm: ['.ts'],
  maxWorkers: require('os').cpus().length,
  // transform: {
  //   '^.+\\.(t|j)sx?$': [
  //     '@swc/jest',
  //     {
  //       jsc: {
  //         target: 'es2022',
  //       },
  //     },
  //   ],
  // },
};
