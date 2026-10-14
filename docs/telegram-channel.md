# Telegram notifications for orders

When a lead is accepted, the bot sends two messages, to two different places:

| Target | Variable | Audience | Content |
| --- | --- | --- | --- |
| Private manager chat | `TELEGRAM_CHAT_ID` | the manager only | the full lead: name, phone, comment, source tags, landing page, time, lead id |
| Public channel feed | `TELEGRAM_CHANNEL_ID` | anyone with the invite link | an anonymized post: only "New order" + interest + time |

The customer is never messaged and the site has no customer-facing bot, so no webhook is needed.

## Why the channel is a public anonymized feed

The channel's invite link (`https://t.me/+<code>`) is shown on the site (footer and the "order accepted" screen), so the channel is effectively **public**: anyone can join and read it. For that reason the channel NEVER receives names, phone numbers, comments, attribution data or lead ids. A channel post looks like this and contains nothing else:

```
Новая заявка · подписка
Время: 15.10.2026 01:30 (Минск)
```

All personal details go only to the private chat (`TELEGRAM_CHAT_ID`). Never point `TELEGRAM_CHAT_ID` at the public channel. As a safety net, if the two ids are equal (after trimming; `@names` case-insensitively), the code sends only the anonymized post to that id, logs one fixed warning without the id, and treats the channel as the only target.

## 1. Create the bot (BotFather)

1. Open [@BotFather](https://t.me/BotFather) and send `/newbot`.
2. Pick a display name and a username ending in `bot`.
3. Copy the token BotFather returns. Treat it as a secret; never commit it.
4. Optional: `/setjoingroups` -> Disable (nobody can add the bot to other groups).

## 2. The public channel (TELEGRAM_CHANNEL_ID)

1. In Telegram: New Channel, give it a name.
2. Open the channel -> Administrators -> Add Administrator -> find your bot.
3. Enable ONLY **Post messages**; switch every other permission off. Save.
4. Only administrators can post in a channel, so subscribers can only read.

**The invite link is not a chat id.** The link `https://t.me/+<code>` can be shown on the site (it is `CONTACT.telegramChannelUrl` in `lib/contact.ts`), but the Bot API cannot use it as `chat_id`. Get the real id:

1. Post any message in the channel (or remove and re-add the bot as admin).
2. Open `https://api.telegram.org/bot<TOKEN>/getUpdates` in a browser.
3. Find `my_chat_member.chat.id` (when the bot was added) or `channel_post.chat.id` (after a post). It is a negative number starting with `-100`, for example `-1001234567890`. That is `TELEGRAM_CHANNEL_ID`.

If `getUpdates` is empty, post another message and reload.

## 3. The private manager chat (TELEGRAM_CHAT_ID)

Option A, a direct chat (simplest): the manager opens the bot in Telegram and presses **Start** (a bot cannot write first). Then open `getUpdates` and find `message.chat.id`: a positive number, for example `555000111`. That is `TELEGRAM_CHAT_ID`.

Option B, a private group with the bot: create a group, add the bot and the managers, write a message, and take `message.chat.id` from `getUpdates` (a negative number). Keep the group private.

## 4. Environment variables

| Name | Value |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | the token from BotFather |
| `TELEGRAM_CHAT_ID` | private manager chat id (positive number, or negative for a private group) |
| `TELEGRAM_CHANNEL_ID` | public channel id, starts with `-100` |

Set them in Vercel (Project -> Settings -> Environment Variables, Production) and in `.env.local` for local runs, then redeploy. The site works without any of them: leads are still saved, and notifications are skipped with one warning in the logs. **If `TELEGRAM_CHAT_ID` is not set, order details are NOT delivered anywhere except the stored data (the file database): nobody is notified of the customer's name and phone.** The privacy page statement that the order goes to a closed manager chat is only true once `TELEGRAM_CHAT_ID` is configured. If only the token and `TELEGRAM_CHANNEL_ID` are set, the channel post is sent and the logs carry one warning that order details are not delivered to a private chat.

Delivery rules: both messages are sent in parallel within one 4-second budget. If the private message fails, the request fails and the lead can be retried (the channel may then get a duplicate anonymized post). If only the channel post fails, it is logged and ignored. If the channel is the only target and fails, the request fails.

## 5. Test

Private chat (full details go only here):

```bash
curl -s "https://api.telegram.org/bot<TOKEN>/sendMessage" \
  -d chat_id=<PRIVATE_CHAT_ID> \
  -d text="Private test from the Kvarta bot"
```

Public channel (never send personal data):

```bash
curl -s "https://api.telegram.org/bot<TOKEN>/sendMessage" \
  -d chat_id=<CHANNEL_ID> \
  -d text="Channel test from the Kvarta bot"
```

Expect `"ok":true` and the message in the right place. Then submit the form on the site (a real-looking phone, wait a few seconds before sending): the manager chat gets the full order, the channel gets the two-line anonymized post.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `403 Forbidden` for the channel | The bot is not an administrator of the channel, or lacks "Post messages". Re-add it as an administrator. |
| `403 Forbidden` for the private chat | The manager never pressed Start, or blocked the bot. Ask them to open the bot and press Start. |
| `400 Bad Request: chat not found` | Wrong id. The channel id must start with `-100`; the invite link is not an id. For a direct chat the manager must have pressed Start. |
| `401 Unauthorized` | Wrong or revoked token. Check `TELEGRAM_BOT_TOKEN`; regenerate with BotFather `/revoke` if needed. |
| Channel post arrives, no manager message | `TELEGRAM_CHAT_ID` is not set (see the one-time warning in the logs). Order details then exist only in the stored data, not in any chat, and the privacy page claim about the closed chat is not yet true. |
| Warning "TELEGRAM_CHAT_ID equals TELEGRAM_CHANNEL_ID" | Both variables hold the same id. Only the anonymized post is sent; set `TELEGRAM_CHAT_ID` to the private manager chat. |
| Nothing arrives, no error | Variables not set in the deployed environment, or not redeployed after setting them. |

Delivery failures are logged without the token, chat ids or customer data (for example `telegram send failed: 403 Forbidden`).

## Access and invite link

- The channel invite link is public by design; it may be shown on the site. Do not put anything private in the channel.
- If the link is abused, revoke it (channel -> Invite Links -> Revoke), create a new one and update `CONTACT.telegramChannelUrl`.
- Keep the manager chat private; add only people who need customer phone numbers.

## Rotating the bot token

1. BotFather -> `/revoke` -> pick the bot; copy the new token.
2. Update `TELEGRAM_BOT_TOKEN` in Vercel and `.env.local`, then redeploy.
3. The old token stops working immediately; orders submitted before the redeploy finishes are not posted (they are still saved), so rotate at a quiet time.
