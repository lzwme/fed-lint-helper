import { config } from './config';
import { wxWorkNotify } from './lib/WXWork';
import { logTimeCost } from './utils';

/**
 * 退出当前 process 进程
 * @param {number} code 退出码
 * @param {number} startTime 开始时间，存在则打印执行时间成本
 */
export async function exit(code = 0, startTime = 0, prefix = '') {
  if (startTime) logTimeCost(startTime, prefix);
  if (code !== 0 && config.wxWorkNotify) {
    // 企业微信通知
    await wxWorkNotify(`${prefix}任务执行失败，请检查`, config.wxWorkNotify, config.debug);
    await new Promise(rs => setTimeout(() => rs(true), 100));
  }
  process.exit(code || 0);
}
