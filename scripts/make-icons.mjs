// Ilova ikonkalari: Ritsar sprite'idan kod bilan chiziladi.
// - public/icons — sayt (manifest.webmanifest)
// - android/app/src/main/res — Android adaptive icon (fon + old qatlam), eski ikonkalar va splash
// - store/icon-512.png — Play Market ikonkasi
// Ishga tushirish: `bun run dev` dan keyin `PW_DIR=<playwright papkasi> node scripts/make-icons.mjs`
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const require = createRequire(path.join(process.env.PW_DIR ?? process.cwd(), "x.js"));
const { chromium } = require("playwright");
const URL = process.env.GAME_URL ?? "http://127.0.0.1:5173";
const RES = "android/app/src/main/res";
/** Android zichliklari: 1dp necha piksel */
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(URL, { waitUntil: "networkidle", timeout: 120_000 });
const icons = await page.evaluate(async (densities) => {
  const { renderSprite } = await import("/src/game/sprites.ts");
  const BG = "#1f1730";
  // 32x32 sprite kadri — keyin butun piksellar bilan kattalashtiriladi
  const src = document.createElement("canvas");
  src.width = src.height = 32;
  const sg = src.getContext("2d");
  renderSprite(sg, "knight", "idle", 0, 16, 16, false);
  // sprite'ning bo'yalgan qismi (adaptive ikonkada aniq markazga qo'yish uchun)
  const data = sg.getImageData(0, 0, 32, 32).data;
  let x0 = 32,
    y0 = 32,
    x1 = -1,
    y1 = -1;
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++)
      if (data[(y * 32 + x) * 4 + 3] > 0) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
  const bw = x1 - x0 + 1,
    bh = y1 - y0 + 1;
  const out = (c) => c.toDataURL("image/png").split(",")[1];
  const canvas = (size) => {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d");
    g.imageSmoothingEnabled = false;
    return [c, g];
  };
  /** Ritsarni `box` o'lchamli kvadrat markaziga butun karra kattalashtirib chizadi */
  const knight = (g, size, box) => {
    const k = Math.max(1, Math.floor(box / Math.max(bw, bh)));
    const dx = Math.round((size - bw * k) / 2),
      dy = Math.round((size - bh * k) / 2);
    g.drawImage(src, x0, y0, bw, bh, dx, dy, bw * k, bh * k);
  };
  // sayt ikonkalari (avvalgidek: 32x32 kadr butunligicha)
  const web = (size, maskable) => {
    const [c, g] = canvas(size);
    g.fillStyle = BG;
    g.fillRect(0, 0, size, size);
    // maskable: ikonka markazdagi 80% xavfsiz doiraga sig'adi
    const k = Math.floor((size * (maskable ? 0.75 : 1)) / 32);
    const d = 32 * k;
    g.drawImage(src, (size - d) / 2, (size - d) / 2, d, d);
    return out(c);
  };
  const files = {
    "public/icons/icon-192.png": web(192, false),
    "public/icons/icon-512.png": web(512, false),
    "public/icons/icon-maskable-192.png": web(192, true),
    "public/icons/icon-maskable-512.png": web(512, true),
  };
  // Play Market ikonkasi: 512x512, burchaklar Play tomonidan yumaloqlanadi — chetdan joy qoldiriladi
  {
    const [c, g] = canvas(512);
    g.fillStyle = BG;
    g.fillRect(0, 0, 512, 512);
    knight(g, 512, 512 * 0.72);
    files["store/icon-512.png"] = out(c);
  }
  for (const [name, dp] of Object.entries(densities)) {
    const dir = `android/app/src/main/res/mipmap-${name}`;
    // adaptive icon old qatlami: 108dp, ko'rinadigan xavfsiz doira — markazdagi 66dp
    {
      const size = Math.round(108 * dp);
      const [c, g] = canvas(size);
      knight(g, size, 62 * dp);
      files[`${dir}/ic_launcher_foreground.png`] = out(c);
    }
    // Android 8 dan oldingi ikonkalar: 48dp kvadrat va doira
    for (const round of [false, true]) {
      const size = Math.round(48 * dp);
      const [c, g] = canvas(size);
      g.fillStyle = BG;
      if (round) {
        g.beginPath();
        g.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
        g.fill();
      } else g.fillRect(0, 0, size, size);
      knight(g, size, size * 0.72);
      files[`${dir}/ic_launcher${round ? "_round" : ""}.png`] = out(c);
    }
  }
  // eski Android ochilish ekrani logotipi (drawable/splash.xml markazida)
  {
    const [c, g] = canvas(256);
    knight(g, 256, 240);
    files["android/app/src/main/res/drawable-nodpi/splash_logo.png"] = out(c);
  }
  return files;
}, DENSITIES);
for (const [file, b64] of Object.entries(icons)) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, Buffer.from(b64, "base64"));
}
await browser.close();
console.log(`✓ ${Object.keys(icons).length} ta ikonka: public/icons, ${RES}, store/`);
