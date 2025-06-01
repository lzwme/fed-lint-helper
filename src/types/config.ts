import type { Config } from '@jest/types';
import type { ArrayLikeArgs, WxWorkReqParams } from '@lzwme/fe-utils';
import type { ESLint } from 'eslint';
import type { Config as PrettierConfig } from 'prettier';
import type { IPackageManager } from './base.js';
import type { JiraCheckConfig } from './jira.js';

export const LintTypes = ['eslint', 'tscheck', 'jira', 'prettier', 'biome', 'jest'] as const;
export type ILintTypes = ArrayLikeArgs<typeof LintTypes>;

export interface CommConfig {
  /** 项目根目录，默认为当前工作目录 */
  rootDir?: string;
  /** 是否打印调试信息 */
  debug?: boolean;
  /** 文件包含列表，仅在该列表中的才报告异常。glob 规则，如： `['src\**\*.{ts,tsx,js,jsx}']` */
  include?: string[];
  /** 文件排除列表，用于过滤一些不需要检查处理的文件。glob 规则，如： ['builder/**'] */
  exclude?: string[];
  /** 文件后缀。用于文件过滤等 */
  extensions?: string[];
  /** 是否尝试修正可自动修正的异常 */
  fix?: boolean;
  /** 静默模式。不打印任何信息，一般用于接口调用 */
  silent?: boolean;
  /** 是否打印异常详情。默认为 true */
  printDetail?: boolean;
  /** 执行成功时是否打印详情（[eslint]主要为在白名单中的异常信息，CI 中可设置为 false）。CI 中默认为 false */
  printDetialOnSuccessed?: boolean;
  /** 要执行 lint 的源码目录，默认为 ['src'] */
  src?: string[];
  /** 要检测的文件列表。主要用于指定仅检测发生变更的文件 */
  fileList?: string[];
  /** 初始化即执行check。默认为 false。设置为 true 则初始化后即调用 start 方法 */
  checkOnInit?: boolean;
  /** 执行完成时存在 lint 异常，是否退出程序。默认为 true */
  exitOnError?: boolean;
  /** 本次 check 是否使用缓存。为 false 则进行全量文件检测，否则不检测已缓存通过的文件。默认为 true。当依赖升级、规则变更、CI 执行 MR 时建议设置为 false */
  cache?: boolean;
  /** 是否移除缓存文件。设置为 true 将移除缓存并生成新的。默认 false */
  removeCache?: boolean;
  /** 白名单列表文件保存的路径，用于过滤允许出错的历史文件。默认为 `<config.rootDir>/config/whitelist-<lintType>.json` */
  whiteListFilePath?: string;
  /**
   * 是否将异常文件输出至白名单列表文件中。默认为 false。注意：
   * - 追加模式，如需全新生成，应先删除白名单文件。
   * - 初始化、规则变更、版本升级导致新增异常，但又不能立即修复的情况下，可设置为 true 执行一次
   */
  toWhiteList?: boolean;
  /** 是否忽略白名单，仅检查全部异常情况 */
  ignoreWhiteList?: boolean;
  /** 是否探测子项目并在子项目中分别执行 lint。默认为 true */
  detectSubPackages?: boolean;
  /**
   * 执行检测的方式。默认为 proc
   * @var proc fork 子进程执行。默认
   * @var thread 创建 work_threads 子线程执行。eslint 不要选此选项
   * @var current 在当前进程中执行
   */
  mode?: 'proc' | 'thread' | 'current';
}

export interface TsCheckConfig extends CommConfig {
  /** 项目源码目录，支持配置多个子项目(存在独立的 tsconfig.json)路径，默认为 ['src'] */
  src?: string[];
  /** ts 文件列表。当设置并存在内容时，只对该列表中的文件进行检测。主要用于 git hook 获取 commit 文件列表的场景 */
  fileList?: string[];
  /** tsconfig 配置文件的文件名。默认为 tsconfig.json */
  tsConfigFileName?: string;
  /**
   * 要检测的 ignoreDiagnostics code 列表。如设置，则仅检查包含于此列表中的异常
   * @see https://www.tslang.cn/docs/handbook/error.html
   */
  tsCodeCheck?: number[];
  /**
   * 要忽略的 ignoreDiagnostics code 列表
   * @see https://www.tslang.cn/docs/handbook/error.html
   */
  tsCodeIgnore?: number[];
}

export interface ESLintCheckConfig extends CommConfig {
  /** 指定处理的文件类型。默认为： ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'] */
  extensions?: string[];
  /** 是否自动修正可修复的 eslint 错误，同 ESLint.Option。默认 false。建议不设置为 true，手动逐个文件处理以避免造成大量不可控的业务代码变动 */
  fix?: boolean;
  /** 警告提示附加信息 */
  warningTip?: string;
  /** 是否允许 Error 类型也可通过白名单过滤。默认为 false */
  allowErrorToWhiteList?: boolean;
  /** ESLint Options。部分配置项会被内置修正 */
  eslintOptions?: ESLint.Options;
  /** 严格模式。默认禁止文件内的 eslint 配置标记 */
  strict?: boolean;
  /**
   * 执行检测的方式。默认为 proc
   * @var proc fork 子进程执行
   * @var thread 创建 work_threads 子线程执行。eslint 不推荐使用此种方式，打印进度有所缺失
   * @var current 在当前进程中执行
   */
  mode?: 'proc' | 'thread' | 'current';
}

export interface JestCheckConfig extends CommConfig {
  /** spec 测试文件列表 */
  fileList?: string[];
  /** Jest Options。部分配置项会被内置修正 */
  jestOptions?: Partial<Config.Argv> & Record<string, unknown>;
  /** 严格模式 */
  strict?: boolean;
  /** 是否使用 spawn/exec 执行 jest cli 的方式执行（全量执行时默认为 true，速度更快） */
  useJestCli?: boolean;
}

export interface CommitLintOptions extends CommConfig {
  /** 默认为 './.git/COMMIT_EDITMSG' */
  msgPath?: string;
  /** 验证的信息。默认从 msgPath 文件中读取 */
  message?: string;
  /** 是否使用 Angular commit 风格验证。当自定义了 verify 时允许设置为 false */
  useAngularStyle?: boolean;
  /** 允许的 type 类型与描述。默认使用内置定义 */
  allowTypes?: Record<string, string> | string[];
  /** 自定义额外允许的 type 类型与描述。会与内置类型合并 */
  customTypes?: Record<string, string>;
  /** 自定义验证规则。为字符串时将使用 RegExp 转换为正则表达式匹配 */
  verify?: ((message: string) => boolean | string) | string | RegExp;
  /** 仅打印帮助提示信息 */
  help?: boolean;
}

export interface PrettierCheckConfig extends CommConfig {
  /** prettier config。部分配置项会被内置修正 */
  prettierConfig?: PrettierConfig;
  /** 是否使用 spawn/exec 执行 prettier cli 的方式执行（全量执行时默认为 true，速度更快） */
  useCli?: boolean;
  /** 指定处理的文件类型。默认为： ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.less', '.scss', '.md'] */
  extensions?: string[];
}

export interface BiomeCheckConfig extends CommConfig {
  /** biome lint 自定义的 args 参数 */
  args?: Record<string, string | number>;
}

export interface FlhConfig extends Omit<CommConfig, 'cacheFilePath'> {
  /** 子包配置。针对多子模块的 menorepo 类项目 */
  packages?: Record<string, string>;
  /** 配置文件路径 */
  configPath?: string;
  /** 根目录，默认为当前执行目录 */
  rootDir?: string;
  /** 日志存放目录。默认为 `node_modules/.cache/flh/log`。设置为 `_NIL_` 则表示禁用日志写文件 */
  logDir?: string;
  /** 日志有效期。单位天，默认为 7 天 */
  logValidityDays?: number;
  /** 缓存文件保存的目录路径。默认为： `<config.rootDir>/node_modules/.cache/flh/` */
  cacheLocation?: string;
  /** 是否开启调试模式(打印更多的细节) */
  debug?: boolean;
  /** 是否运行为持续集成模式 */
  ci?: boolean;
  /** 用户邮箱规则。用于 commit lint 时检查提交者邮箱配置规范 */
  userEmailRule?: string | RegExp;
  /** 企业微信机器人 webhook key 配置，用于 ci 中发送通知。可配置多个。若使用代理地址，可设置为完整的URL地址。支持读取环境变量 WX_WORK_KEYS，多个以 , 分割 */
  wxWorkKeys?: string[];
  /** 自定义微信通知的消息格式化 */
  wxWorkMessageFormat?: (type: string, details: { errmsg?: string }) => string | WxWorkReqParams;
  /** 自定义出错退出前执行的回调方法 */
  beforeExitOnError?: (code: number, msg?: string) => void;
  biome?: BiomeCheckConfig;
  commitlint?: CommitLintOptions;
  eslint?: ESLintCheckConfig;
  jest?: JestCheckConfig;
  jira?: JiraCheckConfig;
  prettier?: PrettierCheckConfig;
  tscheck?: TsCheckConfig;
  /** package manager check */
  pmcheck?: IPackageManager;
  /** 源文件统计配置 */
  fileStats?: {
    src?: string[];
    /** 需统计的文件类型后缀列表 */
    extensions?: string[];
    /** 文件 glob 排除规则 */
    exclude?: string[];
    /** 是否输出为 json 格式 */
    json?: boolean;
    /** 输出为 json 格式时写入文件 */
    jsonFile?: string;
    /** 是否打印文件列表 */
    showFiles?: boolean;
    /** 是否打印重复文件列表 */
    showDupFiles?: boolean;
    /** 打印文件路径时，是否显示为完整路径 */
    showFullPath?: boolean;
    /** TopLine 和 TopSize 统计文件数 */
    topN?: number;
  };
  /** 是否仅检测 git 变化的文件 */
  onlyChanges?: boolean;
  /** 是否仅检测 git add 添加到缓冲区中的文件，优先级高于 onlyChanges */
  onlyStaged?: boolean;
}
