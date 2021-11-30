# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [1.4.6](https://github.com/lzwme/fed-lint-helper/compare/v1.4.5...v1.4.6) (2021-11-30)


### Bug Fixes

* 修正 jira 信息获取失败默认返回为 true 的问题 ([4f20108](https://github.com/lzwme/fed-lint-helper/commit/4f201083308fcd56bfb1f7429d2a9c464e369c95))

### [1.4.5](https://github.com/lzwme/fed-lint-helper/compare/v1.4.4...v1.4.5) (2021-11-25)


### Bug Fixes

* 修复 jira-check commit-msg 检测失败退出码仍为 0 的问题 ([9f103e1](https://github.com/lzwme/fed-lint-helper/commit/9f103e183ef4c4e3f1dafc3498c69e9a6e8e8b2e))
* 增加对 jira-check 请求 jira 信息的异常处理 ([7254ac8](https://github.com/lzwme/fed-lint-helper/commit/7254ac8c0f30b6dcabe9665f4cabbc76e7cac60d))

### [1.4.4](https://github.com/lzwme/fed-lint-helper/compare/v1.4.3...v1.4.4) (2021-11-22)


### Bug Fixes

* [jira-check]修正从分支名提取 sprint 主版本的规则逻辑 ([f786418](https://github.com/lzwme/fed-lint-helper/commit/f78641874faac627363cbd0c5fea0480987f1014))
* cli 工具 cache 参数默认值修改为 false ([a6530b4](https://github.com/lzwme/fed-lint-helper/commit/a6530b4beb7df0ab728dd151fd860e87a14c1ca8))

### [1.4.3](https://github.com/lzwme/fed-lint-helper/compare/v1.4.1...v1.4.3) (2021-11-19)


### Bug Fixes

* 修复 silent 参数无效的问题 ([4e8b238](https://github.com/lzwme/fed-lint-helper/commit/4e8b238ef297850d52a648853d937af302c15d75))
* 修正 eslint-check 对非 js、ts 类文件的过滤无效问题 ([166911d](https://github.com/lzwme/fed-lint-helper/commit/166911decaca24b2ee3718e5595e1bea023f6664))

### [1.4.1](https://github.com/lzwme/fed-lint-helper/compare/v1.4.0...v1.4.1) (2021-11-18)

## [1.4.0](https://github.com/lzwme/fed-lint-helper/compare/v1.3.0...v1.4.0) (2021-11-15)


### Features

* 新增 jira issue 关联检查支持 ([6d90eca](https://github.com/lzwme/fed-lint-helper/commit/6d90eca2a221b26347bfcda681bb79bf78449a90))
* cli 增加 only-changes 参数，支持仅检查 git 仓库最近一次变更的文件 ([4fb03b5](https://github.com/lzwme/fed-lint-helper/commit/4fb03b529ce746456db73cec9d10e4d930bb2811))


### Bug Fixes

* 修正 tscheck 白名单中的异常文件计数取值错误 ([b9c0a1f](https://github.com/lzwme/fed-lint-helper/commit/b9c0a1fac4c802860d21586bd93aa97bbb3b713b))
* eslint/tscheck白名单变更后执行 git add 命令以更新git暂存区 ([c484b39](https://github.com/lzwme/fed-lint-helper/commit/c484b39a8940597940161af762cf71fde507a435))
* eslint/tscheck白名单变更后执行 git add 命令以更新git暂存区 ([a3b4117](https://github.com/lzwme/fed-lint-helper/commit/a3b411745187f20415527b94d2b42c9ec35cefc4))
* fix lint error ([a014dea](https://github.com/lzwme/fed-lint-helper/commit/a014dea331bed9dfc8e229418f83d96e96db9485))

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
