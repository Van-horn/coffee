import { describe, expect, it } from 'vitest';
import {
  hoursLabel,
  isOpenNow,
  nextDelivery,
  nextRoast,
  orderCutoff,
} from '@/lib/schedule';

// Minsk is UTC+3 with no DST. Helper builds an instant from Minsk wall-clock time.
const minsk = (y: number, mo: number, d: number, h = 0, mi = 0, s = 0): Date =>
  new Date(Date.UTC(y, mo - 1, d, h - 3, mi, s));

// Reference week (2026): Mon 12 Oct ... Wed 14 Oct, Thu 15 Oct, Fri 16 Oct, Sat 17, Sun 18.

describe('nextRoast', () => {
  it('Thursday 08:59 Minsk gives that day roast', () => {
    expect(nextRoast(minsk(2026, 10, 15, 8, 59)).toISOString()).toBe(
      minsk(2026, 10, 15, 9, 0).toISOString(),
    );
  });
  it('Thursday 09:00:00 exactly gives next week', () => {
    expect(nextRoast(minsk(2026, 10, 15, 9, 0)).toISOString()).toBe(
      minsk(2026, 10, 22, 9, 0).toISOString(),
    );
  });
  it('Friday gives next Thursday', () => {
    expect(nextRoast(minsk(2026, 10, 16, 10, 0)).toISOString()).toBe(
      minsk(2026, 10, 22, 9, 0).toISOString(),
    );
  });
  it('uses the Minsk date when UTC date differs (Wed 22:30 UTC = Thu 01:30 Minsk)', () => {
    const now = new Date(Date.UTC(2026, 9, 14, 22, 30));
    expect(nextRoast(now).toISOString()).toBe(minsk(2026, 10, 15, 9, 0).toISOString());
  });
  it('does not mutate input', () => {
    const now = minsk(2026, 10, 15, 8, 0);
    const t = now.getTime();
    nextRoast(now);
    expect(now.getTime()).toBe(t);
  });
});

describe('nextDelivery', () => {
  it('Friday 11:59 Minsk gives that day', () => {
    expect(nextDelivery(minsk(2026, 10, 16, 11, 59)).toISOString()).toBe(
      minsk(2026, 10, 16, 12, 0).toISOString(),
    );
  });
  it('Friday 12:00:00 exactly gives next Friday', () => {
    expect(nextDelivery(minsk(2026, 10, 16, 12, 0)).toISOString()).toBe(
      minsk(2026, 10, 23, 12, 0).toISOString(),
    );
  });
  it('Friday after 12:00 gives next Friday', () => {
    expect(nextDelivery(minsk(2026, 10, 16, 15, 0)).toISOString()).toBe(
      minsk(2026, 10, 23, 12, 0).toISOString(),
    );
  });
  it('Saturday gives next Friday', () => {
    expect(nextDelivery(minsk(2026, 10, 17, 9, 0)).toISOString()).toBe(
      minsk(2026, 10, 23, 12, 0).toISOString(),
    );
  });
  it('Wed 22:30 UTC (Thu Minsk) gives that Friday', () => {
    const now = new Date(Date.UTC(2026, 9, 14, 22, 30));
    expect(nextDelivery(now).toISOString()).toBe(minsk(2026, 10, 16, 12, 0).toISOString());
  });
});

describe('orderCutoff', () => {
  it('is Wednesday 20:00 Minsk before the next delivery', () => {
    expect(orderCutoff(minsk(2026, 10, 13, 10, 0)).toISOString()).toBe(
      minsk(2026, 10, 14, 20, 0).toISOString(),
    );
  });
  it('Wednesday 19:59 is before the cutoff', () => {
    const now = minsk(2026, 10, 14, 19, 59);
    expect(now.getTime()).toBeLessThan(orderCutoff(now).getTime());
  });
  it('Wednesday 20:00:00 exactly is not before the cutoff', () => {
    const now = minsk(2026, 10, 14, 20, 0);
    expect(now.getTime()).not.toBeLessThan(orderCutoff(now).getTime());
  });
  it('at Wednesday 20:00 the cutoff is that same instant (derived from this week delivery)', () => {
    expect(orderCutoff(minsk(2026, 10, 14, 20, 0)).toISOString()).toBe(
      minsk(2026, 10, 14, 20, 0).toISOString(),
    );
  });
  it('Friday after delivery gives next week Wednesday', () => {
    expect(orderCutoff(minsk(2026, 10, 16, 13, 0)).toISOString()).toBe(
      minsk(2026, 10, 21, 20, 0).toISOString(),
    );
  });
});

describe('isOpenNow', () => {
  it('true Mon 08:00, false Mon 20:00', () => {
    expect(isOpenNow(minsk(2026, 10, 12, 8, 0))).toBe(true);
    expect(isOpenNow(minsk(2026, 10, 12, 19, 59))).toBe(true);
    expect(isOpenNow(minsk(2026, 10, 12, 20, 0))).toBe(false);
  });
  it('false Mon 07:59 (before open)', () => {
    expect(isOpenNow(minsk(2026, 10, 12, 7, 59))).toBe(false);
  });
  it('weekend: true Sat 10:00, false Sat 09:59, false Sun 18:00', () => {
    expect(isOpenNow(minsk(2026, 10, 17, 10, 0))).toBe(true);
    expect(isOpenNow(minsk(2026, 10, 17, 9, 59))).toBe(false);
    expect(isOpenNow(minsk(2026, 10, 18, 17, 59))).toBe(true);
    expect(isOpenNow(minsk(2026, 10, 18, 18, 0))).toBe(false);
  });
  it('Sunday night is closed', () => {
    expect(isOpenNow(minsk(2026, 10, 18, 23, 30))).toBe(false);
  });
  it('uses Minsk date: Sun 21:30 UTC is Mon 00:30 Minsk (closed); Mon 05:00 UTC = 08:00 Minsk (open)', () => {
    expect(isOpenNow(new Date(Date.UTC(2026, 9, 18, 21, 30)))).toBe(false);
    expect(isOpenNow(new Date(Date.UTC(2026, 9, 12, 5, 0)))).toBe(true);
  });
});

describe('hoursLabel', () => {
  it('weekday open: до 20:00', () => {
    expect(hoursLabel(minsk(2026, 10, 14, 12, 0))).toBe('до 20:00');
  });
  it('weekend open: до 18:00', () => {
    expect(hoursLabel(minsk(2026, 10, 17, 12, 0))).toBe('до 18:00');
  });
  it('Monday before open: откроемся в 08:00', () => {
    expect(hoursLabel(minsk(2026, 10, 12, 7, 0))).toBe('откроемся в 08:00');
  });
  it('Sunday night: откроемся в 08:00 (Monday)', () => {
    expect(hoursLabel(minsk(2026, 10, 18, 23, 0))).toBe('откроемся в 08:00');
  });
  it('weekday evening after close: откроемся в 08:00 (next day), Friday evening: 10:00 Saturday', () => {
    expect(hoursLabel(minsk(2026, 10, 14, 21, 0))).toBe('откроемся в 08:00');
    expect(hoursLabel(minsk(2026, 10, 16, 21, 0))).toBe('откроемся в 10:00');
  });
  it('Saturday before open: откроемся в 10:00; Saturday evening: 10:00 Sunday', () => {
    expect(hoursLabel(minsk(2026, 10, 17, 9, 0))).toBe('откроемся в 10:00');
    expect(hoursLabel(minsk(2026, 10, 17, 19, 0))).toBe('откроемся в 10:00');
  });
  it('closing minute is closed', () => {
    expect(hoursLabel(minsk(2026, 10, 14, 20, 0))).toBe('откроемся в 08:00');
  });
});
