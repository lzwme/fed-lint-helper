import { type LogLevelType, NLogger } from '@lzwme/fe-utils';
/* eslint no-console: 0 */
import { color } from 'console-log-colors';

export function getLogger(tag = '[flh]', levelType?: LogLevelType, logDir?: string): NLogger {
  return NLogger.getLogger(tag, { levelType, color, logDir });
}
