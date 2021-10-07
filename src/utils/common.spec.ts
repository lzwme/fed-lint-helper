// import test from 'ava';
import * as comm from './common';
describe('utils/common', () => {
  it('fixToshortPath', () => {
    expect(comm.fixToshortPath('./abc\\d.ts')).toBe('abc/d.ts');
  });

  it('logTimeCost', () => {
    comm.logTimeCost(Date.now());
    comm.log(Date.now());
  });

  it('exit', () => {
    const exit = process.exit;
    let val = 0;
    process.exit = (v: number): never => {
      val = v;
      return null as never;
    };

    comm.exit();
    expect(val).toEqual(0);

    comm.exit(1, Date.now());
    expect(val).toEqual(1);

    process.exit = exit;
  });

  it('md5', () => {
    expect(comm.md5('abc').length > 1).toEqual(true);
    expect(comm.md5('abc', true).length === 0).toEqual(true);
    expect(comm.md5(__filename, true).length > 1).toEqual(true);
  });

  it('assign', () => {
    const a = { b: 1 };
    const b = { a: { b: 1 }, b: 2, c: [1, 2] };

    expect(comm.assign(a, b)).toEqual(a);
    expect(comm.assign(a, b).b).toEqual(2);
    expect(comm.assign(a, [], b).b).toEqual(2);
    expect(Array.isArray(comm.assign(a, b)['c'])).toBeTruthy();

    expect(comm.assign(null, b) === null).toBeTruthy();
    expect(comm.assign(a, null)).toEqual(a);

    // 第一个参数是数组，则原样返回
    const arr = [b];
    expect(comm.assign(arr, b)).toEqual(arr);
  });
});
