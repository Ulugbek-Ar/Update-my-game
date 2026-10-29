# Piksel Qal'a — Telegram kanalga APK

Play Market'ga chiqqunga qadar Android ilova Telegram kanalda APK fayl sifatida tarqatiladi.

## Qachon yuboriladi

| Holat                                                                  | Kanalga                                                   |
| ---------------------------------------------------------------------- | --------------------------------------------------------- |
| `GAME_VERSION` **x.y.0** (masalan 2.3.0, 2.4.0) main'ga push qilindi   | post + `PikselQala-v<versiya>.apk`                        |
| `GAME_VERSION` **x.y.z**, z > 0 (masalan 2.3.1) — kichik tuzatish      | faqat post, APK yo'q                                      |
| **Actions → Telegram post → Run workflow**, "APK yuborish" belgilangan | joriy (eng oxirgi) versiya APK'si, post yuborilmaydi      |
| Imzo secrets yo'q                                                      | APK **yuborilmaydi**, workflow faqat ogohlantirish yozadi |

Qoidalar: `src/lib/apk.ts` (testlari bilan), yuborish: `scripts/telegram-apk.mjs`, workflow:
`.github/workflows/telegram-post.yml` (`apk-plan` → `apk-build` → `apk-send`). APK
`.github/workflows/android.yml` bilan yig'iladi. Post allaqachon chiqqan versiya qayta push
qilinsa (`tg-v<versiya>` tegi bor), APK ham qayta yuborilmaydi.

APK izohida qisqa o'zbekcha yo'riqnoma bor: yuklab olish → o'rnatish → "Noma'lum manbalardan
o'rnatish"ga ruxsat berish, va "Yangi versiyani eskisi ustidan o'rnating — saqlanishlar o'chmaydi."

## Nima uchun har doim bitta keystore

Android yangi versiyani eskisi ustidan faqat **ikkalasi bir xil kalit bilan imzolangan** bo'lsa
o'rnatadi. Kalit o'zgarsa, o'yinchi eski ilovani o'chirishga majbur bo'ladi va saqlanishlari
(rekord, oltin, do'kon, yutuqlar, olam) yo'qoladi. Shuning uchun:

- APK faqat secrets'dagi doimiy keystore bilan imzolanadi. Debug imzoli APK kanalga hech qachon
  yuborilmaydi (har bir GitHub runner'da debug kaliti boshqacha).
- Keystore va parolni **yo'qotmang** — zaxira nusxasini parol menejeri yoki shaxsiy bulutda saqlang.
- Keystore faylini **repoga qo'shmang** (`.gitignore` `*.jks`, `*.keystore`, `*.p12` ni o'tkazmaydi).

Keystore ma'lumotlari:

|       |                                                                       |
| ----- | --------------------------------------------------------------------- |
| Fayl  | `pikselqala-upload.jks` (PKCS12, RSA 2048, 2054-yilgacha amal qiladi) |
| Alias | `pikselqala`                                                          |
| Parol | keystore va kalit paroli bir xil (PKCS12)                             |

## GitHub secrets qo'shish

1. GitHub'da repo → **Settings** → chap menyuda **Secrets and variables** → **Actions**.
2. **New repository secret** tugmasi bilan quyidagi to'rttasini birma-bir qo'shing
   (Name — aynan shunday, Secret — qiymati):

   | Name                        | Secret (qiymat)                                                        |
   | --------------------------- | ---------------------------------------------------------------------- |
   | `ANDROID_KEYSTORE_BASE64`   | `pikselqala-upload.b64.txt` dagi butun matn (bitta qator, bo'shliqsiz) |
   | `ANDROID_KEYSTORE_PASSWORD` | keystore paroli                                                        |
   | `ANDROID_KEY_ALIAS`         | `pikselqala`                                                           |
   | `ANDROID_KEY_PASSWORD`      | keystore paroli bilan bir xil                                          |

3. Telegram secrets (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHANNEL`) avvaldan bor — ular post uchun
   ishlatilgan, APK ham shu bot orqali yuboriladi.
4. Tekshirish: **Actions → Android → Run workflow** — Release'da `PikselQala-v<versiya>.apk`
   paydo bo'lsa (`-debug` qo'shimchasisiz), imzo ishlayapti.
5. Kanalga yuborish: **Actions → Telegram post → Run workflow** → **"APK yuborish"** ni belgilang →
   **Run workflow**.

Base64 matnni keystore faylidan qayta olish:

```sh
base64 -w0 pikselqala-upload.jks
```

(macOS'da: `base64 -i pikselqala-upload.jks`.)

Yangi keystore kerak bo'lsa (masalan boshqa ilova uchun) — `keytool` (JDK ichida):

```sh
keytool -genkeypair -v -storetype PKCS12 -keystore pikselqala-upload.jks -alias pikselqala -keyalg RSA -keysize 2048 -validity 10000
```

Piksel Qal'a uchun esa keystore **almashtirilmaydi** — yuqoridagi sababga ko'ra.

## Play Market bilan bog'liqlik

Telegram'dan o'rnatgan o'yinchilar keyinchalik Play Market'dan ham yangilana olishi uchun Play
Market'dagi ilova **shu kalit bilan** imzolanishi kerak. Play Console'da birinchi relizda
**Play App Signing** bosqichida "Use Google-generated key" o'rniga **o'z kalitingizni yuklash**ni
tanlang ("Export and upload a key from Java KeyStore") va Console ko'rsatgan PEPK buyrug'i bilan
`pikselqala-upload.jks` dagi `pikselqala` kalitini yuklang. Aks holda Play Market versiyasi boshqa
kalit bilan imzolanadi va Telegram APK'sini o'rnatganlar Play'dan yangilash uchun ilovani o'chirib
qayta o'rnatishi kerak bo'ladi. Batafsil: `docs/play-market.md`.
