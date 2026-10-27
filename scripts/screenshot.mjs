import { createRequire } from "node:module";
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import path from "node:path";

const require = createRequire(path.join(process.env.PW_DIR ?? process.cwd(), "x.js"));
const { chromium } = require("playwright");

const URL = process.env.GAME_URL ?? "http://127.0.0.1:5173";
const OUT = "shots";

const versionSrc = await readFile("src/game/version.ts", "utf8");
const version = versionSrc.match(/GAME_VERSION\s*=\s*"([^"]+)"/)?.[1];
const scenarioFile = `screenshots/v${version}.json`;
const hasScenario = await access(scenarioFile).then(() => true, () => false);

const randomWave = process.env.SHOT_WAVE || String(Math.floor(Math.random() * 5));
const scenes = hasScenario
  ? JSON.parse(await readFile(scenarioFile, "utf8"))
  : [
      { title: "O'yin jarayoni", steps: [{ start: true }, { wave: Number(randomWave) }, { play: true }] },
      { title: "Bosh menyu", target: "screen", steps: [] },
    ];
console.log(hasScenario ? `Ssenariy: ${scenarioFile}` : "Ssenariy yo'q — umumiy skrinshotlar");

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const list = [];

for (const [i, scene] of scenes.slice(0, 9).entries()) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const storage = Object.assign({}, ...scene.steps.filter((s) => s.storage).map((s) => s.storage));
  await ctx.addInitScript((s) => {
    for (const [k, v] of Object.entries(s)) localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
  }, storage);
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: "networkidle", timeout: 120_000 });
  await page.waitForFunction(() => {
    const b = [...document.querySelectorAll("button")].find((x) => x.textContent?.trim() === "BOSHLASH");
    return b && !b.disabled;
  }, null, { timeout: 60_000 });
  await page.waitForTimeout(500);

  const hold = async (key, ms) => {
    await page.keyboard.down(key);
    await page.waitForTimeout(ms);
    await page.keyboard.up(key);
  };

  try {
    for (const step of scene.steps) {
      if (step.click) await page.getByRole("button", { name: step.click, exact: true }).first().click();
      if (step.start) {
        await page.getByRole("button", { name: "BOSHLASH" }).click();
        await page.waitForFunction(() => !!window.__game);
        await page.waitForTimeout(400);
      }
      if (step.wave !== undefined)
        await page.evaluate((w) => {
          const g = window.__game;
          g.enemies = [];
          g.hints = [];
          g.startWave(w);
        }, step.wave);
      if (step.eval) await page.evaluate((code) => new Function("g", code)(window.__game), step.eval);
      if (step.keys)
        for (const k of step.keys) Array.isArray(k) ? await hold(k[0], k[1]) : await page.keyboard.press(k);
      if (step.play) {
        await page.waitForTimeout(2200);
        await hold("d", 600);
        await page.keyboard.press("Space");
        await hold("w", 500);
        await page.keyboard.press("Space");
        await hold("a", 400);
        await page.keyboard.down("Space");
        await page.waitForTimeout(250);
      }
      if (step.wait) await page.waitForTimeout(step.wait);
    }
    const file = `${OUT}/${String(i + 1).padStart(2, "0")}.png`;
    const target = scene.target === "screen" ? ".game-screen" : "canvas";
    await page.waitForTimeout(300);
    await page.locator(target).first().screenshot({ path: file });
    list.push({ file, title: scene.title ?? "" });
    console.log(`::notice title=Skrinshot::✓ ${scene.title}`);
  } catch (e) {
    console.log(`::warning title=Skrinshot::✗ ${scene.title} — ${e.message.split("\n")[0]}`);
  }
  await ctx.close();
}

await browser.close();
await writeFile(`${OUT}/list.json`, JSON.stringify(list, null, 2));
if (!list.length) throw new Error("Hech qanday skrinshot olinmadi");
