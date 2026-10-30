// Kompyuter (PC) fayllarini Telegram kanalga yuborish: PikselQala-Windows.zip va
// PikselQala-portable.zip. 50 MB dan katta fayl o'rniga Release havolasi yuboriladi.
// Ishga tushirish: node --experimental-strip-types scripts/telegram-pc.mjs
// Muhit: TELEGRAM_BOT_TOKEN, TELEGRAM_CHANNEL, PC_VERSION, PC_DIR (fayllar papkasi),
// GITHUB_REPOSITORY (Release havolasi uchun).
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import {
  PORTABLE_ZIP,
  WINDOWS_ZIP,
  fitsTelegram,
  pcCaption,
  releaseUrl,
  tooBigMessage,
} from "../src/lib/pcfiles.ts";

const token = process.env.TELEGRAM_BOT_TOKEN;
const chat = process.env.TELEGRAM_CHANNEL;
const version = process.env.PC_VERSION;
const dir = process.env.PC_DIR ?? "pc";
const repo = process.env.GITHUB_REPOSITORY ?? "Ulugbek-Ar/Update-my-game";
if (!token || !chat) throw new Error("TELEGRAM_BOT_TOKEN yoki TELEGRAM_CHANNEL secret topilmadi");
if (!version) throw new Error("PC_VERSION kerak");
const url = releaseUrl(repo, version);

async function call(method, body) {
  for (let attempt = 1; ; attempt++) {
    let res;
    try {
      const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: "POST",
        ...(body instanceof FormData
          ? { body }
          : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
      });
      res = await r.json();
    } catch (e) {
      res = { ok: false, description: e.message };
    }
    if (res.ok) return res;
    const wait = res.parameters?.retry_after ?? attempt * 5;
    const fatal = res.error_code && res.error_code < 500 && res.error_code !== 429;
    if (fatal || attempt >= 4) throw new Error(`Telegram xatosi (${method}): ${res.description}`);
    console.log(`Telegram javob bermadi (${res.description}), ${wait}s dan keyin qayta urinish...`);
    await new Promise((r) => setTimeout(r, wait * 1000));
  }
}

for (const name of [WINDOWS_ZIP, PORTABLE_ZIP]) {
  const file = path.join(dir, name);
  const size = await stat(file).then(
    (s) => s.size,
    () => 0,
  );
  if (!size) {
    console.log(`::warning title=PC::${name} topilmadi — o'tkazib yuborildi`);
    continue;
  }
  console.log(`${name}: ${(size / 1024 / 1024).toFixed(1)} MB`);
  if (!fitsTelegram(size)) {
    await call("sendMessage", { chat_id: chat, text: tooBigMessage(name, version, url) });
    console.log(`::notice title=PC::${name} 50 MB dan katta — Release havolasi yuborildi`);
    continue;
  }
  const form = new FormData();
  form.append("chat_id", chat);
  form.append("document", new Blob([await readFile(file)], { type: "application/zip" }), name);
  form.append("caption", pcCaption(name, version));
  await call("sendDocument", form);
  console.log(`::notice title=Telegram::${name} kanalga yuborildi`);
}
