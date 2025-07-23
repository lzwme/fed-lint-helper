import { type LogLevelType, NLogger } from '@lzwme/fe-utils';
/* eslint no-console: 0 */
import { color } from 'console-log-colors';

export const logger = NLogger.getLogger('[flh]', { color });

export function getLogger(tag?: string, levelType?: LogLevelType, logDir?: string): NLogger {
  if (tag) {
    return NLogger.getLogger(tag, { levelType, color, logDir });
  } else {
    if (levelType) logger.updateOptions({ levelType });
    if (logDir) logger.updateOptions({ logDir });
    return logger;
  }
}
