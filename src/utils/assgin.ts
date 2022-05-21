import type { PlainObject } from './common';

export function simpleAssign<T = PlainObject>(a: T, b: PlainObject, isIgnoreNull = false): T {
  // 入参不是对象格式则忽略
  if (!a || typeof a !== 'object') return a;
  if (typeof b !== 'object' || b instanceof RegExp || Array.isArray(b)) {
    return a;
  }

  for (const key in b) {
    // 如果是数组，则只简单的复制一份（不考虑数组内的类型）
    if (Array.isArray(b[key])) {
      a[key] = [...b[key]];
    } else if (null == b[key] || typeof b[key] !== 'object' || b[key] instanceof RegExp) {
      if (!isIgnoreNull || null != b[key]) a[key] = b[key];
    } else {
      if (!a[key]) a[key] = {};
      simpleAssign(a[key], b[key], isIgnoreNull);
    }
  }

  return a;
}

/** 简易的对象深复制 */
export function assign<T = PlainObject>(a: T, ...args: PlainObject[]): T {
  if (!a || typeof a !== 'object') return a;

  args = args.reverse();
  const b: PlainObject = {};

  for (const arg of args) {
    simpleAssign(b, arg);
  }

  return simpleAssign(a, b);
}
