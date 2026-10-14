import { formatPhoneMask } from '@/lib/phone';
import { nextRoastText } from '@/lib/roast-text';
import type { StoredLead } from '@/lib/store';
import { escapeHtml } from '@/lib/telegram';

const INTEREST_TEXT: Record<StoredLead['interest'], string> = {
  subscription: 'подписка (2 пачки по 250 г)',
  order: 'разовый заказ',
  question: 'вопрос',
};

/**
 * The single confirmation the bot sends after the customer presses Start (HTML parse mode).
 * Contains only the name, the interest and the phone: no comment, nick, e-mail or attribution.
 */
export function formatCustomerMessage(lead: StoredLead, now: Date): string {
  return [
    `Привет, ${escapeHtml(lead.name)}! Заявка принята: ${INTEREST_TEXT[lead.interest]}.`,
    `Менеджер позвонит на ${formatPhoneMask(lead.phone)} в рабочее время: пн–пт 08:00–20:00, сб–вс 10:00–18:00.`,
    `Ближайшая обжарка — ${nextRoastText(now)}.`,
    'Это единственное сообщение: бот больше ничего не пришлёт.',
  ].join('\n');
}
