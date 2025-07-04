import { existsSync, readFileSync } from 'node:fs';
import type { PackageJson } from '@lzwme/fe-utils';
import type { IPackageManager } from '../types';

export function getPackageManager(pkg?: PackageJson): IPackageManager | undefined {
  let packageManager: IPackageManager;
  if (!pkg && existsSync('./package.json')) pkg = readFileSync('./package.json', 'utf8') as unknown as PackageJson;
  if (pkg?.packageManager) packageManager = pkg.packageManager.split('@')[0] as IPackageManager;

  if (!packageManager) {
    if (existsSync('./pnpm-lock.yaml')) return 'pnpm';
    if (existsSync('./yarn.lock')) return 'yarn';
    if (existsSync('./package-lock.json')) return 'npm';

    const execpath = process.env.npm_execpath || '';
    packageManager = execpath.includes('pnpm') ? 'pnpm' : execpath.includes('yarn') ? 'yarn' : void 0;
  }

  return packageManager;
}

export async function tryGetPackageManager(pkg?: PackageJson): Promise<IPackageManager> {
  let packageManager = getPackageManager(pkg);

  if (!packageManager) {
    const { default: enquirer } = await import('enquirer');
    const anwsers = await enquirer.prompt<{ pm: IPackageManager }>([
      {
        type: 'select',
        name: 'pm',
        message: '请选择使用的包管理器',
        choices: ['pnpm', 'yarn', 'npm'],
      },
    ]);
    packageManager = anwsers.pm;
  }
  return packageManager;
}
