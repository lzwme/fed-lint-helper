// import test from 'ava';
import * as comm from './common';
describe('utils/common', () => {
  it('fixToshortPath', () => {
    expect(comm.fixToshortPath('./abc\\d.ts')).toBe('abc/d.ts');
  });

  it('logTimeCost', () => {
    comm.logTimeCost(Date.now());
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
});
