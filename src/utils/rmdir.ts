import fs from 'fs';
import path from 'path';
import { color } from 'console-log-colors';
import { readSyncByRl } from './common';
import { glob } from 'glob';
import { getLogger } from './get-logger';

function rmRecursive(dirname: string) {
  if (!fs.existsSync(dirname) || !fs.statSync(dirname).isDirectory()) return;

  const fileList = fs.readdirSync(dirname);

  for (const filename of fileList) {
    if (!filename || ['.', '..'].includes(filename)) continue;

    const filePath = path.resolve(dirname, filename);
    const fileStat = fs.statSync(filePath);

    if (fileStat.isDirectory()) {
      rmRecursive(filePath);
      continue;
    }

    if (fileStat.isFile()) fs.unlinkSync(filePath);
  }
  fs.rmdirSync(dirname);
}

async function doRmdir(source: string, slient = false, force = false) {
  const logger = getLogger();

  // if (!source) return logger.warn('请指定要删除的文件或目录路径');
  // source = path.resolve(source);
  // if (!fs.existsSync(source)) return logger.warn('要删除的文件或目录路径不存在！', color.red(source));

  const sourceTip = fs.statSync(source).isFile() ? '文件' : '目录';

  if (!force) {
    const force = await readSyncByRl(`是否删除该${sourceTip}(y/)？[${color.red(source)}] `);
    if ('y' !== String(force).trim().toLowerCase()) return false;
  }

  await new Promise(resolve => {
    fs.rm(source, { recursive: true, maxRetries: 3 }, error => {
      if (error) {
        console.log('error:', error.message || error);
        rmRecursive(source);
      }
      resolve(error?.errno);
    });
  });

  if (!slient) logger.info(`${sourceTip}已删除：`, color.green(source));
  return true;
}

export async function rmdir(srcs: string[], slient = false, force = false) {
  const logger = getLogger();

  if (!Array.isArray(srcs) || srcs.length === 0) {
    logger.warn('请指定要删除的文件或目录路径');
    return 0;
  }

  const list: Promise<boolean>[] = [];
  for (const source of srcs) {
    const files = glob.sync(source, { cwd: process.cwd() });
    for (const filepath of files) {
      list.push(doRmdir(filepath, slient, force));
    }
  }

  const result = await Promise.all(list);
  const total = result.filter(Boolean).length;

  logger.debug(`执行完成！共删除了 ${total} 个文件或目录`);

  return total;
}

if (module === require.main) rmdir(process.argv.slice(2), false, true);
