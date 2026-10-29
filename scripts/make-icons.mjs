// Ilova ikonkalari (manifest.webmanifest): Ritsar sprite'idan kod bilan chiziladi.
// Ishga tushirish: `bun run dev` dan keyin `PW_DIR=<playwright papkasi> node scripts/make-icons.mjs`
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const require = createRequire(path.join(process.env.PW_DIR ?? process.cwd(), "x.js"));
const { chromium } = require("playwright");
const URL = process.env.GAME_URL ?? "http://127.0.0.1:5173";
const OUT = "public/icons";

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(URL, { waitUntil: "networkidle", timeout: 120_000 });
const icons = await page.evaluate(async () => {
  const { renderSprite } = await import("/src/game/sprites.ts");
  // 32x32 sprite kadri — keyin butun piksellar bilan kattalashtiriladi
  const src = document.createElement("canvas");
  src.width = src.height = 32;
  renderSprite(src.getContext("2d"), "knight", "idle", 0, 16, 16, false);
  const make = (size, maskable) => {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d");
    g.imageSmoothingEnabled = false;
    g.fillStyle = "#1f1730";
    g.fillRect(0, 0, size, size);
    // maskable: ikonka markazdagi 80% xavfsiz doiraga sig'adi
    const k = Math.floor((size * (maskable ? 0.75 : 1)) / 32);
    const d = 32 * k;
    g.drawImage(src, (size - d) / 2, (size - d) / 2, d, d);
    return c.toDataURL("image/png").split(",")[1];
  };
  return {
    "icon-192.png": make(192, false),
    "icon-512.png": make(512, false),
    "icon-maskable-192.png": make(192, true),
    "icon-maskable-512.png": make(512, true),
  };
});
await mkdir(OUT, { recursive: true });
for (const [name, b64] of Object.entries(icons))
  await writeFile(`${OUT}/${name}`, Buffer.from(b64, "base64"));
await browser.close();
console.log(`✓ ${Object.keys(icons).length} ta ikonka: ${OUT}/`);
