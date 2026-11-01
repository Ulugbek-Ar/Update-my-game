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

## Server jadvallari (`src/account/server/db.ts`)

`guilds`, `guild_members`, `guild_requests` (ariza/taklif), `guild_cooldown` (24 soat),
`guild_rids` (takroriy so'rovlar, 7 kun), `guild_log` (jurnal: gildiyaga oxirgi 200 yozuv).
Akkaunt o'chirilsa: a'zolik, arizalar va jurnal yozuvlari o'chadi; rahbar bo'lsa — rahbarlik eng
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

`presence` javobida `guild` — qisqacha (teg, gerb, daraja, rol va kutilayotgan arizalar/takliflar
soni): menyudagi GILDIYA nishoni va daraja foydalari shu bilan ishlaydi (qurilmada saqlanadi).

## Lokal sinov

Serversiz: `bun run dev` da konsolda `await window.__accountDemo()` — gildiya rahbari (14 a'zo,
arizalar), `await window.__accountDemo({ guild: false })` — gildiyasiz (qidirish, tuzish, gerb
muharriri, taklif). Olamda teglar: `await window.__realmDemo([{ hero: "mage", tag: "1", nick:
"Dilnoza", level: 14, guild: { tag: "PQ", emblem: "0-0-3-1" } }])`.

Haqiqiy server bilan — docs/accounts.md ("Lokal sinov"). Testlar: `src/account/server/guilds.test.ts`,
`src/account/guild.test.ts`.
