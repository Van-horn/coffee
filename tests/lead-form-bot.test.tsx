// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The component reads the variable as a module constant, so it must be set before the import.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME = 'kvarta_bot';
});

import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import theme from '@/theme/theme';
import LeadForm from '@/components/LeadForm';

const response = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

beforeEach(() => {
  window.sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function submit(fetchMock: ReturnType<typeof vi.fn>) {
  vi.stubGlobal('fetch', fetchMock);
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
}

describe('LeadForm Telegram bot box', () => {
  it('links to the bot with the idempotency key as the start payload', async () => {
    const fetchMock = vi.fn().mockImplementation((_url: string, init: { body: string }) =>
      Promise.resolve(response({ ok: true, leadId: JSON.parse(init.body).idempotencyKey })),
    );
    await submit(fetchMock);
    const key = JSON.parse(fetchMock.mock.calls[0][1].body).idempotencyKey as string;
    const link = screen.getByRole('link', { name: /Открыть бота в Telegram/ });
    expect(link).toHaveAttribute('href', `https://t.me/kvarta_bot?start=${key}`);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveTextContent('(откроется в новой вкладке)');
    expect(screen.getByText('Подтверждение в Telegram')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Нажмите Start у бота @kvarta_bot: он пришлёт одно сообщение с деталями заявки. Бот не читает переписку и ничего больше не отправит.',
      ),
    ).toBeInTheDocument();
  });

  it('hides the box for a duplicate answer naming a foreign lead id, and never links to it', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() => Promise.resolve(response({ ok: true, leadId: 'existing-lead-01', duplicate: true })));
    await submit(fetchMock);
    expect(screen.queryByRole('link', { name: /Открыть бота/ })).toBeNull();
    expect(screen.queryByText('Подтверждение в Telegram')).toBeNull();
    expect(document.body.innerHTML).not.toContain('existing-lead-01');
  });

  it('hides the box for a duplicate answer even when its id equals our key (conservative)', async () => {
    const fetchMock = vi.fn().mockImplementation((_url: string, init: { body: string }) =>
      Promise.resolve(response({ ok: true, leadId: JSON.parse(init.body).idempotencyKey, duplicate: true })),
    );
    await submit(fetchMock);
    expect(screen.queryByRole('link', { name: /Открыть бота/ })).toBeNull();
  });

  it('hides the box when a non-duplicate answer names an id other than our key', async () => {
    await submit(vi.fn().mockImplementation(() => Promise.resolve(response({ ok: true, leadId: 'other-lead-0002' }))));
    expect(screen.queryByRole('link', { name: /Открыть бота/ })).toBeNull();
  });

  it('keeps the optional nick hint', async () => {
    render(
      <ThemeProvider theme={theme}>
        <LeadForm />
      </ThemeProvider>,
    );
    expect(screen.getByText('По желанию: менеджер увидит ник в заявке')).toBeInTheDocument();
  });
});
