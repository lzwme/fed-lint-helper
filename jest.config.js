// @ts-check

/** @type {import('@jest/types').Config.InitialOptions } */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'tsx', 'js'],
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
  extensionsToTreatAsEsm: ['.ts'],
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  coveragePathIgnorePatterns: ['/node_modules/', 'src/cli.ts', 'src/index.ts'], // 'src/**/*.spec.ts'
  // collectCoverageFrom: ['src/**/!(*.d).ts'],
  maxWorkers: require('os').cpus().length,
  moduleNameMapper: {
    // "(.+)(common|utils|get-logger|config).js": "$1$2.ts"
  },
  resolver: '<rootDir>/preset/jest-js-ts-resolver.js',
};
