/*
 * @Author: lzw
 * @Date: 2021-08-15 22:39:01
 * @LastEditors: lzw
 * @LastEditTime: 2022-10-27 15:38:08
 * @Description:  eslint check
 */

import { color } from 'console-log-colors';
import type { ESLint } from 'eslint';
import { existsSync, statSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { fixToshortPath } from '@lzwme/fe-utils';
import { arrayToObject } from './utils';
import { LintBase, type LintResult } from './LintBase';
import type { ESLintCheckConfig } from './types';

const { bold, red, redBright, yellowBright, cyanBright } = color;

export interface ESLintCheckResult extends LintResult {
  /** error 类型异常的总数量 */
  errorCount: number;
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
  protected override whiteList: { [filepath: string]: 'e' | 'w' } = {};
  constructor(config: ESLintCheckConfig = {}) {
    super('eslint', config);
  }
  /** 获取初始化的统计信息 */
  protected override getInitStats() {
    const stats: ESLintCheckResult = {
      ...super.getInitStats(),
      errorCount: 0,
      warningCount: 0,
      fixableErrorCount: 0,
      fixableWarningCount: 0,
      fixedCount: 0,
      lintList: [],
      errorFiles: [],
      warningFiles: [],
      rules: {} as Record<string, number>,
    };
    this.stats = stats;
    return stats;
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
      // overrideConfigFile: './.eslintrc.js',
      // ignore: true,
      // overrideConfig: cfg.eslintOptions.overrideConfig,
      ...cfg.eslintOptions,
      // 存在不以 ts、tsx 结尾的路径、或路径中包含 *，则允许 glob 匹配
      globInputPaths: lintList.some(d => !/\.(j|t)sx?$/.test(d) || d.includes('*')),
      cwd: this.config.rootDir,
      cache: cfg.cache !== false,
      cacheLocation: this.cacheFilePath || cfg.eslintOptions.cacheLocation,
      allowInlineConfig: !cfg.strict,
      fix: !!cfg.fix,
    };

    ['.eslintrc.js', '.eslintrc', '.eslintrc.json'].some(d => {
      const filepath = resolve(cfg.rootDir, d);
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

  /**
   * 执行 eslint 校验
   */
  protected async check() {
    this.init();

    this.stats = this.getInitStats();
    const { config, stats, logger } = this;
    const lintList = this.isCheckAll ? config.src : config.fileList;

    if (this.isCheckAll) this.logger.info(cyanBright('Checking'), lintList);
    else logger.info(' - Total Files:', cyanBright(lintList.length));
    logger.debug('[options]:', config);

    const { ESLint } = await import('eslint');
    const eslint = new ESLint(this.getESLintOptions(lintList));
    const results = await eslint.lintFiles(lintList);
    const errorReults: ESLint.LintResult[] = [];
    /** 不在旧文件白名单中的 warning 类结果 */
    const newErrorReults: ESLint.LintResult[] = [];
    const waringReults: ESLint.LintResult[] = [];
    /** 不在旧文件白名单中的 warning 类结果 */
    const newWaringReults: ESLint.LintResult[] = [];
    /** 在白名单列表中但本次检测无异常的文件列表（将从白名单列表中移除） */
    const removeFromWhiteList: string[] = [];

    // eslint-disable-next-line unicorn/no-array-for-each
    results.forEach(result => {
      const filePath = fixToshortPath(result.filePath, config.rootDir);

      if (!result.warningCount && !result.errorCount) {
        stats.passedFilesNum++;
        // remove passed files from old whitelist
        if (this.whiteList[filePath]) {
          delete this.whiteList[filePath];
          removeFromWhiteList.push(filePath);
        }
        return;
      }

      // 文件路径过滤
      if (this.filesFilter(filePath).length === 0) return;

      if (Array.isArray(result.messages)) {
        for (const d of result.messages) {
          // ignored  file
          if (!d.ruleId) {
            if (/ignore pattern/.test(d.message)) return;
          } else {
            stats.rules[d.ruleId] = (stats.rules[d.ruleId] || 0) + 1;
          }
        }
      }

      stats.failedFilesNum++;
      stats.fixableErrorCount += result.fixableErrorCount;
      stats.fixableWarningCount += result.fixableWarningCount;

      if (result.warningCount) {
        stats.warningCount += result.warningCount;
        if (result.messages.length > 0) waringReults.push(result);

        if (config.toWhiteList) {
          this.whiteList[filePath] = 'w';
        } else if (!this.whiteList[filePath] && result.messages.length > 0) newWaringReults.push(result);
      }

      if (result.errorCount) {
        stats.errorCount += result.errorCount;
        if (result.messages.length > 0) errorReults.push(result);

        if (config.toWhiteList) {
          this.whiteList[filePath] = 'e';
        } else if (!this.whiteList[filePath] && result.messages.length > 0) newErrorReults.push(result);
      }
    });

    const formatter = await eslint.loadFormatter('stylish');
    stats.isPassed = newWaringReults.length === 0 && newErrorReults.length === 0;

    if (config.toWhiteList) {
      if (results.length === 0) {
        this.logger.debug('no new error file');
      } else {
        if (config.printDetail !== false) {
          const resultText = formatter.format(results);
          this.logger.info(`\n ${resultText}`);
        }
        this.logger.info('[ADD]write to whitelist:', cyanBright(fixToshortPath(config.whiteListFilePath, config.rootDir)));
        // this.saveCache(config.whiteListFilePath, this.whiteList);
        this.stats.cacheFiles[config.whiteListFilePath] = {
          updated: this.whiteList,
          deleted: {},
        };
      }
    } else {
      if (removeFromWhiteList.length > 0) {
        this.logger.info(' [REMOVE]write to whitelist:', cyanBright(fixToshortPath(config.whiteListFilePath, config.rootDir)));
        // this.saveCache(config.whiteListFilePath, this.whiteList, true);
        this.stats.cacheFiles[config.whiteListFilePath] = {
          updated: this.whiteList,
          deleted: arrayToObject(removeFromWhiteList),
        };
        this.logger.info(' remove from whilelist:\n' + removeFromWhiteList.join('\n'));
      }

      const tips = config.warningTip || '';

      // 存在 error 异常
      if (stats.errorCount && (!config.allowErrorToWhiteList || newErrorReults.length > 0)) {
        stats.isPassed = false;

        const errorResults = config.allowErrorToWhiteList ? newErrorReults : errorReults;

        if (config.printDetail !== false) {
          const resultText = formatter.format(errorResults);
          this.logger.info(`\n ${resultText}`);
        }
        this.logger.info(bold(redBright(`[Error]Verification failed![${errorResults.length} files]`)), yellowBright(tips), `\n`);

        if (!config.fix && errorReults.length < 20 && errorResults.some(d => d.fixableErrorCount || d.fixableWarningCount)) {
          // 运行此方法可以自动修复语法问题
          this.logger.info('===================== ↓  ↓ Auto Fix Command ↓  ↓  ============================\n');
          this.logger.info(
            `node --max_old_space_size=4096 "%~dp0/../node_modules/eslint/bin/eslint.js" --fix ${errorResults
              .map(d => d.filePath.replace(/\\/g, '\\\\'))
              .join(' ')}\n`
          );
          this.logger.info('===================== ↑  ↑ Auto Fix Command ↑  ↑ ============================\n');
        }
      } else {
        // 不在白名单中的 warning
        if (newWaringReults.length > 0) {
          if (config.printDetail !== false) {
            const resultText = formatter.format(newWaringReults);
            this.logger.info(`\n ${resultText}\n`);
          }
          this.logger.info(
            bold(red(`[Warning]Verification failed![${newWaringReults.length} files]`)),
            yellowBright(tips),
            `\n` + newWaringReults.map(d => fixToshortPath(d.filePath, config.rootDir)).join('\n')
          );
        }
      }

      if (stats.isPassed && (stats.errorCount || stats.warningCount)) {
        if (config.printDetail !== false && config.printDetialOnSuccessed !== false) {
          const resultText = formatter.format(waringReults);
          this.logger.info(`\n ${resultText}\n`);
        }

        this.logger.info(
          `[注意] 以下文件在白名单中，但存在异常信息[TOTAL: ${bold(yellowBright(waringReults.length))} files]${tips}：`,
          '\n' + waringReults.map(d => fixToshortPath(d.filePath, config.rootDir)).join('\n'),
          '\n'
        );
      }
    }
    Object.assign(this.stats, {
      fixedCount: config.fix ? stats.fixableErrorCount + stats.fixableWarningCount : 0,
      lintList,
      totalFilesNum: results.length,
      errorFiles: errorReults.map(d => d.filePath), // results.filter(d => d.errorCount).map(d => d.filePath),
      warningFiles: waringReults.map(d => d.filePath), // results.filter(d => d.warningCount).map(d => d.filePath),
      // results,
      // newErrCount: newErrorReults.length,
      // newWarningCount: newWaringReults.length,
    } as ESLintCheckResult);

    return this.stats;
  }
  protected beforeStart(): boolean {
    const extensions = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']);

    this.config.fileList = this.config.fileList.filter(filepath => {
      if (extensions.has(extname(filepath))) return true;

      const fullPath = resolve(this.config.rootDir, filepath);
      return existsSync(fullPath) && statSync(fullPath).isDirectory();
    });
    return this.config.fileList.length > 0;
  }
}
