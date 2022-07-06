// eslint-disable-next-line @typescript-eslint/ban-types
export function isObject(obj: unknown): obj is Object {
  return typeof obj === 'object' && obj !== null && !Array.isArray(obj) && !(obj instanceof RegExp) && !(obj instanceof Date);
}

export function isEmpty(obj: unknown): boolean {
  return !obj || (Array.isArray(obj) && obj.length === 0) || isEmptyObject(obj);
}

export function isEmptyObject(obj: unknown): obj is object {
  if (!isObject(obj)) return false;

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) return false;
  }

  return true;
}

export function isNumber(obj: unknown): obj is number {
  return typeof obj === 'number' && !Number.isNaN(obj);
}

export function isArray(array: unknown): array is unknown[] {
  return Array.isArray(array);
}

export function isUndefinedOrNull(value: unknown) {
  return null == value;
}

// eslint-disable-next-line @typescript-eslint/ban-types
export function isFunction(obj: unknown): obj is Function {
  return typeof obj === 'function';
}

export function isSet(obj: unknown): obj is Set<unknown> {
  if (!globalThis.Set) return false;
  return obj instanceof Set; // String(obj) === '[object Set]';
}

export function isMap(obj: unknown): obj is Map<unknown, unknown> {
  if (!globalThis.Map) return false;
  return obj instanceof Map; // String(obj) === '[object Map]';
}

export function isPromise<T>(obj: unknown): obj is Promise<T> {
  return !!obj && typeof (obj as Promise<T>).then === 'function' && typeof (obj as Promise<T>).catch === 'function';
}

export function isIterable<T>(obj: unknown): obj is Iterable<T> {
  return !!obj && typeof (obj as never)[Symbol.iterator] === 'function';
}
