# Design delta: Pixso layout overrides the spec/plan where they differ

Source of truth for visuals: Pixso file 72Ho3-MUBWvDWupQCZ90-A, page "Kvarta landing"
(frames: Mobile 390 = 7:12, Tablet 768 = 4:529, Desktop 1440 = 7:13, Form states = 4:1238).
Decoded PNG exports of the frames are kept in the controller scratchpad (not in the repo).
Where this note conflicts with the spec or plan, THIS NOTE WINS (the design is the user's own).

## Tokens (exact, from the file's variables)
Colors: paper #F3EBDD (page bg), paper-2 #EADFCB (alt section bg), card #FBF6EC, ink #231A14 (text, dark sections bg),
ink-2 #3A2D24 (cards on dark), ink-soft #5E4E42 (secondary text), roast #C93B18, roast-deep #9C2B10 (red text on light),
yolk #F0B429 (CTA), leaf #2F6B4F (open-now, success), error #B3261E, line #CDBFA6, field-border #85715F,
kraft #DDB67A, kraft-deep #B98B51, tone-bergamot #E3D98B, tone-apple #E8A58E, tone-cocoa #8A5A3B, paper-dim #CDBBA3, white #FFFFFF.
Radius: 6, 10, 16, 24, pill 999. Spacing scale: 4 8 12 16 20 24 32 40 48 56 64 80 96 120.
Layout: content width 1200 on desktop (padding 120 at 1440), 688 on tablet (padding 40), 350 on mobile (padding 20).
Type: Roboto ONLY (weights 400/500, plus real italic 400 for the colored accent words). Scale (size/line-height):
Hero 56/64 desktop, 48/56 tablet, 36/44 mobile (weight 400, letter-spacing about -0.005em); H2 40/48 desktop, 34/42 tablet, 28/36 mobile (weight 500);
H3 24/32 (22/28 mobile) weight 500; Body L 18/29; Body M 16/26; Body S 14/22; Eyebrow/Stamp 12/16 weight 500 (lowercase, like "01 · свежесть");
Price 28/36 and Price XL 52/60 (weight 400); Button L 16/24 w500, Button S 14/20 w500.
Accent words inside headings are italic and colored (roast on light bg, yolk on dark bg, roast-deep on paper-2 bg).

## Rulings that change the plan
1. FONTS: Roboto only (next/font/google Roboto, subsets cyrillic+latin, weights 400 and 500, styles normal+italic, display swap).
   The spec's Literata/Onest/JetBrains Mono are dropped. Reason: the layout and its text styles are all Roboto and need real italics.
2. COLORS: use the Pixso variables above, not the spec's approximate hexes. Verify 4.5:1 for every text pair actually used;
   if roast #C93B18 on paper fails for small text, use roast-deep #9C2B10 for small red text.
3. FORM FIELDS: name, phone, "Ник в Telegram" (new), interest radios (Подписка / Разовый заказ / Вопрос), comment ("Необязательно").
   Telegram nick: OPTIONAL (brief requires only name/phone/interest/comment; requiring it would hurt conversion). If non-empty it must match
   ^@?[A-Za-z][A-Za-z0-9_]{4,31}$ and is stored without "@"; error text "Ник: от 5 символов, латиница, цифры и _, например @anna_minsk".
   Phone hint "Мы перезвоним на этот номер"; phone error "Проверьте номер: нужен белорусский, например +375 29 123-45-67";
   name hint "Только имя, без фамилии". Validation-summary box at top: "Исправьте N поля/полей".
4. NO BOT-DM PROMISE: a Telegram bot cannot message a user by @username, so the design's "Мы написали вам в Telegram" and the
   "Сообщений нет? Нажмите Start у бота" block cannot be built honestly. Success state says: "Заявка принята. Менеджер позвонит на <phone>
   (или напишет в Telegram @nick, если указали) в рабочее время." Keep button "Отправить ещё одну заявку". Drop the bot-open button.
   The "что придёт в Telegram" chat-bubble card in the form section becomes a "что будет дальше" card in the same style (3 short steps, no bot claim).
   The lead-forwarding Telegram bot (to the manager) is unchanged.
5. FORM STATES (frame 4:1238): 4 states: validation errors, sending ("Отправляем…" spinner, "Не закрывайте страницу: это займёт пару секунд."),
   success, send failure ("Не удалось отправить заявку" box: "Проверьте интернет и нажмите «Повторить». Данные в форме сохранены. Или позвоните нам: +375 29 000-00-00."
   with buttons "Повторить отправку" and "Позвонить: +375 29 000-00-00"). The 000-00-00 number is a fictional placeholder; keep it in one constant.
6. DELIVERY BELOW 50 BYN: the design says "Меньше 50 BYN: стоимость назовёт менеджер при звонке." (NOT a flat fee). Use that copy.
7. NO STICKY CTA COMPONENT: the header carries a "Заявка" button on mobile (logo left, button right) and nav + "Оставить заявку" on desktop;
   make the header sticky. Drop components/StickyCta.tsx from the plan.
8. EXTRAS NOT IN THE DESIGN (kept, styled to match, cheap to drop): FAQ section (4 questions), footer with contacts (nav has "Контакты").
9. COPY FIXES to the design: "на 1–3 день" -> "на 1–3-й день"; duplicate section number 05 (about and form) -> about 05, form 06.
   Section eyebrows: 01 свежесть, 02 кофе, 03 подписка, 04 доставка и самовывоз, 05 о нас, 06 заявка.
10. DYNAMIC DATES: bag label date ("250 г · 15.10") and the "ближайшая обжарка: четверг, 15 октября · заявки до среды, 20:00" line are computed from
    lib/schedule.ts in a small client component (page is statically generated, a server-computed date would go stale); SSR fallback renders "четверг".
11. ROAST LEVELS from the design: Ethiopia 2/5 "светлая", Colombia 3/5 "средняя", Brazil 4/5 "средне-тёмная" (still unconfirmed with the client; README assumption).
12. ILLUSTRATIONS are inline SVG: kraft coffee bag with white label on a roast-red quarter-circle, coffee-bean icon, drip-bag icon, truck/flame/pin icons, illustrated (not real) map tile.
13. ABOUT PHOTO: the design shows a photo of a roaster (dark interior, lamp, roasting machine). Licensing unknown; use `public/images/roastery.jpg` and,
    until the user supplies/approves a free-licence (Unsplash/Pexels) photo, a placeholder crop is acceptable. Record as an open item for the README.

## Section order and content (all three breakpoints)
Header (sticky) -> Hero (eyebrow dot "обжариваем по четвергам", headline "Кофе, обжаренный в четверг. У вас — в пятницу." with "в пятницу" italic roast,
CTAs "Оформить подписку" yolk + "Выбрать кофе" outline, note "Менеджер перезвонит и всё оформит. Платить на сайте не нужно.",
stats 5 кг / с 2019 / 1–3 дня, bag illustration; mobile/tablet stack the illustration below)
-> 01 свежесть on ink background (headline "Мы не держим склад. Жарим то, что заказали за неделю", copy, 7-day week strip ПН..ВС: ПН/ВТ/СР dim "заказы" (СР "заказы до 20:00"),
   ЧТ roast "обжарка", ПТ yolk "доставка", СБ/ВС outlined "самовывоз"; three legend items; "ближайшая обжарка" line)
-> 02 кофе (3 cards with bergamot/apple/cocoa tone headers, flavor tags, roast dots, price + "250 г", "В заявку" button; drip-bag row 18 BYN "10 штук · для офиса и поездок")
-> 03 подписка on paper-2 ("Кофе приезжает сам", checklist, dark button "Оформить подписку", price card 54 BYN / мес with rows 2 пачки 2 × 250 г, доставка 0 BYN, обжарка по четвергам)
-> 04 доставка и самовывоз ("Привезём в пятницу или ждём в мастерской": delivery card with "от 50 BYN доставка бесплатно" + illustrated map card, ул. Короля, 9,
   open-now in leaf green "Сейчас открыто · до 20:00", hours rows Пн–Пт 08:00–20:00 (chip "сегодня") / Сб–Вс 10:00–18:00, button "Построить маршрут")
-> 05 о нас on paper-2 (photo with caption chip "мастерская / Обжариваем партиями по 5 кг", "Мы — Аня и Дмитрий", story copy, signature "Аня и Дмитрий" italic roast-deep)
-> FAQ (extra) -> 06 заявка on ink background (left: headline "Оставьте заявку, мы перезвоним" (design says "мы напишем в Telegram", reworded per ruling 4), checklist,
   "что будет дальше" card; right: form card on card color, yolk submit button "Отправить заявку", consent line) -> Footer (extra).
Read the exact Russian copy off the decoded PNGs; the copy fixes in ruling 9 apply.
