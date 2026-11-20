/**
 * SUPER SAHNASI — bitta superning ko'rinishi (faqat chizish va zarrachalar; zarar va vaqt — super.ts
 * va uning egasi Game / onlayn klient). Har super `SuperDef.fx` nomi bilan o'z sahnasini tanlaydi;
 * sahnasi hali yozilmagan super PlainScene bilan ishlaydi (oddiy chaqnash va uchqunlar).
 *
 * Egasi sahnani voqealar bilan boshqaradi:
 *   stage(...)  — bosqich boshlandi (tayyorlanish / zarba / oqibat)
 *   mark(...)   — nishon ustida belgi chaqnadi
 *   hit(...)    — zarba tushdi (true qaytarsa — o'lgan mobni sahna o'zi ko'rsatadi)
 *   update / renderGround / renderAir — har kadr
 * Super tugagach ham sahna `alive` bo'lguncha chiziladi (nur so'nadi, chang tarqaladi).
 *
 * YANGI SUPER SAHNASI: shu interfeysni bajaradigan klass + SUPER_SCENES ga yozuv.
 */
import { ROOM, px } from "./animation";
import type { Effects } from "./effects";
import { withAlpha } from "./hero";
import type { SkinTheme } from "./skinFx";
import type { SpriteKind, SpritePalette } from "./sprites";
import type { SuperCast, SuperStage } from "./super";
import { DivineScene } from "./divineFx";
import { CutsScene } from "./cutsFx";
import { HorizonScene } from "./horizonFx";
import { MeteorScene } from "./meteorFx";
import { ArrowScene } from "./arrowsFx";
import { FrenzyScene } from "./frenzyFx";

/** Sahna har kadr oladigan muhit: egasi (o'yinchi) joyi, skin ranglari, zarrachalar */
export interface SceneCtx {
  /** Super egasining joyi va qarash tomoni (1 — o'ngga, −1 — chapga) */
  x: number;
  y: number;
  dir: number;
  theme: SkinTheme;
  /** "Effektlarni kamaytirish": miltillash, silkinish va zarrachalar kam */
  reduced: boolean;
  /** Umumiy zarrachalar (chegarasi bor — effects.ts: MAX_PARTICLES) */
  fx: Effects;
  /** Ekran silkinishi */
  shake(v: number): void;
  /**
   * Super egasini qayta chizish: yorqin effekt (nur ustuni) ustidan qahramon aniq ko'rinib tursin.
   * Bo'lmasa — sahna egasini qayta chizmaydi.
   */
  drawOwner?: (c: CanvasRenderingContext2D) => void;
  /** Ko'rinadigan hudud (xonada 0,0,320,240; ochiq olamda — kamera) */
  view: { x: number; y: number; w: number; h: number };
  /**
   * Afsonaviy skin bezagi (skinFx.ts: FlairKind) — "moon" (Qizil oy): kesiklar qizil yarim oy;
   * "frost" (Muz Ritsar): UFQ KESIMI ortida muz kristallari
   */
  flair?: string | null;
  /**
   * Super shari ranglari (oddiy skinda — superning o'z suyuqligi, skin bilan — skin theme'i):
   * CHEKSIZ O'Q qizigan quroli shu ranglarda.
   */
  orb?: { accent: string; accentDark: string; glow: string };
}

/** Zarba nishoni haqida sahnaga beriladigan ma'lumot */
export interface SceneTarget {
  x: number;
  y: number;
  size: number;
  /** Nishonning o'zi (bir xil nishonni tanish uchun) va jonli joyi (belgi va pufakcha unga ergashadi) */
  ref?: object;
  live?: { x: number; y: number };
  /** O'lgan mobni yerga yopishtirib ko'rsatish uchun (bo'lmasa — sahna jasadni chizmaydi) */
  sprite?: SpriteKind;
  flip?: boolean;
  palette?: SpritePalette;
  /**
   * Nishon qotib turgan qolgan vaqt (OSMON TOSHI: toshda qotgan dushman) — sahna qobiqni shu vaqt
   * > 0 ekan chizadi. Yo'q — qotish ko'rsatilmaydi.
   */
  hold?: () => number;
}

export interface SuperScene {
  /** Sahnada hali chiziladigan narsa bor */
  readonly alive: boolean;
  stage(s: SuperStage, cast: SuperCast, ctx: SceneCtx): void;
  mark(t: SceneTarget, boss: boolean, cast: SuperCast, ctx: SceneCtx): void;
  /** Zarba tushdi. killed — nishon o'ldi. true — jasadni sahna o'zi ko'rsatadi (egasi mobni olib tashlaydi) */
  hit(t: SceneTarget, boss: boolean, killed: boolean, cast: SuperCast, ctx: SceneCtx): boolean;
  /** "HI?" hazili: shu nishon zarbadan oldin tepaga qarab pufakcha chiqaradi */
  gawk?(t: SceneTarget): void;
  /** Egasining super pozasi: "attack" holatining kadri (null — oddiy ko'rinish) */
  pose(cast: SuperCast): number | null;
  /** Egasi hozir ko'rinmaydi (MING KESIM zarbasi: Samuray ko'zdan yo'qoladi) */
  hidden?(cast: SuperCast): boolean;
  /** CHEKSIZ O'Q: o'yinchi o'q uzdi — gilza otilib chiqadi */
  shot?(ctx: SceneCtx): void;
  /** SuperDef.release lahzasi: zarbalar birdan tushishidan OLDIN chaqiriladi ("chik") */
  release?(cast: SuperCast, ctx: SceneCtx): void;
  update(dt: number, cast: SuperCast | null, ctx: SceneCtx): void;
  /** Personajlardan oldin: yerdagi belgilar va halqalar */
  renderGround(c: CanvasRenderingContext2D, cast: SuperCast | null, ctx: SceneCtx): void;
  /** Personajlar ustidan: qorayish, nurlar, pufakcha */
  renderAir(c: CanvasRenderingContext2D, cast: SuperCast | null, ctx: SceneCtx): void;
}

interface Flash {
  x: number;
  y: number;
  life: number;
  max: number;
  big: boolean;
}

/**
 * Oddiy sahna (o'z sahnasi yo'q super uchun): nishon ustida halqa, zarbada yorug' ustun va
 * uchqunlar. Jasadni o'zi ko'rsatmaydi — mob odatdagidek o'ladi.
 */
export class PlainScene implements SuperScene {
  private marks: Flash[] = [];
  private flashes: Flash[] = [];
  private dim = 0;

  get alive() {
    return this.marks.length > 0 || this.flashes.length > 0 || this.dim > 0.01;
  }

  stage() {}

  mark(t: SceneTarget, boss: boolean) {
    this.marks.push({ x: t.x, y: t.y - t.size / 2 - 6, life: 0.2, max: 0.2, big: boss });
  }

  hit(t: SceneTarget, boss: boolean, _killed: boolean, _cast: SuperCast, ctx: SceneCtx) {
    this.flashes.push({ x: t.x, y: t.y, life: 0.25, max: 0.25, big: boss });
    ctx.fx.burst(t.x, t.y, ctx.theme.glow, boss ? 16 : 8, 90, 2);
    ctx.shake(boss ? 0.3 : 0.1);
    return false;
  }

  pose() {
    return null;
  }

  update(dt: number, cast: SuperCast | null) {
    for (const m of this.marks) m.life -= dt;
    for (const f of this.flashes) f.life -= dt;
    this.marks = this.marks.filter((m) => m.life > 0);
    this.flashes = this.flashes.filter((f) => f.life > 0);
    const want = cast && cast.stage !== "card" && cast.stage !== "after" ? 1 : 0;
    this.dim += (want - this.dim) * Math.min(1, dt * 6);
  }

  renderGround() {}

  renderAir(c: CanvasRenderingContext2D, _cast: SuperCast | null, ctx: SceneCtx) {
    const T = ctx.theme;
    if (this.dim > 0.01) px(c, `rgba(4,2,10,${0.4 * this.dim})`, 0, 0, ROOM.w, ROOM.h);
    for (const m of this.marks) {
      const k = m.life / m.max;
      c.strokeStyle = withAlpha(T.glow, k);
      c.lineWidth = 1;
      c.beginPath();
      c.arc(m.x, m.y, (m.big ? 9 : 5) * (1.4 - k * 0.4), 0, Math.PI * 2);
      c.stroke();
    }
    for (const f of this.flashes) {
      const k = f.life / f.max;
      const w = (f.big ? 14 : 6) * k;
      px(
        c,
        withAlpha(T.glow, 0.7 * k),
        f.x - w / 2,
        ctx.view.y,
        Math.max(1, Math.round(w)),
        f.y - ctx.view.y + 6,
      );
      px(c, withAlpha(T.edge, 0.9 * k), f.x - 1, ctx.view.y, 2, f.y - ctx.view.y + 6);
    }
  }
}

/** Sahnalar: SuperDef.fx nomi → sahna yaratuvchi */
export const SUPER_SCENES: Record<string, () => SuperScene> = {
  divine: () => new DivineScene(),
  cuts: () => new CutsScene(),
  horizon: () => new HorizonScene(),
  meteor: () => new MeteorScene(),
  arrows: () => new ArrowScene(),
  frenzy: () => new FrenzyScene(),
};

/** Super sahnasi (o'z sahnasi yo'q bo'lsa — oddiy) */
export function sceneFor(fx: string): SuperScene {
  return (SUPER_SCENES[fx] ?? (() => new PlainScene()))();
}
