/*
 * @Author: renxia
 * @Date: 2024-04-09 15:29:44
 * @LastEditors: renxia
 * @LastEditTime: 2024-04-09 17:25:08
 * @Description:
 */
const { existsSync } = require('node:fs');
const { resolve } = require('node:path');

const antdBoolean = ['visible', 'confirmLoading', 'closable', 'centered', 'maskClosable', 'forceRender', 'destroyOnClose'];
const eslintConfig = {
  languageOptions: {
    parserOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      tsconfigRootDir: process.cwd(),
      projectFolderIgnoreList: ['node_modules/', 'dist/', 'cache/', 'tmp/', 'release/'],
      warnOnUnsupportedTypeScriptVersion: false,
    },
  },
  ignores: ['**/node_modules/**', 'dist/**', 'cjs/**', 'esm/**', 'docs/**', 'mock/**', '**/*.js', '**/*.d.ts'],
  plugins: {},
  rules: {
    indent: ['off', 2],
  },
  files: ['src/**/*.js'],
};

const eslint = [];
const pkgFile = resolve(process.cwd(), 'package.json');

if (existsSync(pkgFile)) {
  const pkg = require(pkgFile);
  const pkgDeps = Object.assign({}, pkg.dependencies, pkg.devDependencies);

  if (pkgDeps['eslint-plugin-prettier']) {
    eslintConfig.plugins.prettier = require('eslint-plugin-prettier');
    Object.assign(eslintConfig.rules, { 'prettier/prettier': 'warn', indent: 'off' });
  }

  if (pkgDeps['@typescript-eslint/eslint-plugin']) {
    Object.assign(eslintConfig.rules, {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          argsIgnorePattern: '^_',
          args: 'after-used',
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/explicit-member-accessibility': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-parameter-properties': 'off',
      '@typescript-eslint/ban-ts-comment': 'warn',
      // 显式声明函数返回值
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-inferrable-types': 'off',
      '@typescript-eslint/no-empty-interface': 'off',
      '@typescript-eslint/triple-slash-reference': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/strict-boolean-expressions': 'off',
      '@typescript-eslint/prefer-string-starts-ends-with': 'error',
      '@typescript-eslint/prefer-includes': 'error',
      '@typescript-eslint/no-confusing-non-null-assertion': 'error',
      '@typescript-eslint/no-base-to-string': 'error',
      '@typescript-eslint/naming-convention': [
        'warn',
        {
          selector: 'variable',
          types: ['boolean'],
          format: ['PascalCase'],
          prefix: ['is', 'should', 'has', 'can', 'did', 'will', 'have', 'need', 'show', ...antdBoolean],
        },
      ],
      // '@typescript-eslint/no-unnecessary-boolean-literal-compare': 'error',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/no-unnecessary-type-arguments': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/no-misused-promises': [
        'error',
        {
          checksVoidReturn: false,
        },
      ],
    });
  }

  if (pkgDeps['eslint-plugin-jsx-a11y']) {
    eslintConfig.plugins['jsx-a11y'] = require('eslint-plugin-jsx-a11y');
  }

  // react
  if (pkgDeps.react && pkgDeps['eslint-plugin-react-hooks']) {
    Object.assign(eslintConfig.plugins, {
      'react-hooks': require('eslint-plugin-react-hooks'),
    });

    // TODO
    // if (pkgDeps['eslint-plugin-testing-library']) {}

    Object.assign(eslintConfig.rules, {
      // ======  react =======
      'react/jsx-uses-react': 'off',
      'react/forbid-elements': [
        1,
        {
          forbid: [
            'acronym',
            'applet',
            'basefont',
            'bgsound',
            'big',
            'blink',
            'center',
            'content',
            'dir',
            'font',
            'frame',
            'frameset',
            'hgroup',
            'image',
            'isindex',
            'listing',
            'keygen',
            'marquee',
            'menuitem',
            'nobr',
            'noembed',
            'noframes',
            'plaintext',
            'rb',
            'rtc',
            'shadow',
            'spacer',
            'strike',
            'tt',
            'xmp',
            'u',
          ],
        },
      ],
      'react/void-dom-elements-no-children': 'error',
      'react/jsx-no-script-url': 'error',
      'react/jsx-no-useless-fragment': 'error',
      'react/jsx-pascal-case': 'error',
      'react/no-access-state-in-setstate': 'error',
      'react/jsx-boolean-value': 'error',
      // 'testing-library/no-node-access': 'off',
    });
  }

  if (pkgDeps.jest && pkgDeps['eslint-plugin-jest']) {
    const jest = require('eslint-plugin-jest');

    eslint.push({
      files: ['**.sepc.ts', '**.test.ts', '**.spec.js', '**.test.js'],
      ...jest.configs['flat/recommended'],
      rules: {
        ...jest.configs['flat/recommended'].rules,
        'jest/prefer-expect-assertions': 'off',
      },
    });
  }

  if (pkgDeps['eslint-plugin-unicorn']) {
    eslintConfig.plugins.unicorn = require('eslint-plugin-unicorn');

    Object.assign(eslintConfig.rules, {
      // ======  unicorn =======
      'unicorn/catch-error-name': 'off',
      'unicorn/consistent-destructuring': 'off',
      'unicorn/empty-brace-spaces': 'off',
      'unicorn/expiring-todo-comments': 'off',
      // 'unicorn/filename-case': 'off',
      // 'unicorn/import-style': 'off',
      'unicorn/new-for-builtins': 'off',
      // 'unicorn/no-new-array': 'off',
      'unicorn/no-array-callback-reference': 'off',
      'unicorn/no-array-for-each': 'off',
      'unicorn/no-array-reduce': 'off',
      'unicorn/no-lonely-if': 'off',
      'unicorn/no-nested-ternary': 'off',
      'unicorn/no-new-buffer': 'off',
      'unicorn/no-null': 'off',
      'unicorn/no-object-as-default-parameter': 'off',
      'unicorn/no-unreadable-array-destructuring': 'off',
      'unicorn/no-useless-undefined': 'off',
      'unicorn/number-literal-case': 'off',
      'unicorn/numeric-separators-style': 'off',
      'unicorn/prefer-add-event-listener': 'off',
      'unicorn/prefer-json-parse-buffer': 'off',
      'unicorn/prefer-keyboard-event-key': 'off',
      'unicorn/prefer-module': 'off',
      'unicorn/prefer-optional-catch-binding': 'off',
      'unicorn/prefer-spread': 'off',
      'unicorn/prefer-number-properties': [
        'error',
        {
          checkInfinity: false,
        },
      ],
      'unicorn/prevent-abbreviations': 'off',
      'unicorn/prefer-string-replace-all': 'off',
    });
  }

  if (pkgDeps['typescript-eslint']) {
    eslintConfig.files = ['*.ts', '*.tsx'];
    Object.assign(eslintConfig.languageOptions.parserOptions, {
      projectFolderIgnoreList: ['**/node_modules/**', '**/dist/**', '**/dist-admin/**'],
      warnOnUnsupportedTypeScriptVersion: false,
      ecmaFeatures: {
        jsx: true,
      },
      ecmaVersion: 2023,
      sourceType: 'module',
    });
    if (existsSync('./tsconfig.eslint.json')) eslintConfig.languageOptions.parserOptions.project = './tsconfig.eslint.json';

    const eslintjs = require('@eslint/js');
    const tseslint = require('typescript-eslint');

    eslint.push(
      ...tseslint.config(eslintjs.configs.recommended, ...tseslint.configs.recommendedTypeChecked, eslintConfig, {
        files: ['*.js', '*.cjs', '*.mjs'],
        ...tseslint.configs.disableTypeChecked,
      })
    );
  } else {
    eslint.push(eslintConfig);
  }
}

module.exports = eslint;
