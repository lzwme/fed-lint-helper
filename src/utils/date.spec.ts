/* eslint-disable jest/no-commented-out-tests */
import * as utilsDate from './date';

describe('utils-date', () => {
  it('dateFormat', () => {
    expect(utilsDate.dateFormat('yyyy').length).toEqual(4);

    const list = [
      ['', '1649211013915', '1649211013915'],
      ['yyyy-MM-dd', '1649211013915', '2022-04-06'],
      ['yyyy-MM-dd hh:mm:ss.S', new Date('2022-04-06T10:10:13.915'), '2022-04-06 10:10:13.915'],
    ] as const;

    for (const [fmt, d, r] of list) {
      expect(utilsDate.dateFormat(fmt, d)).toEqual(r);
    }
  });

  it('arriveTimerFormat', () => {
    const list = [
      [123, [0, 0, 2, 3, '00:02:03']],
      [1_521_580, [17, 14, 39, 40, '17day 14:39:40']],
      [0, [0, 0, 0, 0, '00:00:00']],
      [86_400, [1, 0, 0, 0, '1day 00:00:00']],
    ] as const;

    for (const [sec, r] of list) {
      expect(utilsDate.arriveTimerFormat(sec)).toEqual(r);
    }

    expect(utilsDate.arriveTimerFormat(86_400, '天')).toEqual([1, 0, 0, 0, '1天00:00:00']);
  });

  it('yyyyMMddFormat', () => {
    const list = [
      ['20180101', '2018年01月01日'],
      ['20190419000000000', '2019年04月19日'],
    ] as const;

    for (const [str, r] of list) {
      expect(utilsDate.yyyyMMddFormat(str).dateStr()).toEqual(r);
    }
  });

  // it('getDateTimeByTimeZone', () => {
  //   const list = [
  //     [8, new Date('2022-04-06T10:10:13.915'), 1_649_211_013_915],
  //     [-8, new Date('2022-04-06T10:10:13.915'), 1_649_153_413_915],
  //     [0, new Date('2022-04-06T10:10:13.915'), 1_649_182_213_915],
  //   ] as const;

  //   for (const [timeZone, now, r] of list) {
  //     expect(utilsDate.getDateTimeByTimeZone(timeZone, now).getTime()).toEqual(r);
  //   }
  // });

  // it('toLocalTime', () => {
  //   const list = [
  //     [new Date('2022-04-06T10:10:13.915'), 8, 1_649_211_013_915],
  //     [new Date('2022-04-06T10:10:13.915'), 0, 1_649_182_213_915],
  //     ['20220406', 8, 1_649_174_400_000],
  //     ['20220406', 0, 1_649_145_600_000],
  //   ] as const;

  //   for (const [now, timeZone, r] of list) {
  //     expect(utilsDate.toLocalTime(now, timeZone).getTime()).toEqual(r);
  //   }
  // });

  it('getCostTime', () => {
    const list = [
      ['20220406', '20220407', 86_400_000],
      ['20220406102004', '20220406102004', 0],
      ['20220406102004560', '20220406103005559', 600_999],
    ] as const;

    for (const [start, end, r] of list) {
      expect(utilsDate.getCostTime(end, start)).toEqual(r);
    }
  });

  it('formatIntToTime', () => {
    const list = [
      ['140151', '14:01:51'],
      ['140151559', '14:01:51.559'],
      [80_151, '08:01:51'],
      [80_151_559, '08:01:51.559'],
    ] as const;

    for (const [time, r] of list) {
      expect(utilsDate.formatIntToTime(time)).toEqual(r);
    }

    expect(utilsDate.formatIntToTime(80_151_559, false)).toEqual('08:01:51');
  });
});
