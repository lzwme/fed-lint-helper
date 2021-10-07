/*
 * @Author: lzw
 * @Date: 2021-09-25 16:15:03
 * @LastEditors: lzw
 * @LastEditTime: 2021-09-28 22:42:47
 * @Description:
 */

import { color } from 'console-log-colors';
import fs from 'fs';
import path from 'path';
import { assign } from './utils';
import type { ESLint } from 'eslint';
import type { Config } from '@jest/types';

interface CommConfig {
  /** 项目根目录，默认为当前工作目录 */
  rootDir?: string;
  /** 是否打印调试信息 */
  debug?: boolean;
  /** 静默模式。不打印任何信息，一般用于接口调用 */
  silent?: boolean;
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
  /** 是否开启调试模式(打印更多的细节) */
  /** 是否打印诊断错误详情。默认为 true */
  printDetail?: boolean;
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
}

export interface FlhConfig extends Omit<CommConfig, 'cacheFilePath'> {
  /** 用户自定义文件的路径 */
  configPath?: string;
  /** 根目录，默认为当前执行目录 */
  rootDir?: string;
  /** 是否打印调试信息 */
  debug?: boolean;
  tscheck?: TsCheckConfig;
  eslint?: ESLintCheckConfig;
  jest?: JestCheckConfig;
}

const commConfig: CommConfig = {
  rootDir: process.cwd(),
  debug: !!process.env.DEBUG,
  silent: false,
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
    printDetail: true,
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
};

const lintTypes = ['eslint', 'tscheck', 'jest'] as const;
let isInited = false;

/**
 * 获取配置信息
 */
export function getConfig(options?: FlhConfig, useCache = isInited) {
  if (useCache) return config;

  if (options && options.configPath) config.configPath = options.configPath;

  const configPath = path.resolve(config.configPath);
  if (fs.existsSync(configPath)) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const cfg: FlhConfig = require(configPath);
    assign(config, cfg);
  } else if (config.debug || (options && options.debug)) {
    console.log(color.yellowBright(`配置文件不存在：${configPath}`));
  }

  // 直接入参的优先级最高
  if (options) assign(config, options);
  if (config.debug) config.silent = false;

  // 公共通用配置
  Object.keys(commConfig).forEach(key => {
    lintTypes.forEach(type => {
      if (null == config[type][key]) {
        if (null == config[key]) config[type][key] = commConfig[key];
        else config[type][key] = config[key];
      }
    });
  });

  if (!config.cacheLocation) config.cacheLocation = `node_modules/.cache/flh/`;
  if (!fs.existsSync(config.cacheLocation)) {
    fs.mkdirSync(config.cacheLocation);
  }

  isInited = true;

  return config;
}
