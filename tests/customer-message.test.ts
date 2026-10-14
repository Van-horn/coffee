import { describe, expect, it } from 'vitest';
import { formatCustomerMessage } from '@/lib/customer-message';
import type { StoredLead } from '@/lib/store';

const OPEN = new Date('2026-10-12T09:00:00Z');
const CLOSED = new Date('2026-10-14T17:30:00Z');

const lead = (over: Partial<StoredLead> = {}): StoredLead => ({
  leadId: 'lead-12345678',
  name: 'Анна',
  phone: '+375291234567',
  telegram: 'anna_minsk',
  interest: 'subscription',
  comment: 'секретный комментарий',
  attribution: { utm_source: 'yandex' },
  createdAt: '2026-10-12T09:00:00.000Z',
  ...over,
});

describe('formatCustomerMessage', () => {
  it('has the exact text for a subscription while orders are open', () => {
    expect(formatCustomerMessage(lead(), OPEN)).toBe(
      [
        'Привет, Анна! Заявка принята: подписка (2 пачки по 250 г).',
        'Менеджер позвонит на +375 29 ***-**-67 в рабочее время: пн–пт 08:00–20:00, сб–вс 10:00–18:00.',
        'Ближайшая обжарка — четверг, 15 октября · заявки до среды, 20:00.',
        'Это единственное сообщение: бот больше ничего не пришлёт.',
      ].join('\n'),
    );
  });

  it('names the other interests', () => {
    expect(formatCustomerMessage(lead({ interest: 'order' }), OPEN)).toContain('Заявка принята: разовый заказ.');
    expect(formatCustomerMessage(lead({ interest: 'question' }), OPEN)).toContain('Заявка принята: вопрос.');
  });

  it('uses the closed wording after the cutoff', () => {
    expect(formatCustomerMessage(lead(), CLOSED)).toContain(
      'Ближайшая обжарка — четверг, 15 октября, заявки закрыты · следующая 22 октября.',
    );
  });

  it('masks all but the operator code and the last two digits of the phone', () => {
    const text = formatCustomerMessage(lead({ phone: '+375441112233' }), OPEN);
    expect(text).toContain('+375 44 ***-**-33');
    expect(text).not.toMatch(/111|122|1112233/);
  });

  it('escapes the name', () => {
    const text = formatCustomerMessage(lead({ name: '<b>x</b>&' }), OPEN);
    expect(text).toContain('Привет, &lt;b&gt;x&lt;/b&gt;&amp;!');
    expect(text).not.toContain('<b>');
  });

  it('never includes the comment, nick, email or attribution', () => {
    const text = formatCustomerMessage(lead(), OPEN);
    expect(text).not.toMatch(/секретный|anna_minsk|yandex|@/);
  });

  it('stays short for the longest name', () => {
    const text = formatCustomerMessage(lead({ name: '&'.repeat(60) }), CLOSED);
    expect(text.length).toBeLessThan(1000);
  });
});
