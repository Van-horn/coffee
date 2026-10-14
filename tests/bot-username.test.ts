import { describe, expect, it } from 'vitest';
import { parseBotUsername } from '@/lib/bot-username';

describe('parseBotUsername', () => {
  it.each([['kvarta_bot'], ['KvartaBot'], ['@kvarta_bot'], [' kvarta_bot '], ['a_bot'.padStart(32, 'x')]])('accepts %s', (v) => {
    expect(parseBotUsername(v)).toBe(v.trim().replace(/^@/, ''));
  });

  it.each([
    [''],
    [undefined],
    ['kvarta'],
    ['kvarta_roastery'],
    ['bot'],
    ['abot'],
    ['kvarta-bot'],
    ['kvarta bot'],
    ['kvarta_bot/../x'],
    ['x'.repeat(30) + 'bot'],
  ])('hides %s', (v) => {
    expect(parseBotUsername(v)).toBe('');
  });
});
