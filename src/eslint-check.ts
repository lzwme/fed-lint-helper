/*
 * @Author: lzw
 * @Date: 2021-08-15 22:39:01
 * @LastEditors: lzw
 * @LastEditTime: 2021-08-21 17:54:48
 * @Description:  eslint check
 */

import chalk from 'chalk';
import { ESLint } from 'eslint';
import fs from 'fs';
import path from 'path';
import * as utils from './utils';

export interface ESLintCheckConfig {
  /** 是否自动修正可修复的 eslint 错误，同 ESLint.Option。默认 false。建议不设置为 true，手动逐个文件处理以避免造成大量不可控的业务代码变动 */
  fix?: boolean;
  /** 要执行 lint 的源码目录，默认为 ['src'] */
  src?: string[];
  /** 项目根目录，默认为当前工作目录 */
  rootDir?: string;
  /** 本次 check 是否使用缓存。默认为 true。当 eslint 升级、规则变更、CI 执行 MR 时建议设置为 false */
  cache?: boolean;
  /** 是否移除缓存文件。设置为 true 将移除缓存并生成新的。默认 false */
  removeCache?: boolean;
  /** eslint 缓存文件路径（eslintOptions.cacheLocation）。不应提交至 git 仓库。默认为 `<config.rootDir>/node_modules/.cache/flh/eslintcache.json` */
  cacheFilePath?: string;
  /** 白名单列表文件保存的路径，用于过滤允许出错的历史文件。默认为 `<config.rootDir>/eslintWhitelist.json` 文件 */
  whiteListFilePath?: string;
  /** 初始化即执行check。默认为 true。设置为 false 则需自行调用 start 方法 */
  checkOnInit?: boolean;
  /** 是否开启调试模式(打印更多的细节) */
  debug?: boolean;
  /** 静默模式。不打印任何信息，一般用于接口调用 */
  silent?: boolean;
  /** 执行完成时存在 lint 异常，是否退出程序。默认为 true */
  exitOnError?: boolean;
  /** 警告提示附加信息 */
  warningTip?: string;
  /**
   * 是否将异常文件输出至白名单列表文件中。默认为 false。
   * 追加模式，如需全新生成，应先删除白名单文件。
   * 初始化、规则变更、版本升级导致新增异常，但又不能立即修复的情况下，可设置为 true 执行一次
   */
  toWhiteList?: boolean;
  /** 是否允许 Error 类型也可通过白名单过滤。默认为 false */
  allowErrorToWhiteList?: boolean;
  /** ESLint Options。部分配置项会被内置修正 */
  eslintOptions?: ESLint.Options;
  /** 严格模式。默认禁止文件内的 eslint 配置标记 */
  strict?: boolean;
}

export class ESLintCheck {
  /** 统计信息 */
  private stats = this.getInitStats();
  /** 白名单列表 */
  private whiteList = {} as { [filepath: string]: 'e' | 'w' }; // ts.DiagnosticCategory

  constructor(private config: ESLintCheckConfig = {}) {
    this.parseConfig(config);
    if (this.config.checkOnInit) this.start();
  }
  /** 打印日志 */
  private printLog(...args) {
    if (this.config.silent) return;
    if (!args.length) console.log();
    else console.log(chalk.cyan('[ESLint]'), ...args);
  }
  /** 获取初始化的统计信息 */
  private getInitStats() {
    const stats = {
      startTime: Date.now(),
      /** 匹配到的 ts 文件总数 */
      totalFiles: 0,
    };
    this.stats = stats;
    return stats;
  }
  public parseConfig(config: ESLintCheckConfig) {
    if (config !== this.config) config = Object.assign({}, this.config, config);
    this.config = Object.assign(
      {
        rootDir: process.cwd(),
        src: ['src'],
        cache: true,
        removeCache: false,
        cacheFilePath: 'node_modules/.cache/flh/eslintcache.json',
        whiteListFilePath: 'eslintWhitelist.json',
        debug: !!process.env.DEBUG,
        exitOnError: true,
        checkOnInit: true,
        warningTip: `[errors-必须修复；warnings-历史文件选择性处理(对于历史文件慎重修改 == 类问题)]`,
      } as ESLintCheckConfig,
      config
    );

    this.config.eslintOptions = Object.assign(
      {
        extensions: ['ts', 'tsx'],
        errorOnUnmatchedPattern: false,
      },
      config.eslintOptions
    );

    this.config.cacheFilePath = path.resolve(this.config.rootDir, this.config.cacheFilePath);
    this.config.whiteListFilePath = path.resolve(this.config.rootDir, this.config.whiteListFilePath);
  }
  private init() {
    const config = this.config;

    if (fs.existsSync(config.cacheFilePath) && config.removeCache) fs.unlinkSync(config.cacheFilePath);

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
      cacheLocation: cfg.cacheFilePath || cfg.eslintOptions.cacheLocation,
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

    if (cfg.debug) {
      cfg.silent = false;
      this.printLog('eslintOption:', option);
    }

    return option;
  }

  /**
   * 执行 eslint 校验
   */
  async start(lintList = this.config.src) {
    this.init();

    const config = this.config;
    const stats = this.stats;

    if (config.debug) this.printLog('[options]:', config);

    if (!lintList.length) {
      this.printLog('No files to processed\n');
      return false;
    }

    if (config.debug) this.printLog('[debug]', `TOTAL:`, lintList.length, `, Files:\n`, lintList);

    const eslint = new ESLint(this.getESLintOptions(lintList));
    const results = await eslint.lintFiles(lintList);
    const errorReults: ESLint.LintResult[] = [];
    /** 不在旧文件白名单中的 warning 类结果 */
    const newErrorReults: ESLint.LintResult[] = [];
    const waringReults: ESLint.LintResult[] = [];
    /** 不在旧文件白名单中的 warning 类结果 */
    const newWaringReults: ESLint.LintResult[] = [];
    let errorCount = 0;
    let warningCount = 0;
    let fixableErrorCount = 0;
    let fixableWarningCount = 0;

    results.forEach(result => {
      const filePath = utils.fixToshortPath(result.filePath);

      if (!result.warningCount && !result.errorCount) {
        // remove passed files from old whitelist
        if (this.whiteList[filePath]) delete this.whiteList[filePath];
        return;
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
        this.printLog('no new error file');
      } else {
        this.printLog(' write whitelist to file:', chalk.cyanBright(config.whiteListFilePath));
        fs.writeFileSync(config.whiteListFilePath, JSON.stringify(this.whiteList, null, 2));
        const resultText = formatter.format(results);
        this.printLog(`\n ${resultText}`);
      }
    } else {
      const tips = config.warningTip || '';

      // 存在 error 异常
      if (errorCount && (!config.allowErrorToWhiteList || newErrorReults.length)) {
        isPassed = false;

        const errResults = config.allowErrorToWhiteList ? newErrorReults : errorReults;
        const resultText = formatter.format(errResults);
        this.printLog(`\n ${resultText}`);
        this.printLog(chalk.bold.redBright(`[Error]Verification failed![${errResults.length} files]`), chalk.yellowBright(tips), `\n`);

        if (!config.fix && errorReults.length < 20 && errResults.some(d => d.fixableErrorCount || d.fixableWarningCount)) {
          // 运行此方法可以自动修复语法问题
          this.printLog('===================== ↓  ↓ Auto Fix Command ↓  ↓  ============================\n');
          this.printLog(
            `node --max_old_space_size=4096 "%~dp0/../node_modules/eslint/bin/eslint.js" --fix ${errResults
              .map(d => d.filePath)
              .map(f => f.replace(/[\\]/g, '\\\\'))
              .join(' ')}\n`
          );

          this.printLog('===================== ↑  ↑ Auto Fix Command ↑  ↑ ============================\n');
        }
      } else {
        // 不在白名单中的 warning
        if (newWaringReults.length) {
          const resultText = formatter.format(newWaringReults);
          this.printLog(chalk.bold.red(`[Warning]Verification failed![${newWaringReults.length} files]`), chalk.yellowBright(tips), `\n`);
          this.printLog(newWaringReults.map(d => d.filePath).join('\n'));
          this.printLog(`\n ${resultText}\n`);
        }
      }

      if (isPassed) {
        if (errorCount || warningCount) {
          const resultText = formatter.format(waringReults);
          this.printLog(
            `[注意] 以下文件在白名单中，但存在异常信息[TOTAL: ${chalk.bold.yellowBright(waringReults.length)} files]${tips}：\n`,
            waringReults.map(d => d.filePath).join('\n'),
            '\n'
          );
          this.printLog(`\n ${resultText}\n`);
          // if (config.strict) utils.exit(results.length, stats.startTime, '[ESLint]');
        }

        this.printLog(chalk.bold.greenBright('Verification passed'));
      } else {
        if (this.config.exitOnError) utils.exit(1, stats.startTime, '[ESLint]');
      }
    }

    this.printLog(`TimeCost: ${chalk.bold.greenBright(Date.now() - stats.startTime)}ms`);

    const info = {
      /** 是否检测通过 */
      isPassed,
      /** 异常文件总数 */
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
      /** LintResult，用于 API 调用自行处理相关逻辑 */
      results,
    };

    return info;
  }
}
