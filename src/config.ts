/*
 * @Author: lzw
 * @Date: 2021-09-25 16:15:03
 * @LastEditors: lzw
 * @LastEditTime: 2022-11-15 10:33:05
 * @Description:
 */

import { existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { homedir } from 'node:os';
import { env } from 'node:process';
import { sync } from 'fast-glob';
import { color } from 'console-log-colors';
import { assign, isEmptyObject } from '@lzwme/fe-utils';
import { CommConfig, FlhConfig, LintTypes } from './types';
import { formatWxWorkKeys, getLogger, logClean } from './utils';

export const commConfig: CommConfig = {
  cache: true,
  checkOnInit: false,
  debug: !!process.env.DEBUG,
  exitOnError: true,
  fileList: [],
  fix: false,
  mode: 'proc',
  onlyChanges: false,
  printDetail: true,
  removeCache: false,
  rootDir: process.cwd(),
  silent: false,
  src: ['src'],
  toWhiteList: false,
  exclude: ['**/node_modules/**', '**/dist/**'],
};

export const config: FlhConfig = {
  ...commConfig,
  configPath: '.flh.config.js',
  cacheLocation: `node_modules/.cache/flh/`,
  packages: {},
  ci: Boolean(env.CI || env.GITLAB_CI || env.JENKINS_HOME),
  logValidityDays: 7,
  tscheck: {
    mode: 'thread',
    exclude: ['**/*.test.{ts,tsx}', '**/*/*.mock.{ts,tsx}', '**/*/*.d.ts'],
    tsConfigFileName: 'tsconfig.json',
    tsCodeCheck: [],
    tsCodeIgnore: [],
  },
  eslint: {
    warningTip: `[errors-必须修复；warnings-历史文件选择性处理(对于历史文件慎重修改 == 类问题)]`,
    mode: 'proc',
    eslintOptions: {
      extensions: ['ts', 'tsx', 'js', 'jsx'],
      errorOnUnmatchedPattern: false,
    },
  },
  jest: {
    jestOptions: {
      config: 'jest.config.js',
      coverageReporters: ['text-summary', 'html'],
      // detectOpenHandles: true,
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
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.less', '.scss', '.md'],
    detectSubPackages: false,
  },
  fileStats: {
    extensions: [
      '.ts',
      '.tsx',
      '.js',
      '.jsx',
      '.mjs',
      '.cjs',
      '.json',
      '.less',
      '.scss',
      '.md',
      'c',
      'cpp',
      'h',
      'html',
      'py',
      'rs',
      'java',
      'proto',
      // binary
      'mp3',
      'wav',
      'png',
      'jpg',
      'gif',
      'svg',
    ],
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
export function getConfig(options?: FlhConfig, useCache = true) {
  if (isInited && useCache && !options) return config;
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

  config.wxWorkKeys = formatWxWorkKeys(config.wxWorkKeys);

  if (isEmptyObject(config.packages)) config.packages = getMenorepoPackages();

  const npmModules = resolve(config.rootDir, 'node_modules');
  const baseCaceDir = existsSync(npmModules) ? npmModules : resolve(homedir(), '.flh');

  if (!config.logDir) config.logDir = resolve(baseCaceDir, './.cache/flh/log');
  if (config.logDir === '_NIL_') config.logDir = ''; // 禁用日志
  if (config.logDir) {
    logger.setLogDir(config.logDir);
    // 只处理一次
    if (!globalThis.isInChildProcess && !isInited) logClean(config.logDir, config.logValidityDays);
  }

  if (!config.cacheLocation) config.cacheLocation = resolve(baseCaceDir, `./.cache/flh/`);
  config.cacheLocation = resolve(config.rootDir, config.cacheLocation);
  if (!existsSync(config.cacheLocation)) mkdirSync(config.cacheLocation, { recursive: true });

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
