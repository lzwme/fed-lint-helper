import qs from 'querystring';
import { URL } from 'url';
import zlib from 'zlib';
import http from 'http';
import https from 'https';
import type { PlainObject } from './common';

function toLowcaseKeyObject(obj: Record<string, unknown> = {}) {
  Object.keys(obj).forEach(key => {
    const lowCaseKey = key.toLocaleLowerCase();
    if (key !== lowCaseKey) {
      obj[lowCaseKey] = obj[key];
      delete obj[key];
    }
  });
  return obj;
}

export class Request {
  private cookies: string[] = [];
  private headers: http.IncomingHttpHeaders = {
    pragma: 'no-cache',
    connection: 'keep-alive',
    'cache-control': 'no-cache',
    'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'accept-language': 'zh-CN,zh;q=0.8,en;q=0.6,zh-TW;q=0.4,es;q=0.2',
    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.121 Safari/537.36',
  };

  constructor(cookie?: string, headers?: http.IncomingHttpHeaders) {
    if (cookie) this.setCookie(cookie);
    if (headers) this.headers = Object.assign(this.headers, toLowcaseKeyObject(headers));
  }
  private getHeaders(urlObj, headers?: http.IncomingHttpHeaders) {
    headers = Object.assign(
      {},
      this.headers,
      {
        host: urlObj.host,
        origin: urlObj.origin || `${urlObj.protocol}://${urlObj.hostname}`,
      },
      toLowcaseKeyObject(headers)
    );
    if (!headers.cookie && this.cookies.length) headers.cookie = this.getCookie() as string;

    return headers;
  }
  setCookie(cookie: string, reset = false) {
    if (reset) this.cookies = [];
    const cookies = cookie.split(';').map(d => d.trim());
    cookies.forEach(c => !this.cookies.includes(c) && this.cookies.push(c));
    return this;
  }
  getCookie(isStr = true) {
    return isStr ? this.cookies.join('; ') : this.cookies;
  }
  request<T = PlainObject>(method: string, url: string, params: PlainObject, headers?: http.IncomingHttpHeaders) {
    const urlObj = new URL(url);
    const options: https.RequestOptions = {
      hostname: urlObj.host,
      port: urlObj.port,
      path: urlObj.href,
      method: method,
      headers: this.getHeaders(urlObj, headers),
    };
    let postBody = '';

    if (params) {
      postBody = String(options.headers['content-type']).includes('application/json') ? JSON.stringify(params) : qs.stringify(params);
      options.headers['content-length'] = Buffer.byteLength(postBody).toString();
    }

    return new Promise((resolve, reject) => {
      const req = (urlObj.protocol == 'http:' ? http : https).request(options, res => {
        const chunks = [];
        res.on('data', data => chunks.push(data));
        req.on('error', e => reject(e));
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          const encoding = res.headers['content-encoding'];
          const resolveData = (str: string) => {
            const result = { data: str as never as T, headers: res.headers };
            try {
              result.data = JSON.parse(str);
              resolve(result);
            } catch (err) {
              console.error(err.message, result);
              resolve(result);
            }
          };

          if (encoding == 'gzip') {
            zlib.gunzip(buffer, (_err, decoded) => resolveData(decoded.toString()));
          } else if (encoding == 'deflate') {
            zlib.inflate(buffer, (_err, decoded) => resolveData(decoded.toString()));
          } else {
            resolveData(buffer.toString());
          }
        });
      });

      if (postBody) req.write(postBody);
      req.end();
    }) as Promise<{ data: T; headers: http.IncomingHttpHeaders }>;
  }
  get<T = PlainObject>(url: string, headers?: http.IncomingHttpHeaders) {
    return this.request<T>('GET', url, null, headers);
  }
  post<T = PlainObject>(url: string, params: PlainObject, headers?: http.IncomingHttpHeaders) {
    return this.request<T>('POST', url, params, headers);
  }
}
