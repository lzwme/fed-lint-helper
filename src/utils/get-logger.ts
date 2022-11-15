/* eslint no-console: 0 */
import { color } from 'console-log-colors';
import { NLogger, LogLevelType } from '@lzwme/fe-utils';
import { existsSync, promises } from 'node:fs';
import { resolve } from 'node:path';

export function getLogger(tag = '[flh]', levelType?: LogLevelType, logDir?: string): NLogger {
  return NLogger.getLogger(tag, { levelType, color, logDir });
}

/**
 * 日志清理
 * @deprecated
 */
export async function logClean(logDir: string, validityDays = 7): Promise<number> {
  let count = 0;
  if (!existsSync(logDir) || +validityDays < 1) return count;
  const list = await promises.readdir(logDir);
  const now = Date.now();

  const shelfLifeMs = validityDays * 86_400_000; // 24 * 60 * 60 * 1000;

  for (let filepath of list) {
    filepath = resolve(logDir, filepath);
    const stats = await promises.stat(filepath);
    if (stats.isDirectory()) count += await logClean(filepath, validityDays);
    else if (stats.isFile() && now - stats.mtimeMs > shelfLifeMs) {
      promises.unlink(filepath);
      count++;
    }
  }

  return count;
}
