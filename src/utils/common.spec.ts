import test from 'ava';
import * as comm from './common';

test('fixToshortPath', t => {
  t.is(comm.fixToshortPath('./abc\\d.ts'), 'abc/d.ts');
});

test('logTimeCost', t => {
  comm.logTimeCost(Date.now());
  t.pass();
});

test.serial('exit', t => {
  const exit = process.exit;
  let val = 0;
  process.exit = (v: number): never => {
    val = v;
    return null as never;
  };

  comm.exit();
  t.is(val, 0);

  comm.exit(1, Date.now());
  t.is(val, 1);

  process.exit = exit;
});

test('md5', t => {
  t.is(comm.md5('abc').length > 1, true);
  t.is(comm.md5('abc', true).length === 0, true);
  t.is(comm.md5(__filename, true).length > 1, true);
});
