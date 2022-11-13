// import test from 'ava';
import * as comm from './common';
import { isGitRepo } from './common';

describe('utils/common', () => {
  console.log = jest.fn();
  console.error = jest.fn();

  it('logTimeCost', () => {
    comm.logTimeCost(Date.now());
    expect(1).toBeTruthy();
  });

  it('formatWxWorkKeys', () => {
    expect(comm.formatWxWorkKeys(null).length).toBe(0);
    expect(comm.formatWxWorkKeys('').length).toBe(0);
    expect(comm.formatWxWorkKeys('abc').length).toBe(0);
    expect(comm.formatWxWorkKeys('d5aeb3d88dd64ffcbbe289982ca00000')[0].length).toBe(36);
    expect(comm.formatWxWorkKeys('d5aeb3d8-8dd6-4ffc-bbe2-89982ca00000')[0].length).toBe(36);
  });

  it('isGitRepo', () => {
    let exists = true;
    let execSyncResult = '';

    jest.mock('node:fs', () => ({
      existsSync: (_filepath: string) => {
        // console.log(_filepath, exists);
        return exists;
      },
      readFileSync: () => '',
    }));
    jest.mock('node:child_process', () => ({
      execSync: () => {
        if (execSyncResult) throw new Error(execSyncResult);
        return '';
      },
    }));

    expect(comm.isGitRepo()).toBeTruthy();

    exists = false;
    execSyncResult = 'isGitRepo exec error';
    expect(isGitRepo()).toBeTruthy();
    expect(isGitRepo('abc')).toBeFalsy();
  });
});
