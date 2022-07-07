/*
 * @Author: lzw
 * @Date: 2021-09-25 16:15:03
 * @LastEditors: lzw
 * @LastEditTime: 2022-07-07 09:36:30
 * @Description:
 */

import { color } from 'console-log-colors';
import { existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { env } from 'process';
import { CommConfig, FlhConfig, LintTypes } from './types';
import { assign, formatWxWorkKeys, getLogger } from './utils';

const commConfig: CommConfig = {
  rootDir: process.cwd(),
  debug: !!process.env.DEBUG,
  silent: false,
  printDetail: true,
  src: ['src'],
  fileList: [],
  onlyChanges: false,
  checkOnInit: false,
  exitOnError: true,
  cache: true,
  removeCache: false,
  mode: 'proc',
};

export const config: FlhConfig = {
  configPath: '.flh.config.js',
  cacheLocation: `node_modules/.cache/flh/`,
  logDir: `node_modules/.cache/flh/log`,
  ci: Boolean(env.CI || env.GITLAB_CI || env.JENKINS_HOME),
  tscheck: {
    fileList: [],
    exclude: ['**/*.test.{ts,tsx}', '**/*/*.mock.{ts,tsx}', '**/*/*.d.ts'],
    whiteListFilePath: 'config/tsCheckWhiteList.json',
    tsConfigFileName: 'tsconfig.json',
    tsCodeCheck: [],
    tsCodeIgnore: [],
  },
  eslint: {
    whiteListFilePath: 'config/eslintWhitelist.json',
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
    commitMsgPrefix: '[ET]',
    sealedCommentAuthors: [],
    jiraHome: 'http://jira.com.cn',
    issuePrefix: [],
    projectName: 'fed-lint-helper',
    pipeline: {
      requestParams: { maxResults: 100, fields: ['comment', 'assignee'] },
    },
  },
  commitlint: {
    useAngularStyle: true,
  },
};

let isInited = false;

/** 将公共参数值合并进 LintTypes 内部 */
export function mergeCommConfig(options: FlhConfig, useDefault = true) {
  // 公共通用配置
  for (const key of Object.keys(commConfig)) {
    for (const type of LintTypes) {
      if (!options[type] || key in options[type]) continue;

      if (!(key in options)) {
        // @ts-ignore
        if (useDefault) options[type][key] = commConfig[key];
        // @ts-ignore
      } else options[type][key] = options[key];
    }
  }
  return options;
}

/**
 * 获取配置信息
 */
export function getConfig(options?: FlhConfig, useCache = isInited) {
  if (useCache && !options) return config;
  const logger = getLogger();

  if (options && options.configPath) config.configPath = options.configPath;

  // 配置文件只处理一次
  if (!isInited) {
    const configPath = resolve(config.configPath);
    if (existsSync(configPath)) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const cfg: FlhConfig = require(configPath);
      assign(config, cfg);
    } else if (config.debug || (options && options.debug)) {
      logger.log(color.yellowBright(`配置文件不存在：${configPath}`));
    }
  }

  // 直接入参的优先级最高
  if (options) assign(config, options);
  if (config.debug) {
    config.silent = false;
    logger.updateOptions({ levelType: 'debug' });
  }

  // 公共通用配置
  mergeCommConfig(config);

  if (!config.cacheLocation) config.cacheLocation = `node_modules/.cache/flh/`;
  if (!existsSync(config.cacheLocation)) {
    mkdirSync(config.cacheLocation, { recursive: true });
  }

  config.wxWorkKeys = formatWxWorkKeys(config.wxWorkKeys);
  isInited = true;
  if (config.logDir) logger.setLogDir(config.logDir);

  return config;
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
export const VERSION: string = require('../../package.json').version;
