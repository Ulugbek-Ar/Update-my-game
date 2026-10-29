@AGENTS.md

## Versiya chiqarish (Telegram kanal posti)

Har bir yangi versiyada (`src/game/version.ts` dagi `GAME_VERSION` o'zgarganda) GitHub Actions kanalga avtomatik post joylaydi. Versiyani oshirganda:

1. `GAME_VERSION` ni yangila va `CHANGELOG` ning eng tepasiga yozuv qo'sh (o'zbekcha, har bir gap nuqta bilan tugasin — har biri postda alohida qator bo'ladi).
2. `screenshots/v<VERSIYA>.json` ssenariy faylini yarat: shu versiyadagi **har bir yangilik uchun alohida sahna**, yangi narsa rasmda aniq ko'rinadigan qilib (kerakli to'lqinga o'tish, `eval` bilan sahnani sozlash, kerakli oynani ochish). Format: `screenshots/README.md`, namuna: `screenshots/v1.4.0.json`. Ko'pi bilan 9 ta sahna.
3. **Yangi dushman (mob) qo'shilgan bo'lsa** — har biri uchun alohida sahna: `"mob": true`, `"video": 5`, `"text"` (nima qiladi, qanday yengiladi, joni), qadamlar: `start` → `wave` → `spawn` (faqat shu mob, animatsiyasi aniq ko'rinsin). Namuna: `screenshots/v1.2.0.json`.
4. **Yangi qahramon (o'ynaladigan personaj) qo'shilgan bo'lsa** — alohida sahna: `"hero": true`, `"video": 6`, `"text"` (hujumi, kuchlari, o'ziga xosligi), qadamlar: qahramonni tanlash (`click`/`eval`) → `start` → `wave` → `spawn` (bir nechta oddiy dushman). Videoda qahramon o'zi jang qiladi. Format: `screenshots/README.md`.
5. **APK:** `GAME_VERSION` x.y.0 bo'lsa (masalan 2.4.0) post bilan birga imzolangan APK ham kanalga yuboriladi; x.y.z (z>0) — faqat post. Tafsilotlar va imzo secrets: `docs/apk.md`. Android build'ga tegishli o'zgarishlar `npm run build:app` va `npx cap sync android` bilan tekshirilsin.
6. Sinash: `bun run dev` dan keyin `PW_DIR=<playwright o'rnatilgan papka> node scripts/screenshot.mjs` — rasmlar `shots/` ga tushadi.
