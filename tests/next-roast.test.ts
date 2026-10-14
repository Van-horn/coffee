import { describe, expect, it } from 'vitest';
import { nextRoastText } from '@/components/NextRoast';

describe('nextRoastText', () => {
  it('is open on Monday 12 Oct', () => {
    expect(nextRoastText(new Date('2026-10-12T09:00:00Z'))).toBe('четверг, 15 октября · заявки до среды, 20:00');
  });

  it('is closed on Wednesday evening and names the following roast', () => {
    expect(nextRoastText(new Date('2026-10-14T17:30:00Z'))).toBe(
      'четверг, 15 октября, заявки закрыты · следующая 22 октября',
    );
  });

  it('switches exactly at the cutoff (Wed 20:00 Minsk = 17:00Z)', () => {
    expect(nextRoastText(new Date('2026-10-14T16:59:59Z'))).toContain('заявки до среды, 20:00');
    expect(nextRoastText(new Date('2026-10-14T17:00:00Z'))).toContain('заявки закрыты');
  });

  it('is open again for the next week after the roast starts (Thu 10:00 Minsk)', () => {
    expect(nextRoastText(new Date('2026-10-15T07:00:00Z'))).toBe('четверг, 22 октября · заявки до среды, 20:00');
  });
});
