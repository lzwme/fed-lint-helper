const { existsSync } = require('node:fs');
const { resolve } = require('node:path');

module.exports = function (path = '', options) {
    if (path.endsWith('.js')) {
        const filepath = resolve(options.basedir, path);
        const tsfilepath = filepath.slice(0, -2) + 'ts';
        if (!existsSync(filepath) && existsSync(tsfilepath)) {
            // console.log('path', path, options);
            // console.log('resolved:', path, '=>', tsfilepath);
            path = path.replace('.js', '.ts');
        }
    }
  return options.defaultResolver(path, options);
};
