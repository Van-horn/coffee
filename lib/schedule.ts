// Business assumptions (cited in the README). All times are Europe/Minsk wall-clock.
// Minsk is UTC+3 all year with no DST, so a fixed offset is used for all arithmetic.
export const MINSK_UTC_OFFSET_HOURS = 3;

// Day numbers follow Date#getUTCDay: 0 = Sunday ... 6 = Saturday.
export const ROAST_DAY = 4; // Thursday
export const ROAST_HOUR = 9; // 09:00
export const DELIVERY_DAY = 5; // Friday
export const DELIVERY_HOUR = 12; // 12:00
export const CUTOFF_DAY = 3; // Wednesday before that delivery
export const CUTOFF_HOUR = 20; // 20:00

export const WEEKDAY_OPEN_HOUR = 8;
export const WEEKDAY_CLOSE_HOUR = 20;
export const WEEKEND_OPEN_HOUR = 10;
export const WEEKEND_CLOSE_HOUR = 18;

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const OFFSET_MS = MINSK_UTC_OFFSET_HOURS * HOUR_MS;

// A Date whose UTC fields read as Minsk wall-clock time.
function toMinsk(d: Date): Date {
  return new Date(d.getTime() + OFFSET_MS);
}

// Minsk midnight (as a real instant) of the Minsk day containing `d`.
function minskMidnight(d: Date): number {
  const m = toMinsk(d).getTime();
  return m - (((m % DAY_MS) + DAY_MS) % DAY_MS) - OFFSET_MS;
}

// First instant strictly after `now` that is `weekday` at `hour`:00 Minsk.
function nextWeekly(now: Date, weekday: number, hour: number): Date {
  const today = minskMidnight(now);
  const todayDow = toMinsk(now).getUTCDay();
  let daysAhead = (weekday - todayDow + 7) % 7;
  let target = today + daysAhead * DAY_MS + hour * HOUR_MS;
  if (target <= now.getTime()) {
    daysAhead += 7;
    target = today + daysAhead * DAY_MS + hour * HOUR_MS;
  }
  return new Date(target);
}

export function nextRoast(now: Date): Date {
  return nextWeekly(now, ROAST_DAY, ROAST_HOUR);
}

export function nextDelivery(now: Date): Date {
  return nextWeekly(now, DELIVERY_DAY, DELIVERY_HOUR);
}

export function orderCutoff(now: Date): Date {
  const delivery = nextDelivery(now);
  const daysBack = DELIVERY_DAY - CUTOFF_DAY;
  const deliveryMidnight = minskMidnight(delivery);
  return new Date(deliveryMidnight - daysBack * DAY_MS + CUTOFF_HOUR * HOUR_MS);
}

function hoursFor(dow: number): { open: number; close: number } {
  return dow === 0 || dow === 6
    ? { open: WEEKEND_OPEN_HOUR, close: WEEKEND_CLOSE_HOUR }
    : { open: WEEKDAY_OPEN_HOUR, close: WEEKDAY_CLOSE_HOUR };
}

function minuteOfDay(m: Date): number {
  return m.getUTCHours() * 60 + m.getUTCMinutes();
}

export function isOpenNow(now: Date): boolean {
  const m = toMinsk(now);
  const { open, close } = hoursFor(m.getUTCDay());
  const t = minuteOfDay(m);
  return t >= open * 60 && t < close * 60;
}

const pad = (n: number): string => String(n).padStart(2, '0');

export function hoursLabel(now: Date): string {
  const m = toMinsk(now);
  const dow = m.getUTCDay();
  const { open, close } = hoursFor(dow);
  const t = minuteOfDay(m);
  if (t >= open * 60 && t < close * 60) return `до ${pad(close)}:00`;
  // Closed: next opening is later today if before opening, otherwise tomorrow.
  const nextOpen = t < open * 60 ? open : hoursFor((dow + 1) % 7).open;
  return `откроемся в ${pad(nextOpen)}:00`;
}
