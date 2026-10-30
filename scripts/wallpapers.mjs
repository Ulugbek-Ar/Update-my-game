// Kompyuter uchun fon rasmlari (reklama): piksel uslubda, hammasi o'yin kodi bilan chiziladi.
//   1) qasr    — qasr va oy fonida 4 qahramon;
//   2) iblis   — Iblis bilan jang sahnasi (Olovli zindon);
//   3) olam    — Abadiyat olami manzarasi (Boshlang'ich vodiy qishlog'i).
// Har birida "PIKSEL QAL'A" logotipi, "O'ynab ko'r!" yozuvi va Telegram kanal QR kodi
// (src/lib/qr.ts, tashqi xizmatsiz). Matn va QR o'ng tomonda — ish stoli ikonkalari tushadigan
// chap chetga to'g'ri kelmaydi. O'lchamlar: 1920x1080 va 1366x768.
// Natija: store/wallpapers/PikselQala-fon-<qasr|iblis|olam>-<W>x<H>.png
// Ishga tushirish: `bun run dev` dan keyin `PW_DIR=<playwright papkasi> node scripts/wallpapers.mjs`
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const require = createRequire(path.join(process.env.PW_DIR ?? process.cwd(), "x.js"));
const { chromium } = require("playwright");
const URL = process.env.GAME_URL ?? "http://127.0.0.1:5173";
const SIZES = [
  [1920, 1080],
  [1366, 768],
];
const SCENES = ["qasr", "iblis", "olam"];

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(URL, { waitUntil: "networkidle", timeout: 120_000 });
await mkdir("store/wallpapers", { recursive: true });

for (const scene of SCENES)
  for (const [W, H] of SIZES) {
    const png = await page.evaluate(
      async ({ scene, W, H }) => {
        const { background } = await import("/src/game/menuScene.ts");
        const { renderSprite, spriteSize } = await import("/src/game/sprites.ts");
        const { makeQr } = await import("/src/lib/qr.ts");
        await document.fonts.load('48px "Press Start 2P"');

        /** Piksel to'rtburchak (mantiqiy koordinatalarda) */
        const px = (g, color, x, y, w = 1, h = 1) => {
          g.fillStyle = color;
          g.fillRect(x, y, w, h);
        };
        /** Sprite oyog'i (x, footY) nuqtada, s — masshtab */
        const sprite = (g, kind, state, frame, x, footY, s = 1, flip = false) => {
          const size = spriteSize(kind);
          g.save();
          g.translate(x, footY);
          g.scale(s, s);
          g.fillStyle = "rgba(0,0,0,0.35)";
          g.fillRect(-size * 0.22, -1, size * 0.44, 2);
          renderSprite(g, kind, state, frame, 0, -size / 2 + size * 0.06, false, flip);
          g.restore();
        };
        /** Olov shari: yorqin o'zak, to'q sariq va qizil qatlamlar */
        const fireball = (g, x, y, r, core = "#ff7a1a", rim = "#b3261e") => {
          px(g, rim, x - r, y - r + 1, r * 2, r * 2 - 2);
          px(g, rim, x - r + 1, y - r, r * 2 - 2, r * 2);
          px(g, core, x - r + 1, y - r + 1, r * 2 - 2, r * 2 - 2);
          px(g, "#ffd84a", x - 1, y - 1, 2, 2);
          px(g, rim, x + r, y - 1, 3, 2); // dumcha
        };

        // ── sahnalar mantiqiy o'lchamda chiziladi ──────────────────────────────────────────
        const SCENES = {
          // 1) qasr va oy (menyu foni, oy chap tomonda) + 4 qahramon
          qasr: {
            w: 320,
            h: 180,
            draw(g) {
              g.save();
              g.translate(320, 0);
              g.scale(-1, 1);
              g.drawImage(background(), 0, 0);
              g.restore();
              // yulduzlar
              for (let i = 0; i < 70; i++) {
                const x = (i * 97 + 13) % 320,
                  y = (i * 53 + 7) % 92;
                px(g, i % 4 ? "#8a84a8" : "#ffffff", x, y);
              }
              // qasr derazalarida chiroq (ko'zgu tasvirda)
              for (const [wx, wy] of [
                [109, 96],
                [158, 82],
                [163, 96],
                [203, 100],
                [130, 112],
                [186, 112],
              ])
                px(g, "#ffcc33", 320 - wx - 2, wy, 2, 3);
              // ko'rshapalaklar oy oldida
              for (const [bx, by, f] of [
                [52, 34, 0],
                [78, 22, 2],
                [96, 44, 1],
              ]) {
                g.save();
                g.translate(bx, by);
                g.scale(0.6, 0.6);
                renderSprite(g, "bat", "walk", f, 0, 0, false, f === 2);
                g.restore();
              }
              const ground = 154;
              sprite(g, "knight", "idle", 0, 86, ground, 1.45);
              sprite(g, "mage", "idle", 1, 120, ground, 1.45);
              sprite(g, "hunter", "idle", 0, 154, ground, 1.45, true);
              sprite(g, "gunner", "idle", 1, 188, ground, 1.45, true);
            },
          },
          // 2) Iblis bilan jang: zindon devori, mash'alalar, olov sharlari, 4 qahramon hujumda
          iblis: {
            w: 320,
            h: 180,
            draw(g) {
              px(g, "#1a1424", 0, 0, 320, 180);
              // pol plitalari
              for (let ty = 0; ty < 10; ty++)
                for (let tx = 0; tx < 20; tx++) {
                  const v = (tx * 7 + ty * 13) % 5;
                  px(
                    g,
                    v === 0 ? "#2e2438" : v < 3 ? "#352a40" : "#3a2e46",
                    tx * 16,
                    36 + ty * 16,
                    16,
                    16,
                  );
                  px(g, "#251c2e", tx * 16, 36 + ty * 16, 16, 1);
                  px(g, "#251c2e", tx * 16, 36 + ty * 16, 1, 16);
                  if (v === 1) px(g, "#4a3c56", tx * 16 + 5, 36 + ty * 16 + 6, 3, 1);
                }
              // devor (g'ishtlar)
              px(g, "#3d3150", 0, 0, 320, 38);
              for (let row = 0; row < 5; row++)
                for (let col = 0; col < 22; col++) {
                  const x = col * 16 - (row % 2) * 8,
                    y = row * 7 + 2;
                  px(g, (col + row) % 3 ? "#4b3d61" : "#54456b", x + 1, y + 1, 14, 5);
                }
              px(g, "#1c1526", 0, 36, 320, 3);
              // mash'alalar va ularning nuri
              for (const tx of [40, 120, 200, 280]) {
                const glow = g.createRadialGradient(tx, 18, 1, tx, 18, 40);
                glow.addColorStop(0, "rgba(255,170,60,0.45)");
                glow.addColorStop(1, "rgba(255,170,60,0)");
                g.fillStyle = glow;
                g.fillRect(tx - 40, 0, 80, 70);
                px(g, "#6b4a2a", tx - 1, 16, 3, 10);
                px(g, "#ff7a1a", tx - 2, 11, 5, 5);
                px(g, "#ffd84a", tx - 1, 12, 3, 3);
              }
              // Iblis zarbasi: qizil doira
              const bx = 186,
                by = 126;
              g.fillStyle = "rgba(220,40,40,0.22)";
              g.beginPath();
              g.ellipse(bx, by, 52, 26, 0, 0, Math.PI * 2);
              g.fill();
              g.strokeStyle = "rgba(255,80,60,0.8)";
              g.lineWidth = 1;
              g.stroke();
              // G'AZAB: atrofga olov sharlari
              for (let i = 0; i < 12; i++) {
                const a = (i / 12) * Math.PI * 2 + 0.2;
                const r = 46 + (i % 3) * 10;
                fireball(
                  g,
                  Math.round(bx + Math.cos(a) * r),
                  Math.round(by - 24 + Math.sin(a) * r * 0.62),
                  3,
                );
              }
              sprite(g, "demon", "attack", 1, bx, by + 8, 1.4, true);
              // qahramonlar
              sprite(g, "knight", "attack", 1, 132, 142, 1.5);
              sprite(g, "gunner", "attack", 1, 92, 112, 1.4);
              sprite(g, "mage", "attack", 1, 84, 160, 1.4);
              sprite(g, "hunter", "attack", 1, 118, 88, 1.4);
              // o'q va sehrli shar Iblis tomon
              px(g, "#e8d27a", 132, 84, 14, 1);
              px(g, "#7fd36b", 146, 83, 2, 3);
              fireball(g, 112, 146, 3, "#e0405a", "#5a0f1e"); // Sehrgarning qizil shari
              px(g, "#ffe08a", 112, 104, 6, 1); // Merganning o'qi
            },
          },
          // 3) Abadiyat olami: haqiqiy olam xaritasidan qishloq atrofi
          olam: {
            w: 1280,
            h: 720,
            async draw(g) {
              const { loadRealmData } = await import("/src/realm/data.ts");
              const { RealmMap } = await import("/src/realm/map.ts");
              const { drawTile } = await import("/src/realm/tileArt.ts");
              const map = new RealmMap(loadRealmData().region);
              // qishloq (chapda), o'rmon cheti (tepada), daryo va eski ko'prik (o'ng chetda)
              const x0 = 20,
                y0 = 60;
              for (let ty = 0; ty < 45; ty++)
                for (let tx = 0; tx < 80; tx++) {
                  const gx = x0 + tx,
                    gy = y0 + ty;
                  drawTile(g, map.base(gx, gy), tx * 16, ty * 16, gx, gy, (dx, dy) =>
                    map.base(gx + dx, gy + dy),
                  );
                }
              const put = (kind, state, f, tx, ty, s = 2, flip = false) =>
                sprite(g, kind, state, f, (tx - x0) * 16 + 8, (ty - y0) * 16 + 14, s, flip);
              put("elder", "idle", 0, 42, 85);
              put("merchant", "idle", 1, 55, 91, 2, true);
              // to'rt qahramon ko'prik tomon yo'lda
              put("knight", "walk", 1, 70, 96);
              put("mage", "walk", 0, 67, 97);
              put("hunter", "walk", 2, 64, 96);
              put("gunner", "walk", 1, 61, 97);
              put("boar", "walk", 1, 80, 76, 2, true);
              put("rat", "walk", 0, 72, 104);
              put("wisp", "idle", 0, 44, 66);
              // yengil kechqurun quyoshi
              const sun = g.createLinearGradient(0, 0, 1280, 720);
              sun.addColorStop(0, "rgba(255,200,120,0.12)");
              sun.addColorStop(1, "rgba(40,20,80,0.28)");
              g.fillStyle = sun;
              g.fillRect(0, 0, 1280, 720);
            },
          },
        };

        const def = SCENES[scene];
        // sahna katta qilib chiziladi, so'ng silliq kichraytiriladi — piksellar bir xil qoladi
        const K = Math.ceil((W * 2) / def.w);
        const big = document.createElement("canvas");
        big.width = def.w * K;
        big.height = def.h * K;
        const bg = big.getContext("2d");
        bg.imageSmoothingEnabled = false;
        bg.scale(K, K);
        await def.draw(bg);

        const c = document.createElement("canvas");
        c.width = W;
        c.height = H;
        const g = c.getContext("2d");
        g.imageSmoothingEnabled = true;
        g.imageSmoothingQuality = "high";
        const sh = (def.h * W) / def.w;
        g.drawImage(big, 0, (H - sh) / 2, W, sh);

        // ── o'ng tomon: logotip, "O'ynab ko'r!", QR (chap chet — ish stoli ikonkalari) ─────────
        const u = W / 1920;
        const colX = W * 0.8; // o'ng ustun markazi
        const outlined = (txt, x, y, size, fill) => {
          g.font = `${Math.round(size)}px "Press Start 2P"`;
          g.textAlign = "center";
          g.textBaseline = "middle";
          const o = Math.max(2, Math.round(size / 12));
          for (const [dx, dy] of [
            [-o, 0],
            [o, 0],
            [0, -o],
            [0, o],
            [o * 1.6, o * 1.6],
          ]) {
            g.fillStyle = "#0b0a22";
            g.fillText(txt, x + dx, y + dy);
          }
          g.fillStyle = fill;
          g.fillText(txt, x, y);
        };
        g.fillStyle = "rgba(7, 6, 26, 0.55)";
        g.fillRect(colX - 330 * u, 70 * u, 660 * u, 200 * u);
        outlined("PIKSEL QAL'A", colX, 140 * u, 46 * u, "#ffcc33");
        outlined("Retro piksel RPG", colX, 205 * u, 18 * u, "#f4ead5");
        outlined("O'ynab ko'r!", colX, 245 * u, 22 * u, "#7fe0ff");

        // QR: o'ng pastki burchak (vazifalar paneli ustida)
        const qr = makeQr("https://t.me/piksel_qala");
        const quiet = 3;
        const mod = Math.floor((200 * u) / (qr.size + quiet * 2));
        const qs = mod * (qr.size + quiet * 2);
        const qx = Math.round(colX - qs / 2);
        const qy = Math.round(H - 110 * u - qs - 60 * u);
        const plate = Math.max(qs + 16 * u, 380 * u);
        g.fillStyle = "#0b0a22";
        g.fillRect(colX - plate / 2, qy - 8 * u, plate, qs + 70 * u);
        g.fillStyle = "#ffffff";
        g.fillRect(qx, qy, qs, qs);
        g.fillStyle = "#000000";
        for (let y = 0; y < qr.size; y++)
          for (let x = 0; x < qr.size; x++)
            if (qr.modules[y][x])
              g.fillRect(qx + (x + quiet) * mod, qy + (y + quiet) * mod, mod, mod);
        g.font = `${Math.round(15 * u)}px "Press Start 2P"`;
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillStyle = "#ffcc33";
        g.fillText("Telegram: @piksel_qala", qx + qs / 2, qy + qs + 32 * u);
        return c.toDataURL("image/png").split(",")[1];
      },
      { scene, W, H },
    );
    const file = `store/wallpapers/PikselQala-fon-${scene}-${W}x${H}.png`;
    await writeFile(file, Buffer.from(png, "base64"));
    console.log(`✓ ${file}`);
  }
await browser.close();
