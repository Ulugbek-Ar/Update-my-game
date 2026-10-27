import { readFile, readdir } from "node:fs/promises";
import { GAME_VERSION, CHANGELOG } from "../src/game/version.ts";

const token = process.env.TELEGRAM_BOT_TOKEN;
const chat = process.env.TELEGRAM_CHANNEL;
const playUrl = process.env.GAME_URL_PUBLIC;
const repo = process.env.GITHUB_REPOSITORY;
const sha = process.env.GITHUB_SHA;
if (!token || !chat) throw new Error("TELEGRAM_BOT_TOKEN yoki TELEGRAM_CHANNEL secret topilmadi");

const entry = CHANGELOG.find((e) => e.version === GAME_VERSION) ?? CHANGELOG[0];
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const [y, m, d] = entry.date.split("-");
const bullets = entry.notes
  .split(/\.\s+/)
  .map((s) => s.trim().replace(/\.$/, ""))
  .filter(Boolean)
  .map((s) => `• ${esc(s)}`);

const links = [];
if (playUrl) links.push(`🎮 <a href="${esc(playUrl)}">O'ynash</a>`);
if (repo && sha) links.push(`📜 <a href="https://github.com/${repo}/commit/${sha}">Nima o'zgardi</a>`);

const manual = await readdir(`screenshots/v${entry.version}`).then(
  (f) => f.filter((x) => /\.(png|jpe?g)$/i.test(x)).sort().map((x) => ({ file: `screenshots/v${entry.version}/${x}`, title: "" })),
  () => [],
);
const auto = JSON.parse(await readFile("shots/list.json", "utf8").catch(() => "[]"));
const shots = [...manual, ...auto].slice(0, 10);
if (!shots.length) throw new Error("Skrinshot topilmadi");
const files = shots.map((s) => s.file);
const titled = shots.map((s, i) => (s.title ? `${i + 1}. ${esc(s.title)}` : "")).filter(Boolean);

const head = [`🏰 <b>Piksel Qal'a — v${esc(entry.version)}</b>`, `📅 ${d}.${m}.${y}`, "", "🆕 <b>Yangilanishlar:</b>"];
const pics = titled.length ? ["", "📸 <b>Rasmlarda:</b>", ...titled] : [];
const tail = ["", ...(links.length ? [links.join("   "), ""] : []), "#yangilanish"];
const build = () => [...head, ...bullets, ...pics, ...tail].join("\n");
while (pics.length > 2 && build().length > 1024) pics.pop();
while (bullets.length > 1 && build().length > 1024) bullets.pop();
const caption = build().slice(0, 1024);

const blob = async (f) =>
  new Blob([await readFile(f)], { type: f.endsWith(".png") ? "image/png" : "image/jpeg" });
const form = new FormData();
form.append("chat_id", chat);
let method = "sendPhoto";
if (files.length === 1) {
  form.append("photo", await blob(files[0]), files[0].split("/").pop());
  form.append("caption", caption);
  form.append("parse_mode", "HTML");
} else {
  method = "sendMediaGroup";
  const media = [];
  for (const [i, f] of files.entries()) {
    form.append(`img${i}`, await blob(f), f.split("/").pop());
    media.push({ type: "photo", media: `attach://img${i}`, ...(i === 0 ? { caption, parse_mode: "HTML" } : {}) });
  }
  form.append("media", JSON.stringify(media));
}

const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
  method: "POST",
  body: form,
});
const body = await res.json();
if (!body.ok) throw new Error(`Telegram xatosi: ${body.description}`);
console.log("Post joylandi ✅", files.join(", "));
