[![@lzwme/fed-lint-helper](https://nodei.co/npm/@lzwme/fed-lint-helper.png)][npm-url]

# @lzwme/fed-lint-helper

[![NPM version][npm-badge]][npm-url]
[![node version][node-badge]][node-url]
![license MIT](https://img.shields.io/github/license/lzwme/asmd-calc)

[![build status](https://github.com/lzwme/fed-lint-helper/actions/workflows/node-ci.yml/badge.svg)](https://github.com/lzwme/fed-lint-helper/actions/workflows/node-ci.yml)
[![npm download][download-badge]][download-url]
[![GitHub issues][issues-badge]][issues-url]
[![GitHub forks][forks-badge]][forks-url]
[![GitHub stars][stars-badge]][stars-url]

前端项目编码质量 `Lint` 检测辅助工具。用于辅助大型长期研发的前端项目渐进式的迁移与改进编码规范约束。

## 功能特性

- 白名单机制。引入新版本、新规则时开启白名单模式，技术栈更新改造影响成本更低
- 可选的多线程、多子进程执行模式。并行执行多项静态检查效率更高
- 支持缓存能力。二次执行效率显著提升，避免重复执行浪费时间

已支持的 lint 检查能力：

- `eslint` 自定义 eslint 检测
- `tscheck` 自定义 TypeScript 检测
- `jest` 自定义 jest 单元测试执行
- `jira` 自定义关联 jira 的检测逻辑(测试)

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

# 在当前目录下生成默认的配置文件 .flh.config.js
flh init --config

# typescript check
flh --tscheck
# eslint check
flh --eslint
# jest check
flh --jest
# git commit lint
flh --commitlint

# Multitask parallel execution
flh --tscheck --eslint --jest
```

其他辅助工具命令：

```bash
# 目录删除
flh rm --help
# 示例：删除目录 a 和 dist
flh rm ./a ./dist -f

# 消息通知
flh notify --help
# 示例：企业微信机器人消息通知
flh notify "任务执行失败！@all" --wx-work <web hook key1> <web hook key2>
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
      // rulePaths: ['./eslint-rules/'],
      // errorOnUnmatchedPattern: true,
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
[node-badge]: https://img.shields.io/badge/node.js-%3E=_14.0.0-green.svg?style=flat-square
[node-url]: https://nodejs.org/download/
[download-badge]: https://img.shields.io/npm/dm/@lzwme/fed-lint-helper.svg?style=flat-square
[download-url]: https://npmjs.org/package/@lzwme/fed-lint-helper
[bundlephobia-url]: https://bundlephobia.com/result?p=@lzwme/fed-lint-helper@latest
[bundlephobia-badge]: https://badgen.net/bundlephobia/minzip/@lzwme/fed-lint-helper@latest
