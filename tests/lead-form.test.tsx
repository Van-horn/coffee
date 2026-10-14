// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { ThemeProvider } from '@mui/material/styles';
import theme from '@/theme/theme';
import LeadForm from '@/components/LeadForm';

function tree() {
  return (
    <ThemeProvider theme={theme}>
      <LeadForm />
    </ThemeProvider>
  );
}

function renderForm() {
  return render(tree());
}

const PHONE_MSG = 'Проверьте номер: нужен белорусский, например +375 29 123-45-67';

const response = (body: unknown = { ok: true, leadId: 'L1' }, status = 200) =>
  new Response(JSON.stringify(body), { status });

type User = ReturnType<typeof userEvent.setup>;

async function fillValid(user: User) {
  await user.type(screen.getByLabelText('Имя'), 'Анна');
  await user.type(screen.getByLabelText('Телефон'), '80291234567');
}

const submitButton = () => screen.getByRole('button', { name: 'Отправить заявку' });
const bodyOf = (fetchMock: ReturnType<typeof vi.fn>, call: number) => JSON.parse(fetchMock.mock.calls[call][1].body);

beforeEach(() => {
  window.sessionStorage.clear();
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(performance, 'timeOrigin');
});

describe('LeadForm submit guard', () => {
  it('sends once when the form is submitted twice in the same tick (ref guard)', async () => {
    const fetchMock = vi.fn().mockReturnValue(new Promise(() => {}));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    const { container } = renderForm();
    await fillValid(user);
    const form = container.querySelector('form') as HTMLFormElement;
    fireEvent.submit(form);
    fireEvent.submit(form);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('sends once on a double click of the button', async () => {
    const fetchMock = vi.fn().mockReturnValue(new Promise(() => {}));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    renderForm();
    await fillValid(user);
    fireEvent.click(submitButton());
    fireEvent.click(screen.getByRole('button', { name: 'Отправляем…' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('LeadForm hydration safety', () => {
  it('server render has method=post and a disabled submit button; mount enables it', () => {
    const html = renderToString(tree());
    expect(html).toContain('method="post"');
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled/);
    renderForm();
    expect(submitButton()).toBeEnabled();
    expect(document.querySelector('form')).toHaveAttribute('method', 'post');
  });
});

describe('LeadForm validation', () => {
  it('shows the phone error tied by aria-describedby, aria-invalid and the summary, without fetching', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByLabelText('Имя'), 'Анна');
    await user.type(screen.getByLabelText('Телефон'), '+375 29 12');
    await user.click(submitButton());
    const phone = screen.getByLabelText('Телефон');
    expect(phone).toHaveAttribute('aria-invalid', 'true');
    const described = (phone.getAttribute('aria-describedby') ?? '').split(' ');
    expect(described).toContain('lead-phone-error');
    expect(document.getElementById('lead-phone-error')).toHaveTextContent(PHONE_MSG);
    expect(screen.getByText(PHONE_MSG)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Исправьте 1 поле');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('moves focus to the first invalid field and counts fields with the right plural', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const user = userEvent.setup();
    renderForm();
    await user.click(submitButton());
    expect(screen.getByLabelText('Имя')).toHaveFocus();
    expect(screen.getByRole('alert')).toHaveTextContent('Исправьте 2 поля');
    await user.type(screen.getByLabelText('Имя'), 'Анна');
    await user.type(screen.getByLabelText('Телефон'), '80291234567');
    fireEvent.change(screen.getByLabelText('Комментарий'), { target: { value: 'x'.repeat(501) } });
    await user.click(submitButton());
    expect(screen.getByLabelText('Комментарий')).toHaveFocus();
    expect(screen.getByRole('alert')).toHaveTextContent('Исправьте 1 поле');
    await user.clear(screen.getByLabelText('Имя'));
    await user.clear(screen.getByLabelText('Телефон'));
    await user.click(submitButton());
    expect(screen.getByRole('alert')).toHaveTextContent('Исправьте 3 поля');
  });

  it('masks the phone while typing char by char', async () => {
    const user = userEvent.setup();
    renderForm();
    const phone = screen.getByLabelText('Телефон');
    await user.type(phone, '80291234567');
    expect(phone).toHaveValue('+375 29 123-45-67');
  });
});

describe('LeadForm without a Telegram username', () => {
  it('has no Telegram input, hint or label', () => {
    const { container } = renderForm();
    expect(container.querySelector('[name="telegram"]')).toBeNull();
    expect(screen.queryByLabelText(/Telegram/)).toBeNull();
    expect(container.textContent).not.toMatch(/Ник|@username/);
  });

  it('shows the channel-flow consent line with the privacy link', () => {
    renderForm();
    expect(
      screen.getByText(
        /Нажимая кнопку, вы соглашаетесь на обработку имени и телефона для связи по заявке\. Телефон и имя получает только менеджер Кварты\./,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Политика обработки данных' })).toHaveAttribute('href', '/privacy');
  });

  it('never renders a foreign lead id from a duplicate answer', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ ok: true, leadId: 'existing-lead-01', duplicate: true })));
    const user = userEvent.setup();
    renderForm();
    await fillValid(user);
    await user.click(submitButton());
    await screen.findByText('Заявка принята');
    expect(document.body.innerHTML).not.toContain('existing-lead-01');
  });
});

describe('LeadForm sending', () => {
  it('sends the exact body and shows success', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(response()));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    renderForm();
    await fillValid(user);
    await user.click(submitButton());
    await screen.findByText('Заявка принята');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/lead');
    const body = bodyOf(fetchMock, 0);
    expect(Object.keys(body).sort()).toEqual(
      ['attribution', 'comment', 'idempotencyKey', 'interest', 'name', 'phone', 'renderedAt', 'website'].sort(),
    );
    expect(body.website).toBe('');
    expect(body.name).toBe('Анна');
    expect(body.phone).toBe('+375291234567');
    expect(body.interest).toBe('subscription');
    expect(body.idempotencyKey.length).toBeGreaterThanOrEqual(8);
    expect(body.idempotencyKey.length).toBeLessThanOrEqual(64);
    expect(body.attribution.submittedAt).toMatch(/^\d+$/);
    expect(typeof body.renderedAt).toBe('number');
    expect(screen.getByText(/Менеджер позвонит на \+375 29 123-45-67/)).toBeInTheDocument();
    expect(screen.getByText('Отправить ещё одну заявку')).toBeInTheDocument();
    expect(screen.getByText('Пн–Пт 08:00–20:00, Сб–Вс 10:00–18:00')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Telegram|бот/i);
    expect(screen.queryByRole('link', { name: /бота/ })).toBeNull();
  });

  it('takes the honeypot value from the neutral-named input into the website key', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(response()));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    const { container } = renderForm();
    expect(container.querySelector('[name="website"]')).toBeNull();
    const trap = container.querySelector('[name="hp_field_x7"]') as HTMLInputElement;
    expect(trap).toHaveAttribute('tabindex', '-1');
    expect(trap).toHaveAttribute('autocomplete', 'off');
    fireEvent.change(trap, { target: { value: 'spam' } });
    await fillValid(user);
    await user.click(submitButton());
    await screen.findByText('Заявка принята');
    expect(bodyOf(fetchMock, 0).website).toBe('spam');
  });

  it('uses the navigation start as renderedAt, with a fallback to the mount time', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(response()));
    vi.stubGlobal('fetch', fetchMock);
    Object.defineProperty(performance, 'timeOrigin', { value: 1_700_000_000_000.4, configurable: true });
    const user = userEvent.setup();
    renderForm();
    await fillValid(user);
    await user.click(submitButton());
    await screen.findByText('Заявка принята');
    expect(bodyOf(fetchMock, 0).renderedAt).toBe(1_700_000_000_000);

    cleanup();
    Object.defineProperty(performance, 'timeOrigin', { value: Number.NaN, configurable: true });
    const before = Date.now();
    renderForm();
    await fillValid(userEvent.setup());
    fireEvent.click(submitButton());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const fallback = bodyOf(fetchMock, 1).renderedAt;
    expect(fallback).toBeGreaterThanOrEqual(before);
    expect(fallback).toBeLessThanOrEqual(Date.now());
  });

  it('shows the failure view on 503, keeps values and retries with the same key', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ ok: false, message: 'Сервис временно недоступен' }, 503))
      .mockResolvedValueOnce(response());
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    renderForm();
    await fillValid(user);
    await user.click(submitButton());
    const retry = await screen.findByRole('button', { name: 'Повторить отправку' });
    expect(screen.getByLabelText('Имя')).toHaveValue('Анна');
    expect(screen.getByLabelText('Телефон')).toHaveValue('+375 29 123-45-67');
    expect(screen.getByText('Сервис временно недоступен')).toBeInTheDocument();
    await user.click(retry);
    await screen.findByText('Заявка принята');
    expect(bodyOf(fetchMock, 1).idempotencyKey).toBe(bodyOf(fetchMock, 0).idempotencyKey);
  });

  it('uses a new key when the content was edited after a failed send', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ ok: false, message: 'Сервис временно недоступен' }, 503))
      .mockResolvedValueOnce(response());
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    renderForm();
    await fillValid(user);
    await user.click(submitButton());
    const retry = await screen.findByRole('button', { name: 'Повторить отправку' });
    await user.clear(screen.getByLabelText('Телефон'));
    await user.type(screen.getByLabelText('Телефон'), '80331112233');
    await user.click(retry);
    await screen.findByText('Заявка принята');
    const first = bodyOf(fetchMock, 0);
    const second = bodyOf(fetchMock, 1);
    expect(second.phone).toBe('+375331112233');
    expect(second.idempotencyKey).not.toBe(first.idempotencyKey);
  });

  it('keeps the key across a remount only while the content matches', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() => Promise.resolve(response({ ok: false, message: 'Сервис временно недоступен' }, 503)));
    vi.stubGlobal('fetch', fetchMock);
    let user = userEvent.setup();
    renderForm();
    await fillValid(user);
    await user.click(submitButton());
    await screen.findByRole('button', { name: 'Повторить отправку' });
    expect(window.sessionStorage.getItem('kvarta_idem')).toBeTruthy();
    cleanup();

    user = userEvent.setup();
    renderForm();
    await fillValid(user);
    await user.click(submitButton());
    await screen.findByRole('button', { name: 'Повторить отправку' });
    expect(bodyOf(fetchMock, 1).idempotencyKey).toBe(bodyOf(fetchMock, 0).idempotencyKey);
    cleanup();

    user = userEvent.setup();
    renderForm();
    await user.type(screen.getByLabelText('Имя'), 'Анна');
    await user.type(screen.getByLabelText('Телефон'), '80331112233');
    await user.click(submitButton());
    await screen.findByRole('button', { name: 'Повторить отправку' });
    expect(bodyOf(fetchMock, 2).idempotencyKey).not.toBe(bodyOf(fetchMock, 0).idempotencyKey);
  });

  it('does not append the call-us hint when the server message already has it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(response({ ok: false, message: 'Сервис недоступен. Позвоните нам.' }, 503)),
    );
    const user = userEvent.setup();
    renderForm();
    await fillValid(user);
    await user.click(submitButton());
    await screen.findByText('Сервис недоступен. Позвоните нам.');
    expect(screen.queryByText(/Или позвоните нам/)).toBeNull();
    expect(screen.getByText('Данные в форме сохранены.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Позвонить/ })).toHaveAttribute('href', 'tel:+375290000000');
  });

  it('treats a duplicate response as success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ ok: true, leadId: 'L1', duplicate: true })));
    const user = userEvent.setup();
    renderForm();
    await fillValid(user);
    await user.click(submitButton());
    expect(await screen.findByText('Заявка принята')).toBeInTheDocument();
  });

  it('resets after success: storage cleared, name refocused, a fresh key next time', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(response()));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    renderForm();
    await fillValid(user);
    await user.click(submitButton());
    await screen.findByText('Заявка принята');
    expect(screen.getByText('Заявка принята')).toHaveFocus();
    expect(window.sessionStorage.getItem('kvarta_idem')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Отправить ещё одну заявку' }));
    expect(screen.getByLabelText('Имя')).toHaveFocus();
    expect(screen.getByLabelText('Имя')).toHaveValue('');
    await fillValid(user);
    await user.click(submitButton());
    await screen.findByText('Заявка принята');
    expect(bodyOf(fetchMock, 1).idempotencyKey).not.toBe(bodyOf(fetchMock, 0).idempotencyKey);
  });
});

describe('LeadForm server 400', () => {
  it('shows field errors from the server and re-enables the form', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ ok: false, errors: { phone: PHONE_MSG } }, 400)));
    const user = userEvent.setup();
    renderForm();
    await fillValid(user);
    await user.click(submitButton());
    await waitFor(() => expect(screen.getByLabelText('Телефон')).toHaveAttribute('aria-invalid', 'true'));
    expect(screen.getByText(PHONE_MSG)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Исправьте 1 поле');
    expect(screen.getByLabelText('Телефон')).toHaveFocus();
    expect(submitButton()).toBeEnabled();
  });

  it('focuses the first enabled radio after a server error on interest', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(response({ ok: false, errors: { interest: 'Выберите, что вас интересует' } }, 400)),
    );
    const user = userEvent.setup();
    renderForm();
    await fillValid(user);
    await user.click(submitButton());
    await screen.findByText('Выберите, что вас интересует');
    const active = document.activeElement as HTMLInputElement;
    expect(active.type).toBe('radio');
    expect(active).toBeEnabled();
  });

  it('shows a refresh message and a new key for errors on unknown keys only', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ ok: false, errors: { renderedAt: 'Некорректное время' } }, 400))
      .mockResolvedValueOnce(response());
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    renderForm();
    await fillValid(user);
    await user.click(submitButton());
    const retry = await screen.findByRole('button', { name: 'Повторить отправку' });
    expect(screen.getByText('Не удалось отправить заявку')).toBeInTheDocument();
    expect(screen.getByText(/Обновите страницу и попробуйте ещё раз\./)).toBeInTheDocument();
    expect(screen.getByLabelText('Имя')).toHaveValue('Анна');
    await user.click(retry);
    await screen.findByText('Заявка принята');
    expect(bodyOf(fetchMock, 1).idempotencyKey).not.toBe(bodyOf(fetchMock, 0).idempotencyKey);
  });

  it('puts unknown messages in the summary next to known field errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(response({ ok: false, errors: { phone: PHONE_MSG, website: 'Некорректное значение' } }, 400)),
    );
    const user = userEvent.setup();
    renderForm();
    await fillValid(user);
    await user.click(submitButton());
    await screen.findByText(PHONE_MSG);
    const summary = screen.getByRole('alert');
    expect(summary).toHaveTextContent('Исправьте 1 поле');
    expect(summary).toHaveTextContent('Некорректное значение');
  });
});

describe('LeadForm interest', () => {
  it('pre-selects the interest from ?interest=order', async () => {
    window.history.replaceState(null, '', '/?interest=order');
    renderForm();
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Разовый заказ' })).toBeChecked());
  });

  it('keeps the default interest for an unknown ?interest value', () => {
    window.history.replaceState(null, '', '/?interest=bogus');
    renderForm();
    expect(screen.getByRole('radio', { name: 'Подписка' })).toBeChecked();
  });

  it('keeps the user choice when a hashchange or popstate fires later', async () => {
    window.history.replaceState(null, '', '/?interest=order');
    const user = userEvent.setup();
    renderForm();
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Разовый заказ' })).toBeChecked());
    await user.click(screen.getByRole('radio', { name: 'Вопрос' }));
    fireEvent(window, new HashChangeEvent('hashchange'));
    fireEvent(window, new PopStateEvent('popstate'));
    expect(screen.getByRole('radio', { name: 'Вопрос' })).toBeChecked();
  });
});
