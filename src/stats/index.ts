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

export async function stats(options: IStatsOption) {
  const result = {
    startTime: Date.now(),
    endTime: 0,
    total: 0,
    totalSize: 0,
    totalLine: 0,
    topNByLine: [] as string[],
    topNBySize: [] as string[],
    exts: {} as Record<
      string,
      { total: number; totalSize: number; totalLine: number; list: { filepath: string; line: number; stat: Stats }[] }
    >,
  };
  const config = getConfig();
  const logger = getLogger();

  options = {
    src: config.fileStats.src || config.src || ['src'],
    rootDir: config.rootDir,
    exclude: ['**/node_modules/**', '**/dist/**'],
    ...config.fileStats,
    ...options,
  };
  if (!options.src?.length) options.src = ['src'];
  options.exclude = options.exclude.map(d => (d.includes('*') ? d : `**/${d}/**`));

  const exts = options.extensions.map(d => d.replace(/^\./, '')).join(',');
  const extGlobPattern = `**/*.${options.extensions.length > 1 ? `{${exts}}` : exts}`;

  logger.debug('options:', options, `exts: ${exts}`);
  logger.info(`start stats for ${color.greenBright(options.src.join(','))}`);

  const fileList = await glob(
    options.src.map(src => `${src}/${extGlobPattern}`),
    { cwd: options.rootDir, absolute: true, ignore: options.exclude }
  );
  const allFilesInfo = {} as { [filepath: string]: { filepath: string; line: number; stat: Stats } };

  result.total = fileList.length;
  for (const filepath of fileList) {
    let ext = extname(filepath).replace(/^./, '');

    if (filepath.endsWith(`.test.${ext}`)) ext = `test.${ext}`;
    else if (filepath.endsWith(`.spec.${ext}`)) ext = `spec.${ext}`;

    const fileStat = await promises.stat(filepath);
    const item = { filepath, line: 0, stat: fileStat };

    allFilesInfo[filepath] = item;
    result.totalSize += fileStat.size;

    if (!result.exts[ext]) result.exts[ext] = { total: 0, totalSize: 0, totalLine: 0, list: [] };
    result.exts[ext].list.push(item);
    result.exts[ext].total++;
    result.exts[ext].totalSize += fileStat.size;

    if (isTextFile(filepath)) {
      const content = await promises.readFile(filepath, 'utf8');
      item.line = content.split('\n').length;
      result.exts[ext].totalLine += item.line;
      result.totalLine += item.line;
    }
  }

  if (options.showFiles) {
    logger.info(`all Files: ${fileListToString(options.showFullPath ? fileList : fileList.map(d => fixToshortPath(d, options.rootDir)))}`);
  }

  const printWidths = { desc: 10, total: 6, line: 9 };
  const statsInfo = [
    color.greenBright(`success!`),
    `${padSpace('files', 6 + printWidths.desc + printWidths.total)} ${padSpace('lines', printWidths.line)}  size`,
    ` Total Files  : ${color.magentaBright(padSpace(formatQty(result.total), printWidths.total))} ${color.green(
      padSpace(formatQty(result.totalLine), printWidths.line)
    )}  ${color.greenBright(formatMem(result.totalSize))}`,
  ];
  const extsList = Object.entries(result.exts).sort((a, b) => b[1].total - a[1].total);

  for (const [ext, list] of extsList) {
    statsInfo.push(
      `  - ${color.cyanBright(ext.padEnd(printWidths.desc, ' '))}: ${color.magentaBright(
        padSpace(formatQty(list.total), printWidths.total)
      )} ${color.green(padSpace(formatQty(list.totalLine), printWidths.line))}  ${color.green(formatMem(list.totalSize))}`
    );
  }

  const topN = Math.min(options.topN || 10, fileList.length);
  if (topN && fileList.length > 0) {
    result.topNByLine = fileList.sort((a, b) => allFilesInfo[b].line - allFilesInfo[a].line).slice(0, topN);
    result.topNBySize = fileList.sort((a, b) => allFilesInfo[b].stat.size - allFilesInfo[a].stat.size).slice(0, topN);

    statsInfo.push('');

    const topNfilesByLine = result.topNByLine.map(
      d =>
        `${color.greenBright(padSpace(formatQty(allFilesInfo[d].line), 10))} ${
          options.showFullPath ? d : fixToshortPath(d, options.rootDir)
        }`
    );
    statsInfo.push(` ${color.cyanBright(`Top ${topN} Files By Lines:`)}${fileListToString(topNfilesByLine, '')}`);

    const topNfilesBySize = result.topNBySize.map(
      d =>
        `${color.greenBright(padSpace(formatMem(allFilesInfo[d].stat.size), 10))} ${
          options.showFullPath ? d : fixToshortPath(d, options.rootDir)
        }`
    );
    statsInfo.push(` ${color.cyanBright(`Top ${topN} Files By Size:`)}${fileListToString(topNfilesBySize, '')}`);
  }

  result.endTime = Date.now();
  logger.debug('result:', result);

  if (options.json) {
    const jsonRes = JSON.stringify(result, null, 2);
    if (options.jsonFile) writeFileSync(resolve(options.rootDir, options.jsonFile), jsonRes, 'utf8');
    else console.log(jsonRes);
  }

  logger.info(statsInfo.join('\n'));
  logger.info(getTimeCost(result.startTime));
  return result;
}

function isTextFile(filepath: string) {
  return !['.png', '.jpg', '.gif', '.jpeg', '.mp3', '.wav', '.node', '.exe'].includes(extname(filepath).toLowerCase());
}
