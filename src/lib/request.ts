import { URL } from 'url';
import zlib from 'zlib';
import http, { type IncomingMessage, type IncomingHttpHeaders } from 'http';
import https from 'https';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObject = Record<string, any>;

export function urlFormat(url: string, params: AnyObject, isRepalce = false) {
  const u = new URL(url, 'file:');

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      const val = value == null ? '' : typeof value === 'string' ? value : JSON.stringify(value);

      if (isRepalce) u.searchParams.set(key, val);
      else u.searchParams.append(key, val);
    }
  }

  return u;
}

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

export class Request {
  static instance: Request;
  static getInstance() {
    if (!this.instance) this.instance = new Request();
    return this.instance;
  }
  private cookies: string[] = [];
  private headers: IncomingHttpHeaders = {
    pragma: 'no-cache',
    connection: 'keep-alive',
    'cache-control': 'no-cache',
    'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'accept-language': 'zh-CN,zh;q=0.8,en;q=0.6,zh-TW;q=0.4,es;q=0.2',
    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.121 Safari/537.36',
  };

  constructor(cookie?: string, headers?: IncomingHttpHeaders) {
    if (cookie) this.setCookie(cookie);
    if (headers) this.headers = Object.assign(this.headers, toLowcaseKeyObject(headers));
  }
  private getHeaders(urlObject: URL, headers?: IncomingHttpHeaders) {
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
  request<T = Record<string, unknown>>(method: string, url: string | URL, parameters: AnyObject, headers?: IncomingHttpHeaders) {
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
        : new URLSearchParams(parameters as Record<string, string>).toString();
      options.headers['content-length'] = Buffer.byteLength(postBody).toString();
    }

    return new Promise<{ data: T; buffer: Buffer; headers: IncomingHttpHeaders; response: IncomingMessage }>((resolve, reject) => {
      const request = (urlObject.protocol === 'http:' ? http : https).request(options, response => {
        const chunks: Buffer[] = [];
        response.on('data', data => chunks.push(data));
        request.on('error', error => reject(error));
        response.on('end', () => {
          const buffer = Buffer.concat(chunks);
          const encoding = response.headers['content-encoding'];
          const contentType = response.headers['content-type'];
          const resolveData = (body: string | Buffer) => {
            const result = { data: body as never as T, buffer, headers: response.headers, response };
            try {
              if (typeof body === 'string' && (!contentType || contentType.includes('json'))) {
                result.data = JSON.parse(body);
              }
              resolve(result);
            } catch (error) {
              console.warn((error as Error).message, url);
              resolve(result);
            }
          };

          if (encoding === 'gzip') {
            zlib.gunzip(buffer, (_error, decoded) => resolveData(decoded.toString()));
          } else if (encoding === 'deflate') {
            zlib.inflate(buffer, (_error, decoded) => resolveData(decoded.toString()));
          } else {
            resolveData(buffer.toString());
          }
        });
      });

      if (postBody) request.write(postBody);
      request.end();
    });
  }
  get<T = Record<string, unknown>>(url: string, parameters?: AnyObject, headers?: IncomingHttpHeaders) {
    return this.request<T>('GET', urlFormat(url, parameters), void 0, headers);
  }
  post<T = Record<string, unknown>>(url: string, parameters: AnyObject, headers?: IncomingHttpHeaders) {
    return this.request<T>('POST', url, parameters, headers);
  }
}
