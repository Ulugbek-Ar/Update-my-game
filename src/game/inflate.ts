/**
 * Kichik raw-DEFLATE (RFC 1951) dekoderi: DecompressionStream("deflate-raw") bo'lmagan eski
 * brauzer va WebView'larda ham ko'chirish kodi o'qilsin (transfer.ts). Buzilgan ma'lumotda xato tashlaydi.
 */
const LEN_BASE = [
  3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131,
  163, 195, 227, 258,
];
const LEN_EXTRA = [
  0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0,
];
const DIST_BASE = [
  1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049,
  3073, 4097, 6145, 8193, 12289, 16385, 24577,
];
const DIST_EXTRA = [
  0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13,
];
/** Kod uzunligi kodlarining tartibi (dinamik blok sarlavhasi) */
const CL_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

/** Kanonik Huffman jadvali: har uzunlikdagi kodlar soni va tartiblangan belgilar. */
interface Huffman {
  counts: Uint16Array;
  symbols: Uint16Array;
}

function huffman(lengths: ArrayLike<number>): Huffman {
  const counts = new Uint16Array(16);
  for (let i = 0; i < lengths.length; i++) counts[lengths[i]!]!++;
  counts[0] = 0;
  const offs = new Uint16Array(16);
  for (let l = 1; l < 16; l++) offs[l] = offs[l - 1]! + counts[l - 1]!;
  const symbols = new Uint16Array(lengths.length);
  for (let i = 0; i < lengths.length; i++) {
    const l = lengths[i]!;
    if (l) symbols[offs[l]!++] = i;
  }
  return { counts, symbols };
}

let fixed: { lit: Huffman; dist: Huffman } | null = null;
function fixedTables() {
  if (fixed) return fixed;
  const lit = new Uint8Array(288);
  lit.fill(8, 0, 144);
  lit.fill(9, 144, 256);
  lit.fill(7, 256, 280);
  lit.fill(8, 280, 288);
  fixed = { lit: huffman(lit), dist: huffman(new Uint8Array(30).fill(5)) };
  return fixed;
}

export function inflateRaw(src: Uint8Array): Uint8Array {
  let pos = 0;
  let buf = 0;
  let cnt = 0;
  let out = new Uint8Array(Math.max(1024, src.length * 4));
  let len = 0;
  const room = (n: number) => {
    if (len + n <= out.length) return;
    const next = new Uint8Array(Math.max(out.length * 2, len + n));
    next.set(out.subarray(0, len));
    out = next;
  };
  const bits = (n: number) => {
    while (cnt < n) {
      if (pos >= src.length) throw new Error("inflate: ma'lumot tugadi");
      buf |= src[pos++]! << cnt;
      cnt += 8;
    }
    const v = buf & ((1 << n) - 1);
    buf >>>= n;
    cnt -= n;
    return v;
  };
  const decode = (h: Huffman) => {
    let code = 0;
    let first = 0;
    let index = 0;
    for (let l = 1; l < 16; l++) {
      code |= bits(1);
      const count = h.counts[l]!;
      if (code - count < first) return h.symbols[index + code - first]!;
      index += count;
      first = (first + count) << 1;
      code <<= 1;
    }
    throw new Error("inflate: noto'g'ri kod");
  };
  const block = (lit: Huffman, dist: Huffman) => {
    for (;;) {
      const sym = decode(lit);
      if (sym < 256) {
        room(1);
        out[len++] = sym;
      } else if (sym === 256) return;
      else {
        const li = sym - 257;
        if (li >= 29) throw new Error("inflate: noto'g'ri uzunlik");
        const n = LEN_BASE[li]! + bits(LEN_EXTRA[li]!);
        const di = decode(dist);
        if (di >= 30) throw new Error("inflate: noto'g'ri masofa");
        const d = DIST_BASE[di]! + bits(DIST_EXTRA[di]!);
        if (d > len) throw new Error("inflate: masofa juda uzoq");
        room(n);
        for (let k = 0; k < n; k++, len++) out[len] = out[len - d]!;
      }
    }
  };
  let last = 0;
  while (!last) {
    last = bits(1);
    const type = bits(2);
    if (type === 0) {
      // saqlangan blok: bayt chegarasiga tekislanadi
      buf = 0;
      cnt = 0;
      if (pos + 4 > src.length) throw new Error("inflate: ma'lumot tugadi");
      const n = src[pos]! | (src[pos + 1]! << 8);
      const nn = src[pos + 2]! | (src[pos + 3]! << 8);
      pos += 4;
      if ((n ^ 0xffff) !== nn || pos + n > src.length) throw new Error("inflate: buzilgan blok");
      room(n);
      out.set(src.subarray(pos, pos + n), len);
      len += n;
      pos += n;
    } else if (type === 1) {
      const t = fixedTables();
      block(t.lit, t.dist);
    } else if (type === 2) {
      const nlit = bits(5) + 257;
      const ndist = bits(5) + 1;
      const ncode = bits(4) + 4;
      const cl = new Uint8Array(19);
      for (let i = 0; i < ncode; i++) cl[CL_ORDER[i]!] = bits(3);
      const clh = huffman(cl);
      const lengths = new Uint8Array(nlit + ndist);
      for (let i = 0; i < lengths.length;) {
        const sym = decode(clh);
        if (sym < 16) lengths[i++] = sym;
        else {
          let rep = 0;
          let val = 0;
          if (sym === 16) {
            if (!i) throw new Error("inflate: takror boshida");
            val = lengths[i - 1]!;
            rep = 3 + bits(2);
          } else if (sym === 17) rep = 3 + bits(3);
          else rep = 11 + bits(7);
          if (i + rep > lengths.length) throw new Error("inflate: ortiqcha uzunliklar");
          lengths.fill(val, i, i + rep);
          i += rep;
        }
      }
      block(huffman(lengths.subarray(0, nlit)), huffman(lengths.subarray(nlit)));
    } else throw new Error("inflate: noma'lum blok turi");
  }
  return out.slice(0, len);
}
