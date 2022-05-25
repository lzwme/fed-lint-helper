import { statSync } from 'fs';
import { color } from 'console-log-colors';
import { readSyncByRl } from './utils/common';
import { glob } from 'glob';
import { getLogger } from './utils/get-logger';
import { rmrfAsync } from './utils/rmrf';

async function doRmdir(source: string, slient = false, force = false) {
  const logger = getLogger();
  const sourceTip = statSync(source).isFile() ? '文件' : '目录';

  if (!force) {
    const force = await readSyncByRl(`是否删除该${sourceTip}(y/)？[${color.red(source)}] `);
    if ('y' !== String(force).trim().toLowerCase()) return false;
  }

  await rmrfAsync(source);

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