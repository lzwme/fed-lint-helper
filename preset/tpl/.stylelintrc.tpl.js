/**
 * stylelint config
 * @see https://github.com/stylelint/stylelint/blob/HEAD/docs/user-guide/get-started.md
 * @see https://stylelint.io
 * @see http://stylelint.docschina.org/user-guide/configuration/
 */
// @ts-nocheck
const { getStylelintConfig } = require('@lzwme/fed-lint-helper/cjs/init/stylelint');
const config = getStylelintConfig();

module.exports = {
    ...config,
    // extends: [
    //     ...config.extends,
    // ],
    ignoreFiles: [...config.ignoreFiles, 'dist'],
    rules: {
        'scss/at-rule-no-unknown': true,
    },
};
