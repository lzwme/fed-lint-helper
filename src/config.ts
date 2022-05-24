/*
 * @Author: lzw
 * @Date: 2021-09-25 16:15:03
 * @LastEditors: lzw
 * @LastEditTime: 2022-05-24 22:30:33
 * @Description:
 */

import { color } from 'console-log-colors';
import fs from 'fs';
import path from 'path';
import { assign, ValueOf, formatWxWorkKeys } from './utils';
import type { ESLint } from 'eslint';
import type { Config } from '@jest/types';
import type { IncomingHttpHeaders } from 'http';

interface CommConfig {
  /** 项目根目录，默认为当前工作目录 */
  rootDir?: string;
  /** 是否打印调试信息 */
  debug?: boolean;
  /** 静默模式。不打印任何信息，一般用于接口调用 */
  silent?: boolean;
  /** 是否打印异常详情。默认为 true */
  printDetail?: boolean;
  /** 要执行 lint 的源码目录，默认为 ['src'] */
  src?: string[];
  /** 初始化即执行check。默认为 false。设置为 true 则初始化后即调用 start 方法 */
  checkOnInit?: boolean;
  /** 执行完成时存在 lint 异常，是否退出程序。默认为 true */
  exitOnError?: boolean;
  /** 本次 check 是否使用缓存。为 false 则进行全量文件检测，否则不检测已缓存通过的文件。默认为 true。当依赖升级、规则变更、CI 执行 MR 时建议设置为 false */
  cache?: boolean;
  /** 缓存文件保存的目录路径。默认为： `<config.rootDir>/node_modules/.cache/flh/` */
  cacheLocation?: string;
  /** 是否移除缓存文件。设置为 true 将移除缓存并生成新的。默认 false */
  removeCache?: boolean;
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
  tsFiles?: string[];
  /** 文件排除列表， glob 规则。用于过滤一些不需要检测的文件 */
  exclude?: string | string[];
  /** 白名单列表文件保存的路径，用于过滤允许出错的历史文件。默认为 `<config.rootDir>/tsCheckWhiteList.json` 文件 */
  whiteListFilePath?: string;
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
  /**
   * 是否将异常文件输出至白名单列表文件中。默认为 false。注意：
   * - 追加模式，如需全新生成，应先删除白名单文件。
   * - 初始化、规则变更、版本升级导致新增异常，但又不能立即修复的情况下，可设置为 true 执行一次
   */
  toWhiteList?: boolean;
}

export interface ESLintCheckConfig extends CommConfig, Pick<TsCheckConfig, 'toWhiteList'> {
  /** 是否自动修正可修复的 eslint 错误，同 ESLint.Option。默认 false。建议不设置为 true，手动逐个文件处理以避免造成大量不可控的业务代码变动 */
  fix?: boolean;
  /** 要执行 lint 的源码目录，默认为 ['src'] */
  src?: string[];
  /** 白名单列表文件保存的路径，用于过滤允许出错的历史文件。默认为 `<config.rootDir>/eslintWhitelist.json` 文件 */
  whiteListFilePath?: string;
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
  /** 要检测的源码目录，默认为 ['src'] */
  src?: string[];
  /** spec 测试文件列表 */
  fileList?: string[];
  /** Jest Options。部分配置项会被内置修正 */
  jestOptions?: Partial<Config.Argv> & Record<string, unknown>;
  /** 严格模式 */
  strict?: boolean;
  /** 是否使用 spawn/exec 执行 jest cli 的方式执行（全量执行时更快） */
  useJestCli?: boolean;
}

export interface JiraCheckConfig extends CommConfig {
  /** 执行检测的类型 */
  type?: 'pipeline' | 'commit';
  /** jira 首页的 url 地址。如： http://jira.lzw.me */
  jiraHome?: string;
  /** gitlab 项目名称。如 lzwme/fed-lint-helper */
  projectName?: string;
  /** jira 请求自定义 headers 信息 */
  headers?: IncomingHttpHeaders;
  /** CI pipeline 阶段执行的批量检查相关配置 */
  pipeline?: {
    /** pipeline 批量获取 jira issues 的请求参数 */
    requestParams: {
      jql?: string;
      fields?: string[];
      maxResults?: number;
      [key: string]: unknown;
    };
  };
  /** 已封板后允许回复必须修复的人员列表 */
  sealedCommentAuthors?: string[];
  /** jira issue 编号前缀，如编号为 LZWME-4321，则设置为 LZWME- */
  issuePrefix?: string;
  /** commit 提交固定前缀，如： [ET] */
  commitMsgPrefix?: string;
  /** 提取 commit-msg 信息的文件路径。默认为 ./.git/COMMIT_EDITMSG */
  COMMIT_EDITMSG?: string;
  /** 允许跳过分支版本检查提交的 jira 版本号 */
  allowedFixVersions?: string[];
}

export interface CommitLintOptions extends CommConfig {
  msgPath?: string;
  /** 是否使用 Angular commit 风格验证。当自定义了 verify 时允许设置为 false */
  useAngularStyle?: boolean;
  /** 自定义验证规则。为字符串时将使用 RegExp 转换为正则表达式匹配 */
  verify?: ((message: string) => boolean | string) | string | RegExp;
}

export interface FlhConfig extends Omit<CommConfig, 'cacheFilePath'> {
  /** 用户自定义文件的路径 */
  configPath?: string;
  /** 根目录，默认为当前执行目录 */
  rootDir?: string;
  /** 是否开启调试模式(打印更多的细节) */
  debug?: boolean;
  /** 企业微信机器人 webhook key 配置，用于 ci 中发送通知。可配置多个 */
  wxWorkKeys?: string[];
  /** 自定义微信通知的消息格式化 */
  wxWorkMessageFormat?: (type: string) => string;
  /** 是否尝试修正可自动修正的异常 */
  fix?: boolean;
  tscheck?: TsCheckConfig;
  eslint?: ESLintCheckConfig;
  jest?: JestCheckConfig;
  jira?: JiraCheckConfig;
  commitlint?: CommitLintOptions;
  /** package manager check */
  pmcheck?: 'npm' | 'yarn' | 'pnpm';
}

const commConfig: CommConfig = {
  rootDir: process.cwd(),
  debug: !!process.env.DEBUG,
  silent: false,
  printDetail: true,
  src: ['src'],
  checkOnInit: false,
  exitOnError: true,
  cache: true,
  removeCache: false,
  mode: 'proc',
};

export const config: FlhConfig = {
  configPath: '.flh.config.js',
  cacheLocation: `node_modules/.cache/flh/`,
  tscheck: {
    tsFiles: [],
    exclude: ['**/*.test.{ts,tsx}', '**/*/*.mock.{ts,tsx}', '**/*/*.d.ts'],
    whiteListFilePath: 'tsCheckWhiteList.json',
    tsConfigFileName: 'tsconfig.json',
    tsCodeCheck: [],
    tsCodeIgnore: [],
  },
  eslint: {
    whiteListFilePath: 'eslintWhitelist.json',
    warningTip: `[errors-必须修复；warnings-历史文件选择性处理(对于历史文件慎重修改 == 类问题)]`,
    mode: 'proc',
    eslintOptions: {
      extensions: ['ts', 'tsx'],
      errorOnUnmatchedPattern: false,
    },
  },
  jest: {
    fileList: [],
    // whiteListFilePath: 'jestWhitelist.json',
    jestOptions: {
      config: 'jest.config.js',
      coverageReporters: ['text-summary', 'html'],
      forceExit: false,
      detectOpenHandles: true,
    },
  },
  jira: {
    mode: 'current',
    type: 'commit',
    sealedCommentAuthors: [],
    jiraHome: 'http://jira.com.cn',
    issuePrefix: 'JGCPS-',
    projectName: 'fed-lint-helper',
    pipeline: {
      requestParams: { maxResults: 100, fields: ['comment', 'assignee'] },
    },
  },
  commitlint: {
    useAngularStyle: true,
  },
};

export const LintTypes = ['eslint', 'tscheck', 'jest', 'jira'] as const;
export type ILintTypes = ValueOf<typeof LintTypes>;
let isInited = false;

/** 将公共参数值合并进 LintTypes 内部 */
export function mergeCommConfig(options: FlhConfig, useDefault = true) {
  // 公共通用配置
  for (const key of Object.keys(commConfig)) {
    for (const type of LintTypes) {
      if (undefined == options[type][key]) {
        if (undefined == options[key]) {
          if (useDefault) options[type][key] = commConfig[key];
        } else options[type][key] = options[key];
      }
    }
  }
  return options;
}

/**
 * 获取配置信息
 */
export function getConfig(options?: FlhConfig, useCache = isInited) {
  if (useCache && !options) return config;

  if (options && options.configPath) config.configPath = options.configPath;

  // 配置文件只处理一次
  if (!isInited) {
    const configPath = path.resolve(config.configPath);
    if (fs.existsSync(configPath)) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const cfg: FlhConfig = require(configPath);
      assign(config, cfg);
    } else if (config.debug || (options && options.debug)) {
      console.log(color.yellowBright(`配置文件不存在：${configPath}`));
    }
  }

  // 直接入参的优先级最高
  if (options) assign(config, options);
  if (config.debug) config.silent = false;

  // 公共通用配置
  mergeCommConfig(config);

  if (!config.cacheLocation) config.cacheLocation = `node_modules/.cache/flh/`;
  if (!fs.existsSync(config.cacheLocation)) {
    fs.mkdirSync(config.cacheLocation, { recursive: true });
  }

  config.wxWorkKeys = formatWxWorkKeys(config.wxWorkKeys);
  isInited = true;

  return config;
}
