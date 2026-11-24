# Til tanlash (i18n) — ish holati

Vazifa: o'zbek (asosiy), rus, ingliz. Tizim: `src/i18n/` (uz.ts — asosiy kalitlar; ru.ts/en.ts — `Record<Key,string>`;
`t("kalit", {n})`, `tk()` dinamik kalit, `useLang()` — src/i18n/react.ts). Saqlanadi: `pixel-rpg-lang` (bulutga ham kiradi).
Test: src/i18n/i18n.test.ts (kalitlar va {o'rinlar} uch tilda bir xil).

- [x] TIZIM: i18n, avtomatik aniqlash, Sozlamalar → "Til / Язык / Language"
- [~] 1-BOSQICH (yarim): bosh menyu, sozlamalar, do'kon/skinlar, qahramon tanlash, HUD, pauza, o'lim/g'alaba, kuch kartalari, 7 qahramon + superlar
  - qilingan: qahramonlar, rollar, superlar, kuch kartalari, sinergiya, artefaktlar, sensor tugmalar, game.ts (HUD, pauza, o'lim/g'alaba, bannerlar, bosslar), bosh menyu, do'kon oynasi, sozlamalar (asosiy)
  - qoldi: ControlsSettings/KeyBindsPanel/LayoutEditor/TransferPanel, SkinsShop + skins.ts, map.ts/MapScreen, NewsWindow, LevelUpWindow, TouchControls aria, SuperOrbButton; telefonda ru skrinshot
  - yordamchi: kalit qo'shish — src/i18n/uz.ts ga, ru.ts/en.ts ga ham (test tekshiradi)
- [ ] 2-BOSQICH: yutuqlar, kunlik sinov, sovg'alar, do'st chaqirish, bosslar, maslahatlar, pixelfx yozuvi
- [ ] 3-BOSQICH: onlayn olam interfeysi, topshiriqlar, dialoglar (src/realm/data)
