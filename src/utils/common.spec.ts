/* eslint-disable no-console */
// import test from 'ava';
import * as comm from './common';

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

  it('arrayToObject', () => {
    expect(comm.arrayToObject([])).toEqual({});
    expect(comm.arrayToObject(['abc'])).toEqual({ abc: 1 });
    expect(comm.arrayToObject(['abc'], true)).toEqual({ abc: true });

    const spy = jest.fn();
    try {
      comm.arrayToObject(null);
    } catch {
      spy();
    }
    expect(spy).toHaveBeenCalled();
    // expect(comm.arrayToObject(null)).toThrow();
  });

  it('padSpace', () => {
    expect(comm.padSpace('', 0)).toBe('');
    expect(comm.padSpace('123', 0)).toBe('123');
    expect(comm.padSpace('123', 3)).toBe('123');
    expect(comm.padSpace('123', 5)).toBe('  123');
    expect(comm.padSpace('123', 5, true)).toBe('  123');
    expect(comm.padSpace('123', 5, false)).toBe('123  ');
  });
});
