# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [1.3.0](https://github.com/lzwme/fed-lint-helper/compare/v1.2.0...v1.3.0) (2021-10-26)


### Features

* 从白名单中移除本次检测无异常的文件并写回白名单文件中 ([118dcbc](https://github.com/lzwme/fed-lint-helper/commit/118dcbc7cc5897e1305d3045ffb90d07624b70de))

## [1.2.0](https://github.com/lzwme/fed-lint-helper/compare/v1.1.0...v1.2.0) (2021-09-30)


### Features

* 新增 jest 单元测试的 lint 约束支持 ([dc61f45](https://github.com/lzwme/fed-lint-helper/commit/dc61f4519c1eb5d8421fb0f8dbc986714dec11cc))
* 增加 cli 命令行工具 ([310e060](https://github.com/lzwme/fed-lint-helper/commit/310e060f393ca38840c6866dd225244ecada0210))


### Bug Fixes

* 修正 ts-check 对诊断类型的次数统计方式 ([f74c85d](https://github.com/lzwme/fed-lint-helper/commit/f74c85d67153cf349befe7c4d50799d4b87c67f5))

## 1.1.0 (2021-08-25)


### Features

* 增加使用多线程、多进程执行检测模式 ([c382c34](https://github.com/lzwme/fed-lint-helper/commit/c382c34ba34eec451969eaace71351b64f43781c))
* eslintCheck 增加 rules 异常类型数量统计信息，并忽略 ignore 文件的警告报错 ([ebd7334](https://github.com/lzwme/fed-lint-helper/commit/ebd73344e514d9945f2b6fa24d13069261bb8000))


### Bug Fixes

* 修正 tsCheck 缓存写入逻辑失效的问题 ([4b86e40](https://github.com/lzwme/fed-lint-helper/commit/4b86e4052f836f3f13a21d2997219817ad242336))
* ts-check 默认使用 proc 子进程模式执行 ([d9fa7d3](https://github.com/lzwme/fed-lint-helper/commit/d9fa7d3735a9406f56a894b11775af63280263f4))
* tsCheck 打印异常详情时，仅打印匹配文件的异常 ([78d378e](https://github.com/lzwme/fed-lint-helper/commit/78d378e64b5ef0c0c15c3b367e3b668d445a31e1))
