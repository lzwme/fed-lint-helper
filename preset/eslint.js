const { existsSync } = require('node:fs');
const { resolve } = require('node:path');
const antdBoolean = ['visible', 'confirmLoading', 'closable', 'centered', 'maskClosable', 'forceRender', 'destroyOnClose'];
/** @type {import('eslint').Linter.Config} */
const eslint = {
  env: {
    browser: true,
    commonjs: true,
    es6: true,
    node: true,
    es2021: true,
  },
  globals: {
    Atomics: 'readonly',
    SharedArrayBuffer: 'readonly',
  },
  settings: {},
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    tsconfigRootDir: process.cwd(),
    projectFolderIgnoreList: ['node_modules/', 'dist/', 'mock/'],
    warnOnUnsupportedTypeScriptVersion: false,
    ecmaFeatures: {
      jsx: true,
    },
  },
  extends: ['eslint:recommended'],
  plugins: ['import'],
  ignorePatterns: ['node_modules/', 'dist/', 'dist-*'], // , 'src/**/*.js'
  rules: {
    // 'no-restricted-syntax': 'off',
    'prefer-object-spread': 'off',
    'no-console': [
      'warn',
      {
        allow: ['warn', 'error'],
      },
    ],
    'no-multi-spaces': [
      'warn',
      {
        ignoreEOLComments: true,
      },
    ],
    'key-spacing': [
      'warn',
      {
        afterColon: true,
      },
    ],
    'space-before-blocks': 'warn',
    'comma-spacing': [
      'error',
      {
        before: false,
        after: true,
      },
    ],
    'space-infix-ops': 'warn',
    'spaced-comment': [
      'warn',
      'always',
      {
        exceptions: ['-', '+'],
        markers: ['/'],
      },
    ],
    'no-empty': [
      'error',
      {
        allowEmptyCatch: true,
      },
    ],
    eqeqeq: ['warn', 'smart'],
    'prefer-const': [
      'error',
      {
        destructuring: 'all',
      },
    ],
    'no-constructor-return': 'error',
    'no-duplicate-imports': 'error',
    'no-self-compare': 'error',
    'no-unreachable-loop': 'warn',
    'no-unused-private-class-members': 'error',
    'guard-for-in': 'warn',
    'no-caller': 'error',
    'no-alert': 'error',
    'no-array-constructor': 'error',
    'no-new-wrappers': 'error',
    'no-new-object': 'error',
    'no-eval': 'error',
    'no-extend-native': [
      'error',
      {
        exceptions: ['Number'],
      },
    ],
    'no-extra-bind': 'error',
    'no-extra-label': 'error',
    'no-implied-eval': 'error',
    'no-iterator': 'error',
    'no-new-func': 'error',
    'no-proto': 'error',
    'no-script-url': 'error',
    'no-useless-call': 'error',
    // 'prefer-object-spread': 'error',
    'prefer-spread': 'error',
    'prefer-template': 'error',
    'prefer-numeric-literals': 'error',
    'no-restricted-syntax': [
      'error',
      {
        selector:
          "CallExpression[callee.object.name='JSON'][callee.property.name='parse'] > CallExpression[callee.object.name='JSON'][callee.property.name='stringify']",
        message: '不允许使用JSON.parse(JSON.stringify(object))来克隆对象，使用lodash或者spread运算符。',
      },
      {
        selector: "CallExpression[callee.object.property.name='console']",
        message: '不允许使用window.console.log.',
      },
      {
        selector: "CallExpression[callee.property.name='toFixed'][callee.object.callee.name='Number']",
        message: '你在用Number.prototype.toFixed？请改用decimal.js。',
      },
      {
        selector: "CallExpression[callee.name='setTimeout']",
        message: '在浏览器环境，请使用window.setTimeout，在node环境，请使用global.setTimeout。',
      },
      {
        selector: "CallExpression[callee.name='setInterval']",
        message: '在浏览器环境，请使用window.setTimeout，在node环境，请使用global.setTimeout。',
      },
      {
        selector: "CallExpression[callee.name='clearTimeout']",
        message: '在浏览器环境，请使用window.setTimeout，在node环境，请使用global.setTimeout。',
      },
      {
        selector: "CallExpression[callee.name='clearInterval']",
        message: '在浏览器环境，请使用window.setTimeout，在node环境，请使用global.setTimeout。',
      },
      {
        selector: "CallExpression[callee.property.name='toLocaleString']",
        message: 'toLocaleString不推荐使用',
      },
      {
        selector: "CallExpression[callee.property.name='toLocaleDateString']",
        message: 'toLocaleDateString不推荐使用',
      },
      {
        selector: "CallExpression[callee.property.name='toLocaleTimeString']",
        message: 'toLocaleTimeString不推荐使用',
      },
      {
        selector: "CallExpression[callee.property.name='toString']",
        message: 'toString不推荐使用，使用String()方法',
      },
      {
        selector:
          "CallExpression[callee.property.name='addEventListener'][arguments.0.value='click'][callee.object.callee.property.name='querySelector'][callee.object.callee.object.name='document'][callee.object.arguments.0.value='body']",
        message: '请使用useClickAway。',
      },
    ],
    'max-params': [
      'warn',
      {
        max: 4,
      },
    ],
  },
  overrides: [],
};
const pkgFile = resolve(process.cwd(), 'package.json');

if (existsSync(pkgFile)) {
  const pkg = require(pkgFile);
  const pkgDeps = Object.assign({}, pkg.dependencies, pkg.devDependencies);

  // react
  if (pkgDeps.react) {
    eslint.settings.react = {
      pragma: 'React',
      version: 'detect',
    };
    eslint.extends.push('plugin:react-hooks/recommended', 'plugin:jsx-a11y/recommended');
    eslint.plugins.push('jsx-a11y', 'react');
    eslint.overrides.push({
      // 3) Now we enable eslint-plugin-testing-library rules or preset only for matching files!
      files: ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],
      extends: ['plugin:testing-library/react', 'plugin:jsx-a11y/recommended'],
    });

    Object.assign(eslint.rules, {
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

      'testing-library/no-node-access': 'off',

      // ======  jsx-a11y =======
      'jsx-a11y/tabindex-no-positive': 'warn',
      'jsx-a11y/label-has-associated-control': 'warn',
      'jsx-a11y/no-autofocus': [
        2,
        {
          ignoreNonDOM: true,
        },
      ],
    });
  }

  if (pkgDeps['@typescript-eslint/parser']) {
    eslint.parser = '@typescript-eslint/parser';
    eslint.extends.push('plugin:@typescript-eslint/recommended');
    eslint.plugins.push('@typescript-eslint');

    Object.assign(eslint.rules, {
      // ======  @typescript-eslint =======
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
          prefix: ['is', 'should', 'has', 'can', 'did', 'will', 'have', ...antdBoolean],
        },
      ],
      '@typescript-eslint/no-unnecessary-boolean-literal-compare': 'error',
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

  if (pkgDeps.jest) {
    eslint.globals.jest = true;
    eslint.globals['jest/globals'] = true;

    if (pkgDeps['eslint-plugin-jest']) {
      eslint.extends.push('plugin:jest/recommended');
    }
  }

  if (pkgDeps['eslint-plugin-unicorn']) {
    eslint.extends.push('plugin:unicorn/recommended');
    eslint.plugins.push('unicorn');

    Object.assign(eslint.rules, {
      // ======  unicorn =======
      'unicorn/catch-error-name': 'off',
      'unicorn/empty-brace-spaces': 'off',
      'unicorn/expiring-todo-comments': 'off',
      'unicorn/filename-case': 'off',
      'unicorn/import-style': 'off',
      'unicorn/new-for-builtins': 'off',
      'unicorn/no-array-callback-reference': 'off',
      'unicorn/no-nested-ternary': 'off',
      'unicorn/no-new-array': 'off',
      'unicorn/no-new-buffer': 'off',
      'unicorn/no-null': 'off',
      'unicorn/no-object-as-default-parameter': 'off',
      'unicorn/no-unreadable-array-destructuring': 'off',
      'unicorn/no-useless-undefined': 'off',
      'unicorn/prefer-add-event-listener': 'off',
      'unicorn/prefer-keyboard-event-key': 'off',
      'unicorn/prefer-module': 'off',
      'unicorn/prevent-abbreviations': 'off',
      'unicorn/prefer-optional-catch-binding': 'off',
      'unicorn/numeric-separators-style': 'off',
      'unicorn/prefer-spread': 'off',
      'unicorn/prefer-number-properties': [
        'error',
        {
          checkInfinity: false,
        },
      ],
      'unicorn/no-array-for-each': 'off',
      'unicorn/number-literal-case': 'off',
      'unicorn/prefer-node-protocol': 'off',
      'unicorn/prefer-json-parse-buffer': 'off',
      'unicorn/no-lonely-if': 'off',
      'unicorn/consistent-destructuring': 'off',
    });
  }
}

module.exports = eslint;
