import { readFile, readdir } from "node:fs/promises";
import { GAME_VERSION, CHANGELOG } from "../src/game/version.ts";

const token = process.env.TELEGRAM_BOT_TOKEN;
const chat = process.env.TELEGRAM_CHANNEL;
const playUrl = process.env.GAME_URL_PUBLIC || "https://ulugbek-ar.github.io/Update-my-game/";
const repo = process.env.GITHUB_REPOSITORY;
const sha = process.env.GITHUB_SHA;
const version = process.env.SHOT_VERSION || GAME_VERSION;
if (!token || !chat) throw new Error("TELEGRAM_BOT_TOKEN yoki TELEGRAM_CHANNEL secret topilmadi");

const entry = CHANGELOG.find((e) => e.version === version) ?? CHANGELOG[0];
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const [y, m, d] = entry.date.split("-");
const bullets = entry.notes
  .split(/\.\s+/)
  .map((s) => s.trim().replace(/\.$/, ""))
  .filter(Boolean)
  .map((s) => `• ${esc(s)}`);

const links = [];
if (playUrl) links.push(`🎮 <a href="${esc(playUrl)}">O'ynash</a>`);
const prevTag = process.env.PREV_TAG;
if (repo && sha)
  links.push(
    `📜 <a href="https://github.com/${repo}/${prevTag ? `compare/${prevTag}...${sha}` : `commit/${sha}`}">Nima o'zgardi</a>`,
  );

const manual = await readdir(`screenshots/v${entry.version}`).then(
  (f) =>
    f
      .filter((x) => /\.(png|jpe?g)$/i.test(x))
      .sort()
      .map((x) => ({ file: `screenshots/v${entry.version}/${x}`, title: "" })),
  () => [],
);
const auto = JSON.parse(await readFile("shots/list.json", "utf8").catch(() => "[]"));
const heroes = auto.filter((s) => s.hero);
const mobs = auto.filter((s) => !s.hero && (s.mob || s.file.endsWith(".mp4")));
const shots = [...manual, ...auto.filter((s) => !mobs.includes(s) && !heroes.includes(s))].slice(
  0,
  10,
);
const titled = shots.map((s, i) => (s.title ? `${i + 1}. ${esc(s.title)}` : "")).filter(Boolean);

const head = [
  `🏰 <b>Piksel Qal'a — v${esc(entry.version)}</b>`,
  `📅 ${d}.${m}.${y}`,
  "",
  "🆕 <b>Yangilanishlar:</b>",
];
const pics = titled.length ? ["", "📸 <b>Rasmlarda:</b>", ...titled] : [];
const newMobs = [
  ...(heroes.length
    ? [
        "",
        `🧙 <b>Yangi qahramon:</b> ${heroes.map((s) => esc(s.title)).join(", ")} — pastdagi videoda`,
      ]
    : []),
  ...(mobs.length
    ? [
        "",
        `👾 <b>Yangi dushman:</b> ${mobs.map((s) => esc(s.title)).join(", ")} — pastdagi videoda`,
      ]
    : []),
];
const tail = ["", ...(links.length ? [links.join("   "), ""] : []), "#yangilanish"];
const limit = shots.length ? 1024 : 4096;
const allBullets = bullets.length;
const more = () =>
  bullets.length < allBullets ? [`• …va yana ${allBullets - bullets.length} ta o'zgarish`] : [];
const build = () => [...head, ...bullets, ...more(), ...newMobs, ...pics, ...tail].join("\n");
while (pics.length > 2 && build().length > limit) pics.pop();
while (bullets.length > 1 && build().length > limit) bullets.pop();
let caption = build();
if (caption.length > limit)
  caption = [...head, ...bullets.map((b) => b.slice(0, 300) + "…"), ...tail].join("\n");

const mime = (f) =>
  f.endsWith(".png") ? "image/png" : f.endsWith(".mp4") ? "video/mp4" : "image/jpeg";
const blob = async (f) => new Blob([await readFile(f)], { type: mime(f) });

async function send(method, fill) {
  for (let attempt = 1; ; attempt++) {
    const form = new FormData();
    form.append("chat_id", chat);
    await fill(form);
    let body;
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: "POST",
        body: form,
      });
      body = await res.json();
    } catch (e) {
      body = { ok: false, description: e.message };
    }
    if (body.ok) return;
    const wait = body.parameters?.retry_after ?? attempt * 5;
    const fatal = body.error_code && body.error_code < 500 && body.error_code !== 429;
    if (fatal || attempt >= 4) throw new Error(`Telegram xatosi (${method}): ${body.description}`);
    console.log(
      `Telegram javob bermadi (${body.description}), ${wait}s dan keyin qayta urinish...`,
    );
    await new Promise((r) => setTimeout(r, wait * 1000));
  }
}

if (!shots.length)
  await send("sendMessage", (f) => {
    f.append("text", caption);
    f.append("parse_mode", "HTML");
  });
else if (shots.length === 1)
  await send("sendPhoto", async (f) => {
    f.append("photo", await blob(shots[0].file), shots[0].file.split("/").pop());
    f.append("caption", caption);
    f.append("parse_mode", "HTML");
  });
else
  await send("sendMediaGroup", async (f) => {
    const media = [];
    for (const [i, s] of shots.entries()) {
      f.append(`img${i}`, await blob(s.file), s.file.split("/").pop());
      media.push({
        type: "photo",
        media: `attach://img${i}`,
        ...(i === 0 ? { caption, parse_mode: "HTML" } : {}),
      });
    }
    f.append("media", JSON.stringify(media));
  });
console.log("Post joylandi ✅", shots.map((s) => s.file).join(", "));

for (const item of [...heroes, ...mobs]) {
  const hero = heroes.includes(item);
  const text = [
    hero
      ? `🧙 <b>Yangi qahramon: ${esc(item.title)}</b>`
      : `👾 <b>Yangi dushman: ${esc(item.title)}</b>`,
    "",
    ...(item.text ? [esc(item.text), ""] : []),
    hero
      ? `🏰 Piksel Qal'a v${esc(entry.version)} dan boshlab o'ynash mumkin`
      : `🏰 Piksel Qal'a v${esc(entry.version)} da paydo bo'ladi`,
    `🎮 <a href="${esc(playUrl)}">O'ynash</a>`,
    "",
    hero ? "#yangi_qahramon" : "#yangi_dushman",
  ].join("\n");
  const textShort = [
    hero
      ? `🧙 <b>Yangi qahramon: ${esc(item.title)}</b>`
      : `👾 <b>Yangi dushman: ${esc(item.title)}</b>`,
    "",
    ...(item.text ? [esc(item.text.slice(0, 700)) + (item.text.length > 700 ? "…" : ""), ""] : []),
    `🎮 <a href="${esc(playUrl)}">O'ynash</a>`,
    "",
    hero ? "#yangi_qahramon" : "#yangi_dushman",
  ].join("\n");
  const isVideo = item.file.endsWith(".mp4");
  await send(isVideo ? "sendAnimation" : "sendPhoto", async (f) => {
    f.append(isVideo ? "animation" : "photo", await blob(item.file), item.file.split("/").pop());
    f.append("caption", text.length <= 1024 ? text : textShort);
    f.append("parse_mode", "HTML");
  });
  console.log(hero ? "Qahramon posti joylandi ✅" : "Mob posti joylandi ✅", item.title);
}
