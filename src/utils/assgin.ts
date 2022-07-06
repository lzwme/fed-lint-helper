/* eslint-disable @typescript-eslint/no-explicit-any */
import type { PlainObject } from './common';
import { isSet, isMap } from './is';

/**
 * 将 b 合并深度到 a
 */
export function simpleAssign<T extends Record<string, any>, U>(a: T, b: U, filter?: (value: unknown) => boolean): T & U {
  // 入参不是对象格式则忽略
  if (!a || typeof a !== 'object') return a as T & U;
  if (typeof b !== 'object' || b instanceof RegExp || Array.isArray(b)) {
    return a as T & U;
  }

  for (const key in b) {
    const value = b[key];
    if (typeof filter === 'function' && !filter(value)) continue;

    if (null == value || typeof value !== 'object' || value instanceof RegExp || isSet(value) || isMap(value)) {
      // @ts-ignore
      a[key] = value;
    }
    // 如果是数组，则只简单的复制一份（不考虑数组内的类型）
    else if (Array.isArray(value)) {
      // @ts-ignore
      a[key] = [...value];
    } else {
      // @ts-ignore
      if (!a[key as string]) a[key] = {};
      simpleAssign(a[key as string], value, filter);
    }
  }

  return a as T & U;
}

/** 简易的对象深复制 */
export function assign<T = PlainObject>(a: T, ...args: PlainObject[]): T {
  if (a && typeof a === 'object') {
    for (const arg of args) simpleAssign(a, arg);
  }
  return a;
}
