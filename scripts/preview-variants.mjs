// Ko'rib chiqish uchun eskizlar (o'yin kodi va ikonkalar o'zgarmaydi) — natija: store/preview/
//   iblis-boss-preview.png — Iblis jangi (320x240 xona, 4x): hozirgi va anime uslub yonma-yon
//   samuray-icon-preview.png — kelajakdagi Samuray qiz ikonkasi: 512x512 va telefonda 96/48 px
// Chizish: scripts/preview-art.mjs (sprites.ts palitralari va spritePixels), o'yin kadri — haqiqiy Game.
// Ishga tushirish: `bun run dev` dan keyin `PW_DIR=<playwright papkasi> node scripts/preview-variants.mjs`
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const require = createRequire(path.join(process.env.PW_DIR ?? process.cwd(), "x.js"));
const { chromium } = require("playwright");
const URL = process.env.GAME_URL ?? "http://127.0.0.1:5173";
const OUT = "store/preview";

const versionSrc = await readFile("src/game/version.ts", "utf8");
const gameVersion = versionSrc.match(/GAME_VERSION\s*=\s*"([^"]+)"/)?.[1];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.addInitScript((v) => {
  localStorage.setItem("pixel-rpg-seen-version", v);
  localStorage.setItem("pixel-rpg-tutorial-done", "1");
  localStorage.setItem("pixel-rpg-unlocked-heroes", JSON.stringify(["paladin"]));
  localStorage.setItem("pixel-rpg-hero", "paladin");
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  const date = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  localStorage.setItem("pixel-rpg-gift", JSON.stringify({ date, day: 1 }));
}, gameVersion);
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: "networkidle", timeout: 120_000 });
await mkdir(OUT, { recursive: true });

const save = async (name, b64) => {
  await writeFile(`${OUT}/${name}`, Buffer.from(b64, "base64"));
  console.log(`✓ ${OUT}/${name}`);
};

// 1) Samuray qiz ikonkasi: chapda 512x512, o'ngda telefon bosh ekrani (96 va 48 px)
const icon = await page.evaluate(async () => {
  const art = await import("/scripts/preview-art.mjs");
  const ic = art.drawSamuraiIcon();
  const phone = art.drawPhonePreview([ic], ["Telefonda: 96 va 48 px"]);
  const cv = document.createElement("canvas");
  cv.width = 40 + 512 + phone.width;
  cv.height = phone.height;
  const c = cv.getContext("2d");
  c.drawImage(phone, 552, 0);
  c.fillStyle = "#e9e6ef";
  c.fillRect(0, 0, 552, cv.height);
  c.font = "bold 22px sans-serif";
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillStyle = "#1d1840";
  c.fillText("Samuray qiz — ikonka 512x512", 40 + 256, 35);
  c.drawImage(ic, 40, 70);
  return cv.toDataURL("image/png").split(",")[1];
});
await save("samuray-icon-preview.png", icon);

// 2) o'yin ichi: Paladin bilan Iblis jangi (haqiqiy o'yin kadri, xona 320x240 → 1280x960)
await page.waitForFunction(() => {
  const b = [...document.querySelectorAll("button")].find(
    (x) => x.textContent?.trim() === "BOSHLASH",
  );
  return b && !b.disabled;
});
await page.getByRole("button", { name: "BOSHLASH" }).click();
const enter = page.getByRole("button", { name: "KIRISH", exact: true });
if (
  await enter.waitFor({ state: "visible", timeout: 3000 }).then(
    () => true,
    () => false,
  )
)
  await enter.click();
await page.waitForFunction(() => !!window.__game);
await page.waitForTimeout(400);
await page.evaluate(() => {
  const g = window.__game;
  g.enemies = [];
  g.hints = [];
  g.startWave(4);
});
await page.waitForFunction(() => window.__game.boss, null, { timeout: 15_000 });
await page.waitForTimeout(4500);

const shots = await page.evaluate(async () => {
  const art = await import("/scripts/preview-art.mjs");
  await document.fonts.load('16px "Press Start 2P"');
  const g = window.__game;
  const boss = g.boss;
  const p = g.player;
  const origRender = boss.render;
  const origCtx = g.ctx;
  // sahna: Paladin chapda, qilich ko'tarilgan (porlaydi); Iblis o'ngda zarbaga tayyorlanmoqda
  const setup = () => {
    g.enemies = [];
    g.coins = [];
    g.drops = [];
    g.hints = [];
    g.banner.timer = 0;
    g.intro = 0;
    g.fx.shake = 0;
    g.score = 1840;
    g.runGold = 23;
    p.x = 104;
    p.y = 168;
    p.hp = 6;
    p.flash = 0;
    p.facingLeft = false;
    p.anim.set("attack", true);
    p.anim.frame = 1;
    boss.x = 214;
    boss.y = 150;
    boss.spawn = 0;
    boss.flash = 0;
    boss.shots = [];
    boss.fires = [];
    boss.hp = Math.round(boss.maxHp * 0.72);
    boss.facingLeft = true;
    boss.windup = 0.35;
    boss.shock = 0;
    boss.anim.set("attack", true);
    boss.anim.frame = 0;
  };
  const shoot = (anime) => {
    setup();
    const cv = document.createElement("canvas");
    cv.width = 1280;
    cv.height = 960;
    const c = cv.getContext("2d");
    c.imageSmoothingEnabled = false;
    if (anime) {
      const sprite = art.animeDevilSprite("attack", 0);
      boss.render = function (ctx) {
        // ogohlantirish doirasi o'yin kodi bilan (sprite'dan tashqari hammasi), sprite — anime variant
        const noSprite = new Proxy(ctx, {
          get: (t, k) =>
            k === "drawImage" ? () => {} : typeof t[k] === "function" ? t[k].bind(t) : t[k],
          set: (t, k, v) => ((t[k] = v), true),
        });
        origRender.call(this, noSprite);
        art.paint(ctx, sprite, art.DEVIL_PAL, this.x - 32, this.y - 32, 2, this.facingLeft);
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        for (const ex of [12.5, 17.5]) {
          const gx = this.facingLeft ? 32 - ex : ex;
          const cx = this.x - 32 + gx * 2,
            cy = this.y - 32 + 9.5 * 2;
          const r = ctx.createRadialGradient(cx, cy, 0, cx, cy, 7);
          r.addColorStop(0, "rgba(255,80,40,0.7)");
          r.addColorStop(1, "rgba(255,80,40,0)");
          ctx.fillStyle = r;
          ctx.fillRect(cx - 7, cy - 7, 14, 14);
        }
        ctx.restore();
      };
    }
    g.ctx = c;
    try {
      g.render();
    } finally {
      g.ctx = origCtx;
      boss.render = origRender;
    }
    if (anime) {
      c.save();
      c.scale(4, 4);
      art.drawCutIn(c, 0.3);
      c.restore();
    }
    return cv;
  };
  const cur = shoot(false);
  const ani = shoot(true);
  // yonma-yon taqqoslash
  const both = document.createElement("canvas");
  both.width = 1280 * 2 + 48;
  both.height = 960 + 110;
  const b = both.getContext("2d");
  b.fillStyle = "#0b0a22";
  b.fillRect(0, 0, both.width, both.height);
  b.font = '28px "Press Start 2P"';
  b.textAlign = "center";
  b.fillStyle = "#e0d6ee";
  b.fillText("HOZIRGI", 640, 70);
  b.fillStyle = "#ff6a2a";
  b.fillText("ANIME PIKSEL + CUT-IN", 1280 + 48 + 640, 70);
  b.drawImage(cur, 0, 110);
  b.drawImage(ani, 1280 + 48, 110);
  const out = (cv) => cv.toDataURL("image/png").split(",")[1];
  return out(both);
});
await save("iblis-boss-preview.png", shots);
await browser.close();
