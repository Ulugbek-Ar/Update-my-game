# Abadiyat olami serveri (multiplayer)

Server manzili: **https://pikselqala-server.ulugbek2647.workers.dev** (holat: `/health`).

Server — Cloudflare Workers + Durable Objects, **bepul tarif**. O'yin mantig'i bitta: serverda ham
klientdagi `src/realm/sim.ts` (`RealmSim`) aynan o'zi ishlaydi.

## Qanday ishlaydi

```
o'yin (brauzer, Telegram, Android)
   │  GET /join?xona=&v=1        → lobbi xona tanlaydi (kod bo'lmasa — avtomatik)
   │  WS  /ws?xona=KOD           → shu xonaning Durable Object'i
   ▼
Worker (server/src/index.ts)
   ├─ LobbyDO (bitta, "lobby")   — xonalar ro'yxati, kunlik limitlar hisobi, /health
   └─ RoomDO  (har xona — bitta) — RealmRoom → RealmSim, 20 Hz tick
```

- **Haqiqat manbai — server.** Klient faqat buyruq yuboradi (`move`, `attack`, `ability`,
  `interact`, `use`, `buy`...). Tezlik, zarar, lut va topshiriqlar serverda hisoblanadi; klient
  yuborgan saqlanish (progress) tekshiriladi va cheklanadi (noma'lum buyum, ortiqcha son, xaritadan
  tashqari joy tashlanadi).
- **Xona** = bitta Durable Object (nomi — 6 belgili xona kodi). Sig'imi — **8 o'yinchi**; to'lsa
  lobbi avtomatik keyingi xonani beradi. Moblar, yerdagi lut, buzilgan devor va ochilgan eshiklar
  xona bo'yicha umumiy; inventar, oltin, topshiriqlar va sirlar — har o'yinchiniki.
- **WebSocket Hibernation API**: ulanishlar `ctx.acceptWebSocket()` bilan qabul qilinadi.
  Xonada o'yinchi bor ekan 20 Hz tick ishlaydi; hamma chiqsa tick to'xtaydi, dunyo (vaqt, buzilgan
  devorlar) SQLite'ga saqlanadi va DO uxlaydi — vaqt sarflanmaydi.
- **Trafik**: klient buyruqlarni faqat o'zgarganda va ko'pi bilan 10 Hz yuboradi. Server har 2
  tick'da (10 Hz) har o'yinchiga **delta** yuboradi — faqat o'zgargan o'yinchi, mob, lut va faqat
  yaqindagilari (400 px). Turgan narsalar qayta yuborilmaydi.
- **Silliqlik**: o'z qahramoni bosilgan zahoti yuradi (prediction — `RealmSim.movePlayer`, serverdagi
  bilan bir xil kod) va server holati bilan solishtirib tuzatiladi (`src/realm/net/predict.ts`).
  Boshqa o'yinchilar va moblar ~150 ms orqada, ikki holat orasida interpolatsiya bilan ko'rsatiladi
  (`src/realm/net/mirror.ts`). 200 ms ping'da ham o'ynasa bo'ladi (test bor).
- **Oflayn**: server sozlanmagan, internet yo'q yoki server javob bermasa — olam avvalgidek
  klientda ishlaydi. Ulanish uzilsa o'yin darhol shu joydan oflayn davom etadi, fonda 3 marta
  (1, 2, 4 s) qayta ulanishga urinadi, bo'lmasa "Oflayn rejim" yozuvi chiqadi. Progress yo'qolmaydi.

### Fayllar

| Fayl                                    | Nima                                                      |
| --------------------------------------- | --------------------------------------------------------- |
| `src/realm/net/protocol.ts`             | xabarlar va zod sxemalari (klient va server uchun bitta)  |
| `src/realm/net/room.ts`                 | `RealmRoom` — xona mantig'i, tezlik cheklovi, delta holat |
| `src/realm/net/lobby.ts`                | xona tanlash va kunlik limitlar                           |
| `src/realm/net/session.ts`              | klient ulanishi, ping, qayta ulanish                      |
| `src/realm/net/mirror.ts`, `predict.ts` | klientda server holati, interpolatsiya, bashorat          |
| `server/src/*.ts`                       | Worker va Durable Object qobig'i (Cloudflare API)         |
| `.github/workflows/server.yml`          | deploy                                                    |

Xona va lobbi mantig'i Cloudflare'ga bog'liq emas — testlar Node'da ishlaydi
(`src/realm/net/room.test.ts`, `client.test.ts`).

## Endpointlar

- `GET /health` — `{ ok, version, protocol, rooms, online, today: { requests, limit, durationGBs, durationLimit } }`
- `GET /join?v=1[&xona=KOD]` — `{ ok: true, code }` yoki `{ ok: false, reason: "busy" | "full" | "version" | "bad" }`
- `GET /ws?xona=KOD` — WebSocket. Birinchi xabar — `hello` (protokol versiyasi, mehmon raqami,
  qahramon, progress). Keyin `cmd` (buyruqlar), `ping`, `chat` (faqat tayyor ibora raqami).

## Limitlar (bepul tarif) va himoya

| Cloudflare bepul limiti                                                     | Bizda                                                                                                     |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 100 000 so'rov/kun (Workers va DO), kiruvchi WebSocket xabari = 1/20 so'rov | lobbi taxminiy hisoblaydi; **90 000** dan keyin yangi ulanishlarga "Server band, keyinroq urinib ko'ring" |
| DO vaqti 13 000 GB-s/kun (128 MB xona ≈ 28 xona-soat)                       | xonalar ishlagan vaqtini lobbiga aytadi; **11 700 GB-s** dan keyin yangi ulanish yo'q                     |
| Faqat SQLite saqlashli DO                                                   | `new_sqlite_classes` (wrangler.toml)                                                                      |

Limitlar har kuni 00:00 UTC (Toshkent vaqti 05:00) da nollanadi. O'ynab turganlar limitga yetganda
uzilmaydi; Cloudflare o'zi rad eta boshlasa — klientlar oflayn rejimga o'tadi.

Taxminiy sarf: faol o'yinchi soatiga ~600 so'rov (ping har 4 s + buyruqlar), bitta xona soatiga
~460 GB-s. Ya'ni bepul tarif kuniga taxminan **25+ xona-soat** o'yinni ko'taradi (xonada 8 tagacha
o'yinchi — vaqt xona bo'yicha hisoblanadi, o'yinchi bo'yicha emas).

Himoya:

- har bir xabar zod bilan tekshiriladi, 16 KB dan katta yoki yaroqsizi rad etiladi;
- tezlik cheklovi: 20 xabar zaxira, sekundiga 12 ta; oshganlari tashlanadi, ko'p takrorlansa ulanish uziladi;
- yurish o'qi −1..1, slot 0..7 — tezlik va zararni klient belgilay olmaydi;
- chat — faqat 4 ta tayyor ibora (erkin matn yo'q), 1.5 s da bittadan;
- ism serverda yasaladi (`Mehmon-1234`), klient faqat 4 xonali raqam beradi.

## Deploy

`.github/workflows/server.yml` — `server/` yoki server ishlatadigan o'yin mantig'i (`src/realm/**`,
`src/game/player.ts` va h.k.) o'zgarib main'ga push qilinganda va qo'lda (Actions → Server → Run
workflow). GitHub secrets:

- `CLOUDFLARE_API_TOKEN` — "Edit Cloudflare Workers" shablonidagi token;
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare hisob ID'si.

Secrets bo'lmasa workflow ogohlantirish beradi va yiqilmaydi (faqat tekshiruv). Deploy'dan keyin
server manzili va `/health` javobi workflow xulosasida (Summary) chiqadi.

O'yin build'lari server manzilini `VITE_SERVER_URL` dan oladi (`pages.yml`, `android.yml`,
`telegram-post.yml`). Berilmasa — olam faqat oflayn.

**Protokolni o'zgartirsangiz** (`protocol.ts`) — `NET_VERSION` ni oshiring: eski klientlar
"Yangi versiyani yuklang" deb oflayn qoladi, yangilari serverga ulanadi.

## Lokal sinov

```bash
cd server && npm ci && npx wrangler dev --port 8787
```

```bash
VITE_SERVER_URL=http://127.0.0.1:8787 bun run dev
```

Ikki brauzer oynasida olamga kiring — ikkalasi bitta xonaga tushadi. Do'st kodi bilan sinash:
pauza → DO'STNI CHAQIRISH → havolani ikkinchi oynada oching.

Serversiz (dev rejimi): olamda konsolda `await window.__realmDemo()` — sahifa ichidagi xona va ikki
bot (skrinshotlar ham shu bilan olinadi). Onlaynni o'chirish: `localStorage["pixel-rpg-offline"] = "1"`.

Tekshiruvlar: `npm test` (xona, lobbi, ikki klient, uzilish, rate limit testlari),
`cd server && npx tsc --noEmit && npx wrangler deploy --dry-run --outdir .wrangler/dry`.

## Muammolarni hal qilish

| Belgi                                  | Sabab va yechim                                                                                               |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| HUD'da doim **OFLAYN**                 | build'da `VITE_SERVER_URL` yo'q yoki `pixel-rpg-offline = 1`. Brauzerda `…/health` ochiladimi — tekshiring.   |
| "Server band, keyinroq urinib ko'ring" | kunlik limitga yaqin (`/health` → `today`). 05:00 (Toshkent) dan keyin o'tadi.                                |
| "Yangi versiyani yuklang"              | klient va server `NET_VERSION` farq qiladi: sahifani yangilang yoki server deploy'ini kuting.                 |
| "Xona to'la"                           | xonada 8 kishi — avtomatik boshqa xonaga ulanadi.                                                             |
| Deploy workflow qizil                  | Actions logida `wrangler deploy` xatosi: token huquqlari (Workers Scripts: Edit) va account ID'ni tekshiring. |
| `workers.dev` ochilmaydi               | Cloudflare → Workers → Subdomain yoqilganini tekshiring (ulugbek2647.workers.dev).                            |
| Qahramon "orqaga tortiladi"            | server tuzatishi (itarilish, devor). Ping juda yuqori (> 500 ms) bo'lsa sezilarli bo'ladi.                    |

Loglar: Cloudflare dashboard → Workers → pikselqala-server → Logs (`observability` yoqilgan) yoki
`npx wrangler tail` (server/ papkasida, token bilan).
