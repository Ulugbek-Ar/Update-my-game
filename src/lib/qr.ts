/**
 * QR kod generatori (tashqi xizmat va paketsiz): bayt rejimi, xatoni tuzatish darajasi M,
 * 1–10 versiyalar, eng yaxshi niqob jarima qoidalari bo'yicha tanlanadi (ISO/IEC 18004).
 * Fon rasmlaridagi Telegram kanal QR kodi uchun (scripts/wallpapers.mjs).
 */

/** M darajasi: har blokdagi tuzatish kodlari va bloklar soni (1–10 versiyalar) */
const ECC_PER_BLOCK = [10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
const NUM_BLOCKS = [1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
const FORMAT_M = 0;

export interface QrCode {
  size: number;
  /** modules[y][x] — true: qora */
  modules: boolean[][];
}

function rawDataModules(ver: number) {
  let r = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const n = Math.floor(ver / 7) + 2;
    r -= (25 * n - 10) * n - 55;
    if (ver >= 7) r -= 36;
  }
  return r;
}

function dataCodewords(ver: number) {
  const i = ver - 1;
  return Math.floor(rawDataModules(ver) / 8) - ECC_PER_BLOCK[i]! * NUM_BLOCKS[i]!;
}

// ── Reed–Solomon (GF(256), 0x11D) ───────────────────────────────────────────────────────────
function gfMul(x: number, y: number) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

function rsDivisor(degree: number) {
  const r = new Array<number>(degree).fill(0);
  r[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < r.length; j++) {
      r[j] = gfMul(r[j]!, root);
      if (j + 1 < r.length) r[j] = r[j]! ^ r[j + 1]!;
    }
    root = gfMul(root, 0x02);
  }
  return r;
}

function rsRemainder(data: readonly number[], div: readonly number[]) {
  const r = new Array<number>(div.length).fill(0);
  for (const b of data) {
    const f = b ^ r.shift()!;
    r.push(0);
    div.forEach((c, i) => (r[i] = r[i]! ^ gfMul(c, f)));
  }
  return r;
}

function alignmentPositions(ver: number, size: number) {
  if (ver === 1) return [];
  const n = Math.floor(ver / 7) + 2;
  const step = Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
  const r = [6];
  for (let pos = size - 7; r.length < n; pos -= step) r.splice(1, 0, pos);
  return r;
}

/** Matnni (UTF-8) QR kodga aylantiradi. */
export function makeQr(text: string): QrCode {
  const bytes = Array.from(new TextEncoder().encode(text));
  let ver = 1;
  for (; ver <= 10; ver++)
    if (4 + (ver < 10 ? 8 : 16) + bytes.length * 8 <= dataCodewords(ver) * 8) break;
  if (ver > 10) throw new Error("QR uchun matn juda uzun");

  // ── ma'lumot bitlari ──
  const bits: number[] = [];
  const put = (v: number, n: number) => {
    for (let i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1);
  };
  put(0b0100, 4);
  put(bytes.length, ver < 10 ? 8 : 16);
  for (const b of bytes) put(b, 8);
  const cap = dataCodewords(ver) * 8;
  put(0, Math.min(4, cap - bits.length));
  put(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < cap; pad ^= 0xec ^ 0x11) put(pad, 8);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8)
    data.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));

  // ── bloklar va tuzatish kodlari, aralashtirish ──
  const nb = NUM_BLOCKS[ver - 1]!;
  const ecc = ECC_PER_BLOCK[ver - 1]!;
  const raw = Math.floor(rawDataModules(ver) / 8);
  const shortCount = nb - (raw % nb);
  const shortLen = Math.floor(raw / nb);
  const div = rsDivisor(ecc);
  const blocks: number[][] = [];
  for (let i = 0, k = 0; i < nb; i++) {
    const dat = data.slice(k, k + shortLen - ecc + (i < shortCount ? 0 : 1));
    k += dat.length;
    const block = [...dat, ...rsRemainder(dat, div)];
    if (i < shortCount) block.splice(shortLen - ecc, 0, -1);
    blocks.push(block);
  }
  const codewords: number[] = [];
  for (let i = 0; i < blocks[0]!.length; i++)
    for (let j = 0; j < blocks.length; j++)
      if (i !== shortLen - ecc || j >= shortCount) codewords.push(blocks[j]![i]!);

  // ── funksional naqshlar ──
  const size = ver * 4 + 17;
  const mod = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const fixed = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const set = (x: number, y: number, dark: boolean) => {
    mod[y]![x] = dark;
    fixed[y]![x] = true;
  };
  for (let i = 0; i < size; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  const finder = (cx: number, cy: number) => {
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx,
          y = cy + dy;
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        set(x, y, d !== 2 && d !== 4);
      }
  };
  finder(3, 3);
  finder(size - 4, 3);
  finder(3, size - 4);
  const al = alignmentPositions(ver, size);
  for (let i = 0; i < al.length; i++)
    for (let j = 0; j < al.length; j++) {
      if (
        (i === 0 && j === 0) ||
        (i === 0 && j === al.length - 1) ||
        (i === al.length - 1 && j === 0)
      )
        continue;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++)
          set(al[i]! + dx, al[j]! + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  const drawFormat = (mask: number) => {
    const d = (FORMAT_M << 3) | mask;
    let rem = d;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const b = ((d << 10) | rem) ^ 0x5412;
    const bit = (i: number) => ((b >>> i) & 1) !== 0;
    for (let i = 0; i <= 5; i++) set(8, i, bit(i));
    set(8, 7, bit(6));
    set(8, 8, bit(7));
    set(7, 8, bit(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
    set(8, size - 8, true);
  };
  drawFormat(0); // joyni band qilish
  if (ver >= 7) {
    let rem = ver;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const b = (ver << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const dark = ((b >>> i) & 1) !== 0;
      const a = size - 11 + (i % 3),
        c = Math.floor(i / 3);
      set(a, c, dark);
      set(c, a, dark);
    }
  }

  // ── ma'lumotni zigzag joylash ──
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++)
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!fixed[y]![x] && i < codewords.length * 8) {
          mod[y]![x] = ((codewords[i >>> 3]! >>> (7 - (i & 7))) & 1) !== 0;
          i++;
        }
      }
  }

  // ── niqob tanlash ──
  const maskFn = [
    (x: number, y: number) => (x + y) % 2 === 0,
    (_x: number, y: number) => y % 2 === 0,
    (x: number) => x % 3 === 0,
    (x: number, y: number) => (x + y) % 3 === 0,
    (x: number, y: number) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
    (x: number, y: number) => ((x * y) % 2) + ((x * y) % 3) === 0,
    (x: number, y: number) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
    (x: number, y: number) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
  ];
  const applyMask = (m: number) => {
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++)
        if (!fixed[y]![x] && maskFn[m]!(x, y)) mod[y]![x] = !mod[y]![x];
  };
  let best = 0;
  let bestScore = Infinity;
  for (let m = 0; m < 8; m++) {
    applyMask(m);
    drawFormat(m);
    const s = penalty(mod);
    if (s < bestScore) {
      bestScore = s;
      best = m;
    }
    applyMask(m); // qaytarish (XOR)
  }
  applyMask(best);
  drawFormat(best);
  return { size, modules: mod };
}

/** Niqob jarimasi (ISO/IEC 18004, 7.8.3) */
function penalty(m: boolean[][]) {
  const n = m.length;
  let s = 0;
  const line = (get: (i: number) => boolean) => {
    let run = 1;
    for (let i = 1; i <= n; i++) {
      if (i < n && get(i) === get(i - 1)) run++;
      else {
        if (run >= 5) s += run - 2;
        run = 1;
      }
    }
    // 1:1:3:1:1 naqsh (oldi yoki orqasida 4 oq)
    for (let i = 0; i + 7 <= n; i++) {
      const p = [0, 1, 2, 3, 4, 5, 6].map((k) => get(i + k));
      if (p[0] && !p[1] && p[2] && p[3] && p[4] && !p[5] && p[6]) {
        const before = [1, 2, 3, 4].every((k) => i - k < 0 || !get(i - k));
        const after = [7, 8, 9, 10].every((k) => i + k >= n || !get(i + k));
        if (before || after) s += 40;
      }
    }
  };
  for (let y = 0; y < n; y++) line((i) => m[y]![i]!);
  for (let x = 0; x < n; x++) line((i) => m[i]![x]!);
  let dark = 0;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      if (m[y]![x]) dark++;
      if (x + 1 < n && y + 1 < n) {
        const c = m[y]![x];
        if (c === m[y]![x + 1] && c === m[y + 1]![x] && c === m[y + 1]![x + 1]) s += 3;
      }
    }
  s += Math.floor(Math.abs((dark * 20) / (n * n) - 10)) * 10;
  return s;
}
