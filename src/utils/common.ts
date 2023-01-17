import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { color } from 'console-log-colors';
import { execSync, formatTimeCost } from '@lzwme/fe-utils';
import micromatch from 'micromatch';
import { getLogger } from './get-logger.js';

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
  getLogger().log(color.cyan(prefix), getTimeCost(startTime));
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
  return micromatch.isMatch(pathId, ruleIdNormalized, { dot: true }) || micromatch.isMatch(pathId, ruleId, { dot: true });
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
export function fileListToString(fileList: string[], prefix = '-') {
  return `\n ${prefix} ${fileList.join(`\n ${prefix} `)}\n`;
}

export function padSpace(txt: unknown, maxLenth: number, start = true) {
  return start ? String(txt).padStart(maxLenth, ' ') : String(txt).padEnd(maxLenth, ' ');
}

export function formatMem(mem: number) {
  if (mem > 1 << 30) return (mem / (1 << 30)).toFixed(2) + 'G';
  if (mem > 1 << 20) return (mem / (1 << 20)).toFixed(2) + 'M';
  if (mem > 1 << 10) return (mem / (1 << 10)).toFixed(2) + 'KB';
  return mem + 'B';
}

export function formatQty(number: number | string, qty = ',') {
  const num = Number(number);
  if (number === '' || Number.isNaN(num)) return number?.toString() ?? '';

  const i = `${Math.abs(Number.parseInt(String(num), 10))}`;
  const tail = String(Math.abs(num)).slice(i.length);
  const j = i.length > 3 ? i.length % 3 : 0;

  return (j ? i.slice(0, j) + qty : '') + i.slice(j).replace(/(\d{3})(?=\d)/g, `$1${qty}`) + tail;
}

export function getGitStaged(cwd = process.cwd()) {
  const cmd = `git diff --staged --diff-filter=ACMR --name-only -z`;
  const result = execSync(cmd, 'pipe', cwd);
  if (result.error) {
    getLogger().error(result.error);
    throw new Error('获取暂存区文件失败，请重试：' + result.stderr);
  }

  return result.stdout.split('\u0000').filter(Boolean);
}
