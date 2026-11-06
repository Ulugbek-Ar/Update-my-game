// Ko'rib chiqish uchun eskizlar (anime Iblis va Samuray qiz ikonkasi) — brauzerda Vite orqali yuklanadi.
// O'yin kodiga tegmaydi: faqat sprites.ts palitralari va spritePixels() o'qiladi, chizish usuli
// ham o'yindagidek — butun sonli piksel to'r (rect/line/polygon/ellipse) va siyoh kontur.
// Ishga tushiruvchi: scripts/preview-variants.mjs
import { PALETTES, spritePixels } from "/src/game/sprites.ts";

// ───────────────────────────── piksel to'r ─────────────────────────────

/** sprites.ts dagi Pixels bilan bir xil rasterizator (faqat kattaroq to'r va ko'proq rang). */
export class Grid {
  constructor(w, h = w) {
    this.w = w;
    this.h = h;
    this.data = new Uint8Array(w * h);
  }
  set(c, x, y) {
    if (x >= 0 && x < this.w && y >= 0 && y < this.h) this.data[y * this.w + x] = c;
  }
  get(x, y) {
    return x >= 0 && x < this.w && y >= 0 && y < this.h ? this.data[y * this.w + x] : 0;
  }
  rect(c, x, y, w, h) {
    for (let py = Math.round(y); py < Math.round(y + h); py++)
      for (let px = Math.round(x); px < Math.round(x + w); px++) this.set(c, px, py);
  }
  line(c, a, b, width) {
    const steps = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), 1);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      this.rect(
        c,
        Math.round(a[0] + (b[0] - a[0]) * t) - Math.floor(width / 2),
        Math.round(a[1] + (b[1] - a[1]) * t) - Math.floor(width / 2),
        width,
        width,
      );
    }
  }
  polygon(c, pts) {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        let inside = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const a = pts[i],
            b = pts[j];
          if (
            a[1] > y + 0.5 !== b[1] > y + 0.5 &&
            x + 0.5 < ((b[0] - a[0]) * (y + 0.5 - a[1])) / (b[1] - a[1]) + a[0]
          )
            inside = !inside;
        }
        if (inside) this.set(c, x, y);
      }
  }
  /** y0..y1 — faqat shu qatorlar (zirhdagi soya/yaltiroq bantlar uchun) */
  ellipse(c, cx, cy, rx, ry, y0 = -1e9, y1 = 1e9) {
    for (let y = Math.max(0, y0); y < Math.min(this.h, y1 + 1); y++)
      for (let x = 0; x < this.w; x++) {
        const dx = (x + 0.5 - cx) / rx,
          dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(c, x, y);
      }
  }
  /** Bo'sh qo'shni kataklarga siyoh kontur (sprites.ts: outlined) */
  outlined(ink = 1) {
    const out = new Grid(this.w, this.h);
    out.data = this.data.slice();
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (!this.get(x, y)) continue;
        for (const [dx, dy] of [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ])
          if (!this.get(x + dx, y + dy)) out.set(ink, x + dx, y + dy);
      }
    return out;
  }
  /** other ning bo'yalgan kataklarini ustiga qo'yadi (under=true — faqat bo'sh joylarga) */
  merge(other, under = false) {
    for (let i = 0; i < this.data.length; i++)
      if (other.data[i] && (!under || !this.data[i])) this.data[i] = other.data[i];
    return this;
  }
}

/** To'rni ctx ga chizadi: har katak — s x s kvadrat (ctx o'zgarishi saqlanadi). */
export function paint(ctx, grid, colors, ox = 0, oy = 0, s = 1, flip = false) {
  for (let y = 0; y < grid.h; y++)
    for (let x = 0; x < grid.w; x++) {
      const c = grid.data[y * grid.w + x];
      if (!c) continue;
      ctx.fillStyle = colors[c] ?? "#ff00ff";
      const gx = flip ? grid.w - 1 - x : x;
      ctx.fillRect(ox + gx * s, oy + y * s, s, s);
    }
}

/** Ikki rangning aralashmasi (palitradan oraliq ton): k=0 — a, k=1 — b */
export function mix(a, b, k) {
  const pa = parseInt(a.slice(1), 16),
    pb = parseInt(b.slice(1), 16);
  const ch = (sh) =>
    Math.round(((pa >> sh) & 255) * (1 - k) + ((pb >> sh) & 255) * k)
      .toString(16)
      .padStart(2, "0");
  return `#${ch(16)}${ch(8)}${ch(0)}`;
}

function radial(ctx, x, y, r, rgb, a) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${a})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

// ───────────────────────────── umumiy: anime ko'z ─────────────────────────────

const SKIN = PALETTES.mage[4];
const INK = 1;

/** Simmetrik shakl: chap tomon nuqtalari va ularning 64 kenglikdagi ko'zgu aksi */
const mirrorPts = (pts, n = 64) => pts.map(([x, y]) => [n - x, y]);

/**
 * Katta anime ko'z: yuqori kiprik (tashqi burchakda qanot), oq, uch qatlamli qorachiq (tepada to'q,
 * pastda yorug'), qora ko'z gavhari va ikki yaltiroq. outerLeft — tashqi burchak chapdami.
 */
function animeEye(g, x, y, w, h, outerLeft, c) {
  g.rect(INK, x - 1, y - 1, w + 2, 1);
  g.rect(INK, x, y, w, 1);
  g.set(INK, outerLeft ? x - 1 : x + w, y + 1);
  g.set(INK, outerLeft ? x - 2 : x + w + 1, y - 2);
  g.rect(c.white, x, y + 1, w, h - 2);
  g.rect(c.dark, x + 1, y + 1, w - 2, h - 2);
  g.rect(c.iris, x + 1, y + 3, w - 2, h - 4);
  g.rect(c.light, x + 2, y + h - 3, w - 4, 1);
  g.rect(c.pupil, x + 2, y + 2, w - 4, c.slit ? h - 4 : 2);
  if (c.slit) g.rect(c.iris, x + 1, y + 2, 1, 1);
  g.rect(c.shine, x + 1, y + 1, 2, 2);
  g.set(c.shine, x + w - 2, y + h - 3);
  g.rect(c.lower, x + 1, y + h - 1, w - 2, 1);
}

// ───────────────────────────── Samuray qiz (64x64 byust) ─────────────────────────────

const HEART = "#ff4d6d"; // HUD yuragi
const S_WHITE = PALETTES.paladin[4];
const S_PINK = mix(HEART, S_WHITE, 0.4);
// Asosiy ranglar o'yin palitralaridan: soch — "qora suyak" Kamonchi, ko'z — Ko'rshapalak binafsharanglari,
// teri — Sehrgar, oq — Paladin tabardi, pushti — HUD yuragi, tsuba — Paladin oltini; qolgani — oraliq tonlar
export const SAMURAI_PAL = [
  null,
  PALETTES.archer[0], // 1 siyoh
  PALETTES.archer[1], // 2 qora soch
  mix(PALETTES.archer[1], PALETTES.archer[2], 0.22), // 3 soch tolasi
  mix(PALETTES.archer[2], PALETTES.bat[3], 0.35), // 4 soch yaltirog'i
  S_WHITE, // 5 oq kimono
  mix(S_WHITE, PALETTES.bat[2], 0.22), // 6 kimono soyasi
  S_PINK, // 7 pushti
  mix(HEART, PALETTES.demon[1], 0.35), // 8 to'q pushti (obi)
  "#ffb3c1", // 9 och pushti (HUD yuragi yaltirog'i)
  SKIN, // 10 teri
  mix(SKIN, mix(HEART, PALETTES.demon[1], 0.35), 0.28), // 11 teri soyasi
  PALETTES.bat[1], // 12 ko'z — to'q
  PALETTES.bat[2], // 13 ko'z — binafsha
  PALETTES.bat[3], // 14 ko'z — och
  mix(SKIN, PALETTES.demon[1], 0.55), // 15 og'iz
  mix(SKIN, HEART, 0.3), // 16 yonoq
  PALETTES.paladin[2], // 17 oltin
  PALETTES.paladin[1], // 18 to'q oltin
  PALETTES.demon[2], // 19 qizil (ichki kimono, ip)
  PALETTES.paladin[3], // 20 kumush tig'
];
const S = {
  INK: 1,
  HAIR: 2,
  HAIR_L: 3,
  SHINE: 4,
  WHITE: 5,
  KIM_SH: 6,
  PINK: 7,
  PINK_D: 8,
  PINK_L: 9,
  SKIN: 10,
  SKIN_SH: 11,
  EYE_D: 12,
  EYE: 13,
  EYE_L: 14,
  MOUTH: 15,
  BLUSH: 16,
  GOLD: 17,
  GOLD_D: 18,
  RED: 19,
  STEEL: 20,
};

/** Kichik sakura guli: 4 gulbarg va o'rtasi */
function blossom(g, x, y, petal = S.PINK, core = S.GOLD) {
  for (const [dx, dy] of [
    [0, -1],
    [-1, 0],
    [1, 0],
    [0, 1],
  ])
    g.set(petal, x + dx, y + dy);
  g.set(core, x, y);
}

/** Samuray qiz byusti: shamolda uchayotgan uzun qora soch, oq-pushti kimono, yelka ortida katana dastasi */
export function samuraiBust() {
  const g = new Grid(64);
  // katana dastasi (chap yelka ortida): oltin kashira, qora o'ram ostida oq romblar, oltin tsuba, qizil ip
  g.line(S.STEEL, [18, 38], [21, 47], 3);
  g.line(S.INK, [8, 13], [16, 33], 3);
  for (let i = 1; i < 7; i++) g.set(S.WHITE, Math.round(8 + i * 1.15), Math.round(13 + i * 2.9));
  g.rect(S.GOLD, 6, 10, 3, 3);
  g.set(S.PINK_L, 6, 10);
  g.line(S.GOLD, [12, 37], [22, 33], 2);
  g.set(S.GOLD_D, 17, 35);
  g.line(S.RED, [10, 20], [6, 26], 1);
  g.set(S.RED, 5, 27);
  g.set(S.RED, 7, 28);
  // orqa soch: o'ng tomonga shamolda uchadi, tolalar uchi tishli
  g.polygon(S.HAIR, [
    [17, 10],
    [32, 3],
    [46, 7],
    [53, 12],
    [62, 17],
    [64, 24],
    [57, 25],
    [63, 33],
    [56, 34],
    [61, 44],
    [52, 42],
    [55, 54],
    [47, 48],
    [44, 40],
    [20, 44],
    [16, 34],
    [15, 20],
  ]);
  for (const [a, b] of [
    [
      [48, 12],
      [62, 20],
    ],
    [
      [48, 20],
      [60, 30],
    ],
    [
      [47, 28],
      [57, 40],
    ],
    [
      [46, 36],
      [52, 48],
    ],
  ])
    g.line(S.HAIR_L, a, b, 1);
  const lock = [
    [16, 20],
    [22, 24],
    [22, 44],
    [18, 57],
    [14, 46],
  ];
  g.polygon(S.HAIR, lock);
  // kimono: oq, o'ng tomoni va burmalarida binafsharang soya
  g.polygon(S.WHITE, [
    [6, 64],
    [10, 52],
    [18, 45],
    [27, 42],
    [37, 42],
    [46, 45],
    [54, 52],
    [58, 64],
  ]);
  g.polygon(S.KIM_SH, [
    [46, 45],
    [54, 52],
    [58, 64],
    [51, 64],
    [48, 52],
  ]);
  g.line(S.KIM_SH, [14, 54], [12, 63], 1);
  g.line(S.KIM_SH, [22, 50], [21, 59], 1);
  g.polygon(S.RED, [
    [28, 42],
    [36, 42],
    [32, 52],
  ]);
  g.line(S.PINK, [27, 42], [32, 50], 3);
  g.line(S.PINK, [37, 42], [29, 58], 3);
  g.line(S.PINK_L, [37, 41], [30, 56], 1);
  // obi (belbog') va oltin ip
  g.rect(S.PINK_D, 12, 59, 40, 5);
  g.rect(S.PINK, 12, 59, 40, 1);
  g.rect(S.GOLD, 12, 61, 40, 1);
  // kimonodagi sakura naqshi
  for (const [x, y] of [
    [14, 56],
    [19, 50],
    [45, 52],
    [51, 57],
    [9, 61],
    [25, 55],
  ])
    blossom(g, x, y);
  // bo'yin
  g.rect(S.SKIN, 29, 35, 6, 8);
  g.rect(S.SKIN_SH, 29, 35, 6, 3);
  // yuz
  g.ellipse(S.HAIR, 32, 16, 15, 11);
  g.polygon(S.SKIN, [
    [22, 18],
    [42, 18],
    [42, 28],
    [39, 34],
    [35, 38],
    [29, 38],
    [25, 34],
    [22, 28],
  ]);
  g.rect(S.SKIN_SH, 22, 18, 21, 1);
  g.rect(S.SKIN_SH, 41, 20, 1, 9);
  g.line(S.SKIN_SH, [40, 30], [37, 34], 1);
  const eye = {
    white: S.WHITE,
    dark: S.EYE_D,
    iris: S.EYE,
    light: S.EYE_L,
    pupil: S.INK,
    shine: S.WHITE,
    lower: S.SKIN_SH,
  };
  animeEye(g, 23, 24, 7, 8, true, eye);
  animeEye(g, 34, 24, 7, 8, false, eye);
  // qoshlar (xotirjam, qat'iyatli), burun, kichik og'iz, yonoqlar
  g.rect(S.HAIR, 24, 21, 5, 1);
  g.set(S.HAIR, 29, 22);
  g.rect(S.HAIR, 35, 21, 5, 1);
  g.set(S.HAIR, 34, 22);
  g.set(S.SKIN_SH, 32, 31);
  g.rect(S.MOUTH, 31, 35, 3, 1);
  g.rect(S.BLUSH, 23, 32, 3, 1);
  g.rect(S.BLUSH, 38, 32, 3, 1);
  // qiyshiq peshona sochlari
  g.polygon(S.HAIR, [
    [17, 9],
    [47, 9],
    [46, 24],
    [43, 17],
    [41, 20],
    [38, 14],
    [35, 19],
    [33, 13],
    [30, 19],
    [27, 14],
    [25, 20],
    [22, 15],
    [19, 26],
    [17, 22],
  ]);
  for (const [a, b] of [
    [
      [25, 11],
      [23, 17],
    ],
    [
      [31, 10],
      [29, 16],
    ],
    [
      [38, 10],
      [37, 14],
    ],
    [
      [44, 11],
      [44, 18],
    ],
  ])
    g.line(S.HAIR_L, a, b, 1);
  // "farishta halqasi" — sochdagi binafsharang yaltiroq
  g.rect(S.SHINE, 21, 12, 5, 1);
  g.rect(S.SHINE, 28, 11, 6, 1);
  g.rect(S.SHINE, 37, 12, 5, 1);
  // yuz yonidagi oldingi tolalar (o'ngdagisi shamolda chetga uchgan)
  g.polygon(S.HAIR, [
    [18, 18],
    [23, 21],
    [23, 36],
    [21, 48],
    [18, 40],
  ]);
  g.polygon(S.HAIR, [
    [46, 18],
    [41, 21],
    [41, 34],
    [45, 47],
    [49, 40],
    [47, 30],
  ]);
  // sochdagi sakura bezagi va qizil lenta
  g.line(S.RED, [45, 15], [49, 19], 1);
  g.set(S.RED, 50, 18);
  for (const [dx, dy] of [
    [0, -2],
    [-2, 0],
    [2, 0],
    [-1, 2],
    [1, 2],
  ])
    g.rect(S.PINK, 44 + dx, 12 + dy, 2, 2);
  g.rect(S.PINK_L, 44, 12, 2, 2);
  g.set(S.GOLD, 44, 12);
  return g.outlined(S.INK);
}

// ───────────────────────────── ikonka 512x512 ─────────────────────────────

/** Tungi binafsha osmon, oy, qasr silueti va sakura shoxi (menuScene.ts foni ranglari) — 128x128 */
function samuraiBackground(c) {
  const bands = ["#07061a", "#0b0a22", "#100e2c", "#161336", "#1d1840", "#251d48"];
  bands.forEach((col, i) => {
    c.fillStyle = col;
    c.fillRect(0, i * 16, 128, 16);
  });
  c.fillStyle = "#2c2250";
  c.fillRect(0, 96, 128, 32);
  for (let i = 0; i < 46; i++) {
    const x = (i * 97 + 13) % 128,
      y = (i * 53 + 7) % 90;
    c.fillStyle = i % 4 ? "#8a84a8" : "#ffffff";
    c.fillRect(x, y, 1, 1);
  }
  // oy (chapda, katana dastasi uning oldida siluet bo'lib ko'rinadi)
  const mx = 26,
    my = 26;
  const disc = (r, col) => {
    c.fillStyle = col;
    for (let y = -r; y <= r; y++) {
      const w = Math.round(Math.sqrt(r * r - y * y));
      c.fillRect(mx - w, my + y, w * 2, 1);
    }
  };
  disc(22, "#141230");
  disc(18, "#1a1838");
  disc(13, "#f2ecd0");
  c.fillStyle = "#d8cfae";
  for (let y = -13; y <= 13; y++) {
    const w = Math.round(Math.sqrt(169 - y * y));
    c.fillRect(mx + w - 3, my + y, 3, 1);
  }
  c.fillRect(mx - 6, my - 5, 4, 3);
  c.fillRect(mx + 3, my + 3, 3, 3);
  c.fillRect(mx - 2, my + 7, 3, 2);
  // tepaliklar va qasr silueti (pagoda tomli minoralar)
  for (let x = 0; x < 128; x++) {
    const h = 16 + Math.round(Math.sin(x / 13) * 4 + Math.sin(x / 5) * 1.5);
    c.fillStyle = "#1a1430";
    c.fillRect(x, 104 - h, 1, h + 24);
  }
  const base = 108;
  c.fillStyle = "#120e22";
  c.fillRect(0, base - 18, 128, 20);
  const tower = (x, w, h, floors) => {
    c.fillStyle = "#120e22";
    c.fillRect(x, base - h, w, h);
    for (let f = 0; f < floors; f++) {
      const y = base - h + f * 9;
      c.fillRect(x - 3, y, w + 6, 2);
      c.fillRect(x - 4, y + 1, 1, 1);
      c.fillRect(x + w + 3, y + 1, 1, 1);
    }
    c.fillRect(x + w / 2 - 1, base - h - 4, 2, 4);
  };
  tower(4, 14, 46, 3);
  tower(106, 14, 52, 4);
  tower(92, 8, 30, 2);
  c.fillStyle = "#ffcc33";
  for (const [x, y] of [
    [8, 72],
    [12, 82],
    [110, 66],
    [114, 76],
    [110, 86],
    [95, 88],
  ])
    c.fillRect(x, y, 2, 2);
  c.fillStyle = "#14261a";
  c.fillRect(0, 118, 128, 10);
  // sakura shoxi (o'ng tepada)
  c.fillStyle = PALETTES.treant[1];
  for (const [[x0, y0], [x1, y1], w] of [
    [[128, 6], [104, 14], 2],
    [[112, 11], [100, 5], 1],
    [[106, 13], [96, 20], 1],
  ]) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= n; i++)
      c.fillRect(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), w, w);
  }
  for (const [x, y] of [
    [101, 4],
    [97, 19],
    [108, 9],
    [116, 6],
    [122, 9],
    [104, 16],
    [113, 13],
    [125, 4],
  ]) {
    c.fillStyle = SAMURAI_PAL[S.PINK];
    c.fillRect(x - 1, y, 3, 1);
    c.fillRect(x, y - 1, 1, 3);
    c.fillStyle = SAMURAI_PAL[S.PINK_L];
    c.fillRect(x, y, 1, 1);
  }
}

/** Shamolda uchayotgan sakura gulbarglari (qahramon yuzini to'smaydi) */
function petals(c, front) {
  for (let i = 0; i < 26; i++) {
    const x = (i * 53 + 11) % 128,
      y = (i * 37 + 23) % 124;
    const face = x > 40 && x < 88 && y > 30 && y < 82;
    if (face || (i % 2 === 0) !== front) continue;
    c.fillStyle = i % 3 ? SAMURAI_PAL[S.PINK_L] : SAMURAI_PAL[S.PINK];
    c.fillRect(x, y, 2, 1);
    if (i % 4 === 0) c.fillRect(x + 1, y + 1, 1, 1);
  }
}

/** Samuray qiz ikonkasi eskizi, 512x512 */
export function drawSamuraiIcon() {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 512;
  const c = cv.getContext("2d");
  c.imageSmoothingEnabled = false;
  c.scale(4, 4);
  samuraiBackground(c);
  petals(c, false);
  radial(c, 64, 54, 56, "255,179,193", 0.22);
  paint(c, samuraiBust(), SAMURAI_PAL, 0, 0, 2);
  c.globalCompositeOperation = "lighter";
  for (const x of [53, 75]) radial(c, x, 58, 8, "201,154,232", 0.4);
  c.globalCompositeOperation = "source-over";
  petals(c, true);
  return cv;
}

// ───────────────────────────── telefon bosh ekrani ─────────────────────────────

/** Oddiy (brendsiz) ilova ikonkalari: rangli kvadrat va oddiy belgi */
const GENERIC_APPS = [
  { name: "Soat", bg: "#2b2f3a", glyph: "clock" },
  { name: "Kamera", bg: "#4a4f5c", glyph: "camera" },
  { name: "Xabarlar", bg: "#2e9e5b", glyph: "chat" },
  { name: "Galereya", bg: "#e8eef6", glyph: "photo" },
  { name: "Sozlamalar", bg: "#6b7280", glyph: "gear" },
  { name: "Kalkulyator", bg: "#f08a24", glyph: "calc" },
  { name: "Ob-havo", bg: "#3b82f6", glyph: "sun" },
  { name: "Musiqa", bg: "#e5486b", glyph: "note" },
  { name: "Xarita", bg: "#5cb85c", glyph: "pin" },
  { name: "Telefon", bg: "#22a06b", glyph: "phone" },
  { name: "Brauzer", bg: "#2f6fe0", glyph: "globe" },
];

function glyph(c, kind, s) {
  c.save();
  c.translate(s / 2, s / 2);
  c.strokeStyle = c.fillStyle = "#ffffff";
  c.lineWidth = s * 0.07;
  c.lineCap = "round";
  const r = s * 0.26;
  const circle = (rr, fill = false) => {
    c.beginPath();
    c.arc(0, 0, rr, 0, Math.PI * 2);
    fill ? c.fill() : c.stroke();
  };
  if (kind === "clock") {
    circle(r);
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(0, -r * 0.65);
    c.moveTo(0, 0);
    c.lineTo(r * 0.5, 0);
    c.stroke();
  } else if (kind === "camera") {
    c.strokeRect(-r * 1.1, -r * 0.7, r * 2.2, r * 1.5);
    c.beginPath();
    c.arc(0, 0.05 * s, r * 0.45, 0, Math.PI * 2);
    c.stroke();
  } else if (kind === "chat") {
    c.beginPath();
    c.ellipse(0, -r * 0.1, r * 1.05, r * 0.8, 0, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.moveTo(-r * 0.5, r * 0.5);
    c.lineTo(-r * 0.8, r * 1.05);
    c.lineTo(0, r * 0.6);
    c.fill();
  } else if (kind === "photo") {
    c.fillStyle = "#f2b33d";
    c.beginPath();
    c.arc(-r * 0.4, -r * 0.4, r * 0.3, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#3b9c5a";
    c.beginPath();
    c.moveTo(-r * 1.1, r * 0.9);
    c.lineTo(-r * 0.2, -r * 0.1);
    c.lineTo(r * 0.4, r * 0.5);
    c.lineTo(r * 0.7, r * 0.2);
    c.lineTo(r * 1.1, r * 0.9);
    c.fill();
  } else if (kind === "gear") {
    for (let i = 0; i < 8; i++) {
      c.save();
      c.rotate((i * Math.PI) / 4);
      c.fillRect(-s * 0.05, -r * 1.1, s * 0.1, r * 0.5);
      c.restore();
    }
    circle(r * 0.75);
    circle(r * 0.25);
  } else if (kind === "calc") {
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++)
        c.fillRect(-r + i * r * 0.75, -r * 0.8 + j * r * 0.65, r * 0.5, r * 0.4);
  } else if (kind === "sun") {
    circle(r * 0.5, true);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      c.beginPath();
      c.moveTo(Math.cos(a) * r * 0.75, Math.sin(a) * r * 0.75);
      c.lineTo(Math.cos(a) * r * 1.05, Math.sin(a) * r * 1.05);
      c.stroke();
    }
  } else if (kind === "note") {
    c.beginPath();
    c.arc(-r * 0.35, r * 0.6, r * 0.32, 0, Math.PI * 2);
    c.fill();
    c.fillRect(-r * 0.1, -r * 0.9, s * 0.06, r * 1.5);
    c.fillRect(-r * 0.1, -r * 0.9, r * 0.8, s * 0.06);
  } else if (kind === "pin") {
    c.beginPath();
    c.arc(0, -r * 0.3, r * 0.6, Math.PI, 0);
    c.lineTo(0, r);
    c.closePath();
    c.fill();
    c.fillStyle = "#5cb85c";
    c.beginPath();
    c.arc(0, -r * 0.3, r * 0.22, 0, Math.PI * 2);
    c.fill();
  } else if (kind === "phone") {
    c.rotate(-0.6);
    c.beginPath();
    c.ellipse(0, 0, r * 0.3, r * 1.0, 0, 0, Math.PI * 2);
    c.fill();
  } else if (kind === "globe") {
    circle(r);
    c.beginPath();
    c.ellipse(0, 0, r * 0.45, r, 0, 0, Math.PI * 2);
    c.moveTo(-r, 0);
    c.lineTo(r, 0);
    c.stroke();
  }
  c.restore();
}

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

/** Bitta ilova ikonkasi: shape "squircle" yoki "circle"; icon — tayyor canvas (bizniki) */
function appIcon(c, x, y, s, app, shape, label) {
  c.save();
  c.shadowColor = "rgba(0,0,0,0.35)";
  c.shadowBlur = s * 0.12;
  c.shadowOffsetY = s * 0.04;
  if (shape === "circle") {
    c.beginPath();
    c.arc(x + s / 2, y + s / 2, s / 2, 0, Math.PI * 2);
  } else roundRect(c, x, y, s, s, s * 0.24);
  c.fillStyle = app.bg ?? "#000";
  c.fill();
  c.shadowColor = "transparent";
  c.clip();
  if (app.canvas) {
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = "high";
    c.drawImage(app.canvas, x, y, s, s);
  } else {
    c.translate(x, y);
    if (app.bg === "#e8eef6") {
      // och fonda belgi ko'rinsin
      c.fillStyle = "#e8eef6";
    }
    glyph(c, app.glyph, s);
  }
  c.restore();
  if (label) {
    c.font = `${Math.max(11, Math.round(s * 0.2))}px sans-serif`;
    c.textAlign = "center";
    c.textBaseline = "top";
    c.fillStyle = "rgba(0,0,0,0.5)";
    c.fillText(label, x + s / 2 + 1, y + s + 7);
    c.fillStyle = "#ffffff";
    c.fillText(label, x + s / 2, y + s + 6);
  }
}

/** Uchta ikonka varianti telefon bosh ekranida (96 px — asosiy to'r, 48 px — pastki panel). */
export function drawPhonePreview(icons, titles) {
  const PW = 420,
    PH = 760,
    GAP = 40,
    TOP = 70;
  const W = icons.length * PW + (icons.length + 1) * GAP,
    H = PH + TOP + 40;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const c = cv.getContext("2d");
  c.fillStyle = "#e9e6ef";
  c.fillRect(0, 0, W, H);
  icons.forEach((icon, i) => {
    const x0 = GAP + i * (PW + GAP),
      y0 = TOP;
    c.font = "bold 22px sans-serif";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillStyle = "#1d1840";
    c.fillText(titles[i], x0 + PW / 2, TOP / 2);
    // telefon korpusi va ekran (oddiy fon rasmi — gradient)
    c.fillStyle = "#111111";
    roundRect(c, x0, y0, PW, PH, 46);
    c.fill();
    const sx = x0 + 14,
      sy = y0 + 14,
      sw = PW - 28,
      sh = PH - 28;
    c.save();
    roundRect(c, sx, sy, sw, sh, 34);
    c.clip();
    const wp = c.createLinearGradient(sx, sy, sx + sw, sy + sh);
    wp.addColorStop(0, "#5b7fb5");
    wp.addColorStop(0.55, "#8f7fc0");
    wp.addColorStop(1, "#e3a9a0");
    c.fillStyle = wp;
    c.fillRect(sx, sy, sw, sh);
    // holat paneli
    c.fillStyle = "#ffffff";
    c.font = "15px sans-serif";
    c.textAlign = "left";
    c.fillText("12:30", sx + 22, sy + 24);
    c.textAlign = "right";
    c.fillText("▮▮▮ 87%", sx + sw - 22, sy + 24);
    // soat vidjeti
    c.textAlign = "center";
    c.font = "300 64px sans-serif";
    c.fillText("12:30", sx + sw / 2, sy + 100);
    c.font = "15px sans-serif";
    c.fillText("Juma, 6-noyabr", sx + sw / 2, sy + 142);
    // 96 px to'r: 3 ustun x 2 qator, bizniki — o'rtada
    const ours = { name: "Piksel Qal'a", canvas: icon, bg: "#1f1730" };
    const grid = [
      GENERIC_APPS[0],
      GENERIC_APPS[1],
      GENERIC_APPS[2],
      GENERIC_APPS[3],
      ours,
      GENERIC_APPS[4],
    ];
    const S = 96,
      colW = sw / 3;
    grid.forEach((app, k) => {
      const cx = sx + colW * (k % 3) + (colW - S) / 2,
        cy = sy + 200 + Math.floor(k / 3) * 150;
      appIcon(c, cx, cy, S, app, "squircle", app.name);
    });
    c.fillStyle = "rgba(255,255,255,0.85)";
    c.font = "13px sans-serif";
    c.fillText("96 px", sx + sw / 2, sy + 505);
    // 48 px pastki panel (dok): doira shaklidagi ikonkalar, bizniki ikkinchi
    const dock = [
      GENERIC_APPS[9],
      ours,
      GENERIC_APPS[10],
      GENERIC_APPS[5],
      GENERIC_APPS[6],
      GENERIC_APPS[7],
    ];
    const s = 48,
      dy = sy + sh - 110;
    c.fillStyle = "rgba(255,255,255,0.22)";
    roundRect(c, sx + 18, dy - 18, sw - 36, s + 64, 26);
    c.fill();
    const step = (sw - 60) / dock.length;
    dock.forEach((app, k) => {
      const dx = sx + 30 + step * k + (step - s) / 2;
      appIcon(c, dx, dy, s, app, "circle", k === 1 ? "Piksel Qal'a" : app.name);
    });
    c.fillStyle = "rgba(255,255,255,0.85)";
    c.font = "13px sans-serif";
    c.textAlign = "center";
    c.fillText("48 px", sx + sw / 2, dy - 32);
    c.restore();
  });
  return cv;
}

// ───────────────────────────── anime Iblis ─────────────────────────────

const [D_INK, D_DARK, D_RED, D_GOLD, D_BONE] = PALETTES.demon;
const D_SKIN = mix(SKIN, D_BONE, 0.45);
// 1–5 — o'yindagi Iblis palitrasi aynan; 6+ — oraliq tonlar, kumush soch, olovli ko'z (imp palitrasi)
export const DEVIL_PAL = [
  null,
  D_INK,
  D_DARK,
  D_RED,
  D_GOLD,
  D_BONE,
  mix(D_BONE, "#ffffff", 0.55), // 6 kumush soch
  "#4a3a4c", // 7 obsidian shox
  D_SKIN, // 8 oqish teri
  mix(D_SKIN, D_DARK, 0.35), // 9 teri soyasi
  PALETTES.archer[4], // 10 ko'z — qizil
  PALETTES.imp[3], // 11 ko'z — olovrang (pastki yorug'lik)
  "#ffffff", // 12 yaltiroq
  mix(D_INK, D_DARK, 0.45), // 13 plash
  D_BONE, // 14 soch soyasi (kulrang suyak rangi)
  PALETTES.imp[4], // 15 oqish-sariq yaltiroq
];
const DI = {
  INK: 1,
  DARK: 2,
  RED: 3,
  GOLD: 4,
  BONE: 5,
  HAIR: 6,
  HORN: 7,
  SKIN: 8,
  SKIN_SH: 9,
  EYE: 10,
  EYE_L: 11,
  SHINE: 12,
  CAPE: 13,
  HAIR_SH: 14,
  CORE: 15,
};

/** sprites.ts dagi Iblis pozalari: bob/lean va bolta (o'yindagi raqamlar bilan bir xil) */
const DEVIL_POSE = {
  idle: [
    { b: 0, l: 0, hand: [23, 19], tip: [27, 26] },
    { b: 1, l: 0, hand: [24, 20], tip: [27, 26] },
  ],
  walk: [
    { b: 0, l: 0, hand: [24, 18], tip: [27, 26] },
    { b: -1, l: 0, hand: [23, 19], tip: [27, 26] },
    { b: 0, l: 0, hand: [22, 21], tip: [27, 26] },
    { b: 1, l: 0, hand: [24, 20], tip: [27, 26] },
  ],
  attack: [
    { b: -1, l: -1, hand: [23, 10], tip: [20, 3] },
    { b: 1, l: 2, hand: [23, 17], tip: [28, 21] },
    { b: 0, l: 1, hand: [22, 21], tip: [25, 27] },
  ],
  hurt: [{ b: 1, l: -3, hand: [21, 21], tip: [27, 26] }],
};

/** Ikki tig'li bolta (sprites.ts: demon) — anime bosh ustidan qayta chiziladi */
function devilAxe(g, hand, tip) {
  const [hx, hy] = hand,
    [tx, ty] = tip;
  const dx = tx - hx,
    dy = ty - hy,
    len = Math.hypot(dx, dy) || 1;
  const ux = dx / len,
    uy = dy / len,
    nx = -uy,
    ny = ux;
  g.line(DI.INK, [hx - ux * 2, hy - uy * 2], [tx, ty], 3);
  g.line(DI.BONE, [hx - ux * 2, hy - uy * 2], [tx, ty], 1);
  const pt = (a, b) => [tx + ux * a + nx * b, ty + uy * a + ny * b];
  g.polygon(DI.BONE, [
    pt(-2, -4),
    pt(1, -5),
    pt(2, -3),
    pt(1, 0),
    pt(2, 3),
    pt(1, 5),
    pt(-2, 4),
    pt(-3, 2),
    pt(-1, 0),
    pt(-3, -2),
  ]);
  g.line(DI.DARK, pt(-2, -2), pt(-2, 2), 1);
  g.rect(DI.GOLD, hx - 1, hy - 1, 3, 3);
}

/**
 * O'yindagi Iblis (32x32, 64 px da chiziladi) — anime ruhida: tana, oyoq va bolta o'yin sprite'idan
 * (spritePixels), boshi esa yangi: uzun kumush soch, obsidian shoxlar, oqish yuz va katta olovli ko'zlar,
 * orqada yirtiq plash.
 */
export function animeDevilSprite(state, frame) {
  const pose = (DEVIL_POSE[state] ?? DEVIL_POSE.idle)[frame] ?? DEVIL_POSE.idle[0];
  const { b, l } = pose;
  const base = new Grid(32);
  base.data = spritePixels("demon", state, frame).slice();
  // eski bosh va shoxlarni olib tashlash (yelka va qo'llar qoladi)
  for (let y = 0; y <= 12 + b; y++)
    for (let x = 0; x < 32; x++) {
      const c = base.get(x, y);
      if ((x >= 8 + l && x <= 23 + l) || c === DI.BONE || (c === DI.INK && y < 10 + b))
        base.set(0, x, y);
    }
  // plash (tana ortida)
  const cape = new Grid(32);
  cape.polygon(DI.CAPE, [
    [7 + l, 12 + b],
    [25 + l, 12 + b],
    [28, 28],
    [23, 26],
    [19, 29],
    [13, 26],
    [9, 29],
    [4, 27],
  ]);
  cape.line(DI.RED, [6 + l, 13 + b], [4, 26], 1);
  cape.line(DI.RED, [26 + l, 13 + b], [27, 27], 1);
  const g = base.merge(cape.outlined(DI.INK), true);
  // anime bosh
  const h = new Grid(32);
  const P = (x, y) => [x + l, y + b];
  h.polygon(DI.HAIR, [
    P(9, 4),
    P(23, 4),
    P(25, 10),
    P(25, 17),
    P(22, 15),
    P(20, 12),
    P(12, 12),
    P(10, 15),
    P(7, 17),
    P(7, 10),
  ]);
  h.line(DI.HAIR_SH, P(8, 11), P(8, 16), 1);
  h.line(DI.HAIR_SH, P(24, 11), P(24, 16), 1);
  h.rect(DI.SKIN, 11 + l, 6 + b, 10, 6);
  h.rect(DI.SKIN, 12 + l, 12 + b, 8, 1);
  h.rect(DI.SKIN_SH, 20 + l, 7 + b, 1, 5);
  h.rect(DI.SKIN_SH, 11 + l, 6 + b, 10, 1);
  for (const [ex, outer] of [
    [12, 11],
    [17, 20],
  ]) {
    h.rect(DI.INK, ex - 1 + l, 8 + b, 4, 1);
    h.set(DI.INK, outer + l, 7 + b);
    h.rect(DI.DARK, ex + l, 9 + b, 2, 1);
    h.rect(DI.EYE, ex + l, 10 + b, 2, 1);
    h.rect(DI.EYE_L, ex + l, 11 + b, 2, 1);
    h.set(DI.SHINE, ex + l, 9 + b);
  }
  h.set(DI.SKIN_SH, 16 + l, 12 + b);
  // peshona sochlari va yon tolalar
  h.rect(DI.HAIR, 10 + l, 3 + b, 12, 4);
  for (const [x, y] of [
    [10, 7],
    [10, 8],
    [13, 7],
    [15, 7],
    [18, 7],
    [21, 7],
    [21, 8],
  ])
    h.set(DI.HAIR, x + l, y + b);
  h.rect(DI.HAIR, 9 + l, 6 + b, 2, 8);
  h.rect(DI.HAIR, 21 + l, 6 + b, 2, 8);
  h.rect(DI.SHINE, 12 + l, 4 + b, 2, 1);
  h.set(DI.SHINE, 18 + l, 4 + b);
  h.set(DI.HAIR_SH, 16 + l, 5 + b);
  // obsidian shoxlar, uchlari qizil
  h.polygon(DI.HORN, [P(13, 5), P(9, 5), P(7, 3), P(6, 1), P(8, 2), P(10, 3), P(13, 3)]);
  h.polygon(DI.HORN, [P(19, 5), P(23, 5), P(25, 3), P(26, 1), P(24, 2), P(22, 3), P(19, 3)]);
  h.set(DI.RED, 6 + l, 1 + b);
  h.set(DI.RED, 26 + l, 1 + b);
  h.set(DI.BONE, 9 + l, 3 + b);
  h.set(DI.BONE, 23 + l, 3 + b);
  g.merge(h.outlined(DI.INK));
  // ko'tarilgan bolta bosh ustida qoladi
  if (state === "attack" && frame === 0) {
    const ax = new Grid(32);
    ax.line(DI.DARK, [21 + l, 14 + b], pose.hand, 5);
    devilAxe(ax, pose.hand, pose.tip);
    g.merge(ax.outlined(DI.INK));
  }
  return g;
}

/** Cut-in uchun anime Iblis portreti (64x64): kumush soch, shoxlar, katta olovli ko'zlar */
export function devilPortrait() {
  const g = new Grid(64);
  const { INK: K, DARK, RED, GOLD: G, BONE, HAIR, HORN, SKIN: S, SKIN_SH: SS } = DI;
  // orqa soch (uzun, yelkalardan pastga)
  g.polygon(DI.HAIR_SH, [
    [16, 14],
    [48, 14],
    [53, 40],
    [51, 60],
    [44, 48],
    [20, 48],
    [13, 60],
    [11, 40],
  ]);
  // zirh: baland yoqa, tikanli yelkaliklar
  g.polygon(DARK, [
    [14, 48],
    [50, 48],
    [54, 64],
    [10, 64],
  ]);
  g.polygon(RED, [
    [24, 50],
    [40, 50],
    [42, 64],
    [22, 64],
  ]);
  g.rect(G, 31, 52, 2, 12);
  g.rect(G, 24, 50, 17, 1);
  const pauldron = [
    [3, 54],
    [9, 45],
    [22, 46],
    [24, 57],
    [6, 62],
  ];
  const spike = [
    [7, 47],
    [1, 37],
    [13, 45],
  ];
  g.polygon(DARK, pauldron);
  g.polygon(DARK, mirrorPts(pauldron));
  g.polygon(BONE, spike);
  g.polygon(BONE, mirrorPts(spike));
  g.line(G, [9, 46], [22, 47], 1);
  g.line(G, [55, 46], [42, 47], 1);
  g.line(RED, [6, 55], [22, 53], 1);
  g.line(RED, [58, 55], [42, 53], 1);
  g.rect(S, 28, 38, 8, 9);
  g.rect(SS, 28, 38, 8, 3);
  g.polygon(RED, [
    [19, 39],
    [27, 45],
    [37, 45],
    [45, 39],
    [47, 49],
    [17, 49],
  ]);
  g.line(G, [19, 39], [27, 45], 1);
  g.line(G, [45, 39], [37, 45], 1);
  // yuz (o'tkir iyak)
  g.ellipse(HAIR, 32, 16, 15, 10);
  g.polygon(S, [
    [22, 18],
    [42, 18],
    [42, 29],
    [38, 36],
    [33, 41],
    [31, 41],
    [26, 36],
    [22, 29],
  ]);
  g.polygon(SS, [
    [40, 27],
    [42, 27],
    [42, 29],
    [38, 36],
    [33, 41],
    [32, 41],
    [37, 35],
  ]);
  g.rect(SS, 22, 18, 21, 2);
  // yovuz qoshlar va ko'zlar (tik qorachiq)
  const eye = {
    white: 12,
    dark: DARK,
    iris: DI.EYE,
    light: DI.EYE_L,
    pupil: K,
    shine: 12,
    lower: SS,
    slit: true,
  };
  animeEye(g, 23, 25, 7, 7, true, eye);
  animeEye(g, 35, 25, 7, 7, false, eye);
  g.line(DI.HAIR_SH, [22, 21], [29, 23], 1);
  g.line(DI.HAIR_SH, [22, 22], [29, 24], 1);
  g.line(DI.HAIR_SH, [42, 21], [35, 23], 1);
  g.line(DI.HAIR_SH, [42, 22], [35, 24], 1);
  // ko'z ostidagi qizil belgilar, burun, kinoyali tabassum va qoziq tish
  g.rect(RED, 24, 33, 3, 1);
  g.rect(RED, 38, 33, 3, 1);
  g.rect(SS, 32, 31, 1, 2);
  g.rect(DARK, 29, 36, 6, 1);
  g.set(DARK, 35, 35);
  g.set(12, 30, 37);
  // peshona sochlari: o'rtadan ayrilgan, oralig'ida oltin toj va qizil tosh
  g.rect(G, 29, 18, 6, 1);
  g.rect(RED, 31, 17, 2, 2);
  g.polygon(HAIR, [
    [17, 8],
    [47, 8],
    [47, 31],
    [44, 21],
    [41, 25],
    [38, 18],
    [35, 21],
    [34, 15],
    [30, 15],
    [29, 21],
    [26, 18],
    [23, 25],
    [20, 21],
    [17, 31],
  ]);
  for (const [a, b2] of [
    [
      [25, 10],
      [25, 17],
    ],
    [
      [39, 10],
      [39, 17],
    ],
    [
      [20, 12],
      [19, 24],
    ],
    [
      [44, 12],
      [45, 24],
    ],
  ])
    g.line(DI.HAIR_SH, a, b2, 1);
  g.rect(12, 22, 10, 5, 1);
  g.rect(12, 37, 10, 5, 1);
  const lock = [
    [16, 16],
    [22, 20],
    [22, 42],
    [19, 54],
    [15, 42],
  ];
  g.polygon(HAIR, lock);
  g.polygon(HAIR, mirrorPts(lock));
  g.line(DI.HAIR_SH, [19, 24], [19, 46], 1);
  g.line(DI.HAIR_SH, [45, 24], [45, 46], 1);
  // katta egilgan shoxlar
  const horn = [
    [22, 12],
    [15, 9],
    [10, 3],
    [10, 0],
    [14, 3],
    [20, 6],
    [27, 9],
  ];
  g.polygon(HORN, horn);
  g.polygon(HORN, mirrorPts(horn));
  g.line(RED, [11, 1], [15, 5], 1);
  g.line(RED, [53, 1], [49, 5], 1);
  g.line(DI.HAIR_SH, [16, 8], [22, 10], 1);
  g.line(DI.HAIR_SH, [48, 8], [42, 10], 1);
  return g.outlined(K);
}

/**
 * "Olov hukmi!" cut-in kartochkasi: ekran tepasida qiya qora-qizil lenta, chapda portret,
 * o'ngda hujum nomi. Xona koordinatalarida (320x240) chiziladi; c — game.render() o'zgarishisiz ctx.
 */
export function drawCutIn(c, t = 0) {
  c.save();
  // yurak va kuch chiziqlari (HUD) ostida qoladi
  c.translate(0, 12);
  // lenta
  const band = [
    [0, 30],
    [320, 22],
    [320, 80],
    [0, 88],
  ];
  c.fillStyle = "rgba(23,11,17,0.9)";
  c.beginPath();
  band.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.fill();
  // tezlik chiziqlari
  for (let i = 0; i < 22; i++) {
    const y = 30 + ((i * 37) % 52),
      x = ((i * 71 + t * 400) % 360) - 40,
      w = 24 + ((i * 13) % 50);
    c.fillStyle = i % 3 ? "rgba(104,30,43,0.9)" : "rgba(178,50,56,0.7)";
    c.fillRect(Math.round(x), Math.round(y - (x / 320) * 8), w, 1);
  }
  // hoshiya: qizil va oltin chiziq (qiya)
  const edge = (y0, y1, col, h) => {
    c.fillStyle = col;
    for (let x = 0; x < 320; x += 4) c.fillRect(x, Math.round(y0 + ((y1 - y0) * x) / 320), 4, h);
  };
  edge(28, 20, "#b23238", 2);
  edge(30, 22, "#f4cb45", 1);
  edge(87, 79, "#f4cb45", 1);
  edge(88, 80, "#b23238", 2);
  // portret ortida olov nuri va ramka
  radial(c, 46, 54, 44, "255,106,42", 0.55);
  c.save();
  c.beginPath();
  c.moveTo(10, 14);
  c.lineTo(86, 14);
  c.lineTo(86, 84);
  c.lineTo(10, 90);
  c.closePath();
  c.clip();
  c.fillStyle = "#2a0f18";
  c.fillRect(10, 14, 76, 76);
  radial(c, 48, 50, 40, "255,106,42", 0.45);
  paint(c, devilPortrait(), DEVIL_PAL, 16, 22, 1);
  c.globalCompositeOperation = "lighter";
  radial(c, 42.5, 50, 6, "255,59,59", 0.7);
  radial(c, 54.5, 50, 6, "255,59,59", 0.7);
  c.globalCompositeOperation = "source-over";
  c.restore();
  c.strokeStyle = "#f4cb45";
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(10.5, 14.5);
  c.lineTo(85.5, 14.5);
  c.lineTo(85.5, 84.5);
  c.lineTo(10.5, 90.5);
  c.closePath();
  c.stroke();
  // matn
  const text = (s, x, y, size, fill, shadow = "#000") => {
    c.font = `${size}px "Press Start 2P", monospace`;
    c.textAlign = "left";
    c.textBaseline = "alphabetic";
    c.fillStyle = shadow;
    for (const [dx, dy] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
      [1, 1],
      [2, 2],
    ])
      c.fillText(s, x + dx, y + dy);
    c.fillStyle = fill;
    c.fillText(s, x, y);
  };
  text("IBLIS", 98, 42, 7, "#ff6a2a");
  text("OLOVLI ZINDON HUKMDORI", 98, 76, 5, "#e0d6ee");
  const grad = c.createLinearGradient(0, 50, 0, 66);
  grad.addColorStop(0, "#fff0b0");
  grad.addColorStop(0.5, "#ffb02e");
  grad.addColorStop(1, "#d8452a");
  c.font = '16px "Press Start 2P", monospace';
  c.fillStyle = "#170b11";
  for (const [dx, dy] of [
    [-2, 0],
    [2, 0],
    [0, -2],
    [0, 2],
    [3, 3],
  ])
    c.fillText("Olov hukmi!", 98 + dx, 66 + dy);
  c.fillStyle = grad;
  c.fillText("Olov hukmi!", 98, 66);
  c.restore();
}
