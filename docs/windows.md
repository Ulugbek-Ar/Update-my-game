# Piksel Qal'a — kompyuter (Windows) versiyasi

Maktab va uy kompyuterlari uchun ikki xil tarqatma bor. Ikkalasi ham internetsiz ishlaydi,
internet bo'lsa Abadiyat olami onlayn bo'ladi.

| Fayl                        | Ichida                                                             | Kim uchun                                                  |
| --------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------- |
| `PikselQala-portable.zip`   | `Piksel Qala.html`, `O'QING.txt`                                   | Har qanday kompyuter (Windows, Linux, Mac) — faqat brauzer |
| `PikselQala-Windows.zip`    | `Piksel Qala.exe` (o'rnatishsiz), `Piksel Qala.html`, `O'QING.txt` | Windows 10/11, admin huquqi shart emas                     |
| `PikselQala-v<V>-setup.exe` | NSIS o'rnatuvchi (joriy foydalanuvchiga, adminsiz)                 | Ixtiyoriy: Boshlash menyusi va ish stolida yorliq          |
| `PikselQala-v<V>.msi`       | MSI o'rnatuvchi (admin kerak)                                      | Ixtiyoriy: maktab tarmog'ida markaziy o'rnatish            |

Hammasi **GitHub Release**'da (`v<versiya>` tegi) va x.y.0 versiyalarda Telegram kanalda.

## Portativ HTML (`npm run build:portable`)

`scripts/build-portable.mjs` o'yinni `vite.portable.config.ts` bilan yig'adi (TanStack Start'siz,
faqat o'yin sahifasi — `src/portable/main.tsx`) va hammasini **bitta HTML faylga** joylaydi:

- JS — bitta klassik (IIFE) skript: ES modul, dinamik import va CORS muammosi yo'q, `file://`
  orqali ikki marta bosib ochiladi;
- CSS va Press Start 2P shrifti (data: URI), ikonka — fayl ichida, tashqi so'rov yo'q;
- eski brauzerlar: JS Chrome/Edge 80+, Firefox 78+ ga pasaytiriladi (`src/portable/polyfills.ts`),
  CSS Lightning CSS bilan (`@layer` yoyiladi, `oklch` → `rgb`); bundle ishga tushmasa —
  o'zbekcha "Brauzeringiz juda eski" xabari;
- AI maslahatchi yashirin (server yo'q), Telegram skripti yuklanmaydi;
- `VITE_SERVER_URL` (standart: `https://pikselqala-server.ulugbek2647.workers.dev`).

Saqlanishlar shu kompyuterdagi shu brauzerning `localStorage`'ida. Boshqa joyga — progressni
ko'chirish kodi orqali (Sozlamalar → Umumiy → Progressni ko'chirish).

## Windows dasturi (Tauri 2, `src-tauri/`)

- `npm run build:desktop` → `dist/desktop/index.html` (portativ HTML bilan bir xil, `VITE_DESKTOP=1`);
  Tauri uni `.exe` ichiga joylaydi — o'yin oflayn ishlaydi.
- Oyna nomi "Piksel Qal'a", ikonka `src-tauri/icons/icon.ico` (`public/icons/icon-512.png` dan,
  `npm run tauri icon public/icons/icon-512.png -o src-tauri/icons`).
- **F11** — to'liq ekran (`src/lib/desktop.ts`); oyna o'lchami, joyi va to'liq ekran holati
  `tauri-plugin-window-state` bilan eslab qolinadi.
- **Saqlanishlar** WebView2 ma'lumotlari bilan `%LOCALAPPDATA%\com.ulugbek.pikselqala\` da
  (AppData). Dastur yangilanganda yoki portativ `.exe` almashtirilganda o'chmaydi — shuning uchun
  `tauri.conf.json` dagi `identifier` ni **hech qachon o'zgartirmang**.
- **WebView2 yo'q bo'lsa** (eski Windows 10): dastur o'zbekcha xabar chiqaradi — WebView2'ni
  o'rnatish havolasi va "Ha" bosilsa `.exe` yonidagi `Piksel Qala.html` ni (bo'lmasa yuklab olish
  sahifasini) brauzerda ochadi. NSIS o'rnatuvchi WebView2'ni o'zi yuklab o'rnatadi.
- Onlayn olam (`VITE_SERVER_URL`) dasturda ham ishlaydi; internet yo'q bo'lsa — oflayn.

Mahalliy yig'ish (Windows'da, Rust va Node o'rnatilgan bo'lsa):

```bash
npm run build:desktop
```

```bash
npm run tauri build
```

Natija: `src-tauri/target/release/Piksel Qala.exe` (portativ) va
`src-tauri/target/release/bundle/{nsis,msi}/` (o'rnatuvchilar).

## "Windows компьютер защищен" (SmartScreen) ogohlantirishi

Dastur pullik kod-imzo sertifikati bilan imzolanmagan, shuning uchun birinchi ochilishda Windows
ko'k oyna chiqarishi mumkin: **"Windows защитил ваш компьютер"** / **"Windows protected your PC"**
(o'zbekcha: "Windows kompyuteringizni himoya qildi", "noma'lum dastur"). Bu dastur xavfli degani
emas — Windows uni hali "tanimaydi", xolos. Ishga tushirish uchun:

1. Oynadagi **"Подробнее"** / **"More info"** (**Batafsil**) yozuvini bosing.
2. Pastda paydo bo'lgan **"Выполнить в любом случае"** / **"Run anyway"**
   (**Baribir ishga tushirish**) tugmasini bosing.

Bu faqat birinchi marta so'raladi. Agar "Batafsil" yozuvi umuman bo'lmasa — kompyuterda
administrator noma'lum dasturlarni taqiqlagan (maktab kompyuterlarida bo'ladi). U holda
**portativ HTML** versiyadan foydalaning: `PikselQala-Windows.zip` ichidagi `Piksel Qala.html`
ni yoki `PikselQala-portable.zip` ni brauzerda oching — u hech qanday ruxsat so'ramaydi.

Arxiv ichidan to'g'ridan-to'g'ri ochmang: avval **"Извлечь все"** / **"Extract all"** bilan
papkaga chiqaring.

## Yangi versiya haqida xabar va avtomatik yangilanish

Portativ HTML, Windows dasturi va Android ilova o'zi yangilanmaydi, shuning uchun ochilganda
(internet bo'lsa) GitHub Pages'dagi `version.json` ni tekshiradi
(`https://ulugbek-ar.github.io/Update-my-game/version.json`, `.github/workflows/pages.yml` har
deploy'da yozadi; kod: `src/lib/update.ts`, `src/components/game/UpdateBanner.tsx`). Yangi versiya
bo'lsa bosh menyuning chap yuqori burchagida **"Yangi versiya vX.Y.Z chiqdi!"** chiqadi:

- Windows dasturida (updater kaliti bilan yig'ilgan bo'lsa) — **YANGILASH**: yangi o'rnatuvchini
  yuklab, o'rnatib, dasturni qayta ochadi (Tauri updater, `latest.json` Release'da);
- portativ HTML'da (va kalitsiz Windows build'da) — **YUKLAB OLISH**: Release sahifasi;
- Android ilovada — **YUKLAB OLISH**: Telegram kanal (APK).

Internet bo'lmasa hech narsa chiqmaydi. Saqlanishlar yangilanishda o'chmaydi (AppData /
brauzer `localStorage`).

### Updater imzo kalitini yaratish (bir marta)

Tauri yangilanishni faqat imzosi to'g'ri bo'lsa o'rnatadi. Kalitsiz ham hammasi yig'iladi, faqat
dastur o'zini yangilay olmaydi (havola ko'rsatadi).

1. Kompyuterda (Node o'rnatilgan) kalit yarating — parol so'raydi, uni eslab qoling:

   ```bash
   npx --yes @tauri-apps/cli@2.12.4 signer generate -w pikselqala-updater.key
   ```

   Ikki fayl paydo bo'ladi: `pikselqala-updater.key` (maxfiy) va `pikselqala-updater.key.pub`
   (ochiq). Maxfiy kalitni **repoga qo'shmang** va **yo'qotmang** — yo'qolsa, eski dasturlar
   yangilanishni qabul qilmaydi (qo'lda qayta yuklab olish kerak bo'ladi).

2. GitHub → repo → **Settings → Secrets and variables → Actions**:
   - **Secrets** bo'limida **New repository secret**:
     - `TAURI_SIGNING_PRIVATE_KEY` — `pikselqala-updater.key` faylidagi butun matn;
     - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — kalit paroli.
   - **Variables** bo'limida **New repository variable**:
     - `TAURI_UPDATER_PUBKEY` — `pikselqala-updater.key.pub` faylidagi butun matn.

3. Tekshirish: **Actions → Windows → Run workflow**. Release'da `latest.json` paydo bo'lsa,
   updater ishlayapti. Updater faqat shundan keyin yig'ilgan dasturlarda ishlaydi.

## GitHub Actions va tarqatish

- `.github/workflows/windows.yml` — `windows-latest` runner: portativ HTML, Tauri `.exe`, NSIS va
  MSI o'rnatuvchilar, `store/wallpapers/*.png` fon rasmlari, `latest.json` (kalit bo'lsa) →
  GitHub Release `v<versiya>`. Har versiyada (`src/game/version.ts` o'zgarsa) va qo'lda
  (**Actions → Windows → Run workflow**).
- `.github/workflows/telegram-post.yml` — x.y.0 versiyalarda post va APK'dan keyin kanalga
  `PikselQala-Windows.zip` va `PikselQala-portable.zip` yuboriladi (`scripts/telegram-pc.mjs`,
  qoidalar: `src/lib/pcfiles.ts`). Telegram bot fayl chegarasi 50 MB — oshsa fayl o'rniga Release
  havolasi yuboriladi. Qo'lda: **Actions → Telegram post → Run workflow** → **"PC fayllarini
  yuborish"** ni belgilang.

## Fon rasmlari (reklama uchun)

`store/wallpapers/` — kod bilan chizilgan piksel uslubdagi ish stoli fon rasmlari, har biri
1920x1080 va 1366x768 o'lchamda:

| Fayl                         | Sahna                                    |
| ---------------------------- | ---------------------------------------- |
| `PikselQala-fon-qasr-*.png`  | qasr va oy fonida 4 qahramon             |
| `PikselQala-fon-iblis-*.png` | Olovli zindonda Iblis bilan jang         |
| `PikselQala-fon-olam-*.png`  | Abadiyat olami: qishloq, o'rmon va daryo |

Har birida "PIKSEL QAL'A" logotipi, "O'ynab ko'r!" yozuvi va Telegram kanal (@piksel_qala) QR
kodi bor (QR `src/lib/qr.ts` bilan, tashqi xizmatsiz yaratiladi). Matn va QR o'ng tomonda — ish
stoli ikonkalari turadigan chap chetga tushmaydi. Fon rasmlari Windows workflow'ida Release'ga
ham qo'shiladi. Qayta chizish: `bun run dev` dan keyin
`PW_DIR=<playwright o'rnatilgan papka> node scripts/wallpapers.mjs`.
