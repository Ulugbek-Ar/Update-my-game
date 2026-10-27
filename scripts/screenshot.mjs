import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(path.join(process.env.PW_DIR ?? process.cwd(), "x.js"));
const { chromium } = require("playwright");

const URL = process.env.GAME_URL ?? "http://127.0.0.1:5173";
const OUT = process.env.SHOT ?? "shot.png";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(URL, { waitUntil: "networkidle", timeout: 120_000 });

const start = page.getByRole("button", { name: "BOSHLASH" });
await start.waitFor({ timeout: 60_000 });
await page.waitForFunction(() => {
  const b = [...document.querySelectorAll("button")].find(
    (x) => x.textContent?.trim() === "BOSHLASH",
  );
  return b && !b.disabled;
});
await start.click();
await page.waitForTimeout(1500);

const hold = async (key, ms) => {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
};
await hold("d", 700);
await page.keyboard.press("Space");
await hold("w", 500);
await page.keyboard.press("Space");
await hold("a", 400);
await page.waitForTimeout(150);
await page.keyboard.down("Space");
await page.waitForTimeout(250);

await page.locator("canvas").first().screenshot({ path: OUT });
await browser.close();
console.log("Skrinshot:", OUT);
