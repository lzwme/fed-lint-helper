import { existsSync, promises, readdirSync, rmdirSync, statSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, resolve } from 'node:path';
import { concurrency, readSyncByRl, rmrfAsync } from '@lzwme/fe-utils';
import { green, greenBright, red } from 'console-log-colors';
import glob from 'fast-glob';
import { formatMem, getTimeCost } from '../utils/common';
import { logger } from '../utils/get-logger.js';

async function doRmdir(source: string, slient = false, force = false, dryRun = false, showSize = true) {
  if (!existsSync(source)) return false;

  const isFile = statSync(source).isFile();
  const sourceTip = isFile ? '文件' : '目录';

  let fileSize = '';
  if (showSize) {
    const fielStat = await promises.stat(source);
    fileSize = greenBright(`[${formatMem(fielStat.size)}]`.padStart(10, ' '));
  }

  if (!force) {
    const force = await readSyncByRl(`是否删除该${sourceTip}(y/)？[${fileSize} ${red(source)}] `);
    if ('y' !== String(force).trim().toLowerCase()) return false;
  }

  logger.debug(`${dryRun ? `[dryRun]` : ''}[开始删除]${sourceTip}：${fileSize}`, green(source));

  if (!dryRun) {
    await rmrfAsync(source);

    // 清理父级空目录
    if (isFile) {
      const dirpath = dirname(source);
      const fileList = await promises.readdir(dirpath);
      if (fileList.length === 0) rmrfAsync(dirpath);
    }
  }

  if (!slient) {
    logger.info(`${dryRun ? `[dryRun]` : ''}${sourceTip}已删除：${fileSize}`, green(source));
  }

  return true;
}

export async function rmdir(
  srcs: string[],
  { slient = false, force = false, dryRun = false, showSize = true, onlyEmpty = false, showProcess = false }
) {
  const startTime = Date.now();
  let total = 0;

  if (!Array.isArray(srcs) || srcs.length === 0) {
    logger.warn('请指定要删除的文件或目录路径');
    return total;
  }

  if (showProcess) logger.info('[RMDIR]开始处理:', srcs.map(d => greenBright(d)).join(', '));

  if (onlyEmpty) {
    total = await rmEmptyDir(srcs, dryRun);
  } else {
    const list: (() => Promise<boolean>)[] = [];
    let result: boolean[] = [];

    for (const source of srcs) {
      // const files = glob.isDynamicPattern(source) ? await glob(source, { cwd: process.cwd() }) : [source];
      const files = source.includes('*') ? await glob(source, { cwd: process.cwd(), onlyFiles: false, dot: true }) : [source];
      for (const filepath of files) {
        if (force) {
          list.push(() => doRmdir(filepath, slient, force, dryRun, showSize));
        } else {
          result.push(await doRmdir(filepath, slient, force, dryRun, showSize));
        }
      }
    }

    if (list.length > 0) result = (await concurrency(list, cpus().length)).map(d => d.result);
    total = result.filter(Boolean).length;
  }

  if (showProcess) logger.info(`${dryRun ? `[dryRun]` : ''}执行完成！共删除了 ${red(total)} 个文件或目录。`, getTimeCost(startTime));

  return total;
}

export async function rmEmptyDir(srcs: string[], dryRun = false) {
  let total = 0;

  for (let src of srcs) {
    src = resolve(src);
    let dirs = await glob('**/*', { cwd: src, onlyDirectories: true, absolute: true, dot: true });
    dirs = dirs.sort((a, b) => b.length - a.length).concat(src);
    logger.debug(dirs);

    for (const dir of dirs) {
      const list = readdirSync(dir);
      if (list.length === 0) {
        logger.debug(`${dryRun ? `[dryRun]` : ''}删除空目录：`, red(dir));
        if (!dryRun) rmdirSync(dir);
        total++;
      }
    }
  }

  return total;
}
