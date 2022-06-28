/*
 * @Author: lzw
 * @Date: 2022-04-08 10:30:02
 * @LastEditors: lzw
 * @LastEditTime: 2022-06-28 22:43:54
 * @Description:
 */
/* eslint no-console: 0 */
import fs from 'fs';
import path from 'path';

/** 日志级别 */
export enum LogLevel {
  error,
  silent,
  warn,
  info,
  log,
  debug,
}

export interface LoggerOptions {
  /** 日志保存的目录位置。默认为空，则不保存至文件 */
  logDir?: string;
  /** 是否为静默模式。为 true 则不打印至控制台 */
  silent?: boolean;
  /** 是否为调试模式。为 true 控制台打印为对象格式的日志 */
  debug?: boolean;
  /** 日志级别 */
  levelType?: LogLevelType;
  /** 通过外部注入 color 能力 */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  color?: Record<string, any>;
}

export type LogLevelType = keyof typeof LogLevel;
type LogFn = (...p) => void;

const defaultOptions: LoggerOptions = {
  levelType: 'log',
  debug: false,
  silent: false,
  logDir: '',
  color: null,
};

let headTipColored = false;
const LogLevelHeadTip = {
  error: ['[ERROR]', 'redBright'],
  warn: ['[WARNING]', 'yellowBright'],
  info: ['[INFO]', 'blueBright'],
  log: ['[LOG]', 'cyanBright'],
  debug: ['[DEBUG]', 'gray'],
} as const;

const fsStreamCache: { [logPath: string]: fs.WriteStream } = {};

export class Logger {
  public static map: { [tag: string]: Logger } = {};
  /** 日志记录级别 */
  private level: LogLevel = LogLevel.log;

  public silent: LogFn = this._log.bind(this, 'error');
  public error: LogFn = this._log.bind(this, 'error');
  public warn: LogFn = this._log.bind(this, 'warn');
  public info: LogFn = this._log.bind(this, 'info');
  public log: LogFn = this._log.bind(this, 'log');
  public debug: LogFn = this._log.bind(this, 'debug');

  /** 日志路径 */
  private logPath: string;
  private logDir: string;
  /** 本机与服务器时间的差值 diff = Date.now() - serverTime */
  private static serverTimeDiff = 0;

  /** 记录日志的次数 */
  private times = 0;

  constructor(private tag: string, private options: LoggerOptions = {}) {
    const match = /(\w+)/.exec(tag);
    if (!match) throw 'Logger tag expected';
    this.tag = tag;

    if (!(options.levelType in LogLevel)) {
      if (process.env.FLH_LOG_LEVEL) options.levelType = process.env.ET_LOG_LEVEL as LogLevelType;
      if (options.levelType in LogLevel) this.level = LogLevel[options.levelType];
    }

    options = this.updateOptions(options);
    this.setLogDir(options.logDir);
  }
  public setLogDir(logDir: string) {
    if (!logDir || !fs?.createWriteStream) return;

    let logPath = logDir;

    if (logDir.endsWith('.log')) {
      logDir = path.dirname(logDir);
    } else {
      const curTime = new Date().toISOString().slice(0, 10).replace(/\D/g, '');
      logPath = path.resolve(logDir, `${this.tag.replace(/[^\dA-Za-z]/g, '')}_${curTime}.log`);
    }

    if (logPath === this.logPath) return;

    const logFsStream = fsStreamCache[this.logPath];
    if (logFsStream) {
      logFsStream.close();
      delete fsStreamCache[this.logPath];
    }

    this.logDir = logDir;
    this.logPath = logPath;
  }
  /** 更新服务器时间，计算时间差并返回 */
  static setServerTime(serverTime: number) {
    if (!serverTime) return 0;
    Logger.serverTimeDiff = Date.now() - serverTime;
    return Logger.serverTimeDiff;
  }
  public getSeverTime(): number;
  public getSeverTime(toDate: true): Date;
  public getSeverTime(toDate?: boolean) {
    const now = Date.now() - Logger.serverTimeDiff;
    if (toDate === true) return new Date(now);
    return now;
  }

  private _log(type: LogLevelType, ...args) {
    const lvl = LogLevel[type];

    if (lvl <= this.level) {
      this.times++;
      const now = this.getSeverTime(true);
      const curTime = now.toTimeString().slice(0, 8) + '.' + now.getMilliseconds();
      const msg = args.map(s => (typeof s === 'string' ? s : JSON.stringify(s))).join(' ');

      this.writeToFile(`[${curTime}]${this.tag}[${type}] ${msg}\n`);
      if (this.options.silent) return;

      if (console[type]) {
        let header = `[${curTime}]${this.tag}`;
        if (this.options.color) {
          header = this.options.color.greenBright(header);
        }

        if (lvl === LogLevel.debug) header += `[${this.times}]`;
        if (LogLevelHeadTip[type]) {
          const tip = LogLevelHeadTip[type][0];
          header = tip + header;
        }

        if (!this.options.debug && type !== 'debug') console[type](header, msg);
        else console[type](header, ...args);
      }
    }
  }
  /**
   * 写入到日志文件
   * @todo 增加分包支持
   */
  private writeToFile(msg: string) {
    if (!this.logPath) return;
    let logFsStream = fsStreamCache[this.logPath];
    if (!logFsStream || logFsStream.destroyed) {
      if (!fs.existsSync(this.logDir)) fs.mkdirSync(this.logDir, { recursive: true });
      logFsStream = fs.createWriteStream(this.logPath, { encoding: 'utf8', flags: 'a' });
      fsStreamCache[this.logPath] = logFsStream;
    }
    // eslint-disable-next-line no-control-regex
    logFsStream.write(msg.replace(/\u001B\[\d+m/g, ''), 'utf8');
  }
  public updateOptions(options: LoggerOptions) {
    if (!headTipColored && options.color) {
      for (const key of Object.keys(LogLevelHeadTip)) {
        const [tag, colorType] = LogLevelHeadTip[key];
        if (options.color[colorType]) {
          LogLevelHeadTip[key][0] = options.color[colorType](tag);
          headTipColored = true;
        }
      }
    }

    this.options = Object.assign({}, defaultOptions, this.options);
    for (const key of Object.keys(defaultOptions)) {
      if (key in options) {
        if (key === 'logDir') {
          if (null == options.logDir) continue;
          this.setLogDir(options.logDir);
        }
        this.options[key] = options[key];
      }
    }

    if (options.levelType in LogLevel) this.level = LogLevel[options.levelType];

    return this.options;
  }

  public static getLogger(tag?: string, options?: LoggerOptions): Logger {
    if (!tag) tag = '[flh]';
    if (!Logger.map[tag]) Logger.map[tag] = new Logger(tag, options);
    else if (options) Logger.map[tag].updateOptions(options);
    return Logger.map[tag];
  }
}
