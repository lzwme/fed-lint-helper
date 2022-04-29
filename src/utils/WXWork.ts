/* eslint-disable @typescript-eslint/no-explicit-any */
/*
 * @Author: lzw
 * @Date: 2021-12-24 13:01:39
 * @LastEditors: lzw
 * @LastEditTime: 2022-04-29 18:47:42
 * @Description: 企业微信机器人通知
 */

import { config } from '../config';
import { Request } from './request';
import { Logger } from './Logger';

const api = new Request();

const webhook = 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=';

interface WxWorkResult {
  errcode: number;
  errmsg: string;
}

/** 企业微信机器人消息通知 */
export async function wxWorkNotify(params: string | Record<string, any>, webhookUrl?: string[]): Promise<WxWorkResult[]>;
export async function wxWorkNotify(params: string | Record<string, any>, webhookUrl?: string): Promise<WxWorkResult>;
export async function wxWorkNotify(params: string | Record<string, any>, webhookUrl?: string | string[]) {
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

  if (config.debug) Logger.getLogger().debug('[wxWorkNotify]', webhookUrl, params);

  return api
    .post<WxWorkResult>(webhookUrl, params, {
      'content-type': 'application/json',
      type: 'payload',
    })
    .then(d => {
      Logger.getLogger().log('[wxWorkNotify]', JSON.stringify(d.data));
      return d.data;
    });
}

// wxWorkNotify('hello!');
