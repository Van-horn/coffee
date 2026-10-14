import { describe, expect, it } from 'vitest';
import { colors } from '@/theme/tokens';

describe('tokens', () => {
  it('uses the Pixso paper and ink hexes', () => {
    expect(colors.paper).toBe('#F3EBDD');
    expect(colors.ink).toBe('#231A14');
  });
});
