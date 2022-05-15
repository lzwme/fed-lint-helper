export function packageManagerCheck(wantedPM = process.argv.slice(2)[0], isDebug = false) {
  const execpath = process.env.npm_execpath || '';

  if (isDebug) console.log('execpath:', execpath);

  if (wantedPM !== 'npm' && wantedPM !== 'pnpm' && wantedPM !== 'yarn') {
    console.log(`"${wantedPM}" is not a valid package manager. Available package managers are: npm, pnpm, or yarn.`);
    process.exit(1);
  }

  const packageManager = /pnpm/.test(execpath) ? 'pnpm' : /yarn/.test(execpath) ? 'yarn' : 'npm';

  if (packageManager !== wantedPM) {
    console.warn(`\u001B[33mThis repository requires using ${wantedPM} as the package manager for scripts to work properly.\u001B[39m\n`);
    process.exit(1);
  }
  return true;
}
if (module === require.main) packageManagerCheck(process.argv.slice(2)[0]);
