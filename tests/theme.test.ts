import { describe, expect, it } from 'vitest';
import theme from '@/theme/theme';
import { colors } from '@/theme/tokens';

function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('theme contrast (WCAG 4.5:1)', () => {
  const primary = theme.palette.primary.main;

  it.each([
    ['paper', colors.paper],
    ['paper-2', colors.paper2],
    ['card', colors.card],
  ])('primary.main on %s', (_name, bg) => {
    expect(contrast(primary, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('primary.contrastText on primary.main', () => {
    expect(contrast(theme.palette.primary.contrastText, primary)).toBeGreaterThanOrEqual(4.5);
  });

  it('text.primary on paper', () => {
    expect(contrast(theme.palette.text.primary, colors.paper)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps roast available as a named token', () => {
    expect(theme.tokens.colors.roast).toBe('#C93B18');
  });
});
