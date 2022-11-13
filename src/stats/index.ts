import { extname, resolve } from 'node:path';
import { writeFileSync, promises, type Stats } from 'node:fs';
import glob from 'fast-glob';
import { color } from 'console-log-colors';
import { fixToshortPath } from '@lzwme/fe-utils';
import { getLogger } from '../utils/get-logger';
import { getTimeCost, fileListToString, padSpace, formatQty, formatMem } from '../utils/common';
import { getConfig } from '../config';
import { FlhConfig } from '../types';

type IFileStats = FlhConfig['fileStats'];
interface IStatsOption extends IFileStats {
  rootDir?: string;
}

const binaryExts = new Set(['png', 'jpg', 'gif', 'jpeg', 'svg', 'mp3', 'mp4', 'avi', 'wav', 'node', 'exe']);
const isTextFile = (filepath: string) => !binaryExts.has(extname(filepath).slice(1).toLowerCase());

export async function stats(options: IStatsOption) {
  const result = {
    startTime: Date.now(),
    endTime: 0,
    total: 0,
    totalSize: 0,
    totalLine: 0,
    totalBlank: 0,
    topNByLine: [] as string[],
    topNBySize: [] as string[],
    exts: {} as Record<
      string,
      {
        total: number;
        totalSize: number;
        totalLine: number;
        totalBlank: number;
        list: { filepath: string; line: number; blank: number; stat: Stats }[];
      }
    >,
  };
  const config = getConfig();
  const logger = getLogger();
  const { green, greenBright, cyanBright, magentaBright } = color;

  options = {
    src: config.fileStats.src || config.src || ['src'],
    rootDir: config.rootDir,
    exclude: ['**/node_modules/**', '**/dist/**'],
    ...config.fileStats,
    ...options,
  };
  if (!options.src?.length) options.src = ['src'];
  options.exclude = options.exclude.map(d => (d.includes('*') ? d : `**/${d}/**`));

  const { extensions, rootDir, showFullPath } = options;
  const exts = extensions.map(d => d.replace(/^\./, '')).join(',');
  const pattern = `**/*.${extensions.length > 1 ? `{${exts}}` : exts}`;

  logger.debug('options:', options, `exts: ${exts}`);
  logger.info(`start stats for ${greenBright(options.src.join(','))}`);

  const fileList = await glob(
    options.src.map(src => `${src}/${pattern}`),
    { cwd: rootDir, absolute: true, ignore: options.exclude }
  );
  const allFilesInfo = {} as { [filepath: string]: { filepath: string; line: number; stat: Stats } };

  result.total = fileList.length;
  for (const filepath of fileList) {
    let ext = extname(filepath).replace(/^./, '').toLowerCase();

    if (filepath.endsWith(`.test.${ext}`)) ext = `test.${ext}`;
    else if (filepath.endsWith(`.spec.${ext}`)) ext = `spec.${ext}`;

    const fileStat = await promises.stat(filepath);
    const item = { filepath, line: 0, blank: 0, stat: fileStat };

    allFilesInfo[filepath] = item;
    result.totalSize += fileStat.size;

    if (!result.exts[ext]) result.exts[ext] = { total: 0, totalSize: 0, totalLine: 0, totalBlank: 0, list: [] };
    result.exts[ext].list.push(item);
    result.exts[ext].total++;
    result.exts[ext].totalSize += fileStat.size;

    if (isTextFile(filepath)) {
      const content = await promises.readFile(filepath, 'utf8');
      const contentLines = content.trim().split('\n');
      item.line = contentLines.length;
      item.blank = contentLines.filter(line => line.trim() === '').length;
      result.exts[ext].totalLine += item.line;
      result.exts[ext].totalBlank += item.blank;
      result.totalLine += item.line;
      result.totalBlank += item.blank;
    }
  }

  if (options.showFiles) {
    logger.info(`all Files: ${fileListToString(showFullPath ? fileList : fileList.map(d => fixToshortPath(d, rootDir)))}`);
  }

  const widths = { row: 70, ext: 10, sep: 15 };
  const statsInfo = [
    greenBright(`success!`),
    '-'.repeat(widths.row),
    [
      padSpace('Extension', widths.ext),
      padSpace('files', widths.sep),
      padSpace('blank', widths.sep),
      padSpace('lines', widths.sep),
      padSpace('size', widths.sep),
    ].join(''),
    '-'.repeat(widths.row),
  ];
  const extsList = Object.entries(result.exts).sort((a, b) => b[1].total - a[1].total);

  for (const [ext, list] of extsList) {
    statsInfo.push(
      [
        cyanBright(padSpace(ext, widths.ext)),
        magentaBright(padSpace(formatQty(list.total), widths.sep)),
        green(padSpace(formatQty(list.totalBlank), widths.sep)),
        green(padSpace(formatQty(list.totalLine), widths.sep)),
        green(padSpace(formatMem(list.totalSize), widths.sep)),
      ].join('')
    );
  }

  const topN = Math.min(options.topN || 10, fileList.length);
  if (result.total > 0) {
    statsInfo.push(
      '-'.repeat(widths.row),
      [
        padSpace('SUM', widths.ext),
        magentaBright(padSpace(formatQty(result.total), widths.sep)),
        green(padSpace(formatQty(result.totalBlank), widths.sep)),
        green(padSpace(formatQty(result.totalLine), widths.sep)),
        greenBright(padSpace(formatMem(result.totalSize), widths.sep)),
      ].join(''),
      '-'.repeat(widths.row)
    );

    if (topN > 0) {
      result.topNByLine = fileList.sort((a, b) => allFilesInfo[b].line - allFilesInfo[a].line).slice(0, topN);
      result.topNBySize = fileList.sort((a, b) => allFilesInfo[b].stat.size - allFilesInfo[a].stat.size).slice(0, topN);
      const topNfilesByLine = result.topNByLine.map(
        d => `${greenBright(padSpace(formatQty(allFilesInfo[d].line), 10))} ${showFullPath ? d : fixToshortPath(d, rootDir)}`
      );
      statsInfo.push(` ${cyanBright(`Top ${topN} Files By Lines:`)}${fileListToString(topNfilesByLine, '')}`);

      const topNfilesBySize = result.topNBySize.map(
        d => `${greenBright(padSpace(formatMem(allFilesInfo[d].stat.size), 10))} ${showFullPath ? d : fixToshortPath(d, rootDir)}`
      );
      statsInfo.push(` ${cyanBright(`Top ${topN} Files By Size:`)}${fileListToString(topNfilesBySize, '')}`);
    }
  }

  result.endTime = Date.now();
  logger.debug('result:', result);

  if (options.json) {
    const jsonRes = JSON.stringify(result, null, 2);
    if (options.jsonFile) writeFileSync(resolve(rootDir, options.jsonFile), jsonRes, 'utf8');
    else console.log(jsonRes);
  }

  logger.info(statsInfo.join('\n'));
  logger.info(getTimeCost(result.startTime));
  return result;
}
