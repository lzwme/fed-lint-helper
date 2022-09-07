/*
 * @Author: lzw
 * @Date: 2022-09-07 09:04:38
 * @LastEditors: lzw
 * @LastEditTime: 2022-09-07 15:26:07
 * @Description: create filter
 * @see https://github.com/rollup/plugins/blob/master/packages/pluginutils/src/createFilePathFilter.ts
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
 * A valid glob pattern, or array of patterns.
 */
export type FilterPattern = ReadonlyArray<string | RegExp> | string | RegExp | null;

export interface FilePathFilterOptions {
  /** A pattern, or array of patterns, which specify the files should operate on. */
  include?: FilterPattern;
  /** A pattern, or array of patterns, which specify the files should ignore. */
  exclude?: FilterPattern;
  extensions?: string[];
  /**
   * custom glob matcher. For example:
   * ### use picomatch
   * ```ts
   * import picomatch from 'picomatch';
   *
   * const globMatcher = (pathId, ruleIdNormalized, _ruleId) => {
   *    return picomatch(ruleIdNormalized, { dot: true })(pathId);
   * };
   * ```
   * ### use micromatch
   * ```ts
   * import { isMatch } from 'micromatch';
   *
   * const globMatcher = (pathId, ruleIdNormalized, _ruleId) => {
   *    return isMatch(pathId, ruleIdNormalized, { dot: true });
   * };
   * ```
   */
  globMatcher?: (pathId: string, ruleIdNormalized: string, ruleId: string) => boolean;
  /** resolve with base path for options.include and options.exclude */
  resolve?: string | false | null;
}

export function createFilePathFilter(options: FilePathFilterOptions = {}) {
  let { extensions = [] } = options;
  const getMatcher = (id: string | RegExp) => {
    if (id instanceof RegExp) return id;

    const pattern = getMatcherString(id, options.resolve);

    return {
      test: (what: string) => {
        if (what.includes(id)) return true;
        if (options.globMatcher) return options.globMatcher(what, pattern, id);

        return false;
      },
    };
  };

  const includeMatchers = ensureArray(options.include).map(d => getMatcher(d));
  const excludeMatchers = ensureArray(options.exclude).map(d => getMatcher(d));

  if (extensions.length > 0) {
    extensions = extensions.filter(Boolean).map(d => (d.startsWith('.') ? d : `.${d}`));
  }

  return function result(id: string | unknown): boolean {
    if (typeof id !== 'string') return false;
    if (/\0/.test(id)) return false;

    const pathId = normalizePath(id);

    if (extensions.length > 0) {
      const ext = extname(id);
      if (!ext || !extensions.includes(ext)) return false;
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
