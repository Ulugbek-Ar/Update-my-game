# Ilova ikonkasi: portal-arka

Muallif eskizi bo'yicha: tosh arka ichida qorong'i sehrli portal (binafsha-qora spiral),
tepa burchaklarda shoxli iblis boshlari (olov ko'zlar), yonlarda zanjirlar, pastda tosh pol.
Hammasi `scripts/make-icons.mjs` da kod bilan chiziladi: har o'lcham o'z to'rida (16–64 katak)
chiziladi va faqat butun songa kattalashtiriladi.

- **b** (ilovada ishlatiladi) — portal yorqinroq, chetida yorug' hoshiya: 32x32 va 48x48 da
  portal arkadan aniq ajralib turadi.
- **a** (shu papkada: `variant-a-*.png`) — eskizga eng yaqin, qorong'iroq, chetlari xira yorug'.

`compare.png`: yuqori qator — a, pastki — b. Har birida 512, 192, 48, 32 (haqiqiy o'lcham),
48×4 va 32×6 kattalashtirilgan, Android adaptive icon doira / squircle / kvadrat niqoblarida
(yashil chiziq — 66dp xavfsiz doira). Ochiq va to'q fonda.

Qayta yaratish: `node scripts/make-icons.mjs` (boshqa variant: `ICON_VARIANT=a`).
