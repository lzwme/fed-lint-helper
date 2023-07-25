module.exports = {
    arrowParens: 'avoid',
    bracketSpacing: true,
    endOfLine: 'auto',
    htmlWhitespaceSensitivity: 'ignore',
    proseWrap: 'preserve',
    semi: true,
    singleQuote: true,
    trailingComma: 'es5',
    // editorconfig: true,
    // printWidth: 140, // use .editorconfig
    // tabWidth: 4,
    overrides: [{
        files: '.prettierrc',
        options: {
            parser: 'json'
        }
    }, ]
}
