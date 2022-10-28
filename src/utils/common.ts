import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { color } from 'console-log-colors';
import { formatTimeCost, execSync } from '@lzwme/fe-utils';
import { Logger } from '../lib/Logger';
import { isMatch } from 'micromatch';

/** @deprecated */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PlainObject = Record<string, any>;
export type ValueOf<T> = T[keyof T];

export { md5 } from '@lzwme/fe-utils';

export function getTimeCost(startTime: number, withTip = true) {
  let timeCost = formatTimeCost(startTime); // (Date.now() - startTime) / 1000 + 's';
  if (withTip) timeCost = `TimeCost: ${color.greenBright(timeCost)}`;
  return timeCost;
}

/**
 * 打印时间消耗
 * @param startTime 开始时间戳
 */
export function logTimeCost(startTime: number, prefix = '') {
  Logger.getLogger().log(color.cyan(prefix), getTimeCost(startTime));
}

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

export function arrayToObject<V = number>(arr: string[], value?: V) {
  const o: Record<string, V> = {};

  // @ts-ignore
  if (value == null) value = 1;

  arr.forEach(key => {
    if (key != null) o[key] = value;
  });
  return o;
}

export function globMatcher(pathId: string, ruleIdNormalized: string, ruleId: string) {
  return isMatch(pathId, ruleIdNormalized, { dot: true }) || isMatch(pathId, ruleId, { dot: true });
}

/** 判断给定的目录是否为一个 git 仓库 */
export function isGitRepo(rootDir = process.cwd(), useCache = true): boolean {
  // @ts-ignore
  if (isGitRepo[rootDir] == null || !useCache) {
    // @ts-ignore
    isGitRepo[rootDir] =
      existsSync(resolve(rootDir, '.git/config')) || execSync('git branch --show-current', 'pipe', rootDir).error == null;
  }
  // @ts-ignore
  return isGitRepo[rootDir];
}

/**
 * 获取 indent-size。默认为 2
 * @todo 根据 ext 文件类型区分
 */
export function getIndentSize(rootDir = process.cwd()): number {
  const cfgList = ['.editorconfig', '.prettierrc', '.prettierrc.js', '.prettierrc.json'];

  for (const filename of cfgList) {
    const filepath = resolve(rootDir, filename);
    if (existsSync(filepath)) {
      const content = readFileSync(filepath, 'utf8');
      const matchResult = content.match(/(indent_size|tabWidth)\D+(\d+)/m);
      if (matchResult && +matchResult[2]) return +matchResult[2];
    }
  }

  return 2;
}

/** 将给定文件列表格式化为用于打印至控制台的字符串 */
export function fileListToString(fileList: string[]) {
  return `\n - ${fileList.join('\n -')}\n`;
}
