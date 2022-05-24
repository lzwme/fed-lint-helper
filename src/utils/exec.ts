import { type StdioOptions, execSync as cpExecSync, exec } from 'child_process';
import { color } from 'console-log-colors';
import { getLogger } from './get-logger';

process.stderr.setMaxListeners(0);
process.stdout.setMaxListeners(0);

export function execPromisfy(cmd: string, debug = process.env.DEBUG != null) {
  return new Promise<{ error: Error; stdout: string; stderr: string }>(resolve => {
    if (debug) getLogger().log(color.green('exec cmd:'), color.cyanBright(cmd));

    const proc = exec(cmd, (error, stdout, stderr) => {
      if (error) getLogger().error(`\n[exec]命令执行失败：${cmd}\n`, color.redBright(error.message), '\n', error);
      resolve({ error, stdout: stdout.trim(), stderr });
    });

    proc.stderr.pipe(process.stderr);
    if (debug) proc.stdout.pipe(process.stdout);
  });
}

export function execSync(cmd: string, stdio?: StdioOptions, cwd = process.cwd(), debug = false) {
  if (debug) getLogger().debug(color.cyanBright('exec cmd:'), color.yellowBright(cmd), color.cyan(cwd));

  try {
    // 为 pipe 才会返回输出结果给 res；为 inherit 则打印至 stdout 中，res 为空
    if (!stdio) stdio = debug ? 'inherit' : 'pipe';
    const res = cpExecSync(cmd, { stdio, encoding: 'utf8', cwd });
    return res ? res.toString().trim() : '';
  } catch (error) {
    getLogger().error(color.redBright(error.message));
    return '';
  }
}
