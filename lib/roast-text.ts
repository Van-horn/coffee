import { formatRuDate, formatRuDayMonth } from '@/lib/format';
import { isOrderOpen, nextRoast } from '@/lib/schedule';

const WEEK_MS = 7 * 24 * 3_600_000;

/** Pure sentence about the next roast and the order cutoff; shared by the page and the bot message. */
export function nextRoastText(now: Date): string {
  const roast = nextRoast(now);
  if (isOrderOpen(now)) return `${formatRuDate(roast)} · заявки до среды, 20:00`;
  const following = new Date(roast.getTime() + WEEK_MS);
  return `${formatRuDate(roast)}, заявки закрыты · следующая ${formatRuDayMonth(following)}`;
}
