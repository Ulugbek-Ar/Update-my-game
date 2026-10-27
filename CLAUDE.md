@AGENTS.md

## Versiya chiqarish (Telegram kanal posti)

Har bir yangi versiyada (`src/game/version.ts` dagi `GAME_VERSION` o'zgarganda) GitHub Actions kanalga avtomatik post joylaydi. Versiyani oshirganda:

1. `GAME_VERSION` ni yangila va `CHANGELOG` ning eng tepasiga yozuv qo'sh (o'zbekcha, har bir gap nuqta bilan tugasin — har biri postda alohida qator bo'ladi).
2. `screenshots/v<VERSIYA>.json` ssenariy faylini yarat: shu versiyadagi **har bir yangilik uchun alohida sahna**, yangi narsa rasmda aniq ko'rinadigan qilib (kerakli to'lqinga o'tish, `eval` bilan sahnani sozlash, kerakli oynani ochish). Format: `screenshots/README.md`, namuna: `screenshots/v1.4.0.json`. Ko'pi bilan 9 ta sahna.
3. Sinash: `bun run dev` dan keyin `PW_DIR=<playwright o'rnatilgan papka> node scripts/screenshot.mjs` — rasmlar `shots/` ga tushadi.
