/* eslint no-console: 0 */
import { color } from 'console-log-colors';
import { Logger, LogLevelType } from '../lib';

export function getLogger(tag = '[flh]', levelType?: LogLevelType): Logger {
  return Logger.getLogger(tag, { levelType, color });
}
