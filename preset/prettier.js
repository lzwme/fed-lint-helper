module.exports = {
    bracketSpacing: true,
    printWidth: 140,
    semi: true,
    singleQuote: true,
    trailingComma: 'es5',
    proseWrap: 'preserve',
    arrowParens: 'avoid',
    endOfLine: 'auto',
    htmlWhitespaceSensitivity: 'ignore',
    // tabWidth: 4,
    overrides: [{
        files: '.prettierrc',
        options: {
            parser: 'json'
        }
    }, ]
}
