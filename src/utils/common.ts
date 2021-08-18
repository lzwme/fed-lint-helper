import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import chalk from 'chalk';

/**
 * 将给定的文件路径规整为 a/b/c.js 格式
 */
export function fixToshortPath(filepath = '', rootDir = process.cwd()) {
  return path
    .resolve(rootDir, filepath)
    .replace(rootDir + path.sep, '')
    .replace(/\\/g, '/');
}

/**
 * 打印时间消耗
 * @param {number} startTime 开始时间戳
 */
export function logTimeCost(startTime: number, prefix = '') {
  console.log(`${prefix} TimeCost: ${chalk.bold.greenBright(Date.now() - startTime)}ms`);
}

/**
 * 退出当前 process 进程
 * @param {number} code 退出码
 * @param {number} startTime 开始时间，存在则打印执行时间成本
 */
export function exit(code = 0, startTime = 0, prefix = '') {
  if (startTime) logTimeCost(startTime, prefix);
  process.exit(code || 0);
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
  } catch (err) {
    /* eslint-disable no-console */
    console.log(err);
    return '';
  }
}
