# Telegram bot setup

The bot does two things:

1. Forwards every new lead to the manager's chat (`TELEGRAM_CHAT_ID`).
2. After the customer presses **Start** on the success screen, replies to that chat with ONE confirmation message. It reads nothing else, never replies to other input and stores no chat ids.

A bot cannot message a bare @username, which is why the customer has to press Start first. The success screen links to `https://t.me/<bot>?start=<leadId>`; Telegram then sends our webhook `/start <leadId>`.

## 1. Create the bot (BotFather)

1. Open [@BotFather](https://t.me/BotFather) and send `/newbot`.
2. Pick a display name and a username ending in `bot` (for example `kvarta_bot`).
3. Copy the token BotFather returns. Treat it as a secret; never commit it.
4. Optional: `/setprivacy` -> Enable (the bot only needs `/start` in private chats), `/setdescription` and `/setabouttext` with a short note.

## 2. Environment variables

| Name | Value |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | the token from BotFather |
| `TELEGRAM_CHAT_ID` | the manager chat that receives leads |
| `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` | the bot username without `@`, for example `kvarta_bot`. Empty hides the bot box on the site. It is inlined at build time: redeploy after changing it. |
| `TELEGRAM_WEBHOOK_SECRET` | 1-256 characters from `A-Za-z0-9_-`. Generate one: `openssl rand -hex 24` |

If `TELEGRAM_WEBHOOK_SECRET` is not set the webhook answers 401 to everything (fail closed).

## 3. Register the webhook (once per domain or secret change)

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d url=https://<domain>/api/telegram/webhook \
  -d secret_token=<SECRET> \
  -d 'allowed_updates=["message"]'
```

Telegram then sends the secret in the `x-telegram-bot-api-secret-token` header of every call; the route rejects anything else.

## 4. Verify

```bash
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```

Expect `url` to be your endpoint, `pending_update_count` near 0 and no `last_error_message`.

Without Telegram, the route can be checked directly:

```bash
# 401: no header
curl -i -X POST https://<domain>/api/telegram/webhook -d '{}'
# 200 {"ok":true}: right header, unknown lead, no reply is sent
curl -i -X POST https://<domain>/api/telegram/webhook \
  -H 'x-telegram-bot-api-secret-token: <SECRET>' \
  -H 'content-type: application/json' \
  -d '{"message":{"text":"/start unknown-lead-id","chat":{"id":1,"type":"private"}}}'
```

## 5. Test end to end

1. Open the site and submit a lead with a real phone number.
2. On the success screen press "Открыть бота в Telegram" and press Start in Telegram.
3. You receive one message with the name, the interest, the partly masked phone and the next roast date.
4. Press Start again: nothing is sent (one message per lead, marker kept 30 days).

If the send fails (for example Telegram is unreachable) the marker is released and the customer can press Start again. The webhook always answers 200 for well-formed updates so Telegram does not retry.

Delivery is at-least-once, not exactly-once: if Telegram accepted the message but our request timed out, the send counts as failed, the marker is released, and the customer may receive a second message when they press Start again.

## Privacy notes

- The greeting contains the name the customer typed and a partly masked phone (`+375 29 ***-**-67`: operator code and last two digits only). It never contains the comment, nick, e-mail or campaign data.
- The start link uses only the customer's own request key (`?start=<own key>`). The site hides the bot box on duplicate submissions, and the API never returns another lead's id, so nobody can obtain a link that makes the bot greet them with someone else's data. Do not change the API to echo stored ids.
- The webhook ignores groups, bots, forwarded messages and anything but `/start <leadId>`, and stores no chat ids.

## Rotating the webhook secret

The webhook answers 401 to any call whose `x-telegram-bot-api-secret-token` header differs from `TELEGRAM_WEBHOOK_SECRET`, so there is a short gap between the deployed secret and the one Telegram sends. Telegram keeps retrying failed updates for a while, so a short gap loses little. To keep it minimal:

1. Generate a new secret: `openssl rand -hex 24`.
2. Set it as `TELEGRAM_WEBHOOK_SECRET` in Vercel and redeploy. Wait until the deployment is live.
3. Immediately run `setWebhook` again with the same `url` and `-d secret_token=<NEW SECRET>`.
4. Check `getWebhookInfo`: `last_error_message` should clear (a 401 from the gap may show once) and `pending_update_count` should fall to 0.

Between steps 2 and 3 Telegram's updates get 401 and are retried; customers who pressed Start in that window can simply press Start again.

Never put a real token or secret in the repository.
