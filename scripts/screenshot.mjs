import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(path.join(process.env.PW_DIR ?? process.cwd(), "x.js"));
const { chromium } = require("playwright");

const URL = process.env.GAME_URL ?? "http://127.0.0.1:5173";
const WAVE = process.env.SHOT_WAVE;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(URL, { waitUntil: "networkidle", timeout: 120_000 });

const start = page.getByRole("button", { name: "BOSHLASH" });
await start.waitFor({ timeout: 60_000 });
await page.waitForFunction(() => {
  const b = [...document.querySelectorAll("button")].find((x) => x.textContent?.trim() === "BOSHLASH");
  return b && !b.disabled;
});
await page.waitForTimeout(800);
await page.locator(".game-screen").first().screenshot({ path: "menu.png" });

await start.click();
await page.waitForTimeout(600);

const wave = await page.evaluate((forced) => {
  const g = window.__game;
  if (!g) return 0;
  const i = forced !== undefined && forced !== "" ? Number(forced) : Math.floor(Math.random() * 6);
  g.enemies = [];
  g.hints = [];
  g.startWave(i);
  return i;
}, WAVE);
console.log("To'lqin:", wave + 1);

const hold = async (key, ms) => {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
};
await page.waitForTimeout(2200);
await hold("d", 600);
await page.keyboard.press("Space");
await hold("w", 500);
await page.keyboard.press("Space");
await hold("a", 400);
await page.keyboard.down("Space");
await page.waitForTimeout(250);

await page.locator("canvas").first().screenshot({ path: "play.png" });
await browser.close();
console.log("Skrinshotlar: menu.png, play.png");
