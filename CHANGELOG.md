# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [2.0.3](https://github.com/lzwme/fed-lint-helper/compare/v2.0.2...v2.0.3) (2022-10-31)


### Bug Fixes

* 修复 jest 单测读取 cache 字段错误的问题 ([3a089b1](https://github.com/lzwme/fed-lint-helper/commit/3a089b127394ee39f1e163efe93cfcf92d635e45))

### [2.0.2](https://github.com/lzwme/fed-lint-helper/compare/v2.0.1...v2.0.2) (2022-10-28)


### Bug Fixes

* 修复 jest 执行结果不会更新白名单的问题；统一文件列表打印的格式 ([c2a8bd1](https://github.com/lzwme/fed-lint-helper/commit/c2a8bd1cb517a60792f6ca3c0eb1c3c8a88bedcb))
* 修正 cli toWhiteList 参数失效问题 ([7797140](https://github.com/lzwme/fed-lint-helper/commit/77971409be7c30f5b81c3377c1d0982d74aedfcd))

### [2.0.1](https://github.com/lzwme/fed-lint-helper/compare/v2.0.0...v2.0.1) (2022-09-14)


### Bug Fixes

* 修复 prettier cache 匹配未生效的问题 ([fab940b](https://github.com/lzwme/fed-lint-helper/commit/fab940b217ea392598606c5dfa0b72f3a4b57742))
* 修复命令行参数 ci 无效问题；优化 prettier check 逻辑 ([eca85c6](https://github.com/lzwme/fed-lint-helper/commit/eca85c66aca95b397ea6aad3d6a564724b486ff7))
* 修正 prettier cli 参数描述错误 ([b0d7966](https://github.com/lzwme/fed-lint-helper/commit/b0d796689dd9a860597008773ed4c1743e88839c))

## [2.0.0](https://github.com/lzwme/fed-lint-helper/compare/v1.12.4...v2.0.0) (2022-09-08)


### Bug Fixes

* 更新 init 初始化配置逻辑 ([75dd9ea](https://github.com/lzwme/fed-lint-helper/commit/75dd9eab55d2a850a4e9e9652dc1754b0de374a6))
* 添加 husky tpl 文件 ([c098072](https://github.com/lzwme/fed-lint-helper/commit/c098072cdb8933a1c7868a7db56b8ea91f1a76fc))
* 修复 eslint check 未过滤无后缀文件导致的异常 ([0183316](https://github.com/lzwme/fed-lint-helper/commit/01833164ecda76c6e2334a74af760ad2b235b710))
* 修复 eslint check 未过滤无后缀文件导致的异常 ([6951ea7](https://github.com/lzwme/fed-lint-helper/commit/6951ea7793e16a97d03d40fe3117d853d0d1cf59))
* 修复 mode 参数默认值覆盖的优先级问题 ([994388e](https://github.com/lzwme/fed-lint-helper/commit/994388ee49c7a8728c0cc1c4c4880d58e9085c14))

### [1.12.4](https://github.com/lzwme/fed-lint-helper/compare/v1.12.3...v1.12.4) (2022-08-22)


### Bug Fixes

* 修复 jira 未登录成功时 logger 异常的问题 ([ee83568](https://github.com/lzwme/fed-lint-helper/commit/ee835686cbf65136269a9f551488cebfe99fdc3e))
* 修复 jira commit 输入内容符合要求的格式时无法提交的问题 ([c958e50](https://github.com/lzwme/fed-lint-helper/commit/c958e500238b6e8b341eed6a05a3aab47b64835a))
* 修复 onlyChanges 包含已删除文件，导致 prettier 异常的问题 ([4d9980d](https://github.com/lzwme/fed-lint-helper/commit/4d9980d1151744087e53c1f9864f4919177b4050))
* 修复自动从白名单移除无异常文件失效的问题 ([cdf6007](https://github.com/lzwme/fed-lint-helper/commit/cdf60073044fcbc30b4695dfca37a8cc4607a9ee))

### [1.12.3](https://github.com/lzwme/fed-lint-helper/compare/v1.12.2...v1.12.3) (2022-08-10)


### Bug Fixes

* 优化 tscheck 打印异常文件列表的数据统计 ([df40190](https://github.com/lzwme/fed-lint-helper/commit/df40190e4f58370ecf7cb427c7e016ac2a82fa8e))

### [1.12.2](https://github.com/lzwme/fed-lint-helper/compare/v1.12.1...v1.12.2) (2022-08-10)


### Bug Fixes

* 修复 tscheck 处理 printDetialOnSuccessed 参数逻辑错误的问题 ([dee9c4d](https://github.com/lzwme/fed-lint-helper/commit/dee9c4dc0abf2013714e776293b07544e3b07639))

### [1.12.1](https://github.com/lzwme/fed-lint-helper/compare/v1.12.0...v1.12.1) (2022-08-09)

## [1.12.0](https://github.com/lzwme/fed-lint-helper/compare/v1.11.1...v1.12.0) (2022-08-02)


### Features

* 扩展 flh init 命令，增加 eslint、jest、prettier、tsconfig、stylelint、vscode、editorconfig、husky 等的配置初始化支持 ([9742526](https://github.com/lzwme/fed-lint-helper/commit/97425266fdb58faa5ccbdc5e3a05f1778a7f8032))
* 新增 git commit lint 对提交者邮件规范的验证 ([5697e1e](https://github.com/lzwme/fed-lint-helper/commit/5697e1ecb585bfa46c01048f1d64cfd30f035c18))
* 新增 printDetialOnSuccessed 参数，可配置 ci 中执行成功时，是否需要打印异常详情(白名单中的异常) ([2739297](https://github.com/lzwme/fed-lint-helper/commit/2739297b9d77980bd9d5c8a1bf1f495f1adb9210))


### Bug Fixes

* 修复 jira 获取信息失败时会抛异常的问题 ([b621c13](https://github.com/lzwme/fed-lint-helper/commit/b621c131373035d9cda08b559d22545569c98930))
* 修复 jira-check 当未匹配到 issues prefix 时提示信息包含 undefined 的问题 ([0d84dfb](https://github.com/lzwme/fed-lint-helper/commit/0d84dfb52630a68ff68bf3cf09dda126f48a7fab))
* jira commit lint 默认禁止子包检测与执行； 新增 ignoreVersion 参数，允许配置忽略 jira 版本匹配检测约束 ([e7a0429](https://github.com/lzwme/fed-lint-helper/commit/e7a042901db00df42768a7d78749e0d265cfe49a))

### [1.11.1](https://github.com/lzwme/fed-lint-helper/compare/v1.11.0...v1.11.1) (2022-07-21)


### Bug Fixes

* 修复 override config 导致的配置参数初始化 ([583c5b1](https://github.com/lzwme/fed-lint-helper/commit/583c5b19dd559f19140b651539751c2d05c7fd20))

## [1.11.0](https://github.com/lzwme/fed-lint-helper/compare/v1.10.3...v1.11.0) (2022-07-21)


### Features

* 新增支持 menorepo 类多子包项目 ([b1eb053](https://github.com/lzwme/fed-lint-helper/commit/b1eb05365985b08a54c980a421e687dadf316114))


### Bug Fixes

* fix error when fileList is undefined ([899d6f1](https://github.com/lzwme/fed-lint-helper/commit/899d6f1f280c0c63a2b8b22124b902031e3eafd5))
* prettier 应使用 editorconfig 配置 ([812f9f2](https://github.com/lzwme/fed-lint-helper/commit/812f9f20198b3c8a71ea06c0cdfd9069a8a0ed5d))

### [1.10.3](https://github.com/lzwme/fed-lint-helper/compare/v1.10.2...v1.10.3) (2022-07-12)


### Bug Fixes

* 修复 noFiles 的判断逻辑 ([8023411](https://github.com/lzwme/fed-lint-helper/commit/80234114015a3575dc1457bc773525ef6a6e2b65))

### [1.10.2](https://github.com/lzwme/fed-lint-helper/compare/v1.10.1...v1.10.2) (2022-07-08)


### Bug Fixes

* 修正 jest 在 only-changes 模式下不生效问题 ([c602696](https://github.com/lzwme/fed-lint-helper/commit/c6026966c9fa100e964a3a47352d2d5fe5b5ac85))

### [1.10.1](https://github.com/lzwme/fed-lint-helper/compare/v1.10.0...v1.10.1) (2022-07-08)


### Bug Fixes

* fix for only-changes mode ([cacc3f8](https://github.com/lzwme/fed-lint-helper/commit/cacc3f87dfdd79472d5a1a28709ae5efd712fa7b))

## [1.10.0](https://github.com/lzwme/fed-lint-helper/compare/v1.9.2...v1.10.0) (2022-07-08)


### Features

* 新增 prettier check 功能 ([71975f8](https://github.com/lzwme/fed-lint-helper/commit/71975f8bbf0fcbb00c7779b3c6e2cbf8524a1aa9))

### [1.9.2](https://github.com/lzwme/fed-lint-helper/compare/v1.9.1...v1.9.2) (2022-07-05)


### Bug Fixes

* rmdir 命令删除不存在的文件时不应抛异常 ([8c5f002](https://github.com/lzwme/fed-lint-helper/commit/8c5f002265973b13f241b1504e18c568e13e84ec))

### [1.9.1](https://github.com/lzwme/fed-lint-helper/compare/v1.9.0...v1.9.1) (2022-07-01)


### Bug Fixes

* 修复 request 方法 url 包含端口号时请求异常问题 ([33a0696](https://github.com/lzwme/fed-lint-helper/commit/33a0696788bdc48e89dfa5ded0a423bfdda3fc27))

## [1.9.0](https://github.com/lzwme/fed-lint-helper/compare/v1.8.3...v1.9.0) (2022-06-30)


### Features

* 新增 beforeExitOnError 参数，用于自定义异常退出前执行的方法 ([27ca89f](https://github.com/lzwme/fed-lint-helper/commit/27ca89f35ed46a76ebd824a05ab10d31739944d3))


### Bug Fixes

* 修复使用 fast-glob 后 rm 命令删除失效问题 ([cea0496](https://github.com/lzwme/fed-lint-helper/commit/cea0496c5fa990f4bec39bf99fef16a8fce5a26d))

### [1.8.3](https://github.com/lzwme/fed-lint-helper/compare/v1.8.2...v1.8.3) (2022-06-28)


### Bug Fixes

* 修复 tscheck 白名单移除逻辑与本地缓存匹配异常的问题 ([1839488](https://github.com/lzwme/fed-lint-helper/commit/1839488ae5920a38fb2e24b39f2234bbda538b6b))

### [1.8.2](https://github.com/lzwme/fed-lint-helper/compare/v1.8.1...v1.8.2) (2022-06-24)

### [1.8.1](https://github.com/lzwme/fed-lint-helper/compare/v1.8.0...v1.8.1) (2022-06-23)

## [1.8.0](https://github.com/lzwme/fed-lint-helper/compare/v1.7.0...v1.8.0) (2022-06-09)


### Features

* 增加 simpleAssgin 工具方法 ([2766027](https://github.com/lzwme/fed-lint-helper/commit/2766027db0310f78242b7fe49c1de883b9143391))


### Bug Fixes

* 更新 utils date 单元测试用例 ([5b3e74c](https://github.com/lzwme/fed-lint-helper/commit/5b3e74c897ffd6219f8933a6e560d8da12ee8fc5))
* 更新日志写文件逻辑；修正 assgin 的逻辑错误 ([0c4fee4](https://github.com/lzwme/fed-lint-helper/commit/0c4fee4ed5ed75d3067e6ba9334f901c1a5e0839))
* fix for ts error ([71b9405](https://github.com/lzwme/fed-lint-helper/commit/71b9405c865d8f783671159c51f6814e8dcd2681))
* fix for ts error ([5f37bba](https://github.com/lzwme/fed-lint-helper/commit/5f37bba691bf2b8d91ebd940b8554244a7448a7f))
* fix for ts error ([fc90e23](https://github.com/lzwme/fed-lint-helper/commit/fc90e23695461390fc824cdb57a89a8ffe536bff))

## [1.7.0](https://github.com/lzwme/fed-lint-helper/compare/v1.6.6...v1.7.0) (2022-05-17)


### Features

* 新增辅助工具 pmcheck 用于包管理工具检测与约束 ([76a1fdd](https://github.com/lzwme/fed-lint-helper/commit/76a1fddc9da10d550e823c79b35d423f9aa14302))

### [1.6.6](https://github.com/lzwme/fed-lint-helper/compare/v1.6.5...v1.6.6) (2022-05-12)


### Bug Fixes

* 修正 eslint-check 过滤 ignore 文件逻辑失效问题 ([616db60](https://github.com/lzwme/fed-lint-helper/commit/616db60f42492499d03019fd445092bc21d3bc8d))

### [1.6.5](https://github.com/lzwme/fed-lint-helper/compare/v1.6.3...v1.6.5) (2022-05-09)


### Bug Fixes

* fix for husky install scripts ([bf0ab94](https://github.com/lzwme/fed-lint-helper/commit/bf0ab9495979defbbc4de3906d7ee77aacd698a7))

### [1.6.3](https://github.com/lzwme/fed-lint-helper/compare/v1.6.2...v1.6.3) (2022-05-09)


### Bug Fixes

* 修复 only-changes 参数获取为空时返回文件列表包含空字符串的问题 ([9ad40e7](https://github.com/lzwme/fed-lint-helper/commit/9ad40e74bcdf5e7cb33cc2c65c1d3294947030f5))

### [1.6.2](https://github.com/lzwme/fed-lint-helper/compare/v1.6.1...v1.6.2) (2022-05-05)

### [1.6.1](https://github.com/lzwme/fed-lint-helper/compare/v1.6.0...v1.6.1) (2022-05-05)


### Bug Fixes

* 修正 types 目录输出配置错误；增加 fix 参数，支持 cli 指定是否执行 eslint fix ([3fdb489](https://github.com/lzwme/fed-lint-helper/commit/3fdb489159b5ca3f66b5b694d1d76ca02c6a464d))

## [1.6.0](https://github.com/lzwme/fed-lint-helper/compare/v1.1.0...v1.6.0) (2022-05-04)


### Features

* 从白名单中移除本次检测无异常的文件并写回白名单文件中 ([118dcbc](https://github.com/lzwme/fed-lint-helper/commit/118dcbc7cc5897e1305d3045ffb90d07624b70de))
* 新增 jest 单元测试的 lint 约束支持 ([dc61f45](https://github.com/lzwme/fed-lint-helper/commit/dc61f4519c1eb5d8421fb0f8dbc986714dec11cc))
* 新增 jira issue 关联检查支持 ([6d90eca](https://github.com/lzwme/fed-lint-helper/commit/6d90eca2a221b26347bfcda681bb79bf78449a90))
* 新增遵循 Angular git commit style 的 commitlint 支持 ([a0c17e6](https://github.com/lzwme/fed-lint-helper/commit/a0c17e6576d8fe9d4c9e23bd9c538e99e8f340c6))
* 增加 cli 命令行工具 ([310e060](https://github.com/lzwme/fed-lint-helper/commit/310e060f393ca38840c6866dd225244ecada0210))
* 增加可配置 lint 失败使用企业微信机器人通知支持 ([23ecae1](https://github.com/lzwme/fed-lint-helper/commit/23ecae12428cd8eea1453c45b261b0a1c392cfc6))
* 增加企业微信通知基础支持 ([d65abe1](https://github.com/lzwme/fed-lint-helper/commit/d65abe1497d6ddda3abf1c8c7a666bc86a2667cc))
* cli 增加 only-changes 参数，支持仅检查 git 仓库最近一次变更的文件 ([4fb03b5](https://github.com/lzwme/fed-lint-helper/commit/4fb03b529ce746456db73cec9d10e4d930bb2811))
* jira-check 增加 allowedFixVersions 配置参数，允许自定义跳过版本检查的版本号 ([af4221e](https://github.com/lzwme/fed-lint-helper/commit/af4221e0fb011c7d0cad6a1e27f6b6c7c1849426))


### Bug Fixes

* [jira-check]修正从分支名提取 sprint 主版本的规则逻辑 ([f786418](https://github.com/lzwme/fed-lint-helper/commit/f78641874faac627363cbd0c5fea0480987f1014))
* 修复 cli 命令执行时默认参数值优先级高于配置文件的问题 ([a5d6e42](https://github.com/lzwme/fed-lint-helper/commit/a5d6e42aabf57a933ca33a68b0c96002da245754))
* 修复 jira-check 获取修复版本为空时直接抛异常的问题 ([f1b6311](https://github.com/lzwme/fed-lint-helper/commit/f1b6311c2f88475d53e939c9d61abdfaf8550d33))
* 修复 jira-check commit-msg 检测失败退出码仍为 0 的问题 ([9f103e1](https://github.com/lzwme/fed-lint-helper/commit/9f103e183ef4c4e3f1dafc3498c69e9a6e8e8b2e))
* 修复 silent 参数无效的问题 ([4e8b238](https://github.com/lzwme/fed-lint-helper/commit/4e8b238ef297850d52a648853d937af302c15d75))
* 修复配置信息二次初始化入参被忽略的问题 ([ace3fd5](https://github.com/lzwme/fed-lint-helper/commit/ace3fd5a0628349bd7db94444a04cc41e8f99ddb))
* 修复在子进程中执行失败不会退出的问题 ([8fb45ff](https://github.com/lzwme/fed-lint-helper/commit/8fb45ffb348c5689a260fd76c024098f1d5ceaf7))
* 修正 eslint 缓存文件名与 tscheck 相同的问题 ([3fa6d7a](https://github.com/lzwme/fed-lint-helper/commit/3fa6d7af740d458003bcd19192d3d3d269b6b127))
* 修正 eslint-check 对非 js、ts 类文件的过滤无效问题 ([166911d](https://github.com/lzwme/fed-lint-helper/commit/166911decaca24b2ee3718e5595e1bea023f6664))
* 修正 jira 信息获取失败默认返回为 true 的问题 ([4f20108](https://github.com/lzwme/fed-lint-helper/commit/4f201083308fcd56bfb1f7429d2a9c464e369c95))
* 修正 jira-check 获取 issueType desc 时替换非英文字符的正则规则；jest 执行返回值类型优化 ([a4d0b22](https://github.com/lzwme/fed-lint-helper/commit/a4d0b22baaede75b60a16fba6e78ed6f1226cc3d))
* 修正 jira-check pipeline 循环处理逻辑的异常返回 ([91f1ca5](https://github.com/lzwme/fed-lint-helper/commit/91f1ca58ca4c2a79f572a27fa604a71285e423d0))
* 修正 ts-check 对诊断类型的次数统计方式 ([f74c85d](https://github.com/lzwme/fed-lint-helper/commit/f74c85d67153cf349befe7c4d50799d4b87c67f5))
* 修正 tscheck 白名单中的异常文件计数取值错误 ([b9c0a1f](https://github.com/lzwme/fed-lint-helper/commit/b9c0a1fac4c802860d21586bd93aa97bbb3b713b))
* 修正更新 commander 后 cli 参数默认值错误 ([cf3d591](https://github.com/lzwme/fed-lint-helper/commit/cf3d5914d7a74e9f7f5188f16db9113535aff3d3))
* 增加对 jira-check 请求 jira 信息的异常处理 ([7254ac8](https://github.com/lzwme/fed-lint-helper/commit/7254ac8c0f30b6dcabe9665f4cabbc76e7cac60d))
* cli 工具 cache 参数默认值修改为 false ([a6530b4](https://github.com/lzwme/fed-lint-helper/commit/a6530b4beb7df0ab728dd151fd860e87a14c1ca8))
* eslint/tscheck白名单变更后执行 git add 命令以更新git暂存区 ([c484b39](https://github.com/lzwme/fed-lint-helper/commit/c484b39a8940597940161af762cf71fde507a435))
* eslint/tscheck白名单变更后执行 git add 命令以更新git暂存区 ([a3b4117](https://github.com/lzwme/fed-lint-helper/commit/a3b411745187f20415527b94d2b42c9ec35cefc4))
* fix lint error ([a014dea](https://github.com/lzwme/fed-lint-helper/commit/a014dea331bed9dfc8e229418f83d96e96db9485))
* trim for commit-msg ([3cc6bf3](https://github.com/lzwme/fed-lint-helper/commit/3cc6bf3a3ced75967e63b36c889a352187f1fd43))
* tscheck 过滤间接依赖文件逻辑前置 ([e10dc97](https://github.com/lzwme/fed-lint-helper/commit/e10dc97bd8c2b0a0482db2db733aead0c286ad8c))
* tscheck 检测结果列表应过滤间接依赖的文件 ([ef9884d](https://github.com/lzwme/fed-lint-helper/commit/ef9884d4caf2d05d184a5f1ecb26c6e25edcd922))
* tscheck 使用 minimatch 过滤 glob 规则应使用文件相对路径 ([9249e88](https://github.com/lzwme/fed-lint-helper/commit/9249e8875f929a8fcff90e316b16f7bfc19722f3))

### [1.5.1](https://github.com/lzwme/fed-lint-helper/compare/v1.5.0...v1.5.1) (2022-03-10)


### Bug Fixes

* 修正更新 commander 后 cli 参数默认值错误 ([cf3d591](https://github.com/lzwme/fed-lint-helper/commit/cf3d5914d7a74e9f7f5188f16db9113535aff3d3))

## [1.5.0](https://github.com/lzwme/fed-lint-helper/compare/v1.4.13...v1.5.0) (2022-03-08)


### Features

* 新增遵循 Angular git commit style 的 commitlint 支持 ([a0c17e6](https://github.com/lzwme/fed-lint-helper/commit/a0c17e6576d8fe9d4c9e23bd9c538e99e8f340c6))


### Bug Fixes

* trim for commit-msg ([3cc6bf3](https://github.com/lzwme/fed-lint-helper/commit/3cc6bf3a3ced75967e63b36c889a352187f1fd43))

### [1.4.13](https://github.com/lzwme/fed-lint-helper/compare/v1.4.12...v1.4.13) (2021-12-28)


### Bug Fixes

* 修正 eslint 缓存文件名与 tscheck 相同的问题 ([3fa6d7a](https://github.com/lzwme/fed-lint-helper/commit/3fa6d7af740d458003bcd19192d3d3d269b6b127))
* tscheck 过滤间接依赖文件逻辑前置 ([e10dc97](https://github.com/lzwme/fed-lint-helper/commit/e10dc97bd8c2b0a0482db2db733aead0c286ad8c))
* tscheck 使用 minimatch 过滤 glob 规则应使用文件相对路径 ([9249e88](https://github.com/lzwme/fed-lint-helper/commit/9249e8875f929a8fcff90e316b16f7bfc19722f3))

### [1.4.12](https://github.com/lzwme/fed-lint-helper/compare/v1.4.11...v1.4.12) (2021-12-27)


### Bug Fixes

* tscheck 检测结果列表应过滤间接依赖的文件 ([ef9884d](https://github.com/lzwme/fed-lint-helper/commit/ef9884d4caf2d05d184a5f1ecb26c6e25edcd922))

### [1.4.11](https://github.com/lzwme/fed-lint-helper/compare/v1.4.10...v1.4.11) (2021-12-15)


### Bug Fixes

* 修复配置信息二次初始化入参被忽略的问题 ([ace3fd5](https://github.com/lzwme/fed-lint-helper/commit/ace3fd5a0628349bd7db94444a04cc41e8f99ddb))

### [1.4.10](https://github.com/lzwme/fed-lint-helper/compare/v1.4.9...v1.4.10) (2021-12-10)


### Bug Fixes

* 修正 jira-check pipeline 循环处理逻辑的异常返回 ([91f1ca5](https://github.com/lzwme/fed-lint-helper/commit/91f1ca58ca4c2a79f572a27fa604a71285e423d0))

### [1.4.9](https://github.com/lzwme/fed-lint-helper/compare/v1.4.8...v1.4.9) (2021-12-08)


### Bug Fixes

* 修复 jira-check 获取修复版本为空时直接抛异常的问题 ([f1b6311](https://github.com/lzwme/fed-lint-helper/commit/f1b6311c2f88475d53e939c9d61abdfaf8550d33))
* 修正 jira-check 获取 issueType desc 时替换非英文字符的正则规则；jest 执行返回值类型优化 ([a4d0b22](https://github.com/lzwme/fed-lint-helper/commit/a4d0b22baaede75b60a16fba6e78ed6f1226cc3d))

### [1.4.8](https://github.com/lzwme/fed-lint-helper/compare/v1.4.7...v1.4.8) (2021-12-02)


### Bug Fixes

* 修复在子进程中执行失败不会退出的问题 ([8fb45ff](https://github.com/lzwme/fed-lint-helper/commit/8fb45ffb348c5689a260fd76c024098f1d5ceaf7))

### [1.4.7](https://github.com/lzwme/fed-lint-helper/compare/v1.4.6...v1.4.7) (2021-12-01)


### Bug Fixes

* 修复 cli 命令执行时默认参数值优先级高于配置文件的问题 ([a5d6e42](https://github.com/lzwme/fed-lint-helper/commit/a5d6e42aabf57a933ca33a68b0c96002da245754))

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
