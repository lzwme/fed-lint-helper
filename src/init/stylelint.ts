/**
 * stylelint config
 * @see https://stylelint.io
 * @see https://github.com/stylelint/stylelint/blob/HEAD/docs/user-guide/get-started.md
 * @see http://stylelint.docschina.org/user-guide/configuration/
 */

import type { Config } from 'stylelint';
import { assign } from '@lzwme/fe-utils';

export function getStylelintConfig(config?: Config): Config {
  const stylelint: Config = {
    extends: ['stylelint-config-standard-scss', 'stylelint-config-css-modules', 'stylelint-config-prettier'],
    plugins: ['stylelint-scss'],
    rules: {
      'function-url-quotes': 'always',
      // 'font-family-no-missing-generic-family-keyword': null, // iconfont
      'no-descending-specificity': 'off',
      'plugin/declaration-block-no-ignored-properties': true,
      'selector-attribute-quotes': 'always',
      'selector-type-no-unknown': 'off',
      'unit-no-unknown': [true, { ignoreUnits: ['rpx'] }],
      'value-keyword-case': ['lower', { ignoreProperties: ['composes'] }],
      // 'scss/at-rule-no-unknown': true,
    },
    // overrides: [
    //     {
    //         files: ['*.scss', '**/*.scss'],
    //         customSyntax: 'postcss-scss',
    //     },
    // ],
    ignoreFiles: ['**/*.js', '**/*.jsx', '**/*.tsx', '**/*.ts', 'node_modules/**/*', 'dist/**/*'],
  };

  if (config) assign(stylelint, config);

  return stylelint;
}
