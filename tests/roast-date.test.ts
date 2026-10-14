import { describe, expect, it } from 'vitest';
import { formatRoastDate } from '@/components/RoastDate';

describe('formatRoastDate', () => {
  it('formats as DD.MM in Minsk time', () => {
    expect(formatRoastDate(new Date('2026-10-15T06:00:00Z'))).toBe('15.10');
  });
  it('uses the Minsk calendar day across the UTC boundary', () => {
    // 22:30 UTC on 14 Oct is already 01:30 on 15 Oct in Minsk
    expect(formatRoastDate(new Date('2026-10-14T22:30:00Z'))).toBe('15.10');
  });
  it('zero-pads day and month', () => {
    expect(formatRoastDate(new Date('2027-01-07T06:00:00Z'))).toBe('07.01');
  });
});
