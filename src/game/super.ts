/**
 * SUPER QOBILIYATLAR — umumiy tizim (v3.9 da ochildi; birinchi super — Paladinning ILOHIY HUKMI).
 *
 * Har qahramonning bitta superi bo'lishi mumkin. Super zaryadi (SuperMeter) o'yinchi bergan
 * zarardan (asosiy), kombodan va ozgina — yegan zarbadan to'ladi; to'lganda alohida tugma
 * (L / Q, telefonda shar tugmasi) bilan ishlatiladi va zaryad nolga tushadi.
 *
 * Bu faylda — faqat ma'lumot va sof mantiq (DOM/canvas yo'q, onlayn olam va server ham ishlatadi):
 *  - SuperDef: superning to'liq tavsifi — bosqichlar (tayyorlanish → zarba → oqibat), zarar,
 *    boss chegarasi, jon tiklash, ovozlar va effekt nomi;
 *  - SuperMeter: zaryad hisoblagichi;
 *  - SuperCast: bitta super ijrosining vaqt chizig'i (karta → tayyorlanish → zarba → oqibat);
 *  - planStrikes / bossDamage: zarbalar tartibi va bossga zarar chegarasi.
 * Chizish — superFx.ts (shar, karta) va qahramonning o'z effekt fayli (masalan divineFx.ts).
 *
 * YANGI SUPER QO'SHISH: SUPERS ga yozuv (open: true) + effekt fayli. Shar, tugma, karta, daxlsizlik,
 * sekin vaqt, boss chegarasi va onlayn xabari shu tizimdan o'z-o'zidan ishlaydi.
 * Hamma superlarni o'chirish: SUPERS_ENABLED = false (superFor() null — hech qayerda ko'rinmaydi).
 */
import type { Hero } from "./hero";

/** Umumiy kalit: false bo'lsa superFor() hamma qahramonga null qaytaradi */
export const SUPERS_ENABLED: boolean = true;

/** Super bosqichlari (kartadan keyin): tayyorlanish → zarba → oqibat */
export type SuperStage = "prep" | "strike" | "after";
export const SUPER_STAGES: readonly SuperStage[] = ["prep", "strike", "after"];

/** Super ovozlari — audio.ts dagi `sfx` metodlari nomi (ma'lumotda satr bilan beriladi) */
export type SuperSound =
  | "divineChoir"
  | "sunMark"
  | "sunBeam"
  | "sunBeamBig"
  | "divineEnd"
  | "superCard"
  | "cutsHush"
  | "cutsStorm"
  | "cutsShing"
  | "cutsSplit"
  | "cutsBossCut"
  | "cutsSheathe"
  | "cutsChik"
  | "horizonGather"
  | "horizonPass"
  | "horizonShaang"
  | "horizonSplit"
  | "horizonBossCut"
  | "horizonShing"
  | "horizonRise"
  | "meteorRumble"
  | "meteorLock"
  | "meteorFall"
  | "meteorBoom"
  | "meteorBossHit"
  | "meteorCrush"
  | "meteorSettle"
  | "meteorSmall";

/** Zarba naqshi: nishonlarga navbat bilan tushadigan zarbalar */
export interface SuperStrike {
  /** Har zarba oldidan nishon ustidagi belgi shuncha soniya chaqnaydi */
  mark: number;
  /** Zarbalar orasi (s) — nishon ko'p bo'lsa bosqichga sig'ishi uchun qisqaradi */
  gap: number;
  /** Oxirgi zarbadan keyin bosqich tugashigacha (s) */
  tail: number;
  /** Bosqichning eng qisqa davomiyligi (nishon kam bo'lganda) */
  min: number;
}

/** Superdan keyin dushmanga nima bo'ladi (chizish va onlayn uchun) */
export interface SuperAftermath {
  /** O'lgan mob shuncha soniya yerga yopishib yotadi ("yer tishlaydi"), so'ng changga aylanadi */
  flat: number;
  dust: number;
  /** Boss shuncha soniya tiz cho'kadi (hujum qilmaydi) */
  bossKneel: number;
}

/** Kesim to'lqini tavsifi (SuperDef.path) */
export interface SuperPathDef {
  /** Uchish tezligi (px/s, haqiqiy vaqt — dunyo sekinlashuvi ta'sir qilmaydi) */
  speed: number;
  /** Yarim balandlik: boshida va xona chetida (px) — uchgan sari kattalashadi */
  half0: number;
  half1: number;
  /** KENG TIG' kartasi: balandlik shuncha baravar */
  wide: number;
  /** QO'SH UFQ kartasi: orqaga ketuvchi ikkinchi kesim shuncha soniya keyin otiladi */
  backDelay: number;
}

/** Bitta otilgan kesim to'lqini: boshlanish nuqtasi, yo'nalish (birlik vektor), uzunlik */
export interface SuperPath {
  x: number;
  y: number;
  dx: number;
  dy: number;
  /** Zarba bosqichi boshidan kechikish (s) */
  delay: number;
  speed: number;
  half0: number;
  half1: number;
  /** Xona chetigacha masofa (px) */
  len: number;
}

/**
 * Meteorit zarbasi tavsifi (SuperDef.impact — OSMON TOSHI): bitta nuqtaga tushadi. Markazdagilar
 * (`core`) o'ladi; chetdagilar (`ring`) uloqtiriladi va `stun` soniya toshda qotadi; urilgan joyda
 * krater qoladi — unga kirgan dushmanga oz zarar beradi.
 */
export interface SuperImpactDef {
  /** Zarba bosqichining shu soniyasida meteorit yerga uriladi */
  at: number;
  /** Markaz radiusi (px): oddiy mob o'ladi */
  core: number;
  /** Chet radiusi (px): uloqtiriladi va toshda qotadi */
  ring: number;
  /** Uloqtirish tezligi (px/s; jism tezligi 10/s bilan so'nadi — masofa ≈ knock/10) */
  knock: number;
  /** Toshda qotish (s) */
  stun: number;
  /** Chetdagilarga zarar (o'yinchi zarbasi ulushi) */
  ringPower: number;
  /** Joystik bo'yicha nishon masofasi (px) */
  range: number;
  /** Krater: radius, yashash (s; ABADIY KRATER kartasi bilan — long), zarar oralig'i va zarari */
  crater: { r: number; time: number; long: number; tick: number; dmg: number };
  /** METEOR YOMG'IRI kartasi: n ta kichik meteor oqibat bosqichida (first, gap), radiusi, boss ulushi */
  rain: { n: number; first: number; gap: number; r: number; power: number };
}

/** Kichik meteor (METEOR YOMG'IRI): joyi va oqibat bosqichidagi urilish vaqti */
export interface SuperRainDrop {
  x: number;
  y: number;
  at: number;
  done: boolean;
}

export interface SuperDef {
  id: string;
  hero: Hero;
  /** Ekrandagi nom (katta harf) va qisqa tavsif */
  name: string;
  desc: string;
  color: string;
  /** Zaryad: shuncha birlik yig'ilganda to'ladi (1 birlik = dushmanga berilgan 1 zarar) */
  charge: number;
  /** Super davomiyligi (soniya): bosqichlar yig'indisi, karta kirmaydi */
  time: number;
  /** Qahramonga xos sonlar */
  params: Readonly<Record<string, number>>;
  /** Ochiqmi: false — keyingi versiyalar uchun tayyor ma'lumot, o'yinda ko'rinmaydi */
  open: boolean;
  /** Bosqichlar davomiyligi (s); zarba — eng ko'pi (nishon kam bo'lsa strike.min gacha qisqaradi) */
  stages: Readonly<Record<SuperStage, number>>;
  /** Bosqichlarda dunyo tezligi (1 — oddiy); o'yinchi va super effektlari sekinlashmaydi */
  slow: Readonly<Record<SuperStage, number>>;
  strike: SuperStrike;
  /**
   * Zarar: kill — oddiy mob o'ladi; boss — bitta zarba to'lqinida boss maksimal jonining ulushi;
   * bossCap — BITTA superdan bossga jami zarar chegarasi (ulush) — kartalar ham oshira olmaydi.
   */
  dmg: { kill: boolean; boss: number; bossCap: number };
  /** Oqibatda tiklanadigan jon va (onlayn) ittifoqchilarga yetadigan radius */
  heal: number;
  healRadius: number;
  after: SuperAftermath;
  /**
   * Zarbalar oqibat bosqichining shu soniyasida BIRDAN tushadi (MING KESIM: katana qinga qaytgan
   * "chik" lahzasi). Yo'q bo'lsa — har zarba o'z vaqtida, zarba bosqichida (ILOHIY HUKM).
   */
  release?: number;
  /** Oqibat boshida qahramon xona markazida paydo bo'ladi (bossdan chetroqda) */
  center?: boolean;
  /**
   * Yo'nalishli kesim to'lqini (UFQ KESIMI): zarba hamma dushmanga emas, faqat to'lqin yo'lidagilarga
   * tushadi. To'lqin qahramondan qarash (yoki joystik) yo'nalishida `speed` px/s tezlikda xona
   * chetigacha uchadi; yarim balandligi `half0` dan `half1` gacha o'sadi. Yo'q — hamma nishon.
   */
  path?: SuperPathDef;
  /** Meteorit zarbasi (OSMON TOSHI): bitta nuqta, markaz/chet zonalari va krater. Yo'q — oddiy */
  impact?: SuperImpactDef;
  /**
   * Super shari suyuqligi rangi — faqat ODDIY skinda (skin bo'lsa — skin theme'i). Yo'q — theme'ning
   * accent/accentDark/glow ranglari.
   */
  orb?: { accent: string; accentDark: string; glow: string };
  /**
   * Super kartasi (cut-in): to'liq va qisqartirilgan davomiylik, karta ostidagi qator.
   * anime — anime uslubidagi diagonal kadr (faqat Samuray superida ruxsat).
   */
  card: {
    time: number;
    short: number;
    sub: string;
    anime?: boolean;
    /** Portret kattalashtirish (asl 2; Ritsarning 96 px portreti — 1.5) */
    scale?: number;
  };
  sounds: {
    card: SuperSound;
    prep: SuperSound;
    mark: SuperSound;
    hit: SuperSound;
    bossHit: SuperSound;
    end: SuperSound;
    /** Zarba bosqichi boshida (bosqich davomiyligi bilan): masalan ko'p "shing-shing" */
    strike?: SuperSound;
    /** `release` lahzasida (aniq "chik" va gulbarglar shitirlashi) */
    release?: SuperSound;
  };
  /** Effektlar to'plami nomi (superFx.ts: SUPER_FX) */
  fx: string;
}

/**
 * Zaryad manbalari (hamma superga umumiy): 1 zarar = 1 birlik (asosiy manba), kombo bilan
 * o'ldirish — qo'shimcha, zarba yeganda — ozgina.
 */
export const GAIN_DMG = 1;
/** Kombo x2 dan boshlab har o'ldirishda: (kombo − 1) × shuncha, ko'pi bilan GAIN_COMBO_MAX */
export const GAIN_COMBO = 0.25;
export const GAIN_COMBO_MAX = 1;
/** Zarba yeganda (jon ketganda) */
export const GAIN_HURT = 1;

/**
 * ILOHIY HUKM (Paladin) — o'yindagi birinchi super.
 * Tayyorlanish: Paladin ikki metrlik qilichini ikki qo'llab osmonga ko'taradi, vaqt sekinlashadi,
 * osmondan unga oltin nur ustuni tushadi. Zarba: ekrandagi HAR BIR mobga osmondan alohida quyosh
 * nuri tushadi (yaqindan uzoqqa, tez ritmda). Oqibat: moblar yer tishlaydi va oltin changga
 * aylanadi, Paladin qilichni yerga sanchadi — oltin halqa tarqaladi, ozgina jon tiklanadi.
 *
 * Zaryad 20: 1-dunyo to'lqinlaridagi dushmanlar joni 9, 10, 18, 32 — o'rtacha o'yinda super
 * 1–2 to'lqinda bir marta to'ladi (super.test.ts hamma dunyoni tekshiradi).
 * Bossga: bitta qalin nur — boss maksimal jonining 8% i; kartalar bilan ham jami 10% dan oshmaydi.
 */
const DIVINE_JUDGMENT: SuperDef = {
  id: "divine-judgment",
  hero: "paladin",
  name: "ILOHIY HUKM",
  desc: "Osmondan har bir dushmanga quyosh nuri tushadi",
  color: "#f2c14e",
  charge: 20,
  time: 3.7,
  params: {},
  open: true,
  stages: { prep: 1.2, strike: 1.5, after: 1 },
  slow: { prep: 0.25, strike: 0.08, after: 0.5 },
  strike: { mark: 0.15, gap: 0.13, tail: 0.4, min: 0.75 },
  dmg: { kill: true, boss: 0.08, bossCap: 0.1 },
  heal: 1,
  healRadius: 90,
  after: { flat: 0.55, dust: 0.45, bossKneel: 1 },
  card: { time: 0.6, short: 0.25, sub: "PALADIN SUPERI" },
  sounds: {
    card: "superCard",
    prep: "divineChoir",
    mark: "sunMark",
    hit: "sunBeam",
    bossHit: "sunBeamBig",
    end: "divineEnd",
  },
  fx: "divine",
};

/**
 * MING KESIM (Samuray qiz) — v4.0 da ochildi.
 * Tayyorlanish (0.8 s): Samuray ko'zlarini yumadi, qo'li katana dastasida; dunyo oq-qora bo'ladi,
 * faqat sakura pushti qoladi. Zarba (1.2 s): Samuray ko'zdan yo'qoladi, ekran bo'ylab o'nlab kesik
 * chaqnaydi, gulbarg bo'roni aylanadi, dushmanlar qotib qoladi (har biriga kesik belgisi tushadi).
 * Oqibat (1 s): Samuray xona markazida paydo bo'lib katanani SEKIN qinga qaytaradi — "chik"
 * (`release`) lahzasida hamma dushman birdan ikkiga bo'linib gulbargga aylanadi, ranglar qaytadi.
 *
 * Zaryad 20 (Paladin kabi): zaryad — berilgan zarar, to'lqindagi jami jon qahramonga bog'liq emas,
 * shuning uchun super ham 1–2 to'lqinda bir marta to'ladi. Bossga: maksimal jonining 8% i, jami
 * 10% dan oshmaydi. params: slashes — ekran bo'ylab kesiklar soni (kamaytirilganda — slashesReduced).
 */
const THOUSAND_CUTS: SuperDef = {
  id: "thousand-cuts",
  hero: "samurai",
  name: "MING KESIM",
  desc: "Ekran kesiklarga to'ladi — katana qinga qaytgach hamma dushman ikkiga bo'linadi",
  color: "#ff8fb8",
  charge: 20,
  time: 3,
  params: { slashes: 46, slashesReduced: 10 },
  open: true,
  stages: { prep: 0.8, strike: 1.2, after: 1 },
  // zarbada dushmanlar deyarli to'xtaydi ("qotib qoladi") va "chik" gacha shunday qoladi
  slow: { prep: 0.2, strike: 0.02, after: 0.02 },
  strike: { mark: 0.12, gap: 0.08, tail: 0.25, min: 1.2 },
  dmg: { kill: true, boss: 0.08, bossCap: 0.1 },
  heal: 0,
  healRadius: 0,
  after: { flat: 0.34, dust: 0.6, bossKneel: 0.8 },
  release: 0.45,
  center: true,
  card: { time: 0.7, short: 0.25, sub: "SAMURAY SUPERI", anime: true },
  sounds: {
    card: "superCard",
    prep: "cutsHush",
    mark: "cutsShing",
    hit: "cutsSplit",
    bossHit: "cutsBossCut",
    end: "cutsSheathe",
    strike: "cutsStorm",
    release: "cutsChik",
  },
  fx: "cuts",
};

/**
 * UFQ KESIMI (Ritsar) — v4.0 da ochildi.
 * Tayyorlanish (0.5 s): Ritsar bir tizzasiga cho'kadi, qilichni beliga tortadi, tig' oqarib
 * porlaydi, havo zarrachalari qilichga so'riladi. Zarba (0.8 s): bir urishda qarash (yoki joystik)
 * yo'nalishida ulkan yarim oy KESIM to'lqini otiladi (`path`) — xona chetigacha uchib kattalashadi,
 * yo'lidagi har dushmandan o'tadi (dushman qotadi, ustida oq kesik chizig'i qoladi). Oqibat
 * (0.8 s): `release` lahzasida — "SHING!" — kesilganlar birdan ikkiga bo'linib piksel bo'laklarga
 * sochiladi, Ritsar qilichni silkitib qayta tik turadi.
 *
 * Zaryad 20 (Paladin va Samuray kabi). Bossga: yo'lda bo'lsa — maksimal jonining 8% i, jami 10% dan
 * oshmaydi. Kartalar: QO'SH UFQ (orqaga ikkinchi kesim), KENG TIG' (kesim balandroq).
 */
const HORIZON_CUT: SuperDef = {
  id: "horizon-cut",
  hero: "knight",
  name: "UFQ KESIMI",
  desc: "Ulkan kesim to'lqini yo'lidagi hamma dushmanni ikkiga bo'ladi",
  color: "#9fd8f0",
  charge: 20,
  time: 2.1,
  params: { motes: 44, motesReduced: 8, bits: 18, bitsReduced: 4 },
  open: true,
  stages: { prep: 0.5, strike: 0.8, after: 0.8 },
  // kesilganlar "qotadi": zarbadan "SHING!" gacha dunyo deyarli to'xtaydi
  slow: { prep: 0.25, strike: 0.04, after: 0.04 },
  strike: { mark: 0, gap: 0, tail: 0, min: 0.8 },
  dmg: { kill: true, boss: 0.08, bossCap: 0.1 },
  heal: 0,
  healRadius: 0,
  after: { flat: 0.3, dust: 0.5, bossKneel: 0.8 },
  release: 0.28,
  path: { speed: 520, half0: 18, half1: 48, wide: 1.6, backDelay: 0.14 },
  card: { time: 0.7, short: 0.25, sub: "RITSAR SUPERI", scale: 1.5 },
  sounds: {
    card: "superCard",
    prep: "horizonGather",
    mark: "horizonPass",
    hit: "horizonSplit",
    bossHit: "horizonBossCut",
    end: "horizonRise",
    strike: "horizonShaang",
    release: "horizonShing",
  },
  fx: "horizon",
};

/**
 * OSMON TOSHI (Sehrgar) — v4.0 da ochildi.
 * Tayyorlanish (0.8 s): Sehrgar tayog'ini osmonga ko'taradi, ekran qorayadi, xona tepasida
 * binafsha-olov darz ochiladi; dushmanlar eng zich to'plangan joyda (yoki joystik yo'nalishida)
 * sehrli runali nishon doirasi paydo bo'lib kichrayadi. Zarba (0.7 s): ulkan yonayotgan meteorit
 * olov dumi bilan qiya tushadi (`impact.at` da urilish) — oq chaqnash, zarba to'lqini, krater,
 * tosh bo'laklari. Oqibat (1 s): markazdagilar o'ladi, chetdagilar uloqtirilib 2.5 s toshda qotadi,
 * krater cho'g'lanib turadi.
 *
 * Zaryad 20 (boshqa superlar kabi). Bossga: nishon zonasida bo'lsa — maksimal jonining 8% i, jami
 * 10% dan oshmaydi; boss 1 s qotadi. Kartalar: METEOR YOMG'IRI (3 ta kichik meteor), ABADIY KRATER
 * (cho'g' uzoqroq turadi).
 */
const SKY_STONE: SuperDef = {
  id: "sky-stone",
  hero: "mage",
  name: "OSMON TOSHI",
  desc: "Ulkan meteorit dushmanlar to'dasiga qulaydi",
  color: "#c070ff",
  charge: 20,
  time: 2.5,
  params: { rocks: 34, rocksReduced: 8, embers: 40, embersReduced: 8 },
  open: true,
  stages: { prep: 0.8, strike: 0.7, after: 1 },
  slow: { prep: 0.25, strike: 0.05, after: 0.35 },
  strike: { mark: 0, gap: 0, tail: 0, min: 0.7 },
  dmg: { kill: true, boss: 0.08, bossCap: 0.1 },
  heal: 0,
  healRadius: 0,
  after: { flat: 0.3, dust: 0.5, bossKneel: 1 },
  // super shari: binafsha-qizil sehr suyuqligi
  orb: { accent: "#b0307e", accentDark: "#4e1252", glow: "#ec98ff" },
  impact: {
    at: 0.42,
    core: 34,
    ring: 74,
    knock: 420,
    stun: 2.5,
    ringPower: 1,
    range: 96,
    crater: { r: 26, time: 4, long: 9, tick: 0.5, dmg: 1 },
    rain: { n: 3, first: 0.18, gap: 0.24, r: 16, power: 0.25 },
  },
  card: { time: 0.7, short: 0.25, sub: "SEHRGAR SUPERI", scale: 1.5 },
  sounds: {
    card: "superCard",
    prep: "meteorRumble",
    mark: "meteorLock",
    hit: "meteorCrush",
    bossHit: "meteorBossHit",
    end: "meteorSettle",
    strike: "meteorFall",
    release: "meteorBoom",
  },
  fx: "meteor",
};

/** Hamma superlar (yopiqlari ham — sinov va keyingi versiya ishlanmasi uchun) */
export const SUPERS: Partial<Record<Hero, SuperDef>> = {
  paladin: DIVINE_JUDGMENT,
  samurai: THOUSAND_CUTS,
  knight: HORIZON_CUT,
  mage: SKY_STONE,
};

/** Qahramonning superi; super yo'q yoki hali yopiq bo'lsa — null: hech qayerda ko'rinmaydi. */
export function superFor(hero: Hero): SuperDef | null {
  if (!SUPERS_ENABLED) return null;
  const def = SUPERS[hero];
  return def?.open ? def : null;
}

/** Id bo'yicha ochiq super (onlayn xabarlarini tekshirish uchun) */
export function superById(id: string): SuperDef | null {
  if (!SUPERS_ENABLED) return null;
  return Object.values(SUPERS).find((d) => d.id === id && d.open) ?? null;
}

/** Super zaryadi hisoblagichi. Qahramonda (ochiq) super yo'q — hech qachon to'lmaydi. */
export class SuperMeter {
  /** Yig'ilgan zaryad (0..def.charge) */
  value = 0;
  readonly def: SuperDef | null;
  /** To'lish tezligi ko'paytuvchisi (SUPER tegi bonusi; asl 1) */
  rate = 1;
  /** Shu kadrda to'ldi — Game "TAYYOR!" ovozi va uchqunlarini chiqaradi, so'ng o'chiradi */
  justFilled = false;

  constructor(hero: Hero) {
    this.def = superFor(hero);
  }

  private gain(n: number) {
    const d = this.def;
    if (!d || !(n > 0) || this.value >= d.charge) return;
    this.value = Math.min(d.charge, this.value + n * this.rate);
    if (this.value >= d.charge) this.justFilled = true;
  }

  /** O'yinchi zarar berdi (asosiy manba) */
  add(dmg: number) {
    this.gain(dmg * GAIN_DMG);
  }

  /** Dushman kombo bilan o'ldirildi (combo — shu o'ldirishdan keyingi kombo soni) */
  addCombo(combo: number) {
    if (combo >= 2) this.gain(Math.min(GAIN_COMBO_MAX, (combo - 1) * GAIN_COMBO));
  }

  /** O'yinchi zarba yedi */
  addHurt() {
    this.gain(GAIN_HURT);
  }

  /** To'lish ulushi 0..1 (HUD uchun) */
  get ratio() {
    return this.def ? this.value / this.def.charge : 0;
  }

  get ready() {
    return !!this.def && this.value >= this.def.charge;
  }

  /** Zaryadning `share` ulushini qaytarish (IKKINCHI NAFAS kartasi: superdan keyin 25%) */
  refund(share: number) {
    const d = this.def;
    if (!d || !(share > 0)) return;
    this.value = Math.min(d.charge, this.value + d.charge * share);
    if (this.value >= d.charge) this.justFilled = true;
  }

  /** Superni ishlatish: tayyor bo'lsa zaryadni nollaydi va true qaytaradi */
  use() {
    if (!this.ready) return false;
    this.value = 0;
    this.justFilled = false;
    return true;
  }
}

/** Zarba nishoni: joyi va boss ekani (Enemy/Boss/onlayn mob — hammasi mos keladi) */
export interface StrikeTarget {
  x: number;
  y: number;
}

/** Rejalashtirilgan zarba: belgi `markAt` da chaqnaydi, zarba `hitAt` da tushadi (bosqich vaqti) */
export interface PlannedStrike<T> {
  target: T;
  boss: boolean;
  markAt: number;
  hitAt: number;
  /** Belgi ko'rsatildi / zarba tushdi */
  marked: boolean;
  done: boolean;
}

/**
 * Zarbalar tartibi: moblar yaqindan uzoqqa, tez ritmda ketma-ket; bosslar — eng oxirida (bitta katta
 * zarba). Nishon ko'p bo'lsa oraliq qisqaradi — hammasi bosqichning eng ko'p vaqtiga sig'adi.
 * Qaytaradi: zarbalar va bosqichning haqiqiy davomiyligi.
 */
export function planStrikes<T extends StrikeTarget>(
  def: SuperDef,
  from: { x: number; y: number },
  mobs: readonly T[],
  bosses: readonly T[] = [],
  /** Birinchi belgi vaqti va bosqichning eng ko'p davomiyligi (ikkinchi to'lqinda — kattaroq) */
  start = 0,
  max = def.stages.strike,
): { strikes: PlannedStrike<T>[]; time: number } {
  const s = def.strike;
  const dist = (t: T) => Math.hypot(t.x - from.x, t.y - from.y);
  const order: { target: T; boss: boolean }[] = [
    ...[...mobs].sort((a, b) => dist(a) - dist(b)).map((target) => ({ target, boss: false })),
    ...bosses.map((target) => ({ target, boss: true })),
  ];
  const n = order.length;
  const room = Math.max(0, max - start - s.mark - s.tail);
  const gap = n > 1 ? Math.min(s.gap, room / (n - 1)) : 0;
  const strikes = order.map((o, i) => {
    const at = start + i * gap;
    return { ...o, markAt: at, hitAt: at + s.mark, marked: false, done: false };
  });
  const last = n ? strikes[n - 1]!.hitAt : start;
  return { strikes, time: Math.min(max, Math.max(s.min, last + s.tail)) };
}

/**
 * Bossga zarar: boss maksimal jonining `share` ulushi, lekin shu superda bossga allaqachon berilgan
 * zarar (`dealt`) bilan birga `bossCap` ulushidan oshmaydi. Kartalar va ikkinchi to'lqin ham shu
 * chegara ichida.
 */
export function bossDamage(def: SuperDef, maxHp: number, dealt: number, power = 1) {
  const cap = def.dmg.bossCap * maxHp;
  return Math.max(0, Math.min(def.dmg.boss * power * maxHp, cap - dealt));
}

/**
 * Kesim to'lqinlari (SuperDef.path): qarash yo'nalishida bittasi; `double` (QO'SH UFQ) — orqaga
 * ikkinchisi; `wide` (KENG TIG') — balandroq. Uzunlik — boshlanish nuqtasidan xona chetigacha.
 */
export function superPaths(
  def: SuperDef,
  from: { x: number; y: number },
  aim: { x: number; y: number },
  room: { w: number; h: number },
  opts: { double?: boolean; wide?: boolean } = {},
): SuperPath[] {
  const P = def.path;
  if (!P) return [];
  const m = Math.hypot(aim.x, aim.y);
  const dx = m > 1e-6 ? aim.x / m : 1,
    dy = m > 1e-6 ? aim.y / m : 0;
  const tall = opts.wide ? P.wide : 1;
  const make = (sx: number, sy: number, delay: number): SuperPath => {
    // xona chetigacha (to'g'ri to'rtburchakdan chiqish nuqtasi)
    const tx = sx > 1e-6 ? (room.w - from.x) / sx : sx < -1e-6 ? -from.x / sx : Infinity;
    const ty = sy > 1e-6 ? (room.h - from.y) / sy : sy < -1e-6 ? -from.y / sy : Infinity;
    return {
      x: from.x,
      y: from.y,
      dx: sx,
      dy: sy,
      delay,
      speed: P.speed,
      half0: P.half0 * tall,
      half1: P.half1 * tall,
      len: Math.max(0, Math.min(tx, ty)),
    };
  };
  const out = [make(dx, dy, 0)];
  if (opts.double) out.push(make(-dx, -dy, P.backDelay));
  return out;
}

/** Kesim to'lqinining `along` px masofadagi yarim balandligi (uchgan sari kattalashadi) */
export function pathHalf(p: SuperPath, along: number) {
  const k = p.len > 0 ? Math.max(0, Math.min(1, along / p.len)) : 1;
  return p.half0 + (p.half1 - p.half0) * k;
}

/**
 * To'lqin nishonga qachon yetadi (zarba bosqichi boshidan, s); yo'lida bo'lmasa — null.
 * size — nishon o'lchami (yarmi chetga qo'shiladi: to'lqin tanasiga tegsa yetarli).
 */
export function pathHit(p: SuperPath, t: { x: number; y: number; size?: number }): number | null {
  const rx = t.x - p.x,
    ry = t.y - p.y;
  const r = (t.size ?? 0) / 2;
  const along = rx * p.dx + ry * p.dy;
  const perp = Math.abs(rx * -p.dy + ry * p.dx);
  if (along < -r || along > p.len + r) return null;
  if (perp > pathHalf(p, along) + r) return null;
  return p.delay + Math.max(0, along) / p.speed;
}

/** Bir nechta to'lqindan eng birinchi yetadiganining vaqti (hech biri yetmasa — null) */
export function pathsHit(paths: readonly SuperPath[], t: { x: number; y: number; size?: number }) {
  let best: number | null = null;
  for (const p of paths) {
    const at = pathHit(p, t);
    if (at !== null && (best === null || at < best)) best = at;
  }
  return best;
}

/** Nishon atrofidagi chekka (px): meteorit devorga yopishib tushmasin */
const IMPACT_MARGIN = 26;

const clampRoom = (x: number, y: number, room: { w: number; h: number }) => ({
  x: Math.max(IMPACT_MARGIN, Math.min(room.w - IMPACT_MARGIN, x)),
  y: Math.max(IMPACT_MARGIN, Math.min(room.h - IMPACT_MARGIN, y)),
});

/**
 * Meteorit nuqtasi (SuperDef.impact). Joystik bosilgan bo'lsa (`stick`) — qahramondan o'sha tomonga
 * `range` px. Aks holda — dushmanlar eng zich to'plangan joy: har nishon atrofida markaz zonasidagilar
 * 2, chetdagilar 1 ochko (boss — 3 baravar); teng bo'lsa qahramonga yaqini. Nishon yo'q — qarash
 * tomoniga `range` px.
 */
export function impactPoint(
  def: SuperDef,
  from: { x: number; y: number },
  face: { x: number; y: number },
  targets: readonly { x: number; y: number; boss?: boolean }[],
  room: { w: number; h: number },
  stick?: { x: number; y: number } | null,
) {
  const I = def.impact;
  const range = I?.range ?? 90;
  const toward = (v: { x: number; y: number }) => {
    const m = Math.hypot(v.x, v.y);
    const ux = m > 1e-6 ? v.x / m : 1,
      uy = m > 1e-6 ? v.y / m : 0;
    return clampRoom(from.x + ux * range, from.y + uy * range, room);
  };
  if (stick && Math.hypot(stick.x, stick.y) >= 0.3) return toward(stick);
  if (!I || !targets.length) return toward(face);
  let best: { x: number; y: number } | null = null;
  let bestScore = -1,
    bestDist = Infinity;
  for (const c of targets) {
    let score = 0;
    for (const t of targets) {
      const d = Math.hypot(t.x - c.x, t.y - c.y);
      const w = t.boss ? 3 : 1;
      if (d <= I.core) score += 2 * w;
      else if (d <= I.ring) score += w;
    }
    const dist = Math.hypot(c.x - from.x, c.y - from.y);
    if (score > bestScore || (score === bestScore && dist < bestDist)) {
      best = c;
      bestScore = score;
      bestDist = dist;
    }
  }
  return clampRoom(best!.x, best!.y, room);
}

/** Nishon meteorit zonasida qayerda: markaz (o'ladi), chet (qotadi) yoki tashqarida (null) */
export function impactZone(
  def: SuperDef,
  spot: { x: number; y: number },
  t: { x: number; y: number; size?: number },
): "core" | "ring" | null {
  const I = def.impact;
  if (!I) return null;
  const d = Math.hypot(t.x - spot.x, t.y - spot.y) - (t.size ?? 0) / 2;
  return d <= I.core ? "core" : d <= I.ring ? "ring" : null;
}

/**
 * METEOR YOMG'IRI nuqtalari: avval asosiy zarbadan omon qolgan (chetdagi) eng yaqin nishonlar,
 * yetmasa — chet zonasi bo'ylab teng burchaklarda. Vaqtlari oqibat bosqichi ichida.
 */
export function rainDrops(
  def: SuperDef,
  spot: { x: number; y: number },
  survivors: readonly { x: number; y: number }[],
  room: { w: number; h: number },
): SuperRainDrop[] {
  const I = def.impact;
  if (!I) return [];
  const R = I.rain;
  const near = [...survivors]
    .sort((a, b) => Math.hypot(a.x - spot.x, a.y - spot.y) - Math.hypot(b.x - spot.x, b.y - spot.y))
    .slice(0, R.n);
  const out: SuperRainDrop[] = [];
  for (let i = 0; i < R.n; i++) {
    const t = near[i];
    const a = -Math.PI / 2 + (i * Math.PI * 2) / R.n + 0.4;
    const p = t
      ? clampRoom(t.x, t.y, room)
      : clampRoom(spot.x + Math.cos(a) * I.ring * 0.7, spot.y + Math.sin(a) * I.ring * 0.7, room);
    out.push({ ...p, at: R.first + i * R.gap, done: false });
  }
  return out;
}

export type CastStage = "card" | SuperStage;

/**
 * Bitta super ijrosining vaqt chizig'i. Faqat vaqt va bosqichlar — zarar va effektlarni egasi
 * (Game yoki onlayn RealmSim) bosqich almashganda o'zi bajaradi:
 *
 *   const ev = cast.update(dt);   // ev: shu qadamda boshlangan bosqichlar va tugaganligi
 *
 * Karta paytida o'yin vaqti to'xtaydi (worldSpeed = 0), keyin bosqichga qarab sekin.
 */
export class SuperCast {
  stage: CastStage = "card";
  /** Joriy bosqichda o'tgan vaqt (haqiqiy soniya) */
  t = 0;
  /** Super boshlanganidan beri (kartasiz) o'tgan vaqt */
  age = 0;
  done = false;
  /** Zarba bosqichining haqiqiy davomiyligi (planStrikes dan) */
  strikeTime: number;
  /** Shu superda har bossga berilgan zarar (chegara uchun) */
  bossDealt = new Map<object, number>();
  /** Shu superda o'ldirilgan dushmanlar ("Bitta super bilan 10 ta dushman") */
  kills = 0;
  /** Zarba to'lqini raqami (IKKINCHI HUKM kartasi bilan 2 ta) */
  wave = 0;
  /** `release` lahzasi o'tdi (MING KESIM: zarbalar birdan tushdi) */
  released = false;
  /** Super yo'nalishi (birlik vektor): qarash yoki joystik — UFQ KESIMI to'lqini shu tomonga */
  aim = { x: 1, y: 0 };
  /** Otilgan kesim to'lqinlari (SuperDef.path; zarba bosqichida egasi to'ldiradi) */
  paths: SuperPath[] = [];
  /** Meteorit nuqtasi (SuperDef.impact; egasi super boshida tanlaydi) */
  spot: { x: number; y: number } | null = null;
  /** Meteorit urildi (zarba bosqichida `impact.at` lahzasi) */
  landed = false;
  /** METEOR YOMG'IRI: kichik meteorlar (urilishda egasi to'ldiradi) */
  rain: SuperRainDrop[] = [];
  /** Krater yashash vaqti (s; ABADIY KRATER kartasi bilan uzunroq) */
  craterTime = 0;

  constructor(
    readonly def: SuperDef,
    /** Karta davomiyligi (0 — kartasiz: onlayn kuzatuvchi yoki sinov) */
    readonly cardTime: number = def.card.time,
  ) {
    this.strikeTime = def.stages.strike;
    if (cardTime <= 0) this.stage = "prep";
  }

  /** Joriy bosqich davomiyligi */
  get stageTime() {
    return this.stage === "card"
      ? this.cardTime
      : this.stage === "strike"
        ? this.strikeTime
        : this.def.stages[this.stage];
  }

  /** Bosqichdagi ulush 0..1 */
  get k() {
    const d = this.stageTime;
    return d > 0 ? Math.min(1, this.t / d) : 1;
  }

  /** Dunyo tezligi: kartada 0, tayyorlanish/zarbada sekin, oqibatda asta oddiy tezlikka qaytadi */
  get worldSpeed() {
    if (this.done) return 1;
    if (this.stage === "card") return 0;
    const s = this.def.slow[this.stage];
    return this.stage === "after" ? s + (1 - s) * this.k * this.k : s;
  }

  /**
   * Vaqtni suradi. Qaytaradi: shu qadamda boshlangan bosqichlar (tartib bilan) va tugadimi.
   * Bitta qadamda bir nechta bosqich almashishi mumkin (katta dt).
   */
  update(dt: number): { entered: SuperStage[]; done: boolean } {
    const entered: SuperStage[] = [];
    if (this.done) return { entered, done: true };
    this.t += dt;
    if (this.stage !== "card") this.age += dt;
    for (let guard = 0; guard < 4 && !this.done; guard++) {
      const d = this.stageTime;
      if (this.t < d) break;
      const over = this.t - d;
      if (this.stage === "card") {
        // karta tugadi: ortiqcha vaqt superga o'tmaydi (o'yin vaqti to'xtab turgan edi)
        this.stage = "prep";
        this.t = 0;
        entered.push("prep");
        break;
      }
      if (this.stage === "after") {
        this.done = true;
        break;
      }
      this.stage = this.stage === "prep" ? "strike" : "after";
      this.t = over;
      entered.push(this.stage);
    }
    return { entered, done: this.done };
  }
}
