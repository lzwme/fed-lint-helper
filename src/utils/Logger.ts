/* eslint no-console: 0 */
import { color } from 'console-log-colors';

/** 日志级别 */
export enum LogLevel {
  silent,
  error,
  warn,
  info,
  log,
  debug,
}

export type LogLevelType = keyof typeof LogLevel;

const LogLevelHeadTip = {
  error: color.redBright('[ERROR]'),
  warn: color.yellowBright('[WARNING]'),
  info: color.blueBright('[INFO]'),
  log: color.whiteBright('[LOG]'),
  debug: color.gray('[DEBUG]'),
} as const;

export class Logger {
  public static map: { [tag: string]: Logger } = {};
  /** 日志记录级别 */
  public readonly level: LogLevel;

  public error: (...args) => void;
  public warn: (...args) => void;
  public info: (...args) => void;
  public log: (...args) => void;
  public debug: (...args) => void;

  private logTimes = 0;

  constructor(private tag: string, levelType: LogLevelType) {
    const match = /(\w+)/.exec(tag);
    if (!match) throw 'Logger tag expected';

    this.tag = tag;

    if (process.env.FLH_LOG_LEVEL) levelType = process.env.FLH_LOG_LEVEL as LogLevelType;

    this.level = LogLevel[levelType] || LogLevel.log;

    this.error = this._log.bind(this, 'error');
    this.warn = this._log.bind(this, 'warn');
    this.info = this._log.bind(this, 'info');
    this.log = this._log.bind(this, 'log');
    this.debug = this._log.bind(this, 'debug');
  }

  private _log(type: LogLevelType, ...args) {
    const lvl = LogLevel[type];

    if (lvl <= this.level) {
      let header = color.cyanBright(`[${new Date().toTimeString().slice(0, 8)}]${this.tag}`);

      if (lvl === LogLevel.debug) header += `[${this.logTimes}]`;

      if (LogLevelHeadTip[type]) header = LogLevelHeadTip[type] + header;

      switch (lvl) {
        case LogLevel.error:
          console.error(header, ...args);
          break;
        case LogLevel.warn:
          console.warn(header, ...args);
          break;
        case LogLevel.info:
          console.info(header, ...args);
          break;
        case LogLevel.log:
          console.log(header, ...args);
          break;
        case LogLevel.debug:
          console.debug(header, ...args);
          break;
      }
    }

    this.logTimes++;
    // todo: 增加写入日志文件的能力
  }

  public static getLogger(tag = '[general]', levelType: LogLevelType = 'log'): Logger {
    if (!Logger.map[tag]) Logger.map[tag] = new Logger(tag, levelType);
    return Logger.map[tag];
  }
}
