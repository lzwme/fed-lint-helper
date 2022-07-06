import { existsSync, readdirSync, rmdirSync, rmSync, statSync, unlinkSync, promises } from 'fs';
import { resolve } from 'path';

export function rmrf(filepath: string) {
  if (!existsSync(filepath)) return;

  const stats = statSync(filepath);

  if (!stats.isDirectory()) return unlinkSync(filepath);

  try {
    rmSync(filepath, { recursive: true });
  } catch {
    const fileList = readdirSync(filepath);
    for (const filename of fileList) rmrf(resolve(filepath, filename));
    rmdirSync(filepath);
  }
}

export async function rmrfAsync(filepath: string): Promise<void> {
  try {
    return promises.rm(filepath, { recursive: true, maxRetries: 3 });
  } catch {
    return rmrfAsync(filepath);
  }
}
