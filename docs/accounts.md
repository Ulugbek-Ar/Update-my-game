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

## Profil va o'yinchi darajasi

Profil (menyuda chap yuqorida — avatar, taxallus va daraja): taxallus (3–16 belgi, harf/raqam/`_`,
lotin yoki kirill — aralash emas; haqoratli so'zlar va xizmat nomlari filtri, band bo'lmasligi
kerak), avatar — ochilgan qahramonlardan biri, daraja, unvon, XP chizig'i, do'st kodi, statistika
(o'ynalgan vaqt, dushmanlar, bosslar, o'yinlar) va har qahramon bo'yicha eng yaxshi rekordlar.

| XP manbai                                                 | XP            |
| --------------------------------------------------------- | ------------- |
| tozalangan to'lqin (sarguzasht, cheksiz, kunlik)          | 10            |
| Iblis (va cheksiz rejim bosslari) / Malika / O'rmon Shohi | 50 / 75 / 100 |
| Olamda: Xaroba Sardori / Kul qiroli                       | 80 / 150      |
| olam topshirig'i / yangi sir                              | 40 / 25       |
| kunlik sovg'a                                             | 20            |

Daraja 1–50: L dan L+1 ga 100 + 20·(L−1) XP (10-daraja — 1 620, 50-daraja — 28 420 XP). Har
darajada kichik oltin sovg'asi (5 + L/5, har 10-darajada +25; 2→50 jami ≈ 600 oltin — o'yinlardan
topiladiganning ~3 %, do'kon narxlari o'zgarmaydi), sovg'a menyuda "YANGI DARAJA!" oynasida
olinadi. Har 10 darajada yangi unvon: Yangi kelgan → Zindon kezuvchisi (10) → Qal'a qo'riqchisi
(20) → Olam sayyohi (30) → Bosslar ovchisi (40) → Afsona (50).

XP mehmonda ham yig'iladi va kirganda akkauntga o'tadi. Onlayn olamda kirgan o'yinchining ismi
o'rniga taxallusi va yonida darajasi ko'rinadi (server tokenni akkauntlar DO'sida tekshiradi).

## Do'stlar

- **Qo'shish:** taxallus yoki do'st kodi (`XXXX-XXXX`, profil va QO'SHISH bo'limida) bo'yicha
  so'rov → u qabul qiladi yoki rad etadi. Ikkalasi bir-biriga so'rov yuborsa — darhol do'st.
  Chegaralar: 100 do'st, 30 ta javob kutilayotgan so'rov.
- **Ro'yxat:** onlayn/oflayn (oxirgi 5 daqiqada holat yuborgan) va qayerda: menyuda, sarguzashtda
  yoki Abadiyat olamida. Oflayn bo'lsa — qachon ko'rilgani.
- **YONIGA KIRISH:** do'st olamda bo'lsa — uning xonasiga, aynan uning yoniga (xona to'la bo'lsa —
  boshqa xonaga va xabar). Xona kodi faqat do'stlarga ko'rinadi.
- **Bloklash va o'chirish:** bloklangan o'yinchi so'rov ham, xabar ham yubora olmaydi (unga
  "topilmadi" deb ko'rinadi).
- **Tez xabar:** faqat do'stlar o'rtasida, faqat tayyor iboralar (erkin matn yo'q): "Salom!",
  "Olamga kel!", "Yordam kerak!", "Rahmat!", "Zo'r o'yin!", "Kul qirolini birga yengamizmi?",
  "Hozir bandman, keyinroq", "Xayr!". Olamda — o'yin ichida, menyuda — yuqorida yozuv.

Onlayn holat daqiqada bir (va o'zgarganda) yuboriladi; serverga faqat o'zgarganda yoki 3
daqiqada bir yoziladi. Ilova yopilsa yoki fonga o'tsa — darhol "oflayn".

## Reyting

Haftalik (har **dushanba 00:00, Toshkent vaqti** bilan yangilanadi) va umumiy. Faqat kirgan
o'yinchilar qatnashadi; ko'rish — hamma uchun. Top-50 va o'yinchining o'z o'rni.

| Jadval             | Natija                                                                       |
| ------------------ | ---------------------------------------------------------------------------- |
| 1-DUNYO (qahramon) | 1-dunyodan boshlangan o'yinning 1-dunyo ochkosi (o'lim yoki Iblis g'alabasi) |
| CHEKSIZ            | cheksiz rejim ochkosi (qaysi qahramon bilan — belgisi)                       |
| KUNLIK             | kunlik sinov ochkosi; **bir kunda bitta urinish** (server ham tekshiradi)    |
| KUL QIROLI         | eng tez yenggan jamoa — vaqtni **olam serveri** yuboradi, klient emas        |

Firibgarlikka qarshi (`src/account/scoring.ts`): imkonsiz natija rad etiladi — 1-dunyo ochkosi
12 000 dan yoki 2 000 + 100×soniya dan katta, 30 soniyadan tez g'alaba, cheksiz rejimda to'lqin
soniga nisbatan imkonsiz ochko yoki vaqt; Kul qiroli 10 soniyadan tez. Shubhali natija (chegaraga
yaqin, juda tez g'alaba) saqlanadi, lekin reytingda **yashirin** — o'yinchining o'ziga
"tekshiruvda" deb ko'rinadi. Internet yo'q bo'lsa natija qurilmada navbatda turadi.

## Gildiyalar

Kirgan o'yinchilar gildiya tuzadi (500 oltin) yoki qo'shiladi: rollar, qo'shilish usullari, gerb,
24 soatlik cheklov — batafsil [docs/guilds.md](guilds.md).

## Maxfiylik va akkauntni o'chirish

Serverda faqat: Telegram ID, taxallus, avatar, progress (va 5 ta zaxira), do'stlar, xabarlar
(yetkazilgach o'chadi), onlayn holat, reyting va gildiya ma'lumotlari (a'zolik va rol, arizalar,
xazina va topshiriq hissalari, jurnal, gildiya chati — faqat gildiya a'zolariga ko'rinadi, har
gildiyada oxirgi 100 ta xabar). Telefon raqami, ism, rasm saqlanmaydi. Batafsil —
`public/privacy.html` (saytda `privacy.html`).

Profil → **Akkauntni o'chirish** (taxallusni yozib tasdiqlanadi): serverdagi hamma narsa darhol
o'chadi (`account/delete`), sessiya ham — gildiya a'zoligi, hissalar va chatdagi xabarlar ham
(rahbarlik o'rinbosarga yoki eng eski a'zoga o'tadi, yolg'iz bo'lsa gildiya tarqaladi).
Qurilmadagi progress qoladi — mehmon sifatida davom etiladi. Shu Telegram bilan qayta kirilsa —
yangi, bo'sh akkaunt.

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

`.dev.vars` git'ga kirmaydi. Serversiz ko'rish (skrinshotlar ham shu bilan olinadi): `bun run dev`
da konsolda `await window.__accountDemo()` — soxta akkaunt, do'stlar va reyting
(`{ pending: true }` — bot kodi kutilayotgan holat). Haqiqiy serverga hech narsa yuborilmaydi. Haqiqiy Telegram bo'lmasa, bot tasdig'ini webhook'ga o'zingiz
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
| Bulut belgisi sariq yoki kulrang              | o'zgarish yuborilmoqda yoki internet yo'q — progress qurilmada, ulanganda o'zi yuboriladi.       |
| "Bulutga saqlanmadi: imkonsiz qiymat"         | oltin/rekord/XP chegaradan tashqari (qo'lda o'zgartirilgan). Profil → BULUT → zaxiradan tiklang. |
| Boshqa qurilmadagi progress ko'rinmaydi       | menyuga qayting yoki ilovani qayta oching (o'yin paytida yangilanmaydi); Profil → HOZIR SAQLASH. |
| Do'st "Oflayn", lekin o'ynayapti              | holat daqiqada bir yuboriladi — 5 daqiqagacha kechikishi mumkin, yoki u akkauntdan chiqqan.      |
| "YONIGA KIRISH" yo'q                          | do'st olamda emas yoki olamda internetsiz (oflayn) o'ynayapti.                                   |
| Natija reytingda yo'q                         | mehmon rejimida natija yuborilmaydi; kunlik sinov — kuniga bitta; shubhali natija "tekshiruvda". |
