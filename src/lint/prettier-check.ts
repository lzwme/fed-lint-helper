/*
 * @Author: lzw
 * @Date: 2021-08-15 22:39:01
 * @LastEditors: renxia
 * @LastEditTime: 2024-04-10 10:47:51
 * @Description:  prettier check
 */

import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assign, execSync, fixToshortPath, isEmpty, isGitRepo, md5 } from '@lzwme/fe-utils';
import { green, greenBright, magentaBright, red, redBright } from 'console-log-colors';
import glob from 'fast-glob';
import { getConfig } from '../config.js';
import type { LintResult, PrettierCheckConfig } from '../types';
import { LintBase } from './LintBase.js';

export interface PrettierCheckResult extends LintResult {
  fixedFileList?: string[];
  failedFiles?: string[];
}

export class PrettierCheck extends LintBase<PrettierCheckConfig, PrettierCheckResult> {
  constructor(config: PrettierCheckConfig = {}) {
    super('prettier', config);
  }
  protected override getInitStats(): PrettierCheckResult {
    this.stats = {
      ...super.getInitStats(),
      fixedFileList: [],
      failedFiles: [],
    };
    return this.stats;
  }
  public override parseConfig(config: PrettierCheckConfig) {
    super.parseConfig(config);
    if (!this.config.extensions?.length) {
      this.config.extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.less', '.scss', '.md'];
    }

    return this.config;
  }
  protected override init() {
    super.init();
    this.cacheInfo = this.getCacheInfo();
  }
  protected async getOptions(_fileList: string[]) {
    const { default: prettier } = await import('prettier');
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
    this.logger.debug('configfile:', cfgFile, cfg, '\n[getOptons]', options);
    return options;
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
      ].filter(Boolean);

      const res = execSync(cmd.join(' '), 'pipe', config.rootDir, config.debug);
      this.logger.debug('result:\n', res);
      if (res.stderr) {
        stats.failedFiles = res.stderr
          .trim()
          .split('\n')
          .slice(1, -1)
          .filter(line => line.startsWith('[') && !line.includes(' | '))
          .map(line => fixToshortPath(line.replace(/^\[.+]/, '').trim()));

        stats.failedFiles = this.filesFilter(stats.failedFiles);
      }
    } else {
      const { default: prettier } = await import('prettier');
      const options = await this.getOptions(fileList);
      const baseConfig = getConfig();
      const results: { filepath: string; passed: boolean; fixed: boolean }[] = [];
      let index = 0;
      for (const filepath of fileList) {
        index++;

        const item = { filepath, passed: true, fixed: false };
        const rawContent = readFileSync(filepath, 'utf8');

        options.filepath = filepath;
        options.parser = ''; // this.getParser(filepath);

        try {
          if (baseConfig.fix) {
            const fixedcontent = await prettier.format(rawContent, options);
            item.fixed = rawContent !== fixedcontent;
            if (item.fixed) {
              writeFileSync(filepath, fixedcontent, 'utf8');
              stats.fixedFileList.push(filepath);
              passedFiles[fixToshortPath(filepath, config.rootDir)] = { md5: md5(filepath, true), updateTime: stats.startTime };
            }
          } else {
            item.passed = await prettier.check(rawContent, options);
          }

          const tipPrefix = item.fixed ? greenBright(`Fixed`) : item.passed ? green('PASS') : red('Failed');
          if (!config.silent && !baseConfig.ci) logger.logInline(` - [${tipPrefix}][${index}] ${filepath}`);
        } catch (error) {
          /* eslint-disable-next-line no-console */
          console.log();
          logger.error(error);
          item.passed = false;
        }

        results.push(item);
      }

      /* eslint-disable-next-line no-console */
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
        if (isGitRepo(baseConfig.rootDir)) {
          execSync(`git add ${stats.fixedFileList.join(' ')}`, 'inherit', baseConfig.rootDir);
        }
      }
    }

    stats.failedFilesNum = stats.failedFiles.length;
    stats.isPassed = stats.failedFilesNum === 0;
    if (stats.totalFilesNum >= stats.failedFilesNum) stats.passedFilesNum = stats.totalFilesNum - stats.failedFilesNum;

    if (stats.failedFilesNum > 0) {
      logger.error(`Failed Files(${red(stats.failedFilesNum)}):\n${redBright(stats.failedFiles.map(d => ` - ${d}\n`).join(''))}`);
    }
    if (stats.fixedFileList.length > 0) logger.info(` - Fixed:\t`, stats.fixedFileList.length);

    return stats;
  }
  protected beforeStart(): boolean {
    if (this.isCheckAll) return true;
    return this.config.fileList.length > 0;
  }
}
