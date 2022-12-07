/*
 * @Author: lzw
 * @Date: 2021-08-15 22:39:01
 * @LastEditors: lzw
 * @LastEditTime: 2022-11-25 17:05:39
 * @Description:  prettier check
 */

import { resolve } from 'node:path';
import { existsSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { color } from 'console-log-colors';
import glob from 'fast-glob';
import { md5, assign, execSync, fixToshortPath } from '@lzwme/fe-utils';
import { getConfig } from '../config.js';
import type { PrettierCheckConfig, LintResult, LintCacheInfo } from '../types.js';
import { LintBase } from './LintBase.js';
import { isGitRepo } from '../utils/common.js';

export interface PrettierCheckResult extends LintResult {
  /** fix 修正过的文件路径列表 */
  fixedFileList?: string[];
  failedFiles?: string[];
}

export class PrettierCheck extends LintBase<PrettierCheckConfig, PrettierCheckResult> {
  /** 统计信息 */
  protected override stats = this.getInitStats();
  /** 要缓存到 cacheFilePath 的信息 */
  override cacheInfo: LintCacheInfo<{ md5: string; updateTime: number }> = { list: {} };
  constructor(config: PrettierCheckConfig = {}) {
    super('prettier', config);
  }
  /** 获取初始化的统计信息 */
  protected override getInitStats() {
    const stats: PrettierCheckResult = {
      ...super.getInitStats(),
      fixedFileList: [],
      failedFiles: [],
    };
    this.stats = stats;
    return stats;
  }
  /** 配置参数格式化 */
  public override parseConfig(config: PrettierCheckConfig) {
    super.parseConfig(config);
    if (!this.config.extensions?.length) {
      this.config.extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.less', '.scss', '.md'];
    }

    return this.config;
  }
  protected override init() {
    super.init();
    this.cacheInfo = { list: {} };
  }
  protected async getOptions(_fileList: string[]) {
    // const baseConfig = getConfig();
    const prettier = await import('prettier');
    const cfgFile = await prettier.resolveConfigFile();
    const cfg = cfgFile ? await prettier.resolveConfig(cfgFile, { editorconfig: true }) : {};
    const config = this.config;
    const options = assign<PrettierCheckConfig['prettierConfig']>(
      {
        ...cfg,
        parser: 'typescript',
      },
      config.prettierConfig
    );
    this.logger.debug('configfile:', cfgFile, cfg);
    this.logger.debug('[getOptons]', options);
    return options;
  }
  protected async getFileList(fileList: string[]) {
    const config = this.config;

    if (this.isCheckAll) {
      const exts = config.extensions.map(d => d.replace(/^\./, '')).join(',');
      const extGlobPattern = `**/*.${config.extensions.length > 1 ? `{${exts}}` : exts}`;
      fileList = [];

      for (const d of this.config.src) {
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
    this.logger.info(`Total Files:`, color.magentaBright(fileList.length));

    const totalFiles = fileList.length;
    let cacheHits = 0;

    if (fileList.length > 0 && config.cache && existsSync(this.cacheFilePath)) {
      assign(this.cacheInfo, JSON.parse(readFileSync(this.cacheFilePath, 'utf8')));

      const passedFiles = this.cacheInfo.list;

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

      if (cacheHits) this.logger.info(` - Cache hits:`, cacheHits);
    }

    this.stats.totalFilesNum = totalFiles;
    this.stats.cacheHits = cacheHits;

    return fileList;
  }
  // private getParser(filepath: string) {
  //   const ext = extname(filepath).slice(1);
  //   switch (ext) {
  //     case 'ts':
  //     case 'tsx':
  //       return 'typescript';
  //   }
  //   return 'json';
  // }
  protected async check(fileList = this.config.fileList): Promise<PrettierCheckResult> {
    this.init();

    const { logger, stats, config } = this;
    const passedFiles = this.cacheInfo.list;

    logger.debug('[options]:', config, fileList);
    fileList = await this.getFileList(fileList);

    if (fileList.length === 0) return stats;

    logger.debug('fileList:', fileList);

    if (config.useCli) {
      const baseConfig = getConfig();
      const files = this.isCheckAll ? config.src : fileList;
      const cmd = [
        `node --max_old_space_size=4096 ./node_modules/prettier/bin-prettier.js`,
        files.map(f => fixToshortPath(f, config.rootDir)).join(' '),
        baseConfig.fix && config.cache ? `--cache` : null,
        baseConfig.fix ? `--write` : `-c`, // `-l`
        config.silent ? `--loglevel=silent` : null,
        '--ignore-unknown',
      ]
        .filter(Boolean)
        .join(' ');

      const res = execSync(cmd, 'pipe', config.rootDir, config.debug);
      this.logger.debug('result:\n', res);
      if (res.stderr) {
        stats.failedFiles = res.stderr
          .trim()
          .split('\n')
          .slice(1, -1)
          .filter(line => {
            if (!line.startsWith('[') || line.includes(' | ')) return false;
            return true;
          })
          .map(line => fixToshortPath(line.replace(/^\[.+]/, '').trim()));

        stats.failedFiles = this.filesFilter(stats.failedFiles);
      }
    } else {
      const prettier = await import('prettier');
      const options = await this.getOptions(fileList);
      const baseConfig = getConfig();
      const results = fileList.map((filepath, index) => {
        const item = { filepath, passed: true, fixed: false };
        const rawContent = readFileSync(filepath, 'utf8');

        options.filepath = filepath;
        options.parser = ''; // this.getParser(filepath);

        try {
          if (baseConfig.fix) {
            const fixedcontent = prettier.format(rawContent, options);
            item.fixed = rawContent !== fixedcontent;
            if (item.fixed) {
              writeFileSync(filepath, fixedcontent, 'utf8');
              stats.fixedFileList.push(filepath);
              passedFiles[fixToshortPath(filepath, config.rootDir)] = { md5: md5(filepath, true), updateTime: stats.startTime };
            }
          } else {
            item.passed = prettier.check(rawContent, options);
          }

          const tipPrefix = item.fixed ? color.greenBright(`Fixed`) : item.passed ? color.green('PASS') : color.red('Failed');
          if (!config.silent && !baseConfig.ci) this.logger.logInline(` - [${tipPrefix}][${index}] ${filepath}`);
        } catch (error) {
          console.log();
          logger.error(error);
          item.passed = false;
        }
        return item;
      });

      console.log();

      for (const d of results) {
        const shortpath = fixToshortPath(d.filepath, config.rootDir);

        if (d.passed) {
          if (!passedFiles[shortpath]) {
            passedFiles[shortpath] = {
              md5: existsSync(d.filepath) ? md5(d.filepath, true) : '',
              updateTime: stats.startTime,
            };
          }
        } else {
          if (passedFiles[shortpath]) delete passedFiles[shortpath];
          stats.failedFiles.push(shortpath);
        }
      }

      this.stats.cacheFiles[this.cacheFilePath] = { updated: this.cacheInfo };
      if (baseConfig.fix && stats.fixedFileList.length > 0) {
        logger.info(`fixed files(${stats.fixedFileList.length}):\n`, stats.fixedFileList.map(d => ` - ${d}\n`).join(''));
        if (isGitRepo(baseConfig.rootDir)) execSync(`git add --update`);
      }
    }

    stats.failedFilesNum = stats.failedFiles.length;
    stats.isPassed = stats.failedFilesNum === 0;
    if (stats.totalFilesNum >= stats.failedFilesNum) stats.passedFilesNum = stats.totalFilesNum - stats.failedFilesNum;

    if (stats.failedFilesNum > 0) {
      logger.error(
        `Failed Files(${color.red(stats.failedFilesNum)}):\n` + color.redBright(stats.failedFiles.map(d => ` - ${d}\n`).join(''))
      );
    }
    if (stats.fixedFileList.length > 0) logger.info(` - Fixed:\t`, stats.fixedFileList.length);

    return stats;
  }
  protected beforeStart(): boolean {
    if (this.isCheckAll) return true;
    return this.config.fileList.length > 0;
  }
}
