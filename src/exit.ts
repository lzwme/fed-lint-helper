import { wxWorkNotify } from '@lzwme/fe-utils/cjs/node/lib/WXWork';
import { sleep } from '@lzwme/fe-utils';
import { config } from './config';
import { logTimeCost } from './utils/common';

/**
 * 退出当前 process 进程
 * @param {number} code 退出码
 * @param {number} startTime 开始时间，存在则打印执行时间成本
 */
export async function exit(code = 0, prefix = '', startTime = 0) {
  if (startTime) logTimeCost(startTime, prefix);
  if (code !== 0) {
    if (config.wxWorkKeys.length > 0 && prefix !== 'wx') {
      // 企业微信通知
      const message =
        typeof config.wxWorkMessageFormat === 'function' ? config.wxWorkMessageFormat(prefix) : `${prefix}任务执行失败，请检查`;
      await wxWorkNotify(message, config.wxWorkKeys, config.debug);
      await sleep(100);
    }

    if (typeof config.beforeExitOnError === 'function') {
      await config.beforeExitOnError(code, prefix);
      await sleep(100);
    }
  }

  process.exit(code || 0);
}
