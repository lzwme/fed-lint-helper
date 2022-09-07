/*
 * @Author: lzw
 * @Date: 2022-09-07 09:04:38
 * @LastEditors: lzw
 * @LastEditTime: 2022-09-07 11:34:37
 * @Description: create filter
 * @see https://github.com/rollup/plugins/blob/master/packages/pluginutils/src/createFilter.ts
 */

import { resolve, posix, isAbsolute, extname } from 'node:path';

function normalizePath(filename: string) {
  return filename.replace(/\\/g, '/');
  // return filename.split(win32.sep).join(posix.sep);
}

function ensureArray<T>(input: readonly T[] | T | undefined | null): readonly T[] {
  if (Array.isArray(input)) return input as T[];
  if (input == null) return [];
  return [input as T];
}

function getMatcherString(id: string, resolutionBase: string | false | null | undefined) {
  if (resolutionBase === false || isAbsolute(id) || id.startsWith('*')) {
    return normalizePath(id);
  }

  // resolve('') is valid and will default to process.cwd()
  const basePath = normalizePath(resolve(resolutionBase || ''))
    // escape all possible (posix + win) path characters that might interfere with regex
    .replace(/[$()*+.?[\]^{|}-]/g, '\\$&');
  // Note that we use posix.join because:
  // 1. the basePath has been normalized to use /
  // 2. the incoming glob (id) matcher, also uses /
  // otherwise Node will force backslash (\) on windows
  return posix.join(basePath, normalizePath(id));
}

/**
 * A valid `picomatch` glob pattern, or array of patterns.
 */
export type FilterPattern = ReadonlyArray<string | RegExp> | string | RegExp | null;

export function createFilter(
  options: {
    include?: FilterPattern;
    exclude?: FilterPattern;
    extensions?: string[];
    globMatcher?: (pathId: string, ruleId: string, ruleIdNormalized?: string) => boolean;
    /** resolve with base path for options.include and options.exclude */
    resolve?: string | false | null;
  } = {}
) {
  let { extensions = [] } = options;
  const getMatcher = (id: string | RegExp) =>
    id instanceof RegExp
      ? id
      : {
          test: (what: string) => {
            if (what.includes(id)) return true;

            if (options.globMatcher) {
              // this refactor is a tad overly verbose but makes for easy debugging
              const pattern = getMatcherString(id, options.resolve);
              return options.globMatcher(what, pattern, id);

              // const pm = require('picomatch');
              // const fn = pm(pattern, { dot: true });
              // const result = fn(what);
              // return result;
            }

            return false;
          },
        };

  const includeMatchers = ensureArray(options.include).map(d => getMatcher(d));
  const excludeMatchers = ensureArray(options.exclude).map(d => getMatcher(d));

  if (extensions.length > 0) extensions = extensions.map(d => (d.startsWith('.') ? d : `.${d}`));

  return function result(id: string | unknown): boolean {
    if (typeof id !== 'string') return false;
    if (/\0/.test(id)) return false;

    const pathId = normalizePath(id);

    if (extensions.length > 0) {
      const ext = extname(id);
      if (!extensions.includes(ext)) return false;
    }

    for (const matcher of excludeMatchers) {
      if (matcher.test(pathId)) return false;
    }

    for (const matcher of includeMatchers) {
      if (matcher.test(pathId)) return true;
    }

    return includeMatchers.length === 0;
  };
}
