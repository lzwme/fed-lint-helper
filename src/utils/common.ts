import { color } from 'console-log-colors';
import { formatTimeCost } from '@lzwme/fe-utils';
import { Logger } from '../lib/Logger';

/** @deprecated */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PlainObject = Record<string, any>;
export type ValueOf<T> = T[keyof T];

export { md5 } from '@lzwme/fe-utils';
export { fixToshortPath } from '@lzwme/fe-utils/cjs/node/path';

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
