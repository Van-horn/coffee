// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ThemeProvider } from '@mui/material/styles';
import theme from '@/theme/theme';
import Footer from '@/components/Footer';
import { CONTACT } from '@/lib/contact';

afterEach(cleanup);

describe('Footer channel link', () => {
  it('links to the public Telegram channel safely', () => {
    render(
      <ThemeProvider theme={theme}>
        <Footer />
      </ThemeProvider>,
    );
    const link = screen.getByRole('link', { name: /Telegram-канал с заявками/ });
    expect(link).toHaveAttribute('href', 'https://t.me/+70XjCJljkqYwMGY6');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveTextContent('Telegram-канал с заявками (откроется в новой вкладке)');
    expect(screen.queryByText(/kvarta_roastery/)).toBeNull();
  });

  it('exposes the channel URL and no fictional Telegram contact', () => {
    expect(CONTACT.telegramChannelUrl).toBe('https://t.me/+70XjCJljkqYwMGY6');
    expect(CONTACT).not.toHaveProperty('telegramHandle');
    expect(CONTACT).not.toHaveProperty('telegramUrl');
  });

  it('has no reference to the removed CONTACT fields in the sources', () => {
    const dirs = ['app', 'components', 'lib'];
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(join(dir, e.name)) : /\.(tsx?|md)$/.test(e.name) ? [join(dir, e.name)] : [],
      );
    for (const file of dirs.flatMap(walk))
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/telegramHandle|telegramUrl|kvarta_roastery/);
  });
});
