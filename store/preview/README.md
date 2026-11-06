# Ko'rib chiqish: ikonka va boss uslubi variantlari

Faqat tanlash uchun rasmlar. O'yin kodi, joriy ikonkalar (`public/icons`, `android/…/res`,
`store/icon-512.png`) va versiya o'zgarmagan.

Generator: `scripts/preview-variants.mjs` (chizish qismi — `scripts/preview-art.mjs`).
U `sprites.ts` palitralarini (Paladin, Iblis, Ritsar, Sehrgar, Imp, Kamonchi) va `spritePixels()` dan
foydalanadi. Chizish usuli o'yindagidek: butun sonli piksel to'r va siyoh kontur. Palitraning 5 ta asosiy
rangiga shu ranglardan aralashtirilgan oraliq tonlar qo'shilgan.

Qayta yaratish: `bun run dev` (yoki `npx vite dev --host 127.0.0.1 --port 5173`), so'ng
`PW_DIR=<playwright o'rnatilgan papka> node scripts/preview-variants.mjs`.

## Ikonka (512x512, 128x128 piksel to'r, 4x)

Fon: to'q binafsha osmon, oy, yulduzlar va qasr minoralari (menyu sahnasi ranglarida).
Paladin byusti — 64x64 to'rda.

| Fayl                     | Variant                                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------ |
| `icon-1-hozirgi.png`     | 1 — hozirgi uslub: yopiq oltin dubulg'a, ko'z tirqishidan oltin-oq nur chiqadi                   |
| `icon-2-anime.png`       | 2 — anime ruhidagi piksel: yuz ochiq, oltin sochlar, katta porlayotgan moviy ko'zlar             |
| `icon-3-yarim-anime.png` | 3 — yarim-anime: dubulg'aning yuz qalqoni tepaga ko'tarilgan, yuz va katta ko'zlar ko'rinadi     |
| `icon-phone-preview.png` | Uchala variant telefon bosh ekranida, oddiy (brendsiz) ilovalar orasida: 96 px to'r va 48 px dok |

## O'yin ichi: Iblis jangi (320x240 xona, 4x → 1280x960)

Kadr haqiqiy o'yindan olingan: Paladin, Iblis xonasi va HUD. Iblis zarbadan oldin turibdi (qizil
ogohlantirish doirasi bor).

| Fayl                  | Nima                                                                                                                                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `boss-hozirgi.png`    | Hozirgi Iblis sprite'i                                                                                                                                                                                              |
| `boss-anime.png`      | Anime ruhidagi Iblis: tana va bolta o'yindagidek. Boshi yangi: uzun kumush soch, obsidian shoxlar, katta olovli ko'zlar va plash. Hujumdan oldin ekran tepasida portret va "Olov hukmi!" cut-in kartochkasi chiqadi |
| `boss-taqqoslash.png` | Ikkalasi yonma-yon                                                                                                                                                                                                  |

Barcha qahramonlar bu o'yin uchun chizilgan. Boshqa o'yin yoki anime personajidan nusxa olinmagan.
