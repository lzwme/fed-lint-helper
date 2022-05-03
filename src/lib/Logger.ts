/*
 * @Author: lzw
 * @Date: 2022-04-08 10:30:02
 * @LastEditors: lzw
 * @LastEditTime: 2022-04-08 11:24:51
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
  /** 日志保存的目录位置 */
  logDir?: string;
  /** 是否为静默模式。为 true 且设置了 logDir，则则不打印至控制台 */
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

const defaultOptions: LoggerOptions = {
  levelType: 'log',
  debug: false,
  silent: false,
  logDir: '',
  color: null,
};

const LogLevelHeadTip = {
  error: ['[ERROR]', 'redBright'],
  warn: ['[WARNING]', 'yellowBright'],
  info: ['[INFO]', 'blueBright'],
  log: ['[LOG]', 'cyanBright'],
  debug: ['[DEBUG]', 'gray'],
} as const;

export class Logger {
  public static map: { [tag: string]: Logger } = {};
  /** 日志记录级别 */
  private level: LogLevel;

  public error: (...p) => void;
  public warn: (...p) => void;
  public info: (...p) => void;
  public log: (...p) => void;
  public debug: (...p) => void;

  /** 日志路径 */
  private logPath: string;
  private logDir: string;
  private logFsStream: fs.WriteStream;
  /** 本机与服务器时间的差值 diff = Date.now() - serverTime */
  private static serverTimeDiff = 0;

  /** 记录日志的次数 */
  private times = 0;

  constructor(private tag: string, private options: LoggerOptions) {
    const match = /(\w+)/.exec(tag);
    if (!match) throw 'Logger tag expected';
    this.tag = tag;

    options = this.updateOptions(options);
    this.setLogDir(options.logDir);

    this.error = this._log.bind(this, 'error');
    this.warn = this._log.bind(this, 'warn');
    this.info = this._log.bind(this, 'info');
    this.log = this._log.bind(this, 'log');
    this.debug = this._log.bind(this, 'debug');
  }
  public setLogDir(logDir: string) {
    if (!logDir || !fs || !fs.createWriteStream) return;
    if (logDir === this.logDir && this.logFsStream) return;
    this.logDir = logDir;

    if (logDir.endsWith('.log')) {
      this.logPath = logDir;
      this.logDir = path.dirname(logDir);
    } else {
      const curTime = new Date().toTimeString().slice(0, 8).replace(/\D/g, '');
      this.logPath = path.resolve(logDir, `${this.tag.replace(/[^\dA-Za-z]/g, '')}_${curTime}.log`);
    }

    if (this.logFsStream) {
      this.logFsStream.destroy();
      this.logFsStream = null;
    }
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
          let tip = LogLevelHeadTip[type][0];
          if (this.options.color) tip = this.options.color[LogLevelHeadTip[type][1]](tip);
          header = tip + header;
        }

        if (!this.options.debug) console[type](header, msg);
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
    if (!this.logFsStream || this.logFsStream.destroyed) {
      if (!fs.existsSync(this.logDir)) fs.mkdirSync(this.logDir, { recursive: true });
      this.logFsStream = fs.createWriteStream(this.logPath, { encoding: 'utf8', flags: 'a' });
    }
    // eslint-disable-next-line no-control-regex
    this.logFsStream.write(msg.replace(/\u001B\[\d+m/g, ''), 'utf8');
  }
  public updateOptions(options: LoggerOptions) {
    if (!this.options.color && options.color) {
      for (const key of Object.keys(LogLevelHeadTip)) {
        const [v, colorType] = LogLevelHeadTip[key];
        if (options.color[colorType]) LogLevelHeadTip[key][0] = options.color[colorType](v);
      }
    }

    this.options = Object.assign({}, defaultOptions, this.options);
    for (const key of Object.keys(defaultOptions)) {
      if (key in options) {
        this.options[key] = options[key];
        if (key === 'logDir') this.setLogDir(options.logDir);
      }
    }

    options = this.options;
    if (process.env.FLH_LOG_LEVEL) options.levelType = process.env.ET_LOG_LEVEL as LogLevelType;
    this.level = options.levelType in LogLevel ? LogLevel[options.levelType] : LogLevel.log;

    return options;
  }

  public static getLogger(tag = '', instanceId = 'flh', options: LoggerOptions = {}): Logger {
    if (!tag) tag = '[flh]';
    if (!instanceId) instanceId = 'flh';
    if (!Logger.map[instanceId]) Logger.map[instanceId] = new Logger(tag, options);
    else Logger.map[instanceId].updateOptions(options);
    return Logger.map[instanceId];
  }
}
