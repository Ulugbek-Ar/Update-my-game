# Piksel Qal'a — yo'l xaritasi

Kod xaritasi: `docs/ARCHITECTURE.md`. Versiya va kanal posti qoidasi: `CLAUDE.md`.

## Qahramonlar (reja: 10 ta)

**TAYYOR — 9 ta:**

1. Ritsar (`knight`).
2. Sehrgar (`mage`) — YOVUZ sehrgar.
3. Ovchi (`hunter`).
4. Mergan (`gunner`).
5. Paladin (`paladin`) — do'st so'ragan; chelak dubulg'a — do'st tanlagan.
6. Samuray (`samurai`) — anime uslubi FAQAT unda.
7. Ninja (`shinobi`) — do'st so'ragan.
8. Rohiba (`priestess`).
9. Bo'ri-qiz varvar (`wolf`).

**QOLGAN — 10) Oy kohini (Moon Priestess, id `"moon"`)** — davolovchi, Rohibaning (quyosh) oy juftligi.

- Ko'rinishi: uzun oppoq soch, peshonada hilol, yuzda oq bo'yoq chiziqlari, to'q kapalak va oq gulli
  toj, kumush va to'q ko'k YOPIQ libos, hilolli tayoq.
- Hujumi — hilol snaryad; kuchli hujum — "Oy nuri"; dash — "Oy soyasi" (teleport);
  davolash — "Oy doirasi"; super — "To'lin oy".
- Qo'shish tartibi: `docs/ARCHITECTURE.md` → "Qahramon" va "Super" retseptlari (namuna: `wolf`, `priestess`).

"Ovchi qiz" — alohida qahramon emas, Ovchi skini.

Qiz qahramonlarni kiyim emas, XARAKTER yoqimli qiladi — o'yin bolalar uchun ham.

## Keyingi ishlar

- Onlayn olamga pixelfx effektlari (`src/game/pixelFx.ts` → `src/realm/render.ts`).
- Yangi hududlar: Muz cho'qqisi va Qadimiy o'rmon (Vodiydagi darvozalar; `src/realm/data/regions/`).
- Bosslarga yangi fazalar.
- Onlayn olamda irq tanlash — faqat ko'rinish va hikoya, KUCH BERMAYDI.
- Turk tili (`src/i18n/` ga to'rtinchi til).
- Graphify kod xaritasi (yangi obunada).
- Donat — faqat kosmetik, reklamasiz, lutbokssiz (to'lov yo'li hali tanlanmagan).
- Test qiluvchilar fikrini doim tinglash.

## Versiyalar

- 3.x da davom etiladi (oxirgisi 3.23.0).
- Kanalga APK avtomatik faqat x.y.0 versiyada, y 10 ga karrali bo'lsa (`src/lib/apk.ts`);
  qolganida — Actions'da qo'lda "APK yuborish".
- Play Market — v5.0; keyin 5.x.y kichik yangilanishlar va oyiga bitta 5.(x+1).0 reliz.

## Muhim qarorlar

- Skin kuch bermaydi.
- Hit-stop yo'q.
- Superlarni zaiflashtirmaslik — kerak bo'lsa bosslarni kuchaytirish.
- `bossCap` 0.1 (bitta superdan bossga jami zarar ulushi, `src/game/super.ts`).
- Boss janglari 160 s dan uzoq emas.
- Portretlar — olddan, simmetrik, 96x96; avval variantlar solishtiriladi.
- Godot/3D — faqat kelajakdagi "Piksel Qal'a 2" (HD-2D) uchun.
