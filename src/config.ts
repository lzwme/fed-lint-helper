/*
 * @Author: lzw
 * @Date: 2021-09-25 16:15:03
 * @LastEditors: lzw
 * @LastEditTime: 2022-09-07 11:31:59
 * @Description:
 */

import { color } from 'console-log-colors';
import { sync } from 'fast-glob';
import { existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { env } from 'process';
import { assign, isEmptyObject } from '@lzwme/fe-utils';
import { CommConfig, FlhConfig, LintTypes } from './types';
import { formatWxWorkKeys, getLogger } from './utils';

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
  ...commConfig,
  configPath: '.flh.config.js',
  cacheLocation: `node_modules/.cache/flh/`,
  logDir: `node_modules/.cache/flh/log`,
  packages: {},
  ci: Boolean(env.CI || env.GITLAB_CI || env.JENKINS_HOME),
  tscheck: {
    mode: 'thread',
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
      extensions: ['ts', 'tsx', 'js', 'jsx'],
      errorOnUnmatchedPattern: false,
    },
  },
  jest: {
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
    detectSubPackages: false,
  },
  commitlint: {
    useAngularStyle: true,
  },
  prettier: {
    mode: 'current',
    exclude: ['**/node_modules/**', '**/dist/**'],
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.json', '.less', '.scss', '.md'],
    detectSubPackages: false,
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

  if (!('printDetialOnSuccessed' in config)) {
    commConfig.printDetialOnSuccessed = config.printDetialOnSuccessed = config.ci !== true;
  }

  // 公共通用配置
  mergeCommConfig(config);

  if (!config.cacheLocation) config.cacheLocation = `node_modules/.cache/flh/`;
  config.cacheLocation = resolve(config.rootDir, config.cacheLocation);
  if (!existsSync(config.cacheLocation)) {
    mkdirSync(config.cacheLocation, { recursive: true });
  }

  config.wxWorkKeys = formatWxWorkKeys(config.wxWorkKeys);
  if (config.logDir) logger.setLogDir(config.logDir);

  if (isEmptyObject(config.packages)) config.packages = getMenorepoPackages();

  isInited = true;
  return config;
}

function getMenorepoPackages(rootDir = process.cwd()) {
  const packages: Record<string, string> = {};
  let filepath = resolve(rootDir, 'package.json');

  if (existsSync(filepath)) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pkgInfo = require(filepath);
    if (pkgInfo.packages) Object.assign(packages, pkgInfo.packages);
  }

  filepath = resolve(rootDir, 'packages');
  if (existsSync(filepath)) {
    const pkgs = sync(['packages/**/*/package.json'], {
      cwd: rootDir,
      deep: 3,
      ignore: ['**/node_modules/**', '**/dist/**'],
      absolute: true,
    }).map(d => resolve(rootDir, d));

    for (filepath of pkgs) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const projectName = require(filepath).name as string;
      packages[projectName] = dirname(filepath);
    }
  }

  return packages;
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
export const VERSION: string = require('../package.json').version;
