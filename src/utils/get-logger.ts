/* eslint no-console: 0 */
import { color } from 'console-log-colors';
import { Logger, LogLevelType } from '../lib/Logger';

export function getLogger(tag = '[flh]', levelType?: LogLevelType, logDir?: string): Logger {
  return Logger.getLogger(tag, { levelType, color, logDir });
}
