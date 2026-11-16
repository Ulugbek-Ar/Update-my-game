/**
 * OSMON TOSHI sahnasi (Sehrgar superi, yovuz ruhda) — faqat chizish; zarar, vaqt va nishon
 * super.ts / Game da.
 *
 *  TAYYORLANISH: Sehrgar tayog'ini osmonga ko'taradi, dunyo qorayadi, kristall yonadi; xona
 *    tepasida qora-qizil DARZ ochilib kengayadi — ichidan binafsha nur, undan uchqunlar to'kiladi.
 *    Nishon nuqtasida (cast.spot) qorong'i binafsha doira paydo bo'lib kichrayadi — ustida
 *    aylanuvchi o'tkir runalar.
 *  ZARBA: darzdan ulkan to'q qizil-binafsha olovli METEORIT qora tutunli dum bilan qiya tushadi,
 *    yerdagi soyasi kattalashadi. Urilganda (cast.landed): chaqnash, ikki qavat zarba to'lqini,
 *    krater, uchayotgan tosh bo'laklari va chang. Markazdagilar ko'mirdek qorayib otiladi va kulga
 *    aylanadi.
 *  OQIBAT: chetdagilar qora tosh qobiqda qotadi (ustida yulduzchalar aylanadi, qobiq `hold`
 *    tugaganda chatnab to'kiladi). Krater qora-qizil cho'g'lanib turadi, undan cho'g'lar ko'tariladi.
 *    METEOR YOMG'IRI kartasi bilan yana kichik meteorlar tushadi (cast.rain).
 *
 * Ranglar faol skin theme'idan (meteorColors): oddiy (qora-qizil) Sehrgarda sehr — binafsha, olov —
 * to'q qizil-binafsha; Muzlagan Lich — muz ko'k-oq, Zahar — yashil, Tutilgan oy — qora-binafsha.
 * Nishon doirasi va runalar xavf ranglaridan (danger.ts) aniq farqli rangda. "Effektlarni
 * kamaytirish": chaqnash yo'q, zarrachalar kam. Zarrachalar soni chegaralangan. Math.random
 * ishlatilmaydi.
 */
import { px } from "./animation";
import { dangerDistance } from "./danger";
import { withAlpha } from "./hero";
import type { SkinTheme } from "./skinFx";
import { MAGE_SUPER_FRAME, renderSprite, spriteSize, type SpritePalette } from "./sprites";
import type { SuperCast, SuperDef, SuperStage } from "./super";
import { mixColor, renderSuperCard, type CardText } from "./superFx";
import { MAGE_PORTRAIT_GRID } from "./magePortrait";
import type { SceneCtx, SceneTarget, SuperScene } from "./superScene";

/** Tosh bo'laklari va cho'g'lar chegarasi: oddiy / kamaytirilgan */
export const MAX_ROCKS = 220;
export const MAX_ROCKS_REDUCED = 40;
export const MAX_EMBERS = 90;
export const MAX_EMBERS_REDUCED = 14;
/** Ko'mirga aylangan jasad havoda turishi (s), so'ng kulga sochiladi */
export const ASH_TIME = 0.55;
/** Zarba to'lqini davomiyligi (s) */
export const SHOCK_TIME = 0.5;
/** Nishon doirasi va runalar xavf ranglaridan kamida shuncha uzoq (danger.ts: colorDistance) */
export const RUNE_DANGER_GAP = 90;

/** Toshga aylangan dushman qobig'i: qora tosh (yoriqlari skin olovi rangida porlaydi) */
export const STONE_PALETTE: SpritePalette = {
  id: "meteor-stone",
  colors: ["#050306", "#17121a", "#2a222c", "#463a48", "#685a6a"],
};
/** Ko'mirga aylangan jasad (ichida cho'g' yonadi) */
export const ASH_PALETTE: SpritePalette = {
  id: "meteor-ash",
  colors: ["#08050a", "#1e1418", "#3a2628", "#ff9a3c", "#5a3a34"],
};

/**
 * Sahna ranglari: sehr (runa, darz nuri), darzning qora-qizil qatlamlari, olov, tutun va tosh.
 */
export interface MeteorColors {
  rune: string;
  runeDark: string;
  runeLight: string;
  /** Darz: tashqi qora va o'rta qon qatlami (ichidan runa nuri chiqadi) */
  riftOuter: string;
  riftMid: string;
  fire: string;
  fireLight: string;
  core: string;
  /** Meteorit dumidagi qora tutun */
  smoke: string;
  rock: readonly [string, string, string];
}

const ROCK = ["#0e0a0e", "#241a20", "#3e3038"] as const;

/** Oddiy (qora-qizil) Sehrgar: yovuz binafsha sehr va to'q qizil-binafsha olov */
const PLAIN: MeteorColors = {
  rune: "#a040e8",
  runeDark: "#34105a",
  runeLight: "#dcaaff",
  riftOuter: "#140206",
  riftMid: "#9a0e22",
  fire: "#8a0c3a",
  fireLight: "#d8407e",
  core: "#ffd2e6",
  smoke: "#120a10",
  rock: ROCK,
};

/**
 * Ranglar skin theme'idan. Oddiy Sehrgar (qora-qizil) — yovuz binafsha sehr, qizil-binafsha olov.
 * Runa rangi xavf ranglaridan RUNE_DANGER_GAP dan uzoq bo'lishi shart: skin ranglaridan birinchi
 * mosi olinadi (yo'q bo'lsa — binafsha).
 */
export function meteorColors(T: SkinTheme, _flair?: string | null): MeteorColors {
  const plain = T.accent.toLowerCase() === "#ff4d4d" && T.edge.toLowerCase() === "#d62832";
  if (plain) return PLAIN;
  const candidates = [T.glow, T.glint, T.edge, T.inner, T.rim, T.accent];
  const far = candidates.find((c) => dangerDistance(c) >= RUNE_DANGER_GAP);
  const rune = far ?? PLAIN.rune;
  return {
    rune,
    runeDark: mixColor(rune, "#000000", 0.6),
    runeLight: mixColor(rune, "#ffffff", 0.55),
    riftOuter: T.ink,
    riftMid: T.core,
    fire: T.hot,
    fireLight: T.glint,
    core: mixColor(T.glint, "#ffffff", 0.7),
    smoke: T.shade,
    rock: ROCK,
  };
}

interface Rock {
  x: number;
  y: number;
  /** Balandlik (yerdan, px) va uning tezligi: bo'lak yoyda uchib yerga tushadi */
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  max: number;
  col: string;
  size: number;
}

interface Ember {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  hot: boolean;
}

interface Corpse {
  t: SceneTarget;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  spin: number;
}

interface Stone {
  t: SceneTarget;
  /** Qotish oxirida qobiq chatnab to'kildi */
  broke: boolean;
  age: number;
}

interface Crater {
  x: number;
  y: number;
  r: number;
  life: number;
  max: number;
  small: boolean;
}

interface Shock {
  x: number;
  y: number;
  r: number;
  age: number;
  max: number;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeOut = (k: number) => 1 - (1 - clamp01(k)) ** 3;

/** To'rt nurli yulduzcha */
function star(c: CanvasRenderingContext2D, x: number, y: number, r: number, col: string) {
  const bx = Math.round(x),
    by = Math.round(y),
    n = Math.max(1, Math.round(r));
  px(c, col, bx - n, by, n * 2 + 1, 1);
  px(c, col, bx, by - n, 1, n * 2 + 1);
}

/** 3x3 piksel runa belgilari (aylanadigan doira ustida) */
const RUNES: readonly (readonly number[])[] = [
  [1, 0, 1, 0, 1, 0, 1, 0, 1],
  [0, 1, 0, 1, 1, 1, 0, 1, 0],
  [1, 1, 0, 0, 1, 0, 0, 1, 1],
  [1, 0, 0, 1, 1, 1, 0, 0, 1],
  [0, 1, 1, 0, 1, 0, 1, 1, 0],
  [1, 1, 1, 0, 0, 1, 0, 1, 0],
];

export class MeteorScene implements SuperScene {
  /** Sahna soati (haqiqiy vaqt) */
  t = 0;
  dim = 0;
  /** Ekran oq chaqnashi (kamaytirilganda — yo'q) */
  flash = 0;
  /** Darz ochilishi 0..1 */
  rift = 0;
  /** Meteorit urildi (chaqnash va to'lqinlar bir marta) */
  boomed = false;
  spot = { x: 160, y: 120 };
  rocks: Rock[] = [];
  embers: Ember[] = [];
  corpses: Corpse[] = [];
  stones: Stone[] = [];
  craters: Crater[] = [];
  shocks: Shock[] = [];
  /** Bosslar ustidagi yulduzchalar (qotgan vaqti) */
  dazed: { t: SceneTarget; life: number }[] = [];
  /** Meteorit dumi: oxirgi joylari */
  trail: { x: number; y: number }[] = [];
  /** Kichik meteorlar: qaysilari urildi */
  private rainSeen = new Set<object>();
  private riftPts: { x: number; y: number }[] = [];
  private seed = 424242;
  private castOn = false;
  private reduced = false;
  private stageNow: SuperStage | "card" | null = null;
  private impactAt = 0.42;
  private ring = 74;
  private core = 34;
  private params: Readonly<Record<string, number>> = {};
  private colors: MeteorColors | null = null;

  private rnd() {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  get alive() {
    return (
      this.castOn ||
      this.dim > 0.02 ||
      this.flash > 0.02 ||
      this.rift > 0.02 ||
      this.rocks.length > 0 ||
      this.embers.length > 0 ||
      this.corpses.length > 0 ||
      this.stones.length > 0 ||
      this.craters.length > 0 ||
      this.shocks.length > 0 ||
      this.dazed.length > 0
    );
  }

  /** Tayoq osmonga (kristall yonib-o'chadi) → urilgach nishonga ishora → tik turish */
  pose(cast: SuperCast) {
    const F = MAGE_SUPER_FRAME;
    if (cast.stage === "card") return F.raise;
    if (cast.stage === "prep")
      return cast.t > 0.25 && Math.floor(this.t * 16) % 2 ? F.raiseGlow : F.raise;
    if (cast.stage === "strike") return cast.landed ? F.point : F.raiseGlow;
    if (cast.t < 0.45) return F.point;
    return cast.t < 0.75 ? F.rest : null;
  }

  /** Meteorit chiqadigan joy (darz ichida, nishondan yuqori-chapda) */
  private origin(ctx: SceneCtx) {
    const V = ctx.view;
    const x = Math.max(V.x + 30, Math.min(V.x + V.w - 30, this.spot.x - 70));
    return { x, y: V.y + 34 };
  }

  private addRock(r: Rock) {
    const cap = this.reduced ? MAX_ROCKS_REDUCED : MAX_ROCKS;
    if (this.rocks.length >= cap) this.rocks.shift();
    this.rocks.push(r);
  }

  private addEmber(e: Ember) {
    const cap = this.reduced ? MAX_EMBERS_REDUCED : MAX_EMBERS;
    if (this.embers.length >= cap) this.embers.shift();
    this.embers.push(e);
  }

  /** Tosh bo'laklari: yoyda uchib yerga tushadi */
  private debris(x: number, y: number, n: number, speed: number, cols: readonly string[]) {
    for (let i = 0; i < n; i++) {
      const a = this.rnd() * Math.PI * 2;
      const v = speed * (0.3 + this.rnd() * 0.7);
      const life = 0.5 + this.rnd() * 0.6;
      this.addRock({
        x: x + Math.cos(a) * 4,
        y: y + Math.sin(a) * 3,
        z: 2,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v * 0.6,
        vz: 60 + this.rnd() * 140,
        life,
        max: life,
        col: cols[Math.floor(this.rnd() * cols.length)] ?? "#6e5a62",
        size: this.rnd() < 0.3 ? 3 : this.rnd() < 0.6 ? 2 : 1,
      });
    }
  }

  private sparks(x: number, y: number, n: number, speed: number, up = 40) {
    for (let i = 0; i < n; i++) {
      const a = this.rnd() * Math.PI * 2;
      const v = speed * (0.3 + this.rnd() * 0.7);
      const life = 0.3 + this.rnd() * 0.5;
      this.addEmber({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - up,
        life,
        max: life,
        hot: this.rnd() < 0.5,
      });
    }
  }

  stage(s: SuperStage, cast: SuperCast, ctx: SceneCtx) {
    this.reduced = ctx.reduced;
    this.stageNow = s;
    this.params = cast.def.params;
    const I = cast.def.impact;
    if (I) {
      this.impactAt = I.at;
      this.ring = I.ring;
      this.core = I.core;
    }
    if (cast.spot) this.spot = { ...cast.spot };
    if (s === "prep") {
      // darz: nishondan yuqori-chapda, xona tepasi bo'ylab siniq chiziq
      const o = this.origin(ctx);
      this.riftPts = [];
      const n = 13;
      for (let i = 0; i <= n; i++) {
        const x = o.x - 96 + (192 * i) / n;
        const y = o.y + (i % 2 ? -5 : 5) * (0.5 + this.rnd()) - Math.abs(i - n / 2) * 0.9;
        this.riftPts.push({ x, y });
      }
      ctx.shake(0.06);
    }
    if (s === "strike") this.trail = [];
  }

  mark() {}

  hit(t: SceneTarget, boss: boolean, killed: boolean, cast: SuperCast, ctx: SceneCtx) {
    const live = t.live ?? t;
    const C = this.colors ?? meteorColors(ctx.theme, ctx.flair);
    // asosiy zarba yoki kichik meteor: urilish effektlari shu yerda (Game zarbani shu lahzada beradi)
    if (cast.landed && !this.boomed) this.boom(cast, ctx);
    if (boss) {
      this.dazed.push({ t, life: cast.def.after.bossKneel });
      this.debris(live.x, live.y, ctx.reduced ? 4 : 16, 110, C.rock);
      ctx.shake(0.4);
      return false;
    }
    if (!killed) {
      // chetda: toshda qotadi (qobiq Game bergan `hold` vaqtigacha)
      if (t.hold) this.stones.push({ t, broke: false, age: 0 });
      return false;
    }
    if (!t.sprite) return false;
    // markazda: ko'mirdek qorayib havoga otiladi
    const src = this.nearestBlast(live.x, live.y);
    const dx = live.x - src.x,
      dy = live.y - src.y;
    const m = Math.hypot(dx, dy) || 1;
    const v = 50 + this.rnd() * 50;
    this.corpses.push({
      t,
      x: live.x,
      y: live.y,
      z: 0,
      vx: (dx / m) * v,
      vy: (dy / m) * v * 0.5,
      vz: 120 + this.rnd() * 60,
      age: 0,
      spin: (this.rnd() - 0.5) * 9,
    });
    return true;
  }

  /** Eng yaqin urilish nuqtasi (asosiy yoki kichik meteor) — jasad shundan uzoqqa otiladi */
  private nearestBlast(x: number, y: number) {
    let best = this.spot;
    let d = Math.hypot(x - best.x, y - best.y);
    for (const k of this.craters)
      if (k.small && Math.hypot(x - k.x, y - k.y) < d) {
        best = k;
        d = Math.hypot(x - k.x, y - k.y);
      }
    return best;
  }

  /** Asosiy meteorit urildi: chaqnash, zarba to'lqinlari, krater, tosh bo'laklari */
  private boom(cast: SuperCast, ctx: SceneCtx) {
    this.boomed = true;
    const C = this.colors ?? meteorColors(ctx.theme, ctx.flair);
    const { x, y } = this.spot;
    if (!ctx.reduced) this.flash = 0.75;
    ctx.shake(1.1);
    this.shocks.push({ x, y, r: this.ring * 1.35, age: 0, max: SHOCK_TIME });
    this.shocks.push({ x, y, r: this.core * 1.2, age: -0.06, max: SHOCK_TIME * 0.8 });
    const I = cast.def.impact;
    const life = cast.craterTime || I?.crater.time || 4;
    this.craters.push({ x, y, r: I?.crater.r ?? 26, life, max: life, small: false });
    const rocks = ctx.reduced ? (this.params["rocksReduced"] ?? 8) : (this.params["rocks"] ?? 30);
    this.debris(x, y, rocks, 170, [...C.rock, C.fire]);
    this.sparks(x, y - 4, ctx.reduced ? 4 : 18, 140, 60);
    // chang halqasi
    ctx.fx.burst(x, y + 4, "#5a4a52", ctx.reduced ? 3 : 12, 120, 2);
    this.trail = [];
  }

  /** Kichik meteor urildi */
  private smallBoom(x: number, y: number, r: number, ctx: SceneCtx) {
    const C = this.colors ?? meteorColors(ctx.theme, ctx.flair);
    if (!ctx.reduced) this.flash = Math.max(this.flash, 0.35);
    ctx.shake(0.45);
    this.shocks.push({ x, y, r: r * 2.2, age: 0, max: SHOCK_TIME * 0.7 });
    this.craters.push({ x, y, r: r * 0.7, life: 1.6, max: 1.6, small: true });
    this.debris(x, y, ctx.reduced ? 3 : 12, 120, C.rock);
    this.sparks(x, y - 3, ctx.reduced ? 2 : 8, 100, 40);
  }

  update(dt: number, cast: SuperCast | null, ctx: SceneCtx) {
    this.t += dt;
    this.castOn = !!cast;
    this.reduced = ctx.reduced;
    const C = (this.colors = meteorColors(ctx.theme, ctx.flair));
    const st = cast?.stage ?? null;
    this.stageNow = st;
    if (cast?.spot) this.spot = { ...cast.spot };
    // dunyo vaqti (krater, qobiq): super paytida sekin
    const wdt = dt * (cast ? cast.worldSpeed : 1);

    // qorong'ilik: tayyorlanishdan oqibat o'rtasigacha
    const want = cast && st !== "card" && !(st === "after" && cast.t > 0.45) ? 1 : 0;
    this.dim += (want - this.dim) * Math.min(1, dt * (want ? 6 : 3));
    if (this.dim < 0.005) this.dim = 0;
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 3.2);
    // darz: tayyorlanishda ochiladi, meteorit chiqqach asta yopiladi
    const riftWant =
      cast && (st === "prep" || (st === "strike" && !cast.landed))
        ? st === "prep"
          ? easeOut(cast.k * 1.2)
          : 1
        : 0;
    this.rift += (riftWant - this.rift) * Math.min(1, dt * (riftWant > this.rift ? 10 : 3));
    if (this.rift < 0.01) this.rift = 0;
    if (this.rift > 0.2 && !ctx.reduced && this.riftPts.length && this.rnd() < dt * 30) {
      // darzdan to'kilayotgan uchqunlar
      const p = this.riftPts[Math.floor(this.rnd() * this.riftPts.length)]!;
      this.addEmber({
        x: p.x + (this.rnd() - 0.5) * 8,
        y: p.y + 2,
        vx: (this.rnd() - 0.5) * 20,
        vy: 30 + this.rnd() * 40,
        life: 0.6,
        max: 0.6,
        hot: this.rnd() < 0.6,
      });
    }

    // meteorit tushmoqda: dumi va uchqunlari
    if (cast && st === "strike" && !cast.landed) {
      const m = this.meteorPos(cast, ctx);
      this.trail.push({ x: m.x, y: m.y });
      if (this.trail.length > 16) this.trail.shift();
      const n = ctx.reduced ? 0 : 3;
      for (let i = 0; i < n; i++)
        this.addEmber({
          x: m.x + (this.rnd() - 0.5) * m.r,
          y: m.y + (this.rnd() - 0.5) * m.r,
          vx: -m.ux * (40 + this.rnd() * 50) + (this.rnd() - 0.5) * 30,
          vy: -m.uy * (40 + this.rnd() * 50) + (this.rnd() - 0.5) * 30,
          life: 0.35,
          max: 0.35,
          hot: this.rnd() < 0.5,
        });
    }
    if (cast?.landed && !this.boomed) this.boom(cast, ctx);
    // kichik meteorlar urilishi (METEOR YOMG'IRI)
    if (cast)
      for (const d of cast.rain)
        if (d.done && !this.rainSeen.has(d)) {
          this.rainSeen.add(d);
          this.smallBoom(d.x, d.y, cast.def.impact?.rain.r ?? 16, ctx);
        }

    for (const r of this.rocks) {
      r.life -= dt;
      r.x += r.vx * dt;
      r.y += r.vy * dt;
      r.z += r.vz * dt;
      r.vz -= 420 * dt;
      if (r.z < 0) {
        // yerga tushdi: sakraydi va to'xtaydi
        r.z = 0;
        r.vz = Math.abs(r.vz) > 60 ? -r.vz * 0.3 : 0;
        r.vx *= 0.5;
        r.vy *= 0.5;
      }
    }
    this.rocks = this.rocks.filter((r) => r.life > 0);
    for (const e of this.embers) {
      e.life -= dt;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.vy -= 20 * dt;
      e.vx *= 1 - Math.min(1, dt * 2);
    }
    this.embers = this.embers.filter((e) => e.life > 0);
    for (const k of this.corpses) {
      k.age += dt;
      k.x += k.vx * dt;
      k.y += k.vy * dt;
      k.z = Math.max(0, k.z + k.vz * dt);
      k.vz -= 360 * dt;
      if (k.age >= ASH_TIME && k.age - dt < ASH_TIME) {
        // kulga sochiladi
        const z = k.z;
        this.debris(k.x, k.y - z, ctx.reduced ? 2 : 8, 60, ["#1e1418", "#3a2628", "#5a3a34"]);
        this.sparks(k.x, k.y - z - 4, ctx.reduced ? 1 : 4, 50, 30);
      }
    }
    this.corpses = this.corpses.filter((k) => k.age < ASH_TIME);
    for (const s of this.stones) {
      s.age += dt;
      const left = s.t.hold?.() ?? 0;
      if (left <= 0 && !s.broke) {
        // qobiq chatnab to'kiladi
        s.broke = true;
        const live = s.t.live ?? s.t;
        this.debris(live.x, live.y, ctx.reduced ? 2 : 7, 60, STONE_PALETTE.colors.slice(1, 4));
      }
    }
    this.stones = this.stones.filter((s) => !s.broke);
    for (const d of this.dazed) d.life -= wdt;
    this.dazed = this.dazed.filter((d) => d.life > 0);
    for (const k of this.craters) {
      k.life -= wdt;
      // kraterdan cho'g'lar ko'tariladi
      if (!ctx.reduced && !k.small && this.rnd() < dt * 9) {
        const a = this.rnd() * Math.PI * 2;
        const r = this.rnd() * k.r * 0.8;
        this.addEmber({
          x: k.x + Math.cos(a) * r,
          y: k.y + Math.sin(a) * r * 0.45,
          vx: (this.rnd() - 0.5) * 10,
          vy: -18 - this.rnd() * 22,
          life: 0.9,
          max: 0.9,
          hot: this.rnd() < 0.4,
        });
      }
    }
    this.craters = this.craters.filter((k) => k.life > 0);
    for (const s of this.shocks) s.age += dt;
    this.shocks = this.shocks.filter((s) => s.age < s.max);
    void C;
  }

  /** Meteorit joyi va kattaligi (zarba bosqichida, urilishgacha) */
  private meteorPos(cast: SuperCast, ctx: SceneCtx) {
    const o = this.origin(ctx);
    const k = clamp01(cast.t / Math.max(0.05, this.impactAt));
    const e = k * k * (0.6 + 0.4 * k);
    const dx = this.spot.x - o.x,
      dy = this.spot.y - 6 - o.y;
    const m = Math.hypot(dx, dy) || 1;
    return {
      x: o.x + dx * e,
      y: o.y + dy * e,
      r: 10 + 9 * k,
      k,
      ux: dx / m,
      uy: dy / m,
    };
  }

  // ---------------- chizish ----------------

  renderGround(c: CanvasRenderingContext2D, cast: SuperCast | null, ctx: SceneCtx) {
    const C = this.colors ?? meteorColors(ctx.theme, ctx.flair);
    // kraterlar: qorong'i chuqur, cho'g'langan yoriqlar
    for (const k of this.craters) this.renderCrater(c, k, C);
    // nishon doirasi: tayyorlanishda kichrayadi, urilguncha aylanadi
    if (cast && (cast.stage === "prep" || (cast.stage === "strike" && !cast.landed)))
      this.renderTarget(c, cast, C);
    // meteorit soyasi yerda kattalashadi
    if (cast?.stage === "strike" && !cast.landed) {
      const m = this.meteorPos(cast, ctx);
      const rx = 6 + 26 * m.k * m.k;
      c.fillStyle = `rgba(0,0,0,${0.18 + 0.4 * m.k})`;
      c.beginPath();
      c.ellipse(this.spot.x, this.spot.y + 4, rx, rx * 0.42, 0, 0, Math.PI * 2);
      c.fill();
    }
    // kichik meteorlar soyasi
    if (cast?.stage === "after")
      for (const d of cast.rain) {
        const k = 1 - (d.at - cast.t) / 0.22;
        if (d.done || k <= 0) continue;
        const rx = 3 + 10 * k;
        c.fillStyle = `rgba(0,0,0,${0.15 + 0.3 * k})`;
        c.beginPath();
        c.ellipse(d.x, d.y + 3, rx, rx * 0.42, 0, 0, Math.PI * 2);
        c.fill();
      }
    // yerga tushgan tosh bo'laklari soyasi
    for (const r of this.rocks)
      if (r.z > 2) px(c, "rgba(0,0,0,0.25)", Math.round(r.x), Math.round(r.y + 1), r.size, 1);
  }

  /** Nishon doirasi: tashqi halqa kichrayadi, ichida aylanuvchi runalar va markaz xochi */
  private renderTarget(c: CanvasRenderingContext2D, cast: SuperCast, C: MeteorColors) {
    const { x, y } = this.spot;
    const prepK = cast.stage === "prep" ? clamp01(cast.k) : 1;
    const R = this.ring * (1.9 - 0.9 * easeOut(prepK));
    const a0 = this.t * 1.6;
    const pulse = 0.55 + 0.35 * Math.sin(this.t * 14);
    const alpha = Math.min(1, 0.25 + prepK);
    // yer ustidagi doira (perspektiva: ellips)
    const sq = 0.5;
    c.fillStyle = withAlpha(C.runeDark, 0.18 * alpha);
    c.beginPath();
    c.ellipse(x, y, R, R * sq, 0, 0, Math.PI * 2);
    c.fill();
    // tashqi halqa: piksel nuqtalar, ikki qavat
    const ring = (r: number, step: number, col: string, a: number, rot: number) => {
      const n = Math.max(12, Math.round((r * Math.PI * 2) / step));
      for (let i = 0; i < n; i++) {
        const ang = rot + (i / n) * Math.PI * 2;
        px(
          c,
          withAlpha(col, a),
          Math.round(x + Math.cos(ang) * r),
          Math.round(y + Math.sin(ang) * r * sq),
          2,
          1,
        );
      }
    };
    ring(R, 2, C.rune, 0.85 * alpha, 0);
    ring(R - 3, 6, C.runeLight, 0.5 * alpha * pulse, -a0 * 0.5);
    // markaz zonasi (o'ladiganlar): ichki halqa teskari aylanadi
    ring(this.core, 4, C.runeLight, 0.7 * alpha, -a0);
    // aylanuvchi runalar
    const n = 8;
    for (let i = 0; i < n; i++) {
      const ang = a0 + (i / n) * Math.PI * 2;
      const rx = Math.round(x + Math.cos(ang) * (R - 9)) - 1;
      const ry = Math.round(y + Math.sin(ang) * (R - 9) * sq) - 1;
      const g = RUNES[i % RUNES.length]!;
      for (let j = 0; j < 9; j++)
        if (g[j])
          px(
            c,
            withAlpha(j === 4 ? C.runeLight : C.rune, alpha),
            rx + (j % 3),
            ry + Math.floor(j / 3),
            1,
            1,
          );
    }
    // markaz xochi
    const cr = 4 + 2 * pulse;
    px(
      c,
      withAlpha(C.runeLight, alpha),
      Math.round(x - cr),
      Math.round(y),
      Math.round(cr * 2 + 1),
      1,
    );
    px(
      c,
      withAlpha(C.runeLight, alpha),
      Math.round(x),
      Math.round(y - cr * sq),
      1,
      Math.round(cr * 2 * sq + 1),
    );
  }

  private renderCrater(c: CanvasRenderingContext2D, k: Crater, C: MeteorColors) {
    const fade = clamp01(k.life / Math.min(1, k.max));
    const glow = (0.55 + 0.25 * Math.sin(this.t * 5 + k.x)) * fade;
    // chuqur
    c.fillStyle = `rgba(14,8,10,${0.75 * fade})`;
    c.beginPath();
    c.ellipse(k.x, k.y + 2, k.r, k.r * 0.45, 0, 0, Math.PI * 2);
    c.fill();
    // chekka (ko'tarilgan tuproq)
    c.strokeStyle = withAlpha(C.rock[1], 0.8 * fade);
    c.lineWidth = 2;
    c.beginPath();
    c.ellipse(k.x, k.y + 1, k.r + 1, k.r * 0.45 + 1, 0, Math.PI, Math.PI * 2);
    c.stroke();
    // cho'g'langan markaz va yoriqlar
    c.fillStyle = withAlpha(C.riftMid, 0.75 * glow);
    c.beginPath();
    c.ellipse(k.x, k.y + 2, k.r * 0.55, k.r * 0.22, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = withAlpha(C.fireLight, 0.7 * glow);
    c.beginPath();
    c.ellipse(k.x, k.y + 2, k.r * 0.25, k.r * 0.1, 0, 0, Math.PI * 2);
    c.fill();
    if (!k.small)
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 + 0.4;
        const len = k.r * (0.75 + ((i * 37) % 10) / 30);
        for (let s = k.r * 0.3; s < len; s += 2) {
          const wob = ((s * 3 + i * 5) % 4) - 1.5;
          px(
            c,
            withAlpha(s < len * 0.6 ? C.fireLight : C.fire, glow * (1 - s / (len + 4))),
            Math.round(k.x + Math.cos(a) * s + wob * 0.5),
            Math.round(k.y + 2 + Math.sin(a) * s * 0.45),
            1,
            1,
          );
        }
      }
  }

  renderAir(c: CanvasRenderingContext2D, cast: SuperCast | null, ctx: SceneCtx) {
    const C = this.colors ?? meteorColors(ctx.theme, ctx.flair);
    const V = ctx.view;
    // 1) dunyo qorayadi; Sehrgar ustidan qayta chiziladi
    if (this.dim > 0.01) {
      c.fillStyle = `rgba(8,3,14,${0.45 * this.dim})`;
      c.fillRect(V.x, V.y, V.w, V.h);
      if (cast && ctx.drawOwner) ctx.drawOwner(c);
    }
    // 2) osmon darzi
    if (this.rift > 0.01) this.renderRift(c, C);
    // 3) toshga aylanganlar va ko'mir jasadlar
    for (const s of this.stones) this.renderStone(c, s, C);
    for (const k of this.corpses) this.renderCorpse(c, k);
    for (const d of this.dazed) {
      const live = d.t.live ?? d.t;
      this.orbitStars(c, live.x, live.y - d.t.size / 2 - 6, 4, d.t.size * 0.45, C);
    }
    // 4) tushayotgan meteorit
    if (cast?.stage === "strike" && !cast.landed) this.renderMeteor(c, cast, ctx, C);
    if (cast?.stage === "after")
      for (const d of cast.rain) {
        const k = 1 - (d.at - cast.t) / 0.22;
        if (d.done || k <= 0) continue;
        const ox = d.x - 50,
          oy = V.y - 10;
        const e = clamp01(k) ** 2;
        this.rock(c, ox + (d.x - ox) * e, oy + (d.y - 4 - oy) * e, 4, C, true);
      }
    // 5) zarba to'lqinlari
    for (const s of this.shocks) {
      if (s.age < 0) continue;
      const k = s.age / s.max;
      const r = s.r * easeOut(k);
      const a = 1 - k;
      c.strokeStyle = withAlpha(C.fireLight, 0.9 * a);
      c.lineWidth = Math.max(1, Math.round(4 * a));
      c.beginPath();
      c.ellipse(s.x, s.y, r, r * 0.45, 0, 0, Math.PI * 2);
      c.stroke();
      c.strokeStyle = withAlpha(C.rune, 0.6 * a);
      c.lineWidth = 1;
      c.beginPath();
      c.ellipse(s.x, s.y, r * 0.86, r * 0.39, 0, 0, Math.PI * 2);
      c.stroke();
    }
    // 6) tosh bo'laklari va cho'g'lar
    for (const r of this.rocks) {
      const a = clamp01(r.life / 0.25);
      px(c, withAlpha(r.col, a), Math.round(r.x), Math.round(r.y - r.z), r.size, r.size);
    }
    for (const e of this.embers) {
      const a = clamp01(e.life / e.max);
      px(c, withAlpha(e.hot ? C.fireLight : C.fire, a), Math.round(e.x), Math.round(e.y), 1, 1);
    }
    // 7) oq chaqnash
    if (this.flash > 0.01 && !ctx.reduced) {
      c.fillStyle = withAlpha(C.core, Math.min(0.85, this.flash));
      c.fillRect(V.x, V.y, V.w, V.h);
    }
  }

  /** Osmon darzi: binafsha tashqi nur, olovli ichki yoriq, oq yadro */
  private renderRift(c: CanvasRenderingContext2D, C: MeteorColors) {
    const o = this.rift;
    const pts = this.riftPts;
    const pulse = 0.85 + 0.15 * Math.sin(this.t * 20);
    const layers: [string, number, number][] = [
      [C.riftOuter, 15 * o, 0.9],
      [C.riftMid, 10 * o, 0.95],
      [C.rune, 3.5 * o, 0.9],
      [C.runeLight, 1.2 * o, 0.9],
    ];
    for (const [col, w, a] of layers) {
      if (w < 0.6) continue;
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i]!,
          p1 = pts[i + 1]!;
        // o'rtasi qalinroq, uchlari ingichka
        const mid = 1 - Math.abs(i + 0.5 - (pts.length - 1) / 2) / (pts.length / 2);
        const ww = Math.max(1, Math.round(w * (0.4 + 0.6 * mid)));
        const steps = Math.ceil(Math.abs(p1.x - p0.x));
        for (let s = 0; s <= steps; s++) {
          const k = s / Math.max(1, steps);
          const x = p0.x + (p1.x - p0.x) * k,
            y = p0.y + (p1.y - p0.y) * k;
          px(
            c,
            withAlpha(col, a * pulse * Math.min(1, o * 1.5)),
            Math.round(x),
            Math.round(y - ww / 2),
            1,
            ww,
          );
        }
      }
    }
    // darzdan pastga tushgan xira nur
    if (o > 0.4 && pts.length) {
      const mid = pts[Math.floor(pts.length / 2)]!;
      for (let y = 4; y < 46; y += 2)
        px(
          c,
          withAlpha(C.rune, 0.12 * o * (1 - y / 46)),
          Math.round(mid.x - 30 + y * 0.2),
          Math.round(mid.y + y),
          60,
          1,
        );
    }
  }

  /** Piksel meteorit: yorug'lik yuqori-chapdan, ichida eritilgan yoriqlar, atrofida olov */
  private rock(
    c: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    C: MeteorColors,
    small = false,
  ) {
    const R = Math.round(r);
    const cx = Math.round(x),
      cy = Math.round(y);
    // olov aurasi
    const flick = Math.sin(this.t * 40) > 0 ? 1 : 0;
    c.fillStyle = withAlpha(C.fire, 0.45);
    c.beginPath();
    c.arc(cx, cy, R + 3 + flick, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = withAlpha(C.fireLight, 0.5);
    c.beginPath();
    c.arc(cx + 1, cy + 1, R + 1, 0, Math.PI * 2);
    c.fill();
    for (let py = -R; py <= R; py++)
      for (let qx = -R; qx <= R; qx++) {
        const d2 = qx * qx + py * py;
        if (d2 > R * R) continue;
        const nx = qx / R,
          ny = py / R;
        const lum = -nx * 0.6 - ny * 0.6 + 0.3;
        // eritilgan yoriqlar: pastki-o'ng (olovga qaragan) tomonda
        const crack =
          Math.abs(Math.sin(qx * 0.8 + Math.cos(py * 0.7) * 2.2)) < 0.16 && nx + ny > -0.3;
        const col = crack
          ? small
            ? C.fire
            : C.fireLight
          : nx + ny > 0.9
            ? C.fire
            : lum > 0.55
              ? C.rock[2]
              : lum > 0.05
                ? C.rock[1]
                : C.rock[0];
        px(c, col, cx + qx, cy + py, 1, 1);
      }
    // oldingi (pastki-o'ng) chekkada oq-issiq qatlam
    for (let a = 0.1; a < 1.5; a += 0.12)
      px(c, C.core, Math.round(cx + Math.cos(a) * R), Math.round(cy + Math.sin(a) * R), 1, 1);
  }

  private renderMeteor(
    c: CanvasRenderingContext2D,
    cast: SuperCast,
    ctx: SceneCtx,
    C: MeteorColors,
  ) {
    const m = this.meteorPos(cast, ctx);
    // olov dumi: orqaga torayib boruvchi doiralar
    const tr = this.trail;
    for (let i = 0; i < tr.length; i++) {
      const p = tr[i]!;
      const k = (i + 1) / tr.length;
      const rr = m.r * (0.3 + 0.9 * k);
      // eski qismi qora tutun, meteoritga yaqini olov
      c.fillStyle = withAlpha(i < tr.length * 0.55 ? C.smoke : C.fire, 0.3 + 0.45 * k);
      c.beginPath();
      c.arc(p.x, p.y, rr, 0, Math.PI * 2);
      c.fill();
    }
    // uzun dum chizig'i (meteorit yo'nalishiga teskari)
    const len = 40 + 60 * m.k;
    for (let s = 0; s < len; s += 2) {
      const k = 1 - s / len;
      const w = Math.max(1, Math.round(m.r * 1.6 * k));
      const x = m.x - m.ux * s,
        y = m.y - m.uy * s;
      px(
        c,
        withAlpha(s < len * 0.2 ? C.fireLight : s < len * 0.45 ? C.fire : C.smoke, 0.6 * k),
        Math.round(x - w / 2),
        Math.round(y - w / 2),
        w,
        w,
      );
    }
    this.rock(c, m.x, m.y, m.r, C);
  }

  /** Toshga aylangan dushman: kulrang-qizg'ish qobiq va ustida aylanuvchi yulduzchalar */
  private renderStone(c: CanvasRenderingContext2D, s: Stone, C: MeteorColors) {
    const live = s.t.live ?? s.t;
    const sprite = s.t.sprite;
    // qotish paytida qobiq biroz "o'sadi" (pastdan yuqoriga qoplaydi)
    const grow = clamp01(s.age / 0.18);
    if (sprite) {
      const size = spriteSize(sprite);
      c.save();
      c.beginPath();
      c.rect(live.x - size, live.y + size / 2 - size * 2 * grow, size * 2, size * 2);
      c.clip();
      renderSprite(
        c,
        sprite,
        "idle",
        0,
        Math.round(live.x),
        Math.round(live.y),
        false,
        !!s.t.flip,
        false,
        STONE_PALETTE,
      );
      c.restore();
      // qobiqdagi yoriqchalar (cho'g' rangida)
      if (grow >= 1) {
        px(c, withAlpha(C.fire, 0.8), Math.round(live.x - 2), Math.round(live.y - 1), 1, 2);
        px(c, withAlpha(C.fire, 0.6), Math.round(live.x + 2), Math.round(live.y + 2), 2, 1);
      }
    }
    const left = s.t.hold?.() ?? 0;
    // oxirgi 0.4 s da qobiq titraydi (chatnash oldidan)
    if (left < 0.4 && left > 0 && Math.floor(this.t * 30) % 2)
      px(
        c,
        "rgba(255,255,255,0.5)",
        Math.round(live.x - 1),
        Math.round(live.y - s.t.size / 2),
        2,
        2,
      );
    this.orbitStars(c, live.x, live.y - s.t.size / 2 - 4, 3, Math.max(5, s.t.size * 0.45), C);
  }

  private orbitStars(
    c: CanvasRenderingContext2D,
    x: number,
    y: number,
    n: number,
    r: number,
    C: MeteorColors,
  ) {
    for (let i = 0; i < n; i++) {
      const a = this.t * 5 + (i / n) * Math.PI * 2;
      const sx = x + Math.cos(a) * r,
        sy = y + Math.sin(a) * r * 0.35;
      star(c, sx, sy, Math.sin(a) > 0 ? 1 : 0, i % 2 ? C.fireLight : C.runeLight);
    }
  }

  private renderCorpse(c: CanvasRenderingContext2D, k: Corpse) {
    const sprite = k.t.sprite;
    if (!sprite) return;
    const a = clamp01(1 - (k.age - ASH_TIME * 0.6) / (ASH_TIME * 0.4));
    c.save();
    c.globalAlpha = a;
    c.translate(Math.round(k.x), Math.round(k.y - k.z));
    c.rotate(Math.round(k.spin * k.age * 4) * (Math.PI / 8));
    renderSprite(c, sprite, "hurt", 0, 0, 0, k.age < 0.05, !!k.t.flip, false, ASH_PALETTE);
    c.restore();
  }
}

/** Portretdagi kristall (ko'tarilgan qo'lda) — chaqnash joyi */
const CARD_CRYSTAL = { x: 81, y: 12, low: { x: 77, y: 31 } } as const;
/** Kartadagi kadr almashinuvi: 0 — tayoq past, 1 — yuqorida, 2 — chaqnash */
const CARD_RAISE = 0.3;
const CARD_FLARE = 0.62;

/** Kartadagi kadr raqami (karta ulushi k) */
export function meteorCardFrame(k: number, reduced = false) {
  if (reduced) return k < CARD_RAISE ? 0 : 1;
  return k < CARD_RAISE ? 0 : k < CARD_FLARE ? 1 : 2;
}

/**
 * OSMON TOSHI kartasi: Sehrgar portreti — tayoq ko'tariladi, kristall yorishadi, so'ng ko'zlar va
 * kristall chaqnaydi (soqol va plash shamolda). Kristall ustida qo'shimcha nur yulduzchasi.
 */
export function renderMeteorCard(
  c: CanvasRenderingContext2D,
  def: SuperDef,
  cast: Pick<SuperCast, "t" | "cardTime">,
  T: SkinTheme,
  frames: readonly (HTMLCanvasElement | null)[],
  text: CardText,
  reduced = false,
  flair: string | null = null,
) {
  const k = cast.t / Math.max(0.01, cast.cardTime);
  const i = meteorCardFrame(k, reduced);
  const portrait = frames[i] ?? frames[0] ?? null;
  const C = meteorColors(T, flair);
  renderSuperCard(c, def, cast, T, portrait, text, reduced, (g, x, y, size, kk) => {
    const s = size / MAGE_PORTRAIT_GRID;
    const raised = meteorCardFrame(kk, reduced) > 0;
    const p = raised ? CARD_CRYSTAL : CARD_CRYSTAL.low;
    const fk = (kk - CARD_FLARE) / (1 - CARD_FLARE);
    const a = reduced ? 0.4 : fk > 0 ? Math.sin(Math.min(1, fk) * Math.PI) : 0.25;
    star(
      g,
      x + (p.x + 0.5) * s,
      y + (p.y + 0.5) * s,
      2 + 8 * a,
      withAlpha(C.runeLight, Math.min(1, a + 0.2)),
    );
    if (a > 0.3)
      star(g, x + (p.x + 0.5) * s, y + (p.y + 0.5) * s, 1 + 4 * a, withAlpha(C.fireLight, a));
  });
}
