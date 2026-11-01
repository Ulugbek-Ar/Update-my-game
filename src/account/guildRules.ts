/**
 * Gildiyalar: umumiy qoidalar (klient ham, server ham shu faylni ishlatadi) — nom va teg
 * tekshiruvi, gerb (shakl, 2 rang, belgi), rollar va huquqlar, qo'shilish usullari, darajalar va
 * ularning foydalari. Batafsil: docs/guilds.md
 *
 * Balans: foydalar kichik — +XP % (ko'pi bilan 10 %), kunlik sovg'aga bir necha oltin, gerb uchun
 * yangi belgi va ranglar, a'zolar sig'imi 20 → 30. Oltin narxlari va jang kuchi o'zgarmaydi.
 */
import { isRude } from "./nick";

/** Gildiya tuzish narxi (oltin) */
export const GUILD_COST = 500;
/** Gildiyadan chiqqandan keyin boshqasiga qo'shilish (va yangisini tuzish) uchun kutish */
export const REJOIN_MS = 24 * 3600_000;
/** O'rinbosarlar soni */
export const MAX_OFFICERS = 3;
/** Bitta o'yinchining javob kutilayotgan arizalari va gildiyaning arizalar/takliflari */
export const MAX_APPLICATIONS = 5;
export const MAX_GUILD_REQUESTS = 50;

export const GUILD_NAME_MIN = 3;
export const GUILD_NAME_MAX = 20;
export const GUILD_TAG_MIN = 2;
export const GUILD_TAG_MAX = 4;

// ---------------- rollar ----------------

export const GUILD_ROLES = ["leader", "officer", "member"] as const;
export type GuildRole = (typeof GUILD_ROLES)[number];

export const ROLE_NAME: Record<GuildRole, string> = {
  leader: "RAHBAR",
  officer: "O'RINBOSAR",
  member: "A'ZO",
};

/** Rol "kuchi": rahbar > o'rinbosar > a'zo */
const RANK: Record<GuildRole, number> = { leader: 3, officer: 2, member: 1 };

/** Arizani qabul qilish, taklif yuborish */
export const canManage = (r: GuildRole) => r === "leader" || r === "officer";

/**
 * Chiqarish va chatdan jim qilish: rahbar — hammani (o'zidan tashqari), o'rinbosar — faqat
 * oddiy a'zolarni. A'zo hech kimni chiqara olmaydi.
 */
export function canKick(actor: GuildRole, target: GuildRole) {
  return canManage(actor) && RANK[actor] > RANK[target];
}

/**
 * Rol berish: rahbar a'zoni o'rinbosar qiladi va o'rinbosarni a'zoga tushiradi; o'rinbosar
 * faqat a'zoni o'rinbosar qila oladi (tushira olmaydi). Rahbarlik — faqat topshirish bilan.
 */
export function canSetRole(actor: GuildRole, target: GuildRole, to: GuildRole) {
  if (to === "leader" || target === "leader" || target === to) return false;
  if (actor === "leader") return true;
  return actor === "officer" && target === "member" && to === "officer";
}

/** Chat xabarini o'chirish: o'zinikini — har kim, boshqanikini — rahbar va o'rinbosar (o'zidan pastni) */
export function canDeleteMsg(actor: GuildRole, author: GuildRole | null, own: boolean) {
  if (own) return true;
  if (!canManage(actor)) return false;
  return author === null || RANK[actor] > RANK[author];
}

// ---------------- qo'shilish usuli va til ----------------

export const JOIN_MODES = ["open", "apply", "invite"] as const;
export type JoinMode = (typeof JOIN_MODES)[number];
export const JOIN_MODE_NAME: Record<JoinMode, string> = {
  open: "OCHIQ",
  apply: "ARIZA BILAN",
  invite: "FAQAT TAKLIF",
};
export const JOIN_MODE_TEXT: Record<JoinMode, string> = {
  open: "Har kim darhol qo'shiladi",
  apply: "Ariza yuboriladi, rahbar yoki o'rinbosar tasdiqlaydi",
  invite: "Faqat rahbar yoki o'rinbosar taklif qilgan o'yinchi",
};

export const GUILD_LANGS = ["uz", "ru", "en"] as const;
export type GuildLang = (typeof GUILD_LANGS)[number];
export const LANG_NAME: Record<GuildLang, string> = {
  uz: "O'ZBEKCHA",
  ru: "RUSCHA",
  en: "INGLIZCHA",
};

// ---------------- darajalar ----------------

export const GUILD_MAX_LEVEL = 10;
/** L-darajaga yetish uchun jami gildiya XP (1-daraja — 0) */
export const GUILD_LEVEL_XP: readonly number[] = [
  0, 500, 1500, 3000, 5000, 8000, 12_000, 17_000, 23_000, 30_000,
];

/** Gildiya XP'si bo'yicha daraja (1..10) */
export function guildLevel(xp: number) {
  const x = Math.max(0, Math.floor(Number(xp) || 0));
  let l = 1;
  while (l < GUILD_MAX_LEVEL && GUILD_LEVEL_XP[l]! <= x) l++;
  return l;
}

/** Joriy darajadagi yutuq: [yig'ilgan, kerak] (10-darajada — to'liq) */
export function guildLevelProgress(xp: number): [number, number] {
  const l = guildLevel(xp);
  if (l >= GUILD_MAX_LEVEL) return [1, 1];
  const from = GUILD_LEVEL_XP[l - 1]!,
    to = GUILD_LEVEL_XP[l]!;
  return [Math.max(0, xp - from), to - from];
}

/** A'zolar sig'imi: 1–4-daraja — 20, 5–7 — 25, 8–10 — 30 */
export function guildCap(level: number) {
  return level >= 8 ? 30 : level >= 5 ? 25 : 20;
}

/** O'yinchi XP'siga qo'shimcha (%): har 2 darajada +2 % (10-darajada +10 %) */
export function guildXpBonus(level: number) {
  return 2 * Math.floor(Math.min(GUILD_MAX_LEVEL, Math.max(1, level)) / 2);
}

/** Kunlik sovg'aga qo'shimcha oltin: 3-darajadan +3, 6-dan +5, 9-dan +8 */
export function guildGiftBonus(level: number) {
  return level >= 9 ? 8 : level >= 6 ? 5 : level >= 3 ? 3 : 0;
}

// ---------------- gerb ----------------

export const EMBLEM_SHAPES = ["shield", "banner", "circle"] as const;
export type EmblemShape = (typeof EMBLEM_SHAPES)[number];
export const SHAPE_NAME: Record<EmblemShape, string> = {
  shield: "QALQON",
  banner: "BAYROQ",
  circle: "DOIRA",
};

/** Gerb ranglari: level — shu darajada ochiladi */
export const EMBLEM_COLORS: readonly { name: string; hex: string; level: number }[] = [
  { name: "QIZIL", hex: "#c1121f", level: 1 },
  { name: "KO'K", hex: "#2f6fd0", level: 1 },
  { name: "YASHIL", hex: "#3f9a3a", level: 1 },
  { name: "SARIQ", hex: "#ffcc33", level: 1 },
  { name: "BINAFSHA", hex: "#7b3fb8", level: 1 },
  { name: "QORA", hex: "#1f1730", level: 1 },
  { name: "OQ", hex: "#f4efe6", level: 1 },
  { name: "TO'Q SARIQ", hex: "#ff8a2a", level: 1 },
  // 4-daraja
  { name: "PUSHTI", hex: "#ff6fae", level: 4 },
  { name: "FIRUZA", hex: "#2fc8c0", level: 4 },
  { name: "JIGARRANG", hex: "#8a5a34", level: 4 },
  { name: "TO'Q KO'K", hex: "#1c2f6e", level: 4 },
  // 8-daraja: qimmatbaho
  { name: "OLTIN", hex: "#e8b830", level: 8 },
  { name: "KUMUSH", hex: "#c8d0dc", level: 8 },
];

/** Gerb belgilari (rasmi — src/game/emblem.ts); level — shu darajada ochiladi */
export const EMBLEM_ICONS: readonly { id: string; name: string; level: number }[] = [
  { id: "sword", name: "QILICH", level: 1 },
  { id: "crown", name: "TOJ", level: 1 },
  { id: "dragon", name: "AJDAR", level: 1 },
  { id: "star", name: "YULDUZ", level: 1 },
  { id: "skull", name: "BOSH SUYAGI", level: 1 },
  { id: "sun", name: "QUYOSH", level: 1 },
  { id: "moon", name: "OY", level: 2 },
  { id: "flame", name: "OLOV", level: 3 },
  { id: "bolt", name: "CHAQMOQ", level: 5 },
  { id: "castle", name: "QAL'A", level: 6 },
  { id: "wings", name: "QANOT", level: 7 },
  { id: "wolf", name: "BO'RI", level: 9 },
  { id: "phoenix", name: "QAQNUS", level: 10 },
];

export interface Emblem {
  shape: number;
  /** fon rangi (EMBLEM_COLORS raqami) */
  bg: number;
  /** belgi rangi */
  fg: number;
  icon: number;
}

/** Saqlash va tarmoq uchun qisqa yozuv: "shakl-fon-belgi rangi-belgi", masalan "0-1-3-0" */
export const encodeEmblem = (e: Emblem) => `${e.shape}-${e.bg}-${e.fg}-${e.icon}`;

export const DEFAULT_EMBLEM = "0-1-3-0";

export function parseEmblem(s: string | null | undefined): Emblem | null {
  const m = /^(\d{1,2})-(\d{1,2})-(\d{1,2})-(\d{1,2})$/.exec(s ?? "");
  if (!m) return null;
  const [shape, bg, fg, icon] = [m[1], m[2], m[3], m[4]].map(Number) as [
    number,
    number,
    number,
    number,
  ];
  if (shape >= EMBLEM_SHAPES.length || bg >= EMBLEM_COLORS.length) return null;
  if (fg >= EMBLEM_COLORS.length || icon >= EMBLEM_ICONS.length) return null;
  return { shape, bg, fg, icon };
}

/** Gerb shu darajadagi gildiyaga ruxsatmi: ranglar va belgi ochilgan, ikki rang har xil */
export function emblemAllowed(e: Emblem, level: number) {
  return (
    e.bg !== e.fg &&
    EMBLEM_COLORS[e.bg]!.level <= level &&
    EMBLEM_COLORS[e.fg]!.level <= level &&
    EMBLEM_ICONS[e.icon]!.level <= level
  );
}

/** Daraja foydalari (gildiya oynasi): har darajada nima ochiladi */
export function levelPerks(level: number): string[] {
  const out: string[] = [];
  if (level === 1) out.push("20 a'zo", "6 ta gerb belgisi va 8 rang");
  const xp = guildXpBonus(level);
  if (xp > guildXpBonus(level - 1)) out.push(`+${xp}% XP`);
  const gift = guildGiftBonus(level);
  if (gift > guildGiftBonus(level - 1)) out.push(`Kunlik sovg'aga +${gift} oltin`);
  if (guildCap(level) > guildCap(level - 1)) out.push(`${guildCap(level)} a'zo`);
  for (const i of EMBLEM_ICONS) if (level > 1 && i.level === level) out.push(`Belgi: ${i.name}`);
  const colors = EMBLEM_COLORS.filter((c) => level > 1 && c.level === level);
  if (colors.length) out.push(`Ranglar: ${colors.map((c) => c.name.toLowerCase()).join(", ")}`);
  return out;
}

// ---------------- nom va teg ----------------

export type GuildNameError = "length" | "chars" | "script" | "letter" | "bad" | "reserved";

export const GUILD_NAME_ERROR: Record<GuildNameError, string> = {
  length: `Nom ${GUILD_NAME_MIN}–${GUILD_NAME_MAX} belgidan iborat bo'lsin`,
  chars: "Faqat harf, raqam, bo'shliq, apostrof (') va chiziqcha",
  script: "Lotin va kirill harflarini aralashtirmang",
  letter: "Nomda kamida bitta harf bo'lsin",
  bad: "Bu nom odobsiz — boshqasini tanlang",
  reserved: "Bu nom band (xizmat nomi) — boshqasini tanlang",
};

export const GUILD_TAG_ERROR: Record<GuildNameError, string> = {
  length: `Teg ${GUILD_TAG_MIN}–${GUILD_TAG_MAX} belgi (masalan, PQ)`,
  chars: "Tegda faqat harf va raqam",
  script: "Lotin va kirill harflarini aralashtirmang",
  letter: "Tegda kamida bitta harf bo'lsin",
  bad: "Bu teg odobsiz — boshqasini tanlang",
  reserved: "Bu teg band (xizmat nomi) — boshqasini tanlang",
};

const LATIN = /[A-Za-z]/;
const CYRILLIC = /[Ѐ-ӿ]/;
/** Apostrof turlari (o'zbekcha o' va g' uchun) bitta ko'rinishga */
const APOS = /[ʻʼ‘’`´]/g;
const NAME_CHARS = /^[A-Za-zЀ-ӿ0-9 '-]+$/u;
const TAG_CHARS = /^[A-ZЀ-ӿ0-9]+$/u;
const RESERVED_WORDS = [
  "admin",
  "moderator",
  "pikselqala",
  "telegram",
  "support",
  "official",
  "rasmiy",
];

/** Nomni tozalash: chetdagi va qo'sh bo'shliqlar, apostroflar bir xil */
export const tidyGuildName = (raw: string) => raw.replace(APOS, "'").replace(/\s+/g, " ").trim();

export type GuildNameCheck = { ok: true; name: string } | { ok: false; error: GuildNameError };

function scripts(s: string): GuildNameError | null {
  const latin = LATIN.test(s);
  const cyr = CYRILLIC.test(s);
  if (latin && cyr) return "script";
  if (!latin && !cyr) return "letter";
  return null;
}

const reserved = (s: string) => {
  const low = s.toLowerCase().replace(/[\s'-]/g, "");
  return RESERVED_WORDS.some((w) => low.includes(w));
};

/** Gildiya nomi: 3–20 belgi, harf/raqam/bo'shliq/apostrof/chiziqcha, haqoratli so'zlar filtri */
export function checkGuildName(raw: string): GuildNameCheck {
  const name = tidyGuildName(raw);
  const len = [...name].length;
  if (len < GUILD_NAME_MIN || len > GUILD_NAME_MAX) return { ok: false, error: "length" };
  if (!NAME_CHARS.test(name)) return { ok: false, error: "chars" };
  const s = scripts(name);
  if (s) return { ok: false, error: s };
  if (reserved(name)) return { ok: false, error: "reserved" };
  if (isRude(name)) return { ok: false, error: "bad" };
  return { ok: true, name };
}

/** Teg: 2–4 harf/raqam (katta harfga o'giriladi), haqoratli so'zlar filtri */
export function checkGuildTag(raw: string): GuildNameCheck {
  const tag = raw.replace(/[\s[\]]/g, "").toUpperCase();
  const len = [...tag].length;
  if (len < GUILD_TAG_MIN || len > GUILD_TAG_MAX) return { ok: false, error: "length" };
  if (!TAG_CHARS.test(tag)) return { ok: false, error: "chars" };
  const s = scripts(tag);
  if (s) return { ok: false, error: s };
  if (["ADM", "MOD", "BOT", "SYS"].includes(tag) || reserved(tag))
    return { ok: false, error: "reserved" };
  if (isRude(tag)) return { ok: false, error: "bad" };
  return { ok: true, name: tag };
}

/** Takrorlanmaslik kalitlari: katta-kichik harf, apostrof va bo'shliq farqsiz */
export const guildNameKey = (name: string) =>
  tidyGuildName(name).toLowerCase().replace(/'/g, "").replace(/\s+/g, " ");
export const guildTagKey = (tag: string) => tag.trim().toUpperCase();

/** Teg ko'rinishi: "[PQ]" */
export const tagText = (tag: string) => `[${tag}]`;

// ---------------- xazina ----------------

/** Xazinaga bitta hissa kamida shuncha, bir o'yinchi kuniga (Toshkent kuni) ko'pi bilan shuncha */
export const GIVE_MIN = 5;
export const GIVE_DAILY = 100;
/** 1 oltin hissa = shuncha gildiya XP */
export const GUILD_XP_PER_GOLD = 1;

// ---------------- haftalik topshiriqlar ----------------

export const QUEST_KINDS = [
  "kills",
  "bosses",
  "waves",
  "runs",
  "secrets",
  "ashking",
  "gold",
  "xp",
] as const;
export type QuestKind = (typeof QUEST_KINDS)[number];

export interface QuestDef {
  /** gildiya kattaligiga qarab maqsad: kichik (1–5 a'zo), o'rta (6–14), katta (15+) */
  targets: readonly [number, number, number];
  /** bajarilganda har a'zoga oltin va gildiyaga XP */
  gold: number;
  gxp: number;
  /** "5000 dushman yenging" */
  text: (n: number) => string;
  /** hissa birligi ("dushman", "boss"...) */
  unit: string;
}

export const QUEST_DEFS: Record<QuestKind, QuestDef> = {
  kills: {
    targets: [1500, 3000, 5000],
    gold: 25,
    gxp: 400,
    text: (n) => `${n} ta dushman yenging`,
    unit: "dushman",
  },
  bosses: {
    targets: [10, 25, 50],
    gold: 30,
    gxp: 500,
    text: (n) => `${n} ta boss yenging`,
    unit: "boss",
  },
  waves: {
    targets: [150, 300, 600],
    gold: 20,
    gxp: 300,
    text: (n) => `${n} ta to'lqinni tozalang`,
    unit: "to'lqin",
  },
  runs: {
    targets: [20, 50, 100],
    gold: 20,
    gxp: 300,
    text: (n) => `${n} ta o'yinni oxiriga yetkazing`,
    unit: "o'yin",
  },
  secrets: {
    targets: [5, 10, 20],
    gold: 35,
    gxp: 500,
    text: (n) => `Abadiyat olamida ${n} ta sir toping`,
    unit: "sir",
  },
  ashking: {
    targets: [2, 5, 10],
    gold: 50,
    gxp: 800,
    text: (n) => `Kul qirolini ${n} marta yenging`,
    unit: "g'alaba",
  },
  gold: {
    targets: [500, 1200, 2500],
    gold: 20,
    gxp: 300,
    text: (n) => `Xazinaga ${n} oltin to'plang`,
    unit: "oltin",
  },
  xp: {
    targets: [3000, 8000, 15000],
    gold: 25,
    gxp: 400,
    text: (n) => `Birgalikda ${n} XP to'plang`,
    unit: "XP",
  },
};

/** Haftalik 3 topshiriq: oddiy, o'rta va maxsus guruhdan bittadan */
const QUEST_GROUPS: readonly (readonly QuestKind[])[] = [
  ["kills", "xp", "waves", "runs"],
  ["bosses", "gold"],
  ["ashking", "secrets"],
];

/** Maqsad kattaligi: a'zolar soniga qarab */
export const questTier = (members: number) => (members >= 15 ? 2 : members >= 6 ? 1 : 0);

/** Satr xeshi (FNV-1a) — har gildiyaga har hafta o'z topshiriqlari, lekin hamma joyda bir xil */
function hash(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Shu haftaning topshiriqlari (gildiya va hafta bo'yicha aniq) */
export function weeklyQuests(guild: number, week: string): QuestKind[] {
  return QUEST_GROUPS.map((g, i) => g[hash(`${guild}:${week}:${i}`) % g.length]!);
}

// ---------------- chat ----------------

/** Erkin matn uzunligi, serverda saqlanadigan xabarlar va yuborish oralig'i */
export const CHAT_MAX = 120;
export const CHAT_KEEP = 100;
export const CHAT_GAP_MS = 2000;
/** Jim qilish muddatlari (daqiqa) */
export const MUTE_MINUTES = [10, 60, 24 * 60] as const;

/** Gildiya chatidagi tayyor iboralar */
export const GUILD_PHRASES = [
  "Salom, gildiya!",
  "Olamga kiraman, kim bor?",
  "Kul qirolini birga yengamizmi?",
  "Zalda yig'ilamiz!",
  "Xazinaga hissa qo'shdim!",
  "Topshiriqni bajaramiz!",
  "Yordam kerak!",
  "Rahmat!",
  "Zo'r ish, gildiya!",
  "Xayr!",
] as const;

/**
 * Chat matni: boshqaruv belgilari va ortiqcha bo'shliqlar olib tashlanadi, havolalar yashiriladi,
 * haqoratli so'zlar yulduzcha bilan almashtiriladi.
 */
export function cleanChat(raw: string) {
  const text = raw
    // boshqaruv va ko'rinmas belgilar (yozuvni buzuvchi) — bo'shliqqa
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069]/g, " ")
    .replace(/(https?:\/\/|www\.)\S+/gi, "[havola]")
    .replace(/\s+/g, " ")
    .trim();
  return [...text]
    .slice(0, CHAT_MAX)
    .join("")
    .split(/(\s+)/)
    .map((w) => (w.trim() && isRude(w) ? "*".repeat([...w].length) : w))
    .join("");
}
