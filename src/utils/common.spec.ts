// import test from 'ava';
import * as comm from './common';
jest.mock('readline', () => ({
  createInterface() {
    return {
      question(tip: string, callback: (answer: string) => void) {
        callback(tip);
      },
      close: jest.fn,
    };
  },
}));

describe('utils/common', () => {
  it('readSyncByRl', async () => {
    expect(await comm.readSyncByRl()).toBe('>');
    expect(await comm.readSyncByRl('ok')).toBe('ok');
  });

  it('fixToshortPath', () => {
    expect(comm.fixToshortPath()).toBe('');
    expect(comm.fixToshortPath('./abc\\d.ts')).toBe('abc/d.ts');
  });

  it('logTimeCost', () => {
    comm.logTimeCost(Date.now());
    comm.log(Date.now());
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

  it('assign', () => {
    const a = { b: 1 };
    const b = { a: { b: 1 }, b: 2, c: [1, 2] };

    expect(comm.assign(a, b)).toEqual(a);
    expect(comm.assign(a, b).b).toEqual(2);
    expect(comm.assign(a, [], b).b).toEqual(2);
    expect(Array.isArray(comm.assign(a, b)['c'])).toBeTruthy();

    expect(comm.assign(void 0, b) == void 0).toBeTruthy();
    expect(comm.assign(a, void 0)).toEqual(a);

    // 第一个参数是数组，则原样返回
    const array = [b];
    expect(comm.assign(array, b)).toEqual(array);
  });

  it('execSync', () => {
    expect(comm.execSync('test')).toBeNull();
    expect(comm.execSync('echo test')).toBe('test');
    expect(comm.execSync('echo test', 'pipe', process.cwd(), true)).toBe('test');
    expect(comm.execSync('echo test', 'inherit', process.cwd(), true)).toBe('');

    // stdio = debug ? 'inherit' : 'pipe'
    expect(comm.execSync('echo test', null, process.cwd(), true)).toBe('');
    expect(comm.execSync('echo test', null, process.cwd(), false)).toBe('test');
  });

  it('sleep', async () => {
    const startTime = Date.now();
    await comm.sleep(10);
    expect(Date.now() - startTime).toBeGreaterThanOrEqual(10);
    await comm.sleep();
    expect(Date.now() - startTime).toBeGreaterThan(100);
  });
});
