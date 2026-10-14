# Telegram channel for orders

When a lead is accepted, the bot posts the order into a Telegram **channel** that only the bot can write to. Staff read the orders there. The customer is never messaged and the site has no customer-facing bot, so no webhook is needed.

## The channel MUST be private

Every order post contains the customer's **name and phone number**. Never make the channel public, never give it a `t.me/<name>` link, and never share an invite link outside the staff. A public channel (`@channelusername`) would publish customer phone numbers to the whole internet and search engines.

## 1. Create the bot (BotFather)

1. Open [@BotFather](https://t.me/BotFather) and send `/newbot`.
2. Pick a display name and a username ending in `bot` (for example `kvarta_orders_bot`).
3. Copy the token BotFather returns. Treat it as a secret; never commit it.
4. Optional: `/setjoingroups` -> Disable (nobody can add the bot to other groups).

## 2. Create the private channel

1. In Telegram: New Channel, give it a name (for example "Заявки Кварта").
2. Choose **Private** (not Public). Do not set a public link.
3. Open the channel -> Administrators -> Add Administrator -> find your bot.
4. Enable ONLY **Post messages**; switch every other permission off. Save.

Only administrators can post in a channel; subscribers can only read. So only the bot (and you, as the owner) can write.

## 3. Get the channel id

1. Post any message in the channel (as the owner), or add the bot and post once.
2. Open `https://api.telegram.org/bot<TOKEN>/getUpdates` in a browser.
3. Find `channel_post.chat.id`. It is a negative number starting with `-100`, for example `-1001234567890`.

If `getUpdates` is empty, post another message and reload. (Public channels can also be addressed as `@channelusername`, but do NOT use a public channel, see above.)

## 4. Environment variables

| Name | Value |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | the token from BotFather |
| `TELEGRAM_CHAT_ID` | the channel id, for example `-1001234567890` |

Set both in Vercel (Project -> Settings -> Environment Variables, Production) and in `.env.local` for local runs, then redeploy. If either is missing, notifications are skipped with one warning in the logs and the lead is still saved.

## 5. Test

```bash
curl -s "https://api.telegram.org/bot<TOKEN>/sendMessage" \
  -d chat_id=<CHANNEL_ID> \
  -d text="Test from the Kvarta bot"
```

Expect `"ok":true` and the message in the channel. Then submit the form on the site (a real-looking phone, wait a few seconds before sending) and check the order post: type, name, phone, comment, source tags, landing page, time and lead id.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `403 Forbidden` (bot is not a member / can't post) | The bot is not an administrator of the channel, or lacks "Post messages". Re-add it as an administrator. |
| `400 Bad Request: chat not found` | Wrong `TELEGRAM_CHAT_ID`: it must be the channel id with the `-100` prefix, or the bot was never added to the channel. |
| `401 Unauthorized` | Wrong or revoked token. Check `TELEGRAM_BOT_TOKEN`; regenerate with BotFather `/revoke` if needed. |
| Nothing arrives, no error | Variables not set in the deployed environment (see the single "notifications disabled" warning in the logs), or not redeployed after setting them. |

Delivery failures are logged without the token, chat id or customer data (for example `telegram send failed: 403 Forbidden`).

## Staff access and keeping it private

- Add a staff member: channel -> Subscribers -> Add Subscriber (by contact), or share the channel's **invite link** with them personally.
- Never post the invite link on the site, social media or in public chats. If it leaks, revoke it (channel -> Invite Links -> Revoke) and create a new one.
- Remove people who leave: channel -> Subscribers -> remove.
- Do not make anyone but the bot an administrator unless they need to manage the channel.
- Do not enable "Forwarding" for others if you want to limit copying: channel -> Manage -> Restrict saving content.

## Rotating the bot token

1. BotFather -> `/revoke` -> pick the bot; copy the new token.
2. Update `TELEGRAM_BOT_TOKEN` in Vercel and `.env.local`, then redeploy.
3. The old token stops working immediately; orders submitted before the redeploy finishes are not posted to the channel (they are still saved), so rotate at a quiet time.
