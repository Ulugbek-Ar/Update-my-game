# Do'st chaqirish

Har akkauntda shaxsiy taklif havolasi bor. Kod — o'yinchining do'st kodi (`players.code`, masalan `K7QW2MXA`).

| Qayerdan     | Havola                                                   |
| ------------ | -------------------------------------------------------- |
| Telegram bot | `https://t.me/<bot>?start=ref_<KOD>`                     |
| Sayt         | `https://ulugbek-ar.github.io/Update-my-game/?ref=<KOD>` |

Menyu → **DO'STLAR** → **CHAQIRISH**: ikkala havola (nusxalash), «TELEGRAM'DA ULASHISH» tugmasi, nechta do'st kelgani,
nechtasi mukofot olgani, navbatdagilar va «Chaqiruvchi» skini holati (`ref/info`).

## Mukofot

- Yangi o'yinchi havola orqali **birinchi marta** akkaunt ochib, akkaunt bilan **1-to'lqinni tugatsa** — ikkalasiga
  100 oltin (`REF_GOLD`). Mukofot sovg'a qutisiga tushadi (`gifts`, `sender = 0`, «Do'st chaqirish»): olinganda server
  o'zi bulutdagi progressga yozadi.
- 5 ta mukofotli do'st (`REF_SKIN_GOAL`) — Ritsar uchun **«Chaqiruvchi»** skini (`knight-caller`). Kuch bermaydi
  (faqat ranglar va oddiy effektlar), do'konda sotilmaydi — `REWARD_SKINS` (src/game/skins.ts). Do'kondagi
  skinlar ro'yxatida qulf bilan «5 DO'ST CHAQIRING» deb ko'rinadi.

## Qanday ishlaydi

1. **Sayt**: `?ref=KOD` ochilganda klient kodni `pixel-rpg-ref` ga yozadi (qurilmaga xos, bulut va ko'chirish
   kodiga kirmaydi; birinchi kod qoladi). Telegram Mini App'da `start_param = ref_KOD` ham olinadi. Kirish
   so'rovlariga (`auth/webapp`, `auth/widget`, `auth/poll`) ixtiyoriy `ref` qo'shiladi, kirgach kod o'chiriladi.
2. **Bot**: `/start ref_KOD` — akkaunt hali yo'q bo'lsa `ref_pending` ga yoziladi (7 kun) va saytga `?ref=KOD` bilan
   havola yuboriladi. Akkaunt qaysi usulda ochilmasin (ilova, sayt, Mini App) — shu Telegram ID bo'yicha bog'lanadi.
3. Akkaunt **yangi yaratilganda** (`ensurePlayer`) `referrals` ga qator yoziladi. Eski akkauntga kirishda `ref`
   e'tiborsiz.
4. Har qabul qilingan `save/put` da: o'yinchining mukofotsiz taklifi bo'lsa va to'lqinlar soni (`pixel-rpg-stats`)
   **oldingi bulut nusxasidan oshgan** bo'lsa — yangi o'yinchiga sovg'a, chaqiruvchiga — kunlik chegara ichida.

## Aldashga qarshi (hammasi serverda — src/account/server/referrals.ts)

- **Bir marta**: `referrals.tg` — kalit (Telegram ID). Akkauntini o'chirib qayta ochgan Telegram ID `ref_seen` da
  qoladi — yangi hisoblanmaydi.
- **O'zini o'zi chaqirib bo'lmaydi**: bir xil o'yinchi yoki bir xil Telegram ID rad etiladi (botda ham).
- **1-to'lqindan keyin**: akkaunt ochilgandagi birinchi yuklash (mehmon progressi) hisoblanmaydi — to'lqin akkaunt
  bilan o'ynalishi kerak. 1-to'lqingacha akkauntini o'chirgan do'st uchun chaqiruvchiga mukofot yo'q.
- **Kunlik chegara**: bitta chaqiruvchiga kuniga ko'pi bilan 10 ta mukofot (`REF_DAILY_CAP`, Toshkent kuni).
  Ortig'i navbatda qoladi va keyingi kunlarda `ref/info` yoki sovg'a qutisi ochilganda beriladi. Yangi o'yinchi
  o'z mukofotini chegaradan qat'i nazar oladi.
- **Skin**: `ref_skin` — bir marta. Saqlanishda «Chaqiruvchi» skini bo'lsa-yu server bermagan bo'lsa — `save/put`
  rad etiladi (`invalid`, `field: "skin"`).

## Eski akkauntlar

Yangi jadvallar (`referrals`, `ref_pending`, `ref_seen`, `ref_skin`) `CREATE TABLE IF NOT EXISTS` — eski ma'lumot
o'zgarmaydi. `ref` maydoni ixtiyoriy — eski klientlar ishlayveradi. Test: `src/account/server/referrals.test.ts`.
