import { color } from 'console-log-colors';
import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync, getUserEmail } from '@lzwme/fe-utils';
import { isGitRepo } from './common.js';

export const checkUserEmial = (regRule: string | RegExp, exitOnError = true, rootDir = process.cwd()) => {
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
};

/** getGitLog 返回项的格式 */
interface GitLogItem {
  /** hash 提交对象（commit）的完整哈希字串 */
  H?: string;
  /** abbrevHash 提交对象的简短哈希字串 */
  h?: string;
  /** treeHash 树对象（tree）的完整哈希字串 */
  T?: string;
  /** abbrevTreeHash 树对象的简短哈希字串 */
  t?: string;
  /** parentHashes 父对象（parent）的完整哈希字串 */
  P?: string;
  /** abbrevParentHashes 父对象的简短哈希字串 */
  p?: string;
  /** authorName 作者（author）的名字 */
  an?: string;
  /** authorEmail 作者的电子邮件地址 */
  ae?: string;
  /** authorDate 作者修订日期 */
  ad?: string;
  /** authorDateRel 作者修订日期，按多久以前的方式显示 */
  ar?: string;
  /** committerName 提交者(committer)的名字 */
  cn?: string;
  /** committerEmail 提交者的电子邮件地址 */
  ce?: string;
  /** committerDate 提交日期 */
  cd?: string;
  /** committerDateRel 提交日期，按多久以前的方式显示 */
  cr?: string;
  /** subject 提交说明 */
  s?: string;
}

/**
 * 获取近 N 条日志的详细信息
 * @param num 指定获取日志的数量
 */
export function getGitLog(num = 1, cwd?: string) {
  num = Math.max(1, +num || 1);
  const prettyFormat = ['H', 'h', 'T', 't', 'p', 'P', 'cd', 'ad', 'an', 'ae', 'ce', 's', 'ar', 'cr'];
  const cmd = `git log -${num} --pretty="tformat:%${prettyFormat.join(' _-_ %')}" --date=iso`;
  const logResult = execSync(cmd, 'pipe', cwd);
  if (logResult.stderr) console.error('[getGitLog][error]', logResult.stderr);
  const list = logResult.stdout.trim().split('\n');
  const result: GitLogItem[] = list.map(line => {
    const valList = line.split(' _-_ ');
    // eslint-disable-next-line unicorn/no-array-reduce
    return prettyFormat.reduce((r: GitLogItem, key: string, idx: number) => {
      r[key as never] = valList[idx] as never;
      return r;
    }, {});
  });

  return result;
}
