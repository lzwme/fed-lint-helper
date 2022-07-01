/*
 * @Author: lzw
 * @Date: 2021-12-24 13:01:39
 * @LastEditors: lzw
 * @LastEditTime: 2022-07-01 10:10:42
 * @Description: 企业微信机器人通知
 */

import { Request } from './request';
import { getLogger } from '../utils/get-logger';

const api = new Request();

const webhook = 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=';

export interface WxWorkReqParams {
  msgtype: string;
  text?: {
    content: string;
    mentioned_list?: string[];
    mentioned_mobile_list?: string[];
  };
  markdown?: {
    content: string;
  };
  image?: {
    /** 图片 base64，最大不超过2M(编码前，jpg/png 格式) */
    base64: string;
    md5: string;
  };
  news?: {
    articles: {
      title: string;
      description: string;
      url: string;
      picurl?: string;
    }[];
  };
  file?: {
    /** 通过文件上传接口返回的文件id */
    media_id: string;
  };
  template_card?: {
    /** 模板类型。文本通知模板卡片的类型为： text_notice */
    card_type: 'news_notice' | 'text_notice';
    /** 卡片来源样式信息 */
    source?: {
      icon_url?: string;
      desc?: string;
      desc_color?: number;
    };
    /** 模版卡片的主要内容，包括一级标题和标题辅助信息 */
    main_title: {
      /** 一级标题，建议不超过26个字 */
      title: string;
      /** 标题辅助信息，建议不超过30个字 */
      desc?: string;
    };
    /** text_notice */
    emphasis_content?: {
      title: string;
      desc: string;
    };
    /** 图片样式 */
    card_image?: {
      url: string;
      aspect_ratio?: number;
    };
    /** 左图右文样式 */
    image_text_area?: {
      type?: number;
      url?: string;
      title?: string;
      desc?: string;
      image_url?: string;
      appid?: string;
    };
    quote_area?: {
      type: number;
      url: string;
      appid: string;
      pagepath: string;
      title: string;
      quote_text: string;
    };
    sub_title_text: string;
    vertical_content_list?: {
      title: string;
      desc?: string;
    };
    horizontal_content_list?: {
      keyname: string;
      value: string;
      type?: number;
      url?: string;
      media_id?: string;
    }[];
    jump_list: {
      type: number;
      url?: string;
      title: string;
      appid?: string;
      pagepath?: string;
    }[];
    /** 整体卡片的点击跳转事件，news_notice模版卡片中该字段为必填项 */
    card_action?: {
      type: number;
      url?: string;
      appid?: string;
      pagepath?: string;
    };
  };
}

interface WxWorkResult {
  errcode: number;
  errmsg: string;
}

/** 企业微信机器人消息通知 */
export function wxWorkNotify(params: string | WxWorkReqParams, webhookUrl: string[], debug?: boolean): Promise<WxWorkResult[]>;
export function wxWorkNotify(params: string | WxWorkReqParams, webhookUrl: string, debug?: boolean): Promise<WxWorkResult>;
export function wxWorkNotify(params: string | WxWorkReqParams, webhookUrl: string | string[], debug = false) {
  if (!webhookUrl) return Promise.resolve({ errcode: -1, errmsg: '[wxWorkNotify][webhook] cannot be empty' });

  if (Array.isArray(webhookUrl)) {
    return Promise.all(webhookUrl.map(u => wxWorkNotify(params, u)));
  }

  if (!/[\da-z]{8}(-[\da-z]{4}){3}-[\da-z]{12}/i.test(webhookUrl)) {
    return Promise.resolve({ errcode: -2, errmsg: '[wxWorkNotify][webhook]invalid format' });
  }

  if (!webhookUrl.startsWith('http')) webhookUrl = webhook + webhookUrl;

  if (typeof params === 'string') {
    params = {
      msgtype: 'text',
      text: {
        content: params,
        // mentioned_list: ['@all'],
      },
    };
  }

  if (debug) getLogger(null, 'debug').debug('[wxWorkNotify]', webhookUrl, params);

  return api.post<WxWorkResult>(webhookUrl, params, { 'content-type': 'application/json' }).then(d => {
    getLogger().log(`[wxWorkNotify][${d.data.errcode}]`, debug ? JSON.stringify(d.data) : d.data.errmsg);
    return d.data;
  });
}

// wxWorkNotify('hello!');
if (module === require.main) {
  const argv = process.argv.slice(2);
  if (argv.length >= 2) wxWorkNotify(argv[0], argv[1], argv[2] != null);
}
