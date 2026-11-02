# Muallif (admin) paneli va sovg'alar

O'yin muallifi uchun: progressni sinash vositalari va o'yinchilarga sovg'a yuborish. Panel faqat
**serverda** tekshiriladigan Telegram ID'lar ro'yxatidagi akkauntlarga ochiladi.

## Admin qanday tayinlanadi

1. O'z Telegram ID'ingizni bilib oling (masalan, [@userinfobot](https://t.me/userinfobot) — `Id:`
   raqami). Bir nechta muallif bo'lsa — hammasining ID'si.
2. GitHub: **Settings → Secrets and variables → Actions → New repository secret**:
   - nomi: `ADMIN_TELEGRAM_IDS`
   - qiymati: ID'lar vergul bilan, masalan `123456789` yoki `123456789,987654321`
3. Server deploy'ini ishga tushiring (**Actions → Server → Run workflow**, yoki `server/`,
   `src/account/` o'zgarganda o'zi). Workflow qiymatni serverga `wrangler secret put
ADMIN_TELEGRAM_IDS` bilan beradi — u kodda ham, `wrangler.toml`'da ham yo'q.
4. O'yinda Telegram bilan kiring → **Profil** → **MUALLIF PANELI**.

Qoidalar:

- Huquq faqat serverda, har so'rovda tekshiriladi. Klientdagi flag yoki `localStorage`ni
  o'zgartirish hech narsa bermaydi: oddiy o'yinchining admin so'rovi rad etiladi (`perm`) va
  jurnalga "RAD ETILDI" bo'lib yoziladi (server logida ham).
- `ADMIN_TELEGRAM_IDS` bo'sh yoki berilmagan bo'lsa — **hech kim admin emas**.
- Adminlikni olib tashlash: secret'dan ID'ni o'chirib, deploy'ni qayta ishga tushiring.
- Lokal sinov: `server/.dev.vars` faylida `ADMIN_TELEGRAM_IDS=123456789` (git'ga kirmaydi).

## Panel imkoniyatlari

**OCHISH** (o'zingizning progressingiz; server bulutdagi nusxani o'zgartiradi, oldingisi bulut
zaxirasiga tushadi — Profil → BULUT):

- **HAMMASINI OCHISH** — barcha qahramonlar, do'kon kuchaytirishlari maksimal, uch dunyo va
  bosslar yengilgan, olam kalitlari (darvozalar va hududlar), olamdagi sirlar (olamga bir marta
  kirilgan bo'lsa), barcha yutuqlar, 50-daraja va kamida 99 999 oltin. Ro'yxatlar koddan dinamik
  olinadi — yangi versiyadan keyin qayta bossangiz, yangi qo'shilgan qahramon va yutuqlar ham
  ochiladi. Rekordlar va olam inventari o'chmaydi.
- Oltin qo'shish (manfiy — ayirish), darajani o'rnatish, XP berish.
- Qahramonni ochish/yopish (bepul qahramonlar doim ochiq).
- Kunlik sovg'ani tiklash.
- Istalgan dunyo va to'lqindan (yoki bossdan) boshlash.
- **Progressni nolga qaytarish** — ikki bosqichli tasdiq (2-bosqichda `NOL` deb yoziladi): yangi
  o'yinchi tajribasini sinash uchun.

**GILDIYA**: test gildiyasi tuzish (oltin talab qilinmaydi), o'z gildiyangiz darajasini (1–10)
o'rnatish.

**JURNAL**: barcha admin amallari (vaqt, amal, kimga, tafsilot) va rad etilgan urinishlar.

Adolat uchun muallif akkaunti:

- ismi yonida **MUALLIF** belgisi (profil, do'stlar, gildiya a'zolari, sovg'a oynasi);
- **reytingda va gildiyalar reytingida qatnashmaydi** — natijalari yozilmaydi (panel ochilganda
  oldingi natijalari ham o'chiriladi);
- haftalik gildiya topshiriqlariga hissasi hisoblanmaydi;
- ekspeditsiya muallifda ham ishlaydi, reytingga ta'siri yo'q.

## Sovg'a yuborish

Panel → **SOVG'A**:

1. O'yinchini **taxallus** (yoki boshi) yoki **do'st kodi** bo'yicha qidiring — natijada ismi,
   darajasi, avatari va do'st kodi ko'rinadi (adashmaslik uchun). **TANLASH**.
2. Sovg'a: oltin (istalgan miqdor), XP, qahramon (faqat u hali ochmaganlaridan) va ixtiyoriy xat
   (ko'pi bilan 120 belgi).
3. **YUBORISH** → tasdiqlash oynasi, masalan: `Ulugbek → Dilnoza: 500 oltin + qahramon PALADIN + xat`
   → **HA, YUBORISH**.

Mehmon (akkauntsiz) o'yinchi serverda yo'q — unga sovg'a yuborib bo'lmaydi; u avval menyudagi
"KIRISH" orqali Telegram bilan akkaunt ochishi kerak.

Pastda — **Yuborilgan sovg'alar**: kimga, nima, qachon va olindimi.

Qabul qiluvchida: o'yinga kirganda (onlayn bo'lsa — bir daqiqa ichida) **"Sovg'a keldi!"**
oynasi — kimdan (MUALLIF belgisi bilan), nima, xat va **OLISH**. Olinganda oltin tanga yomg'iri
bilan, qahramon nur ichida paydo bo'ladi. Bosh menyuda sovg'a kutayotgan bo'lsa — "SOVG'A QUTISI"
belgisi. Sovg'ani server bulutdagi progressga yozadi: bir marta olinadi, qurilma almashsa ham
yo'qolmaydi. Har sovg'a jurnalga yoziladi.

## Texnik

- So'rovlar: `admin/*` (src/account/server/adminApi.ts), `gifts/list`, `gifts/claim`.
- Jadvallar: `admin_log`, `gifts`, `expeditions` (src/account/server/db.ts).
- Progressni o'zgartiruvchi amallar `base` (klientdagi bulut versiyasi) bilan: klient avval
  saqlaydi, server nusxani o'zgartiradi va qaytaradi (`cloud.mutate`).
- Testlar: `src/account/server/admin.test.ts`, `src/account/gifts.test.ts`.
