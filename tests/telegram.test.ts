import { inspect } from "node:util";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StoredLead } from "@/lib/store";
import {
  formatChannelMessage,
  formatLeadMessage,
  formatMinskTime,
  sendTelegram,
  sendTelegramMessage,
} from "@/lib/telegram";

const TOKEN = "123456:SECRET-token_abc";
const CHAT = "-1001234567890";

const lead = (over: Partial<StoredLead> = {}): StoredLead => ({
  leadId: "lead-1",
  name: "Анна Секретова",
  phone: "+375291234567",
  interest: "subscription",
  comment: "Хочу зерно",
  attribution: {},
  createdAt: "2026-10-14T22:30:00.000Z",
  ...over,
});

describe("formatMinskTime", () => {
  it("shifts to Minsk across the date boundary", () => {
    expect(formatMinskTime("2026-10-14T22:30:00.000Z")).toBe(
      "15.10.2026 01:30",
    );
  });
  it("rolls over the year", () => {
    expect(formatMinskTime("2026-12-31T21:30:00.000Z")).toBe(
      "01.01.2027 00:30",
    );
  });
  it("returns the raw input for an invalid date", () => {
    expect(formatMinskTime("garbage")).toBe("garbage");
  });
  it("keeps same-day times", () => {
    expect(formatMinskTime("2026-03-05T06:07:00.000Z")).toBe(
      "05.03.2026 09:07",
    );
  });
});

describe("formatLeadMessage truncation", () => {
  it("keeps as much comment as fits when escaping inflates it", () => {
    const attribution = Object.fromEntries(
      [
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_content",
        "utm_term",
        "yclid",
        "ysclid",
        "fbclid",
        "landing",
        "referrer",
      ].map((k) => [k, "v".repeat(300)]),
    );
    const msg = formatLeadMessage(
      lead({ comment: 'Q"'.repeat(250), attribution }),
    );
    expect(msg.length).toBeLessThanOrEqual(3800);
    expect(msg.length).toBeGreaterThan(3750);
    expect(msg.split("\n").find((l) => l.startsWith("Комментарий"))).toMatch(
      /&quot;…$|Q…$/,
    );
  });

  it("shrinks attribution values with an ellipsis when the comment alone cannot help", () => {
    const attribution = Object.fromEntries(
      [
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_content",
        "utm_term",
        "yclid",
        "ysclid",
        "fbclid",
        "landing",
        "referrer",
        "submittedAt",
      ].map((k) => [k, "&".repeat(900)]),
    );
    const msg = formatLeadMessage(lead({ comment: "hello", attribution }));
    expect(msg.length).toBeLessThanOrEqual(3800);
    expect(msg).toContain("Кампания: ");
    expect(msg).toMatch(/Кампания: (&amp;)+…/);
  });

  it("does not split surrogate pairs", () => {
    const msg = formatLeadMessage(lead({ comment: "😀".repeat(3000) }));
    expect(msg.length).toBeLessThanOrEqual(3800);
    expect(msg).not.toMatch(
      /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/,
    );
  });
});

describe("formatLeadMessage", () => {
  it("escapes html in name and comment", () => {
    const msg = formatLeadMessage(
      lead({ name: "<b>x</b> & \"q\" 's'", comment: "<i>c</i>" }),
    );
    expect(msg).toContain(
      "&lt;b&gt;x&lt;/b&gt; &amp; &quot;q&quot; &#39;s&#39;",
    );
    expect(msg).toContain("&lt;i&gt;c&lt;/i&gt;");
    expect(msg.replace("<b>Новая заявка</b>", "")).not.toContain("<b>x");
  });

  it("includes phone, id, time and interest labels", () => {
    const msg = formatLeadMessage(lead());
    expect(msg).toContain("<b>Новая заявка</b> · подписка");
    expect(msg).toContain("Телефон: +375291234567");
    expect(msg).toContain("Заявка получена: 15.10.2026 01:30 · id lead-1");
    expect(formatLeadMessage(lead({ interest: "order" }))).toContain(
      "разовый заказ",
    );
    expect(formatLeadMessage(lead({ interest: "question" }))).toContain(
      "вопрос",
    );
  });

  it("includes attribution", () => {
    const msg = formatLeadMessage(
      lead({
        attribution: {
          utm_source: "yandex",
          utm_medium: "cpc",
          utm_campaign: "camp1",
          yclid: "Y123",
          landing: "/?a=1",
          referrer: "https://ya.ru/",
        },
      }),
    );
    expect(msg).toContain("Источник: yandex / cpc");
    expect(msg).toContain("Кампания: camp1");
    expect(msg).toContain("yclid=Y123");
    expect(msg).toContain("Страница входа: /?a=1");
    expect(msg).toContain("Пришёл с: https://ya.ru/");
  });

  it("has no customer Telegram line and never prints undefined", () => {
    const msg = formatLeadMessage(lead());
    expect(msg).not.toContain("Telegram");
    expect(msg).not.toContain("t.me");
    expect(msg).not.toMatch(/undefined|null/);
    expect(msg).toContain("Телефон: +375291234567");
  });

  it("omits empty values and never prints undefined/null", () => {
    const msg = formatLeadMessage(
      lead({ comment: "", attribution: { referrer: "" } }),
    );
    expect(msg).not.toMatch(/undefined|null/);
    expect(msg).not.toContain("Комментарий");
    expect(msg).not.toContain("Пришёл с");
    expect(msg).not.toContain("Источник");
    for (const line of msg.split("\n")) expect(line).not.toMatch(/:\s*$/);
  });

  it("stays within the cap with no broken entities or tags in the worst case", () => {
    const keys = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_content",
      "utm_term",
      "yclid",
      "ysclid",
      "fbclid",
      "landing",
      "referrer",
      "submittedAt",
    ];
    const attribution = Object.fromEntries(
      keys.map((k) => [k, "&".repeat(300)]),
    );
    const msg = formatLeadMessage(
      lead({
        comment: "<".repeat(500),
        name: "&".repeat(100),
        attribution,
      }),
    );
    expect(msg.length).toBeLessThanOrEqual(3800);
    expect(msg.length).toBeGreaterThan(3740);
    expect(msg).not.toMatch(/&(?!(amp|lt|gt|quot|#39);)/);
    expect(msg.match(/<b>/g)?.length).toBe(msg.match(/<\/b>/g)?.length);
    expect(msg.match(/<a /g)?.length).toBe(msg.match(/<\/a>/g)?.length);
    expect(msg.replace(/<\/?b>|<a href="[^"]*">|<\/a>/g, "")).not.toMatch(
      /[<>]/,
    );
    expect(msg).toContain("id lead-1");
  });
});

describe("sendTelegram", () => {
  const sleep = vi.fn(async (ms: number) => {
    void ms;
  });
  let fetchMock: ReturnType<typeof vi.fn>;
  let spies: ReturnType<typeof vi.spyOn>[];
  const ok = () => new Response(JSON.stringify({ ok: true }), { status: 200 });
  const fail = (
    status: number,
    body: unknown = { ok: false, description: "boom" },
  ) => new Response(JSON.stringify(body), { status });
  const consoleDump = () =>
    spies
      .map((s) => inspect(s.mock.calls, { showHidden: true, depth: 10 }))
      .join("\n");
  const full = lead();

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("TELEGRAM_BOT_TOKEN", TOKEN);
    vi.stubEnv("TELEGRAM_CHAT_ID", CHAT);
    vi.stubEnv("TELEGRAM_CHANNEL_ID", "");
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    sleep.mockClear();
    spies = (["log", "warn", "error", "info", "debug"] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {}),
    );
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const assertSafe = (err: unknown) => {
    const e = err as Error;
    const blob = `${e.message}\n${e.stack}\n${inspect(e, { showHidden: true, depth: 10 })}\n${consoleDump()}`;
    for (const secret of [
      TOKEN,
      "api.telegram.org",
      "+375291234567",
      "Анна",
      "Хочу зерно",
      "SECRET",
    ])
      expect(blob).not.toContain(secret);
  };
  const failure = (p: Promise<void>) =>
    p.then(
      () => null,
      (e: unknown) => e as Error,
    );

  it("assertSafe is not vacuous", () => {
    expect(() => assertSafe(new Error(TOKEN))).toThrow();
  });

  it("keeps only the generic part of the description", async () => {
    fetchMock.mockImplementation(async () =>
      fail(400, {
        ok: false,
        description: 'Bad Request: chat not found "+375291234567"',
      }),
    );
    const err = await failure(sendTelegram(full, sleep));
    expect(err?.message).toBe("telegram send failed: 400 Bad Request");
  });

  it("retries after a network TypeError", async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(ok());
    await expect(sendTelegram(full, sleep)).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  describe("deadline", () => {
    let clock: number;
    const now = () => clock;
    const tick = async (ms: number) => {
      clock += ms;
    };
    const timeoutError = () => new DOMException("timed out", "TimeoutError");
    let timeoutSpy: ReturnType<typeof vi.spyOn>;
    beforeEach(() => {
      clock = 0;
      timeoutSpy = vi.spyOn(AbortSignal, "timeout");
    });

    it("treats a timeout as a failed attempt and retries within the remaining budget", async () => {
      fetchMock
        .mockImplementationOnce(async () => {
          clock += 3000;
          throw timeoutError();
        })
        .mockResolvedValueOnce(ok());
      await sendTelegram(full, tick, now);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(timeoutSpy.mock.calls.map((c: unknown[]) => c[0])).toEqual([
        3000, 600,
      ]);
      expect(clock).toBeLessThanOrEqual(4000);
    });

    it("stays within the total budget when both attempts hang", async () => {
      fetchMock.mockImplementation(async () => {
        clock += timeoutSpy.mock.calls.at(-1)![0] as number;
        throw timeoutError();
      });
      const err = await failure(sendTelegram(full, tick, now));
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(clock).toBeLessThanOrEqual(4000);
      expect(err?.message).toBe("telegram send failed: TimeoutError");
    });

    it("does not retry when less than 1000 ms remain", async () => {
      fetchMock.mockImplementation(async () => {
        clock += 3200;
        throw timeoutError();
      });
      const err = await failure(sendTelegram(full, tick, now));
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(err).toBeInstanceOf(Error);
    });

    it("does not wait out a 429 that would consume the remaining budget", async () => {
      fetchMock.mockImplementation(async () => {
        clock += 3000;
        return fail(429, { ok: false, parameters: { retry_after: 1 } });
      });
      await failure(sendTelegram(full, tick, now));
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  it("posts the exact request", async () => {
    fetchMock.mockResolvedValue(ok());
    await sendTelegram(full, sleep);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`https://api.telegram.org/bot${TOKEN}/sendMessage`);
    expect(init.method).toBe("POST");
    expect(init.headers["content-type"]).toBe("application/json");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(init.body)).toEqual({
      chat_id: CHAT,
      text: formatLeadMessage(full),
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
  });

  it("is a no-op with a single warning when not configured", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
    const mod = await import("@/lib/telegram");
    await mod.sendTelegram(full, sleep);
    await mod.sendTelegram(full, sleep);
    expect(fetchMock).not.toHaveBeenCalled();
    const warn = console.warn as unknown as ReturnType<typeof vi.fn>;
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      "telegram notifications disabled: bot token or chat id not configured",
    );
    expect(consoleDump()).not.toContain(CHAT);
  });

  it("retries once after a 500", async () => {
    fetchMock.mockResolvedValueOnce(fail(500)).mockResolvedValueOnce(ok());
    await expect(sendTelegram(full, sleep)).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(400);
  });

  it("throws a safe error after two failures", async () => {
    fetchMock.mockImplementation(async () =>
      fail(502, { ok: false, description: "Bad Gateway" }),
    );
    const err = await failure(sendTelegram(full, sleep));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(err?.message).toContain("502");
    expect(err?.message).toContain("Bad Gateway");
    assertSafe(err);
  });

  it("does not retry a 400", async () => {
    fetchMock.mockImplementation(async () =>
      fail(400, { ok: false, description: "chat not found" }),
    );
    const err = await failure(sendTelegram(full, sleep));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(err?.message).toContain("400");
    assertSafe(err);
  });

  it("retries a 429 with retry_after 1", async () => {
    fetchMock
      .mockResolvedValueOnce(
        fail(429, { ok: false, parameters: { retry_after: 1 } }),
      )
      .mockResolvedValueOnce(ok());
    await sendTelegram(full, sleep);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(1000);
  });

  it("does not retry a 429 with retry_after 30", async () => {
    fetchMock.mockImplementation(async () =>
      fail(429, { ok: false, parameters: { retry_after: 30 } }),
    );
    const err = await failure(sendTelegram(full, sleep));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(err?.message).toContain("429");
    assertSafe(err);
  });

  it("never leaks the token from fetch errors", async () => {
    fetchMock.mockImplementation(async () => {
      const e = new TypeError(
        `fetch failed for https://api.telegram.org/bot${TOKEN}/sendMessage`,
      );
      (e as { cause?: unknown }).cause = new Error(TOKEN);
      throw e;
    });
    const err = await failure(sendTelegram(full, sleep));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(err?.message).toContain("TypeError");
    assertSafe(err);
  });

  it("caps a long description", async () => {
    fetchMock.mockImplementation(async () =>
      fail(400, { ok: false, description: "x".repeat(500) }),
    );
    const err = await failure(sendTelegram(full, sleep));
    expect(err!.message).toBe("telegram send failed: 400 " + "x".repeat(60));
  });
});

describe("sendTelegramMessage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("posts to the given chat id and text", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", TOKEN);
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await sendTelegramMessage(42, "hi");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`https://api.telegram.org/bot${TOKEN}/sendMessage`);
    expect(JSON.parse(init.body)).toEqual({
      chat_id: 42,
      text: "hi",
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
  });

  it.each(["-1001234567890", "@kvarta_orders"])(
    "sends the channel id %s unchanged as chat_id",
    async (channel) => {
      vi.stubEnv("TELEGRAM_BOT_TOKEN", TOKEN);
      const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
      vi.stubGlobal("fetch", fetchMock);
      await sendTelegramMessage(channel, "hi");
      expect(JSON.parse(fetchMock.mock.calls[0][1].body).chat_id).toBe(channel);
    },
  );

  it.each(["-1001234567890", "@kvarta_orders"])(
    "sendTelegram posts the order to the channel %s from TELEGRAM_CHAT_ID",
    async (channel) => {
      vi.stubEnv("TELEGRAM_BOT_TOKEN", TOKEN);
      vi.stubEnv("TELEGRAM_CHAT_ID", channel);
      const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
      vi.stubGlobal("fetch", fetchMock);
      await sendTelegram(lead());
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.chat_id).toBe(channel);
      expect(body.text).toContain("Новая заявка");
    },
  );

  it("throws a token-free error when the token is missing", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
    vi.stubGlobal("fetch", vi.fn());
    await expect(sendTelegramMessage(42, "hi")).rejects.toThrow("telegram send failed");
  });

  it("never leaks the token, chat id or text in the error", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", TOKEN);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 400 })));
    const error = await sendTelegramMessage(987654321, "secret text").catch((e) => e as Error);
    expect(inspect(error, { showHidden: true })).not.toMatch(/SECRET-token|987654321|secret text/);
  });
});

describe("formatChannelMessage", () => {
  const hostile = lead({
    leadId: "LEAD-SECRET-ID-1234",
    name: "<b>Анна</b>",
    phone: "+375291234567",
    comment: "Секретный комментарий",
    attribution: {
      utm_source: "src-val",
      utm_campaign: "camp-val",
      yclid: "click-val",
      landing: "https://kvarta.by/land-val",
      referrer: "https://ref.example/ref-val",
    },
  });

  it("never contains personal or tracking data", () => {
    const msg = formatChannelMessage(hostile);
    for (const forbidden of [
      "Анна",
      "<b>Анна",
      "375",
      "291234567",
      "29 123",
      "Секретный",
      "src-val",
      "camp-val",
      "click-val",
      "land-val",
      "ref-val",
      "LEAD-SECRET-ID-1234",
      "id ",
    ])
      expect(msg).not.toContain(forbidden);
  });

  it.each([
    ["subscription", "подписка"],
    ["order", "разовый заказ"],
    ["question", "вопрос"],
  ] as const)("renders the exact post for %s", (interest, label) => {
    expect(formatChannelMessage(lead({ interest }))).toBe(
      `<b>Новая заявка</b> · ${label}\nВремя: 15.10.2026 01:30 (Минск)`,
    );
  });
});

describe("sendTelegram targets", () => {
  const PRIVATE = "555000111";
  const CHANNEL = "-1009998887776";
  const sleep = async () => {};
  let fetchMock: ReturnType<typeof vi.fn>;
  let spies: ReturnType<typeof vi.spyOn>[];
  const ok = () => new Response("{}", { status: 200 });
  const bad = () =>
    new Response(JSON.stringify({ ok: false, description: "Bad Request" }), {
      status: 400,
    });
  const dump = () =>
    spies.map((s) => inspect(s.mock.calls, { depth: 10 })).join("\n");
  const bodies = () =>
    fetchMock.mock.calls.map(
      (c: unknown[]) =>
        JSON.parse((c[1] as { body: string }).body) as {
          chat_id: string;
          text: string;
        },
    );
  const failure = (p: Promise<void>) =>
    p.then(
      () => null,
      (e: unknown) => e as Error,
    );
  const warnMock = () => console.warn as unknown as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("TELEGRAM_BOT_TOKEN", TOKEN);
    vi.stubEnv("TELEGRAM_CHAT_ID", PRIVATE);
    vi.stubEnv("TELEGRAM_CHANNEL_ID", CHANNEL);
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    spies = (["log", "warn", "error", "info", "debug"] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {}),
    );
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("sends the full message to the private chat and the anonymized one to the channel", async () => {
    fetchMock.mockImplementation(async () => ok());
    await sendTelegram(lead(), sleep);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const byChat = Object.fromEntries(bodies().map((b) => [b.chat_id, b.text]));
    expect(byChat[PRIVATE]).toContain("Анна Секретова");
    expect(byChat[PRIVATE]).toBe(formatLeadMessage(lead()));
    expect(byChat[CHANNEL]).toBe(formatChannelMessage(lead()));
    expect(byChat[CHANNEL]).not.toContain("Анна");
    expect(byChat[CHANNEL]).not.toContain("375");
  });

  it("sends only to the private chat when no channel is configured", async () => {
    vi.stubEnv("TELEGRAM_CHANNEL_ID", "");
    fetchMock.mockImplementation(async () => ok());
    await sendTelegram(lead(), sleep);
    expect(bodies().map((b) => b.chat_id)).toEqual([PRIVATE]);
  });

  it("sends only the anonymized post when only the channel is configured, and warns once about the chat id", async () => {
    vi.stubEnv("TELEGRAM_CHAT_ID", "");
    fetchMock.mockImplementation(async () => ok());
    const mod = await import("@/lib/telegram");
    await mod.sendTelegram(lead(), sleep);
    await mod.sendTelegram(lead(), sleep);
    expect(bodies().map((b) => b.chat_id)).toEqual([CHANNEL, CHANNEL]);
    expect(bodies()[0].text).not.toContain("Анна");
    expect(warnMock()).toHaveBeenCalledTimes(1);
    expect(warnMock()).toHaveBeenCalledWith(
      "telegram: TELEGRAM_CHAT_ID not set: order details are not delivered to a private chat",
    );
  });

  it("warns once per process when only a token exists", async () => {
    vi.stubEnv("TELEGRAM_CHAT_ID", "");
    vi.stubEnv("TELEGRAM_CHANNEL_ID", "");
    const mod = await import("@/lib/telegram");
    await mod.sendTelegram(lead(), sleep);
    await mod.sendTelegram(lead(), sleep);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(warnMock()).toHaveBeenCalledTimes(1);
  });

  it("resolves and logs a PII-free line when only the channel post fails", async () => {
    fetchMock.mockImplementation(async (_u: string, init: { body: string }) =>
      JSON.parse(init.body).chat_id === CHANNEL ? bad() : ok(),
    );
    await expect(sendTelegram(lead(), sleep)).resolves.toBeUndefined();
    const log = dump();
    expect(log).toContain("channel");
    for (const secret of [TOKEN, "api.telegram.org", CHANNEL, PRIVATE, "Анна", "+375291234567"])
      expect(log).not.toContain(secret);
  });

  it("rejects with a safe message when the private target fails", async () => {
    fetchMock.mockImplementation(async (_u: string, init: { body: string }) =>
      JSON.parse(init.body).chat_id === PRIVATE ? bad() : ok(),
    );
    const err = await failure(sendTelegram(lead(), sleep));
    expect(err?.message).toBe("telegram send failed: 400 Bad Request");
    for (const secret of [TOKEN, CHANNEL, PRIVATE, "Анна"])
      expect(inspect(err, { showHidden: true, depth: 10 })).not.toContain(secret);
  });

  it("rejects when only the channel is configured and it fails", async () => {
    vi.stubEnv("TELEGRAM_CHAT_ID", "");
    fetchMock.mockImplementation(async () => bad());
    const err = await failure(sendTelegram(lead(), sleep));
    expect(err?.message).toBe("telegram send failed: 400 Bad Request");
  });

  it("does nothing and warns once when nothing is configured", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
    vi.stubEnv("TELEGRAM_CHAT_ID", "");
    vi.stubEnv("TELEGRAM_CHANNEL_ID", "");
    const mod = await import("@/lib/telegram");
    await mod.sendTelegram(lead(), sleep);
    await mod.sendTelegram(lead(), sleep);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(warnMock()).toHaveBeenCalledTimes(1);
  });

  it("stays within the total deadline when both targets hang", async () => {
    let clock = 0;
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout");
    fetchMock.mockImplementation(async () => {
      const start = clock;
      const t = timeoutSpy.mock.calls.at(-1)![0] as number;
      clock = Math.max(clock, start + t);
      throw new DOMException("timed out", "TimeoutError");
    });
    const err = await failure(
      sendTelegram(
        lead(),
        async (ms) => {
          clock += ms;
        },
        () => clock,
      ),
    );
    expect(err?.message).toBe("telegram send failed: TimeoutError");
    expect(clock).toBeLessThanOrEqual(4000);
  });
});
