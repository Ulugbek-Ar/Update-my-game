/**
 * ILOHIY HUKM sahnasi (Paladin superi) — faqat chizish; zarar va vaqt super.ts / Game da.
 *
 *  TAYYORLANISH: ekran qorayadi, xona tepasidagi bulutlar ochiladi, osmondan Paladinga OLTIN NUR
 *    USTUNI tushadi (ichida nur zarrachalari yuqoriga ko'tariladi), atrofida aylanuvchi aura, yerda
 *    ilohiy halqa belgisi, qilich uchi quyoshdek porlaydi.
 *  ZARBA: har mob ustida kichik oltin belgi chaqnaydi, so'ng osmondan qalin yorqin nur tushadi —
 *    yerda chaqnash va uchqunlar. Bitta mob nurdan oldin tepaga qarab "HI?" deydi. Bossga — bitta
 *    katta qalin nur.
 *  OQIBAT: nur tushgan moblar yerga yopishib yotadi (ko'zlari "x_x"), Paladin qilichni yerga
 *    sanchadi — katta oltin halqa to'lqini tarqaladi va u yetib borgan moblar oltin chang bo'lib
 *    yuqoriga sochiladi; nur ustuni asta so'nadi.
 *
 * Ranglar faqat faol skin theme'dan (skinFx.ts) — "Olov Paladin"da nur olovli-oltin, "Qora
 * Paladin"da binafsha. Xavf ranglari (danger.ts) ishlatilmaydi. "Effektlarni kamaytirish":
 * chaqnash va miltillash yo'q, zarrachalar kam. Zarrachalar soni chegaralangan (telefonda 60 FPS).
 * Math.random ishlatilmaydi (o'z kichik generatori).
 */
import { px } from "./animation";
import { withAlpha } from "./hero";
import type { SkinTheme } from "./skinFx";
import { PALADIN_SUPER_FRAME, paladinSwordTip, renderSprite, spriteSize } from "./sprites";
import type { SuperCast, SuperStage } from "./super";
import type { SceneCtx, SceneTarget, SuperScene } from "./superScene";

/** Nur kengligi: oddiy mobga va bossga (px) */
export const BEAM_W = 14;
export const BOSS_BEAM_W = 34;
export const BEAM_LIFE = 0.36;
/** Paladin ustidagi nur ustuni kengligi */
export const PILLAR_W = 22;
/** Qilich boshi uzra to'liq ko'tarilgan payt (tayyorlanish ichida) — ustun shu lahzada tushadi */
export const RAISE_TIME = 0.6;
/** Oltin chang: har mobdan, jami chegara (kamaytirilganda — pastdagilar) */
export const DUST_PER_CORPSE = 14;
export const MAX_DUST = 180;
export const DUST_PER_CORPSE_REDUCED = 3;
export const MAX_DUST_REDUCED = 40;
/** Ustun ichida ko'tariluvchi nur zarrachalari */
export const MOTES = 14;
export const MOTES_REDUCED = 4;
/** Qilich sanchilgandagi halqa to'lqini: tezligi (px/s) va eng katta radiusi */
export const WAVE_SPEED = 420;
export const WAVE_MAX = 380;
/** Bulutlar: sahna tepasidagi qatlam balandligi */
const SKY_H = 34;
/** Bulut ranglari (neytral to'q binafsha-kulrang — xavf ranglaridan uzoq) */
export const CLOUD_COLORS = ["#1f1830", "#33294a", "#4a3f66"] as const;

interface Beam {
  x: number;
  y: number;
  w: number;
  life: number;
  boss: boolean;
}

interface Mark {
  t: SceneTarget;
  life: number;
  max: number;
  boss: boolean;
}

interface Corpse {
  t: SceneTarget;
  x: number;
  ground: number;
  /** Yotgan vaqti; chang boshlangan bo'lsa — changdan beri o'tgan vaqt (−1 — hali yo'q) */
  age: number;
  dust: number;
  flat: number;
  fade: number;
}

interface Ring {
  x: number;
  y: number;
  /** Tug'ilgandan beri o'tgan vaqt (manfiy — hali boshlanmagan) */
  t: number;
  speed: number;
  max: number;
  big: boolean;
}

interface Dust {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  tone: number;
  star: boolean;
  big: boolean;
}

interface Mote {
  dx: number;
  k: number;
  v: number;
  big: boolean;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeOut = (k: number) => 1 - (1 - clamp01(k)) ** 3;

/** 3x5 piksel harflar ("HI?" pufakchasi) va "x_x" ko'zlari — shriftga bog'liq emas */
const GLYPH: Record<string, readonly string[]> = {
  H: ["x.x", "x.x", "xxx", "x.x", "x.x"],
  I: ["xxx", ".x.", ".x.", ".x.", "xxx"],
  "?": ["xx.", "..x", ".x.", "...", ".x."],
};

function glyphs(c: CanvasRenderingContext2D, s: string, x: number, y: number, color: string) {
  c.fillStyle = color;
  let ox = 0;
  for (const ch of s) {
    const g = GLYPH[ch];
    if (g)
      g.forEach((row, ry) =>
        [...row].forEach((v, rx) => {
          if (v === "x") c.fillRect(x + ox + rx, y + ry, 1, 1);
        }),
      );
    ox += 4;
  }
}

/** "x_x": ikki xoch ko'z va o'rtada chiziqcha — oq, qora soyali (har qanday polda o'qiladi) */
function deadEyes(c: CanvasRenderingContext2D, x: number, y: number, alpha: number, ink: string) {
  const draw = (ox: number, oy: number, color: string) => {
    c.fillStyle = color;
    for (const ex of [-5, 3]) {
      c.fillRect(x + ex + ox, y + oy, 1, 1);
      c.fillRect(x + ex + 2 + ox, y + oy, 1, 1);
      c.fillRect(x + ex + 1 + ox, y + 1 + oy, 1, 1);
      c.fillRect(x + ex + ox, y + 2 + oy, 1, 1);
      c.fillRect(x + ex + 2 + ox, y + 2 + oy, 1, 1);
    }
    c.fillRect(x - 1 + ox, y + 2 + oy, 3, 1);
  };
  const a = c.globalAlpha;
  c.globalAlpha = a * alpha;
  draw(1, 1, ink);
  draw(0, 0, "#ffffff");
  c.globalAlpha = a;
}

/**
 * QUYOSH QALQONI (super kartasi): superdan keyin o'yinchi atrofida oltin qalqon — yaltiroq halqa
 * va aylanuvchi yorug' nuqtalar. left — qolgan vaqt: oxirgi 0.5 s da miltillab so'nadi.
 */
export function renderSunShield(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  time: number,
  left: number,
  T: SkinTheme,
  reduced = false,
) {
  // oxirida miltillaydi (tugayotgani ko'rinsin); kamaytirilganda — faqat xiralashadi
  const end = left < 0.5;
  if (end && !reduced && Math.floor(left * 16) % 2) return;
  const a = end ? 0.55 : 1;
  const cx = Math.round(x),
    cy = Math.round(y) - 1;
  c.save();
  c.fillStyle = withAlpha(T.glow, 0.13 * a);
  c.beginPath();
  c.ellipse(cx, cy, 13, 16, 0, 0, Math.PI * 2);
  c.fill();
  c.lineWidth = 2;
  c.strokeStyle = withAlpha(T.accent, 0.85 * a);
  c.beginPath();
  c.ellipse(cx, cy, 13, 16, 0, 0, Math.PI * 2);
  c.stroke();
  c.lineWidth = 1;
  c.strokeStyle = withAlpha(T.edge, 0.9 * a);
  c.beginPath();
  c.ellipse(cx, cy, 14, 17, 0, 0, Math.PI * 2);
  c.stroke();
  c.restore();
  // halqa bo'ylab aylanuvchi yorug' nuqtalar va chap yuqoridagi yaltirash
  const n = reduced ? 2 : 4;
  for (let i = 0; i < n; i++) {
    const an = time * 3 + (i * Math.PI * 2) / n;
    px(c, withAlpha(T.edge, a), cx + Math.cos(an) * 13, cy + Math.sin(an) * 16, 2, 2);
  }
  px(c, withAlpha(T.edge, 0.8 * a), cx - 9, cy - 10, 1, 4);
  px(c, withAlpha(T.edge, 0.8 * a), cx - 8, cy - 12, 3, 1);
}

export class DivineScene implements SuperScene {
  /** Sahna soati (haqiqiy vaqt) */
  t = 0;
  /** Silliq o'zgaruvchi holatlar 0..1: qorayish, osmon ochilishi, ustun, yerdagi belgi */
  dim = 0;
  sky = 0;
  pillar = 0;
  sigil = 0;
  /** Ustun tushishi 0..1 (tepadan yergacha) */
  drop = 0;
  /** Qilich sanchilgandan beri o'tgan vaqt (−1 — hali yo'q) va joyi */
  plantT = -1;
  private plantAt = { x: 0, y: 0 };
  /** Ekran chaqnashi (kamaytirilganda — yo'q) */
  flash = 0;
  beams: Beam[] = [];
  marks: Mark[] = [];
  corpses: Corpse[] = [];
  rings: Ring[] = [];
  dust: Dust[] = [];
  motes: Mote[] = [];
  /** "HI?" pufakchasi: nishon va ko'ringanidan beri o'tgan vaqt */
  private gawker: { t: SceneTarget; age: number } | null = null;
  private lit = false;
  private seed = 987654321;
  private sparkleT = 0;
  /** Oxirgi ma'lum super egasi joyi (super tugagach ham so'nish uchun) */
  private at = { x: 160, y: 120, dir: 1 };
  private frame: number = PALADIN_SUPER_FRAME.raise1;
  private castOn = false;

  private rnd() {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  get alive() {
    return (
      this.castOn ||
      this.dim > 0.02 ||
      this.pillar > 0.02 ||
      this.sigil > 0.02 ||
      this.flash > 0.02 ||
      this.beams.length > 0 ||
      this.marks.length > 0 ||
      this.corpses.length > 0 ||
      this.rings.length > 0 ||
      this.dust.length > 0
    );
  }

  /** Paladin kadri: ko'tarish → boshi uzra (miltillaydi) → yerga sanchish */
  pose(cast: SuperCast) {
    const F = PALADIN_SUPER_FRAME;
    const shimmer = Math.floor(this.t * 9) % 2 ? F.upAlt : F.up;
    if (cast.stage === "prep")
      this.frame = cast.t < RAISE_TIME * 0.5 ? F.raise1 : cast.t < RAISE_TIME ? F.raise2 : shimmer;
    else if (cast.stage === "strike") this.frame = shimmer;
    else if (cast.stage === "after") this.frame = F.plant;
    return this.frame;
  }

  stage(s: SuperStage, _cast: SuperCast, ctx: SceneCtx) {
    if (s !== "after") return;
    // qilich yerga sanchildi: katta oltin halqa to'lqini, yerda chaqnash
    const [dx, dy] = paladinSwordTip(PALADIN_SUPER_FRAME.plant);
    const x = ctx.x + ctx.dir * dx,
      y = ctx.y + dy - 2;
    this.plantT = 0;
    this.plantAt = { x, y };
    this.rings.push({ x, y, t: 0, speed: WAVE_SPEED, max: WAVE_MAX, big: true });
    this.rings.push({ x, y, t: -0.12, speed: WAVE_SPEED * 0.8, max: WAVE_MAX * 0.7, big: false });
    if (!ctx.reduced) this.flash = Math.max(this.flash, 0.3);
    ctx.shake(0.5);
    ctx.fx.burst(x, y, ctx.theme.glow, 18, 120, 2);
    ctx.fx.burst(x, y, ctx.theme.edge, 8, 80, 1, "star");
    ctx.fx.burst(x, y, ctx.theme.accent, 10, 60, 2);
  }

  mark(t: SceneTarget, boss: boolean) {
    this.marks.push({ t, life: 0.17, max: 0.17, boss });
  }

  gawk(t: SceneTarget) {
    this.gawker = { t, age: 0 };
  }

  hit(t: SceneTarget, boss: boolean, killed: boolean, cast: SuperCast, ctx: SceneCtx) {
    const live = t.live ?? t;
    const x = live.x,
      ground = live.y + t.size / 2 + (boss ? -2 : 2);
    // ikkinchi to'lqin (yarim kuch) — ingichkaroq nur
    const thin = cast.wave > 1 ? 0.65 : 1;
    this.beams.push({
      x,
      y: ground,
      w: (boss ? BOSS_BEAM_W : BEAM_W) * thin,
      life: BEAM_LIFE,
      boss,
    });
    this.rings.push({
      x,
      y: ground,
      t: 0,
      speed: boss ? 150 : 90,
      max: boss ? 46 : 20,
      big: boss,
    });
    const T = ctx.theme;
    ctx.fx.burst(x, ground - 2, T.glow, boss ? 22 : 9, boss ? 140 : 100, 2);
    ctx.fx.burst(x, ground - 2, T.edge, boss ? 10 : 4, 70, 1, "star");
    ctx.shake(boss ? 0.55 : 0.12);
    if (boss && !ctx.reduced) this.flash = Math.max(this.flash, 0.22);
    if (this.gawker && (this.gawker.t.ref ?? this.gawker.t) === (t.ref ?? t)) this.gawker = null;
    if (boss || !killed || !t.sprite) return false;
    // mob yer tishlaydi: jasadni sahna o'zi ko'rsatadi
    this.corpses.push({
      t,
      x,
      ground: live.y + t.size / 2 + 3,
      age: 0,
      dust: -1,
      flat: cast.def.after.flat,
      fade: cast.def.after.dust,
    });
    return true;
  }

  update(dt: number, cast: SuperCast | null, ctx: SceneCtx) {
    this.t += dt;
    this.castOn = !!cast;
    this.at = { x: ctx.x, y: ctx.y, dir: ctx.dir };
    const st = cast?.stage;
    const on = st === "prep" || st === "strike";
    const up = on && (st === "strike" || cast!.t >= RAISE_TIME);
    const ease = (v: number, to: number, rate: number) => v + (to - v) * Math.min(1, dt * rate);
    this.dim = ease(this.dim, on ? 1 : 0, on ? 5 : 3.5);
    this.sky = ease(this.sky, on && (st === "strike" || cast!.t > 0.25) ? 1 : 0, on ? 5 : 2.5);
    this.sigil = ease(this.sigil, on ? 1 : 0, on ? 7 : 3);
    this.pillar = ease(this.pillar, up ? 1 : 0, up ? 12 : 2.4);
    if (up) {
      if (!this.lit) {
        // ustun tushgan lahza: qisqa chaqnash va yengil silkinish
        this.lit = true;
        this.drop = 0;
        if (!ctx.reduced) this.flash = Math.max(this.flash, 0.16);
        ctx.shake(0.18);
        ctx.fx.burst(ctx.x, ctx.y + 12, ctx.theme.glow, 12, 90, 2);
      }
      this.drop = Math.min(1, this.drop + dt / 0.18);
    }
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 1.6);
    if (this.plantT >= 0) this.plantT += dt;

    // ustun ichidagi nur zarrachalari: yuqoriga ko'tariladi
    const wantMotes = this.pillar > 0.3 ? (ctx.reduced ? MOTES_REDUCED : MOTES) : 0;
    while (this.motes.length < wantMotes)
      this.motes.push({
        dx: (this.rnd() - 0.5) * (PILLAR_W - 4),
        k: this.rnd(),
        v: 0.35 + this.rnd() * 0.5,
        big: this.rnd() < 0.3,
      });
    if (this.motes.length > wantMotes) this.motes.length = wantMotes;
    for (const m of this.motes) {
      m.k += m.v * dt;
      if (m.k >= 1) {
        m.k = 0;
        m.dx = (this.rnd() - 0.5) * (PILLAR_W - 4);
      }
    }
    // qilich uchidan uchqunlar (kamaytirilganda — yo'q)
    if (this.pillar > 0.6 && on && !ctx.reduced) {
      this.sparkleT -= dt;
      if (this.sparkleT <= 0) {
        this.sparkleT = 0.07;
        const [dx, dy] = paladinSwordTip(this.frame);
        ctx.fx.burst(ctx.x + ctx.dir * dx, ctx.y + dy, ctx.theme.glow, 1, 40, 1, "star");
      }
    }

    for (const b of this.beams) b.life -= dt;
    this.beams = this.beams.filter((b) => b.life > 0);
    for (const m of this.marks) m.life -= dt;
    this.marks = this.marks.filter((m) => m.life > 0);
    for (const r of this.rings) r.t += dt;
    this.rings = this.rings.filter((r) => r.t < 0 || r.t * r.speed < r.max);
    if (this.gawker) this.gawker.age += dt;

    // jasadlar: yotadi, halqa to'lqini yetganda (yoki super tugab qolsa) oltin changga aylanadi
    const waveR = this.plantT >= 0 ? this.plantT * WAVE_SPEED : -1;
    const perCorpse = ctx.reduced ? DUST_PER_CORPSE_REDUCED : DUST_PER_CORPSE;
    const cap = ctx.reduced ? MAX_DUST_REDUCED : MAX_DUST;
    for (const k of this.corpses) {
      if (k.dust >= 0) {
        k.dust += dt;
        continue;
      }
      k.age += dt;
      const reached =
        waveR >= 0 && Math.hypot(k.x - this.plantAt.x, k.ground - this.plantAt.y) <= waveR + 6;
      // to'lqin yetgan va yetarlicha yotgan; super to'lqinsiz tugasa — baribir changga aylanadi
      if (!((reached && k.age >= k.flat) || (!cast && k.age >= k.flat) || k.age > k.flat + 2.5))
        continue;
      k.dust = 0;
      const half = Math.max(5, k.t.size * 0.7);
      for (let i = 0; i < perCorpse; i++) {
        if (this.dust.length >= cap) this.dust.shift();
        const life = 0.55 + this.rnd() * 0.55;
        this.dust.push({
          x: k.x + (this.rnd() - 0.5) * half * 2,
          y: k.ground - 2 - this.rnd() * 3,
          vx: (this.rnd() - 0.5) * 18,
          vy: -(26 + this.rnd() * 46),
          life,
          max: life,
          tone: Math.floor(this.rnd() * 3),
          star: this.rnd() < 0.3,
          big: this.rnd() < 0.45,
        });
      }
    }
    this.corpses = this.corpses.filter((k) => k.dust < 0 || k.dust < k.fade);
    for (const d of this.dust) {
      d.x += d.vx * dt + Math.sin(this.t * 5 + d.y) * 4 * dt;
      d.y += d.vy * dt;
      d.vy *= 1 - Math.min(1, dt * 0.9);
      d.life -= dt;
    }
    this.dust = this.dust.filter((d) => d.life > 0);
    if (!cast && !this.alive) this.lit = false;
  }

  // ---------------- chizish ----------------

  renderGround(c: CanvasRenderingContext2D, _cast: SuperCast | null, ctx: SceneCtx) {
    const T = ctx.theme;
    const { x, y } = this.at;
    const s = this.sigil;
    if (s > 0.02) {
      // yerdagi ilohiy halqa belgisi: ikki halqa, aylanuvchi nurlar, markazda quyosh belgisi
      const gy = y + 12;
      const R = 30 * easeOut(s);
      c.save();
      c.globalAlpha = Math.min(1, s * 1.4);
      c.fillStyle = withAlpha(T.glow, 0.1);
      c.beginPath();
      c.ellipse(x, gy, R, R * 0.55, 0, 0, Math.PI * 2);
      c.fill();
      c.lineWidth = 1.5;
      c.strokeStyle = withAlpha(T.accent, 0.9);
      c.beginPath();
      c.ellipse(x, gy, R, R * 0.55, 0, 0, Math.PI * 2);
      c.stroke();
      c.lineWidth = 1;
      c.strokeStyle = withAlpha(T.glow, 0.75);
      c.beginPath();
      c.ellipse(x, gy, R * 0.7, R * 0.7 * 0.55, 0, 0, Math.PI * 2);
      c.stroke();
      // halqalar orasida aylanuvchi 8 ta nur chizig'i
      const rot = ctx.reduced ? 0 : this.t * 0.9;
      c.strokeStyle = withAlpha(T.edge, 0.8);
      c.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = rot + (i * Math.PI) / 4;
        const cx = Math.cos(a),
          cy = Math.sin(a) * 0.55;
        c.moveTo(x + cx * R * 0.74, gy + cy * R * 0.74);
        c.lineTo(x + cx * R * 0.96, gy + cy * R * 0.96);
      }
      c.stroke();
      // markaz: to'rt nurli quyosh
      px(c, withAlpha(T.glow, 0.9), x - 6, gy, 13, 1);
      px(c, withAlpha(T.glow, 0.9), x, gy - 3, 1, 7);
      px(c, withAlpha(T.accent, 0.9), x - 3, gy - 1, 7, 3);
      px(c, T.edge, x - 1, gy, 3, 1);
      c.restore();
    }
    // aura: orqa yarmidagi uchqunlar (Paladin ortida)
    this.renderAura(c, T, false, ctx.reduced);
  }

  /** Paladin atrofida aylanuvchi oltin aura; front — old yarmi (personaj ustidan chiziladi) */
  private renderAura(c: CanvasRenderingContext2D, T: SkinTheme, front: boolean, reduced: boolean) {
    const a = this.pillar;
    if (a < 0.05) return;
    const { x, y } = this.at;
    const n = reduced ? 3 : 6;
    for (let i = 0; i < n; i++) {
      const ang = this.t * 3.4 + (i * Math.PI * 2) / n;
      // iz: bir necha qadam orqadagi nuqtalar
      for (let tr = reduced ? 0 : 3; tr >= 0; tr--) {
        const an = ang - tr * 0.16;
        const z = Math.sin(an);
        if (z > 0 !== front) continue;
        const ox = Math.cos(an) * 17,
          oy = z * 6;
        const lift = ((this.t * 14 + i * 9) % 22) - 4;
        const al = a * (1 - tr * 0.24);
        px(c, withAlpha(tr ? T.accent : T.glow, al), x + ox - 1, y + 6 + oy - lift, 2, 2);
        if (!tr) px(c, withAlpha(T.edge, al), x + ox, y + 6 + oy - lift, 1, 1);
      }
    }
  }

  renderAir(c: CanvasRenderingContext2D, _cast: SuperCast | null, ctx: SceneCtx) {
    const T = ctx.theme;
    const V = ctx.view;
    const { x, y } = this.at;
    const top = V.y;

    // 1) qorayish: Paladin atrofi yorug' qoladi
    if (this.dim > 0.01) {
      const g = c.createRadialGradient(x, y, 16, x, y, 96);
      g.addColorStop(0, "rgba(6,4,14,0)");
      g.addColorStop(1, `rgba(6,4,14,${0.66 * this.dim})`);
      c.fillStyle = g;
      c.fillRect(V.x, V.y, V.w, V.h);
    }

    // 2) yer tishlagan moblar (qorong'ida ham ko'rinadi)
    for (const k of this.corpses) this.renderCorpse(c, k, T);

    // 3) osmon: bulutlar ochiladi, oralig'idan yorug'lik
    if (this.sky > 0.02) this.renderSky(c, T, V, ctx.reduced);

    c.save();
    c.globalCompositeOperation = "lighter";
    // 4) Paladin ustidagi nur ustuni
    if (this.pillar > 0.02) this.renderPillar(c, T, top, ctx.reduced);
    c.restore();
    // Paladin nur ichida oqarib yo'qolmasin: ustun ustidan qayta chiziladi, so'ng yengil nur pardasi
    if (this.pillar > 0.02 && ctx.drawOwner) {
      ctx.drawOwner(c);
      c.save();
      c.globalCompositeOperation = "lighter";
      px(
        c,
        withAlpha(T.glow, 0.16 * this.pillar),
        Math.round(x - PILLAR_W / 2),
        Math.round(y - 22),
        PILLAR_W,
        36,
      );
      c.restore();
    }
    c.save();
    c.globalCompositeOperation = "lighter";
    // 5) dushmanlarga tushgan nurlar
    for (const b of this.beams) this.renderBeam(c, b, T, top, ctx.reduced);
    c.restore();

    // 6) yerdagi halqa to'lqinlari
    for (const r of this.rings) this.renderRing(c, r, T);
    // 7) nishon belgilari
    for (const m of this.marks) this.renderMark(c, m, T, top);
    // 8) aura (old yarmi) va qilich uchidagi quyosh
    this.renderAura(c, T, true, ctx.reduced);
    if (this.pillar > 0.05) this.renderFlare(c, T, ctx.reduced);
    // 9) oltin chang
    for (const d of this.dust) {
      const a = Math.min(1, (d.life / d.max) * 1.6);
      const col = d.tone === 0 ? T.accent : d.tone === 1 ? T.glow : T.edge;
      const dx = Math.round(d.x),
        dy = Math.round(d.y);
      px(c, withAlpha(col, a), dx, dy, d.big ? 2 : 1, d.big ? 2 : 1);
      if (d.star && a > 0.4) {
        px(c, withAlpha(col, a * 0.7), dx - 1, dy, 3, 1);
        px(c, withAlpha(col, a * 0.7), dx, dy - 1, 1, 3);
      }
    }
    // 10) "HI?" pufakchasi
    if (this.gawker) this.renderBubble(c, this.gawker, T);
    // 11) ekran chaqnashi
    if (this.flash > 0.01) {
      c.fillStyle = withAlpha(T.glow, Math.min(0.5, this.flash));
      c.fillRect(V.x, V.y, V.w, V.h);
    }
  }

  private renderSky(
    c: CanvasRenderingContext2D,
    T: SkinTheme,
    V: SceneCtx["view"],
    reduced: boolean,
  ) {
    const { x } = this.at;
    const a = clamp01(this.sky * 1.3);
    // bulutlar oralig'i: Paladin tepasida ochiladi
    const gap = 30 * easeOut(this.sky);
    c.save();
    c.globalAlpha = a;
    // oraliqdan tushayotgan yorug'lik: pastga toraygan trapetsiya
    const g = c.createLinearGradient(0, V.y, 0, V.y + SKY_H + 16);
    g.addColorStop(0, withAlpha(T.edge, 0.85));
    g.addColorStop(0.5, withAlpha(T.glow, 0.4));
    g.addColorStop(1, withAlpha(T.glow, 0));
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(x - gap, V.y);
    c.lineTo(x + gap, V.y);
    c.lineTo(x + PILLAR_W / 2 + 3, V.y + SKY_H + 16);
    c.lineTo(x - PILLAR_W / 2 - 3, V.y + SKY_H + 16);
    c.closePath();
    c.fill();
    // "xudo nurlari": oraliqdan yelpig'ichdek yoyilgan xira nur tasmalari (asta tebranadi)
    if (gap > 6) {
      c.save();
      c.globalCompositeOperation = "lighter";
      const sway = reduced ? 0 : Math.sin(this.t * 1.3) * 5;
      for (const [dx, w, al] of [
        [-74, 20, 0.07],
        [-38, 14, 0.1],
        [40, 16, 0.1],
        [80, 22, 0.07],
      ] as const) {
        c.fillStyle = withAlpha(T.glow, al * this.pillar);
        c.beginPath();
        c.moveTo(x - 4, V.y);
        c.lineTo(x + 4, V.y);
        c.lineTo(x + dx + sway + w, V.y + V.h * 0.72);
        c.lineTo(x + dx + sway - w, V.y + V.h * 0.72);
        c.closePath();
        c.fill();
      }
      c.restore();
    }
    // bulut to'plari: oraliqdagilari ikki yonga suriladi
    const drift = reduced ? 0 : Math.sin(this.t * 0.7) * 2;
    for (let i = -1; i < 15; i++) {
      const bx0 = V.x + i * 24 + 6 + (i % 2 ? 5 : 0);
      const d = bx0 - x;
      const push = Math.max(0, gap + 13 - Math.abs(d)) * (d < 0 ? -1 : 1);
      const bx = bx0 + push + drift * (i % 3 === 0 ? 1 : -1);
      const by = V.y + 7 + (i % 3) * 4;
      const r = 13 + (i % 4) * 2;
      c.fillStyle = CLOUD_COLORS[0];
      c.beginPath();
      c.arc(bx, by + 4, r, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = CLOUD_COLORS[1];
      c.beginPath();
      c.arc(bx - 2, by, r - 3, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = CLOUD_COLORS[2];
      c.beginPath();
      c.arc(bx - 4, by - 3, Math.max(2, r - 8), 0, Math.PI * 2);
      c.fill();
      // oraliqqa qaragan cheti nurdan yorishadi
      const near = Math.abs(bx - x) - gap;
      if (near < 26) {
        c.strokeStyle = withAlpha(T.glow, 0.9 * clamp01(1 - near / 26));
        c.lineWidth = 1.5;
        c.beginPath();
        const side = bx < x ? 0 : Math.PI;
        c.arc(bx, by + 4, r, side - 1.1, side + 1.1);
        c.stroke();
      }
    }
    // nur tushayotgan joylarda bulut yorishadi
    for (const b of this.beams) {
      const k = b.life / BEAM_LIFE;
      c.fillStyle = withAlpha(T.glow, 0.5 * k);
      c.beginPath();
      c.arc(b.x, V.y + 10, b.w * 0.9, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  }

  private renderPillar(c: CanvasRenderingContext2D, T: SkinTheme, top: number, reduced: boolean) {
    const { x, y } = this.at;
    const a = this.pillar;
    const ground = y + 13;
    const bottom = top + (ground - top) * easeOut(this.drop);
    const h = Math.round(bottom - top);
    if (h <= 0) return;
    const pulse = reduced ? 0 : Math.sin(this.t * 16) * 1.2;
    const W = PILLAR_W + pulse;
    const X = Math.round(x);
    const col = (w: number, color: string, alpha: number) =>
      px(c, withAlpha(color, alpha * a), X - Math.round(w / 2), top, Math.round(w), h);
    col(W + 22, T.accent, 0.07);
    col(W + 10, T.accent, 0.13);
    col(W, T.glow, 0.3);
    col(W * 0.5, T.glow, 0.28);
    col(5, T.edge, 0.5);
    // chetlari: yorug' chiziqlar
    px(c, withAlpha(T.glow, 0.45 * a), X - Math.round(W / 2), top, 1, h);
    px(c, withAlpha(T.glow, 0.45 * a), X + Math.round(W / 2) - 1, top, 1, h);
    // ichida yuqoriga yuguruvchi yorug' chiziqchalar
    if (!reduced)
      for (let i = 0; i < 4; i++) {
        const sx = X + [-7, -3, 4, 8][i]!;
        const sy = top + h - ((this.t * 110 + i * 41) % (h + 20));
        const len = 12 + i * 3;
        const y0 = Math.max(top, sy),
          y1 = Math.min(top + h, sy + len);
        if (y1 > y0) px(c, withAlpha(T.edge, 0.35 * a), sx, y0, 1, y1 - y0);
      }
    // ko'tariluvchi nur zarrachalari
    for (const m of this.motes) {
      const my = ground - m.k * (ground - top);
      if (my > bottom) continue;
      const al = a * Math.min(1, m.k * 6) * (1 - m.k * 0.7);
      px(c, withAlpha(T.edge, al), X + m.dx, my, m.big ? 2 : 1, m.big ? 2 : 1);
    }
    // yerdagi yorug'lik ko'li
    if (this.drop >= 1) {
      c.fillStyle = withAlpha(T.glow, 0.3 * a);
      c.beginPath();
      c.ellipse(x, ground, W * 0.95, 6, 0, 0, Math.PI * 2);
      c.fill();
    } else {
      // tushayotgan ustunning yorqin uchi
      px(
        c,
        withAlpha(T.edge, 0.9 * a),
        X - Math.round(W / 2) - 2,
        Math.round(bottom) - 3,
        W + 4,
        4,
      );
    }
  }

  private renderBeam(
    c: CanvasRenderingContext2D,
    b: Beam,
    T: SkinTheme,
    top: number,
    reduced: boolean,
  ) {
    const age = BEAM_LIFE - b.life;
    // tushish: 0.05 s da tepadan yergacha; so'ng torayib so'nadi
    const fall = clamp01(age / 0.05);
    const hold = 0.11;
    const k = age < hold ? 1 : clamp01(1 - (age - hold) / (BEAM_LIFE - hold));
    const h = Math.round((b.y - top) * fall);
    if (h <= 0) return;
    const flick = reduced ? 0 : Math.floor(age * 60) % 2 ? 1 : -1;
    const w = Math.max(1, b.w * (0.25 + 0.75 * k) + flick);
    const X = Math.round(b.x);
    const col = (ww: number, color: string, alpha: number) =>
      px(c, withAlpha(color, alpha), X - Math.round(ww / 2), top, Math.max(1, Math.round(ww)), h);
    col(w * 2.3, T.accent, 0.12 * k);
    col(w * 1.5, T.accent, 0.3 * k);
    col(w, T.glow, 0.85 * k);
    col(w * 0.5, T.edge, 0.95 * k);
    if (fall < 1) {
      px(c, T.edge, X - Math.round(w / 2) - 2, top + h - 3, Math.round(w) + 4, 4);
      return;
    }
    // yerda chaqnash: oq yadroli ellips
    const fk = clamp01(1 - age / 0.24);
    if (fk > 0) {
      c.fillStyle = withAlpha(T.glow, 0.6 * fk);
      c.beginPath();
      c.ellipse(b.x, b.y, b.w * (1.3 + (1 - fk) * 0.9), b.w * 0.42, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = withAlpha(T.edge, 0.9 * fk);
      c.beginPath();
      c.ellipse(b.x, b.y, b.w * 0.8, b.w * 0.24, 0, 0, Math.PI * 2);
      c.fill();
    }
  }

  private renderRing(c: CanvasRenderingContext2D, r: Ring, T: SkinTheme) {
    if (r.t < 0) return;
    const rad = r.t * r.speed;
    const k = clamp01(rad / r.max);
    const a = (1 - k) ** 1.4;
    if (a <= 0.01 || rad < 1) return;
    c.save();
    // izi: keng yumshoq halqa, cheti: yorqin ingichka chiziq
    c.lineWidth = r.big ? 7 : 3;
    c.strokeStyle = withAlpha(T.accent, 0.3 * a);
    c.beginPath();
    c.ellipse(r.x, r.y, Math.max(1, rad - (r.big ? 4 : 2)), Math.max(1, rad - 4) * 0.7, 0, 0, 7);
    c.stroke();
    c.lineWidth = r.big ? 2.5 : 1.5;
    c.strokeStyle = withAlpha(T.glow, 0.95 * a);
    c.beginPath();
    c.ellipse(r.x, r.y, rad, rad * 0.7, 0, 0, 7);
    c.stroke();
    c.lineWidth = 1;
    c.strokeStyle = withAlpha(T.edge, 0.9 * a);
    c.beginPath();
    c.ellipse(r.x, r.y, rad + 1, (rad + 1) * 0.7, 0, 0, 7);
    c.stroke();
    c.restore();
  }

  private renderMark(c: CanvasRenderingContext2D, m: Mark, T: SkinTheme, top: number) {
    const live = m.t.live ?? m.t;
    const k = m.life / m.max;
    const x = Math.round(live.x),
      y = Math.round(live.y - m.t.size / 2 - (m.boss ? 14 : 9));
    // osmondan ingichka ishora chizig'i
    px(c, withAlpha(T.glow, 0.28 * (1 - k)), x, top, 1, Math.max(0, y - top));
    // torayib keladigan halqa va to'rt nurli belgi
    const r = (m.boss ? 12 : 6) + k * (m.boss ? 14 : 8);
    c.save();
    c.strokeStyle = withAlpha(T.glow, 0.9);
    c.lineWidth = m.boss ? 2 : 1;
    c.beginPath();
    c.arc(x + 0.5, y + 0.5, r, 0, Math.PI * 2);
    c.stroke();
    c.restore();
    const L = m.boss ? 7 : 4;
    px(c, T.glow, x - L, y, L * 2 + 1, 1);
    px(c, T.glow, x, y - L, 1, L * 2 + 1);
    px(c, T.accent, x - 1, y - 1, 3, 3);
    px(c, T.edge, x, y, 1, 1);
  }

  /** Qilich uchidagi "quyosh": oq yadro, navbat bilan uzun-qisqa nurlar */
  private renderFlare(c: CanvasRenderingContext2D, T: SkinTheme, reduced: boolean) {
    const [dx, dy] = paladinSwordTip(this.frame);
    const x = Math.round(this.at.x + this.at.dir * dx),
      y = Math.round(this.at.y + dy);
    const a = this.pillar;
    const tw = reduced ? 0 : Math.floor(this.t * 8) % 2;
    c.save();
    c.globalCompositeOperation = "lighter";
    c.fillStyle = withAlpha(T.glow, 0.32 * a);
    c.beginPath();
    c.arc(x + 0.5, y + 0.5, 7 + tw, 0, Math.PI * 2);
    c.fill();
    c.restore();
    const long = 8 + tw * 2,
      short = 4 - tw;
    px(c, withAlpha(T.edge, a), x - long, y, long * 2 + 1, 1);
    px(c, withAlpha(T.edge, a), x, y - long, 1, long * 2 + 1);
    for (let i = 1; i <= short; i++)
      for (const [sx, sy] of [
        [1, 1],
        [-1, 1],
        [1, -1],
        [-1, -1],
      ] as const)
        px(c, withAlpha(T.glow, a * (1 - i / (short + 1))), x + sx * i, y + sy * i, 1, 1);
    px(c, withAlpha(T.glow, a), x - 2, y - 1, 5, 3);
    px(c, withAlpha(T.glow, a), x - 1, y - 2, 3, 5);
    px(c, withAlpha(T.edge, a), x - 1, y - 1, 3, 3);
  }

  /** Yer tishlagan mob: yassilanib yerga yopishgan sprite, "x_x" ko'zlar; changda — so'nadi */
  private renderCorpse(c: CanvasRenderingContext2D, k: Corpse, T: SkinTheme) {
    const sprite = k.t.sprite;
    if (!sprite) return;
    const size = spriteSize(sprite);
    // 0.09 s da yassilanadi, so'ng yengil "do'ng" qaytishi
    const q = clamp01(k.age / 0.09);
    const bounce = k.age > 0.09 ? Math.sin(clamp01((k.age - 0.09) / 0.16) * Math.PI) * 0.07 : 0;
    const sy = 1 - 0.76 * q + bounce;
    const sx = 1 + 0.5 * q - bounce;
    const fade = k.dust >= 0 ? clamp01(1 - k.dust / k.fade) : 1;
    c.save();
    c.globalAlpha = fade;
    // yerdagi oltin dog'
    c.fillStyle = withAlpha(T.glow, 0.22);
    c.beginPath();
    c.ellipse(k.x, k.ground, size * 0.5, 4, 0, 0, Math.PI * 2);
    c.fill();
    c.translate(Math.round(k.x), Math.round(k.ground));
    c.scale(sx, sy);
    renderSprite(
      c,
      sprite,
      "idle",
      0,
      0,
      -size * 0.42,
      k.age < 0.07,
      !!k.t.flip,
      false,
      k.t.palette,
    );
    c.restore();
    if (k.dust >= 0) {
      // changga aylanish: yuqoriga ko'tariluvchi oltin tutam
      const u = clamp01(k.dust / k.fade);
      const hgt = Math.round(8 + u * 26);
      c.save();
      c.globalCompositeOperation = "lighter";
      px(c, withAlpha(T.glow, 0.5 * (1 - u)), k.x - 3, k.ground - hgt, 6, hgt);
      px(c, withAlpha(T.edge, 0.7 * (1 - u)), k.x - 1, k.ground - hgt, 2, hgt);
      c.restore();
    }
    if (q >= 1) {
      // "x_x": yotgan mob ustida, changda yuqoriga suzib so'nadi
      const lift = k.dust >= 0 ? k.dust * 26 : 0;
      c.save();
      deadEyes(
        c,
        Math.round(k.x),
        Math.round(k.ground - size * 0.42 * 0.3 - 9 - lift),
        fade,
        T.ink,
      );
      c.restore();
    }
  }

  private renderBubble(
    c: CanvasRenderingContext2D,
    g: { t: SceneTarget; age: number },
    T: SkinTheme,
  ) {
    const live = g.t.live ?? g.t;
    const pop = g.age < 0.08 ? 1 : 0;
    const x = Math.round(live.x) + 7,
      y = Math.round(live.y - g.t.size / 2 - 19) - pop;
    const w = 17,
      h = 9;
    // oq pufakcha, qora kontur, pastida dumcha
    px(c, T.ink, x - 1, y, w + 2, h);
    px(c, T.ink, x, y - 1, w, h + 2);
    px(c, "#ffffff", x, y, w, h);
    px(c, T.ink, x + 1, y + h + 1, 3, 1);
    px(c, T.ink, x, y + h + 2, 2, 1);
    px(c, "#ffffff", x + 1, y + h, 3, 1);
    px(c, "#ffffff", x + 1, y + h + 1, 1, 1);
    glyphs(c, "HI?", x + 3, y + 2, T.ink);
  }
}
