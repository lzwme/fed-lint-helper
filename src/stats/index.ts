import glob from 'fast-glob';
import { extname, resolve } from 'node:path';
import { writeFileSync, promises, type Stats } from 'node:fs';
import { getLogger } from '../utils/get-logger';
import { color } from 'console-log-colors';
import { getConfig } from '../config';
import { FlhConfig } from '../types';
import { getTimeCost, fileListToString, padSpace } from '../utils/common';

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
        totalSize: number;
        list: { filepath: string; stat: Stats }[];
      }
    >,
  };
  const config = getConfig();
  const logger = getLogger();

  options = {
    src: config.src || ['src'],
    rootDir: config.rootDir,
    exclude: ['**/node_modules/**', '**/dist/**'],
    ...config.fileStats,
    ...options,
  };
  if (!options.src?.length) options.src = ['src'];

  const exts = options.extensions.map(d => d.replace(/^\./, '')).join(',');
  const extGlobPattern = `**/*.${options.extensions.length > 1 ? `{${exts}}` : exts}`;

  logger.debug('options:', options, `exts: ${exts}`);
  logger.info(`start stats for ${color.greenBright(options.src.join(','))}`);

  const fileList = await glob(
    options.src.map(src => `${src}/${extGlobPattern}`),
    { cwd: options.rootDir, absolute: true, ignore: options.exclude }
  );

  result.total = fileList.length;
  for (const filepath of fileList) {
    let ext = extname(filepath).replace(/^./, '');

    if (filepath.endsWith(`.test.${ext}`)) ext = `test.${ext}`;
    else if (filepath.endsWith(`.spec.${ext}`)) ext = `spec.${ext}`;

    const fileStat = await promises.stat(filepath);
    if (!result.exts[ext]) {
      result.exts[ext] = {
        total: 0,
        totalSize: 0,
        list: [],
      };
    }

    result.exts[ext].list.push({ filepath, stat: fileStat });
    result.exts[ext].total++;
    result.exts[ext].totalSize += fileStat.size;
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

  if (options.showFiles) {
    logger.info(`all Files: ${fileListToString(fileList)}`);
  }

  const statsInfo = [
    `success!`,
    ` Total Files  : ${color.greenBright(padSpace(result.total, 6))} ${color.magentaBright(formatMem(result.totalSize))}`,
  ];
  const extsList = Object.entries(result.exts).sort((a, b) => b[1].total - a[1].total);

  for (const [ext, list] of extsList) {
    statsInfo.push(
      `  - ${color.cyanBright(ext.padEnd(10, ' '))}: ${color.green(padSpace(list.total, 6))} ${color.magenta(formatMem(list.totalSize))}`
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
