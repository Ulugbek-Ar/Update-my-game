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
  - `{ "eval": "JS kod" }` — `g` (Game obyekti) bilan sahnani sozlash
  - `{ "keys": [["d", 600], "Space"] }` — tugma bosib turish / bosish
  - `{ "play": true }` — biroz o'ynash (yurish + zarba)
  - `{ "wait": 500 }` — kutish (ms)

Qo'lda olingan rasmlarni `v<VERSIYA>/` papkasiga qo'ysangiz, ular albom boshida chiqadi.
