/* eslint-disable @typescript-eslint/no-explicit-any */
/*
 * @Author: lzw
 * @Date: 2021-12-24 13:01:39
 * @LastEditors: lzw
 * @LastEditTime: 2022-04-29 18:47:42
 * @Description: 企业微信机器人通知
 */

import { Request } from './request';
import { getLogger } from '../utils/get-logger';

const api = new Request();

const webhook = 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=';

interface WxWorkResult {
  errcode: number;
  errmsg: string;
}

/** 企业微信机器人消息通知 */
export function wxWorkNotify(params: string | Record<string, any>, webhookUrl: string[], debug?: boolean): Promise<WxWorkResult[]>;
export function wxWorkNotify(params: string | Record<string, any>, webhookUrl: string, debug?: boolean): Promise<WxWorkResult>;
export function wxWorkNotify(params: string | Record<string, any>, webhookUrl: string | string[], debug = false) {
  if (!webhookUrl) return Promise.resolve({ errcode: -1, errmsg: '[wxWorkNotify]没有传入 webhook key' });

  if (Array.isArray(webhookUrl)) {
    return Promise.all(webhookUrl.map(u => wxWorkNotify(params, u)));
  }

  if (!webhookUrl.startsWith('http')) webhookUrl = webhook + webhookUrl;

  if (typeof params === 'string') {
    params = {
      msgtype: 'text',
      text: {
        content: params,
        mentioned_list: ['@all'],
      },
    };
  }

  if (debug) getLogger(null, 'debug').debug('[wxWorkNotify]', webhookUrl, params);

  return api
    .post<WxWorkResult>(webhookUrl, params, {
      'content-type': 'application/json',
      type: 'payload',
    })
    .then(d => {
      getLogger().log(`[wxWorkNotify][${d.data.errcode}]`, debug ? JSON.stringify(d.data) : d.data.errmsg);
      return d.data;
    });
}

// wxWorkNotify('hello!');
