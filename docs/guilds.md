# Gildiyalar (v3.3)

Faqat kirgan (Telegram akkauntli) o'yinchilar uchun. Menyuda **GILDIYA** tugmasi (mehmonga —
kirish oynasi). Server — akkauntlar ombori (`AccountDO`, SQLite), so'rovlar `POST /acc/guild/*`.
Umumiy qoidalar (klient ham, server ham) — `src/account/guildRules.ts`.

## Tuzish va a'zolik

- **Tuzish — 500 oltin.** Nomi 3–20 belgi (harf, raqam, bo'shliq, apostrof, chiziqcha; lotin
  yoki kirill — aralash emas), tegi 2–4 harf/raqam (katta harfga o'giriladi, `[PQ]`). Nomi ham,
  tegi ham **takrorlanmaydi** (katta-kichik harf va apostrof farqsiz). Haqoratli so'zlar va xizmat
  nomlari filtri — taxallusdagi bilan bir xil (`src/account/nick.ts`).
- **Gerb muharriri** — kod bilan chizilgan piksel gerb (`src/game/emblem.ts`): shakl (qalqon,
  bayroq, doira), 2 rang (fon va belgi, har xil bo'lishi shart) va belgi. 1-darajada 8 rang va 6
  belgi (qilich, toj, ajdar, yulduz, bosh suyagi, quyosh); qolganlari gildiya darajasi bilan
  ochiladi (pastdagi jadval). Saqlanishi: `"shakl-fon-belgi rangi-belgi"`, masalan `0-1-3-0`.
- **Oltin klientda** (asosiy o'yindagidek): klient o'z oltinini aytadi, server uni bulutdagi
  saqlanish bilan solishtiradi (oxirgi saqlanishdan beri 3 000 + soatiga 2 000 — `limits.ts`),
  oltin esa **faqat server "ok" degandan keyin** yechiladi. Javob yo'qolsa so'rov `rid` bilan
  saqlanadi va keyingi yangilanishda aynan shu `rid` bilan qayta yuboriladi — server uni bir
  marta hisoblaydi (`guild_rids`).
- **A'zolar:** 1–4-daraja — 20, 5–7 — 25, 8–10 — 30.
- **Rollar:** RAHBAR (1), O'RINBOSAR (3 tagacha), A'ZO.

| Amal                                      | Rahbar  | O'rinbosar     | A'zo |
| ----------------------------------------- | ------- | -------------- | ---- |
| Arizani qabul/rad qilish, taklif yuborish | ✔       | ✔              | —    |
| Chiqarish                                 | hammani | faqat a'zoni   | —    |
| A'zoni o'rinbosar qilish                  | ✔       | ✔ (joy bo'lsa) | —    |
| O'rinbosarni a'zoga tushirish             | ✔       | —              | —    |
| Rahbarlikni topshirish, tarqatish         | ✔       | —              | —    |
| Qo'shilish usuli, til, gerb               | ✔       | —              | —    |

Rahbar a'zolari bor holda chiqa olmaydi — avval rahbarlikni topshiradi (o'zi o'rinbosar bo'ladi,
joy bo'lmasa — a'zo). Yolg'iz rahbar chiqsa — gildiya tarqaladi.

## Qo'shilish

- **OCHIQ** — darhol; **ARIZA BILAN** — rahbar yoki o'rinbosar tasdiqlaydi; **FAQAT TAKLIF** —
  rahbar/o'rinbosar taxallus yoki do'st kodi bilan taklif yuboradi. Ariza yuborgan o'yinchini
  taklif qilish — darhol qabul. Qo'shilgach boshqa arizalar va takliflar o'chadi.
- Chegaralar: o'yinchida 5 tagacha javob kutilayotgan ariza, gildiyada 50 tagacha ariza/taklif.
  Bloklagan o'yinchiga taklif ketmaydi.
- **Qidirish ro'yxati:** nomi (qismi) yoki tegi bo'yicha, til filtri; har gildiyada — gerb, teg,
  nomi, darajasi, a'zolar soni/sig'imi, tili, faollik (so'nggi 3 kunda o'ynagan a'zolar) va
  onlayn a'zolar. Saralash — faollik, keyin gildiya XP.
- **24 soat cheklov (sakrashga qarshi):** o'z ixtiyori bilan chiqqan (va gildiyani tarqatgan
  rahbar) 24 soat boshqa gildiyaga qo'shila olmaydi va yangisini tuza olmaydi. Chiqarilgan
  o'yinchiga va tarqatilgan gildiya a'zolariga cheklov yo'q.

## Teg va gerb qayerda ko'rinadi

- Abadiyat olamida — boshqa o'yinchi ismi oldida kichik gerb va `[TEG]` (server akkauntlar
  DO'sidan oladi: `identify` → `NetIdent.guild`, tarmoqda `NetPlayer[15] = "TEG|gerb"`).
- Profil (gildiya nomi, tegi, darajasi va roli), menyuning chap yuqorisi (kichik gerb),
  reyting jadvallari va do'stlar ro'yxati — ism yonida.

## Daraja (1–10) va foydalari

| Daraja | Gildiya XP | Foyda                                                  |
| ------ | ---------- | ------------------------------------------------------ |
| 1      | 0          | 20 a'zo, 6 belgi va 8 rang                             |
| 2      | 500        | +2 % XP, belgi: oy                                     |
| 3      | 1 500      | kunlik sovg'aga +3 oltin, belgi: olov                  |
| 4      | 3 000      | +4 % XP, ranglar: pushti, firuza, jigarrang, to'q ko'k |
| 5      | 5 000      | 25 a'zo, belgi: chaqmoq                                |
| 6      | 8 000      | +6 % XP, kunlik sovg'aga +5 oltin, belgi: qal'a        |
| 7      | 12 000     | belgi: qanot                                           |
| 8      | 17 000     | +8 % XP, 30 a'zo, ranglar: oltin, kumush               |
| 9      | 23 000     | kunlik sovg'aga +8 oltin, belgi: bo'ri                 |
| 10     | 30 000     | +10 % XP, belgi: qaqnus                                |

Foydalar kichik: oltin narxlari, jang kuchi va bosslar o'zgarmaydi.

Foydalar klientda qo'llanadi (gildiya qisqachasi qurilmada saqlanadi): XP qo'shimchasi —
`src/account/xp.ts` (`setXpBonus`; kasr qoldig'i yig'iladi — 10 XP ning 2 % i ham yo'qolmaydi),
kunlik sovg'a — `src/game/gift.ts` (`setGiftBonus`).

## Xazina

- A'zo xazinaga oltin qo'shadi: kamida 5, **kuniga ko'pi bilan 100** (Toshkent kuni, o'yinchi
  bo'yicha — gildiya almashtirsa ham chegara bir xil). **1 oltin = 1 gildiya XP**. Xazinadan
  oltin olinmaydi (gildiya darajasi uchun yig'iladi).
- Oltin tuzishdagidek: server bulut bilan solishtiradi, klient faqat "ok" dan keyin yechadi,
  `rid` bilan takroriy so'rov bir marta.
- **Jurnal** (XAZINA bo'limi): hissalar, qo'shilish/chiqish, rollar, bajarilgan topshiriqlar —
  gildiyaga oxirgi 200 yozuv (oynada 60 tasi).

## Haftalik gildiya topshiriqlari

Har dushanba 00:00 (Toshkent) yangilanadi. Har gildiyaga 3 ta: oddiy (dushmanlar, XP,
to'lqinlar, o'yinlar), o'rta (bosslar, xazina) va maxsus (Kul qiroli, olam sirlari) guruhidan
bittadan — gildiya va hafta bo'yicha aniq (`weeklyQuests`). Maqsad hafta boshidagi a'zolar
soniga qarab: kichik (1–5), o'rta (6–14), katta (15+).

| Topshiriq                 | Maqsad (kichik / o'rta / katta) | Har a'zoga | Gildiyaga |
| ------------------------- | ------------------------------- | ---------- | --------- |
| N ta dushman yenging      | 1 500 / 3 000 / 5 000           | 25 oltin   | 400 XP    |
| N ta boss yenging         | 10 / 25 / 50                    | 30 oltin   | 500 XP    |
| N ta to'lqinni tozalang   | 150 / 300 / 600                 | 20 oltin   | 300 XP    |
| N ta o'yinni tugating     | 20 / 50 / 100                   | 20 oltin   | 300 XP    |
| Olamda N ta sir toping    | 5 / 10 / 20                     | 35 oltin   | 500 XP    |
| Kul qirolini N marta yeng | 2 / 5 / 10                      | 50 oltin   | 800 XP    |
| Xazinaga N oltin to'plang | 500 / 1 200 / 2 500             | 20 oltin   | 300 XP    |
| Birgalikda N XP to'plang  | 3 000 / 8 000 / 15 000          | 25 oltin   | 400 XP    |

- **Hissani klient yubormaydi**: a'zoning bulutli saqlanishi qabul qilinganda (oldingi
  versiyadan davom etgan bo'lsa) statistika (dushman, boss, to'lqin, o'yin), XP va olam
  sirlaridagi o'sish hisoblanadi (`GuildLife.onSave`). Bitta saqlanishdagi o'sish cheklangan
  (masalan, 3 000 dushman), ziddiyatli (boshqa qurilma) saqlanish hisobga kirmaydi.
- **Kul qiroli** — olam serveri xabar qiladi: bir jangda bir gildiyadan bir nechta a'zo —
  gildiyaga bitta g'alaba, har biriga ishtirok hissasi.
- Har a'zoning hissasi topshiriq ostida ko'rinadi. Bajarilganda **hamma a'zolarga** oltin
  sovg'asi va gildiyaga XP. Sovg'ani klient gildiya oynasi ochilganda o'zi oladi: olingan
  oxirgi sovg'a raqami progressda (`pixel-rpg-guild`, bulutga ham ketadi) — ikki marta
  berilmaydi. Menyuda GILDIYA miltillaydi (sovg'a, yangi xabar yoki ariza/taklif).
- Yozuvlar tejamli: a'zoning haftalik hissasi — bitta qator (`guild_qc`), faqat shu haftaning
  topshiriq turlari yoziladi.

## Gildiya chati

- Faqat gildiya ichida: 10 ta tayyor ibora va erkin matn (120 belgigacha). Haqoratli so'zlar
  yulduzcha bilan yopiladi, havolalar `[havola]` bo'ladi, ko'rinmas belgilar olib tashlanadi
  (`cleanChat`). 2 soniyada bitta xabar.
- Serverda oxirgi **100 ta** xabar saqlanadi. Oyna ochiq turganda 5 s da bir yangilanadi
  (faqat yangi xabarlar; xabar o'chirilsa — chat versiyasi o'zgaradi va ro'yxat to'liq keladi).
- Xabarni o'chirish: o'zinikini — har kim; boshqanikini — rahbar va o'rinbosar (o'zidan past
  roldagini). **Jim qilish** (10 daqiqa, 1 soat, 24 soat) — A'ZOLAR bo'limida, chiqarish
  huquqi bilan bir xil: rahbar — hammani, o'rinbosar — a'zoni.

## Gildiya zali (Abadiyat olamida)

- **Kirish:** vodiy qishlog'ining shimolida (QISHLOQ maydoni tepasida) **gildiya darvozasi** —
  ustida o'z gildiyangiz gerbi. Faqat kirgan, gildiyadagi va onlayn o'yinchi o'tadi (aks holda
  xabar). Olamdagi joy saqlanadi — zaldan chiqqach darvoza oldiga qaytasiz.
- **Har gildiyaning o'z xonasi**: serverda alohida Durable Object (`HallDO`, nomi
  `hall:<gildiya raqami>`), olam xonasi bilan bir xil `RealmSim` (`src/realm/net/hall.ts` —
  `HallRoom`). Bo'sh bo'lsa tick to'xtaydi va DO uxlaydi. Kirish — faqat shu gildiya a'zolari:
  salomlashuvdagi akkaunt tokeni akkauntlar DO'sida tekshiriladi (`identify` → gildiya raqami),
  boshqalarga `member` xatosi ("Gildiya zaliga faqat shu gildiya a'zolari kiradi"). Sig'im — 30.
- **Zal** (`src/realm/data/regions/guildhall.json`): yopiq bino (kecha-kunduz yo'q), yog'och pol,
  qizil gilam, ustunlar. Shimoliy devorda gildiya nomi lavhasi, darajasi va **bayroqlar gerb
  rangida**: 1–3-daraja — 2 ta, 4–6 — 4 ta, 7-darajadan — 6 ta va ikki baravar katta, 10-darajada
  — oltin hoshiya va toj. **Trofeylar** — gildiya yenggan bosslar boshlari: Iblis, Qor Malikasi,
  O'rmon Shohi, Xaroba Sardori, Kul qiroli (a'zo saqlanganda uning yengganlari va Kul qiroli
  g'alabasi gildiyaga yoziladi — `trophiesIn`).
- **Zalda:** xazina sandig'i (XAZINA — hissa qo'shish), topshiriqlar taxtasi (TOPSHIRIQLAR),
  a'zolar ro'yxati — minbardagi kitob (A'ZOLAR); ular GILDIYA oynasining shu bo'limini ochadi.
  **Mashq qo'g'irchog'i** — qimirlamaydi, hujum qilmaydi, o'lmaydi: ustida o'zingiz bergan jami
  zarar, soniyasiga zarar va zarbalar soni (4 s urilmasa — nollanadi). Zalda buyum ishlatish va
  savdo yo'q, zal olam saqlanishiga yozilmaydi. Chiqish — eshik (VODIYGA), HUD dagi VODIYGA yoki
  pauzadagi ZALDAN CHIQISH; ulanish uzilsa ham vodiyga qaytiladi.
- Zal bezagi (nom, gerb, daraja, trofeylar) — zal xonasi akkauntlar DO'sidan oladi
  (`hallInfo`), 2 daqiqada bir yangilaydi va o'zgarsa zaldagilarga `hall` xabari yuboradi.

## Server jadvallari (`src/account/server/db.ts`)

`guilds`, `guild_members`, `guild_requests` (ariza/taklif), `guild_cooldown` (24 soat),
`guild_rids` (takroriy so'rovlar, 7 kun), `guild_log` (jurnal: gildiyaga oxirgi 200 yozuv),
`guild_gifts` (kunlik hissa, 3 kun), `guild_week` (haftalik gildiya XP, topshiriqlar, Kul
qiroli), `guild_quests` va `guild_qc` (topshiriqlar va hissalar, 5 hafta), `guild_rewards`
(sovg'alar, 30 kun), `guild_chat` (gildiyaga 100 xabar) va `guild_chatrev`.
Akkaunt o'chirilsa: a'zolik, arizalar, jurnal yozuvlari, hissalar, sovg'alar va chatdagi
xabarlari o'chadi; rahbar bo'lsa — rahbarlik eng
eski o'rinbosarga (yo'q bo'lsa — eng eski a'zoga) o'tadi, yolg'iz bo'lsa — gildiya tarqaladi.

## API (`POST /acc/<op>`, `src/account/protocol.ts`)

| Op                                | Nima                                                |
| --------------------------------- | --------------------------------------------------- |
| `guild/get`                       | mening gildiyam (yoki takliflar, arizalar, cheklov) |
| `guild/create`                    | tuzish: nom, teg, gerb, usul, til, `gold`, `rid`    |
| `guild/search`, `guild/info`      | qidirish va gildiya haqida (kirmasdan ham)          |
| `guild/join`, `guild/cancel`      | qo'shilish / ariza, arizani bekor qilish            |
| `guild/answer`, `guild/invite`    | rahbar/o'rinbosar: arizaga javob, taklif            |
| `guild/reply`                     | kelgan taklifga javob                               |
| `guild/leave`, `guild/kick`       | chiqish, chiqarish                                  |
| `guild/role`, `guild/transfer`    | rol berish, rahbarlikni topshirish                  |
| `guild/disband`, `guild/settings` | tarqatish; usul, til va gerb                        |
| `guild/give`, `guild/log`         | xazinaga hissa (`gold`, `rid`), jurnal              |
| `guild/chat`, `guild/say`         | chat (since, rev), yozish (matn yoki ibora)         |
| `guild/unsay`, `guild/mute`       | xabarni o'chirish, jim qilish (daqiqa; 0 — olish)   |

`presence` javobida `guild` — qisqacha (teg, gerb, daraja, rol va kutilayotgan arizalar/takliflar
soni): menyudagi GILDIYA nishoni va daraja foydalari shu bilan ishlaydi (qurilmada saqlanadi).

## Lokal sinov

Serversiz: `bun run dev` da konsolda `await window.__accountDemo()` — gildiya rahbari (14 a'zo,
arizalar, topshiriqlar, chat), `await window.__accountDemo({ guild: false })` — gildiyasiz (qidirish, tuzish, gerb
muharriri, taklif). Gildiya zali: olamda `window.__realm.onEnterHall(7)`, so'ng `await window.__hallDemo()`
(sahifa ichidagi zal va a'zolar; `__hallDemo(undefined, { level: 10 })` — bezak). Olamda teglar: `await window.__realmDemo([{ hero: "mage", tag: "1", nick:
"Dilnoza", level: 14, guild: { tag: "PQ", emblem: "0-0-3-1" } }])`.

Haqiqiy server bilan — docs/accounts.md ("Lokal sinov"). Testlar: `src/account/server/guilds.test.ts`,
`src/account/server/guildLife.test.ts`, `src/account/guild.test.ts`, `src/realm/hall.test.ts`,
`src/realm/hall-client.test.ts`.
