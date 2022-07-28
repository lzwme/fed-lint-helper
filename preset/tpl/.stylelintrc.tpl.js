/**
 * stylelint config
 * @see https://github.com/stylelint/stylelint/blob/HEAD/docs/user-guide/get-started.md
 * @see https://stylelint.io
 * @see http://stylelint.docschina.org/user-guide/configuration/
 */
// @ts-check
const { getStylelintConfig } = require('@gf/et-config');
const config = getStylelintConfig();

module.exports = {
    ...config,
    // extends: [
    //     ...config.ignoreFiles,
    // ],
    ignoreFiles: [...config.ignoreFiles, 'dist'],
    rules: {
        'scss/at-rule-no-unknown': true,
    },
};
