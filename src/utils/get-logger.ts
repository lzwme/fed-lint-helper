/* eslint no-console: 0 */
import { color } from 'console-log-colors';
import { Logger, LogLevelType } from '../lib';

export function getLogger(tag = '[flh]', levelType?: LogLevelType, instanceId = 'flh'): Logger {
  return Logger.getLogger(tag, instanceId, { levelType, color });
}
