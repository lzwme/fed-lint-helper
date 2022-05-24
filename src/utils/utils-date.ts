/**
 * 日期时间相关的工具方法(无外部依赖)
 */

/**
 * 将给定时间日期按照指定格式格式化输出 -- 建议使用 moment().format 替代
 * @param fmt {string} 格式
 * @param date {Date|string} 指定的日期。为 Date 类型，或 20180131 格式字符串、或可 new Date() 格式化的字符串
 * @example
 * dateFormat('yyyy-MM-dd hh:mm:ss.S', new Date(1526895082375)); // 2018-05-21 17:31:22.375
 */
export function dateFormat(fmt: string, date: Date | string = new Date()): string {
  const rawDate = date;

  if (!(date instanceof Date)) {
    if (!date) return date;

    // 20100801 格式或 20100801162408 格式的日期支持
    if (/^\d+$/.test(date) && [8, 14, 17].includes(String(date).length)) {
      date = yyyyMMddFormat(date).date;
    } else {
      if (/^\d+$/.test(date)) {
        // 纯数字，视为时间戳
        date = new Date(+date);
      } else {
        if (typeof date === 'string') {
          date = date.trim().replace(/\//g, '-');
          if (/^\d{4}-\d{2}-\d{2}$/.test(date)) date += 'T00:00:00';
        }
        date = new Date(date);
      }
    }
  }

  if (Number.isNaN(date.getDate())) return String(rawDate || '');

  const o = {
    'M+': date.getMonth() + 1, // 月份
    'd+': date.getDate(), // 日
    'h+': date.getHours(), // 小时
    'm+': date.getMinutes(), // 分
    's+': date.getSeconds(), // 秒
    'q+': Math.floor((date.getMonth() + 3) / 3), // 季度
    S: String(date.getMilliseconds()).padStart(3, '0'), // 毫秒
  };

  if (!fmt) {
    return '' + date.getTime();
  }

  if (/(y+)/.test(fmt)) {
    fmt = fmt.replace(RegExp.$1, (date.getFullYear() + '').slice(4 - RegExp.$1.length));
  }
  for (const k in o) {
    if (new RegExp(`(${k})`).test(fmt)) {
      fmt = fmt.replace(RegExp.$1, RegExp.$1.length === 1 ? o[k] : ('00' + o[k]).slice(('' + o[k]).length));
    }
  }

  return fmt;
}

/**
 * 秒数转换为相差时间
 * @example
 * ```ts
 * arriveTimerFormat(123); => [0, 0, 2, 3, '00:02:03'];
 * arriveTimerFormat(1521580); // =>  [17, 14, 39, 40, '17day 14:39:40']
 * ```
 */
export function arriveTimerFormat(second: number | string, dayDesc = 'day ') {
  const s = +second;
  const t: string[] = [];
  let hour: number, min: number, sec: number, day: number;

  if (s > -1) {
    hour = Math.floor(s / 3600);
    min = Math.floor(s / 60) % 60;
    sec = s % 60;
    day = Math.floor(hour / 24);

    if (day > 0) {
      hour = hour - 24 * day;
      t.push(`${day}${dayDesc}` + String(hour).padStart(2, '0'));
    } else {
      t.push(String(hour).padStart(2, '0'));
    }

    t.push(String(min).padStart(2, '0'), String(sec).padStart(2, '0'));
  }

  return [day, hour, min, sec, t.join(':')] as const;
}

export function formatTimeCost(startTime: number, suffix = ['days', 'hours', 'min', 's', null]) {
  const s = Date.now() - startTime;

  let hour = Math.floor(s / 3600 / 1000);
  const day = Math.floor(hour / 24);
  const min = Math.floor(s / 60 / 1000) % 60;
  let sec = ((s / 1000) % 60).toFixed(3);
  const milliseconds = s % 1000;

  if (suffix[4] != null) sec = sec.split('.')[0];
  if (day) hour = hour - 24 * day;

  return [day, hour, min, sec, milliseconds]
    .map((v, index) => (v && suffix[index] != null ? `${v}${suffix[index]}` : null))
    .filter(Boolean)
    .join('');
}

/**
 * 格式化格式为 yyyyMMdd 或 yyyyMMddhhmmss 的日期字符串，输出为一个对象
 * @param date 格式可为 20180131、20190419000000000
 * @example
 * yyyyMMddFormat('20180101'); {year: '2018', month: '01', day: '01', str: '2018年01月01日', ...}
 * yyyyMMddFormat(''); // {year: '', month: '', day: '', str: '', ...}
 */
export function yyyyMMddFormat(dateStr: string) {
  dateStr = (dateStr || '') + '';

  const year = dateStr.slice(0, 4);
  const month = dateStr.slice(4, 6);
  const day = dateStr.slice(6, 8);
  // 20100801162408 格式的日期支持
  // 8位之后的时间为 hhmmss，或者 hmmss，不足6位则前缀补0修正为 6 位
  const timeStr = dateStr.slice(8).padStart(6, '0');
  const hour = timeStr.slice(0, 2);
  const minute = timeStr.slice(2, 4);
  const second = timeStr.slice(4, 6);
  const millisecond = timeStr.slice(6);

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    millisecond,
    str: dateStr ? `${year}年${month}月${day}日` : '',
    date: dateStr ? new Date(+year, +month - 1, +day, +hour, +minute, +second, +millisecond) : new Date(void 0),
    dateStr() {
      return this.str;
    },
  };
}
/**
 * 按指定时区取得当前时间
 * @param timeZone 指定的时区，默认为 0（北京市+8，美国华盛顿 -5）
 * @param now 指定的时间对象，默认为当前浏览器获取的时间 new Date()
 */
export function getDateTimeByTimeZone(timeZone = 0, now = new Date()) {
  // const now = new Date();
  // 当地时间偏移的毫秒数,这里可能是负数
  const localOffset = now.getTimezoneOffset() * 60_000;
  // utc即GMT时间
  const utc = now.getTime() + localOffset;
  /** 本地对应的毫秒数 */
  const localTime = utc + 3_600_000 * (+timeZone || 0);
  const date = new Date(localTime);
  // console.log("根据本地时间得知"+timeZone+"时区的时间是 " + date.toLocaleString());
  // console.log("系统默认展示时间方式是："+ date)
  return date;
}
/**
 * 将指定时区的时间转换为当前浏览器的时间
 * @param date 传入的(可被格式化的)时间
 * @param timeZone 参数 date 所表示的时区，默认为北京时间东八区
 */
export function toLocalTime(date: number | string | Date, timeZone = 8) {
  if (!date) return null;

  const localTimeZone = new Date().getTimezoneOffset() / 60;
  const localTime = typeof date === 'string' && /^\d+$/.test(date) ? yyyyMMddFormat(date).date : new Date(date);

  localTime.setHours(localTime.getHours() + localTimeZone + timeZone);

  return localTime;
}
/**
 * 计算相差时间
 * @param endTime 结束时间。格式：yyyyMMddhhmmss
 * @param startTime 起始时间。格式：yyyyMMddhhmmss
 */
export function getCostTime(endTime: string, startTime: string) {
  return yyyyMMddFormat(endTime).date.getTime() - yyyyMMddFormat(startTime).date.getTime();
}

/**
 * 将后台传过来的时间字符串转换为分号分隔显示的时间字符串
 * @example
 * ```ts
 * formatIntToTime(140151); // => 14:01:51
 * formatIntToTime(140151559); // => 14:01:51.559
 * formatIntToTime(140151559, false); // => 14:01:51
 * formatIntToTime(80151); // => 08:01:51
 * formatIntToTime(80151559); // => 08:01:51.559
 * formatIntToTime(80151559, false); // => 08:01:51
 * ```
 */
export function formatIntToTime(time: number | string | Date, withMillisecond = true) {
  let retVal = '';
  if (!time) return retVal;

  if (time instanceof Date) return dateFormat('hh:mm:ss', time);

  let timeStr = String(time);

  if (timeStr.length === 5 || timeStr.length === 8 || timeStr.length === 13) {
    timeStr = `0${timeStr}`;
  }

  if (timeStr.length === 6 || timeStr.length === 9) {
    retVal = `${timeStr.slice(0, 2)}:${timeStr.slice(2, 4)}:${timeStr.slice(4, 6)}`;

    if (withMillisecond && timeStr.length === 9) {
      const millisecond = timeStr.slice(6, 9);
      if (withMillisecond) retVal += `.${millisecond}`;
    }
  } else if (timeStr.length === 14 || timeStr.length === 17) {
    retVal = `${timeStr.slice(0, 4)}-${timeStr.slice(4, 6)}-${timeStr.slice(6, 8)} ${timeStr.slice(8, 10)}:${timeStr.slice(
      10,
      12
    )}:${timeStr.slice(12, 14)}`;

    if (withMillisecond && timeStr.length === 17) {
      const millisecond = timeStr.slice(14, 17);
      if (withMillisecond) retVal += `.${millisecond}`;
    }
  }
  return retVal;
}
