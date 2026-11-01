# Akkauntlar: Telegram orqali kirish

Parol yo'q — Telegram tasdiqlaydi. Kirmasdan (mehmon) ham avvalgidek o'ynash mumkin.

## Kirish usullari

| Qayerda                          | Qanday                                                                                         |
| -------------------------------- | ---------------------------------------------------------------------------------------------- |
| Telegram ichida (Mini App)       | avtomatik: `Telegram.WebApp.initData` serverda bot tokeni bilan HMAC orqali tekshiriladi       |
| Sayt (ulugbek-ar.github.io)      | "TELEGRAM BILAN KIRISH" — Telegram Login Widget popup'i, javob serverda tekshiriladi           |
| Android ilova, Windows, portativ | bot havolasi `t.me/<bot>?start=login_<kod>` (yoki QR) → botda "Tasdiqlash" → o'yin o'zi kiradi |

Bot orqali kirish kodi **5 daqiqa** amal qiladi va **bir martalik**. Kodni faqat uni boshlagan
qurilma oladi (kod bilan birga yashirin `secret` — u havolada yo'q).

Sessiya — tasodifiy token (qurilmada `localStorage`, serverda faqat SHA-256 xeshi), 60 kun;
har kuni birinchi so'rovda uzayadi. Profil oynasidagi "CHIQISH" — sessiya o'chadi, progress
qurilmada qoladi (mehmon sifatida davom etiladi).

Birinchi kirishda:

- akkaunt bo'sh, qurilmada progress bor — "MEHMON PROGRESSI": akkauntga o'tkazish yoki yangidan
  boshlash (qurilmadagisi zaxiraga: Sozlamalar → Progressni ko'chirish → OLDINGI HOLATGA QAYTARISH);
- ikkalasida ham progress — "QAYSI PROGRESS QOLSIN?" (ikkala kartada oltin, daraja, yutuqlar,
  rekord, qahramonlar), tanlanmagani zaxiraga tushadi;
- qurilma bo'sh — bulutdagisi yuklanadi.

## Bulutli saqlanish

Kirgan o'yinchining progressi (`pixel-rpg-*` kalitlari) serverda ham saqlanadi:

- **yuklash** — ilova ochilganda, menyuga qaytganda va internet qaytganda (`save/get`, faqat
  versiya o'zgargan bo'lsa ma'lumot keladi);
- **saqlash** — o'zgarishdan 10 soniya keyin (faqat olam joyi o'zgargan bo'lsa — daqiqada bir),
  o'yin yopilganda yoki fonga o'tganda darhol (`keepalive`), akkauntdan chiqishdan oldin;
- **oflayn** — progress qurilmada qoladi, internet qaytganda yuboriladi (urinishlar 10 s dan
  5 daqiqagacha uzayadi);
- **qurilmaga xos** narsalar bulutga kirmaydi: boshqaruv sozlamalari, ovoz, sessiya tokeni,
  sinxron holati (`src/game/transfer.ts` — `DEVICE_KEYS`).

**Ziddiyat qoidasi — versiya + vaqt.** Har saqlanishga server tartib raqami beradi. Qurilma oxirgi
ko'rgan versiyadan davom etsa — saqlanadi. Orada boshqa qurilma saqlagan bo'lsa — progressi
**keyinroq o'zgargani** qoladi; ikkinchisi yo'qolmaydi, serverdagi zaxiraga tushadi. O'yin
paytida kelgan bulut nusxasi menyuga qaytganda qo'llanadi.

**Zaxira (serverda, oxirgi 5 ta):** boshqa qurilmadan saqlanganda, ziddiyatda, tanlov oynasida,
tiklashdan oldin va har 30 daqiqada. Profil → BULUT → ZAXIRALAR → TIKLASH.

**Chegaralar** (`src/account/limits.ts`): oltin ≤ 1 000 000 va oldingi saqlanishdan beri
≤ 3 000 + soatiga 2 000; bitta o'yin ochkosi ≤ 300 000 (cheksiz ≤ 3 000 000); XP ≤ 1 000 000
va ≤ 5 000 + soatiga 3 000. Imkonsiz qiymat — saqlanish rad etiladi, bulutda eskisi qoladi.

## BotFather va server sozlamasi

1. Kanal boti (TELEGRAM_BOT_TOKEN — kanalga post ham shu bot bilan).
2. BotFather → `/setdomain` → `ulugbek-ar.github.io` (Login Widget faqat shu domenda ishlaydi).
3. Mini App ham **shu botga** tegishli bo'lsin (boshqa botniki bo'lsa, initData imzosi mos kelmaydi —
   o'yin bot havolasi orqali kirishni taklif qiladi).
4. GitHub secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `TELEGRAM_BOT_TOKEN`.
   Server deploy workflow'i (`.github/workflows/server.yml`) tokenni `wrangler secret put` bilan
   serverga beradi va `setWebhook` qiladi. Kodda token yo'q.

Webhook yo'li va `X-Telegram-Bot-Api-Secret-Token` — `sha256("pikselqala-webhook:" + TOKEN)` ning
birinchi 40 belgisi (server ham, workflow ham shu formula bilan hisoblaydi).

Webhook kanalga post yuborishga ta'sir qilmaydi (`sendMessage`, `sendPhoto`, `sendDocument`
ishlayveradi). Faqat shu botda `getUpdates` endi ishlamaydi — u webhook bilan birga ishlamaydi.

## Lokal sinov

```bash
cd server
printf 'TELEGRAM_BOT_TOKEN=123456789:AAFakeBotTokenForTests_abcdefghijk\nTELEGRAM_BOT_NAME=PikselQalaTestBot\n' > .dev.vars
npx wrangler dev --port 8787
```

```bash
VITE_SERVER_URL=http://127.0.0.1:8787 bun run dev
```

`.dev.vars` git'ga kirmaydi. Haqiqiy Telegram bo'lmasa, bot tasdig'ini webhook'ga o'zingiz
yuborasiz (yo'l va secret — yuqoridagi formula bilan): `/start login_<kod>` xabari va
`callback_query` (`ok:<kod>`). Testlar: `npm test` (`src/account/**`).

## Muammolarni hal qilish

| Belgi                                         | Sabab va yechim                                                                                  |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| "Server hozircha tayyor emas"                 | serverda `TELEGRAM_BOT_TOKEN` yo'q: server workflow'ini qayta ishga tushiring (secret bormi?).   |
| Saytda widget "Bot domain invalid"            | BotFather → `/setdomain` → `ulugbek-ar.github.io`.                                               |
| Telegram ichida "Telegram tasdig'i noto'g'ri" | Mini App boshqa botga tegishli — bot havolasi bilan kiring yoki Mini App'ni shu botga o'tkazing. |
| Botda "Tasdiqlash" bosildi, o'yin kirmadi     | o'yinga qayting (fonda so'ramaydi); 5 daqiqa o'tgan bo'lsa — qayta "TELEGRAM BILAN KIRISH".      |
| Bot javob bermaydi                            | Actions → Server → "Bot webhook'i" qadami: `setWebhook` xatosi (token, server manzili).          |
| "Sessiya tugadi"                              | 60 kun ishlatilmagan yoki boshqa joyda chiqilgan — qayta kiring, progress bulutda.               |
