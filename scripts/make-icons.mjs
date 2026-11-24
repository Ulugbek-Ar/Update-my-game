// Ilova ikonkasi: tosh arka ichida qorong'i sehrli portal, tepa burchaklarda shoxli iblis
// boshlari (olov ko'zlar), yonlarda zanjirlar, pastda tosh pol. Hammasi kod bilan, piksel-art.
// Sahna har o'lcham uchun o'z to'rida (16..64 katak) chiziladi va faqat butun songa
// kattalashtiriladi — blur yo'q, 32x32 va 48x48 da ham aniq.
//
// Natija:
// - public/favicon.ico, public/icons/* — sayt va portativ versiya (manifest.webmanifest)
// - android/app/src/main/res — adaptive icon (alohida fon + old qatlam), eski ikonkalar, splash
// - src-tauri/icons — Windows (.ico va png)
// - store/icon-512.png — Play Market
// - docs/icon/ — tanlanmagan variant va solishtirma rasm (compare.png)
//
// Ishga tushirish: `node scripts/make-icons.mjs` (ICON_VARIANT=a|b, standart: b)
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import zlib from "node:zlib";

const CHOSEN = process.env.ICON_VARIANT ?? "b";
const OTHER = CHOSEN === "a" ? "b" : "a";
const RES = "android/app/src/main/res";
/** Android zichliklari: 1dp necha piksel */
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
/** adaptive icon: 108dp qatlamdan markaziy 66dp — har qanday niqobda ko'rinadigan xavfsiz doira */
const ADAPTIVE_SCALE = 0.58;

// ---------- palitra ----------
const hex = (s) => [
  parseInt(s.slice(1, 3), 16),
  parseInt(s.slice(3, 5), 16),
  parseInt(s.slice(5, 7), 16),
  255,
];
const C = {
  outline: hex("#0b0712"),
  wall: hex("#1d1530"),
  wallJoint: hex("#160f25"),
  vignette: hex("#140e20"),
  stone: [hex("#4b3f66"), hex("#55486f")],
  stoneHi: hex("#7a6c9c"),
  stoneLo: hex("#30273f"),
  stoneJoint: hex("#272035"),
  keystone: hex("#665886"),
  floor: [hex("#3a3050"), hex("#322944")],
  floorHi: hex("#52466c"),
  floorJoint: hex("#1f1830"),
  frame: [hex("#43385a"), hex("#4b4064")],
  frameHi: hex("#685b86"),
  skin: hex("#6e1c30"),
  skinHi: hex("#952b42"),
  skinLo: hex("#470f20"),
  brow: hex("#260710"),
  mouth: hex("#160307"),
  fang: hex("#ece2cc"),
  horn: [hex("#7e6c52"), hex("#ad9b7c"), hex("#e2d6bc")],
  eyeGlow: hex("#b2301a"),
  eye: hex("#ff9a1e"),
  eyeCore: hex("#fff0a0"),
  chain: hex("#857f96"),
  chainHi: hex("#c2bcd2"),
};
/** a — eskizga eng yaqin (qorong'i, chetlari xira yorug'); b — portal yorqinroq */
const VARIANTS = {
  a: {
    portal: ["#040208", "#110822", "#1f0e38", "#2e1652", "#3f1f6e", "#542a8e", "#6c38ae"],
    rim: ["#8a58cc", "#5a2f94"],
    halo: ["#231939", "#2a1d44"],
    lit: hex("#5e4888"),
    spill: hex("#43356c"),
  },
  b: {
    portal: ["#050209", "#1a0b30", "#2e1454", "#46207c", "#6430aa", "#8848d6", "#b07cf4"],
    rim: ["#e2ccff", "#9e66ee"],
    halo: ["#281b42", "#332254"],
    lit: hex("#7a58b4"),
    spill: hex("#56409a"),
  },
};

// ---------- sahna joylashuvi (0..1 koordinatalar, y pastga) ----------
const LAYOUTS = {
  // kvadrat ikonka: ramka, iblislar tepa burchaklarda
  square: {
    arch: { cx: 0.5, cy: 0.45, R: 0.3, x0: 0.2, x1: 0.8, bottom: 0.86 },
    open: { cy: 0.47, r: 0.175, x0: 0.325, x1: 0.675 },
    portal: { cx: 0.5, cy: 0.6 },
    devils: [
      { cx: 0.19, cy: 0.23, r: 0.105, s: -1 },
      { cx: 0.81, cy: 0.23, r: 0.105, s: 1 },
    ],
    chains: [
      { x: 0.115, y0: 0.34, y1: 0.8 },
      { x: 0.885, y0: 0.34, y1: 0.8 },
    ],
    floor: { y: 0.86, x0: -1, x1: 2, y1: 2 },
  },
  // doira/niqob uchun ixcham: iblislar arka yelkasida, hammasi markaziy doiraga sig'adi
  round: {
    arch: { cx: 0.5, cy: 0.47, R: 0.3, x0: 0.2, x1: 0.8, bottom: 0.86 },
    open: { cy: 0.49, r: 0.175, x0: 0.325, x1: 0.675 },
    portal: { cx: 0.5, cy: 0.62 },
    devils: [
      { cx: 0.27, cy: 0.315, r: 0.1, s: -1, spread: 0.55 },
      { cx: 0.73, cy: 0.315, r: 0.1, s: 1, spread: 0.55 },
    ],
    chains: [
      { x: 0.135, y0: 0.38, y1: 0.76 },
      { x: 0.865, y0: 0.38, y1: 0.76 },
    ],
    floor: { y: 0.86, x0: 0.17, x1: 0.83, y1: 0.91 },
  },
};

const hash = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

function inArch(a, u, v) {
  if (v > a.bottom) return false;
  if (v >= a.cy) return u >= a.x0 && u <= a.x1;
  return Math.hypot(u - a.cx, v - a.cy) <= a.R;
}
function inOpen(o, a, u, v) {
  if (v > a.bottom) return false;
  if (v >= o.cy) return u >= o.x0 && u <= o.x1;
  return Math.hypot(u - a.cx, v - o.cy) <= o.r;
}
/** arka toshining raqami (choklar qo'shni toshlar chegarasida chiziladi) */
function archStone(a, u, v) {
  if (v < a.cy) {
    const k = Math.floor(((Math.atan2(v - a.cy, u - a.cx) + Math.PI) / Math.PI) * 9);
    return `r${Math.max(0, Math.min(8, k))}`;
  }
  const row = Math.floor((v - a.cy) / 0.085);
  return `p${u < a.cx ? "l" : "r"}${row}`;
}
const keystone = (a, u, v) => {
  if (v >= a.cy) return false;
  const ang = (Math.atan2(v - a.cy, u - a.cx) + Math.PI) / Math.PI;
  return ang > 4 / 9 && ang < 5 / 9 && Math.hypot(u - a.cx, v - a.cy) <= a.R + 0.03;
};

/** iblis boshi: "head" | "horn" | null (+ shox uchun t) */
function devilPart(d, u, v) {
  const du = (u - d.cx) / d.r,
    dv = (v - d.cy) / d.r;
  for (const s of [-1, 1]) {
    for (let i = 0; i <= 28; i++) {
      const t = i / 28;
      const hx = s * (0.45 + (d.spread ?? 0.85) * Math.sin(t * Math.PI * 0.55));
      const hy = -0.5 - 1.35 * t + 0.15 * t * t;
      const rad = 0.31 * (1 - t) + 0.07;
      if (Math.hypot(du - hx, dv - hy) <= rad) return { part: "horn", t, du, dv };
    }
  }
  let head;
  if (dv <= 0.2) head = (du * du) / 0.75 + dv * dv <= 1;
  else head = dv <= 1.12 && Math.abs(du) <= 0.85 - ((dv - 0.2) / 0.92) * 0.6;
  return head ? { part: "head", du, dv } : null;
}
const EYE = { x: 0.37, y: 0.08, w: 0.22, h: 0.14 };

const Z = { bg: 0, floor: 1, portal: 1, arch: 2, chain: 3, frame: 4, devil: 5 };
const OUTLINED = new Set(["floor", "arch", "chain", "frame", "devil"]);

/**
 * Sahnani G×G to'rga chizadi. o: { layout, variant, scale, frame, bg }
 * scale<1 — sahna markazga kichraytirib qo'yiladi (adaptive/maskable xavfsiz zonasi).
 */
function render(G, o) {
  const L = LAYOUTS[o.layout];
  const V = VARIANTS[o.variant];
  const s = o.scale ?? 1;
  const n = G * s; // sahnaning 1 birligi necha katak
  const N = G * G;
  const kind = new Array(N).fill(null);
  const stone = new Array(N).fill(null);
  const info = new Array(N).fill(null);
  const toU = (x) => ((x + 0.5) / G - 0.5) / s + 0.5;
  const toPx = (u) => Math.round(((u - 0.5) * s + 0.5) * G - 0.5);
  const fl = L.floor;

  for (let y = 0; y < G; y++)
    for (let x = 0; x < G; x++) {
      const i = y * G + x,
        u = toU(x),
        v = toU(y);
      if (o.bg) {
        kind[i] = "bg";
        if (n >= 44) {
          const row = Math.floor(v / 0.07);
          stone[i] = `b${row}:${Math.floor(u / 0.14 + (row % 2) * 0.5)}`;
        }
      }
      if (o.onlyBg) continue;
      if (v >= fl.y && v <= fl.y1 && u >= fl.x0 && u <= fl.x1) {
        kind[i] = "floor";
        const row = Math.floor((v - fl.y) / 0.055);
        stone[i] = `f${row}:${Math.floor(u / 0.15 + (row % 2) * 0.5)}`;
      } else if (inOpen(L.open, L.arch, u, v)) kind[i] = "portal";
      else if (inArch(L.arch, u, v) || keystone(L.arch, u, v)) {
        kind[i] = "arch";
        stone[i] = keystone(L.arch, u, v) ? "key" : archStone(L.arch, u, v);
      }
    }

  // zanjirlar: piksel fazosida — halqa (3 katak) va yon ko'rinish (1 katak) almashadi
  const chains = o.onlyBg ? [] : L.chains;
  const devils = o.onlyBg ? [] : L.devils;
  for (const ch of chains) {
    const cx = toPx(ch.x),
      y0 = toPx(ch.y0),
      y1 = toPx(ch.y1);
    const len = Math.max(2, Math.round(0.045 * n));
    for (let y = y0; y <= y1; y++) {
      const ph = (y - y0) % (2 * len);
      const ring = ph < len;
      const set = (x, hi) => {
        if (x < 0 || x >= G || y < 0 || y >= G) return;
        const i = y * G + x;
        if (kind[i] === "devil") return;
        kind[i] = "chain";
        info[i] = hi;
      };
      if (ring) {
        if (ph === 0 || ph === len - 1) set(cx, false);
        else {
          set(cx - 1, true);
          set(cx + 1, false);
        }
      } else set(cx, true);
    }
  }

  // iblis boshlari
  for (let y = 0; y < G; y++)
    for (let x = 0; x < G; x++) {
      const u = toU(x),
        v = toU(y);
      for (const d of devils) {
        const p = devilPart(d, u, v);
        if (p) {
          const i = y * G + x;
          kind[i] = "devil";
          info[i] = { ...p, d };
        }
      }
    }

  // ramka
  if (o.frame) {
    const t = Math.max(1, Math.round(0.045 * G));
    for (let y = 0; y < G; y++)
      for (let x = 0; x < G; x++) {
        const dd = Math.min(x, y, G - 1 - x, G - 1 - y);
        if (dd >= t) continue;
        const i = y * G + x;
        kind[i] = "frame";
        info[i] = dd;
        const along = y < t || y >= G - t ? x : y;
        stone[i] =
          `fr${y < t ? "t" : y >= G - t ? "b" : x < t ? "l" : "r"}${Math.floor(along / Math.max(3, Math.round(G * 0.16)))}`;
      }
  }

  const K = (x, y) => (x < 0 || y < 0 || x >= G || y >= G ? null : kind[y * G + x]);
  const S = (x, y) => (x < 0 || y < 0 || x >= G || y >= G ? null : stone[y * G + x]);
  const isJoint = (x, y) => {
    const k = K(x, y),
      st = S(x, y);
    if (!st) return false;
    return (K(x + 1, y) === k && S(x + 1, y) !== st) || (K(x, y + 1) === k && S(x, y + 1) !== st);
  };
  const joints = (k) =>
    k === "arch" ? n >= 28 : k === "frame" ? G >= 40 : k === "floor" ? n >= 32 : true;

  const out = new Uint8ClampedArray(N * 4);
  const ramp = V.portal.map(hex);
  for (let y = 0; y < G; y++)
    for (let x = 0; x < G; x++) {
      const i = y * G + x,
        u = toU(x),
        v = toU(y);
      const k = kind[i];
      let c = null;
      if (k === "bg") {
        const dist = Math.hypot(u - L.portal.cx, v - L.portal.cy + 0.06);
        c = dist < 0.36 ? hex(V.halo[1]) : dist < 0.46 ? hex(V.halo[0]) : C.wall;
        if (Math.hypot(u - 0.5, v - 0.5) > 0.64) c = C.vignette;
        else if (stone[i] && isJoint(x, y)) c = C.wallJoint;
      } else if (k === "floor") {
        c = C.floor[hash(stone[i]) % 2];
        if (K(x, y - 1) !== "floor") c = C.floorHi;
        else if (joints(k) && isJoint(x, y)) c = C.floorJoint;
        if (Math.abs(u - 0.5) < 0.17 && v < fl.y + 0.06 && K(x, y - 1) === "floor") c = V.spill;
      } else if (k === "portal") {
        const nb = [K(x - 1, y), K(x + 1, y), K(x, y - 1), K(x, y + 1)];
        const nb2 = [K(x - 2, y), K(x + 2, y), K(x, y - 2), K(x, y + 2)];
        if (nb.some((q) => q !== "portal")) c = hex(V.rim[0]);
        else if (n >= 40 && nb2.some((q) => q !== "portal")) c = hex(V.rim[1]);
        else {
          const du = u - L.portal.cx,
            dv = v - L.portal.cy;
          const rr = Math.hypot(du, dv) / 0.2;
          const th = Math.atan2(dv, du);
          const f = ((((3 * th) / (2 * Math.PI) + 1.4 * Math.log(rr + 0.04)) % 1) + 1) % 1;
          const arm = f < 0.42;
          const lvl =
            rr < 0.16 ? 0 : Math.max(1, Math.min(6, Math.floor(rr * 2.4) + (arm ? 2 : 0)));
          c = ramp[lvl];
        }
      } else if (k === "arch") {
        c = stone[i] === "key" ? C.keystone : C.stone[hash(stone[i]) % 2];
        const up = K(x, y - 1),
          lf = K(x - 1, y),
          dn = K(x, y + 1),
          rt = K(x + 1, y);
        if ([up, lf, dn, rt].includes("portal")) c = V.lit;
        else if (up !== "arch" || lf !== "arch") c = C.stoneHi;
        else if (dn !== "arch" || rt !== "arch") c = C.stoneLo;
        else if (joints(k) && isJoint(x, y)) c = C.stoneJoint;
      } else if (k === "chain") {
        c = info[i] ? C.chainHi : C.chain;
      } else if (k === "frame") {
        const t = Math.max(1, Math.round(0.045 * G));
        c = C.frame[hash(stone[i]) % 2];
        if (t >= 2 && info[i] === 0) c = C.outline;
        else if (info[i] === (t >= 2 ? 1 : 0)) c = C.frameHi;
        else if (joints(k) && isJoint(x, y)) c = C.stoneJoint;
      } else if (k === "devil") {
        const p = info[i];
        if (p.part === "horn") c = C.horn[Math.min(2, Math.floor(p.t * 3))];
        else {
          const { du, dv } = p;
          c = du < -0.15 && dv < -0.1 ? C.skinHi : dv > 0.55 ? C.skinLo : C.skin;
          const ex = Math.abs(du) - EYE.x;
          const browY = -0.12 - 0.42 * (Math.abs(du) - 0.1);
          if (Math.hypot(ex, dv - EYE.y) < 0.36) c = C.eyeGlow;
          if (Math.abs(du) > 0.08 && Math.abs(du) < 0.7 && Math.abs(dv - browY) < 0.11) c = C.brow;
          if (Math.abs(ex) <= EYE.w && Math.abs(dv - EYE.y) <= EYE.h) c = C.eye;
          if (dv > 0.52 && dv < 0.72 && Math.abs(du) < 0.42) c = C.mouth;
          if (n >= 40 && dv > 0.5 && dv < 0.84 && Math.abs(Math.abs(du) - 0.24) < 0.08) c = C.fang;
        }
      }
      if (c) out.set(c, i * 4);
    }

  // kontur: ustki qatlamdagi narsa atrofida 1 katak to'q chiziq
  for (let y = 0; y < G; y++)
    for (let x = 0; x < G; x++) {
      const i = y * G + x,
        k = kind[i];
      if (k === "portal" || k === "frame") continue;
      const z = k ? Z[k] : -1;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const q = K(x + dx, y + dy);
        if (q && OUTLINED.has(q) && Z[q] > z && !(k === "floor" && q === "arch")) {
          out.set(C.outline, i * 4);
          break;
        }
      }
    }

  // ko'zlar har o'lchamda kamida bitta yorqin katak bo'lib porlaydi
  for (const d of devils)
    for (const sx of [-1, 1]) {
      const x = toPx(d.cx + sx * EYE.x * d.r),
        y = toPx(d.cy + EYE.y * d.r);
      if (x >= 0 && y >= 0 && x < G && y < G) out.set(C.eyeCore, (y * G + x) * 4);
    }
  return { w: G, h: G, data: out };
}

// ---------- rasm yordamchilari ----------
const blank = (w, h) => ({ w, h, data: new Uint8ClampedArray(w * h * 4) });
function upscale(img, k) {
  const r = blank(img.w * k, img.h * k);
  for (let y = 0; y < r.h; y++)
    for (let x = 0; x < r.w; x++) {
      const si = (Math.floor(y / k) * img.w + Math.floor(x / k)) * 4;
      r.data.set(img.data.subarray(si, si + 4), (y * r.w + x) * 4);
    }
  return r;
}
/** o'lcham uchun to'r: size = G·k, G ≤ 64 (kichik o'lchamlar o'z to'rida chiziladi) */
const gridFor = (size) => {
  for (let k = 1; k <= size; k++) if (size % k === 0 && size / k <= 64) return [size / k, k];
  return [size, 1];
};
const icon = (size, o) => {
  const [G, k] = gridFor(size);
  return upscale(render(G, o), k);
};
function blit(dst, src, ox, oy) {
  for (let y = 0; y < src.h; y++)
    for (let x = 0; x < src.w; x++) {
      const dx = ox + x,
        dy = oy + y;
      if (dx < 0 || dy < 0 || dx >= dst.w || dy >= dst.h) continue;
      const si = (y * src.w + x) * 4,
        di = (dy * dst.w + dx) * 4;
      const a = src.data[si + 3] / 255;
      if (!a) continue;
      for (let c = 0; c < 3; c++)
        dst.data[di + c] = src.data[si + c] * a + dst.data[di + c] * (1 - a);
      dst.data[di + 3] = Math.max(dst.data[di + 3], src.data[si + 3]);
    }
}
function crop(img, x0, y0, w, h) {
  const r = blank(w, h);
  for (let y = 0; y < h; y++)
    r.data.set(
      img.data.subarray(((y0 + y) * img.w + x0) * 4, ((y0 + y) * img.w + x0 + w) * 4),
      y * w * 4,
    );
  return r;
}
/** niqob: inside(nx, ny) — markazga nisbatan -1..1 koordinatalarda */
function mask(img, inside) {
  const r = blank(img.w, img.h);
  r.data.set(img.data);
  for (let y = 0; y < img.h; y++)
    for (let x = 0; x < img.w; x++) {
      const nx = ((x + 0.5) / img.w) * 2 - 1,
        ny = ((y + 0.5) / img.h) * 2 - 1;
      if (!inside(nx, ny)) r.data[(y * img.w + x) * 4 + 3] = 0;
    }
  return r;
}
const MASKS = {
  circle: (x, y) => x * x + y * y <= 1,
  squircle: (x, y) => x ** 4 + y ** 4 <= 1,
  square: (x, y) => {
    const r = 0.24,
      ax = Math.abs(x),
      ay = Math.abs(y);
    return ax <= 1 - r || ay <= 1 - r || (ax - (1 - r)) ** 2 + (ay - (1 - r)) ** 2 <= r * r;
  },
};

// ---------- PNG va ICO yozish ----------
const CRC = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
const crc32 = (buf) => {
  let c = -1;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
function png(img) {
  const raw = Buffer.alloc((img.w * 4 + 1) * img.h);
  for (let y = 0; y < img.h; y++)
    Buffer.from(img.data.buffer, y * img.w * 4, img.w * 4).copy(raw, y * (img.w * 4 + 1) + 1);
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(img.w, 0);
  ihdr.writeUInt32BE(img.h, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
function ico(imgs) {
  const pngs = imgs.map(png);
  const head = Buffer.alloc(6 + 16 * imgs.length);
  head.writeUInt16LE(0, 0);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(imgs.length, 4);
  let off = head.length;
  imgs.forEach((im, i) => {
    const e = 6 + 16 * i;
    head[e] = im.w >= 256 ? 0 : im.w;
    head[e + 1] = im.h >= 256 ? 0 : im.h;
    head.writeUInt16LE(1, e + 4);
    head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(pngs[i].length, e + 8);
    head.writeUInt32LE(off, e + 12);
    off += pngs[i].length;
  });
  return Buffer.concat([head, ...pngs]);
}

// ---------- ikonka turlari ----------
const square = (size, variant) => icon(size, { layout: "square", variant, frame: true, bg: true });
/** sayt maskable: xavfsiz zona — markazdagi 80% doira */
const maskable = (size, variant) => icon(size, { layout: "round", variant, bg: true, scale: 0.8 });
const adaptiveFg = (size, variant) =>
  icon(size, { layout: "round", variant, scale: ADAPTIVE_SCALE });
/** adaptive fon qatlami: faqat devor, portal yorug'i va vinyetka */
const adaptiveBg = (size, variant) =>
  icon(size, { layout: "round", variant, scale: ADAPTIVE_SCALE, bg: true, onlyBg: true });
/** eski Android doira ikonkasi: doiraga kesilgan, chetida to'q halqa */
function legacyRound(size, variant) {
  const img = mask(icon(size, { layout: "round", variant, bg: true, scale: 0.86 }), MASKS.circle);
  const ring = Math.max(1, Math.round(size / 48));
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2);
      if (d <= size / 2 && d > size / 2 - ring) img.data.set(C.outline, (y * size + x) * 4);
    }
  return img;
}
/** adaptive fon + old qatlam, 72dp ko'rinadigan qismi niqob bilan (solishtirish uchun) */
function adaptivePreview(dp, variant, m) {
  const size = 108 * dp;
  const full = blank(size, size);
  blit(full, adaptiveBg(size, variant), 0, 0);
  blit(full, adaptiveFg(size, variant), 0, 0);
  const vis = crop(full, 18 * dp, 18 * dp, 72 * dp, 72 * dp);
  return mask(vis, MASKS[m]);
}

function compare() {
  const W = 1820,
    rowH = 560;
  const img = blank(W, rowH * 2);
  ["a", "b"].forEach((variant, r) => {
    const y0 = r * rowH;
    const bgc = r === 0 ? [214, 214, 222, 255] : [46, 46, 54, 255];
    for (let y = y0; y < y0 + rowH; y++)
      for (let x = 0; x < W; x++)
        img.data.set(y < y0 + rowH / 2 ? bgc : [128, 128, 136, 255], (y * W + x) * 4);
    let x = 24;
    const put = (im, yy = y0 + 24) => {
      blit(img, im, x, yy);
      x += im.w + 24;
    };
    put(square(512, variant));
    put(square(192, variant));
    const s48 = square(48, variant),
      s32 = square(32, variant);
    blit(img, s48, x, y0 + 24);
    blit(img, s32, x, y0 + 96);
    blit(img, s48, x, y0 + 300);
    blit(img, s32, x, y0 + 372);
    x += 72;
    put(upscale(s48, 4));
    blit(img, upscale(s32, 6), x - 216, y0 + 300);
    for (const m of ["circle", "squircle", "square"]) {
      const p = adaptivePreview(2, variant, m);
      blit(img, p, x, y0 + 24);
      blit(img, adaptivePreview(2, variant, m), x, y0 + 300);
      const small = adaptivePreview(1, variant, m);
      blit(img, crop(small, 0, 0, 72, 72), x + 152, y0 + 24);
      x += 230;
    }
    // 66dp xavfsiz doira chizig'i (oxirgi doira niqobida)
    const cx = x - 690 + 72,
      cy = y0 + 300 + 72;
    for (let a = 0; a < 720; a++) {
      const px = Math.round(cx + Math.cos((a / 720) * Math.PI * 2) * 66),
        py = Math.round(cy + Math.sin((a / 720) * Math.PI * 2) * 66);
      img.data.set([0, 255, 120, 255], (py * W + px) * 4);
    }
  });
  return img;
}

// ---------- fayllar ----------
function build(variant) {
  const files = {};
  const web = (p, im) => (files[p] = png(im));
  web("public/icons/icon-192.png", square(192, variant));
  web("public/icons/icon-512.png", square(512, variant));
  web("public/icons/icon-maskable-192.png", maskable(192, variant));
  web("public/icons/icon-maskable-512.png", maskable(512, variant));
  files["public/favicon.ico"] = ico([16, 32, 48, 256].map((s) => square(s, variant)));
  web("store/icon-512.png", square(512, variant));
  for (const [name, dp] of Object.entries(DENSITIES)) {
    const dir = `${RES}/mipmap-${name}`;
    const big = Math.round(108 * dp),
      small = Math.round(48 * dp);
    web(`${dir}/ic_launcher_foreground.png`, adaptiveFg(big, variant));
    web(`${dir}/ic_launcher_background.png`, adaptiveBg(big, variant));
    web(`${dir}/ic_launcher.png`, square(small, variant));
    web(`${dir}/ic_launcher_round.png`, legacyRound(small, variant));
  }
  web(`${RES}/drawable-nodpi/splash_logo.png`, icon(256, { layout: "round", variant }));
  web("src-tauri/icons/32x32.png", square(32, variant));
  web("src-tauri/icons/128x128.png", square(128, variant));
  web("src-tauri/icons/128x128@2x.png", square(256, variant));
  web("src-tauri/icons/icon.png", square(512, variant));
  files["src-tauri/icons/icon.ico"] = ico([16, 24, 32, 48, 64, 256].map((s) => square(s, variant)));
  return files;
}

const files = build(CHOSEN);
for (const s of [512, 192, 48, 32])
  files[`docs/icon/variant-${OTHER}-${s}.png`] = png(square(s, OTHER));
files[`docs/icon/variant-${OTHER}-adaptive-circle.png`] = png(adaptivePreview(4, OTHER, "circle"));
files["docs/icon/compare.png"] = png(compare());
for (const [file, buf] of Object.entries(files)) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, buf);
}
console.log(`✓ ${Object.keys(files).length} ta fayl (variant ${CHOSEN}; ${OTHER} — docs/icon/)`);
