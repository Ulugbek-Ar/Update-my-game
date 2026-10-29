// Play Market "feature graphic" (1024x500): bosh menyu sahnasi (qasr, oy, qahramonlar, moblar)
// va logotip — hammasi o'yin kodi bilan chiziladi. Natija: store/feature-graphic.png
// Ishga tushirish: `bun run dev` dan keyin `PW_DIR=<playwright papkasi> node scripts/store-graphics.mjs`
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const require = createRequire(path.join(process.env.PW_DIR ?? process.cwd(), "x.js"));
const { chromium } = require("playwright");
const URL = process.env.GAME_URL ?? "http://127.0.0.1:5173";

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(URL, { waitUntil: "networkidle", timeout: 120_000 });
const png = await page.evaluate(async () => {
  const { renderMenuScene, SCENE_W, SCENE_H } = await import("/src/game/menuScene.ts");
  await document.fonts.load('48px "Press Start 2P"');
  // sahna 16x kattalikda chiziladi, so'ng silliq kichraytiriladi — piksellar bir xil o'lchamda qoladi
  const K = 16;
  const big = document.createElement("canvas");
  big.width = SCENE_W * K;
  big.height = SCENE_H * K;
  const bg = big.getContext("2d");
  bg.imageSmoothingEnabled = false;
  bg.scale(K, K);
  renderMenuScene(bg, 1.2);

  const W = 1024,
    H = 500;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = "high";
  // 320x180 sahna 1024 kenglikka (576 balandlik); osmonning tepasidan qirqiladi
  const sh = (SCENE_H * W) / SCENE_W;
  g.drawImage(big, 0, -(sh - H) * 0.7, W, sh);

  // logotip: oltin rangli piksel yozuv, qora soya va kontur
  const title = "PIKSEL QAL'A";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = '56px "Press Start 2P"';
  const ty = 96;
  g.fillStyle = "rgba(7, 6, 26, 0.55)";
  g.fillRect(W / 2 - 400, ty - 56, 800, 128);
  for (const [dx, dy] of [
    [-4, 0],
    [4, 0],
    [0, -4],
    [0, 4],
    [6, 6],
  ]) {
    g.fillStyle = "#0b0a22";
    g.fillText(title, W / 2 + dx, ty + dy);
  }
  g.fillStyle = "#ffcc33";
  g.fillText(title, W / 2, ty);
  g.font = '18px "Press Start 2P"';
  g.fillStyle = "#0b0a22";
  g.fillText("Retro piksel RPG", W / 2 + 2, ty + 52);
  g.fillStyle = "#f4ead5";
  g.fillText("Retro piksel RPG", W / 2, ty + 50);
  return c.toDataURL("image/png").split(",")[1];
});
await mkdir("store", { recursive: true });
await writeFile("store/feature-graphic.png", Buffer.from(png, "base64"));
await browser.close();
console.log("✓ store/feature-graphic.png (1024x500)");
