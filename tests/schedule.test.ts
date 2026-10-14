import { describe, expect, it } from 'vitest';
import {
  hoursLabel,
  isOpenNow,
  isOrderOpen,
  minskDayGroup,
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

describe('orderCutoff / isOrderOpen (anchored to nextRoast)', () => {
  const iso = (d: Date) => d.toISOString();
  const wed = minsk(2026, 10, 14, 20, 0);
  it('Mon 10:00 -> Wed 20:00 of that week, open', () => {
    const now = minsk(2026, 10, 12, 10, 0);
    expect(iso(orderCutoff(now))).toBe(iso(wed));
    expect(isOrderOpen(now)).toBe(true);
  });
  it('Wed 19:59:59 -> same cutoff, open', () => {
    const now = minsk(2026, 10, 14, 19, 59, 59);
    expect(iso(orderCutoff(now))).toBe(iso(wed));
    expect(isOrderOpen(now)).toBe(true);
  });
  it('Wed 20:00:00 -> cutoff equals now, closed', () => {
    expect(iso(orderCutoff(wed))).toBe(iso(wed));
    expect(isOrderOpen(wed)).toBe(false);
  });
  it('Wed 20:01 through Thu 08:59:59 -> past cutoff for the imminent roast, closed', () => {
    for (const now of [minsk(2026, 10, 14, 20, 1), minsk(2026, 10, 15, 0, 0), minsk(2026, 10, 15, 8, 59, 59)]) {
      expect(iso(orderCutoff(now))).toBe(iso(wed));
      expect(orderCutoff(now).getTime()).toBeLessThan(now.getTime());
      expect(isOrderOpen(now)).toBe(false);
    }
  });
  it('Thu 09:00:00, Thu 10:00, Fri 11:59 -> next Wednesday 20:00, open', () => {
    const next = minsk(2026, 10, 21, 20, 0);
    for (const now of [minsk(2026, 10, 15, 9, 0), minsk(2026, 10, 15, 10, 0), minsk(2026, 10, 16, 11, 59)]) {
      expect(iso(nextRoast(now))).toBe(iso(minsk(2026, 10, 22, 9, 0)));
      expect(iso(orderCutoff(now))).toBe(iso(next));
      expect(isOrderOpen(now)).toBe(true);
    }
  });
  it('Sun 23:59 -> Wednesday of the new week, open', () => {
    const now = minsk(2026, 10, 18, 23, 59);
    expect(iso(orderCutoff(now))).toBe(iso(minsk(2026, 10, 21, 20, 0)));
    expect(isOrderOpen(now)).toBe(true);
  });
  it('year end: Wed 30 Dec 2026 19:59 open, 20:00 closed, cutoff for Thu 31 Dec', () => {
    const cut = minsk(2026, 12, 30, 20, 0);
    expect(iso(orderCutoff(minsk(2026, 12, 30, 19, 59)))).toBe(iso(cut));
    expect(isOrderOpen(minsk(2026, 12, 30, 19, 59))).toBe(true);
    expect(iso(orderCutoff(cut))).toBe(iso(cut));
    expect(isOrderOpen(cut)).toBe(false);
  });
  it('Thu 31 Dec 10:00 -> cutoff Wed 6 Jan 2027 20:00', () => {
    expect(iso(orderCutoff(minsk(2026, 12, 31, 10, 0)))).toBe(iso(minsk(2027, 1, 6, 20, 0)));
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

describe('seconds and sharp boundaries', () => {
  it('nextRoast Thu 08:59:59 is that day; 09:00:01 is next week', () => {
    expect(nextRoast(minsk(2026, 10, 15, 8, 59, 59)).toISOString()).toBe(minsk(2026, 10, 15, 9, 0).toISOString());
    expect(nextRoast(minsk(2026, 10, 15, 9, 0, 1)).toISOString()).toBe(minsk(2026, 10, 22, 9, 0).toISOString());
  });
  it('hoursLabel Fri 20:00 sharp -> opens 10:00 Saturday; Sun 18:00 sharp -> opens 08:00 Monday', () => {
    expect(hoursLabel(minsk(2026, 10, 16, 20, 0))).toBe('откроемся в 10:00');
    expect(hoursLabel(minsk(2026, 10, 18, 18, 0))).toBe('откроемся в 08:00');
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

describe('minskDayGroup', () => {
  it('Fri 23:30 UTC is Saturday 02:30 in Minsk: weekend', () => {
    expect(minskDayGroup(new Date(Date.UTC(2026, 9, 16, 23, 30)))).toBe('weekend');
  });
  it('Sun 21:30 UTC is Monday 00:30 in Minsk: weekdays', () => {
    expect(minskDayGroup(new Date(Date.UTC(2026, 9, 18, 21, 30)))).toBe('weekdays');
  });
  it('midweek is weekdays, Sunday noon is weekend', () => {
    expect(minskDayGroup(minsk(2026, 10, 14, 12, 0))).toBe('weekdays');
    expect(minskDayGroup(minsk(2026, 10, 18, 12, 0))).toBe('weekend');
  });
});
