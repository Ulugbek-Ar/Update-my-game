// Imzolangan Android APK'ni Telegram kanalga yuborish (sendDocument).
// Ishga tushirish: node --experimental-strip-types scripts/telegram-apk.mjs
// Muhit: TELEGRAM_BOT_TOKEN, TELEGRAM_CHANNEL, APK_VERSION, APK_FILE (yig'ilgan imzolangan APK).
import { access, readFile } from "node:fs/promises";
import { apkCaption, apkFileName } from "../src/lib/apk.ts";

const token = process.env.TELEGRAM_BOT_TOKEN;
const chat = process.env.TELEGRAM_CHANNEL;
const version = process.env.APK_VERSION;
const file = process.env.APK_FILE;
if (!token || !chat) throw new Error("TELEGRAM_BOT_TOKEN yoki TELEGRAM_CHANNEL secret topilmadi");
if (!version || !file) throw new Error("APK_VERSION va APK_FILE kerak");
await access(file);

const apk = new Blob([await readFile(file)], { type: "application/vnd.android.package-archive" });
console.log(`APK: ${file} (${(apk.size / 1024 / 1024).toFixed(1)} MB)`);

for (let attempt = 1; ; attempt++) {
  const form = new FormData();
  form.append("chat_id", chat);
  form.append("document", apk, apkFileName(version));
  form.append("caption", apkCaption(version));
  let body;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: "POST",
      body: form,
    });
    body = await res.json();
  } catch (e) {
    body = { ok: false, description: e.message };
  }
  if (body.ok) break;
  const wait = body.parameters?.retry_after ?? attempt * 5;
  const fatal = body.error_code && body.error_code < 500 && body.error_code !== 429;
  if (fatal || attempt >= 4) throw new Error(`Telegram xatosi (sendDocument): ${body.description}`);
  console.log(`Telegram javob bermadi (${body.description}), ${wait}s dan keyin qayta urinish...`);
  await new Promise((r) => setTimeout(r, wait * 1000));
}
console.log(`::notice title=Telegram::${apkFileName(version)} kanalga yuborildi`);
