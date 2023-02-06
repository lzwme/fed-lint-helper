// @ts-check
const path = require('path');
const rootDir = path.resolve(__dirname);

/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: [require.resolve('./preset/eslint')],
  parserOptions: {
    tsconfigRootDir: rootDir,
    project: path.resolve(rootDir, './tsconfig.eslint.json'),
    projectFolderIgnoreList: ['**/node_modules/**', '**/dist/**', '**/dist-admin/**'],
  },
  ignorePatterns: ['**/node_modules/**', 'dist/**', 'esm/**', 'cjs/**', 'docs/**', 'mock/**', '**/*.js', '**/*.d.ts'],
  rules: {
    'prettier/prettier': 'warn',
    // 关闭 eslint 的 indent，使用 prettier 格式化格式
    indent: ['off', 2],
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-unnecessary-boolean-literal-compare': 'off',
    '@typescript-eslint/ban-ts-comment': 'off',
    'unicorn/prefer-module': 'off',
    'unicorn/prefer-node-protocol': 'off',
    'unicorn/no-nested-ternary': 'off',
    'unicorn/no-process-exit': 'off',
    'unicorn/consistent-destructuring': 'off',
    'jest/no-export': 'off',
    'unicorn/filename-case': 'off',
    'unicorn/no-null': 'off',
    'unicorn/prevent-abbreviations': 'off',
    'unicorn/no-array-for-each': 'off',
    'unicorn/prefer-top-level-await': 'off',
    'unicorn/no-array-reduce': 'off',
    'unicorn/import-style': [
      'error',
      {
        styles: {
          path: {
            named: true,
          },
        },
      },
    ],
  },
};
