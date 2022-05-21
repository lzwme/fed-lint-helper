/* eslint no-console: 0 */
import { color } from 'console-log-colors';
import { Logger, LogLevelType } from '../lib';

export function getLogger(tag = '[flh]', levelType?: LogLevelType, instanceId?: string): Logger {
  return Logger.getLogger(tag, instanceId, { levelType, color });
}
