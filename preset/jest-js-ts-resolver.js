const { existsSync } = require('node:fs');
const { resolve, extname } = require('node:path');

module.exports = function jsTsResolver(path = '', options) {
  const ext = extname(path);
  // console.debug('[jsTsResolver]: ', path, options);

  if (ext) {
    const filepath = resolve(options.basedir, path);
    if (existsSync(filepath)) return filepath;

    if (ext === '.js') {
      const tsfilepath = filepath.slice(0, -2) + 'ts';

      if (existsSync(tsfilepath)) {
        // console.log('resolved:', path, '=>', tsfilepath);
        return tsfilepath;
      }
    }
  }

  try {
    return options.defaultResolver(path, options);
  } catch {
    return require.resolve(path);
  }
};
