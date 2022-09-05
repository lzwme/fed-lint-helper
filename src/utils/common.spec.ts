// import test from 'ava';
import * as comm from './common';

describe('utils/common', () => {
  console.log = jest.fn();
  console.error = jest.fn();

  it('logTimeCost', () => {
    comm.logTimeCost(Date.now());
    expect(1).toBeTruthy();
  });

  it('md5', () => {
    expect(comm.md5('abc').length).toEqual(32);
    expect(comm.md5('abc', true).length).toEqual(0);
    expect(comm.md5(__filename, true).length).toEqual(32);

    // catch error
    expect(comm.md5(void 0)).toEqual('');
    expect(comm.md5(null, true)).toEqual('');
  });

  it('formatWxWorkKeys', () => {
    expect(comm.formatWxWorkKeys(null).length).toBe(0);
    expect(comm.formatWxWorkKeys('').length).toBe(0);
    expect(comm.formatWxWorkKeys('abc').length).toBe(0);
    expect(comm.formatWxWorkKeys('d5aeb3d88dd64ffcbbe289982ca00000')[0].length).toBe(36);
    expect(comm.formatWxWorkKeys('d5aeb3d8-8dd6-4ffc-bbe2-89982ca00000')[0].length).toBe(36);
  });
});
