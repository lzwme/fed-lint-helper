/** @deprecated */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyObject = Record<string, any>;
export type ValueOf<T> = T[keyof T];
export type ArrayLikeArgs<T> = T extends ArrayLike<infer U> ? U : T;

export type IPackageManager = 'npm' | 'yarn' | 'pnpm';

export interface WhiteListInfo<T = unknown> {
  /** 白名单文件列表 */
  list: { [filepath: string]: T };
  $commitId?: string;
}

export interface LintCacheInfo<T = Record<string, unknown>> {
  /** 最近一次 Lint 通过的文件缓存列表 */
  list: {
    [filepath: string]: {
      md5: string;
      updateTime: number;
    } & T;
  };
  /** 最近一次执行的 commitId */
  $commitId?: string;
  /** 最近一次执行时的 flh 版本 */
  version?: string;
  /** 最近一次执行是否成功 */
  success?: boolean;
}

export interface LintResult {
  /** 是否检测通过 */
  isPassed: boolean;
  /** 开始处理时间 */
  startTime?: number;
  /** 处理的（源）文件总数 */
  totalFilesNum?: number;
  /** 异常信息数(一个文件可能包含多个异常) */
  errorCount?: number;
  /** 错误信息。如可回调给告警类任务 */
  errmsg?: string;
  /** 检测通过的文件数 */
  passedFilesNum?: number;
  /** 失败的文件数 */
  failedFilesNum?: number;
  /** 缓存命中的数量 */
  cacheHits?: number;
  /** 缓存文件与对应的缓存信息。放在最后汇总并写入文件 */
  cacheFiles?: {
    [filepath: string]: {
      updated: AnyObject;
      deleted?: Record<string, unknown>;
      type?: 'cache' | 'whitelist'; // todo: 用于区分 jsonFile 结构
    };
  };
  [key: string]: unknown;
}
