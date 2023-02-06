/*
 * @Author: lzw
 * @Date: 2021-08-15 22:39:01
 * @LastEditors: lzw
 * @LastEditTime: 2023-01-17 15:23:39
 * @Description:  eslint check
 */

import { bold, red, redBright, yellowBright, cyanBright } from 'console-log-colors';
import type { ESLint } from 'eslint';
import { existsSync, statSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { execSync, fixToshortPath, isGitRepo } from '@lzwme/fe-utils';
import { arrayToObject, fileListToString } from '../utils/index.js';
import { LintBase } from './LintBase.js';
import type { ESLintCheckConfig, LintResult, WhiteListInfo } from '../types.js';

export interface ESLintCheckResult extends LintResult {
  /** warning 类型异常的总数量 */
  warningCount: number;
  /** 可修复的 Error 类异常数量 */
  fixableErrorCount: number;
  /** 可修复的 Warning 类异常数量 */
  fixableWarningCount: number;
  /** 自动修复的错误数量 */
  fixedCount: number;
  /** 本次检测的目录或文件列表 */
  lintList: string[];
  /** 存在 error 异常的文件列表（必须修复，否则应将其规则设置为 warning 级别并生成至白名单中） */
  errorFiles: string[];
  /** 存在 warning 异常的文件列表 */
  warningFiles: string[];
  /** 规则报告异常的数量统计。以 ruleId 为 key */
  rules: Record<string, number>;
}
export class ESLintCheck extends LintBase<ESLintCheckConfig, ESLintCheckResult> {
  protected override whiteList: WhiteListInfo<Record<string, number>> = { list: {} };
  constructor(config: ESLintCheckConfig = {}) {
    super('eslint', config);
  }
  protected override getInitStats() {
    this.stats = {
      ...super.getInitStats(),
      errorCount: 0,
      warningCount: 0,
      fixableErrorCount: 0,
      fixableWarningCount: 0,
      fixedCount: 0,
      lintList: [],
      errorFiles: [],
      warningFiles: [],
      rules: {},
    };
    return this.stats;
  }
  /** 配置参数格式化 */
  public override parseConfig(config: ESLintCheckConfig) {
    config = super.parseConfig(config);
    this.config.extensions = config.extensions || config.eslintOptions.extensions || ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'];

    return this.config;
  }
  /**
   * 获取 ESLint Options
   * @see https://eslint.org/docs/developer-guide/nodejs-api#-new-eslintoptions
   */
  private getESLintOptions(lintList: string[]) {
    const cfg = this.config;
    const option: ESLint.Options = {
      ...cfg.eslintOptions,
      // 存在不以 ts、tsx 结尾的路径、或路径中包含 *，则允许 glob 匹配
      globInputPaths: lintList.some(d => !/\.(j|t)sx?$/.test(d) || d.includes('*')),
      cwd: this.config.rootDir,
      cache: cfg.cache !== false,
      cacheLocation: this.cacheFilePath || cfg.eslintOptions.cacheLocation,
      allowInlineConfig: !cfg.strict,
      fix: !!cfg.fix,
    };

    ['.js', '.cjs', '.mjs', '', '.json'].some(d => {
      const filepath = resolve(cfg.rootDir, `.eslintrc${d}`);
      if (existsSync(filepath)) {
        option.overrideConfigFile = filepath;
        return true;
      }
      return false;
    });

    if (cfg.debug) cfg.silent = false;
    this.logger.debug('eslintOption:', option);

    return option;
  }
  protected async check() {
    this.init();

    this.stats = this.getInitStats();
    const { config, stats, logger, whiteList } = this;
    const lintList = this.isCheckAll ? config.src : config.fileList;

    if (this.isCheckAll) this.logger.info(cyanBright('Checking in'), lintList.join(','));
    else logger.info(' - Total Files:', cyanBright(lintList.length));
    logger.debug('[options]:', config);

    const { ESLint } = await import('eslint');
    const eslint = new ESLint(this.getESLintOptions(lintList));
    const results = await eslint.lintFiles(lintList);
    let errorResults: ESLint.LintResult[] = [];
    /** 不在旧文件白名单中的 warning 类结果 */
    const newErrorReults: ESLint.LintResult[] = [];
    const waringReults: ESLint.LintResult[] = [];
    /** 不在旧文件白名单中的 warning 类结果 */
    const newWaringReults: ESLint.LintResult[] = [];
    /** 在白名单列表中但本次检测无异常的文件列表（将从白名单列表中移除） */
    const removeFromWhiteList: string[] = [];
    const fileRules: { [filepath: string]: Record<string, number> } = {};
    const fixedFileList = new Set<string>();

    // eslint-disable-next-line unicorn/no-array-for-each
    results.forEach(result => {
      const filePath = fixToshortPath(result.filePath, config.rootDir);

      if (config.fix && (result.fixableErrorCount || result.fixableWarningCount)) {
        fixedFileList.add(filePath);
      }

      if (!result.warningCount && !result.errorCount) {
        stats.passedFilesNum++;
        // remove passed files from old whitelist
        if (whiteList.list[filePath]) {
          delete whiteList.list[filePath];
          removeFromWhiteList.push(filePath);
        }
        return;
      }

      // 文件路径过滤
      if (this.filesFilter(filePath).length === 0) return;
      if (!fileRules[filePath]) fileRules[filePath] = {};

      if (Array.isArray(result.messages)) {
        for (const d of result.messages) {
          // ignored  file
          if (d.ruleId) {
            stats.rules[d.ruleId] = (stats.rules[d.ruleId] || 0) + 1;
            fileRules[filePath][d.ruleId] = (fileRules[filePath][d.ruleId] || 0) + 1;
          } else {
            if (/ignore pattern/i.test(d.message)) return;
          }
        }
      }

      stats.failedFilesNum++;
      stats.fixableErrorCount += result.fixableErrorCount;
      stats.fixableWarningCount += result.fixableWarningCount;

      if (result.warningCount) {
        stats.warningCount += result.warningCount;
        if (result.messages.length > 0) {
          waringReults.push(result);
          if (!config.toWhiteList && !whiteList.list[filePath]) newWaringReults.push(result);
        }
      }

      if (result.errorCount) {
        stats.errorCount += result.errorCount;
        if (result.messages.length > 0) {
          errorResults.push(result);
          if (!config.toWhiteList && !whiteList.list[filePath]) newErrorReults.push(result);
        }
      }
    });

    const formatter = await eslint.loadFormatter('stylish');
    stats.isPassed = config.toWhiteList || (newWaringReults.length === 0 && newErrorReults.length === 0);

    if (config.toWhiteList) {
      if (results.length === 0) {
        logger.debug('no new error file');
      } else {
        whiteList.list = fileRules;

        if (config.printDetail !== false) logger.info(`\n`, formatter.format(results));

        logger.info('[ADD]write to whitelist:', cyanBright(fixToshortPath(config.whiteListFilePath, config.rootDir)));
        stats.cacheFiles[config.whiteListFilePath] = { updated: whiteList };
      }
    } else {
      if (removeFromWhiteList.length > 0) {
        logger.info(' [REMOVE]write to whitelist:', cyanBright(fixToshortPath(config.whiteListFilePath, config.rootDir)));
        stats.cacheFiles[config.whiteListFilePath] = {
          updated: whiteList,
          deleted: arrayToObject(removeFromWhiteList),
        };
        logger.info(' remove from whilelist:', fileListToString(removeFromWhiteList));
      }

      const tips = config.warningTip || '';

      if (stats.errorCount && (!config.allowErrorToWhiteList || newErrorReults.length > 0)) {
        stats.isPassed = false;

        errorResults = config.allowErrorToWhiteList ? newErrorReults : errorResults;

        if (config.printDetail !== false) logger.info(`\n ${await formatter.format(errorResults)}`);
        logger.info(bold(redBright(`[Error]Verification failed![${errorResults.length} files]`)), yellowBright(tips), `\n`);

        if (!config.fix && errorResults.length < 20 && errorResults.some(d => d.fixableErrorCount || d.fixableWarningCount)) {
          // 运行此方法可以自动修复语法问题
          logger.info('===================== ↓  ↓ Auto Fix Command ↓  ↓  ============================\n');
          logger.info(
            `node --max_old_space_size=4096 "%~dp0/../node_modules/eslint/bin/eslint.js" --fix ${errorResults
              .map(d => d.filePath.replace(/\\/g, '\\\\'))
              .join(' ')}\n`
          );
          logger.info('===================== ↑  ↑ Auto Fix Command ↑  ↑ ============================\n');
        }
      } else {
        // 不在白名单中的 warning
        if (newWaringReults.length > 0) {
          if (config.printDetail !== false) {
            logger.info(`\n ${await formatter.format(newWaringReults)}\n`);
          }
          logger.info(
            bold(red(`[Warning]Verification failed![${newWaringReults.length} files]`)),
            yellowBright(tips),
            fileListToString(newWaringReults.map(d => fixToshortPath(d.filePath, config.rootDir)))
          );
        }
      }

      if (stats.isPassed && (stats.errorCount || stats.warningCount)) {
        if (config.printDetail !== false && config.printDetialOnSuccessed !== false) {
          logger.info(`\n ${await formatter.format(waringReults)}\n`);
        }

        logger.info(
          `[注意] 以下文件在白名单中，但存在异常信息[TOTAL: ${bold(yellowBright(waringReults.length))} files]${tips}：`,
          fileListToString(waringReults.map(d => fixToshortPath(d.filePath, config.rootDir))),
          '\n'
        );
      }
    }

    Object.assign(stats, {
      fixedCount: config.fix ? stats.fixableErrorCount + stats.fixableWarningCount : 0,
      lintList,
      totalFilesNum: results.length,
      errorFiles: errorResults.map(d => d.filePath), // results.filter(d => d.errorCount).map(d => d.filePath),
      warningFiles: waringReults.map(d => d.filePath), // results.filter(d => d.warningCount).map(d => d.filePath),
    } as ESLintCheckResult);

    if (isGitRepo(config.rootDir) && config.fix && fixedFileList.size > 0) {
      execSync(`git add ${[...fixedFileList].join(' ')}`, 'inherit', config.rootDir);
    }

    return stats;
  }
  protected beforeStart(): boolean {
    if (this.isCheckAll) return true;
    const extensions = new Set(this.config.extensions);

    this.config.fileList = this.config.fileList.filter(filepath => {
      if (extensions.has(extname(filepath))) return true;

      const fullPath = resolve(this.config.rootDir, filepath);
      return existsSync(fullPath) && statSync(fullPath).isDirectory();
    });
    return this.config.fileList.length > 0;
  }
}
