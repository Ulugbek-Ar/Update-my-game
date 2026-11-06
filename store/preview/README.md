# Ko'rib chiqish uchun eskizlar

Bu yerdagi rasmlar faqat ko'rib chiqish uchun. O'yin kodi, joriy ikonkalar va versiya o'zgarmagan.
Paladin hozirgi ko'rinishida qoladi.

| Fayl                       | Nima                                                                                                                                                                                                                                                                                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `iblis-boss-preview.png`   | Iblis jangining o'yin ichidagi kadri (320x240 xona, 4x). Chapda hozirgi uslub, o'ngda anime ruhidagi piksel uslub: katta olovli ko'zlar, uzun kumush soch, shoxlar va plash. Tanasi va boltasi o'yindagi sprite'dan olingan. Hujumdan oldin ekran tepasida portret va "Olov hukmi!" cut-in kartochkasi chiqadi. Paladin va HUD hozirgidek.       |
| `samuray-icon-preview.png` | Kelajakdagi qahramon Samuray qiz uchun ikonka eskizi. Chapda 512x512 ikonka, o'ngda telefon bosh ekrani (96 px to'r va 48 px panel). Rasmda: katta yaqin portret, katta ifodali binafsharang ko'zlar, shamolda uchayotgan uzun qora soch, oq-pushti kimono, yelka ortida katana dastasi. Fonda tungi binafsha osmon, oy, qasr silueti va sakura. |

Generator: `scripts/preview-variants.mjs`, chizish qismi `scripts/preview-art.mjs`. U `sprites.ts`
palitralari va `spritePixels()` dan foydalanadi, chizish usuli o'yindagidek: butun sonli piksel to'r
va siyoh kontur. Kadrdagi xona, Paladin va HUD haqiqiy o'yindan olingan.

Qayta yaratish: `npx vite dev --host 127.0.0.1 --port 5173`, so'ng
`PW_DIR=<playwright o'rnatilgan papka> node scripts/preview-variants.mjs`.

Personajlar shu o'yin uchun chizilgan. Boshqa o'yin yoki anime qahramonidan nusxa olinmagan.
