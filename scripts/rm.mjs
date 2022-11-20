import { statSync, existsSync, rmSync } from 'node:fs';
import { color } from 'console-log-colors';

export async function rmdir(srcs) {
  if (!Array.isArray(srcs) || srcs.length === 0) {
    console.warn('请指定要删除的文件或目录路径');
  }

  for (const source of srcs) {
    if (existsSync(source)) {
      const sourceTip = statSync(source).isFile() ? '文件' : '目录';
      rmSync(source, { force: true, recursive: true });
      console.info(`${sourceTip}已删除：`, color.green(source));
    }
  }
}

rmdir(process.argv.slice(2), false, true);
