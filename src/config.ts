/*
 * @Author: lzw
 * @Date: 2021-09-25 16:15:03
 * @LastEditors: renxia
 * @LastEditTime: 2024-06-05 14:34:26
 * @Description:
 */

import { existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import { homedir } from 'node:os';
import { env } from 'node:process';
// import { fileURLToPath } from 'node:url';
import { sync } from 'fast-glob';
import { color } from 'console-log-colors';
import { assign, isEmptyObject, type PackageJson, readJsonFileSync } from '@lzwme/fe-utils';
import { type CommConfig, type FlhConfig, LintTypes } from './types';
import { formatWxWorkKeys, getLogger } from './utils/index.js';

export const commConfig: CommConfig = {
  cache: true,
  checkOnInit: false,
  debug: !!process.env.DEBUG,
  exclude: ['**/node_modules/**', '**/dist/**'],
  exitOnError: true,
  extensions: ['.ts', '.tsx', '.js', '.jsx'],
  fileList: [],
  fix: false,
  ignoreWhiteList: false,
  mode: 'proc',
  printDetail: true,
  removeCache: false,
  rootDir: process.cwd(),
  silent: false,
  src: ['src'],
  toWhiteList: false,
};

export const config: FlhConfig = {
  ...commConfig,
  configPath: '.flh.config.cjs',
  packages: {},
  ci: Boolean(env.CI || env.GITLAB_CI || env.JENKINS_HOME || env.FLH_CI),
  logValidityDays: 7,
  onlyChanges: false,
  onlyStaged: false,
  tscheck: {
    extensions: ['.ts', '.tsx', '.cts', '.mts'],
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
      extensions: ['ts', 'tsx', 'js', 'jsx', 'cts', 'mts'],
      errorOnUnmatchedPattern: false,
    },
  },
  jest: {
    jestOptions: {
      config: 'jest.config.js',
      coverageReporters: ['text-summary', 'html'],
    },
  },
  jira: {
    mode: 'current',
    type: 'commit',
    commitMsgPrefix: '[ET]',
    sealedCommentAuthors: [],
    jiraHome: '',
    issuePrefix: [],
    projectName: 'fed-lint-helper',
    pipeline: {
      mustRepairTag: '[必须修复]',
      requestParams: { maxResults: 100 },
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
    extensions: [], // 避免被 common.extensions 覆盖
  },
};

let isInited = false;

/** 将公共参数值合并进 LintTypes 内部 */
export function mergeCommConfig(options: FlhConfig, useDefault = true) {
  // 公共通用配置
  for (const key of Object.keys(commConfig)) {
    for (const type of LintTypes) {
      if (!options[type] || key in options[type]) continue;

      if (key in options) {
        // @ts-ignore
        options[type][key] = options[key];
      } else {
        // @ts-ignore
        if (useDefault) options[type][key] = commConfig[key];
      }
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
    const ext = extname(config.configPath);
    const extList = ['.cjs', '.js', '.mjs', ext];
    const configPath = extList.find(d => existsSync(resolve(config.configPath.replace(ext, d))));
    if (configPath) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const d = require(configPath);
        assign(config, d);
      } catch {
        // @see https://github.com/microsoft/TypeScript/issues/43329
        // const _importDynamic = new Function('modulePath', 'return import(modulePath)');
        // _importDynamic(configPath).then((d: any) => assign(config, d));
        import(configPath).then(d => assign(config, d.default || d));
      }
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
  if (config.logValidityDays) logger.updateOptions({ validityDays: config.logValidityDays });

  if (!('printDetialOnSuccessed' in config)) {
    commConfig.printDetialOnSuccessed = config.printDetialOnSuccessed = config.ci !== true;
  }

  // 公共通用配置
  mergeCommConfig(config);

  if (!config.wxWorkKeys?.length && process.env.WX_WORK_KEYS) config.wxWorkKeys = process.env.WX_WORK_KEYS.split(',');
  config.wxWorkKeys = formatWxWorkKeys(config.wxWorkKeys);

  if (isEmptyObject(config.packages)) config.packages = getMenorepoPackages();

  const npmModules = resolve(config.rootDir, 'node_modules');
  const baseCaceDir = existsSync(npmModules) ? npmModules : resolve(homedir(), '.flh');

  if (!config.logDir) config.logDir = resolve(baseCaceDir, './.cache/flh/log');
  if (config.logDir === '_NIL_') config.logDir = ''; // 禁用日志
  if (config.logDir) {
    logger.setLogDir(config.logDir);
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
    const pkgInfo = readJsonFileSync<PackageJson>(filepath);
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
      const projectName = readJsonFileSync<PackageJson>(filepath).name;
      packages[projectName] = dirname(filepath);
    }
  }

  return packages;
}

// @ts-ignore todo: 改为 esm 模式
export const flhSrcDir = __dirname; // typeof __dirname !== 'undefined' ? __dirname : dirname(fileURLToPath(import.meta.url));

export const FlhPkgInfo = readJsonFileSync<PackageJson>(resolve(flhSrcDir, '../package.json'));
