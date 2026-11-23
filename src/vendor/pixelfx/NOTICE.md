# pixelfx (vendored)

Manba: https://github.com/patch-gg/pixelfx (v0.3.1), MIT litsenziyasi — `LICENSE`.
Faqat `core/` va o'yin ishlatadigan effektlar (va ularning `_lib.js` yordamchilari) nusxalangan.
Patch Pixel shrifti (`gallery/fonts`, MIT emas) OLINMAGAN; `core/font.js` — kodda yozilgan oddiy piksel shriftlar.

Asl mualliflar eslatmasi (NOTICE.md dan): `core/sim.js` va ba'zi effektlar Sprite Fusion'ning ochiq
pixel-art VFX'idan (https://www.spritefusion.com/pixel-art-vfx, Copyright (c) 2026 Hugo Duprez, MIT)
moslashtirilgan; `core/act.js` Hollow Crown'dan (https://github.com/rehan-remade/hollow-crown,
Copyright (c) 2026 rehan-remade, MIT) moslashtirilgan. O'yin `createAct` (hit-stop, silkinish) ni ishlatmaydi.

Piksel Qal'a o'zgartirishlari:
- `core/painter.js`: `place()` ga masshtab `k` qo'shildi (`toX/toY/fromX/fromY` va `glow*` radiuslari) —
  effekt kichikroq chiziladi, lekin baribir 1 ekran pikseli = 1 piksel.
- `core/fx.js`: `createFx` `opts.scale` ni painter'ga beradi.
- `fx/explosions/_lib.js`: tez yo'l masshtab 1 bo'lmaganda ishlatilmaydi.
- `index.js`, `index.d.ts`: bitta kirish nuqtasi va turlar.
