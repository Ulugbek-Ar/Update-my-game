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
import { t } from "@/i18n";
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
  | "meteorSmall"
  | "volleyDraw"
  | "volleyMark"
  | "volleyLoose"
  | "volleyHit"
  | "volleyBossHit"
  | "volleyEnd"
  | "frenzySpin"
  | "frenzyGo"
  | "frenzyClick"
  | "frenzyHolster"
  | "stormVanish"
  | "stormWind"
  | "stormBlink"
  | "stormSlash"
  | "stormBossCut"
  | "stormSheathe"
  | "lotusRise"
  | "lotusBloom"
  | "lotusMark"
  | "lotusRay"
  | "lotusBossRay"
  | "lotusEnd"
  | "wolfHowl"
  | "wolfPack"
  | "wolfMark"
  | "wolfBite"
  | "wolfBossBite"
  | "wolfMist";

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

/**
 * Kuzatuvchi o'qlar yog'ini (SuperDef.volley — O'N O'Q OVI): o'qlar osmonga yelpig'ich bo'lib otiladi,
 * egri yoy bilan burilib har biri o'z nishonini topadi (nishon o'lsa — eng yaqin tirik nishonga
 * buriladi), tekkanda kichik portlash.
 */
export interface SuperVolleyDef {
  /** O'qlar soni; O'N BESH O'Q kartasi bilan — more */
  n: number;
  more: number;
  /** Uchish tezligi (px/s, haqiqiy vaqt) */
  speed: number;
  /** Burilish tezligi (rad/s) — uchgan sari kuchayadi, o'q albatta yetib boradi */
  turn: number;
  /** Yelpig'ichning yarim burchagi (rad): o'qlar osmonga shu oraliqda otiladi */
  spread: number;
  /** O'qlar orasidagi kechikish (s) */
  gap: number;
  /** Tegish masofasi (px) */
  hit: number;
  /** Bitta o'qning bossga kuchi (dmg.boss ulushi) — jami baribir bossCap dan oshmaydi */
  bossPower: number;
  /** Portlash radiusi (px, ko'rinish); ZANJIRLI PORTLASH kartasi: shu radiusdagi boshqalarga zarar */
  blast: number;
  chain: { r: number; power: number; bossPower: number };
}

/** Uchayotgan super o'qi (SuperCast.arrows) */
export interface SuperArrow {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Nishon (egasining obyekti) va uning oxirgi ma'lum joyi */
  target: object | null;
  tx: number;
  ty: number;
  /** Zarba bosqichi boshidan kechikish (s) va uchish vaqti */
  delay: number;
  age: number;
  /** Shu vaqtdan keyin o'q albatta tegadi (s) */
  life: number;
  done: boolean;
}

/**
 * O'qlash shart bo'lmagan tez otish (SuperDef.frenzy — CHEKSIZ O'Q): zarba bosqichida o'yinchi
 * boshqaruvni qaytarib oladi, baraban tugamaydi, qayta o'qlash yo'q, otish tezlashadi.
 */
export interface SuperFrenzyDef {
  /** Davomiyligi (s); UZUN DASHT kartasi bilan — long */
  time: number;
  long: number;
  /** Otish oralig'i ko'paytuvchisi (attackCd × shu) */
  rate: number;
  /** QIZIGAN PO'LAT kartasi: o'q zarari ko'paytuvchisi va qo'shimcha teshib o'tish */
  hot: { dmg: number; pierce: number };
  /** Bitta o'qning bossga zarari (dmg.boss ulushi) — jami bossCap dan oshmaydi */
  bossPower: number;
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
  /**
   * Onlaynda healRadius ichidagi ittifoqchilarga: nearR dan yaqinlarga `near`, qolganlariga `far`
   * yurak (OLTIN LOTOS). Yo'q — ittifoqchilar tiklanmaydi.
   */
  allyHeal?: { near: number; far: number; nearR: number };
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
  /** Kuzatuvchi o'qlar (O'N O'Q OVI). Yo'q — oddiy */
  volley?: SuperVolleyDef;
  /** Cheksiz tez otish (CHEKSIZ O'Q): zarba bosqichida o'yinchi erkin. Yo'q — oddiy */
  frenzy?: SuperFrenzyDef;
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
  get name() {
    return t("super.paladin.name");
  },
  get desc() {
    return t("super.paladin.desc");
  },
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
  card: { time: 0.6, short: 0.25, sub: "PALADIN SUPERI", scale: 1.5 },
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
  get name() {
    return t("super.samurai.name");
  },
  get desc() {
    return t("super.samurai.desc");
  },
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
  get name() {
    return t("super.knight.name");
  },
  get desc() {
    return t("super.knight.desc");
  },
  color: "#9fd8f0",
  charge: 20,
  time: 2.1,
  params: { motes: 44, motesReduced: 8, bits: 18, bitsReduced: 4 },
  open: true,
  stages: { prep: 0.5, strike: 0.8, after: 0.8 },
  // kesilganlar "qotadi": zarbadan "SHING!" gacha dunyo deyarli to'xtaydi
  slow: { prep: 0.25, strike: 0.04, after: 0.04 },
  strike: { mark: 0, gap: 0, tail: 0, min: 0.8 },
  dmg: { kill: true, boss: 0.1, bossCap: 0.1 },
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
  get name() {
    return t("super.mage.name");
  },
  get desc() {
    return t("super.mage.desc");
  },
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

/**
 * O'N O'Q OVI (Ovchi) — v3.14 da ochildi.
 * Tayyorlanish (0.8 s): Ovchi kamonni osmonga tortadi, vaqt sekinlashadi, har nishon ustida yashil
 * nishon belgisi paydo bo'ladi. Zarba (1.4 s): 10 ta o'q osmonga yelpig'ich bo'lib uchadi, egri yoy bilan
 * burilib har biri o'z nishonini topadi (nishon o'lsa — eng yaqin tirik dushmanga buriladi), tekkanda
 * kichik portlash. Oqibat (0.6 s): Ovchi kamonni tushiradi.
 *
 * Zaryad 20. Bossga: har o'q maksimal jonining 8% × 0.25 = 2% i, jami 10% dan oshmaydi.
 * Kartalar: O'N BESH O'Q (15 o'q), ZANJIRLI PORTLASH (portlash atrofidagilarga ham zarar).
 */
const TEN_ARROWS: SuperDef = {
  id: "ten-arrows",
  hero: "hunter",
  get name() {
    return t("super.hunter.name");
  },
  get desc() {
    return t("super.hunter.desc");
  },
  color: "#8fd14f",
  charge: 20,
  time: 2.8,
  params: { sparks: 10, sparksReduced: 3 },
  open: true,
  stages: { prep: 0.8, strike: 1.4, after: 0.6 },
  slow: { prep: 0.25, strike: 0.12, after: 0.5 },
  strike: { mark: 0, gap: 0, tail: 0, min: 1.4 },
  dmg: { kill: true, boss: 0.08, bossCap: 0.1 },
  heal: 0,
  healRadius: 0,
  after: { flat: 0.3, dust: 0.4, bossKneel: 0.6 },
  // super shari: o'rmon yashili
  orb: { accent: "#3f8a2a", accentDark: "#163a12", glow: "#b8f070" },
  volley: {
    n: 10,
    more: 15,
    speed: 300,
    turn: 4,
    spread: 0.9,
    gap: 0.045,
    hit: 7,
    bossPower: 0.25,
    blast: 14,
    chain: { r: 26, power: 1.5, bossPower: 0.1 },
  },
  card: { time: 0.7, short: 0.25, sub: "OVCHI SUPERI", scale: 1.5 },
  sounds: {
    card: "superCard",
    prep: "volleyDraw",
    mark: "volleyMark",
    hit: "volleyHit",
    bossHit: "volleyBossHit",
    end: "volleyEnd",
    strike: "volleyLoose",
  },
  fx: "arrows",
};

/**
 * CHEKSIZ O'Q (Mergan) — v3.14 da ochildi.
 * Tayyorlanish (0.5 s): Mergan to'pponchani tepaga ko'tarib barabanni aylantiradi, boshi ustida ∞
 * belgisi chaqnaydi (daxlsiz, joyida). Zarba (3.5 s; UZUN DASHT kartasi bilan 5 s): boshqaruv
 * qaytadi — baraban tugamaydi, qayta o'qlash yo'q (GUN_AMMO / RELOAD_TIME o'chadi), otish ~3 baravar
 * tez; quroli qizib boradi, har o'qdan gilza yerga sakraydi. Oqibat (0.5 s): gilzalar "puf" bo'lib
 * tutunga aylanadi, Mergan to'pponchani g'ilofga soladi — baraban to'la.
 *
 * Zaryad 20. Bossga: tez otishning QO'SHIMCHA zarari bitta superda boss maksimal jonining 10% idan
 * oshmaydi (oddiy tezlikdagi ulush — har o'qning `rate` qismi — odatdagidek). Kartalar: QIZIGAN
 * PO'LAT (o'qlar 1.5x va 2 dushmandan teshib o'tadi), UZUN DASHT (5 s).
 */
const ENDLESS_LEAD: SuperDef = {
  id: "endless-lead",
  hero: "gunner",
  get name() {
    return t("super.gunner.name");
  },
  get desc() {
    return t("super.gunner.desc");
  },
  color: "#ff9a3c",
  charge: 20,
  time: 4.5,
  params: { shells: 28, shellsReduced: 6 },
  open: true,
  stages: { prep: 0.5, strike: 3.5, after: 0.5 },
  // faqat tayyorlanishda dunyo sekin; tez otish paytida o'yin odatdagi tezlikda
  slow: { prep: 0.25, strike: 1, after: 1 },
  strike: { mark: 0, gap: 0, tail: 0, min: 3.5 },
  dmg: { kill: false, boss: 0.08, bossCap: 0.1 },
  heal: 0,
  healRadius: 0,
  after: { flat: 0, dust: 0, bossKneel: 0 },
  // super shari: qizigan mis — to'q sariq
  orb: { accent: "#c8641a", accentDark: "#4a2a08", glow: "#ffbe6a" },
  frenzy: { time: 3.5, long: 5, rate: 0.35, hot: { dmg: 1.5, pierce: 2 }, bossPower: 1 },
  card: { time: 0.7, short: 0.25, sub: "MERGAN SUPERI", scale: 1.5 },
  sounds: {
    card: "superCard",
    prep: "frenzySpin",
    mark: "frenzyClick",
    hit: "frenzyClick",
    bossHit: "frenzyClick",
    end: "frenzyHolster",
    strike: "frenzyGo",
  },
  fx: "frenzy",
};

/**
 * Tez otishda bossga o'q zarari: oddiy tezlikdagi ulush (dmg × rate) har doim, qo'shimcha qism
 * (dmg × (1 − rate)) — shu superda bossga berilgan qo'shimcha zarar (`extra`) bilan birga bossCap
 * ulushidan oshmaydi. Qaytaradi: jami zarar va uning qo'shimcha qismi.
 */
export function frenzyBossDamage(def: SuperDef, maxHp: number, extra: number, dmg: number) {
  const rate = def.frenzy?.rate ?? 1;
  const base = dmg * rate;
  const add = Math.max(0, Math.min(dmg - base, def.dmg.bossCap * maxHp - extra));
  return { dmg: base + add, extra: add };
}

/** Tez otish davomiyligi (UZUN DASHT kartasi bilan — uzunroq) */
export function frenzyTime(def: SuperDef, long = false) {
  const F = def.frenzy;
  return F ? (long ? F.long : F.time) : def.stages.strike;
}

/**
 * SOYA BO'RONI (Ninja).
 * Tayyorlanish (0.7 s): Ninja qo'l belgisini qiladi, dunyo qora-qirmiziga botadi, Ninja tutunga
 * aylanib yo'qoladi. Zarba (≤1.4 s): ekrandagi HAR dushman yonida bir lahzaga soya-nusxa paydo
 * bo'lib uni kesadi (qizil kesik chiziqlari) — dushmanlar deyarli qotgan. Oqibat (0.8 s): Ninja xona
 * markazida tutundan chiqib ikki qilichini qinga qaytaradi.
 *
 * Zaryad 20 (boshqa superlar kabi). Bossga: maksimal jonining 8% i, jami 10% dan oshmaydi (kartalar
 * ham oshirmaydi). Kartalar: TUTUN PARDASI (superdan keyin 2 s ko'rinmaslik), SOYA IZI (shuriken va
 * tutun darhol tayyor).
 */
const SHADOW_STORM: SuperDef = {
  id: "shadow-storm",
  hero: "shinobi",
  get name() {
    return t("super.shinobi.name");
  },
  get desc() {
    return t("super.shinobi.desc");
  },
  color: "#ff6f91",
  charge: 20,
  time: 2.9,
  params: {},
  open: true,
  stages: { prep: 0.7, strike: 1.4, after: 0.8 },
  slow: { prep: 0.2, strike: 0.05, after: 0.3 },
  strike: { mark: 0.14, gap: 0.1, tail: 0.3, min: 0.9 },
  dmg: { kill: true, boss: 0.08, bossCap: 0.1 },
  heal: 0,
  healRadius: 0,
  after: { flat: 0.3, dust: 0.5, bossKneel: 0.8 },
  center: true,
  card: { time: 0.7, short: 0.25, sub: "NINJA SUPERI", scale: 1.5 },
  sounds: {
    card: "superCard",
    prep: "stormVanish",
    mark: "stormBlink",
    hit: "stormSlash",
    bossHit: "stormBossCut",
    end: "stormSheathe",
    strike: "stormWind",
  },
  fx: "storm",
};

/**
 * OLTIN LOTOS (Rohiba).
 * Tayyorlanish (1 s): Rohiba ko'zlarini yumib kaftlarini birlashtiradi va havoga ko'tariladi, ostida
 * ulkan oltin lotos guli ochiladi. Zarba (≤1.5 s): gulbarglardan ekrandagi HAR dushmanga oltin nur
 * uriladi (Paladinning osmondan tushuvchi nur ustunlaridan farqli — nurlar lotosdan tarqaladi).
 * Oqibat (0.9 s): lotos yopilib so'nadi, Rohiba yerga tushadi va 3 yurak tiklaydi (onlaynda yaqin
 * ittifoqchilar 2, uzoqroqdagilar 1 yurak).
 *
 * Zaryad 20. Bossga: maksimal jonining 8% i, jami 10% dan oshmaydi (kartalar ham oshirmaydi).
 * Kartalar: LOTOS BARAKASI (+1 yurak), NUR OQIMI (Nur kafti va muqaddas qadam darhol tayyor).
 */
const GOLDEN_LOTUS: SuperDef = {
  id: "golden-lotus",
  hero: "priestess",
  get name() {
    return t("super.priestess.name");
  },
  get desc() {
    return t("super.priestess.desc");
  },
  color: "#ffd77a",
  charge: 20,
  time: 3.4,
  params: {},
  open: true,
  stages: { prep: 1, strike: 1.5, after: 0.9 },
  slow: { prep: 0.2, strike: 0.06, after: 0.4 },
  strike: { mark: 0.16, gap: 0.11, tail: 0.35, min: 0.9 },
  dmg: { kill: true, boss: 0.08, bossCap: 0.1 },
  heal: 3,
  healRadius: 120,
  allyHeal: { near: 2, far: 1, nearR: 60 },
  after: { flat: 0.4, dust: 0.5, bossKneel: 0.9 },
  card: { time: 0.7, short: 0.25, sub: "ROHIBA SUPERI", scale: 1.5 },
  sounds: {
    card: "superCard",
    prep: "lotusRise",
    mark: "lotusMark",
    hit: "lotusRay",
    bossHit: "lotusBossRay",
    end: "lotusEnd",
    strike: "lotusBloom",
  },
  fx: "lotus",
};

/**
 * BO'RI UVLASHI (Bo'ri-qiz Varvar).
 * Tayyorlanish (1.1 s): dunyo tungi ko'kka botadi, osmonda katta oy chiqadi, Varvar boshini ko'tarib
 * uvlaydi — tovush halqalari tarqaladi. Zarba (≤1.5 s): yonida 4–6 ta ruhiy ko'kish bo'ri paydo
 * bo'ladi, ular ekran bo'ylab yugurib HAR dushmanni tishlab o'tadi. Oqibat (0.8 s): bo'rilar tumanga
 * aylanib yo'qoladi; super tugagach Varvarning G'AZABI to'la (Player.endCast).
 *
 * Zaryad 20. Bossga: maksimal jonining 8% i, jami 10% dan oshmaydi (kartalar ham oshirmaydi).
 * Kartalar: OY G'AZABI (g'azab +3 s), TO'DA YUGURISHI (sakrash va yugurish darhol tayyor).
 */
const WOLF_HOWL: SuperDef = {
  id: "wolf-howl",
  hero: "wolf",
  get name() {
    return t("super.wolf.name");
  },
  get desc() {
    return t("super.wolf.desc");
  },
  color: "#7fb0ff",
  charge: 20,
  time: 3.4,
  params: {},
  open: true,
  stages: { prep: 1.1, strike: 1.5, after: 0.8 },
  slow: { prep: 0.2, strike: 0.06, after: 0.4 },
  strike: { mark: 0.16, gap: 0.11, tail: 0.35, min: 0.9 },
  dmg: { kill: true, boss: 0.08, bossCap: 0.1 },
  heal: 0,
  healRadius: 0,
  after: { flat: 0.4, dust: 0.5, bossKneel: 0.9 },
  card: { time: 0.7, short: 0.25, sub: "VARVAR SUPERI", scale: 1.5 },
  sounds: {
    card: "superCard",
    prep: "wolfHowl",
    mark: "wolfMark",
    hit: "wolfBite",
    bossHit: "wolfBossBite",
    end: "wolfMist",
    strike: "wolfPack",
  },
  fx: "howl",
};

/** Hamma superlar (yopiqlari ham — sinov va keyingi versiya ishlanmasi uchun) */
export const SUPERS: Partial<Record<Hero, SuperDef>> = {
  paladin: DIVINE_JUDGMENT,
  samurai: THOUSAND_CUTS,
  knight: HORIZON_CUT,
  mage: SKY_STONE,
  hunter: TEN_ARROWS,
  gunner: ENDLESS_LEAD,
  shinobi: SHADOW_STORM,
  priestess: GOLDEN_LOTUS,
  wolf: WOLF_HOWL,
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

/**
 * O'qlar nishonlari: moblar yaqindan uzoqqa, so'ng bosslar; o'q ko'p bo'lsa nishonlar qayta
 * aylanadi (har nishonga teng). Nishon yo'q — null (o'q oldinga uchib, bo'sh joyda portlaydi).
 */
export function volleyTargets<T extends StrikeTarget>(
  from: { x: number; y: number },
  mobs: readonly T[],
  bosses: readonly T[],
  n: number,
): (T | null)[] {
  const dist = (t: T) => Math.hypot(t.x - from.x, t.y - from.y);
  const order = [...[...mobs].sort((a, b) => dist(a) - dist(b)), ...bosses];
  return Array.from({ length: n }, (_, i) => (order.length ? order[i % order.length]! : null));
}

/**
 * O'qlarni otish: hammasi `from` dan osmonga (tepaga) yelpig'ich bo'lib, ketma-ket (`gap`). Nishonsiz
 * o'q `face` tomonga 70 px narida portlaydi. `window` — zarba bosqichi: o'q shu vaqt ichida albatta tegadi.
 */
export function launchVolley(
  def: SuperDef,
  from: { x: number; y: number },
  targets: readonly (StrikeTarget | null)[],
  face: { x: number; y: number },
  window = def.stages.strike,
): SuperArrow[] {
  const V = def.volley;
  if (!V) return [];
  const n = targets.length;
  return targets.map((t, i) => {
    const a = -Math.PI / 2 + (n > 1 ? (i / (n - 1) - 0.5) * 2 * V.spread : 0);
    const delay = i * V.gap;
    const fm = Math.hypot(face.x, face.y) || 1;
    return {
      x: from.x,
      y: from.y - 10,
      vx: Math.cos(a) * V.speed * 0.8,
      vy: Math.sin(a) * V.speed * 0.8,
      target: t as object | null,
      tx: t ? t.x : from.x + (face.x / fm) * 70,
      ty: t ? t.y : from.y + (face.y / fm) * 70,
      delay,
      age: 0,
      life: Math.max(0.3, window - delay - 0.12),
      done: false,
    };
  });
}

/**
 * O'qni bir qadam suradi: nishonga (tx, ty) egri yoy bilan buriladi — burilish uchgan sari kuchayadi,
 * `life` tugaganda o'q nishonga "yopishadi". Qaytaradi: shu qadamda tegdimi.
 */
export function stepArrow(def: SuperDef, a: SuperArrow, dt: number, t: number): boolean {
  const V = def.volley;
  if (!V || a.done || t < a.delay) return false;
  a.age += dt;
  const k = Math.min(1, a.age / a.life);
  const dx = a.tx - a.x,
    dy = a.ty - a.y;
  const cur = Math.atan2(a.vy, a.vx);
  const want = Math.atan2(dy, dx);
  let d = want - cur;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  const max = V.turn * (1 + 6 * k * k) * dt;
  const ang = cur + Math.max(-max, Math.min(max, d));
  const sp = V.speed * (0.8 + 0.7 * k);
  a.vx = Math.cos(ang) * sp;
  a.vy = Math.sin(ang) * sp;
  const step = sp * dt;
  const dist = Math.hypot(dx, dy);
  if (dist <= V.hit + step || a.age >= a.life) {
    a.x = a.tx;
    a.y = a.ty;
    a.done = true;
    return true;
  }
  a.x += a.vx * dt;
  a.y += a.vy * dt;
  return false;
}

/** Nishoni o'lgan o'q uchun yangi nishon: o'qqa eng yaqin tirik nishon (yo'q — null) */
export function nearestTarget<T extends StrikeTarget>(
  a: { x: number; y: number },
  list: readonly T[],
): T | null {
  let best: T | null = null,
    bd = Infinity;
  for (const t of list) {
    const d = Math.hypot(t.x - a.x, t.y - a.y);
    if (d < bd) {
      bd = d;
      best = t;
    }
  }
  return best;
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
  /** O'N O'Q OVI: uchayotgan o'qlar (zarba bosqichida egasi to'ldiradi) */
  arrows: SuperArrow[] = [];
  /** CHEKSIZ O'Q: tez otishda bossga berilgan qo'shimcha zarar (chegara uchun) */
  frenzyExtra = new Map<object, number>();

  constructor(
    readonly def: SuperDef,
    /** Karta davomiyligi (0 — kartasiz: onlayn kuzatuvchi yoki sinov) */
    readonly cardTime: number = def.card.time,
  ) {
    this.strikeTime = def.stages.strike;
    if (cardTime <= 0) this.stage = "prep";
  }

  /** Egasi boshqaruvni qaytargan bosqich (CHEKSIZ O'Q: tez otish va g'ilofga solish) */
  get free() {
    return !!this.def.frenzy && (this.stage === "strike" || this.stage === "after") && !this.done;
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
