import { resolve } from 'path';
import { existsSync, readFileSync } from 'fs';
import { createHash } from 'crypto';
import { color } from 'console-log-colors';
import { createInterface } from 'readline';
import { Logger } from '../lib/Logger';
import { formatTimeCost } from './date';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PlainObject = Record<string, any>;
export type ValueOf<T> = T[keyof T];

/** 等待并获取用户输入内容 */
export function readSyncByRl(tips = '> ') {
  return new Promise(resolve => {
    const rl = createInterface({
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
  const shortPath = resolve(rootDir, filepath).replace(rootDir, '').replace(/\\/g, '/');
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
 * 生成指定字符串或指定文件路径的md5值
 * @param str {string} 指定的字符串，或者指定的文件路径
 * @param isFile {boolean} str 是否为一个文件路径
 */
export function md5(str: string | Buffer, isFile = false) {
  try {
    if (isFile) {
      if (!existsSync(str)) return '';
      str = readFileSync(str);
    }
    const md5 = createHash('md5').update(str).digest('hex');
    // log(`文件的MD5是：${md5}`, filename);
    return md5;
  } catch (error) {
    /* eslint-disable no-console */
    console.log(error);
    return '';
  }
}

export const sleep = (delay = 100) => new Promise(rs => setTimeout(() => rs(true), delay));

/** 将32位字符串转换为 uuid 标准格式 */
export function toUuidFormat(uuid: string) {
  if (/^[\da-z]{32}$/i.test(uuid)) {
    uuid = [...uuid].map((s, index) => ([7, 11, 15, 19].includes(index) ? `${s}-` : s)).join('');
  }
  return uuid;
}

export function formatWxWorkKeys(keys: string | string[]) {
  if (!keys) return [];
  if (!Array.isArray(keys)) keys = [keys];
  return keys.filter(d => /[\da-z]{8}(-?[\da-z]{4}){3}-?[\da-z]{12}/i.test(d)).map(d => toUuidFormat(d));
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
