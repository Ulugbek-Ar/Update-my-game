/**
 * Progressni ko'chirish kodi: sayt, Telegram va Android ilova o'rtasida saqlanishni ko'chirish.
 * Kod: "PQ1-" + rejim harfi + base64url(siqilgan JSON) + "-" + CRC32 (8 hex).
 * Qurilmaga xos kalitlar (boshqaruv joylashuvi, ovoz, dev, ko'rilgan versiya) kodga kirmaydi.
 */
import { ACHIEVEMENTS, ACHIEVEMENTS_KEY } from "./achievements";
import { MUTE_KEY } from "./audio";
import { HERO_LIST, bestKeys, type Hero } from "./hero";
import { inflateRaw } from "./inflate";
import { DEV_KEY, REALM_SAVE_KEY } from "./realmLink";
import { SAVE_VERSION, SAVE_VERSION_KEY, UNLOCKED_HEROES_KEY, migrateSave } from "./save";
import { SETTINGS_KEY } from "./settings";
import { GOLD_KEY } from "./shop";
import { GAME_VERSION, SEEN_VERSION_KEY } from "./version";

export const TRANSFER_PREFIX = "PQ1-";
/** Kod qo'llanishidan oldingi saqlanish (OLDINGI HOLATGA QAYTARISH) */
export const BACKUP_KEY = "pixel-rpg-backup";
/** Telegram xabariga sig'ishi uchun: bitta kod (yoki qism) shundan qisqa */
export const MAX_CODE = 3500;
export const BAD_CODE = "Kod noto'g'ri yoki to'liq nusxalanmagan";

const PREFIX = "pixel-rpg-";
const FORMAT = 1;
/** Har qurilmada o'zi: kodga kirmaydi va import ularni o'zgartirmaydi */
const DEVICE_KEYS: ReadonlySet<string> = new Set([
  SETTINGS_KEY,
  MUTE_KEY,
  DEV_KEY,
  SEEN_VERSION_KEY,
  BACKUP_KEY,
]);

export function isProgressKey(key: string) {
  return key.startsWith(PREFIX) && !DEVICE_KEYS.has(key);
}

/** Hozirgi progress kalitlari (qurilmaga xoslarisiz). */
function collect(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && isProgressKey(k)) keys.push(k);
    }
    for (const k of keys.sort()) out[k] = localStorage.getItem(k) ?? "";
  } catch {
    /* saqlash imkonsiz */
  }
  return out;
}

/** Progress kalitlarini to'liq almashtiradi; qurilmaga xoslarga tegmaydi. */
function replace(keys: Record<string, string>) {
  for (const k of Object.keys(collect())) localStorage.removeItem(k);
  for (const [k, v] of Object.entries(keys)) if (isProgressKey(k)) localStorage.setItem(k, v);
}

// ---------- ko'rib chiqish ----------

export interface ProgressSummary {
  gold: number;
  /** Ochilgan qahramonlar (bepullar doim) */
  heroes: Hero[];
  achievements: number;
  /** Barcha qahramon va dunyolar bo'yicha eng yaxshi rekord */
  best: number;
}

function parseList(raw: string | null): unknown[] {
  try {
    const v: unknown = JSON.parse(raw ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function summarize(get: (key: string) => string | null): ProgressSummary {
  const owned = parseList(get(UNLOCKED_HEROES_KEY));
  const ids = new Set<string>(ACHIEVEMENTS.map((a) => a.id));
  const got = new Set(parseList(get(ACHIEVEMENTS_KEY)).filter((x) => ids.has(x as string)));
  let best = 0;
  for (const h of HERO_LIST)
    for (const k of Object.values(bestKeys(h.id))) best = Math.max(best, Number(get(k)) || 0);
  return {
    gold: Math.max(0, Math.floor(Number(get(GOLD_KEY)) || 0)),
    heroes: HERO_LIST.filter((h) => h.price <= 0 || owned.includes(h.id)).map((h) => h.id),
    achievements: got.size,
    best,
  };
}

export function currentSummary() {
  return summarize((k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  });
}

// ---------- olam tumani: bitset -> RLE ----------

/** base64url alifbosi; tuman RLE'si ham shu belgilar bilan yoziladi */
const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const FOG_TAG = "rle:";

/**
 * O'rganilgan plitkalar bitseti (base64) -> ketma-ket bir xil bitlar uzunligi (RLE, 0-bitlardan boshlab).
 * Har uzunlik 6-bitli belgilarda: 5 bit qiymat + davomi bor belgisi. Aniq tiklanmasa — null.
 */
export function packFog(b64: string): string | null {
  let bin: string;
  try {
    bin = atob(b64);
  } catch {
    return null;
  }
  if (btoa(bin) !== b64) return null;
  let s = FOG_TAG;
  const put = (n: number) => {
    do {
      const d = n & 31;
      n >>>= 5;
      s += ALPHA[d | (n ? 32 : 0)];
    } while (n);
  };
  let cur = 0;
  let run = 0;
  for (let i = 0; i < bin.length * 8; i++) {
    const b = (bin.charCodeAt(i >> 3) >> (i & 7)) & 1;
    if (b === cur) run++;
    else {
      put(run);
      cur = b;
      run = 1;
    }
  }
  put(run);
  return s;
}

export function unpackFog(rle: string): string {
  if (!rle.startsWith(FOG_TAG)) throw new Error("fog");
  const runs: number[] = [];
  let n = 0;
  let shift = 0;
  for (const ch of rle.slice(FOG_TAG.length)) {
    const d = ALPHA.indexOf(ch);
    if (d < 0 || shift > 25) throw new Error("fog");
    n += (d & 31) * 2 ** shift;
    shift += 5;
    if (!(d & 32)) {
      runs.push(n);
      n = 0;
      shift = 0;
    }
  }
  const total = runs.reduce((a, b) => a + b, 0);
  if (shift || total % 8 || total > 1 << 20) throw new Error("fog");
  const bytes = new Uint8Array(total / 8);
  let i = 0;
  runs.forEach((r, k) => {
    if (k % 2) for (let j = i; j < i + r; j++) bytes[j >> 3]! |= 1 << (j & 7);
    i += r;
  });
  return bytesToBinary(bytes, btoa);
}

type RealmLike = { player?: { explored?: unknown } };

function mapFog(realm: unknown, f: (s: string) => string | null): unknown {
  const r = realm as RealmLike | null;
  const e = r?.player?.explored;
  if (typeof e !== "string") return realm;
  const next = f(e);
  return next === null ? realm : { ...r, player: { ...r!.player, explored: next } };
}

// ---------- kodlash ----------

function bytesToBinary(bytes: Uint8Array, then: (bin: string) => string) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return then(s);
}

function toB64url(bytes: Uint8Array) {
  return bytesToBinary(bytes, btoa).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string) {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

let crcTable: Uint32Array | null = null;
export function crc32(s: string) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < s.length; i++) c = crcTable[(c ^ s.charCodeAt(i)) & 0xff]! ^ (c >>> 8);
  return ((c ^ 0xffffffff) >>> 0).toString(16).padStart(8, "0");
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const w = stream.writable.getWriter();
  w.write(bytes as Uint8Array<ArrayBuffer>).catch(() => {});
  w.close().catch(() => {});
  const r = stream.readable.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await r.read();
    if (done) break;
    parts.push(value);
    size += value.length;
  }
  const out = new Uint8Array(size);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** "deflate-raw" bilan siqadi; brauzer qo'llamasa — null (kod siqilmasdan yoziladi). */
async function deflate(bytes: Uint8Array): Promise<Uint8Array | null> {
  try {
    if (typeof CompressionStream === "undefined") return null;
    return await pipe(bytes, new CompressionStream("deflate-raw"));
  } catch {
    return null;
  }
}

async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  let native: DecompressionStream | null = null;
  try {
    if (typeof DecompressionStream !== "undefined") native = new DecompressionStream("deflate-raw");
  } catch {
    native = null;
  }
  return native ? pipe(bytes, native) : inflateRaw(bytes);
}

interface Payload {
  /** Kod formati */
  f: number;
  /** Eksport qilgan o'yin versiyasi */
  g: string;
  /** JSON qiymatlar (kalit "pixel-rpg-" siz) */
  j: Record<string, unknown>;
  /** Oddiy matn qiymatlar */
  t: Record<string, string>;
}

/** Hozirgi progressdan ko'chirish kodi. */
export async function exportCode(): Promise<string> {
  const p: Payload = { f: FORMAT, g: GAME_VERSION, j: {}, t: {} };
  for (const [k, v] of Object.entries(collect())) {
    const key = k.slice(PREFIX.length);
    let parsed: unknown;
    try {
      parsed = JSON.parse(v);
    } catch {
      parsed = undefined;
    }
    if (parsed !== undefined && JSON.stringify(parsed) === v)
      p.j[key] = k === REALM_SAVE_KEY ? mapFog(parsed, packFog) : parsed;
    else p.t[key] = v;
  }
  const raw = new TextEncoder().encode(JSON.stringify(p));
  const packed = await deflate(raw);
  const body = packed ? "Z" + toB64url(packed) : "J" + toB64url(raw);
  // Telegram "__matn__" ni kursivga aylantirmasin: ketma-ket "_" orasiga nuqta (o'qishda tashlanadi)
  return `${TRANSFER_PREFIX}${body.replace(/_(?=_)/g, "_.")}-${crc32(body)}`;
}

/** Uzun kod Telegram xabarlariga bo'linadi (har qism MAX_CODE dan qisqa). */
export function splitCode(code: string): string[] {
  const n = Math.ceil(code.length / (MAX_CODE - 1));
  if (n <= 1) return [code];
  const size = Math.ceil(code.length / n);
  return Array.from({ length: n }, (_, i) => code.slice(i * size, (i + 1) * size));
}

export interface TransferData {
  keys: Record<string, string>;
  /** Kodni yaratgan o'yin versiyasi */
  game: string;
  summary: ProgressSummary;
}

export type ReadResult = { ok: true; data: TransferData } | { ok: false; error: string };

const bad = (error = BAD_CODE): ReadResult => ({ ok: false, error });

/** Kodni tekshiradi va o'qiydi (localStorage'ga tegmaydi). Qismlar ketma-ket qo'yilsa ham bo'ladi. */
export async function readCode(text: string): Promise<ReadResult> {
  let s = text.replace(/\s+/g, "");
  if (!s) return bad("Avval kodni kiriting");
  // qismlar teskari tartibda qo'yilgan bo'lsa ham
  const at = s.indexOf(TRANSFER_PREFIX);
  if (at > 0) s = s.slice(at) + s.slice(0, at);
  const m = /^PQ(\d+)-(.+)-([0-9a-f]{8})$/i.exec(s);
  if (!m) return bad();
  if (Number(m[1]) > FORMAT)
    return bad("Bu kod o'yinning yangiroq versiyasidan. Avval o'yinni yangilang");
  const body = m[2]!.replace(/[^A-Za-z0-9_-]/g, "");
  if (Number(m[1]) !== FORMAT || crc32(body) !== m[3]!.toLowerCase()) return bad();
  let p: Payload;
  try {
    const bytes = fromB64url(body.slice(1));
    const raw = body[0] === "Z" ? await inflate(bytes) : body[0] === "J" ? bytes : null;
    if (!raw) return bad();
    p = JSON.parse(new TextDecoder().decode(raw)) as Payload;
  } catch {
    return bad();
  }
  if (!p || typeof p !== "object" || typeof p.f !== "number") return bad();
  if (p.f > FORMAT)
    return bad(`Bu kod o'yinning yangiroq versiyasidan (v${p.g}). Avval o'yinni yangilang`);
  if (p.f !== FORMAT || typeof p.j !== "object" || typeof p.t !== "object" || !p.j || !p.t)
    return bad();
  const keys: Record<string, string> = {};
  try {
    for (const [k, v] of Object.entries(p.t))
      if (typeof v === "string" && isProgressKey(PREFIX + k)) keys[PREFIX + k] = v;
    for (const [k, v] of Object.entries(p.j)) {
      if (!isProgressKey(PREFIX + k)) continue;
      const val = PREFIX + k === REALM_SAVE_KEY ? mapFog(v, unpackFog) : v;
      keys[PREFIX + k] = JSON.stringify(val);
    }
  } catch {
    return bad();
  }
  const sv = Number(keys[SAVE_VERSION_KEY] ?? 1);
  if (sv > SAVE_VERSION)
    return bad(`Bu kod o'yinning yangiroq versiyasidan (v${p.g}). Avval o'yinni yangilang`);
  return {
    ok: true,
    data: { keys, game: String(p.g ?? ""), summary: summarize((k) => keys[k] ?? null) },
  };
}

// ---------- qo'llash va zaxira ----------

export interface Backup {
  /** Zaxira vaqti (ms) */
  time: number;
  keys: Record<string, string>;
}

export function loadBackup(): Backup | null {
  try {
    const b = JSON.parse(localStorage.getItem(BACKUP_KEY) ?? "null") as Backup | null;
    return b && typeof b.time === "number" && b.keys && typeof b.keys === "object" ? b : null;
  } catch {
    return null;
  }
}

/**
 * Kodni qo'llaydi: hozirgi progress zaxiraga yoziladi, so'ng kod bilan almashtiriladi va
 * eski versiya kodi bo'lsa migratsiyalar ishlaydi. Zaxira yozilmasa hech narsa o'zgarmaydi (false).
 */
export function applyTransfer(data: TransferData) {
  const backup: Backup = { time: Date.now(), keys: collect() };
  try {
    localStorage.setItem(BACKUP_KEY, JSON.stringify(backup));
  } catch {
    return false;
  }
  try {
    replace(data.keys);
  } catch {
    // joy yetmadi — oldingi holat qaytariladi
    try {
      replace(backup.keys);
    } catch {
      /* saqlash imkonsiz */
    }
    return false;
  }
  migrateSave();
  return true;
}

/** Zaxiradagi (kod qo'llanishidan oldingi) progressni tiklaydi; zaxira o'chiriladi. */
export function restoreBackup() {
  const b = loadBackup();
  if (!b) return false;
  try {
    replace(b.keys);
    localStorage.removeItem(BACKUP_KEY);
  } catch {
    return false;
  }
  migrateSave();
  return true;
}
