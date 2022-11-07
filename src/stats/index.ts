import glob from 'fast-glob';
import { extname, resolve } from 'node:path';
import { writeFileSync, promises, type Stats } from 'node:fs';
import { getLogger } from '../utils/get-logger';
import { color } from 'console-log-colors';
import { getConfig } from '../config';
import { FlhConfig } from '../types';
import { getTimeCost } from '../utils/common';

type IFileStats = FlhConfig['fileStats'];

interface IStatsOption extends IFileStats {
  rootDir?: string;
}

export async function stats(options: IStatsOption) {
  const result = {
    startTime: Date.now(),
    endTime: 0,
    total: 0,
    totalSize: 0,
    exts: {} as Record<
      string,
      {
        total: number;
        size: number;
        list: { filepath: string; stat: Stats }[];
      }
    >,
  };
  const config = getConfig();
  const logger = getLogger();

  options = {
    src: config.src || ['src'],
    rootDir: config.rootDir,
    exclude: ['node_modules/**', 'dist/**'],
    ...config.fileStats,
    ...options,
  };
  if (!options.src?.length) options.src = ['src'];
  if (!options.extentions?.length) options.extentions = ['ts', 'tsx', 'mjs', 'js', 'less', 'scss', 'css', 'json', 'md'];

  const exts = options.extentions.map(d => d.replace(/^\./, '')).join(',');
  let fileList: string[] = [];

  logger.debug('options:', options);
  logger.info(`Start stats for ${color.magentaBright(options.src.join(','))}`);

  for (const src of options.src) {
    const rule = `${src}/**/*.{${exts}}`;
    const list = await glob(rule, { cwd: options.rootDir, absolute: true, ignore: options.exclude });
    // eslint-disable-next-line unicorn/prefer-spread
    fileList = fileList.concat(list);
  }

  result.total = fileList.length;
  for (const filepath of fileList) {
    let ext = extname(filepath).replace(/^./, '');

    if (filepath.endsWith(`.test.${ext}`)) ext = `test.${ext}`;
    else if (filepath.endsWith(`.spec.${ext}`)) ext = `spec.${ext}`;

    const fileStat = await promises.stat(filepath);
    if (!result.exts[ext]) {
      result.exts[ext] = {
        total: 0,
        size: 0,
        list: [],
      };
    }

    result.exts[ext].list.push({ filepath, stat: fileStat });
    result.exts[ext].total++;
    result.exts[ext].size += fileStat.size;
    result.totalSize += fileStat.size;
  }
  result.endTime = Date.now();

  logger.debug('result:', result);

  if (options.json) {
    const jsonRes = JSON.stringify(result, null, 2);
    if (options.jsonFile) {
      options.jsonFile = resolve(options.rootDir, options.jsonFile);
      writeFileSync(options.jsonFile, jsonRes, 'utf8');
    } else {
      console.log(jsonRes);
    }
  }

  const statsInfo = [
    `Success!`,
    ` - Total Files: ${color.greenBright(result.total)} (${color.magentaBright(formatMem(result.totalSize))})`,
  ];
  const extsList = Object.entries(result.exts).sort((a, b) => b[1].total - a[1].total);

  for (const [ext, list] of extsList) {
    statsInfo.push(
      `    - ${color.cyanBright(ext.padEnd(10, ' '))}: ${color.greenBright(String(list.total).padStart(6, ' '))} (${color.magentaBright(
        formatMem(list.size)
      )})`
    );
  }

  logger.info(statsInfo.join('\n'));

  logger.info(getTimeCost(result.startTime));

  return result;
}

function formatMem(mem: number) {
  if (mem > 1 << 30) return (mem / (1 << 30)).toFixed(2) + 'G';
  if (mem > 1 << 20) return (mem / (1 << 20)).toFixed(2) + 'M';
  if (mem > 1 << 10) return (mem / (1 << 10)).toFixed(2) + 'KB';
  return mem + 'B';
}
