import { nextRoastText } from '@/lib/roast-text';
import type { StoredLead } from '@/lib/store';
import { escapeHtml } from '@/lib/telegram';

const INTEREST_TEXT: Record<StoredLead['interest'], string> = {
  subscription: 'подписка (2 пачки по 250 г)',
  order: 'разовый заказ',
  question: 'вопрос',
};

/** "+375 29 ***-**-67": operator code and the last two digits only, so a leaked id discloses less. */
function maskPhone(e164: string): string {
  const digits = e164.replace(/\D/g, '');
  const national = digits.startsWith('375') ? digits.slice(3) : digits;
  if (national.length !== 9) return '***';
  return `+375 ${national.slice(0, 2)} ***-**-${national.slice(-2)}`;
}

/**
 * The single confirmation the bot sends after the customer presses Start (HTML parse mode).
 * Contains only the name, the interest and the phone: no comment, nick, e-mail or attribution.
 */
export function formatCustomerMessage(lead: StoredLead, now: Date): string {
  return [
    `Привет, ${escapeHtml(lead.name)}! Заявка принята: ${INTEREST_TEXT[lead.interest]}.`,
    `Менеджер позвонит на ${maskPhone(lead.phone)} в рабочее время: пн–пт 08:00–20:00, сб–вс 10:00–18:00.`,
    `Ближайшая обжарка — ${nextRoastText(now)}.`,
    'Это единственное сообщение: бот больше ничего не пришлёт.',
  ].join('\n');
}
