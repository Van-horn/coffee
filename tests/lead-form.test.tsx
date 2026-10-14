// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import theme from '@/theme/theme';
import LeadForm from '@/components/LeadForm';

function renderForm() {
  return render(
    <ThemeProvider theme={theme}>
      <LeadForm />
    </ThemeProvider>,
  );
}

const okResponse = (body: unknown = { ok: true, leadId: 'L1' }, status = 200) =>
  new Response(JSON.stringify(body), { status });

function fillValid(user: ReturnType<typeof userEvent.setup>) {
  return (async () => {
    await user.type(screen.getByLabelText('Имя'), 'Анна');
    await user.type(screen.getByLabelText('Телефон'), '80291234567');
  })();
}

beforeEach(() => {
  window.sessionStorage.clear();
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('LeadForm', () => {
  it('sends only once on a double click in the same tick', async () => {
    const fetchMock = vi.fn().mockReturnValue(new Promise(() => {}));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    renderForm();
    await fillValid(user);
    const button = screen.getByRole('button', { name: 'Отправить заявку' });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('shows the phone error, aria-invalid and the summary, without fetching', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByLabelText('Имя'), 'Анна');
    await user.type(screen.getByLabelText('Телефон'), '+375 29 12');
    await user.click(screen.getByRole('button', { name: 'Отправить заявку' }));
    const phone = screen.getByLabelText('Телефон');
    expect(phone).toHaveAttribute('aria-invalid', 'true');
    expect(
      screen.getAllByText('Проверьте номер: нужен белорусский, например +375 29 123-45-67').length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole('alert')).toHaveTextContent('Исправьте 1 поле');
    expect(phone.getAttribute('aria-describedby')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the exact body and shows success', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    renderForm();
    await fillValid(user);
    await user.type(screen.getByLabelText(/Ник в Telegram/), '@anna_minsk');
    await user.click(screen.getByRole('button', { name: 'Отправить заявку' }));
    await screen.findByText('Заявка принята');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/lead');
    const body = JSON.parse(init.body);
    expect(Object.keys(body).sort()).toEqual(
      [
        'attribution',
        'comment',
        'idempotencyKey',
        'interest',
        'name',
        'phone',
        'renderedAt',
        'telegram',
        'website',
      ].sort(),
    );
    expect(body.website).toBe('');
    expect(body.name).toBe('Анна');
    expect(body.phone).toBe('+375291234567');
    expect(body.telegram).toBe('anna_minsk');
    expect(body.interest).toBe('subscription');
    expect(typeof body.idempotencyKey).toBe('string');
    expect(body.idempotencyKey.length).toBeGreaterThanOrEqual(8);
    expect(body.idempotencyKey.length).toBeLessThanOrEqual(64);
    expect(body.attribution.submittedAt).toMatch(/^\d+$/);
    expect(typeof body.renderedAt).toBe('number');
    expect(screen.getByText(/Менеджер позвонит на \+375 29 123-45-67/)).toBeInTheDocument();
    expect(screen.getByText(/@anna_minsk/)).toBeTruthy();
  });

  it('shows the failure view on 503, keeps values and retries with the same key', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(okResponse({ ok: false, message: 'Сервис временно недоступен' }, 503))
      .mockResolvedValueOnce(okResponse());
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    renderForm();
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: 'Отправить заявку' }));
    const retry = await screen.findByRole('button', { name: 'Повторить отправку' });
    expect(screen.getByLabelText('Имя')).toHaveValue('Анна');
    expect(screen.getByLabelText('Телефон')).toHaveValue('+375 29 123-45-67');
    expect(screen.getByText('Сервис временно недоступен')).toBeTruthy();
    await user.click(retry);
    await screen.findByText('Заявка принята');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const first = JSON.parse(fetchMock.mock.calls[0][1].body);
    const second = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(second.idempotencyKey).toBe(first.idempotencyKey);
  });

  it('pre-selects the interest from ?interest=order', async () => {
    window.history.replaceState(null, '', '/?interest=order');
    renderForm();
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Разовый заказ' })).toBeChecked());
  });

  it('keeps the default interest for an unknown ?interest value', async () => {
    window.history.replaceState(null, '', '/?interest=bogus');
    renderForm();
    expect(screen.getByRole('radio', { name: 'Подписка' })).toBeChecked();
  });

  it('masks the phone while typing char by char', async () => {
    const user = userEvent.setup();
    renderForm();
    const phone = screen.getByLabelText('Телефон');
    await user.type(phone, '80291234567');
    expect(phone).toHaveValue('+375 29 123-45-67');
  });

  it('treats a duplicate response as success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse({ ok: true, leadId: 'L1', duplicate: true })));
    const user = userEvent.setup();
    renderForm();
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: 'Отправить заявку' }));
    expect(await screen.findByText('Заявка принята')).toBeTruthy();
  });
});
