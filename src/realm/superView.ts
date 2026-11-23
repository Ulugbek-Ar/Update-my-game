/**
 * ONLAYN SUPERLAR KO'RINISHI (klient, v3.14) — server yuborgan bitta qisqa "super" voqeasidan har
 * klient super sahnasini o'zida chizadi (zarar va o'limlar — serverdan, odatdagi holat bilan).
 * Egasining o'zida: karta (cut-in, qisqa, dunyo to'xtamaydi), super shari va super pozasi.
 *
 * Sahnalar asosiy o'yinniki (superScene.ts): koordinatalar dunyoda, ko'rinish hududi — kamera.
 */
import { ROOM } from "@/game/animation";
import { sfx } from "@/game/audio";
import type { Effects } from "@/game/effects";
import type { Hero } from "@/game/hero";
import {
  GUNNER_PORTRAIT_VARIANTS,
  HUNTER_PORTRAIT_VARIANTS,
  KNIGHT_PORTRAIT_VARIANTS,
  MAGE_PORTRAIT_VARIANTS,
  PALADIN_PORTRAIT_VARIANTS,
  SAMURAI_PORTRAIT_VARIANTS,
  SHINOBI_PORTRAIT_VARIANTS,
  superPortrait,
} from "@/game/portrait";
import type { SkinLook } from "@/game/skinFx";
import {
  SuperCast,
  launchVolley,
  nearestTarget,
  stepArrow,
  superById,
  superPaths,
  volleyTargets,
  type SuperDef,
  type SuperStage,
} from "@/game/super";
import { SuperOrb, renderSuperCard, renderSuperOrb, type CardText } from "@/game/superFx";
import { sceneFor, type SceneCtx, type SceneTarget, type SuperScene } from "@/game/superScene";
import type { RealmMob } from "./mobs";
import type { RealmSim } from "./sim";
import { realmBoss, superDue, superTargets, toLocal, toWorld, type SuperEvent } from "./supers";

/** Super ovozi shu masofadan uzoqda eshitilmaydi (px) */
const HEAR = 260;

interface Vis {
  pid: string;
  def: SuperDef;
  cast: SuperCast;
  scene: SuperScene;
  look: SkinLook;
  x: number;
  y: number;
  aim: { x: number; y: number };
  hit: boolean;
  mine: boolean;
}

const target = (m: RealmMob): SceneTarget => ({ x: m.x, y: m.y, size: m.size, ref: m, live: m });

export class RealmSupers {
  casts = new Map<string, Vis>();
  /** Egasining super shari (HUD va telefon tugmasi) */
  orb = new SuperOrb();
  /** Egasining kartasi: o'tgan vaqt (−1 — yo'q) */
  card: { def: SuperDef; t: number; hero: Hero; look: SkinLook } | null = null;
  /** "TAYYOR!" yozuvi */
  readyNote = 0;

  /** Egasi hozir super pozasida (joyida turadi) */
  locked(pid: string) {
    const v = this.casts.get(pid);
    return !!v && !v.cast.done && !v.cast.free;
  }

  /** Server voqeasi: super boshlandi */
  start(
    e: SuperEvent,
    mine: boolean,
    look: SkinLook,
    hero: Hero,
    view: SceneCtx["view"],
    fx: Effects,
    reduced: boolean,
  ) {
    const def = superById(e.id);
    if (!def) return;
    const cast = new SuperCast(def, 0);
    cast.aim = { x: e.ax, y: e.ay };
    if (e.sx !== undefined && e.sy !== undefined) cast.spot = { x: e.sx, y: e.sy };
    const v: Vis = {
      pid: e.pid,
      def,
      cast,
      scene: sceneFor(def.fx),
      look,
      x: e.x,
      y: e.y,
      aim: cast.aim,
      hit: false,
      mine,
    };
    this.casts.set(e.pid, v);
    if (mine) {
      this.card = { def, t: 0, hero, look };
      this.orb.drain();
      sfx.superDrain();
      sfx[def.sounds.card]();
    }
    this.enter(v, "prep", this.ctx(v, view, fx, reduced), true);
  }

  private ctx(v: Vis, view: SceneCtx["view"], fx: Effects, reduced: boolean): SceneCtx {
    return {
      x: v.x,
      y: v.y,
      dir: v.aim.x < 0 ? -1 : 1,
      theme: v.look.theme,
      reduced,
      fx,
      shake: (s) => {
        if (v.mine) fx.addShake(reduced ? s * 0.35 : s);
      },
      view,
      orb:
        v.def.orb && v.look.tier === "default" ? { ...v.look.theme, ...v.def.orb } : v.look.theme,
    };
  }

  private enter(v: Vis, s: SuperStage, ctx: SceneCtx, near: boolean) {
    const { def, cast } = v;
    if (s === "strike") {
      if (def.path) {
        const o = { x: v.x, y: v.y };
        cast.paths = superPaths(def, toLocal(o, o), v.aim, ROOM).map((p) => ({
          ...p,
          ...toWorld(o, p),
        }));
      }
    }
    v.scene.stage(s, cast, ctx);
    if (!near) return;
    if (s === "prep") sfx[def.sounds.prep](def.stages.prep);
    if (s === "strike" && def.sounds.strike) sfx[def.sounds.strike](cast.strikeTime);
    if (s === "after") sfx[def.sounds.end]();
  }

  /** Bitta tick: vaqt chizig'i, belgilar va zarba lahzasidagi ko'rinish */
  tick(
    dt: number,
    sim: RealmSim,
    me: { x: number; y: number },
    view: SceneCtx["view"],
    fx: Effects,
    reduced: boolean,
  ) {
    for (const v of this.casts.values()) {
      const rp = sim.players.get(v.pid);
      if (rp) {
        v.x = rp.p.x;
        v.y = rp.p.y;
      }
      const ctx = this.ctx(v, view, fx, reduced);
      const near = v.mine || Math.hypot(v.x - me.x, v.y - me.y) < HEAR;
      const { def, cast } = v;
      const ev = cast.update(dt);
      for (const s of ev.entered) {
        this.enter(v, s, ctx, near);
        if (s === "strike" && def.volley) {
          const list = superTargets(sim, v);
          const aim = volleyTargets(
            v,
            list.filter((m) => !realmBoss(m)),
            list.filter(realmBoss),
            def.volley.n,
          );
          cast.arrows = launchVolley(def, v, aim, v.aim);
          for (const m of new Set(aim)) if (m) v.scene.mark(target(m), realmBoss(m), cast, ctx);
        }
        if (s === "strike" && !def.volley && !def.impact && !def.path && !def.frenzy)
          for (const m of superTargets(sim, v)) v.scene.mark(target(m), realmBoss(m), cast, ctx);
      }
      // o'qlar (faqat ko'rinish): o'lgan nishon o'rniga eng yaqini
      if (def.volley && cast.stage === "strike") {
        const live = superTargets(sim, v);
        cast.arrows.forEach((a, i) => {
          if (a.done) return;
          let t = a.target as RealmMob | null;
          if (!t || t.dead) {
            t = nearestTarget(a, live);
            if (t) a.target = t;
          }
          if (t) {
            a.tx = t.x;
            a.ty = t.y;
          }
          if (stepArrow(def, a, dt, cast.t)) {
            v.scene.hit(
              t ? target(t) : { x: a.x, y: a.y, size: 6 },
              !!t && realmBoss(t),
              false,
              cast,
              ctx,
            );
            if (near) sfx[def.sounds.hit](i);
          }
        });
      }
      if (!v.hit && superDue(def, cast)) {
        v.hit = true;
        if (def.release !== undefined) v.scene.release?.(cast, ctx);
        if (def.release !== undefined && near && def.sounds.release) sfx[def.sounds.release]();
        if (def.impact) {
          cast.landed = true;
          if (near && def.sounds.release) sfx[def.sounds.release]();
        }
        if (!def.volley) {
          let i = 0;
          for (const m of superTargets(sim, v)) {
            const boss = realmBoss(m);
            v.scene.hit(target(m), boss, false, cast, ctx);
            if (near && i < 6) sfx[boss ? def.sounds.bossHit : def.sounds.hit](i);
            i++;
          }
        }
      }
      if (v.mine && rp) rp.p.superFrame = v.scene.pose(cast) ?? -1;
      // super tugadi: poza tozalanadi, sahna so'nib bo'lguncha chiziladi
      if (ev.done && v.mine && rp) rp.p.superFrame = -1;
    }
    for (const [pid, v] of this.casts) {
      v.scene.update(dt, v.cast.done ? null : v.cast, this.ctx(v, view, fx, reduced));
      if (v.cast.done && !v.scene.alive) this.casts.delete(pid);
    }
  }

  /** Har kadr: shar va karta */
  frame(dt: number, ratio: number, ready: boolean, justFilled: boolean, reduced: boolean) {
    if (justFilled) {
      this.readyNote = 1.6;
      sfx.superReady();
    }
    if (this.readyNote > 0) this.readyNote -= dt;
    this.orb.update(dt, ratio, ready, 0, reduced);
    if (this.card) {
      this.card.t += dt;
      if (this.card.t >= this.card.def.card.short + 0.35) this.card = null;
    }
  }

  renderGround(c: CanvasRenderingContext2D, view: SceneCtx["view"], fx: Effects, reduced: boolean) {
    for (const v of this.casts.values())
      v.scene.renderGround(c, v.cast.done ? null : v.cast, this.ctx(v, view, fx, reduced));
  }

  renderAir(c: CanvasRenderingContext2D, view: SceneCtx["view"], fx: Effects, reduced: boolean) {
    for (const v of this.casts.values())
      v.scene.renderAir(c, v.cast.done ? null : v.cast, this.ctx(v, view, fx, reduced));
  }

  /** Ekran qatlami: egasining kartasi (qisqa) */
  renderCard(c: CanvasRenderingContext2D, text: CardText, reduced: boolean) {
    const k = this.card;
    if (!k) return;
    const time = k.def.card.short + 0.35;
    const variant = Math.min(2, Math.floor((k.t / time) * 3.4));
    renderSuperCard(
      c,
      k.def,
      { t: k.t, cardTime: time },
      k.look.theme,
      superPortrait(k.hero, undefined, PORTRAIT_FRAMES[k.hero][variant] ?? ""),
      text,
      reduced,
    );
  }

  /** Ekran qatlami: super shari (kompyuterda; telefonda — tugma) */
  renderOrb(
    c: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    theme: SceneCtx["theme"],
    reduced: boolean,
  ) {
    renderSuperOrb(c, this.orb, x, y, r, theme, reduced);
  }
}

/** Har qahramon portretining kadr nomlari (portrait.ts) */
const PORTRAIT_FRAMES: Record<Hero, readonly string[]> = {
  knight: KNIGHT_PORTRAIT_VARIANTS,
  mage: MAGE_PORTRAIT_VARIANTS,
  hunter: HUNTER_PORTRAIT_VARIANTS,
  gunner: GUNNER_PORTRAIT_VARIANTS,
  paladin: PALADIN_PORTRAIT_VARIANTS,
  samurai: SAMURAI_PORTRAIT_VARIANTS,
  shinobi: SHINOBI_PORTRAIT_VARIANTS,
};
