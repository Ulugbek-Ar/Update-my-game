/**
 * PIXELFX EFFEKTLARI — faqat ko'rinish. pixelfx (src/vendor/pixelfx, patch-gg, MIT) dan tanlangan
 * effektlar: zarba uchqunlari, moblar o'limi (poof / parchalanish / ruh ko'tarilishi), tanga va
 * yurak terilishi, sandiq ochilishi, kuch kartasi tanlanishi, bosslarning paydo bo'lishi, fazaga
 * o'tishi va o'limi. combatFx.ts, cutsFx.ts va boshqa mavjud effektlar o'zgarmaydi — bular ustiga.
 *
 * Qoidalar:
 * - Hit-stop va ekran silkinishi YO'Q (pixelfx `createAct` / moves ishlatilmaydi).
 * - O'yin holati o'zgarmaydi: dushman/boss koordinatalari faqat o'qiladi. "Orqaga uchish" (o'lim
 *   bo'laklari zarbadan nari uchadi) faqat effekt ichida — dushman o'z joyida qoladi.
 * - Math.random yo'q: effekt urug'i hisoblagichdan (o'yin tasodifiga ta'sir qilmaydi).
 * - Telefon tezligi: har effektning o'z kichik offscreen canvas'i; bufer faqat effekt yangilangan
 *   kadrda qayta yig'iladi (putImageData), so'ng drawImage. Faol effekt bo'lmasa — hech narsa
 *   qilinmaydi. Effektlar soni chegaralangan; "Effektlarni kamaytirish"da kam va xira.
 * - Ranglar: qahramon effektlari (zarba, krit, karta) — skin theme'idan; qolganlari o'yin
 *   palitrasidan (moblarning o'z rangi, oltin, yurak). Xavf ranglari (danger.ts) ishlatilmaydi.
 */
import {
  FX,
  clearFrame,
  composite,
  createFrame,
  createFx,
  type FxActor,
  type FxFrame,
  type FxInstance,
  type FxName,
} from "../vendor/pixelfx/index.js";
import type { SkinTheme } from "./skinFx";
import { PALETTES, spritePixels, spriteSize, type SpriteKind } from "./sprites";

export type PfxKind =
  | "hit"
  | "crit"
  | "poof"
  | "shatter"
  | "soul"
  | "coin"
  | "heart"
  | "chest"
  | "chestRays"
  | "card"
  | "bossSpawn"
  | "bossPhase"
  | "bossDeath";

/** Bir vaqtda jami effektlar: oddiy / kamaytirilgan */
export const PFX_MAX = 10;
export const PFX_MAX_REDUCED = 4;
/** Har turdan bir vaqtda nechta (oshsa — eng eskisi ketadi); 0 — kamaytirilganda chiqmaydi */
const CAP: Record<PfxKind, [number, number]> = {
  hit: [3, 0],
  crit: [2, 1],
  poof: [4, 2],
  shatter: [2, 1],
  soul: [2, 1],
  coin: [3, 1],
  heart: [2, 1],
  chest: [1, 1],
  chestRays: [1, 0],
  card: [1, 1],
  bossSpawn: [1, 1],
  bossPhase: [1, 1],
  bossDeath: [1, 1],
};
/** Bosslar effekti joy bo'lmasa ham chiqadi (eng past ustuvorlikdagisi o'rnini bo'shatadi) */
const PRIORITY: Record<PfxKind, number> = {
  hit: 0,
  crit: 1,
  poof: 1,
  coin: 1,
  heart: 1,
  shatter: 2,
  soul: 2,
  chest: 2,
  chestRays: 2,
  card: 2,
  bossSpawn: 3,
  bossPhase: 3,
  bossDeath: 3,
};
/** Polda chiziladiganlar (personajlar ostida) */
const GROUND: ReadonlySet<PfxKind> = new Set(["bossSpawn", "chestRays"]);

const WHITE = "#ffffff";
const INK = "#14121c";

/** "#rrggbb" ikki rang orasida */
export function mixHex(a: string, b: string, k: number) {
  const pa = parseInt(a.slice(1, 7), 16),
    pb = parseInt(b.slice(1, 7), 16);
  const ch = (s: number) =>
    Math.round(((pa >> s) & 255) + (((pb >> s) & 255) - ((pa >> s) & 255)) * k);
  return "#" + [16, 8, 0].map((s) => ch(s).toString(16).padStart(2, "0")).join("");
}

/** Bitta rangdan to'qdan oqqacha n pog'onali rang qatori (o'rtada — rangning o'zi) */
export function ramp(base: string, n: number) {
  const out: string[] = [];
  const mid = Math.floor((n - 1) / 2);
  for (let i = 0; i < n; i++)
    out.push(
      i <= mid
        ? mixHex(INK, base, 0.35 + (0.65 * i) / Math.max(1, mid))
        : mixHex(base, WHITE, (i - mid) / (n - 1 - mid)),
    );
  return out;
}

/** Qahramon effektlari ranglari — skin theme'idan (danger.ts dan uzoqligi skinFx.test'da) */
export function heroPalette(t: SkinTheme) {
  return [t.ink, t.accentDark, t.hot, t.spark, t.edge, t.glint, WHITE];
}

/** O'yin palitrasidagi ranglar (tanga — "+N" oltini, yurak — HUD yuragi) */
export const GOLD = [
  "#2a1c08",
  "#6b4a12",
  "#a8761c",
  "#e0a82a",
  "#ffcc33",
  "#ffe58a",
  "#fff6cf",
  WHITE,
];
export const HEART = [
  "#2a0a14",
  "#5e1428",
  "#8a1f45",
  "#e0405e",
  "#ff6f8c",
  "#ffa8ba",
  "#ffe0e7",
  WHITE,
];
/** Poof: kulrang-binafsha bulut va oltin yulduzchalar (pixelfx'ning o'zi) */
const POOF_SMOKE = ["#2a2440", "#5e5878", "#9a94b4", "#cdc8e0", "#f2f0fa", WHITE];
const POOF_STARS = ["#ffd84a", "#fff3a6", WHITE];
/** Boss paydo bo'lishi: binafsha yoriq (DANGER.spawn — qizil, adashmaydi) */
export const PORTAL = [
  "#12081f",
  "#2a0f4d",
  "#481b8c",
  "#7330d0",
  "#a35cff",
  "#cf9bff",
  "#f1dcff",
  WHITE,
];
/** Boss fazasi: oq-binafsha chaqmoq */
export const PHASE_BOLT = [
  "#1a1030",
  "#3c2470",
  "#6a48c0",
  "#9c7cf0",
  "#c8b4ff",
  "#ece4ff",
  WHITE,
  WHITE,
];
export const PHASE_SPARK = ["#4a3a80", "#9c7cf0", "#e4dcff", WHITE];
/** Boss o'limi: oq-oltin nur (tanga rangiga yaqin — mukofot) */
export const BOSS_DEATH = ["#1c1408", "#4a3a1c", "#8a7440", "#d8c07a", "#fff0b8", "#fffaf0", WHITE];
export const BOSS_DEATH_ACCENT = ["#2a1c08", "#6b5a2a", "#c8b070", "#f4e6b8", "#fffdf4"];

/** O'lim turi: kichik moblarda poof, kattalarda parchalanish, ruhlilarda ruh ko'tarilishi */
export type DeathStyle = "poof" | "shatter" | "soul";

interface Live {
  kind: PfxKind;
  fx: FxInstance;
  frame: FxFrame;
  canvas: HTMLCanvasElement | null;
  img: ImageData | null;
  /** Effekt boshi (origin) xonada */
  x: number;
  y: number;
  /** Bufer chap-yuqori burchagining origin'dan siljishi */
  ax: number;
  ay: number;
  speed: number;
  /** Shuncha vaqtdan keyin stop() (loop effektlar uchun), Infinity — o'zi tugaydi */
  stopIn: number;
  dirty: boolean;
  lightK: number;
}

interface SpawnOpts {
  scale?: number;
  speed?: number;
  /** Boshida shuncha soniya o'tkazib yuboriladi (effektning bizda kerak bo'lmagan qismi) */
  skip?: number;
  stopIn?: number;
  opts?: Record<string, unknown>;
}

/** Sprayt niqobi keshi: tur + yo'nalish */
const actorCache = new Map<string, { actor: FxActor; feet: number } | null>();

/**
 * Mob sprayti (o'lim kadri 0) — effekt "tanasi": chizilgan o'lchamda (spriteSize), o'z ranglarida.
 * feet — sprayt markazidan oyoqqacha (px). Brauzersiz (sinov) ham ishlaydi — faqat massivlar.
 */
export function spriteActor(kind: SpriteKind, flip: boolean) {
  const key = `${kind}:${flip ? 1 : 0}`;
  if (actorCache.has(key)) return actorCache.get(key) ?? null;
  const data = spritePixels(kind, "death", 0) as ArrayLike<number>;
  const n = Math.round(Math.sqrt(data.length));
  const S = spriteSize(kind);
  const colors = PALETTES[kind];
  let top = S,
    bottom = -1;
  const at = (X: number, Y: number) => {
    const gx = Math.floor(((flip ? S - 1 - X : X) * n) / S),
      gy = Math.floor((Y * n) / S);
    return data[gy * n + gx] ?? 0;
  };
  for (let Y = 0; Y < S; Y++)
    for (let X = 0; X < S; X++)
      if (at(X, Y)) {
        if (Y < top) top = Y;
        bottom = Y;
      }
  if (bottom < 0) {
    actorCache.set(key, null);
    return null;
  }
  const h = bottom - top + 1;
  const mask = new Uint8Array(S * h);
  const pixels: (string | null)[] = new Array(S * h).fill(null);
  for (let Y = top; Y <= bottom; Y++)
    for (let X = 0; X < S; X++) {
      const c = at(X, Y);
      if (!c) continue;
      const i = (Y - top) * S + X;
      mask[i] = 1;
      pixels[i] = colors[c - 1] ?? colors[0] ?? INK;
    }
  const out = {
    actor: { mask: { w: S, h, data: mask }, pixels, x: -S / 2, y: -h },
    feet: bottom + 1 - S / 2,
  };
  actorCache.set(key, out);
  return out;
}

export class PixelFx {
  lives: Live[] = [];
  /** Effekt urug'i: hisoblagich (Math.random emas) */
  private seed = 1;
  private pool = new Map<string, { canvas: HTMLCanvasElement; img: ImageData }[]>();

  get active() {
    return this.lives.length > 0;
  }

  clear() {
    for (const l of this.lives) this.release(l);
    this.lives.length = 0;
  }

  /** Effekt qo'shish (chegaralar bilan). Qaytaradi: qo'shildimi. */
  spawn(
    kind: PfxKind,
    name: FxName,
    x: number,
    y: number,
    reduced: boolean,
    o: SpawnOpts = {},
  ): boolean {
    const cap = CAP[kind][reduced ? 1 : 0];
    if (cap <= 0) return false;
    const same = this.lives.filter((l) => l.kind === kind);
    if (same.length >= cap) this.remove(same[0]!);
    const max = reduced ? PFX_MAX_REDUCED : PFX_MAX;
    if (this.lives.length >= max) {
      // joy yo'q: o'zidan past ustuvorlikdagi eng eskisi ketadi, bo'lmasa — yangisi chiqmaydi
      const low = this.lives.find((l) => PRIORITY[l.kind] < PRIORITY[kind]);
      if (!low) return false;
      this.remove(low);
    }
    const mod = FX[name];
    const k = o.scale ?? 1;
    const [w0, h0] = mod.meta.size;
    const [ox0, oy0] = mod.meta.origin;
    const ax = Math.ceil(ox0 * k) + 1,
      ay = Math.ceil(oy0 * k) + 1;
    const w = Math.ceil(w0 * k) + 2,
      h = Math.ceil(h0 * k) + 2;
    const fx = createFx(mod, { ...o.opts, x: 0, y: 0, scale: k, seed: this.seed++ });
    if (o.skip) fx.update(o.skip);
    const live: Live = {
      kind,
      fx,
      frame: createFrame(w, h, -ax, -ay),
      canvas: null,
      img: null,
      x: Math.round(x),
      y: Math.round(y),
      ax,
      ay,
      speed: o.speed ?? 1,
      stopIn: o.stopIn ?? Infinity,
      dirty: true,
      lightK: reduced ? 0.6 : 1,
    };
    this.lives.push(live);
    return true;
  }

  update(dt: number) {
    if (!this.lives.length) return;
    for (const l of this.lives) {
      const step = dt * l.speed;
      l.fx.update(step);
      l.dirty = true;
      if (l.stopIn !== Infinity) {
        l.stopIn -= step;
        if (l.stopIn <= 0) {
          l.fx.stop();
          l.stopIn = Infinity;
        }
      }
    }
    for (const l of this.lives) if (l.fx.done()) this.release(l);
    this.lives = this.lives.filter((l) => !l.fx.done());
  }

  /** Personajlar ostidagi effektlar (boss yorig'i, sandiq nurlari) */
  renderGround(c: CanvasRenderingContext2D) {
    if (this.lives.length) this.draw(c, true);
  }

  /** Personajlar ustidagi effektlar */
  renderAir(c: CanvasRenderingContext2D) {
    if (this.lives.length) this.draw(c, false);
  }

  private draw(c: CanvasRenderingContext2D, ground: boolean) {
    for (const l of this.lives) {
      if (GROUND.has(l.kind) !== ground) continue;
      if (!l.canvas && !this.acquire(l)) continue;
      if (l.dirty) {
        // bufer faqat effekt yangilangan kadrda qayta yig'iladi (pauzada — yo'q)
        clearFrame(l.frame);
        l.fx.draw(l.frame);
        composite(l.frame, l.img!.data, null, l.lightK);
        l.canvas!.getContext("2d")?.putImageData(l.img!, 0, 0);
        l.dirty = false;
      }
      c.drawImage(l.canvas!, l.x - l.ax, l.y - l.ay);
    }
  }

  /** Offscreen canvas (o'lchami bo'yicha qayta ishlatiladi) */
  private acquire(l: Live) {
    const key = `${l.frame.w}x${l.frame.h}`;
    const free = this.pool.get(key)?.pop();
    if (free) {
      l.canvas = free.canvas;
      l.img = free.img;
      return true;
    }
    if (typeof document === "undefined") return false;
    const canvas = document.createElement("canvas");
    canvas.width = l.frame.w;
    canvas.height = l.frame.h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;
    l.canvas = canvas;
    l.img = ctx.createImageData(l.frame.w, l.frame.h);
    return true;
  }

  private release(l: Live) {
    if (!l.canvas || !l.img) return;
    const key = `${l.frame.w}x${l.frame.h}`;
    let list = this.pool.get(key);
    if (!list) this.pool.set(key, (list = []));
    if (list.length < 4) list.push({ canvas: l.canvas, img: l.img });
    l.canvas = null;
    l.img = null;
  }

  private remove(l: Live) {
    this.release(l);
    this.lives = this.lives.filter((q) => q !== l);
  }

  // ---- o'yin hodisalari

  /** Zarba nuqtasida uchqun; aim — zarba yo'nalishi (rad). Kritikda — kattaroq yulduz. */
  hit(x: number, y: number, aim: number, crit: boolean, theme: SkinTheme, reduced: boolean) {
    const palette = heroPalette(theme);
    if (crit)
      this.spawn("crit", "critHit", x, y, reduced, {
        scale: 0.42,
        speed: 1.15,
        opts: { palette: [...palette, WHITE], height: 0, aim },
      });
    else
      this.spawn("hit", "hitSpark", x, y, reduced, {
        scale: 0.46,
        opts: { palette, height: 0, aim },
      });
  }

  /**
   * Mob o'limi. (x, y) — sprayt markazi (Enemy.spriteY), sprite/flip — tanasi uchun; dir — zarba
   * yo'nalishi (+1 o'ngga): bo'laklar va ruh zarbadan nari "uchadi" — faqat effekt ichida.
   */
  death(
    style: DeathStyle,
    sprite: SpriteKind,
    flip: boolean,
    x: number,
    y: number,
    color: string,
    dir: number,
    reduced: boolean,
  ) {
    // katta/ruhli mob: tana effekti; joy yo'q bo'lsa yoki sprayt bo'sh bo'lsa — oddiy poof
    if (style !== "poof" && this.spawnBody(style, sprite, flip, x, y, color, dir, reduced)) return;
    this.spawn("poof", "poof", x, y + 6, reduced, {
      scale: 0.42,
      speed: 1.3,
      opts: { palette: POOF_SMOKE, stars: POOF_STARS },
    });
  }

  private spawnBody(
    style: DeathStyle,
    sprite: SpriteKind,
    flip: boolean,
    x: number,
    y: number,
    color: string,
    dir: number,
    reduced: boolean,
  ) {
    const a = spriteActor(sprite, flip);
    if (!a) return false;
    const fy = Math.round(y) + a.feet;
    const palette = ramp(color, 8);
    if (style === "shatter")
      // tana o'z piksellarida boshdan pastga to'zg'iydi; chaqnash bosqichi o'tkaziladi (o'yinning o'z
      // o'lim kadri bor) — effekt oq chaqnashdan keyin boshlanadi
      return this.spawn("shatter", "disintegrate", x, fy, reduced, {
        skip: 0.42,
        speed: 1.7,
        opts: {
          actor: a.actor,
          palette,
          accent: [palette[5], palette[6], WHITE],
          wind: dir < 0 ? -1 : 1,
        },
      });
    return this.spawn("soul", "soulRise", x, fy, reduced, {
      speed: 1.55,
      opts: { actor: a.actor, palette: ramp(color, 7), height: 26 },
    });
  }

  /** Tanga yoki yurak terildi */
  pickup(kind: "coin" | "heart", x: number, y: number, reduced: boolean) {
    // collect-burst markazi originidan 30 px yuqorida
    const scale = 0.34;
    this.spawn(kind, "collectBurst", x, y + 30 * scale, reduced, {
      scale,
      speed: 1.2,
      opts: { palette: kind === "coin" ? GOLD : HEART },
    });
  }

  /** Sandiq ochildi: orqada aylanuvchi oltin nurlar va oltin chaqnash */
  chest(x: number, y: number, reduced: boolean) {
    this.spawn("chestRays", "sunburst", x, y - 6, reduced, {
      scale: 0.55,
      stopIn: 1.1,
      opts: { palette: GOLD.slice(1), rays: 8 },
    });
    this.spawn("chest", "collectBurst", x, y - 6 + 30 * 0.6, reduced, {
      scale: 0.6,
      opts: { palette: GOLD },
    });
  }

  /** Kuch kartasi tanlandi: qahramon ustida skin rangidagi kuch portlashi */
  card(x: number, y: number, theme: SkinTheme, reduced: boolean) {
    const palette = heroPalette(theme);
    this.spawn("card", "manaBurst", x, y + 8, reduced, {
      scale: 0.4,
      speed: 1.2,
      opts: { palette: [palette[0], ...palette] },
    });
  }

  /** Boss paydo bo'lmoqda (kirish sahnasi): polda yoriq ochilib, ichidan ruhlar chiqadi */
  bossSpawn(x: number, y: number, reduced: boolean) {
    this.spawn("bossSpawn", "spawnPortal", x, y, reduced, {
      scale: 0.75,
      speed: 1.25,
      opts: { palette: PORTAL, width: 40 },
    });
  }

  /** Boss keyingi fazaga o'tdi: atrofida chaqmoq va zarb halqasi (o'yinchiga zarar yo'q) */
  bossPhase(x: number, y: number, reduced: boolean) {
    this.spawn("bossPhase", "thunderclap", x, y, reduced, {
      scale: 0.6,
      speed: 1.1,
      opts: { palette: PHASE_BOLT, sparks: PHASE_SPARK, reach: 80 },
    });
  }

  /** Boss yengildi: oq-oltin nur portlashi */
  bossDeath(x: number, y: number, reduced: boolean) {
    this.spawn("bossDeath", "plasmaExplosion", x, y + 30, reduced, {
      scale: 0.8,
      speed: 0.9,
      opts: { palette: BOSS_DEATH, accent: BOSS_DEATH_ACCENT },
    });
  }
}
