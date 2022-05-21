import { assign, simpleAssign } from './assgin';

describe('utils/assign', () => {
  it('simpleAssgin', () => {
    const a = { a: 1, b: { c: 2, d: 3 } };
    const b = { b: { c: null, d: 5 } };

    let c = simpleAssign(a, b, true);
    expect(c.b.c).toBe(2);

    c = simpleAssign(a, b);
    expect(c.b.c).toBeNull();
    expect(a == c).toBeTruthy();
  });
  it('assign', () => {
    const a = { b: 1 };
    const b = { a: { b: 1 }, b: 2, c: [1, 2] };

    expect(assign(a, b)).toEqual(a);
    expect(assign(a, b).b).toEqual(2);
    expect(assign(a, [], b).b).toEqual(2);
    expect(Array.isArray(assign(a, b)['c'])).toBeTruthy();

    expect(assign(void 0, b) == void 0).toBeTruthy();
    expect(assign(a, void 0)).toEqual(a);

    // 第一个参数是数组，则原样返回
    const array = [b];
    expect(assign(array, b)).toEqual(array);
  });

  it('assignMuti', () => {
    const m = assign<Record<string, number | null>>({ a: 1 }, { a: 2 }, { a: null, b: 10 }, { a: 3, b: 3 });
    expect(m.a).toBe(3);
    expect(m.b).toBe(3);
  });
});
