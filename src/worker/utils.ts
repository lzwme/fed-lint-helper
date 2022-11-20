import { assign, isObject } from '@lzwme/fe-utils';
import { getConfig } from '../config.js';
import type { FlhConfig, ILintTypes } from '../types.js';

export interface CreateThreadOptions<C = unknown> {
  debug?: boolean;
  /** 创建线程的类型。eslint 尽量使用该模式，使用 fork 进程方式 */
  type: ILintTypes;
  config: C;
  baseConfig?: FlhConfig;
}

export function handlerForCTOptions(options: CreateThreadOptions, type: 'send' | 'receive') {
  const baseConfig = getConfig();
  if (!options.baseConfig) options.baseConfig = baseConfig;
  if (type === 'send') {
    options.baseConfig[options.type] = options.config;
    delete options.config;
    options.baseConfig = tripFuntionProps(options.baseConfig) as never;
  } else {
    assign(baseConfig, options.baseConfig);
    // reset for child process
    const resetConfig = { checkOnInit: false, exitOnError: false, mode: 'current' };
    Object.assign(baseConfig[options.type], resetConfig);
    options.config = baseConfig[options.type];
  }

  return options;
}

function tripFuntionProps(obj: object) {
  if (!isObject(obj)) return obj;
  obj = Object.assign({}, obj);

  Object.entries(obj).forEach(([key, val]) => {
    if (Array.isArray(val)) return; // 不处理 array
    if (typeof val === 'function') delete obj[key as never];
    else if (isObject(val)) obj[key as never] = tripFuntionProps(val) as never;
  });

  return obj;
}
