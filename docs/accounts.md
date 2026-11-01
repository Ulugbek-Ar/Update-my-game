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
