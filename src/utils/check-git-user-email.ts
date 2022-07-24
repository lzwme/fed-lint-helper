import { existsSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { execSync } from './exec';

export const checkUserEmial = (regRule: string | RegExp, exitOnError = true, rootDir = process.cwd()) => {
  let errmsg = '';
  if (regRule == null || !existsSync(resolve(rootDir, './.git'))) return errmsg;

  const cacheFile = resolve(rootDir, './.git/useremail');
  if (existsSync(cacheFile)) return errmsg;

  const email = execSync('git config --get user.email').stdout;

  if (typeof regRule === 'string') regRule = new RegExp(regRule);
  if (regRule.test(email)) {
    errmsg = `不正确的提交邮箱配置，正确的规则为：${regRule.toString()}。当前为：${email}`;
    if (exitOnError) {
      console.error(errmsg);
      process.exit(-1);
    }
    return errmsg;
  }
  writeFileSync(cacheFile, email);

  return errmsg;
};
