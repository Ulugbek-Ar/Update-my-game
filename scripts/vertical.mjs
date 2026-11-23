// TikTok / Shorts / Reels uchun vertikal video (1080x1920): scripts/screenshot.mjs yozgan
// sahnalardan (shots/list.json) — tepada "PIKSEL QAL'A v<VERSIYA>", har sahna ustida title,
// o'yin kadri markazda kattalashtirilgan, oxirida 2 s "O'YNASH: <havola>". Jami 15–45 s.
//
//   PW_DIR=<playwright papkasi> node --experimental-strip-types scripts/vertical.mjs
//
// Env: SHOT_OUT (shots), SHOT_VERSION, GAME_URL_PUBLIC (sayt), PW_CHANNEL.
// VERTICAL_SEND=1 + TELEGRAM_BOT_TOKEN + ADMIN_TELEGRAM_IDS — video va tayyor matn faqat
// muallifga (ro'yxatdagi birinchi ID) shaxsiy xabar bo'lib boradi, kanalga EMAS.
import { createRequire } from "node:module";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile, writeFile, mkdir, rm, access } from "node:fs/promises";
import path from "node:path";

const require = createRequire(path.join(process.env.PW_DIR ?? process.cwd(), "x.js"));
let FFMPEG = "ffmpeg";
try {
  FFMPEG = require("ffmpeg-static") || "ffmpeg";
} catch {}

const OUT = process.env.SHOT_OUT || "shots";
const { GAME_VERSION, CHANGELOG } = await import(path.resolve("src/game/version.ts"));
const version = process.env.SHOT_VERSION || GAME_VERSION;
const playUrl = process.env.GAME_URL_PUBLIC || "https://ulugbek-ar.github.io/Update-my-game/";
const W = 1080;
const H = 1920;
// o'yin kadri: 1080x810 — 320x240 xona (4:3) eni bo'yicha to'liq, ekran markazida
const FRAME = { y: 660, h: 810 };
const MIN = 15;
const MAX = 45;
const OUTRO = 2;
const STILL = 3;

const list = JSON.parse(await readFile(`${OUT}/list.json`, "utf8"));
if (!list.length) throw new Error(`${OUT}/list.json bo'sh — avval scripts/screenshot.mjs`);

const ff = (args) => execFileSync(FFMPEG, ["-y", "-loglevel", "error", ...args]);
const duration = (file) => {
  const r = spawnSync(FFMPEG, ["-i", file], { encoding: "utf8" });
  const m = r.stderr.match(/Duration: (\d+):(\d+):([\d.]+)/);
  return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : STILL;
};

// ── Sahnalar va vaqt: 15–45 s (outro bilan) ──────────────────────────────────
let segs = list.map((s) => ({
  file: s.file,
  title: s.title || "",
  video: s.file.endsWith(".mp4"),
  len: s.file.endsWith(".mp4") ? duration(s.file) : STILL,
}));
const total = () => segs.reduce((a, s) => a + s.len, 0) + OUTRO;
if (total() > MAX) {
  const k = (MAX - OUTRO) / (total() - OUTRO);
  segs.forEach((s) => (s.len = Math.max(1.5, s.len * k)));
  while (total() > MAX && segs.length > 1) segs.pop();
}
if (total() < MIN) {
  // qisqa bo'lsa: rasmlar uzoqroq turadi, keyin sahnalar qaytadan aylanadi
  segs.filter((s) => !s.video).forEach((s) => (s.len = 5));
  const base = segs.slice();
  for (let i = 0; total() < MIN; i++) segs.push({ ...base[i % base.length] });
}
segs.forEach((s) => (s.len = Math.round(s.len * 100) / 100));

// ── Yozuvlar (o'yin shrifti Press Start 2P) Playwright bilan PNG qilib chiziladi ───
const font = await readFile(
  "node_modules/@fontsource/press-start-2p/files/press-start-2p-latin-400-normal.woff2",
).then(
  (b) => `@font-face{font-family:P;src:url(data:font/woff2;base64,${b.toString("base64")})}`,
  () => "",
);
const esc = (t) => t.replace(/[&<>]/g, (c) => `&${{ "&": "amp", "<": "lt", ">": "gt" }[c]};`);
// shriftda yo'q belgilar
const clean = (t) =>
  t
    .replace(/[—–]/g, "-")
    .replace(/[ʻʼ‘’`]/g, "'")
    .replace(/[«»“”]/g, '"');
const css = `${font}
*{margin:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px;overflow:hidden}
body{font-family:P,monospace;color:#fff;text-align:center;image-rendering:pixelated;
  background:#140f22 repeating-linear-gradient(0deg,#0000 0 8px,#ffffff06 8px 16px)}
.px{text-shadow:6px 0 #000,-6px 0 #000,0 6px #000,0 -6px #000,6px 6px #000,-6px 6px #000,6px -6px #000,-6px -6px #000,0 12px #3b1f5e}
.head{position:absolute;top:96px;left:0;right:0}
.logo{font-size:84px;line-height:1.15;color:#ffd447}
.ver{margin-top:28px;font-size:52px;color:#7cf0ff}
.title{position:absolute;top:380px;left:40px;right:40px;height:${FRAME.y - 400}px;display:flex;
  align-items:center;justify-content:center;font-size:44px;line-height:1.35}
.frame{position:absolute;top:${FRAME.y - 12}px;left:0;right:0;height:${FRAME.h + 24}px;
  background:#ffd447;box-shadow:0 12px #3b1f5e}
.foot{position:absolute;top:${FRAME.y + FRAME.h + 90}px;left:30px;right:30px;font-size:28px;
  line-height:1.6;color:#b9a8ff;word-break:break-all}
.outro{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;gap:80px;padding:0 50px}
.big{font-size:96px;color:#ffd447}
.url{font-size:46px;line-height:1.5;color:#7cf0ff;word-break:break-all}`;
const host = playUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
const head = `<div class="head px"><div class="logo">PIKSEL QAL'A</div><div class="ver">v${esc(version)}</div></div>`;
const scenePage = (title) =>
  `${head}<div class="title px">${esc(clean(title))}</div><div class="frame"></div>` +
  `<div class="foot px">O'YNASH:<br>${esc(host)}</div>`;
const outroPage = `${head}<div class="outro px"><div class="big">O'YNASH:</div><div class="url">${esc(host)}</div></div>`;

const TMP = `${OUT}/vertical`;
await rm(TMP, { recursive: true, force: true });
await mkdir(TMP, { recursive: true });
const { chromium } = require("playwright");
const browser = await chromium.launch(
  process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {},
);
const page = await browser.newPage({ viewport: { width: W, height: H } });
const draw = async (body, file) => {
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>${css}</style>${body}`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: file });
};
const titles = [...new Set(segs.map((s) => s.title))];
for (const [i, t] of titles.entries()) await draw(scenePage(t), `${TMP}/bg${i}.png`);
await draw(outroPage, `${TMP}/outro.png`);
await browser.close();

// ── Har sahna alohida bo'lak, keyin ulash ───────────────────────────────────
const enc = [
  "-r",
  "30",
  "-c:v",
  "libx264",
  "-preset",
  "veryfast",
  "-crf",
  "20",
  "-pix_fmt",
  "yuv420p",
];
const aud = ["-c:a", "aac", "-b:a", "96k", "-ar", "44100", "-ac", "2"];
const parts = [];
for (const [i, s] of segs.entries()) {
  const bg = `${TMP}/bg${titles.indexOf(s.title)}.png`;
  const part = `${TMP}/p${String(i).padStart(2, "0")}.mp4`;
  const fade = `fade=t=in:st=0:d=0.25,fade=t=out:st=${Math.max(0, s.len - 0.25)}:d=0.25`;
  ff([
    "-loop",
    "1",
    "-framerate",
    "30",
    "-i",
    bg,
    ...(s.video ? ["-i", s.file] : ["-loop", "1", "-framerate", "30", "-i", s.file]),
    "-f",
    "lavfi",
    "-i",
    "anullsrc=r=44100:cl=stereo",
    "-filter_complex",
    `[1:v]fps=30,scale=${W}:${FRAME.h}:force_original_aspect_ratio=increase:flags=neighbor,` +
      `crop=${W}:${FRAME.h},${fade}[g];[0:v][g]overlay=0:${FRAME.y}:shortest=0,setsar=1[v]`,
    "-map",
    "[v]",
    "-map",
    "2:a",
    "-t",
    String(s.len),
    ...enc,
    ...aud,
    part,
  ]);
  parts.push(part);
}
const outro = `${TMP}/p99.mp4`;
ff([
  "-loop",
  "1",
  "-framerate",
  "30",
  "-i",
  `${TMP}/outro.png`,
  "-f",
  "lavfi",
  "-i",
  "anullsrc=r=44100:cl=stereo",
  "-vf",
  "fade=t=in:st=0:d=0.3,setsar=1",
  "-t",
  String(OUTRO),
  ...enc,
  ...aud,
  outro,
]);
parts.push(outro);
await writeFile(`${TMP}/list.txt`, parts.map((p) => `file '${path.resolve(p)}'`).join("\n"));
const file = `${OUT}/vertical-v${version}.mp4`;
ff([
  "-f",
  "concat",
  "-safe",
  "0",
  "-i",
  `${TMP}/list.txt`,
  "-c",
  "copy",
  "-movflags",
  "+faststart",
  file,
]);
const secs = Math.round(duration(file) * 10) / 10;

// ── Tayyor matn: CHANGELOG'dan 1–2 gap + heshteglar ─────────────────────────
const notes = CHANGELOG.find((c) => c.version === version)?.notes ?? "";
const lead = (notes.match(/[^.!?]+[.!?]+/g) ?? [notes])
  .map((x) => x.trim())
  .filter(Boolean)
  .reduce((a, x) => (a.length < 2 && (a.join(" ") + x).length < 220 ? [...a, x] : a), [])
  .join(" ");
const caption = [
  `Piksel Qal'a v${version}`,
  lead,
  `O'ynash: ${playUrl}`,
  "#pikselqala #pixelart #indiegame #gamedev #uzbekistan",
]
  .filter(Boolean)
  .join("\n\n");
await writeFile(`${OUT}/vertical-v${version}.txt`, caption + "\n");
await rm(TMP, { recursive: true, force: true });
console.log(`::notice title=Vertikal video::${file} — ${secs} s, ${segs.length} sahna`);

// ── Faqat muallifga (kanalga EMAS) ──────────────────────────────────────────
if (process.env.VERTICAL_SEND === "1") {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = (process.env.ADMIN_TELEGRAM_IDS ?? "").split(/[\s,]+/).find(Boolean);
  if (!token || !chat) {
    console.log(
      "::warning title=Vertikal video::TELEGRAM_BOT_TOKEN yoki ADMIN_TELEGRAM_IDS yo'q — yuborilmadi",
    );
    process.exit(0);
  }
  await access(file);
  const form = new FormData();
  form.append("chat_id", chat);
  form.append("caption", caption.slice(0, 1024));
  form.append("supports_streaming", "true");
  form.append("width", String(W));
  form.append("height", String(H));
  form.append("duration", String(Math.round(secs)));
  form.append(
    "video",
    new Blob([await readFile(file)], { type: "video/mp4" }),
    path.basename(file),
  );
  const res = await fetch(`https://api.telegram.org/bot${token}/sendVideo`, {
    method: "POST",
    body: form,
  }).then((r) => r.json());
  if (!res.ok) throw new Error(`Telegram: ${res.description}`);
  console.log("::notice title=Vertikal video::muallifga shaxsiy xabar bo'lib yuborildi");
}
