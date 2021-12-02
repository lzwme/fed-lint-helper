/*
 * @Author: lzw
 * @Date: 2021-08-15 22:39:01
 * @LastEditors: lzw
 * @LastEditTime: 2021-12-02 21:27:20
 * @Description:  eslint check
 */

import { color } from 'console-log-colors';
import { ESLint } from 'eslint';
import fs from 'fs';
import path from 'path';
import { fixToshortPath, exit, createForkThread, assign, Logger, execSync } from './utils';
import { ESLintCheckConfig, getConfig } from './config';

const { bold, red, redBright, yellowBright, greenBright, cyanBright } = color;

export interface ESLintCheckResult {
  isPassed: boolean;
  total: number;
  errorCount: number;
  warningCount: number;
  fixableErrorCount: number;
  fixableWarningCount: number;
  fixedCount: number;
  lintList: string[];
  errorFiles: string[];
  warningFiles: string[];
}
export class ESLintCheck {
  /** 统计信息 */
  private stats = this.getInitStats();
  /** 白名单列表 */
  private whiteList = {} as { [filepath: string]: 'e' | 'w' }; // ts.DiagnosticCategory
  /** 缓存文件路径（eslintOptions.cacheLocation）。默认为 <config.rootDir>/node_modules/.cache/flh/eslintcache.json */
  private cacheFilePath = 'node_modules/.cache/flh/eslintcache.json';
  private logger: Logger;

  constructor(private config: ESLintCheckConfig = {}) {
    config = this.parseConfig(config);
    const level = config.silent ? 'silent' : config.debug ? 'debug' : 'log';
    this.logger = Logger.getLogger(`[ESLint]`, level);
    this.logger.debug('config', this.config);
    if (config.checkOnInit) this.start();
  }
  /** 获取初始化的统计信息 */
  private getInitStats() {
    const stats = {
      /** 最近一次处理是否成功 */
      success: false,
      /** 最近一次处理的开始时间 */
      startTime: Date.now(),
      /** 匹配到的 ts 文件总数 */
      totalFiles: 0,
      /** 规则报告异常的数量统计。以 ruleId 为 key */
      rules: {} as Record<string, number>,
    };
    this.stats = stats;
    return stats;
  }
  /** 返回执行结果统计信息 */
  public get statsInfo() {
    return this.stats;
  }
  /** 配置参数格式化 */
  public parseConfig(config: ESLintCheckConfig) {
    const baseConfig = getConfig();

    if (config !== this.config) config = assign<ESLintCheckConfig>({}, this.config, config);
    this.config = assign<ESLintCheckConfig>({}, baseConfig.eslint, config);
    this.cacheFilePath = path.resolve(this.config.rootDir, baseConfig.cacheLocation, 'tsCheckCache.json');
    this.config.whiteListFilePath = path.resolve(this.config.rootDir, this.config.whiteListFilePath);
    return this.config;
  }
  private init() {
    const config = this.config;

    if (fs.existsSync(this.cacheFilePath) && config.removeCache) fs.unlinkSync(this.cacheFilePath);

    // 读取白名单列表
    if (fs.existsSync(config.whiteListFilePath)) {
      // && !config.toWhiteList
      this.whiteList = JSON.parse(fs.readFileSync(config.whiteListFilePath, { encoding: 'utf-8' }));
    }
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
      // rulePaths: ['./pipelines/eslint-rules/'],
      ...cfg.eslintOptions,
      // 存在不以 ts、tsx 结尾的路径、或路径中包含 *，则允许 glob 匹配
      globInputPaths: lintList.some(d => !/\.tsx?$/.test(d) || d.includes('*')),
      cwd: this.config.rootDir,
      cache: cfg.cache !== false,
      cacheLocation: this.cacheFilePath || cfg.eslintOptions.cacheLocation,
      allowInlineConfig: !cfg.strict,
      fix: !!cfg.fix,
    };

    ['.eslintrc.js', '.eslintrc', '.eslintrc.json'].some(d => {
      const filepath = path.resolve(cfg.rootDir, d);
      if (fs.existsSync(filepath)) {
        option.overrideConfigFile = filepath;
        return true;
      }
    });

    if (cfg.debug) cfg.silent = false;
    this.logger.debug('eslintOption:', option);

    return option;
  }

  /**
   * 执行 eslint 校验
   */
  private async check(lintList = this.config.src) {
    this.logger.info('start checking');
    this.init();

    const config = this.config;
    const stats = this.stats;

    this.logger.debug('[options]:', config);
    this.logger.debug(`TOTAL:`, lintList.length, `, Files:\n`, lintList);

    const eslint = new ESLint(this.getESLintOptions(lintList));
    const results = await eslint.lintFiles(lintList);
    const errorReults: ESLint.LintResult[] = [];
    /** 不在旧文件白名单中的 warning 类结果 */
    const newErrorReults: ESLint.LintResult[] = [];
    const waringReults: ESLint.LintResult[] = [];
    /** 不在旧文件白名单中的 warning 类结果 */
    const newWaringReults: ESLint.LintResult[] = [];
    /** 在白名单列表中但本次检测无异常的文件列表（将从白名单列表中移除） */
    const removeFromWhiteList = [];
    let errorCount = 0;
    let warningCount = 0;
    let fixableErrorCount = 0;
    let fixableWarningCount = 0;

    results.forEach(result => {
      const filePath = fixToshortPath(result.filePath, config.rootDir);

      if (!result.warningCount && !result.errorCount) {
        // remove passed files from old whitelist
        if (this.whiteList[filePath]) {
          delete this.whiteList[filePath];
          removeFromWhiteList.push(filePath);
        }
        return;
      }

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

      fixableErrorCount += result.fixableErrorCount;
      fixableWarningCount += result.fixableWarningCount;

      if (result.warningCount) {
        warningCount += result.warningCount;
        if (result.messages.length) waringReults.push(result);

        if (config.toWhiteList) {
          this.whiteList[filePath] = 'w';
        } else if (!this.whiteList[filePath]) {
          if (result.messages.length) newWaringReults.push(result);
        }
      }

      if (result.errorCount) {
        errorCount += result.errorCount;
        if (result.messages.length) errorReults.push(result);

        if (config.toWhiteList) {
          this.whiteList[filePath] = 'e';
        } else if (!this.whiteList[filePath]) {
          if (result.messages.length) newErrorReults.push(result);
        }
      }
    });

    const formatter = await eslint.loadFormatter('stylish');
    let isPassed = !newWaringReults.length && !newErrorReults.length;

    if (config.toWhiteList) {
      if (!results.length) {
        this.logger.debug('no new error file');
      } else {
        this.logger.info('[ADD]write to whitelist:', cyanBright(fixToshortPath(config.whiteListFilePath, config.rootDir)));
        fs.writeFileSync(config.whiteListFilePath, JSON.stringify(this.whiteList, null, 2));
        execSync(`git add ${config.whiteListFilePath}`, null, config.rootDir, !config.silent);
        if (config.printDetail !== false) {
          const resultText = formatter.format(results);
          this.logger.info(`\n ${resultText}`);
        }
      }
    } else {
      if (removeFromWhiteList.length) {
        this.logger.info(' [REMOVE]write to whitelist:', cyanBright(fixToshortPath(config.whiteListFilePath, config.rootDir)));
        fs.writeFileSync(config.whiteListFilePath, JSON.stringify(this.whiteList, null, 2));
        this.logger.info(' remove from whilelist:\n' + removeFromWhiteList.join('\n'));
        execSync(`git add ${config.whiteListFilePath}`, null, config.rootDir, !config.silent);
      }

      const tips = config.warningTip || '';

      // 存在 error 异常
      if (errorCount && (!config.allowErrorToWhiteList || newErrorReults.length)) {
        isPassed = false;

        const errResults = config.allowErrorToWhiteList ? newErrorReults : errorReults;

        if (config.printDetail !== false) {
          const resultText = formatter.format(errResults);
          this.logger.info(`\n ${resultText}`);
        }
        this.logger.info(bold(redBright(`[Error]Verification failed![${errResults.length} files]`)), yellowBright(tips), `\n`);

        if (!config.fix && errorReults.length < 20 && errResults.some(d => d.fixableErrorCount || d.fixableWarningCount)) {
          // 运行此方法可以自动修复语法问题
          this.logger.info('===================== ↓  ↓ Auto Fix Command ↓  ↓  ============================\n');
          this.logger.info(
            `node --max_old_space_size=4096 "%~dp0/../node_modules/eslint/bin/eslint.js" --fix ${errResults
              .map(d => d.filePath.replace(/[\\]/g, '\\\\'))
              .join(' ')}\n`
          );
          this.logger.info('===================== ↑  ↑ Auto Fix Command ↑  ↑ ============================\n');
        }
      } else {
        // 不在白名单中的 warning
        if (newWaringReults.length) {
          this.logger.info(
            bold(red(`[Warning]Verification failed![${newWaringReults.length} files]`)),
            yellowBright(tips),
            `\n` + newWaringReults.map(d => fixToshortPath(d.filePath, config.rootDir)).join('\n')
          );
          if (config.printDetail !== false) {
            const resultText = formatter.format(newWaringReults);
            this.logger.info(`\n ${resultText}\n`);
          }
        }
      }

      if (isPassed) {
        if (errorCount || warningCount) {
          this.logger.info(
            `[注意] 以下文件在白名单中，但存在异常信息[TOTAL: ${bold(yellowBright(waringReults.length))} files]${tips}：`,
            '\n' + waringReults.map(d => fixToshortPath(d.filePath, config.rootDir)).join('\n'),
            '\n'
          );
          if (config.printDetail !== false) {
            const resultText = formatter.format(waringReults);
            this.logger.info(`\n ${resultText}\n`);
          }
          // if (config.strict) exit(results.length, stats.startTime, '[ESLint]');
        }

        this.logger.info(bold(greenBright('Verification passed!')));
      } else {
        if (this.config.exitOnError) exit(1, stats.startTime, '[ESLint]');
      }
    }

    stats.success = isPassed;
    this.logger.info(`TimeCost: ${bold(greenBright(Date.now() - stats.startTime))}ms`);

    const info = {
      /** 是否检测通过 */
      isPassed,
      /** 文件总数 */
      total: results.length,
      /** error 类型异常的总数量 */
      errorCount,
      /** warning 类型异常的总数量 */
      warningCount,
      // newErrCount: newErrorReults.length,
      // newWarningCount: newWaringReults.length,
      /** 可修复的 Error 类异常数量 */
      fixableErrorCount,
      /** 可修复的 Warning 类异常数量 */
      fixableWarningCount,
      /** 自动修复的错误数量 */
      fixedCount: config.fix ? fixableErrorCount + fixableWarningCount : 0,
      /** 本次检测的目录或文件列表 */
      lintList,
      /** 存在 error 异常的文件列表（必须修复，否则应将其规则设置为 warning 级别并生成至白名单中） */
      errorFiles: errorReults.map(d => d.filePath), // results.filter(d => d.errorCount).map(d => d.filePath),
      /** 存在 warning 异常的文件列表 */
      warningFiles: waringReults.map(d => d.filePath), // results.filter(d => d.warningCount).map(d => d.filePath),
      // /** LintResult，用于 API 调用自行处理相关逻辑 */
      // results,
    };

    return info;
  }
  /**
   * 在 fork 子进程中执行
   */
  private checkInChildProc() {
    this.logger.info('start fork child progress');

    return createForkThread<ESLintCheckResult>({
      type: 'eslint',
      debug: this.config.debug,
      eslintConfig: this.config,
    })
      .then(d => {
        if (!d.isPassed && this.config.exitOnError) process.exit(d.errorCount || -1);
        return d;
      })
      .catch(code => this.config.exitOnError && process.exit(code));
  }
  /**
   * 在 work_threads 子线程中执行
   */
  private checkInWorkThreads() {
    this.logger.info('start create work threads');

    return import('./utils/worker-threads').then(({ createWorkerThreads }) => {
      return createWorkerThreads<ESLintCheckResult>({
        type: 'eslint',
        debug: this.config.debug,
        eslintConfig: this.config,
      })
        .then(d => {
          if (!d.isPassed && this.config.exitOnError) process.exit(d.errorCount || -1);
          return d;
        })
        .catch(code => this.config.exitOnError && process.exit(code));
    });
  }
  /**
   * 启动 eslint 校验
   */
  async start(lintList?: string[]) {
    if (lintList) {
      // 只处理 ts、tsx、js、jsx 后缀的文件
      lintList = lintList.filter(filepath => !filepath.includes('.') || /\.(js|ts)x?$/i.test(filepath));
      this.config.src = lintList;
    }
    this.init();

    if (!this.config.src.length) {
      this.logger.info('No files to process\n');
      return false;
    }

    if (this.config.mode === 'current') return this.check(lintList);
    if (this.config.mode === 'thread') return this.checkInWorkThreads();
    return this.checkInChildProc();
  }
}
