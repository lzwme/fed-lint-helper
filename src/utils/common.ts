import childProcess from 'child_process';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { color } from 'console-log-colors';
import * as readline from 'readline';
import { Logger } from '../lib/Logger';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PlainObject = Record<string, any>;
export type ValueOf<T> = T[keyof T];

/** 等待并获取用户输入内容 */
export function readSyncByRl(tips = '> ') {
  return new Promise(resolve => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(tips, answer => {
      resolve(answer.trim());
      rl.close();
    });
  });
}

/**
 * 将给定的文件路径规整为 a/b/c.js 格式
 */
export function fixToshortPath(filepath = '', rootDir = process.cwd()) {
  const shortPath = path.resolve(rootDir, filepath).replace(rootDir, '').replace(/\\/g, '/');
  return shortPath.startsWith('/') ? shortPath.slice(1) : shortPath;
}

/**
 * 打印时间消耗
 * @param {number} startTime 开始时间戳
 */
export function logTimeCost(startTime: number, prefix = '') {
  Logger.getLogger().log(color.cyan(prefix), `TimeCost: ${color.bold(color.greenBright(Date.now() - startTime))}ms`);
}

/**
 * 打印待时间戳前缀的日志信息
 * @deprecated 请使用 Logger 对象
 */
export function log(prefix, ...args: string[]) {
  console.log(`[${color.cyanBright(new Date().toTimeString().slice(0, 8))}]${prefix}`, ...args);
}

/**
 * 生成指定字符串或指定文件路径的md5值
 * @param str {string} 指定的字符串，或者指定的文件路径
 * @param isFile {boolean} str 是否为一个文件路径
 */
export function md5(str, isFile = false) {
  try {
    if (isFile) {
      if (!fs.existsSync(str)) return '';
      str = fs.readFileSync(str);
    }
    const md5 = crypto.createHash('md5').update(str).digest('hex');
    // log(`文件的MD5是：${md5}`, filename);
    return md5;
  } catch (error) {
    /* eslint-disable no-console */
    console.log(error);
    return '';
  }
}

/** 简易的对象深复制 */
export function assign<T = PlainObject>(a: T, b: PlainObject, c?: PlainObject): T {
  if (!a || typeof a !== 'object') return a;
  // 入参不是对象格式，忽略
  if (typeof b !== 'object' || b instanceof RegExp || Array.isArray(b)) {
    if (c) return assign(a, c);
    return a;
  }

  for (const key in b) {
    // 如果是数组，则只简单的复制一份（不考虑数组内的类型）
    if (Array.isArray(b[key])) {
      a[key] = [...b[key]];
    } else if (null == b[key] || typeof b[key] !== 'object' || b[key] instanceof RegExp) {
      a[key] = b[key];
    } else {
      if (!a[key]) a[key] = {};
      assign(a[key], b[key]);
    }
  }

  return assign(a, c);
}

export function execSync(cmd: string, stdio?: childProcess.StdioOptions, cwd = process.cwd(), debug = false) {
  if (debug) console.log(color.cyanBright('exec cmd:'), color.yellowBright(cmd), color.cyan(cwd));
  try {
    // 为 inherit 才会返回输出结果给 res；为 pipe 则打印至 stdout 中，res 为空
    if (!stdio) stdio = debug ? 'inherit' : 'pipe';
    const res = childProcess.execSync(cmd, { stdio, encoding: 'utf8', cwd });
    return res ? res.toString().trim() : '';
  } catch (error) {
    console.error(color.redBright(error.message));
    return null;
  }
}

export const sleep = (delay = 100) => new Promise(rs => setTimeout(() => rs(true), delay));
