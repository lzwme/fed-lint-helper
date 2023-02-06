import { wxWorkNotify, sleep } from '@lzwme/fe-utils';
import { config } from './config.js';
import { logTimeCost } from './utils/common.js';
import { getLogger } from './utils/get-logger.js';

/**
 * 退出当前 process 进程
 * @param {number} code 退出码
 * @param {number} startTime 开始时间，存在则打印执行时间成本
 */
export async function exit(code = 0, prefix = '', startTime = 0, errmsg = '') {
  let needDelay = config.debug;

  if (startTime) logTimeCost(startTime, prefix);
  if (code !== 0) {
    if (config.wxWorkKeys.length > 0 && prefix !== 'wx') {
      // 企业微信通知
      const message =
        typeof config.wxWorkMessageFormat === 'function' ? config.wxWorkMessageFormat(prefix, { errmsg }) : `${prefix}任务执行失败，请检查`;
      await wxWorkNotify(message, config.wxWorkKeys, config.debug);
      needDelay = true;
    }

    if (typeof config.beforeExitOnError === 'function') {
      await config.beforeExitOnError(code, prefix);
      needDelay = true;
    }
  }

  if (config.debug) getLogger().debug(`[${prefix}] exit. code=${code}`);
  if (needDelay) await sleep(100);

  process.exit(code || 0);
}
