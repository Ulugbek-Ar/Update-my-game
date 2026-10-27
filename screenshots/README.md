# Telegram post skrinshotlari

Har bir yangi versiya uchun `v<VERSIYA>.json` fayl yarating (masalan `v1.5.0.json`).
GitHub Actions o'yinni shu ssenariy bo'yicha ochib, har bir sahnani alohida suratga oladi
va kanalga albom qilib joylaydi. Har bir yangilik — alohida sahna.

Sahna maydonlari:
- `title` — rasm nomi (postda "📸 Rasmlarda" ro'yxatida chiqadi)
- `target` — `"canvas"` (standart, faqat o'yin maydoni) yoki `"screen"` (menyu/oynalar bilan)
- `steps` — ketma-ket qadamlar:
  - `{ "storage": { "kalit": "qiymat" } }` — sahifa ochilishidan oldin localStorage
  - `{ "click": "TUGMA MATNI" }` — menyudagi tugmani bosish
  - `{ "start": true }` — BOSHLASH
  - `{ "wave": 5 }` — kerakli to'lqinga o'tish (0 = 1-to'lqin, 4 = Boss)
  - `{ "spawn": { "kind": "archer", "dx": 120, "dy": 0, "count": 1 } }` — xonani tozalab, faqat shu dushmanni
    o'yinchi yonida chiqaradi (o'yinchi jon yo'qotmaydi). Avval `start` va `wave` bo'lishi kerak.
  - `{ "eval": "JS kod" }` — `g` (Game obyekti) bilan sahnani sozlash
  - `{ "keys": [["d", 600], "Space"] }` — tugma bosib turish / bosish
  - `{ "play": true }` — biroz o'ynash (yurish + zarba)
  - `{ "wait": 500 }` — kutish (ms)

## Yangi dushman (mob)

Yangi mob qo'shilsa, unga alohida sahna yozing — u **alohida post** bo'lib, animatsiyali video bilan chiqadi:

```json
{
  "title": "Kamonchi skelet",
  "text": "Nima qiladi, qanday kurashish kerak, joni nechta.",
  "mob": true,
  "video": 5,
  "steps": [{ "start": true }, { "wave": 0 }, { "spawn": { "kind": "archer", "dx": 120 } }]
}
```

- `mob: true` — alohida post ("👾 Yangi dushman: ...")
- `video: 5` — rasm o'rniga 5 soniyalik video (yurishi, hujumi ko'rinadi)
- `text` — mob haqida tavsif (o'zbekcha)

Namuna: `v1.2.0.json`.

## Yangi qahramon (o'ynaladigan personaj)

Yangi qahramon qo'shilsa (masalan, Sehrgar) — `"hero": true` sahna yozing. U ham **alohida post**
("🧙 Yangi qahramon: ...") bo'lib chiqadi, videoda qahramon o'zi dushmanlarga hujum qiladi (avto-o'yin):

```json
{
  "title": "Sehrgar",
  "text": "Qanday hujum qiladi, qanday kuchlari bor, kimga mos.",
  "hero": true,
  "video": 6,
  "steps": [
    { "click": "SEHRGAR" },
    { "start": true },
    { "wave": 0 },
    { "spawn": { "kind": "blob", "count": 3, "dx": 70 } }
  ]
}
```

Qahramonni tanlash qadami (`click` yoki `eval`) o'yinda qanday tanlanishiga qarab yoziladi.
Videoda bot dushmanlarga qarab yuradi va Space bilan hujum qiladi.

Qo'lda olingan rasmlarni `v<VERSIYA>/` papkasiga qo'ysangiz, ular albom boshida chiqadi.
