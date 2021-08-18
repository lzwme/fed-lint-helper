/*
 * @Author: lzw
 * @Date: 2021-08-15 22:39:01
 * @LastEditors: lzw
 * @LastEditTime: 2021-08-18 14:07:34
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
  /** eslint 检测通过文件的缓存。不应提交至 git 仓库。默认为 `<config.rootDir>/node_modules/.cache/flh/eslintcache.json` */
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
  /**
   * 是否将异常文件输出至白名单列表文件中。默认为 false。
   * 追加模式，如需全新生成，应先删除白名单文件。
   * 初始化、规则变更、版本升级导致新增异常，但又不能立即修复的情况下，可设置为 true 执行一次
   */
  toWhiteList?: boolean;
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
    console.log(...args);
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
  private parseConfig(config: ESLintCheckConfig) {
    this.config = Object.assign(
      {
        rootDir: process.cwd(),
        src: ['src'],
        exclude: ['**/*.test.{ts,tsx}', '**/*/*.mock.{ts,tsx}', '**/*/*.d.ts'],
        cache: true,
        removeCache: false,
        cacheFilePath: 'node_modules/.cache/flh/eslintcache.json',
        whiteListFilePath: 'eslintWhitelist.json',
        debug: !!process.env.DEBUG,
        exitOnError: true,
        checkOnInit: true,
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
      this.printLog('[ESLint]eslintOption:', option);
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

    if (config.debug) this.printLog('[ESLint][options]:', config);

    if (!lintList.length) {
      this.printLog('[ESLint] No files processed\n');
      return;
    }

    if (config.debug) this.printLog('[ESlint][debug]', `TOTAL:`, lintList.length, `, Files:\n`, lintList);

    const eslint = new ESLint(this.getESLintOptions(lintList));
    const results = await eslint.lintFiles(lintList);
    const errorReults: ESLint.LintResult[] = [];
    const waringReults: ESLint.LintResult[] = [];
    /** 不在旧文件白名单中的新文件，包含 warning 也不允许通过 */
    const newWaringReults: ESLint.LintResult[] = [];
    let errorCount = 0;
    let warningCount = 0;

    let fixableErrorCount = 0;
    let fixableWarningCount = 0;

    results.forEach(result => {
      const filePath = utils.fixToshortPath(result.filePath);

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

        if (config.toWhiteList) this.whiteList[filePath] = 'e';
      }
    });

    if (config.toWhiteList) fs.writeFileSync(config.whiteListFilePath, JSON.stringify(this.whiteList, null, 2));

    const tips = `[errors-必须修复；warnings-历史文件选择性处理(对于历史文件慎重修改 == 类问题)]`;
    if (errorCount > 0) {
      const formatter = await eslint.loadFormatter('stylish');
      const resultText = formatter.format(errorReults);
      this.printLog(`\n ${resultText}`);
      this.printLog(`[ESLint] VERIFICATION FAILED. [${chalk.bold.redBright(errorReults.length)} FILES]${chalk.yellowBright(tips)}\n`);

      if (!config.fix && errorReults.length < 20) {
        // 运行此方法可以自动修复语法问题
        this.printLog('===================== ↓  ↓ Auto Fix Command ↓  ↓  ============================\n');
        this.printLog(
          `node --max_old_space_size=4096 "%~dp0/../node_modules/eslint/bin/eslint.js" --fix ${errorReults
            .map(d => d.filePath)
            .map(f => f.replace(/[\\]/g, '\\\\'))
            .join(' ')}\n`
        );

        this.printLog('===================== ↑  ↑ Auto Fix Command ↑  ↑ ============================\n');
      }
    } else {
      if (warningCount) {
        const formatter = await eslint.loadFormatter('stylish');

        if (newWaringReults.length) {
          const resultText = formatter.format(newWaringReults);
          this.printLog(
            `[注意] 以下文件存在警告信息且不在白名单中，请修复[TOTAL: ${newWaringReults.length} FILES]${tips}：\n`,
            newWaringReults.map(d => d.filePath).join('\n')
          );
          this.printLog(`\n ${resultText}\n`);
        } else {
          const resultText = formatter.format(waringReults);
          this.printLog(
            `[注意] 以下文件存在警告信息[TOTAL: ${waringReults.length} FILES]${tips}：\n`,
            waringReults.map(d => d.filePath).join('\n')
          );
          this.printLog(`\n ${resultText}\n`);
        }

        // if (config.strict) utils.exit(waringReults.length, stats.startTime, '[ESLint]');
      }
    }

    const isPassed = !errorCount && !newWaringReults.length;

    if (isPassed) {
      this.printLog(`[ESLint]`, chalk.bold.greenBright('Verification passed'));
    } else {
      if (this.config.exitOnError) utils.exit(1, stats.startTime, '[ESLint]');
    }

    if (!config.silent) utils.logTimeCost(stats.startTime, '[ESLint]');

    const result = {
      /** 是否检测通过 */
      isPassed,
      /** 异常文件总数 */
      total: results.length,
      /** error 类型异常的总数量 */
      errorCount,
      /** warning 类型异常的总数量 */
      warningCount,
      /** 可修复的 Error 类异常数量 */
      fixableErrorCount,
      /** 可修复的 Warning 类异常数量 */
      fixableWarningCount,
      /** 自动修复的错误数量 */
      fixedCount: config.fix ? fixableErrorCount + fixableWarningCount : 0,
      /** 本次检测的文件列表 */
      lintList,
      /** 存在 error 异常的文件列表（必须修复，否则应将其规则设置为 warning 级别并生成至白名单中） */
      errorFiles: errorReults.map(d => d.filePath),
      /** 存在 warning 异常的文件列表 */
      warningFiles: waringReults.map(d => d.filePath),
      // newWaringFiles: newWaringReults.map(d => d.filePath),
    };

    return result;
  }
}
