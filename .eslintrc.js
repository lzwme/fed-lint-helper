// @ts-check

/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: [require.resolve('./preset/eslint')],
  ignorePatterns: ['**/node_modules/**', 'esm/**', 'cjs/**', 'docs/**', 'src/**/*.d.ts'],
  rules: {
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-unnecessary-boolean-literal-compare': 'off',
    '@typescript-eslint/ban-ts-comment': 'off',
    'jest/no-export': 'off',
    'unicorn/consistent-destructuring': 'off',
    'unicorn/filename-case': 'off',
    'unicorn/no-array-for-each': 'off',
    'unicorn/no-nested-ternary': 'off',
    'unicorn/no-null': 'off',
    'unicorn/no-process-exit': 'off',
    // 'unicorn/prefer-module': 'off',
    // 'unicorn/prefer-node-protocol': 'off',
    'unicorn/prefer-top-level-await': 'off',
    'unicorn/prevent-abbreviations': 'off',
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
