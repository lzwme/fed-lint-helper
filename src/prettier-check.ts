/*
 * @Author: lzw
 * @Date: 2021-08-15 22:39:01
 * @LastEditors: lzw
 * @LastEditTime: 2022-07-28 09:20:57
 * @Description:  prettier check
 */

import { resolve } from 'path';
import { existsSync, statSync, readFileSync, writeFileSync } from 'fs';
import { color } from 'console-log-colors';
import glob from 'fast-glob';
import { isMatch } from 'micromatch';
import { md5, assign, execSync } from '@lzwme/fe-utils';
import { fixToshortPath } from '@lzwme/fe-utils/cjs/node/path';
import { getConfig } from './config';
import type { PrettierCheckConfig } from './types';
import { LintBase, type LintResult } from './LintBase';

export interface PrettierCheckResult extends LintResult {
  /** fix 修正过的文件路径列表 */
  fixedFileList?: string[];
  failedFiles?: string[];
  // fileList: string[];
}

export class PrettierCheck extends LintBase<PrettierCheckConfig, PrettierCheckResult> {
  /** 统计信息 */
  protected override stats = this.getInitStats();

  /** 要缓存到 cacheFilePath 的信息 */
  cacheInfo = {
    /** 已经检测且无异常的文件列表 */
    passed: {} as { [filepath: string]: { md5: string; updateTime: number } },
  };

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
  public parseConfig(config: PrettierCheckConfig) {
    const baseConfig = getConfig();

    if (config !== this.config) config = assign<PrettierCheckConfig>({}, this.config, config);
    this.config = assign<PrettierCheckConfig>({}, baseConfig.prettier, config);

    return this.config;
  }
  protected init() {
    this.cacheInfo = { passed: {} };
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
    const passedFiles = this.cacheInfo.passed;

    if (this.isCheckAll) {
      const extGlobPattern = `**/*.{ts,js,tsx,jsx,json,md,mjs}`;
      fileList = [];

      for (const d of this.config.src) {
        const p = resolve(config.rootDir, d);
        if (!existsSync(p) || !statSync(p).isDirectory()) continue;

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

      fileList = fileList.filter(filepath => {
        const shortpath = fixToshortPath(filepath, config.rootDir);

        const item = passedFiles[shortpath];
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

    const { logger, stats, config, cacheFilePath } = this;

    logger.debug('[options]:', config, fileList);
    fileList = await this.getFileList(fileList);

    if (fileList.length === 0) return stats;

    logger.debug('fileList:', fileList);

    if (config.useCli !== false) {
      const baseConfig = getConfig();
      const files = this.isCheckAll ? config.src : fileList;
      const cmd = [
        `node --max_old_space_size=4096 ./node_modules/prettier/bin-prettier.js`,
        files.map(f => fixToshortPath(f, config.rootDir)).join(' '),
        baseConfig.fix && config.cache ? `--cache` : null,
        baseConfig.fix ? `--write` : `-c`, // `-l`
        config.silent ? `--loglevel=silent` : null,
      ]
        .filter(Boolean)
        .join(' ');

      const res = execSync(cmd, 'pipe', config.rootDir);
      this.logger.debug(cmd, res);
      if (res.stderr) {
        stats.failedFiles = res.stderr
          .trim()
          .split('\n')
          .slice(1, -1)
          .filter(line => {
            if (!line.startsWith('[') || line.includes(' | ')) return false;
            line = fixToshortPath(line.replace(/^\[.+]/, '').trim());
            if (config.exclude?.length > 0) {
              for (const p of config.exclude) {
                if (line.includes(p)) return false;
                if (isMatch(line, p)) return false;
              }
            }
            return true;
          });
      }
    } else {
      const prettier = await import('prettier');
      const options = await this.getOptions(fileList);
      const baseConfig = getConfig();
      const results = fileList.map((filepath, index) => {
        const item = { filepath, passed: true, fixed: false };
        const rawContent = readFileSync(filepath, 'utf8');

        if (!config.silent) this.logger.logInline(`[${index}] ${filepath}`);

        options.filepath = filepath;
        options.parser = ''; // this.getParser(filepath);

        try {
          if (baseConfig.fix) {
            const fixedcontent = prettier.format(rawContent, options);
            item.fixed = rawContent !== fixedcontent;
            if (item.fixed) {
              writeFileSync(filepath, fixedcontent, 'utf8');
              stats.fixedFileList.push(filepath);
            }
          } else {
            item.passed = prettier.check(rawContent, options);
          }
        } catch (error) {
          console.log();
          logger.error(error);
          item.passed = false;
        }
        return item;
      });
      if (!config.silent) console.log();

      const passedFiles = this.cacheInfo.passed;

      for (const d of results) {
        const shortpath = fixToshortPath(d.filepath, config.rootDir);

        if (!d.passed) {
          if (passedFiles[shortpath]) delete passedFiles[shortpath];
          stats.failedFiles.push(shortpath);
        } else {
          if (!passedFiles[shortpath]) {
            passedFiles[shortpath] = {
              md5: existsSync(d.filepath) ? md5(d.filepath, true) : '',
              updateTime: stats.startTime,
            };
          }
        }
      }

      this.saveCache(cacheFilePath, this.cacheInfo);
      if (baseConfig.fix && stats.fixedFileList.length > 0) {
        logger.info(`fixed files(${stats.fixedFileList.length}):\n`, stats.fixedFileList.map(d => ` - ${d}\n`).join(''));
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
  private filesFilter(fileList: string[], isFilterByExt = true) {
    if (!fileList) fileList = [];
    if (fileList.length === 0 || (!isFilterByExt && !this.config.exclude?.length)) return fileList;

    const exts = this.config.extentions?.length ? this.config.extentions : ['ts,js,tsx,jsx,json,md,mjs'];
    const extGlobPattern = `**/*.{${exts.map(d => d.replace(/^\./, '')).join(',')}}`;

    fileList = fileList.filter(filepath => {
      if (this.config.exclude?.length) {
        for (const p of this.config.exclude) {
          if (filepath.includes(p)) return false;
          if (isMatch(filepath, p)) return false;
        }
      }

      if (isFilterByExt) {
        const shortpath = fixToshortPath(filepath, this.config.rootDir);
        return isMatch(shortpath, extGlobPattern);
      }

      return true;
    });

    return fileList;
  }
  protected beforeStart(): boolean {
    if (this.isCheckAll) return this.config.src.length > 0;
    this.config.fileList = this.filesFilter(this.config.fileList);
    return this.config.fileList.length > 0;
  }
}
