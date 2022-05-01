import fs from 'fs';
import path from 'path';
import { color } from 'console-log-colors';
import { logTimeCost, readSyncByRl } from './common';

function rmdirCustom(dirname: string) {
  if (!fs.existsSync(dirname) || !fs.statSync(dirname).isDirectory()) return;

  const fileList = fs.readdirSync(dirname);

  for (const filename of fileList) {
    if (!filename || ['.', '..'].includes(filename)) continue;

    const filePath = path.resolve(dirname, filename);
    const fileStat = fs.statSync(filePath);

    if (fileStat.isDirectory()) {
      rmdirCustom(filePath);
      continue;
    }

    if (fileStat.isFile()) fs.unlinkSync(filePath);
  }
  fs.rmdirSync(dirname);
}

async function doRmdir(source: string, slient = false, force = false) {
  // console.log(option);
  if (!source) return console.log('请指定要删除的文件或目录路径');
  source = path.resolve(source);
  if (!fs.existsSync(source)) return console.log('要删除的文件或目录路径不存在！', color.red(source));
  const sourceTip = fs.statSync(source).isFile() ? '文件' : '目录';

  if (!force) {
    const force = await readSyncByRl(`是否删除该${sourceTip}(y/)？[${color.red(source)}] `);
    if ('y' !== String(force).trim().toLowerCase()) return;
  }
  const startTime = Date.now();
  try {
    fs.rmSync(source, { recursive: true });
  } catch (error) {
    console.log('error:', error.message || error);
    rmdirCustom(source);
  }
  if (!slient) console.log(`$[${logTimeCost(startTime)}] ${sourceTip}已删除：`, color.green(source));
  return true;
}

export async function rmdir(srcs: string[], slient = false, force = false) {
  if (!Array.isArray(srcs) || srcs.length === 0) return console.log('请指定要删除的文件或目录路径');
  if (srcs.length === 1) return doRmdir(srcs[0], slient, force);

  for (const source of srcs) {
    await doRmdir(source, slient, force);
  }

  return true;
}

if (module === require.main) rmdir(process.argv.slice(2));
