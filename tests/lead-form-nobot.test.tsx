// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME = '';
});

import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import theme from '@/theme/theme';
import LeadForm from '@/components/LeadForm';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('LeadForm without a bot username', () => {
  it('hides the whole Telegram box on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, leadId: 'L1' }), { status: 200 })),
    );
    const user = userEvent.setup();
    render(
      <ThemeProvider theme={theme}>
        <LeadForm />
      </ThemeProvider>,
    );
    await user.type(screen.getByLabelText('Имя'), 'Анна');
    await user.type(screen.getByLabelText('Телефон'), '80291234567');
    await user.click(screen.getByRole('button', { name: 'Отправить заявку' }));
    await screen.findByText('Заявка принята');
    expect(screen.queryByText('Подтверждение в Telegram')).toBeNull();
    expect(screen.queryByRole('link', { name: /Открыть бота/ })).toBeNull();
  });
});
