# Til tanlash (i18n) — ish holati

Vazifa: o'zbek (asosiy), rus, ingliz. Tizim: `src/i18n/` (uz.ts — asosiy kalitlar; ru.ts/en.ts — `Record<Key,string>`;
`t("kalit", {n})`, `tk()` dinamik kalit, `useLang()` — src/i18n/react.ts). Saqlanadi: `pixel-rpg-lang` (bulutga ham kiradi).
Test: src/i18n/i18n.test.ts (kalitlar va {o'rinlar} uch tilda bir xil).

- [x] TIZIM: i18n, avtomatik aniqlash, Sozlamalar → "Til / Язык / Language"
- [x] 1-BOSQICH: qahramonlar, rollar, superlar, kuch kartalari, sinergiya, artefaktlar, sensor tugmalar, game.ts (HUD, pauza, o'lim/g'alaba, bannerlar, boss kartalari), bosh menyu, do'kon (skinlar bilan), sozlamalar (boshqaruv, klaviatura, joylashuv, ko'chirish), xarita, yangi daraja. Telefon 915x412 ru skrinshot — sig'adi.
  - skrinshot skriptlari (scripts/*.mjs) locale "uz-UZ" — postlar o'zbekcha qoladi
  - yordamchi: kalit qo'shish — src/i18n/uz.ts ga, ru.ts/en.ts ga ham (test tekshiradi); modul darajasidagi jadvallarda `get name() { return t(...) }`
- [x] 2-BOSQICH: yutuqlar, kunlik sovg'a, sovg'a qutisi, do'st chaqirish (FriendsWindow: CHAQIRISH + tablar, ulashish matni), server xatolari (api.ts ERROR_TEXT), xonaga kirish, chiqish, yangiliklar oynasi (CHANGELOG o'zbekcha qoladi), AI maslahatchi (javob tanlangan tilda), boss nomlari, pixelfx yozuvi, yangilanish banneri. Telefon ru skrinshot — sig'adi.
- [x] 3-BOSQICH: onlayn olam interfeysi (render.ts, client.ts, sim.ts xabarlari, moblar, reyd, ulanish xatolari, olam tugmalari), topshiriqlar va dialoglar: src/realm/data JSON o'zbekcha qoladi, tarjima — src/i18n/realm.ts (o'zbekcha matn → [rus, ingliz]); klient loadRealmData(getLang()) bilan yuklaydi, server o'zbekcha nusxada. Test: har bir JSON matni uch tilda. Telefon ru skrinshot — sig'adi.

Qolgan (bosqichlarga kirmagan, ixtiyoriy): FriendsWindow (ro'yxat/so'rovlar ichi), GuildWindow, LeaderboardWindow, ProfileWindow, LoginWindow, MigrateWindow, ExpeditionWindow, Admin* (muallif uchun — o'zbekcha qolishi mumkin).
