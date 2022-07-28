/* eslint no-console: 0 */
import { color } from 'console-log-colors';
import { NLogger, LogLevelType } from '@lzwme/fe-utils';

export function getLogger(tag = '[flh]', levelType?: LogLevelType, logDir?: string): NLogger {
  return NLogger.getLogger(tag, { levelType, color, logDir });
}
