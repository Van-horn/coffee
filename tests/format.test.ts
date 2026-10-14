import { describe, expect, it } from 'vitest';
import { formatRuDate, formatRuDayMonth } from '@/lib/format';

describe('formatRuDate', () => {
  it('formats a Minsk Thursday morning', () => {
    expect(formatRuDate(new Date('2026-10-15T06:00:00Z'))).toBe('четверг, 15 октября');
  });

  it('uses the Minsk calendar day across the UTC boundary', () => {
    // 22:30Z on the 14th is 01:30 on Thu 15 Oct in Minsk.
    expect(formatRuDate(new Date('2026-10-14T22:30:00Z'))).toBe('четверг, 15 октября');
  });

  it('handles year end', () => {
    expect(formatRuDate(new Date('2026-12-31T06:00:00Z'))).toBe('четверг, 31 декабря');
  });

  it('crosses the year boundary on the Minsk calendar', () => {
    expect(formatRuDate(new Date('2026-12-31T21:30:00Z'))).toBe('пятница, 1 января');
  });

  it('covers every month in the genitive case', () => {
    const months = [
      'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
      'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
    ];
    months.forEach((name, i) => {
      expect(formatRuDate(new Date(Date.UTC(2026, i, 10, 9)))).toContain(` 10 ${name}`);
    });
  });

  it('names weekdays in Russian', () => {
    expect(formatRuDate(new Date('2026-10-18T09:00:00Z'))).toBe('воскресенье, 18 октября');
  });
});

describe('formatRuDayMonth', () => {
  it('omits the weekday', () => {
    expect(formatRuDayMonth(new Date('2026-10-22T06:00:00Z'))).toBe('22 октября');
  });
});
