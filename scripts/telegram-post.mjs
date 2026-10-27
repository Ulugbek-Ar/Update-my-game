import { readFile } from "node:fs/promises";
import { GAME_VERSION, CHANGELOG } from "../src/game/version.ts";

const token = process.env.TELEGRAM_BOT_TOKEN;
const chat = process.env.TELEGRAM_CHANNEL;
const playUrl = process.env.GAME_URL_PUBLIC;
if (!token || !chat) throw new Error("TELEGRAM_BOT_TOKEN yoki TELEGRAM_CHANNEL secret topilmadi");

const entry = CHANGELOG.find((e) => e.version === GAME_VERSION) ?? CHANGELOG[0];
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const [y, m, d] = entry.date.split("-");
const bullets = entry.notes
  .split(/\.\s+/)
  .map((s) => s.trim().replace(/\.$/, ""))
  .filter(Boolean)
  .map((s) => `• ${esc(s)}`);

let caption = [
  `🏰 <b>Piksel Qal'a — v${esc(entry.version)}</b>`,
  `📅 ${d}.${m}.${y}`,
  "",
  "🆕 <b>Yangilanishlar:</b>",
  ...bullets,
  "",
  playUrl ? `🎮 <a href="${esc(playUrl)}">O'ynash</a>` : "",
  "#yangilanish",
]
  .filter((l, i, a) => l !== "" || a[i - 1] !== "")
  .join("\n");
if (caption.length > 1024) caption = caption.slice(0, 1020) + "…";

const form = new FormData();
form.append("chat_id", chat);
form.append("caption", caption);
form.append("parse_mode", "HTML");
form.append("photo", new Blob([await readFile("shot.png")], { type: "image/png" }), "shot.png");

const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
  method: "POST",
  body: form,
});
const body = await res.json();
if (!body.ok) throw new Error(`Telegram xatosi: ${body.description}`);
console.log("Post joylandi ✅");
