/**
 * SKIN EFFEKTLARI — skin qahramonning butun "his"ini o'zgartiradi: qobiliyat ranglari (theme),
 * zarrachalar, iz, zarba shakli, ovoz ohangi va (afsonaviy skinda) qo'shimcha animatsiya (fx).
 *
 * QOIDA: skin KUCH BERMAYDI — bu fayl faqat chizish va ovoz uchun. O'yin mantig'i (zarar, tezlik,
 * cooldown, maydon, to'qnashuv) skinni bilmaydi (skins.test.ts tekshiradi).
 *
 * API umumiy: har qanday qahramon effekti (kelajakdagi superlar va yangi qahramonlar ham)
 * `SkinLook` dan rang (theme) va shakl (fx) oladi va heroBurst / heroTrail / heroImpact /
 * renderFlair orqali chiziladi. "default" skin — v3.6 gacha bo'lgan aynan bir xil ko'rinish.
 *
 * Xavf ranglari (danger.ts) dushmanniki: skin effekt ranglari ularga o'xshamasin (test bor).
 */
import { px } from "./animation";
import { HERO_THEME, withAlpha, type Hero, type HeroTheme } from "./hero";
import type { Effects } from "./effects";

/**
 * Qobiliyat ranglari: HERO_THEME maydonlari + effektlar uchun 10 ta "slot". Har qahramon slotdan
 * o'z ma'nosida foydalanadi (pastdagi DEFAULT_THEME izohlari), lekin nomlar umumiy — yangi effekt
 * shu slotlardan rang oladi va har skin bilan o'zi mos keladi. Barchasi "#rrggbb".
 */
export interface SkinTheme extends HeroTheme {
  /** Zarbaning yorqin cheti (Ritsar qilich yoyi, Sehrgar halqasi, Paladin muqaddas nuri) */
  edge: string;
  /** Ichki ikkinchi chiziq / yorug'lik */
  inner: string;
  /** Zarba uchqunlari */
  spark: string;
  /** Issiq ikkinchi rang (shar tanasi, porox tutuni) */
  hot: string;
  /** Snaryad yadrosi / o'q dastasi */
  core: string;
  /** Snaryad halqasi, tuzoq temiri */
  rim: string;
  /** Kichik yaltiroq nuqta (shar yaltirog'i, o'q uchi) */
  glint: string;
  /** Eng to'q kontur (yoriq, o'q ramkasi) */
  ink: string;
  /** To'q tutun */
  shade: string;
  /** Och tutun / ikkinchi kulrang */
  mist: string;
}

export const THEME_SLOTS = [
  "accent",
  "accentDark",
  "glow",
  "uiText",
  "empty",
  "edge",
  "inner",
  "spark",
  "hot",
  "core",
  "rim",
  "glint",
  "ink",
  "shade",
  "mist",
] as const satisfies readonly (keyof SkinTheme)[];

/** Effekt ranglari (xavf ranglaridan farqi tekshiriladigan slotlar; UI maydonlari emas) */
export const FX_SLOTS = [
  "accent",
  "accentDark",
  "glow",
  "edge",
  "inner",
  "spark",
  "hot",
  "core",
  "rim",
  "glint",
] as const satisfies readonly (keyof SkinTheme)[];

/** Zarracha shakli: square — oddiy kvadrat (default) */
export type ParticleShape =
  "square" | "shard" | "star" | "puff" | "ember" | "drop" | "streak" | "cross" | "leaf";
/** Harakat izi (dash, sakrash, sirpanish, hamla): square — oddiy (default) */
export type TrailKind =
  "square" | "snow" | "smoke" | "sparkle" | "ember" | "sand" | "shadow" | "leaf";
/** Afsonaviy: zarba tekkanda ekranda kichik shakl */
export type ImpactKind = "crystal" | "flare" | "crescent" | "gust" | "phoenix";
/** Afsonaviy: turganda o'ziga xos harakat (ko'z porlashi, aura...) va hujumdagi "flourish" */
export type FlairKind = "frost" | "halo" | "eyes" | "scarf" | "embers";
/** Afsonaviy: hujum ovoziga qo'shiladigan o'z ohangi (Web Audio) */
export type ToneKind = "chime" | "sun" | "night" | "steppe" | "flame";

export interface SkinFx {
  particle: ParticleShape;
  trail: TrailKind;
  /** Qo'shimcha zarracha ranglari (noyob va afsonaviy): har portlashga aralashadi */
  bits: readonly string[];
  impact: ImpactKind | null;
  flair: FlairKind | null;
  tone: ToneKind | null;
}

export type SkinTier = "default" | "common" | "rare" | "legendary";

export const TIER_NAME: Record<Exclude<SkinTier, "default">, string> = {
  common: "ODDIY",
  rare: "NOYOB",
  legendary: "AFSONAVIY",
};

export const TIER_COLOR: Record<Exclude<SkinTier, "default">, string> = {
  common: "#c9c2d4",
  rare: "#7fd8ff",
  legendary: "#ffcc33",
};

/** Narx bo'yicha daraja: 80 — oddiy, 150 — noyob, 250 — afsonaviy */
export function tierOfPrice(price: number): SkinTier {
  return price <= 0 ? "default" : price < 150 ? "common" : price < 250 ? "rare" : "legendary";
}

/** Skinning to'liq "ko'rinishi": rang + effektlar */
export interface SkinLook {
  id: string;
  hero: Hero;
  tier: SkinTier;
  theme: SkinTheme;
  fx: SkinFx;
}

export const PLAIN_FX: SkinFx = {
  particle: "square",
  trail: "square",
  bits: [],
  impact: null,
  flair: null,
  tone: null,
};

/**
 * Default skin: v3.6 dagi qattiq yozilgan ranglar aynan shu slotlarga ko'chirilgan — hech narsa
 * o'zgarmaydi. Har qahramonda slot ma'nosi izohda.
 */
export const DEFAULT_THEME: Record<Hero, SkinTheme> = {
  // qilich yoyi oq, ichki yoy va aylana zarba uchquni — accent
  knight: {
    ...HERO_THEME.knight,
    edge: "#ffffff",
    inner: "#68cde4",
    spark: "#ffffff",
    hot: "#68cde4",
    core: "#287faf",
    rim: "#c5e4ec",
    glint: "#ffffff",
    ink: "#0b0a10",
    shade: "#1d3a4a",
    mist: "#c5e4ec",
  },
  // halqa: to'q chekka (ink), qizil to'lqin (edge), ichki (inner); shar: halo (rim), tana (hot),
  // yadro (core), yaltiroq (glint); qora tutun izi va teleport (shade, mist)
  mage: {
    ...HERO_THEME.mage,
    edge: "#d62832",
    inner: "#ff7850",
    spark: "#ff3b3b",
    hot: "#ff5a3c",
    core: "#a3192a",
    rim: "#ff6e32",
    glint: "#ffb36b",
    ink: "#140a10",
    shade: "#1a1118",
    mist: "#2b1c2e",
  },
  // o'q: pat (accentDark, edge), dasta (core; kuchli o'q — spark), uchi (glint), nur (accent);
  // tuzoq: temir (rim), yog'och (shade), tishlar (mist), kontur (ink), markaz (spark)
  hunter: {
    ...HERO_THEME.hunter,
    edge: "#7bd14f",
    inner: "#a6f08e",
    spark: "#c9a26b",
    hot: "#c9a26b",
    core: "#7a4a24",
    rim: "#9a9ea8",
    glint: "#d9d4e0",
    ink: "#1a1a20",
    shade: "#5a3e24",
    mist: "#e8e8f0",
  },
  // o'q: accent, accentDark, ink, glow; tutun bombasi: inner, rim, edge; tutun uchqunlari: core,
  // spark; porox tutuni (hot), o'q so'nishi (mist)
  gunner: {
    ...HERO_THEME.gunner,
    edge: "#d9d2c6",
    inner: "#78726a",
    spark: "#6e6860",
    hot: "#a8a298",
    core: "#b8b0a4",
    rim: "#a8a096",
    glint: "#ffe2a0",
    ink: "#0b0907",
    shade: "#8a5a2a",
    mist: "#9a948a",
  },
  // muqaddas nur: oq yadro (edge), oltin chekka (accent), porlash (glow), yoriq (ink)
  paladin: {
    ...HERO_THEME.paladin,
    edge: "#ffffff",
    inner: "#f2c14e",
    spark: "#ffffff",
    hot: "#fff2b0",
    core: "#a87a12",
    rim: "#fff2b0",
    glint: "#ffffff",
    ink: "#1e1606",
    shade: "#3a300e",
    mist: "#fff2b0",
  },
};

const DEFAULT_LOOKS = Object.fromEntries(
  (Object.keys(DEFAULT_THEME) as Hero[]).map((h) => [
    h,
    { id: "default", hero: h, tier: "default", theme: DEFAULT_THEME[h], fx: PLAIN_FX },
  ]),
) as Record<Hero, SkinLook>;

export function defaultLook(hero: Hero): SkinLook {
  return DEFAULT_LOOKS[hero];
}

// ---------------- chizish yordamchilari ----------------

/** Qahramon effekti portlashi: skin shakli va (noyob+) qo'shimcha ranglari bilan. */
export function heroBurst(
  fx: Effects,
  look: SkinLook,
  x: number,
  y: number,
  color: string,
  n: number,
  speed = 60,
  size = 2,
) {
  fx.burst(x, y, color, n, speed, size, look.fx.particle);
  const bits = look.fx.bits;
  if (bits.length)
    fx.burst(
      x,
      y,
      bits[Math.floor(Math.random() * bits.length)]!,
      Math.ceil(n / 3),
      speed * 0.8,
      1,
      look.fx.particle,
    );
}

/** Harakat izi (dash/sakrash/sirpanish/hamla, snaryad izi): skin izi turi bilan. */
export function heroTrail(fx: Effects, look: SkinLook, x: number, y: number, color: string) {
  fx.trail(x, y, color, look.fx.trail, look.fx.bits[0]);
}

/** Afsonaviy skin: zarba tekkanda kichik shakl (oddiy/noyobda — hech narsa). */
export function heroImpact(fx: Effects, look: SkinLook, x: number, y: number) {
  if (look.fx.impact) fx.impact(x, y, look.fx.impact, look.theme.glow, look.theme.accent);
}

/** Qahramon kadridagi bosh balandligi (sprite markazidan, px) — ko'z va halo uchun */
const HEAD_Y: Record<Hero, number> = { knight: -8, mage: -9, hunter: -8, gunner: -9, paladin: -9 };

/** Flair chizishi uchun kerakli o'yinchi maydonlari (Player va onlayn RealmPlayer.p) */
export interface FlairBody {
  x: number;
  y: number;
  fx: number;
  dead: boolean;
  dashing: boolean;
  hidden?: boolean;
  attackTimer: number;
  spinning: boolean;
  anim: { state: string };
}

/**
 * Afsonaviy skin animatsiya qo'shimchasi: turganda 2 kadrlik o'ziga xos harakat (ko'z porlashi,
 * halo, aura, sharf hilpirashi, cho'g'lar) va hujumda qo'shimcha "flourish" kadri (qurol uchida
 * kichik yulduz). Sprite piksellari o'zgarmaydi — ustidan kod bilan chiziladi.
 */
export function renderFlair(
  c: CanvasRenderingContext2D,
  look: SkinLook,
  p: FlairBody,
  time: number,
  reduced = false,
) {
  const kind = look.fx.flair;
  if (!kind || p.dead || p.hidden || (p.dashing && look.hero === "mage")) return;
  const t = look.theme;
  const x = Math.round(p.x),
    y = Math.round(p.y);
  const hy = y + HEAD_Y[look.hero];
  const dir = p.fx < 0 ? -1 : 1;
  // 2 kadr: 0.35s da almashadi
  const f = Math.floor(time * 2.8) % 2;
  const idle = p.anim.state === "idle";
  if (kind === "frost") {
    // muz aura: oyoq ostida aylanuvchi muz zarralari, ko'zda sovuq yaltirash
    for (let i = 0; i < 4; i++) {
      const a = time * 1.6 + (i * Math.PI) / 2;
      px(c, i % 2 ? t.glow : t.accent, x + Math.cos(a) * 9, y + 11 + Math.sin(a) * 3, 1, 1);
    }
    if (idle && f) px(c, t.glow, x + dir * 2, hy, 2, 1);
  } else if (kind === "halo") {
    // quyosh haloti: bosh uzra 2 kadrda yonib-o'chadigan oltin halqa
    const w = f ? 9 : 7;
    px(c, withAlpha(t.glow, 0.85), x - Math.floor(w / 2), hy - 7, w, 1);
    px(c, withAlpha(t.accent, 0.7), x - Math.floor(w / 2) - 1, hy - 6, 1, 1);
    px(c, withAlpha(t.accent, 0.7), x + Math.ceil(w / 2), hy - 6, 1, 1);
  } else if (kind === "eyes") {
    // tungi ovchi: kapyushon ichida ko'zlar porlaydi (har 2.4s da qisqa chaqnash)
    const blink = time % 2.4 < 0.5;
    if (blink || !idle) {
      px(c, t.glow, x + dir * 1, hy + 1, 1, 1);
      px(c, t.glow, x + dir * 4, hy + 1, 1, 1);
      if (f && !reduced) px(c, withAlpha(t.accent, 0.5), x + dir * 1 - 1, hy, 5, 3);
    }
  } else if (kind === "scarf") {
    // dasht shamoli: bo'yinbog' uchi orqada hilpiraydi (2 kadr)
    const bx = x - dir * 5,
      by = y - 3;
    px(c, t.accent, bx - dir * (f ? 3 : 2), by + (f ? 0 : 1), 3, 1);
    px(c, t.accentDark, bx - dir * (f ? 5 : 4), by + (f ? 1 : 2), 2, 1);
  } else if (kind === "embers") {
    // olov aura: yelkadan ko'tariluvchi cho'g'lar
    for (let i = 0; i < 3; i++) {
      const k = (time * 0.9 + i / 3) % 1;
      px(
        c,
        withAlpha(i % 2 ? t.glow : t.accent, 1 - k),
        x - 7 + i * 7 + Math.sin(time * 3 + i) * 1.5,
        y - 2 - k * 16,
        1,
        1,
      );
    }
  }
  // hujum flourishi: qurol uchida 4 nurli yulduz (hujumning birinchi yarmida)
  if (p.attackTimer > 0.12 || (p.spinning && f)) {
    const sx = x + dir * 13,
      sy = y - 4;
    px(c, t.glow, sx - 2, sy, 5, 1);
    px(c, t.glow, sx, sy - 2, 1, 5);
    px(c, t.edge, sx, sy, 1, 1);
  }
}

// ---------------- ovoz ----------------

/** Ohang: [chastota, davomiylik, to'lqin, kechikish] — hujum ovoziga qo'shiladi */
export const TONES: Record<ToneKind, readonly [number, number, OscillatorType, number][]> = {
  // muz qo'ng'iroqchasi
  chime: [
    [2093, 0.12, "triangle", 0],
    [2637, 0.16, "triangle", 0.05],
  ],
  // quyosh: ko'tariluvchi yorug' akkord
  sun: [
    [880, 0.1, "triangle", 0],
    [1109, 0.1, "triangle", 0.04],
    [1319, 0.14, "triangle", 0.08],
  ],
  // tun: past mayin nota va uzoq "ping"
  night: [
    [196, 0.16, "sine", 0],
    [1568, 0.12, "sine", 0.06],
  ],
  // dasht: do'mbira chertishi kabi ikki nota
  steppe: [
    [392, 0.08, "square", 0],
    [587, 0.1, "triangle", 0.05],
  ],
  // olov: ko'tariluvchi "vuush" va jarang
  flame: [
    [330, 0.14, "sawtooth", 0],
    [1760, 0.1, "triangle", 0.04],
  ],
};
