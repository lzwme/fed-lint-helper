import { URL } from 'url';
import zlib from 'zlib';
import http from 'http';
import https from 'https';
import type { PlainObject } from '../utils/common';

function toLowcaseKeyObject(info: Record<string, unknown> = {}) {
  for (const key of Object.keys(info)) {
    const lowCaseKey = key.toLocaleLowerCase();
    if (key !== lowCaseKey) {
      info[lowCaseKey] = info[key];
      delete info[key];
    }
  }
  return info;
}

export function urlFormat(url: string, params: PlainObject, isRepalce = false) {
  if (!url || !params) return url;

  const u = new URL(url);
  for (const [key, value] of Object.entries(params)) {
    if (isRepalce) u.searchParams.set(key, value);
    else u.searchParams.append(key, value);
  }

  return u.toString();
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
  private getHeaders(urlObject: URL, headers?: http.IncomingHttpHeaders) {
    headers = {
      ...this.headers,
      host: urlObject.host,
      origin: urlObject.origin || `${urlObject.protocol}://${urlObject.hostname}`,
      ...toLowcaseKeyObject(headers),
    };

    if (!headers.cookie && this.cookies.length > 0) headers.cookie = this.getCookie() as string;

    return headers;
  }
  setCookie(cookie: string, reset = false) {
    if (reset) this.cookies = [];
    const cookies = cookie.split(';').map(d => d.trim());
    for (const c of cookies) !this.cookies.includes(c) && this.cookies.push(c);
    return this;
  }
  getCookie(isString = true) {
    return isString ? this.cookies.join('; ') : this.cookies;
  }
  request<T = PlainObject>(method: string, url: string | URL, parameters: PlainObject, headers?: http.IncomingHttpHeaders) {
    const urlObject = typeof url === 'string' ? new URL(url) : url;
    const options: https.RequestOptions = {
      hostname: urlObject.host.split(':')[0],
      port: urlObject.port,
      path: urlObject.href.split(urlObject.host)[1],
      method: method,
      headers: this.getHeaders(urlObject, headers),
    };
    let postBody = '';

    if (parameters) {
      postBody = String(options.headers['content-type']).includes('application/json')
        ? JSON.stringify(parameters)
        : new URLSearchParams(parameters).toString();
      options.headers['content-length'] = Buffer.byteLength(postBody).toString();
    }

    return new Promise((resolve, reject) => {
      const request = (urlObject.protocol == 'http:' ? http : https).request(options, response => {
        const chunks: Buffer[] = [];
        response.on('data', data => chunks.push(data));
        request.on('error', error => reject(error));
        response.on('end', () => {
          const buffer = Buffer.concat(chunks);
          const encoding = response.headers['content-encoding'];
          const resolveData = (body: string) => {
            const result = { data: body as never as T, headers: response.headers };
            try {
              result.data = JSON.parse(body);
              resolve(result);
            } catch (error) {
              console.error((error as Error).message, result);
              resolve(result);
            }
          };

          if (encoding == 'gzip') {
            zlib.gunzip(buffer, (_error, decoded) => resolveData(decoded.toString()));
          } else if (encoding == 'deflate') {
            zlib.inflate(buffer, (_error, decoded) => resolveData(decoded.toString()));
          } else {
            resolveData(buffer.toString());
          }
        });
      });

      if (postBody) request.write(postBody);
      request.end();
    }) as Promise<{ data: T; headers: http.IncomingHttpHeaders }>;
  }
  get<T = PlainObject>(url: string, parameters?: PlainObject, headers?: http.IncomingHttpHeaders) {
    return this.request<T>('GET', urlFormat(url, parameters), void 0, headers);
  }
  post<T = PlainObject>(url: string, parameters: PlainObject, headers?: http.IncomingHttpHeaders) {
    return this.request<T>('POST', url, parameters, headers);
  }
}
