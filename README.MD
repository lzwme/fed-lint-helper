[![Code Climate](https://lzw.me/images/logo.png)](https://lzw.me)
[![@lzwme/fed-lint-helper](https://nodei.co/npm/@lzwme/fed-lint-helper.png)][npm-url]

# @lzwme/fed-lint-helper

[![NPM version][npm-badge]][npm-url]
[![node version][node-badge]][node-url]
[![npm download][download-badge]][download-url]
[![GitHub issues][issues-badge]][issues-url]
[![GitHub forks][forks-badge]][forks-url]
[![GitHub stars][stars-badge]][stars-url]
[![minzipped size][bundlephobia-badge]][bundlephobia-url]

前端项目编码质量 `Lint` 检测辅助工具。用于辅助大型长期研发的前端项目渐进式的迁移与改进编码规范约束。

## 安装

```bash
npm i @lzwme/fed-lint-helper
# use yarn
yarn add @lzwme/fed-lint-helper
```

## 使用

### 命令行方式

```bash
flh --help
# typescript check
flh ts --help
# eslint check
flh eslint --help
# jest check
flh jest --help
```

### API 调用

提供了 `TsCheck`、`ESLintCheck `等类对象供 API 方式调用，以便自定义处理逻辑在 CI 构建中的集成。

```ts
import { TsCheck, ESLintCheck } from '@lzwme/fed-lint-helper';

// typescript check
const tsCheck = new TsCheck({
    exitOnError: false,
    src: ['src'],
    checkOnInit: false,
    debug: true,
    toWhiteList: true,
    // cache: true,
    // removeCache: false,
    // tsConfigFileName: 'tsconfig.eslint.json',
    // silent: false,
});
const res = tsCheck.start();
console.log(res);


// eslint check
const eslintCheck = new ESLintCheck({
  exitOnError: false,
  checkOnInit: false,
  src: ['src'],
  eslintOptions: {
    overrideConfig: {
      rules: { eqeqeq: 'warn' },
    },
  },
  // cache: argv.includes('cache'),
  // removeCache: argv.includes('nocache'),
  // silent: argv.includes('silent'),
  // debug: argv.includes('debug'),
  // toWhiteList: true,
  // fix: argv.includes('fix'),
});

eslintCheck
  .start()
  .then(res => console.log(res))
  .then(() => {
    return eslintCheck.start(['test-cases/ts-check-test-1.ts', 'src/ts-check.ts']).then(res => console.log(res));
  });
```

更多细节可参考 [API 文档](https://lzw.me/doc/fed-lint-helper)。

## API 文档

- [https://lzw.me/doc/fed-lint-helper](https://lzw.me/doc/fed-lint-helper)

## 开发

本地二次开发：

```bash
git clone https://github.com/lzwme/fed-lint-helper
yarn install
npm link
yarn dev
```

或者 [fork]() 本项目进行代码贡献。

**欢迎贡献想法与代码。**

## License

`@lzwme/fed-lint-helper` is released under the MIT license.

该插件由[志文工作室](https://lzw.me)开发和维护。


[stars-badge]: https://img.shields.io/github/stars/lzwme/fed-lint-helper.svg
[stars-url]: https://github.com/lzwme/fed-lint-helper/stargazers
[forks-badge]: https://img.shields.io/github/forks/lzwme/fed-lint-helper.svg
[forks-url]: https://github.com/lzwme/fed-lint-helper/network
[issues-badge]: https://img.shields.io/github/issues/lzwme/fed-lint-helper.svg
[issues-url]: https://github.com/lzwme/fed-lint-helper/issues
[npm-badge]: https://img.shields.io/npm/v/@lzwme/fed-lint-helper.svg?style=flat-square
[npm-url]: https://npmjs.org/package/@lzwme/fed-lint-helper
[node-badge]: https://img.shields.io/badge/node.js-%3E=_10.0.0-green.svg?style=flat-square
[node-url]: https://nodejs.org/download/
[download-badge]: https://img.shields.io/npm/dm/@lzwme/fed-lint-helper.svg?style=flat-square
[download-url]: https://npmjs.org/package/@lzwme/fed-lint-helper
[bundlephobia-url]: https://bundlephobia.com/result?p=@lzwme/fed-lint-helper@latest
[bundlephobia-badge]: https://badgen.net/bundlephobia/minzip/@lzwme/fed-lint-helper@latest
