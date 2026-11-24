# Piksel Qal'a — arxitektura (tez kirish)

Keyingi sessiya uchun xarita: qaysi narsa qaysi faylda va yangi narsa qanday qo'shiladi.
Fayllarni to'liq o'qima — har faylning boshidagi izoh (o'zbekcha) uning vazifasini aytadi.
Rejalar va qarorlar: `docs/ROADMAP.md`. Versiya va kanal posti qoidasi: `CLAUDE.md`.

## Papkalar

| Papka                  | Vazifasi                                                                                                                                                                                                                                  |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/game/`            | Oflayn o'yin: oddiy TS klasslar (Game sikl va holatga ega). React faqat kanvas va menyuni o'rnatadi. Sprayt, portret, effekt — hammasi kod bilan chiziladi.                                                                               |
| `src/realm/`           | "Abadiyat olami" — onlayn ochiq olam. `sim.ts` (mantiq, DOM'siz, 20 Hz), `render.ts` (chizish), `client.ts` (klient), `src/realm/net/` (protokol, xona, bashorat), `src/realm/data/` (hudud JSON'lari, `schema.ts` zod bilan tekshiradi). |
| `src/account/`         | Akkaunt, bulutli saqlash, do'stlar, gildiya, ekspeditsiya, sovg'alar, XP. `src/account/server/` — server tomoni mantiq (Worker ishlatadi).                                                                                                |
| `src/i18n/`            | Uch til: `uz.ts` (asosiy, kalitlar manbai), `ru.ts`, `en.ts`; `index.ts` — `t()`; `realm.ts` — olam JSON matnlari tarjimasi.                                                                                                              |
| `src/lib/`             | Platforma yordamchilari: `apk.ts` (APK qoidasi), `pcfiles.ts`, `update.ts`, `native.ts` (Capacitor), `telegram.ts`, `desktop.ts`.                                                                                                         |
| `src/vendor/pixelfx/`  | Tashqi pixelfx kutubxonasi (MIT, `NOTICE.md`). O'zgartirilmaydi — `src/game/pixelFx.ts` orqali ishlatiladi.                                                                                                                               |
| `src/components/game/` | React oynalari: do'kon (`SkinsShop.tsx`), profil, gildiya, do'stlar, sozlamalar, `TouchControls.tsx`.                                                                                                                                     |
| `src/routes/index.tsx` | Bosh sahifa: menyu, qahramon tanlash, o'yinni o'rnatish.                                                                                                                                                                                  |
| `server/`              | Cloudflare Worker (`server/src/index.ts`) + Durable Object'lar: `room-do.ts` (olam xonasi), `hall-do.ts`, `lobby-do.ts`, `account-do.ts`. Tafsilot: `docs/server.md`.                                                                     |
| `scripts/`             | Build va kanal: `screenshot.mjs`, `vertical.mjs`, `telegram-post.mjs`, `telegram-apk.mjs`, `telegram-pc.mjs`, `make-icons.mjs`, `build-portable.mjs`, `pack-windows.mjs`, `store-graphics.mjs`.                                           |
| `android/`             | Capacitor Android loyihasi (`docs/apk.md`, `docs/play-market.md`).                                                                                                                                                                        |
| `src-tauri/`           | Windows dasturi (Tauri) — `docs/windows.md`.                                                                                                                                                                                              |
| `screenshots/`         | Har versiya uchun kanal posti ssenariysi `v<VERSIYA>.json` (format: `screenshots/README.md`).                                                                                                                                             |
| `docs/icon/`           | Ilova ikonkasi variantlari va izoh (`docs/icon/README.md`).                                                                                                                                                                               |
| `.github/workflows/`   | `pages.yml` (sayt), `telegram-post.yml` (kanal posti), `android.yml`, `windows.yml`, `server.yml`.                                                                                                                                        |
| `store/`               | Play Market grafikasi va skrinshotlari.                                                                                                                                                                                                   |

## Asosiy tizimlar

- **O'yin sikli:** `src/game/game.ts` — to'lqinlar, kartalar, boss, HUD, superlar, artefaktlar. Juda katta — `grep` bilan qidir.
- **Qahramonlar:** `src/game/hero.ts` (`Hero` turi, `HERO_LIST`/`HEROES` ro'yxati, `HERO_THEME`), `src/game/player.ts` (jon, tezlik, hujum, dash — har qahramon `hero === "..."` shoxlari). `heroCompat.ts` — eski klientlar uchun qahramonlar versiyasi. `heroAnim.ts` — faqat vizual qatlam.
- **Spraytlar:** `src/game/sprites.ts` (`SpriteKind`, `PALETTES`, pozalar); yangi qahramonlar alohida faylda: `shinobiSprites.ts`, `priestessSprites.ts`, `wolfSprites.ts`. Vizual o'lcham to'qnashuv o'lchamidan mustaqil.
- **Dushmanlar:** `src/game/enemy.ts` (`EnemyKind`, `ENEMY_HP`, `ENEMY_SPRITE`, xatti-harakat), `mobAnim.ts` (vizual).
- **Bosslar:** `src/game/boss.ts` (Iblis `Boss`, `Queen`, `ForestKing`), `src/game/oni.ts` (Sakura bossi), `src/game/bossPower.ts` (jonni o'yinchi kuchiga moslash, fazalar, g'azab taymeri).
- **Superlar:** `src/game/super.ts` (`SuperDef`, `SUPERS`, `SuperMeter`, `SuperCast`), `superScene.ts` (`SUPER_SCENES` — `fx` nomi bo'yicha sahna), `superFx.ts` (super shari, umumiy chizmalar). Har superning sahnasi: `divineFx.ts`, `lotusFx.ts`, `frenzyFx.ts`, `meteorFx.ts`, `stormFx.ts`, `arrowsFx.ts`, `cutsFx.ts`, `horizonFx.ts`, `howlFx.ts`.
- **Portretlar (cut-in, 96x96):** `src/game/portrait.ts` (`portraitGrid`, `portraitColors`, `portraitPixels`, `PORTRAIT_FRAMES`, `SKIN_TINTS`, `BASE_COLORS`), `portraitKit.ts` (umumiy soyalash). Har qahramon: `knightPortrait.ts`, `magePortrait.ts`, `hunterPortrait.ts`, `gunnerPortrait.ts`, `paladinPortrait.ts`, `samuraiPortrait.ts`, `shinobiPortrait.ts`, `priestessPortrait.ts`, `wolfPortrait.ts`.
- **Skinlar:** `src/game/skins.ts` (`SKINS`, `THEMES`, narxlar, `REWARD_SKINS`), `skinFx.ts` (theme, zarracha, ovoz — kuch bermaydi), `skinDemo.ts` (do'kondagi jonli preview).
- **To'lqinlar va kartalar:** `src/game/waves.ts` (`WORLD_KINDS`, `WAVES*`, `UPGRADES`, qahramon kartalari), `src/game/synergy.ts` (teglar, sinergiyalar, `HERO_TAG`).
- **Xavf ranglari:** `src/game/danger.ts` — dushman ogohlantirish zonalari; skin effektlari ularga o'xshamasligi kerak (test).
- **pixelfx effektlari:** `src/game/pixelFx.ts` (zarba, o'lim, terish, boss paydo/faza/o'lim).
- **Boshqa:** `artifacts.ts`, `achievements.ts`, `shop.ts`, `map.ts` (dunyo xaritasi), `menuScene.ts`, `threat.ts` (aggro), `golden.ts` + `golden-numbers.json` (balans nusxasi — raqam o'zgarsa test qizaradi), `audio.ts`, `version.ts` (`GAME_VERSION`, `CHANGELOG`).
- **Sensor boshqaruv:** `src/components/game/TouchControls.tsx` + `src/game/touchLayout.ts` (sof hisob, test qilinadi).
- **Saqlash:** `localStorage` `pixel-rpg-*` kalitlari; `src/game/save.ts` (migratsiya — eski kalit o'chirilmaydi), `src/game/transfer.ts` (ko'chirish kodi), `src/account/cloud.ts` (bulut). `docs/accounts.md`.
- **Onlayn olam:** `src/realm/sim.ts` (serverda ham shu klass), `src/realm/supers.ts` (olamdagi superlar, faqat PvE), `src/realm/superView.ts` (klientda super sahnasi), `src/realm/render.ts`, `src/realm/mobs.ts`, `src/realm/raid.ts` (Kul Qiroli), `src/realm/net/room.ts` + `src/realm/net/protocol.ts`, `src/realm/net/mirror.ts`.
- **Do'st chaqirish:** `src/account/referral.ts` (klient), `src/account/server/referrals.ts` (hisob/mukofot), `src/lib/telegram.ts`; mukofot skini `REFERRAL_SKIN` (`skins.ts`). `docs/referrals.md`.
- **Kanal va APK:** `src/lib/apk.ts` (`isApkRelease`: x.y.0 va y 10 ga karrali), `scripts/telegram-post.mjs`, `scripts/telegram-apk.mjs`, `.github/workflows/telegram-post.yml`. `docs/apk.md`, `docs/windows.md`.
- **Skrinshot/video:** `scripts/screenshot.mjs` (`screenshots/v*.json` ni o'ynaydi, `shots/` ga yozadi, `shots/` gitignore'da; `src/game/screenshots.test.ts` ssenariylarni tekshiradi), `scripts/vertical.mjs` (TikTok/Shorts uchun 1080x1920 video).
- **Ikonka:** `scripts/make-icons.mjs` (portal-arka, har o'lcham o'z to'rida).

## QANDAY QO'SHILADI

Har retseptdan keyin: `npm run lint`, `npx vitest run`. Grep yo'riqnomasi: eng yangi namunani
`grep -rn '"wolf"\|wolf' src --include=*.ts --include=*.tsx | grep -v test` bilan top va shu
joylarning hammasiga yangi narsani qo'sh.

### Qahramon (namuna: "wolf" va "priestess")

1. `src/game/hero.ts` — `Hero` turiga id, `HERO_THEME`, `HERO_LIST` yozuvi (rol, nom, tavsif kalitlari).
2. `src/game/player.ts` — jon, tezlik, hujum/kuchli/dash shoxlari; `src/game/synergy.ts` `HERO_TAG`.
3. Sprayt: `src/game/<id>Sprites.ts` (namuna `wolfSprites.ts`) va `sprites.ts` dagi `SpriteKind`, `PALETTES`, ulash joylari.
4. Effektlar: `src/game/<id>Fx.ts` (namuna `wolfFx.ts`); onlayn olam: `src/realm/sim.ts`, `src/realm/net/mirror.ts`, `src/realm/render.ts`, `src/realm/net/protocol.ts`, `src/realm/net/room.ts`, `src/account/protocol.ts`.
5. `src/game/heroCompat.ts` — qahramonlar versiyasini +1.
6. Kartalar `waves.ts` (`up.*.<id>.*` kalitlari), do'kon `shop.ts`, `progress.ts`, `achievements.ts`, `touchLayout.ts`, `menuScene.ts`, `map.ts`, `skinDemo.ts`, `src/routes/index.tsx`, `src/components/game/SkinsShop.tsx`.
7. 3 ta skin (pastdagi retsept), super va portret (pastdagi retsept).
8. i18n: `hero.<id>.name/desc`, `g.ctl.<id>`, `g.kb.<id>` — uch tilda. `screenshots/v<VERSIYA>.json` da `"hero": true` sahna.

### Mob

1. `src/game/enemy.ts` — `EnemyKind`, `ENEMY_HP`, `ENEMY_SPRITE`, konstantalar va xatti-harakat (namuna: `kitsune`).
2. Sprayt: `sprites.ts` (Sakura moblari — `sakuraSprites.ts`); ogohlantirish rangi `danger.ts` ga.
3. `waves.ts` — `WORLD_KINDS` va `WAVES*`; `golden-numbers.json` yangilanadi (faqat yangi mob qo'shilsa).
4. i18n nomi, `shop.ts`/`src/lib/coach.functions.ts` agar mob ro'yxati bo'lsa. Skrinshot: `"mob": true` sahna.

### Boss hujumi

1. Boss klassida (`boss.ts` yoki `oni.ts`) konstantalar (`*_EVERY`, `*_WARN`) + taymer + chizish.
2. Ogohlantirish zonasi rangi `danger.ts` ga (skin ranglaridan uzoq bo'lsin — test).
3. Fazaga bog'lansa — `bossPower.ts`. Jang 160 s dan oshmasin (`boss-playthrough.test.ts`).

### Super

1. `src/game/super.ts` — `SuperDef` (`id`, `hero`, `fx`, ovozlar `SuperSound`), `SUPERS` ga qo'sh.
2. Sahna: `src/game/<nom>Fx.ts` (namuna `howlFx.ts`) va `superScene.ts` `SUPER_SCENES` ga ulash.
3. **Portret:** `src/game/<id>Portrait.ts` (namuna `wolfPortrait.ts`) → `portrait.ts` ga ulash: import, `portraitGrid`, `BASE_COLORS`, `portraitPixels`, `*_PORTRAIT_VARIANTS`, `PORTRAIT_FRAMES`.
4. **Skin ranglari:** `portrait.ts` `SKIN_TINTS` ga qahramon guruhlari (mato/aksent skin rangiga bo'yaladi; teri, ko'z, kontur qoladi) — `portraitSkin.test.ts`.
5. Onlayn: `src/realm/supers.ts`, `src/realm/superView.ts`. i18n: `super.<id>.name/desc`.

### Skin

1. `src/game/skins.ts` — qahramonga 3 ta skin (`<qahramon>-<nom>`, narxlar `SKIN_PRICES`), `THEMES` ga theme qatori, afsonaviy skinga `fx`.
2. Ranglar `danger.ts` ga o'xshamasin. Skin KUCH BERMAYDI (`skins.test.ts`, `skinFx.test.ts`).
3. Portret skin rangini `SKIN_TINTS` orqali oladi — yangi qahramonda guruhlarni tekshir.

### Kuch kartasi

1. `src/game/waves.ts` `UPGRADES` — `id`, `tags` (bitta teg, `synergy.ts`), `apply`, `ok`, qahramon kartalari (`mage`, `hunter`, ...).
2. Ikonka (`upgradeIcon`), i18n `up.<id>.name/desc` (va `up.<id>.<qahramon>.*`).

### Yangi til kaliti

1. `src/i18n/uz.ts` ga kalit (asosiy manba), so'ng **aynan shu kalit** `ru.ts` va `en.ts` ga.
2. `{n}` kabi o'rinlar uch tilda bir xil bo'lsin — `src/i18n/i18n.test.ts` tekshiradi.
3. Olam JSON matni bo'lsa — `src/i18n/realm.ts` ga tarjima.

## Buyruqlar

| Buyruq                                       | Nima qiladi                                                          |
| -------------------------------------------- | -------------------------------------------------------------------- |
| `bun run dev`                                | Lokal sayt (Vite).                                                   |
| `npm run lint`                               | ESLint — commit'dan oldin toza bo'lsin.                              |
| `npx vitest run`                             | Hamma testlar (bitta fayl: `npx vitest run src/game/skins.test.ts`). |
| `npm run build:app` + `npx cap sync android` | Android build'ni tekshirish (`docs/apk.md`).                         |
| `npm run build:portable`                     | Portativ HTML / Windows (`docs/windows.md`).                         |
| `PW_DIR=<papka> node scripts/screenshot.mjs` | Versiya ssenariysini suratga olish → `shots/`.                       |
| `node scripts/make-icons.mjs`                | Ilova ikonkalarini qayta chizish.                                    |

## Buzilmasligi kerak (testlar qo'riqlaydi)

- **Balans:** `src/game/golden-numbers.json` + `src/game/animations.test.ts` — hujum vaqti, tezlik,
  dash, cooldown, to'qnashuv yoki kadr vaqti o'zgarsa qizaradi. Vizual o'zgarish raqamga tegmasin.
- **Skin kuch bermaydi:** `src/game/skins.test.ts`, `src/game/skinFx.test.ts`.
- **Xavf ranglari:** skin effektlari `danger.ts` ranglaridan uzoq (`src/game/skinFx.test.ts`).
- **Portret skin ranglari:** `src/game/portraitSkin.test.ts`.
- **Boss jangi ≤ 160 s:** `src/game/boss-playthrough.test.ts`.
- **Ssenariylar:** `src/game/screenshots.test.ts` — `screenshots/v*.json` formati.
- **Tarjima:** `src/i18n/i18n.test.ts` — uch tilda bir xil kalitlar va o'rinlar.
- **Olam determinizmi:** `src/realm/sim.ts` da `Math.random`, `Date.now`, DOM yo'q — server va klient
  bir xil hisoblaydi (`src/realm/rng.ts`). `src/realm/sim.test.ts`, `src/realm/schema.test.ts`.
- **APK qoidasi:** `src/lib/apk.test.ts`.
- **Saqlash:** eski `pixel-rpg-*` kalitlar o'chirilmaydi (`src/game/save.test.ts`, `src/account/migrate.test.ts`).

## Uslub

- Kod izohlari va o'yin matnlari — o'zbekcha; o'yinchi ko'radigan matn faqat `t("kalit")` orqali.
- Rasm fayllari yo'q — sprayt, portret, ikonka, effektlar kod bilan chiziladi; portret/effektda
  `Math.random` ishlatilmaydi (kesh va test uchun bir xil chiqsin).
- Lovable bilan bog'langan: push qilingan tarixni qayta yozma (force push, amend, rebase yo'q).
