import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { color } from 'console-log-colors';
import * as readline from 'readline';
import { Logger } from '../lib/Logger';
import { formatTimeCost } from './utils-date';

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

export function getTimeCost(startTime: number, withTip = true) {
  let timeCost = formatTimeCost(startTime); // (Date.now() - startTime) / 1000 + 's';
  if (withTip) timeCost = `TimeCost: ${color.greenBright(timeCost)}`;
  return timeCost;
}

/**
 * 打印时间消耗
 * @param {number} startTime 开始时间戳
 */
export function logTimeCost(startTime: number, prefix = '') {
  Logger.getLogger().log(color.cyan(prefix), getTimeCost(startTime));
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
export function md5(str: string | Buffer, isFile = false) {
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

export const sleep = (delay = 100) => new Promise(rs => setTimeout(() => rs(true), delay));

export function formatWxWorkKeys(keys: string | string[]) {
  if (!keys) return [];
  if (!Array.isArray(keys)) keys = [keys];
  return keys
    .filter(d => /[\da-z]{8}(-?[\da-z]{4}){3}-?[\da-z]{12}/i.test(d))
    .map(d => {
      if (/^[\da-z]{32}$/i.test(d)) {
        d = [...d].map((s, index) => ([7, 11, 15, 19].includes(index) ? `${s}-` : s)).join('');
      }
      return d;
    });
}

/** 清除指定模块的 require 缓存（内存清理或实现热更新） */
export function clearRequireCache(filePath: string) {
  filePath = require.resolve(filePath);

  const cacheInfo = require.cache[filePath];
  if (!cacheInfo) return;

  const parent = cacheInfo.parent || require.main;

  if (parent) {
    let i = parent.children.length;
    while (i--) {
      if (parent.children[i].id === filePath) {
        parent.children.splice(i, 1);
      }
    }
  }

  const children = cacheInfo.children.map(d => d.id);
  delete require.cache[filePath];
  for (const id of children) clearRequireCache(id);
}
