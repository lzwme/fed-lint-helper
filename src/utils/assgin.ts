/* eslint-disable @typescript-eslint/no-explicit-any */
import type { PlainObject } from './common';
import { isSet, isMap, isObject } from './is';

export function safeStringify(obj: any): string {
  const seen = new Set<any>();
  return JSON.stringify(obj, (_key, value) => {
    if (isObject(value) || Array.isArray(value)) {
      if (seen.has(value)) {
        return '[Circular]';
      } else {
        seen.add(value);
      }
    }
    return value;
  });
}

/**
 * 将 b 合并深度到 a
 */
export function simpleAssign<T extends Record<string, any>, U>(
  a: T,
  b: U,
  filter?: (value: unknown) => boolean,
  seen = new Set<unknown>()
): T & U {
  // 入参不是对象格式则忽略
  if (a === b || !a || typeof a !== 'object' || typeof b !== 'object' || b instanceof RegExp || Array.isArray(b)) {
    return a as T & U;
  }

  seen.add(b);

  for (const key in b) {
    const value = b[key];

    if (a[key] === value) continue;
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
      if (seen.has(value)) {
        a[key] = value as never;
      } else {
        seen.add(value);
        simpleAssign(a[key as string], value, filter, seen);
      }
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

/**
 * 获取一个对象的 key 列表（返回指定的类型）
 */
export function getObjectKeysUnsafe<T extends object>(value: T): (keyof T)[] {
  return Object.keys(value) as (keyof T)[];
}
