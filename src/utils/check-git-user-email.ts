import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getUserEmail, isGitRepo } from '@lzwme/fe-utils';
/*
 * @Author: renxia
 * @Date: 2023-03-23 22:34:36
 * @LastEditors: renxia
 * @LastEditTime: 2024-04-10 10:48:20
 * @Description:
 */
import { color } from 'console-log-colors';

export function checkUserEmial(regRule: string | RegExp, exitOnError = true, rootDir = process.cwd()) {
  let errmsg = '';
  if (regRule == null || !isGitRepo(rootDir)) return errmsg;

  const cacheFile = resolve(rootDir, './.git/useremail');
  if (existsSync(cacheFile)) return errmsg;
  const email = getUserEmail();

  if (typeof regRule === 'string') regRule = new RegExp(regRule);
  if (!regRule.test(email)) {
    errmsg = `不正确的邮箱配置，正确的规则为：${color.green(regRule.toString())}。当前为：${color.red(email)}`;
    if (exitOnError) {
      console.error(errmsg);
      process.exit(-1);
    }
    return errmsg;
  }
  writeFileSync(cacheFile, email);

  return errmsg;
}
