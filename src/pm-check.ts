import { color } from 'console-log-colors';
import { getLogger } from './utils';

export function packageManagerCheck(wantedPM = '', isDebug = false) {
  const execpath = process.env.npm_execpath || '';

  if (isDebug) console.log('execpath:', execpath);

  if (wantedPM !== 'npm' && wantedPM !== 'pnpm' && wantedPM !== 'yarn') {
    getLogger().log(
      `"${color.yellowBright(wantedPM)}" is not a valid package manager. Available package managers are: npm, pnpm, or yarn.`
    );
    process.exit(1);
  }

  const packageManager = /pnpm/.test(execpath) ? 'pnpm' : /yarn/.test(execpath) ? 'yarn' : 'npm';

  if (packageManager !== wantedPM) {
    getLogger().error(
      `This repository requires using ${color.magentaBright(wantedPM)} as the package manager for scripts to work properly.\n`
    );
    process.exit(1);
  }
  return true;
}
if (module === require.main) packageManagerCheck(process.argv.slice(2)[0]);
