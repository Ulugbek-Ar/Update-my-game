/**
 * CHEKSIZ O'Q sahnasi (Mergan superi) — faqat ko'rinish; tez otish mantiqi — player.ts (frenzy) va
 * Game (super bosqichlari).
 *
 * Tayyorlanish: ekran biroz qorayadi, Mergan to'pponchani tepaga ko'tarib barabanni aylantiradi —
 * boshi ustida ∞ belgisi kattalashib chaqnaydi. Tez otish: ∞ kichrayib bosh ustida turadi, quroli
 * qizib boradi (super shari ranglari: to'q → yorqin), ustidan issiq havo titraydi; har o'qdan mis
 * gilza otilib yerga sakraydi. Oqibat: hamma gilza "puf" bo'lib tutunga aylanadi, ∞ so'nadi.
 * Ranglar — skin theme'idan (qizish — super shari ranglaridan); "Effektlarni kamaytirish": gilza
 * kam, titrash va miltillash yo'q.
 */
import { ROOM, px } from "./animation";
import { withAlpha } from "./hero";
import { GUNNER_SUPER_FRAME } from "./sprites";
import type { SceneCtx, SuperScene } from "./superScene";
import type { SuperCast, SuperStage } from "./super";

interface Shell {
  x: number;
  /** Yer sathi (y) va undan balandlik (z) */
  y: number;
  z: number;
  vx: number;
  vz: number;
  rest: boolean;
}

interface Puff {
  x: number;
  y: number;
  life: number;
}

const PUFF_TIME = 0.45;
const INF = [".XXX...XXX.", "X...X.X...X", "X....X....X", "X...X.X...X", ".XXX...XXX."];

/** Ikki rang aralashmasi (#rrggbb), k — b ulushi */
export function mixHex(a: string, b: string, k: number) {
  const n = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16) || 0;
  const t = Math.max(0, Math.min(1, k));
  return `#${[0, 1, 2]
    .map((i) =>
      Math.round(n(a, i) + (n(b, i) - n(a, i)) * t)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

/** Qurol qizishi rangi: 0 — to'q, 0.5 — asosiy, 1 — eng yorqin (super shari ranglaridan) */
export function heatColor(orb: { accent: string; accentDark: string; glow: string }, k: number) {
  return k < 0.5
    ? mixHex(orb.accentDark, orb.accent, k * 2)
    : mixHex(orb.accent, orb.glow, k * 2 - 1);
}

export class FrenzyScene implements SuperScene {
  shells: Shell[] = [];
  puffs: Puff[] = [];
  /** ∞ belgisi ko'rinishi va qurol qizishi (0..1) */
  inf = 0;
  heat = 0;
  private dim = 0;
  private time = 0;
  private max = 28;
  private maxReduced = 6;
  private count = 0;
  private infOn = false;

  get alive() {
    return (
      this.shells.length > 0 ||
      this.puffs.length > 0 ||
      this.inf > 0.01 ||
      this.heat > 0.01 ||
      this.dim > 0.01
    );
  }

  stage(s: SuperStage, cast: SuperCast, ctx: SceneCtx) {
    this.max = cast.def.params["shells"] ?? this.max;
    this.maxReduced = cast.def.params["shellsReduced"] ?? this.maxReduced;
    if (s === "prep") this.infOn = true;
    if (s === "strike") {
      ctx.fx.burst(ctx.x, ctx.y - 20, (ctx.orb ?? ctx.theme).glow, ctx.reduced ? 4 : 10, 70, 1);
      ctx.shake(0.06);
    }
    if (s === "after") {
      // gilzalar "puf" bo'lib tutunga aylanadi
      for (const sh of this.shells) this.puff(sh.x, sh.y - sh.z, ctx);
      this.shells = [];
      this.infOn = false;
    }
  }

  private puff(x: number, y: number, ctx: SceneCtx) {
    this.puffs.push({ x, y, life: PUFF_TIME });
    if (!ctx.reduced) ctx.fx.burst(x, y, ctx.theme.mist, 2, 20, 2);
  }

  mark() {}

  hit() {
    return false;
  }

  /** O'q uzildi: to'pponchadan orqaga gilza otilib chiqadi */
  shot(ctx: SceneCtx) {
    const max = ctx.reduced ? this.maxReduced : this.max;
    while (this.shells.length >= max) {
      const old = this.shells.shift()!;
      this.puff(old.x, old.y - old.z, ctx);
    }
    const k = this.count++;
    this.shells.push({
      x: ctx.x + ctx.dir * 3,
      y: ctx.y + 10,
      z: 10,
      vx: -ctx.dir * (28 + ((k * 37) % 30)),
      vz: 55 + ((k * 23) % 25),
      rest: false,
    });
  }

  pose(cast: SuperCast) {
    if (cast.stage !== "prep") return null;
    // baraban aylanadi: ikki kadr navbat bilan
    return Math.floor(cast.t / 0.08) % 2 ? GUNNER_SUPER_FRAME.spin : GUNNER_SUPER_FRAME.up;
  }

  update(dt: number, cast: SuperCast | null, _ctx: SceneCtx) {
    this.time += dt;
    const want = cast?.stage === "prep" ? 1 : 0;
    this.dim += (want - this.dim) * Math.min(1, dt * 8);
    this.inf = this.infOn ? Math.min(1, this.inf + dt * 4) : Math.max(0, this.inf - dt * 3);
    const hot =
      cast?.stage === "strike"
        ? 0.3 + 0.7 * Math.min(1, cast.t / Math.max(0.01, cast.strikeTime))
        : 0;
    this.heat = hot > 0 ? hot : Math.max(0, this.heat - dt * 2);
    for (const sh of this.shells) {
      if (sh.rest) continue;
      sh.x += sh.vx * dt;
      sh.z += sh.vz * dt;
      sh.vz -= 300 * dt;
      if (sh.z <= 0) {
        sh.z = 0;
        sh.vz = -sh.vz * 0.4;
        sh.vx *= 0.5;
        if (Math.abs(sh.vz) < 14) sh.rest = true;
      }
      sh.x = Math.max(ROOM.wall, Math.min(ROOM.w - ROOM.wall, sh.x));
    }
    for (const p of this.puffs) p.life -= dt;
    this.puffs = this.puffs.filter((p) => p.life > 0);
  }

  renderGround(c: CanvasRenderingContext2D, _cast: SuperCast | null, ctx: SceneCtx) {
    const T = ctx.theme;
    for (const sh of this.shells) {
      if (sh.z > 0.5) continue;
      px(c, T.accent, Math.round(sh.x), Math.round(sh.y), 2, 1);
      px(c, T.glint, Math.round(sh.x), Math.round(sh.y), 1, 1);
    }
  }

  renderAir(c: CanvasRenderingContext2D, cast: SuperCast | null, ctx: SceneCtx) {
    const T = ctx.theme;
    const O = ctx.orb ?? T;
    if (this.dim > 0.01) px(c, `rgba(10,6,2,${0.3 * this.dim})`, 0, 0, ROOM.w, ROOM.h);
    // havodagi gilzalar (aylanib uchadi)
    for (const sh of this.shells) {
      if (sh.z <= 0.5) continue;
      const x = Math.round(sh.x),
        y = Math.round(sh.y - sh.z);
      const flip = Math.floor(sh.z / 3) % 2;
      px(c, T.accent, x, y, flip ? 1 : 2, flip ? 2 : 1);
      px(c, T.glint, x, y, 1, 1);
    }
    // qizigan qurol: og'iz atrofida porlash, ustida issiq havo
    if (this.heat > 0.01 && cast?.free) {
      const gx = Math.round(ctx.x + ctx.dir * 9),
        gy = Math.round(ctx.y - 1);
      const col = heatColor(O, this.heat);
      const r = 1 + Math.round(this.heat * 2);
      px(c, withAlpha(col, 0.35 + 0.4 * this.heat), gx - r, gy - r + 1, r * 2 + 1, r * 2 - 1);
      px(c, col, gx - 1, gy, 3, 1);
      if (!ctx.reduced && this.heat > 0.5)
        for (let i = 0; i < 3; i++) {
          const yy = gy - 4 - ((this.time * 18 + i * 3) % 8);
          const xx = gx + Math.round(Math.sin(this.time * 9 + i * 2) * 1.5);
          px(c, withAlpha(O.glow, 0.5 * this.heat), xx, Math.round(yy), 1, 1);
        }
    }
    // ∞ belgisi bosh ustida: tayyorlanishda katta (2x), tez otishda kichik
    if (this.inf > 0.01) {
      const big = cast?.stage === "prep";
      const s = big ? 2 : 1;
      const w = 11 * s;
      const x0 = Math.round(ctx.x - w / 2),
        y0 = Math.round(ctx.y - 30 - (big ? 6 : 0));
      const blink = ctx.reduced || !big || Math.floor(this.time * 10) % 2 === 0;
      const col = withAlpha(blink ? O.glow : O.accent, this.inf);
      const ink = withAlpha(T.ink, this.inf);
      INF.forEach((row, j) => {
        for (let i = 0; i < row.length; i++)
          if (row[i] === "X") px(c, ink, x0 + i * s + 1, y0 + j * s + 1, s, s);
      });
      INF.forEach((row, j) => {
        for (let i = 0; i < row.length; i++)
          if (row[i] === "X") px(c, col, x0 + i * s, y0 + j * s, s, s);
      });
    }
    // "puf": tutun halqalari
    for (const p of this.puffs) {
      const k = p.life / PUFF_TIME;
      const r = 1 + (1 - k) * 4;
      c.fillStyle = withAlpha(T.mist, 0.6 * k);
      c.beginPath();
      c.arc(p.x, p.y - (1 - k) * 4, r, 0, Math.PI * 2);
      c.fill();
    }
  }
}
