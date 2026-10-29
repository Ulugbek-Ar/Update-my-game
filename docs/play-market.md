# Piksel Qal'a — Play Market'ga chiqarish yo'riqnomasi

Bu yo'riqnoma Play Console'da ilova yaratishdan boshlab yopiq testgacha bo'lgan qadamlarni
ko'rsatadi. Ilova: **Piksel Qal'a**, paket nomi (appId): `com.ulugbek.pikselqala`.

> Paket nomi Play Market'ga birinchi yuklangandan keyin **hech qachon o'zgarmaydi**.
> `capacitor.config.ts` dagi `server.androidScheme` va `hostname` ham o'zgartirilmasin —
> aks holda o'yinchilarning saqlanishlari (rekord, oltin, do'kon, yutuqlar, olam) yo'qoladi.

## 0. Repodagi tayyor narsalar

| Narsa                             | Joyi                                                                    |
| --------------------------------- | ----------------------------------------------------------------------- |
| Android loyiha (Capacitor)        | `android/`                                                              |
| Ilova uchun statik build          | `npm run build:app` → `dist/client`                                     |
| AAB/APK yig'ish                   | `.github/workflows/android.yml` → GitHub Releases (`v<VERSIYA>`)        |
| Versiya                           | faqat `src/game/version.ts` (`GAME_VERSION`). 2.3.0 → versionCode 20300 |
| Qisqa va to'liq tavsif            | `store/uz/`, `store/ru/` (`title.txt`, `short.txt`, `full.txt`)         |
| Ikonka 512x512                    | `store/icon-512.png`                                                    |
| Feature graphic 1024x500          | `store/feature-graphic.png`                                             |
| Telefon skrinshotlari (1920x1080) | `store/screenshots/`                                                    |
| Maxfiylik siyosati                | https://ulugbek-ar.github.io/Update-my-game/privacy.html                |

Rasmlarni qayta chizish (`bun run dev` ishlab turganda):

```sh
node scripts/make-icons.mjs        # ikonkalar: sayt, Android, store/icon-512.png
node scripts/store-graphics.mjs    # store/feature-graphic.png
VITE_STATIC=1 bun run dev          # (skrinshot uchun: AI tugmasisiz)
SHOT_FILE=store/screenshots.json SHOT_OUT=store/screenshots node scripts/screenshot.mjs
```

> `public/privacy.html` dagi Telegram kanal havolasini (`https://t.me/TELEGRAM_KANAL`)
> haqiqiy kanal manziliga almashtiring.

## 1. Imzo kaliti (keystore)

Keystore allaqachon yaratilgan: `pikselqala-upload.jks`, alias `pikselqala` (fayl va parol
egasida saqlanadi, repoda yo'q). Shu bitta kalit bilan Telegram kanaldagi APK ham, Play Market'ga
yuklanadigan AAB ham imzolanadi — u **hech qachon almashtirilmaydi** (sabab va secrets qo'shish:
`docs/apk.md`).

Google Play **Play App Signing** ishlatadi. Telegram APK'sini o'rnatgan o'yinchilar Play Market'dan
ham yangilana olishi uchun Play'dagi ilova shu kalit bilan imzolanishi kerak — 6-bo'limdagi
birinchi relizda **o'z kalitingizni yuklang** (Google yaratgan kalitni emas).

## 2. GitHub secrets

Repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret                      | Qiymat                                                 |
| --------------------------- | ------------------------------------------------------ |
| `ANDROID_KEYSTORE_BASE64`   | keystore faylining base64 matni (`docs/apk.md`)        |
| `ANDROID_KEYSTORE_PASSWORD` | keystore paroli                                        |
| `ANDROID_KEY_ALIAS`         | `pikselqala` (keytool'dagi `-alias`)                   |
| `ANDROID_KEY_PASSWORD`      | kalit paroli (PKCS12 da keystore paroli bilan bir xil) |

Keyin **Actions → Android → Run workflow**. Natija **Releases** bo'limida (`v2.3.0`):

- `PikselQala-v2.3.0.aab` — Play Console'ga yuklanadi;
- `PikselQala-v2.3.0.apk` — telefonga to'g'ridan-to'g'ri o'rnatib sinash uchun.

Secrets bo'lmasa, workflow faqat imzosiz `PikselQala-v<VERSIYA>-debug.apk` yig'adi (sinash uchun
yaroqli, Play Market'ga emas). `GAME_VERSION` o'zgarib main'ga push qilinganda workflow o'zi
ishlaydi.

## 3. Play Console hisobi va ilova yaratish

1. https://play.google.com/console — dasturchi hisobini oching (bir martalik 25$ to'lov,
   shaxsni tasdiqlash). Shaxsiy (personal) hisob tanlash mumkin.
2. **Create app**:
   - App name: `Piksel Qal'a`
   - Default language: o'zbekcha (`uz`) — mavjud bo'lmasa, `Russian – ru-RU`, o'zbekchani esa
     tarjima sifatida qo'shing.
   - App or game: **Game**
   - Free or paid: **Free**
   - Deklaratsiyalarga (Developer Program Policies, US export laws) rozilik belgilari.

## 4. Store listing (Main store listing)

- **App name**: `store/uz/title.txt`
- **Short description** (80 belgigacha): `store/uz/short.txt`
- **Full description** (4000 belgigacha): `store/uz/full.txt`
- Ruscha tarjima: **Manage translations → Add translations → Russian** va `store/ru/` fayllari.
- **App icon**: `store/icon-512.png`
- **Feature graphic**: `store/feature-graphic.png`
- **Phone screenshots**: `store/screenshots/01.png` … `07.png` (kamida 2 ta, 8 tagacha).
- **App category**: Game → **Role Playing** (yoki Action). Tags: Retro, Pixel, RPG.
- **Contact details**: elektron pochta (majburiy), sayt: https://ulugbek-ar.github.io/Update-my-game/

## 5. App content (Policy → App content)

Har bo'limni **Start** bilan ochib to'ldiring:

### Privacy policy

`https://ulugbek-ar.github.io/Update-my-game/privacy.html`

### Ads

**No, my app does not contain ads.**

### App access

**All functionality is available without special access** (login yo'q).

### Content rating (IARC so'rovnomasi)

- Email, kategoriya: **Game**.
- Violence: **Yes** — fantastik/multfilm uslubidagi zo'ravonlik (piksel qahramon qilich, sehr va
  o'q bilan yirtqich va bosslarga qarshi jang qiladi, qon yo'q, real odamlarga zo'ravonlik yo'q).
- Fear/horror: yengil fantastik maxluqlar (skeletlar, Iblis) — "mild".
- Sexuality, nudity, bad language, drugs, alcohol, tobacco: **No**.
- Gambling / simulated gambling: **No** (sandiq va kartalar pulga sotilmaydi).
- User interaction / chat, sharing location, digital purchases: **No**.
- Kutilgan natija: taxminan **PEGI 7 / ESRB Everyone 10+** (fantasy violence).

### Target audience and content

- Maqsadli yosh: **13–15, 16–17, 18+** tavsiya etiladi. 13 dan kichik yoshlarni tanlasangiz,
  ilova Google'ning "Families" talablariga to'liq mos bo'lishi va qo'shimcha tekshiruvdan
  o'tishi kerak.
- "Could your store listing unintentionally appeal to children?" — **No** (yoki rost javob).

### Data safety

- Does your app collect or share any of the required user data types? → **No**.
- Is all of the user data collected by your app encrypted in transit? → savol chiqmaydi
  (ma'lumot yig'ilmaydi).
- Do you provide a way for users to request that their data is deleted? → kerak emas
  (ma'lumot yig'ilmaydi; saqlanishlar faqat qurilmada, ilovani o'chirish bilan o'chadi).
- Natija: **"No data collected"**, **"No data shared"**.

### Boshqa deklaratsiyalar

- Government app: **No**. Financial features: **None**. Health: **No**. News app: **No**.
- COVID-19 contact tracing: **No**. Data safety → Advertising ID: **No** (reklama SDK yo'q).

## 6. Yopiq test (Closed testing)

2023-yil noyabridan keyin ochilgan **shaxsiy** hisoblar uchun: production'ga chiqishdan oldin
yopiq testda **kamida 12 nafar testchi 14 kun uzluksiz** ilovani o'rnatgan bo'lishi shart.

1. **Testing → Closed testing → Create track** (yoki standart "Alpha").
2. **Testers**: Google Group yoki elektron pochta ro'yxati (Email list) yarating, 12+ testchining
   Google hisobi pochtasini qo'shing (Telegram kanaldan ko'ngillilar yig'ish qulay).
3. **Countries/regions**: O'zbekiston va kerakli boshqa davlatlar.
4. **Create new release**:
   - **Play App Signing** → "Change app signing key" → **"Export and upload a key from Java
     KeyStore"**: Console bergan PEPK vositasi va buyrug'i bilan `pikselqala-upload.jks`
     (alias `pikselqala`) kalitini yuklang. Shunda Play'dagi ilova Telegram APK'si bilan bir xil
     kalitda bo'ladi va o'yinchilar o'chirmasdan yangilanadi. Upload key alohida so'ralsa — o'sha
     kalitning sertifikatini bering (AAB'lar shu kalit bilan imzolanadi).
   - Releases'dan olingan `PikselQala-v2.3.0.aab` ni yuklang.
   - Release name avtomatik (`20300 (2.3.0)`); release notes'ga `CHANGELOG` dagi matnni yozing.
5. **Review release → Start rollout to Closed testing**. Birinchi tekshiruv bir necha kundan
   bir haftagacha davom etishi mumkin.
6. Tasdiqlangach, testchilarga **"Join on the web"** havolasini yuboring — ular havola orqali
   testga qo'shilib, Play Market'dan o'rnatadi. 14 kun davomida o'ynab, fikr bildirishlari kerak.
7. 14 kundan keyin **Dashboard → Apply for production** — so'rovnomani to'ldirib, production'ga
   ruxsat so'raysiz.

## 7. Yangi versiya chiqarish

1. `src/game/version.ts` da `GAME_VERSION` ni oshiring va `CHANGELOG` ga yozuv qo'shing
   (CLAUDE.md qoidasi). versionCode o'zi oshadi (masalan 2.3.1 → 20301).
2. main'ga push — **Android** workflow AAB/APK yig'ib Release'ga yuklaydi, Telegram posti chiqadi
   (x.y.0 versiyada post bilan birga APK ham — `docs/apk.md`).
3. Play Console → kerakli trek → **Create new release** → yangi AAB.

## 8. Telefonda sinash

- Releases'dagi `.apk` ni telefonga yuklab o'rnating ("Noma'lum manbalar"ga ruxsat berish kerak).
- Tekshirish: o'yin gorizontal va to'liq ekran ochiladimi; "Orqaga" — o'yinda pauza, pauzada
  davom, do'kon/sozlamalarni yopadi, bosh menyuda "Chiqishni xohlaysizmi?"; ilovani fonga olib,
  qaytganda pauza menyusi va ovoz to'xtaganmi; internetni o'chirib ham ishlaydimi.
- Play App Signing'da Google yaratgan kalit tanlansa, Play'dagi ilova va Telegram/Releases APK'si
  turli kalitda bo'ladi — bir telefonda biridan ikkinchisiga o'tish uchun ilovani o'chirish kerak
  (saqlanishlar ham o'chadi). Shuning uchun 6-bo'limda o'z kalitingizni yuklang.
