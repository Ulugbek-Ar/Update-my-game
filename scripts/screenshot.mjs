import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import path from "node:path";

const require = createRequire(path.join(process.env.PW_DIR ?? process.cwd(), "x.js"));
const { chromium } = require("playwright");

let FFMPEG = "ffmpeg";
try {
  FFMPEG = require("ffmpeg-static") || "ffmpeg";
} catch {}
const URL = process.env.GAME_URL ?? "http://127.0.0.1:5173";
const OUT = "shots";

const versionSrc = await readFile("src/game/version.ts", "utf8");
const version = process.env.SHOT_VERSION || versionSrc.match(/GAME_VERSION\s*=\s*"([^"]+)"/)?.[1];
const scenarioFile = `screenshots/v${version}.json`;
const hasScenario = await access(scenarioFile).then(
  () => true,
  () => false,
);

const randomWave = process.env.SHOT_WAVE || String(Math.floor(Math.random() * 5));
const scenes = process.env.SHOT_SCENARIO
  ? JSON.parse(process.env.SHOT_SCENARIO)
  : hasScenario
    ? JSON.parse(await readFile(scenarioFile, "utf8"))
    : [
        {
          title: "O'yin jarayoni",
          steps: [{ start: true }, { wave: Number(randomWave) }, { play: true }],
        },
        { title: "Bosh menyu", target: "screen", steps: [] },
      ];
console.log(hasScenario ? `Ssenariy: ${scenarioFile}` : "Ssenariy yo'q — umumiy skrinshotlar");

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const list = [];

for (const [i, scene] of scenes.slice(0, 9).entries()) {
  const video = Number(scene.video) || 0;
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    ...(video ? { recordVideo: { dir: `${OUT}/raw`, size: { width: 1280, height: 720 } } } : {}),
  });
  const born = Date.now();
  // "Yangiliklar" oynasi sahnani to'smasin (sahna o'zi storage bilan ochishi mumkin)
  const gameVersion = versionSrc.match(/GAME_VERSION\s*=\s*"([^"]+)"/)?.[1];
  const storage = Object.assign(
    { "pixel-rpg-seen-version": gameVersion },
    ...scene.steps.filter((s) => s.storage).map((s) => s.storage),
  );
  await ctx.addInitScript((s) => {
    for (const [k, v] of Object.entries(s))
      localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
  }, storage);
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: "networkidle", timeout: 120_000 });
  await page.waitForFunction(
    () => {
      const b = [...document.querySelectorAll("button")].find(
        (x) => x.textContent?.trim() === "BOSHLASH",
      );
      return b && !b.disabled;
    },
    null,
    { timeout: 60_000 },
  );
  await page.waitForTimeout(500);

  const hold = async (key, ms) => {
    await page.keyboard.down(key);
    await page.waitForTimeout(ms);
    await page.keyboard.up(key);
  };

  let focus = null;
  try {
    for (const step of scene.steps) {
      if (step.spawn) {
        const px = step.spawn.px ?? 120;
        const py = step.spawn.py ?? 120;
        const n = (step.spawn.count ?? 1) - 1;
        focus = {
          x: px + ((step.spawn.dx ?? 110) + n * 24) / 2,
          y: py + ((step.spawn.dy ?? 0) + n * 18) / 2,
          w: Math.max(160, Math.abs(step.spawn.dx ?? 110) + n * 24 + 90),
        };
      }
      if (step.click)
        await page.getByRole("button", { name: step.click, exact: true }).first().click();
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
      if (step.spawn)
        await page.evaluate((sp) => {
          const g = window.__game;
          const p = g.player;
          const E = (g.enemies[0] ?? g.lastEnemy)?.constructor;
          g.lastEnemy = g.enemies[0] ?? g.lastEnemy;
          g.enemies = [];
          g.boss = null;
          g.coins = [];
          g.shots = [];
          g.hints = [];
          g.banner.timer = 0;
          p.takeHit = () => false;
          p.x = sp.px ?? 120;
          p.y = sp.py ?? 120;
          for (let n = 0; n < (sp.count ?? 1); n++) {
            const e = new E(sp.kind, p.x + (sp.dx ?? 110) + n * 24, p.y + (sp.dy ?? 0) + n * 18);
            e.spawn = 0;
            e.speedMul = sp.speed ?? 1;
            g.enemies.push(e);
          }
        }, step.spawn);
      if (step.eval)
        await page.evaluate((code) => new Function("g", code)(window.__game), step.eval);
      if (step.keys)
        for (const k of step.keys)
          Array.isArray(k) ? await hold(k[0], k[1]) : await page.keyboard.press(k);
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
    const target = scene.target === "screen" ? ".game-screen" : "canvas";
    const base = `${OUT}/${String(i + 1).padStart(2, "0")}`;
    if (video) {
      const box = await page.locator(target).first().boundingBox();
      const from = (Date.now() - born) / 1000;
      const until = Date.now() + video * 1000 + 300;
      if (scene.autoplay || scene.hero) {
        const held = new Set();
        const setKeys = async (want) => {
          for (const k of held) if (!want.has(k)) await page.keyboard.up(k);
          for (const k of want) if (!held.has(k)) await page.keyboard.down(k);
          held.clear();
          want.forEach((k) => held.add(k));
        };
        while (Date.now() < until) {
          const t = await page.evaluate(() => {
            const g = window.__game;
            const p = g.player;
            const foes = g.enemies.filter((e) => !e.dead);
            if (g.boss?.active) foes.push(g.boss);
            let best = null;
            for (const e of foes) {
              const dd = Math.hypot(e.x - p.x, e.y - p.y);
              if (!best || dd < best.d) best = { dx: e.x - p.x, dy: e.y - p.y, d: dd };
            }
            return best;
          });
          const want = new Set();
          // range: masofali qahramon shu masofani saqlaydi va nishonga qarab otadi
          const range = scene.range ?? 28;
          if (t && t.d > range) {
            if (t.dx > 8) want.add("d");
            if (t.dx < -8) want.add("a");
            if (t.dy > 8) want.add("s");
            if (t.dy < -8) want.add("w");
          } else if (t && scene.range) {
            // nishon bilan bitta chiziqqa tushadi (shar 4 yo'nalishda uchadi)
            if (Math.abs(t.dx) > Math.abs(t.dy)) {
              if (t.dy > 5) want.add("s");
              if (t.dy < -5) want.add("w");
            } else {
              if (t.dx > 5) want.add("d");
              if (t.dx < -5) want.add("a");
            }
          }
          await setKeys(want);
          if (t && scene.range && !want.size) {
            const aim =
              Math.abs(t.dx) > Math.abs(t.dy) ? (t.dx > 0 ? "d" : "a") : t.dy > 0 ? "s" : "w";
            await page.keyboard.down(aim);
            await page.waitForTimeout(20);
            await page.keyboard.up(aim);
          }
          if (t && (!scene.range || !want.size)) await page.keyboard.press("Space");
          await page.waitForTimeout(180);
        }
        await setKeys(new Set());
      } else await page.waitForTimeout(until - Date.now());
      const raw = await page.video().path();
      await page.close();
      await ctx.close();
      const even = (n) => Math.floor(n / 2) * 2;
      let crop = { x: box.x, y: box.y, w: box.width, h: box.height };
      if (focus && scene.zoom !== false) {
        const sc = Math.min(box.width / 320, box.height / 240);
        const ox = box.x + (box.width - 320 * sc) / 2;
        const oy = box.y + (box.height - 240 * sc) / 2;
        const lw = Math.min(320, scene.hero ? Math.max(240, focus.w) : focus.w);
        const lh = Math.min(240, (lw * 9) / 16);
        const lx = Math.max(0, Math.min(320 - lw, focus.x - lw / 2));
        const ly = Math.max(0, Math.min(240 - lh, focus.y - lh / 2));
        crop = { x: ox + lx * sc, y: oy + ly * sc, w: lw * sc, h: lh * sc };
      }
      const file = `${base}.mp4`;
      execFileSync(FFMPEG, [
        "-y",
        "-loglevel",
        "error",
        "-ss",
        String(from),
        "-i",
        raw,
        "-t",
        String(video),
        "-vf",
        `crop=${even(crop.w)}:${even(crop.h)}:${even(crop.x)}:${even(crop.y)},scale=1280:-2:flags=neighbor,fps=30`,
        "-an",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        file,
      ]);
      list.push({
        file,
        title: scene.title ?? "",
        text: scene.text ?? "",
        mob: !!scene.mob,
        hero: !!scene.hero,
      });
    } else {
      const file = `${base}.png`;
      await page.waitForTimeout(300);
      await page.locator(target).first().screenshot({ path: file });
      list.push({
        file,
        title: scene.title ?? "",
        text: scene.text ?? "",
        mob: !!scene.mob,
        hero: !!scene.hero,
      });
    }
    console.log(`::notice title=Skrinshot::✓ ${scene.title}`);
  } catch (e) {
    console.log(`::warning title=Skrinshot::✗ ${scene.title} — ${e.message.split("\n")[0]}`);
  }
  await ctx.close().catch(() => {});
}

await browser.close();
await writeFile(`${OUT}/list.json`, JSON.stringify(list, null, 2));
if (!list.length) throw new Error("Hech qanday skrinshot olinmadi");
