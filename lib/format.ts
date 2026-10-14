import { MINSK_UTC_OFFSET_HOURS } from '@/lib/schedule';

const WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'] as const;

const MONTHS_GENITIVE = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
] as const;

// A Date whose UTC fields read as Minsk wall-clock time (fixed UTC+3, never local getters).
function toMinsk(d: Date): Date {
  return new Date(d.getTime() + MINSK_UTC_OFFSET_HOURS * 3_600_000);
}

// "15 октября": day and genitive month on the Minsk calendar.
export function formatRuDayMonth(d: Date): string {
  const m = toMinsk(d);
  return `${m.getUTCDate()} ${MONTHS_GENITIVE[m.getUTCMonth()]}`;
}

// "четверг, 15 октября": weekday plus day and month on the Minsk calendar.
export function formatRuDate(d: Date): string {
  return `${WEEKDAYS[toMinsk(d).getUTCDay()]}, ${formatRuDayMonth(d)}`;
}
