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
