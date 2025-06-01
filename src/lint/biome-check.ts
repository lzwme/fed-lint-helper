import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync, fixToshortPath, isEmpty, md5, safeJsonParse } from '@lzwme/fe-utils';
import { bold, color, cyanBright, magentaBright, red, redBright, yellowBright } from 'console-log-colors';
import glob from 'fast-glob';
import { getConfig } from '../config.js';
import type { BiomeCheckConfig, LintCacheInfo, LintResult, WhiteListInfo } from '../types';
import { arrayToObject, fileListToString } from '../utils/common.js';
import { LintBase } from './LintBase.js';

export interface BiomeCheckResult extends LintResult {
  failedFiles?: string[];
}

export type GitlabLintItem = {
  description: string;
  check_name: string;
  fingerprint: string;
  severity: number;
  location: {
    path: string;
    lines: {
      begin: number;
      end?: number;
    };
  };
};

export class BiomeCheck extends LintBase<BiomeCheckConfig, BiomeCheckResult> {
  protected override whiteList: WhiteListInfo<GitlabLintItem> = { list: {} };
  protected override cacheInfo: LintCacheInfo<{ md5: string; updateTime: number }> = { list: {} };
  constructor(config: BiomeCheckConfig = {}) {
    super('biome', config);
  }
  private optionToArgv(options: Record<string, unknown>) {
    const ignoredKeys = new Set(['_', '$0']);

    return Object.entries(options)
      .map(([key, val]) => {
        if (ignoredKeys.has(key) || !val || Array.isArray(val)) return '';
        if (typeof val === 'boolean') val = val ? '' : '0';
        return `--${key}${val ? `="${String(val as string)}"` : ''}`;
      })
      .filter(Boolean)
      .join(' ');
  }
  protected async getFileList(fileList: string[]) {
    const { config, logger } = this;

    if (this.isCheckAll) {
      const exts = config.extensions.map(d => d.replace(/^\./, '')).join(',');
      const extGlobPattern = `**/*.${config.extensions.length > 1 ? `{${exts}}` : exts}`;
      fileList = [];

      for (const d of config.src) {
        const p = resolve(config.rootDir, d);
        if (!existsSync(p)) continue;
        if (!statSync(p).isDirectory()) {
          fileList.push(p);
          continue;
        }

        const files = await glob(extGlobPattern, { cwd: p, absolute: true });
        fileList.push(...files);
      }
    }

    fileList = this.filesFilter(fileList, !this.isCheckAll);
    logger.info(`Total Files:`, magentaBright(fileList.length));

    const totalFiles = fileList.length;
    let cacheHits = 0;
    const passedFiles = this.cacheInfo.list;

    if (fileList.length > 0 && config.cache && !isEmpty(passedFiles)) {
      fileList = fileList.filter(filepath => {
        const item = passedFiles[fixToshortPath(filepath, config.rootDir)];
        if (!item) return true;
        const fileMd5 = md5(filepath, true);
        const isChanged = fileMd5 !== item.md5;
        if (isChanged) {
          item.md5 = fileMd5;
          item.updateTime = this.stats.startTime;
        }

        return isChanged;
      });

      cacheHits = totalFiles - fileList.length;

      if (cacheHits) logger.info(` - Cache hits:`, cacheHits);
    }

    this.stats.totalFilesNum = totalFiles;
    this.stats.cacheHits = cacheHits;

    return fileList;
  }
  override parseConfig(cfg: BiomeCheckConfig) {
    super.parseConfig(cfg);
    this.config.mode = 'current'; // mode 固定为 current
    return this.config;
  }
  protected async check(fileList = this.config.fileList): Promise<BiomeCheckResult> {
    const { logger, stats, config, whiteList } = this;

    logger.debug('[options]:', this.isCheckAll, config, fileList);
    fileList = await this.getFileList(fileList);

    if (fileList.length === 0) return stats;
    logger.debug('fileList:', fileList);

    if (stats.cacheHits) logger.info(` - Cache hits:`, stats.cacheHits);

    const baseConfig = getConfig();
    const files = this.isCheckAll ? config.src : fileList;
    const biomedir = './node_modules/@biomejs/biome/bin/biome';
    const cmd = [
      existsSync(biomedir) ? `node ${biomedir}` : 'biome',
      'lint --reporter gitlab',
      this.optionToArgv({ ...config.args }),
      baseConfig.fix ? `--write` : ``,
      files.map(f => `"${fixToshortPath(f, config.rootDir)}"`).join(' '),
    ]
      .filter(Boolean)
      .join(' ');

    logger.debug('[biome][cmd]', color.cyanBright(cmd));
    const res = execSync(cmd, 'pipe', config.rootDir, config.debug);
    logger.debug('result:\n', res);

    stats.failedFiles = [];
    let errList: GitlabLintItem[] = [];

    if (res.stderr) {
      const stdout = (res.error as unknown as { stdout: string }).stdout;
      errList = safeJsonParse<GitlabLintItem[]>(stdout.slice(stdout.lastIndexOf('[')).trim());
      if (!Array.isArray(errList)) errList = [];
      errList.forEach(d => {
        d.location.path = d.location.path.replaceAll('\\', '/');
      });
      console.error(`[biome][error]:\n${res.stderr}`, errList);

      stats.failedFiles = this.filesFilter(errList.map(d => resolve(config.rootDir, d.location.path)));
    }

    if (config.toWhiteList) {
      if (errList.length === 0) {
        logger.debug('no new error file');
      } else {
        const whiteList: Record<string, GitlabLintItem> = {};
        errList.forEach(d => {
          whiteList[d.location.path.replaceAll('\\', '/')] = d;
        });

        // if (config.printDetail !== false) logger.info(`\n`, formatter.format(results, lrDataParams));

        logger.info('[ADD]write to whitelist:', cyanBright(fixToshortPath(config.whiteListFilePath, config.rootDir)));
        stats.cacheFiles[config.whiteListFilePath] = { updated: whiteList };
      }
    } else {
      const newErrList = errList.filter(d => !whiteList.list[d.location.path]);
      const removeFromWhiteList = fileList.filter(d => {
        return this.whiteList.list[fixToshortPath(d, config.rootDir)] && !stats.failedFiles.includes(d);
      });

      if (removeFromWhiteList.length > 0) {
        logger.info(' [REMOVE]write to whitelist:', cyanBright(fixToshortPath(config.whiteListFilePath, config.rootDir)));
        stats.cacheFiles[config.whiteListFilePath] = {
          updated: this.whiteList,
          deleted: arrayToObject(removeFromWhiteList),
        };
        logger.info(' remove from whilelist:', fileListToString(removeFromWhiteList));
      }

      if (newErrList.length > 0) {
        stats.isPassed = false;
        logger.info(bold(redBright(`[Error]Verification failed![${newErrList.length} files]`)), `\n`);
      }

      if (stats.isPassed && errList.length > 0) {
        logger.info(
          `[注意] 以下文件在白名单中，但存在异常信息[TOTAL: ${bold(yellowBright(errList.length))} files]：`,
          fileListToString(errList.map(d => fixToshortPath(d.location.path, config.rootDir))),
          '\n'
        );
      }
    }

    stats.failedFilesNum = stats.failedFiles.length;
    stats.isPassed = stats.failedFilesNum === 0;
    if (stats.totalFilesNum >= stats.failedFilesNum) stats.passedFilesNum = stats.totalFilesNum - stats.failedFilesNum;

    if (stats.failedFilesNum > 0) {
      logger.error(`Failed Files(${red(stats.failedFilesNum)}):\n${redBright(stats.failedFiles.map(d => ` - ${d}\n`).join(''))}`);
    }
    // if (stats.fixedFileList.length > 0) logger.info(` - Fixed:\t`, stats.fixedFileList.length);

    return stats;
  }
  protected beforeStart() {
    return Promise.resolve(true);
  }
}
