# Til tanlash (i18n) — ish holati

Vazifa: o'zbek (asosiy), rus, ingliz. Tizim: `src/i18n/` (uz.ts — asosiy kalitlar; ru.ts/en.ts — `Record<Key,string>`;
`t("kalit", {n})`, `tk()` dinamik kalit, `useLang()` — src/i18n/react.ts). Saqlanadi: `pixel-rpg-lang` (bulutga ham kiradi).
Test: src/i18n/i18n.test.ts (kalitlar va {o'rinlar} uch tilda bir xil).

- [x] TIZIM: i18n, avtomatik aniqlash, Sozlamalar → "Til / Язык / Language"
- [x] 1-BOSQICH: qahramonlar, rollar, superlar, kuch kartalari, sinergiya, artefaktlar, sensor tugmalar, game.ts (HUD, pauza, o'lim/g'alaba, bannerlar, boss kartalari), bosh menyu, do'kon (skinlar bilan), sozlamalar (boshqaruv, klaviatura, joylashuv, ko'chirish), xarita, yangi daraja. Telefon 915x412 ru skrinshot — sig'adi.
  - skrinshot skriptlari (scripts/*.mjs) locale "uz-UZ" — postlar o'zbekcha qoladi
  - yordamchi: kalit qo'shish — src/i18n/uz.ts ga, ru.ts/en.ts ga ham (test tekshiradi); modul darajasidagi jadvallarda `get name() { return t(...) }`
- [ ] 2-BOSQICH (keyingi): yutuqlar, NewsWindow/ChangelogWindow sarlavhasi, CoachPanel, JoinRoomWindow, ExitWindow, Friends/Guild/Leaderboard/Profile/Login oynalari;, kunlik sinov, sovg'alar, do'st chaqirish, bosslar, maslahatlar, pixelfx yozuvi
- [ ] 3-BOSQICH: onlayn olam interfeysi, topshiriqlar, dialoglar (src/realm/data)
