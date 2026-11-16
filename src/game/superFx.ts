/**
 * SUPER TIZIMI CHIZMALARI (hamma superga umumiy; faqat ko'rinish — mantiq super.ts da):
 *  - SuperOrb: SUPER SHARI — dumaloq shisha shar, ichida jonli suyuqlik: sath silliq ko'tariladi,
 *    yuzasi sinus to'lqin bilan tebranadi, o'yinchi yurganda yoki zarba yeganda chayqaladi, ichida
 *    pufakchalar ko'tariladi. To'lganda yorqinlashadi, pulsatsiya qiladi va uchqun sochadi: uchqunlar
 *    tepasidan favvoradek otilib chiqib, yorqin boshi va xira dumi bilan shar yelkasidan oshib
 *    tushadi, gardishida yulduzchalar miltillaydi; hammasi so'nishdan oldin kichrayadi.
 *    Ishlatilganda suyuqlik pastga tortilib bo'shaydi. HUD'da ham, telefon tugmasida ham shu chiziladi.
 *  - renderSuperCard: CUT-IN KARTA — ekran qorayadi, diagonal tasma bo'ylab qahramon portreti
 *    siljib kiradi, super nomi katta piksel harflarda.
 * Ranglar faol skin theme'dan (skinFx.ts): suyuqlik — accent, chuqur qismi — accentDark, yuzasi —
 * glow; uchqunlar — glint (yadro), glow, accent (dum). Xavf ranglari (danger.ts) va "qon" qizili
 * ishlatilmaydi. Math.random ishlatilmaydi — o'yin tasodifiga ta'sir qilmaydi (o'z kichik
 * generatori bor).
 */
import { px } from "./animation";
import { withAlpha } from "./hero";
import type { SkinTheme } from "./skinFx";
import type { SuperCast, SuperDef } from "./super";

/** Bo'shash ("vush") davomiyligi (s) */
export const ORB_DRAIN = 0.5;
/** Pufakchalar soni: oddiy / to'lganda / effektlar kamaytirilganda */
export const ORB_BUBBLES = 5;
export const ORB_BUBBLES_READY = 8;
export const ORB_BUBBLES_REDUCED = 2;
/** Toshib chiqadigan uchqunlar chegarasi */
export const ORB_SPARKS = 10;
export const ORB_SPARKS_REDUCED = 3;

interface Bubble {
  /** Gorizontal joy (−1..1, shar radiusi ulushi) va balandlik (0 — tub, 1 — yuza) */
  x: number;
  y: number;
  v: number;
  phase: number;
  big: boolean;
}

/**
 * Uchqun turlari: CHANG — mayda xira zarra (faqat nuqta va dum), UCHQUN — yorqin boshli: tug'ilganda
 * "+" bo'lib chaqnaydi, YULDUZCHA — gardish ustida deyarli joyida turib bir marta katta "+" bo'lib
 * miltillaydi.
 */
const DUST = 0,
  EMBER = 1,
  STAR = 2;
/**
 * Uchqun uchadigan halqa (markazdan, r = 12 shar uchun): SPARK_RIM — chiqadigan gardish (bundan
 * ichkariga — shisha ustiga tushmaydi, sirtidan sirg'anadi), SPARK_FAR — eng chet koordinata
 * (kvadrat chegara, ORB_PAD ichida — uchqun bufer chetida kesilib qolmaydi).
 */
const SPARK_RIM = 13.2;
const SPARK_FAR = 16.6;
/** Tortishish (favvoradek yoy chizib tushadi) va havo qarshiligi (1/s) */
const SPARK_FALL = 38;
const SPARK_DRAG = 1.6;

interface OrbSpark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  kind: typeof DUST | typeof EMBER | typeof STAR;
}

/** To'lgan shar pulsi: true — shar 1 px ga kattalashgan (t — to'lgandan beri o'tgan vaqt) */
const orbPulse = (t: number) => Math.sin(t * 7) > 0.2;

const hex = (c: string) => {
  const n = parseInt(c.slice(1, 7), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
};

/** Ikki "#rrggbb" rang aralashmasi (k = 0 — a, 1 — b) */
export function mixColor(a: string, b: string, k: number) {
  const [r1, g1, b1] = hex(a),
    [r2, g2, b2] = hex(b);
  const m = (x: number, y: number) => Math.round(x + (y - x) * Math.max(0, Math.min(1, k)));
  return `#${[m(r1, r2), m(g1, g2), m(b1, b2)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** Super shari holati: silliq sath, chayqalish, pufakchalar va uchqunlar. */
export class SuperOrb {
  /** Ko'rsatilayotgan sath 0..1 (haqiqiy zaryadga silliq yaqinlashadi) */
  level = 0;
  /** Yuza qiyaligi (chayqalish) va uning tezligi */
  tilt = 0;
  private tiltV = 0;
  /** To'lqin kuchi 0..1 (yurganda/zarba yeganda oshadi, so'ng tinadi) */
  slosh = 0;
  /** To'lgandan beri o'tgan vaqt (−1 — to'lmagan) */
  readyT = -1;
  /** Bo'shash animatsiyasi: o'tgan vaqt (−1 — yo'q) va boshlangan sath */
  drainT = -1;
  private drainFrom = 0;
  t = 0;
  bubbles: Bubble[] = [];
  sparks: OrbSpark[] = [];
  private sparkT = 0;
  /** Oldingi kadrda puls "kattalashgan" holatda edimi (puls boshida uchqun otiladi) */
  private beat = false;
  private seed = 20261114;

  /** Kichik tasodif generatori (Math.random emas — o'yin tasodifiga tegmaydi) */
  private rnd() {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  private bubble(fromBottom: boolean): Bubble {
    return {
      x: (this.rnd() - 0.5) * 1.3,
      y: fromBottom ? 0 : this.rnd(),
      v: 0.35 + this.rnd() * 0.4,
      phase: this.rnd() * 6.28,
      big: this.rnd() < 0.25,
    };
  }

  /**
   * Yangi uchqun: sharning tepasidan otilib chiqadi. side — tomoni (−1 chap, 1 o'ng): puls uchquni,
   * doim yorqin; 0 — tasodifiy tomon va tur. calm — "Effektlarni kamaytirish": yulduzchasiz.
   */
  private spark(calm: boolean, side = 0): OrbSpark {
    const dir = side || (this.rnd() < 0.5 ? -1 : 1);
    const pick = this.rnd();
    const kind = side ? EMBER : !calm && pick < 0.3 ? STAR : pick < 0.5 ? EMBER : DUST;
    const life = 0.6 + this.rnd() * 0.35;
    if (kind === STAR) {
      // yulduzcha: yuqori yoyda, gardishdan sal narida paydo bo'ladi va deyarli joyida turadi
      const a = dir * this.rnd() * 1.3;
      const rho = SPARK_RIM + this.rnd() * 1.2;
      const v = 1.5 + this.rnd() * 1.5;
      const nx = Math.sin(a),
        ny = -Math.cos(a);
      return { x: nx * rho, y: ny * rho, vx: nx * v, vy: ny * v, life, max: life, kind };
    }
    // tepadan a burchakdagi (6°..52°) nuqtadan chiqadi va radiusdan ko'ra yonroqqa otiladi (b):
    // yelka ustidan yoy chizib o'tib, shar yonidan pastga tushadi
    const a = dir * (0.1 + this.rnd() * 0.8);
    const b = a + dir * (0.25 + this.rnd() * 0.5);
    const v = (14 + this.rnd() * 10) * (kind === DUST ? 0.75 : 1);
    return {
      x: Math.sin(a) * SPARK_RIM,
      y: -Math.cos(a) * SPARK_RIM,
      vx: Math.sin(b) * v,
      vy: -Math.cos(b) * v,
      life,
      max: life,
      kind,
    };
  }

  /** Yangi o'yin: bo'sh shar */
  reset() {
    this.level = 0;
    this.tilt = this.tiltV = this.slosh = 0;
    this.readyT = this.drainT = -1;
    this.bubbles = [];
    this.sparks = [];
  }

  /** Zarba yedi yoki keskin harakat: suyuqlik chayqaladi */
  kick(power = 1) {
    this.tiltV += (this.rnd() < 0.5 ? -1 : 1) * 4 * power;
    this.slosh = Math.min(1, this.slosh + 0.8 * power);
  }

  /** Super ishlatildi: suyuqlik "vush" bilan pastga tortilib bo'shaydi */
  drain() {
    this.drainT = 0;
    this.drainFrom = this.level;
    this.readyT = -1;
    this.sparks = [];
    this.slosh = 1;
  }

  /** Bo'shayapti (0..1 — qancha qismi o'tdi), aks holda −1 */
  get draining() {
    return this.drainT >= 0 ? Math.min(1, this.drainT / ORB_DRAIN) : -1;
  }

  /**
   * ratio — haqiqiy zaryad ulushi, ready — to'lgan, move — o'yinchining gorizontal harakati (−1..1).
   * reduced — "Effektlarni kamaytirish": pufakcha va uchqun kam, puls yo'q.
   */
  update(dt: number, ratio: number, ready: boolean, move = 0, reduced = false) {
    this.t += dt;
    if (this.drainT >= 0) {
      this.drainT += dt;
      const k = Math.min(1, this.drainT / ORB_DRAIN);
      // boshida sekin, oxirida tez — "tortib olinadi"
      this.level = this.drainFrom * (1 - k * k);
      if (k >= 1) {
        this.drainT = -1;
        this.level = 0;
      }
    } else {
      // sakrab emas — silliq ko'tariladi
      this.level += (ratio - this.level) * Math.min(1, dt * 5);
      if (Math.abs(ratio - this.level) < 0.002) this.level = ratio;
    }
    // chayqalish: yurganda suyuqlik orqada qoladi, to'xtaganda tebranib tinadi (so'nuvchi prujina)
    const target = -Math.max(-1, Math.min(1, move)) * 0.2;
    this.tiltV += ((target - this.tilt) * 60 - this.tiltV * 5) * dt;
    this.tilt += this.tiltV * dt;
    this.tilt = Math.max(-0.6, Math.min(0.6, this.tilt));
    this.slosh = Math.max(Math.abs(move) * 0.35, this.slosh - dt * 0.9);
    if (ready && this.drainT < 0) this.readyT = this.readyT < 0 ? 0 : this.readyT + dt;
    else this.readyT = -1;

    const want = reduced ? ORB_BUBBLES_REDUCED : ready ? ORB_BUBBLES_READY : ORB_BUBBLES;
    while (this.bubbles.length < want) this.bubbles.push(this.bubble(false));
    if (this.bubbles.length > want) this.bubbles.length = want;
    // to'lganda pufakchalar tezlashadi
    const speed = ready ? 2.2 : 1;
    for (const b of this.bubbles) {
      b.y += b.v * speed * dt;
      b.phase += dt * 4;
      if (b.y >= 1) Object.assign(b, this.bubble(true));
    }

    // uchqunlar: tepadan otilib chiqib, favvoradek yoy chizadi va shar yonidan pastga tushadi.
    // Shisha ustiga tushmaydi (sirtidan sirg'anadi) va chetdan chiqmaydi — bufer chetida kesilmaydi.
    if (this.sparks.length) {
      const damp = Math.exp(-SPARK_DRAG * dt);
      let alive = 0;
      for (let i = 0; i < this.sparks.length; i++) {
        const s = this.sparks[i]!;
        s.life -= dt;
        if (s.life <= 0) continue;
        s.vx *= damp;
        s.vy *= damp;
        // yulduzcha tortilmaydi — joyida miltillaydi
        if (s.kind !== STAR) s.vy += SPARK_FALL * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        const d2 = s.x * s.x + s.y * s.y;
        if (d2 < SPARK_RIM * SPARK_RIM && d2 > 0.01) {
          // shisha: ichkariga kirmaydi — tezlikning ichkariga qismi yo'qolib, sirt bo'ylab sirg'anadi
          const d = Math.sqrt(d2);
          const nx = s.x / d,
            ny = s.y / d;
          const vn = s.vx * nx + s.vy * ny;
          if (vn < 0) {
            s.vx -= vn * nx;
            s.vy -= vn * ny;
          }
          s.x = nx * SPARK_RIM;
          s.y = ny * SPARK_RIM;
        }
        // chet: undan nariga o'tmaydi (katta "+" bo'ladigan yulduzchaga bir piksel ko'proq joy)
        const far = s.kind === STAR ? SPARK_FAR - 1 : SPARK_FAR;
        if (s.x > far || s.x < -far) {
          s.x = s.x > 0 ? far : -far;
          s.vx = 0;
        }
        if (s.y > far || s.y < -far) {
          s.y = s.y > 0 ? far : -far;
          s.vy = 0;
        }
        // so'nganlari joyida siqib chiqariladi (har kadr yangi massiv yaratilmaydi)
        this.sparks[alive++] = s;
      }
      this.sparks.length = alive;
    }
    if (this.readyT >= 0) {
      // to'lgan shardan uchqunlar toshib chiqadi: har pulsda (shar kattalashgan lahzada) ikki
      // tomonga bittadan otiladi, orada bittadan sizib turadi
      const cap = reduced ? ORB_SPARKS_REDUCED : ORB_SPARKS;
      const beat = !reduced && orbPulse(this.readyT);
      if (beat && !this.beat) {
        if (this.sparks.length < cap) this.sparks.push(this.spark(false, -1));
        if (this.sparks.length < cap) this.sparks.push(this.spark(false, 1));
      }
      this.beat = beat;
      this.sparkT -= dt;
      if (this.sparkT <= 0 && this.sparks.length < cap) {
        this.sparkT = reduced ? 0.5 : 0.12 + this.rnd() * 0.08;
        this.sparks.push(this.spark(reduced));
      }
    } else this.beat = false;
  }
}

/** Doira qatori: dy qatoridagi yarim kenglik (piksel doira) */
function halfWidth(r: number, dy: number) {
  // radius + 0.5: tepa va pastda bir pikselli "do'ngcha" chiqmaydi — doira silliq
  const v = (r + 0.5) * (r + 0.5) - dy * dy;
  return v < 0 ? -1 : Math.floor(Math.sqrt(v));
}

function disk(c: CanvasRenderingContext2D, color: string, cx: number, cy: number, r: number) {
  c.fillStyle = color;
  for (let dy = -r; dy <= r; dy++) {
    const h = halfWidth(r, dy);
    if (h >= 0) c.fillRect(cx - h, cy + dy, h * 2 + 1, 1);
  }
}

/** "+" qo'llari: markazdan d piksel naridagi to'rt nuqta (markazning o'zi chizilmaydi) */
function plus(c: CanvasRenderingContext2D, x: number, y: number, d: number) {
  c.fillRect(x - d, y, 1, 1);
  c.fillRect(x + d, y, 1, 1);
  c.fillRect(x, y - d, 1, 1);
  c.fillRect(x, y + d, 1, 1);
}

/** Shar atrofidagi chet (porlash va uchqunlar uchun), mantiqiy pikselda */
export const ORB_PAD = 6;

/** Shar chiziladigan bufer: har o'lcham uchun bitta (butun sonli piksellar — choksiz) */
const buffers = new Map<number, HTMLCanvasElement | null>();

function buffer(r: number) {
  let b = buffers.get(r);
  if (b === undefined) {
    b = null;
    if (typeof document !== "undefined") {
      const el = document.createElement("canvas");
      el.width = el.height = (r + ORB_PAD) * 2 + 1;
      // jsdom'da kanvas yo'q (sinov) — chizilmaydi
      if (el.getContext("2d")) b = el;
    }
    buffers.set(r, b);
  }
  return b;
}

/**
 * SUPER SHARI. (cx, cy) — markaz, r — tashqi radius (HUD'da 12; telefon tugmasida kattaroq).
 * Qatlamlar: porlash → qora kontur → shisha gardishi va tubi → suyuqlik (chuqur qismi, tanasi,
 * yuza chizig'i) → pufakchalar → shisha yaltirog'i → toshib chiqqan uchqunlar.
 * Avval o'z buferiga butun sonli piksellar bilan chiziladi, so'ng ekranga ko'chiriladi — ekran
 * masshtabi kasr bo'lganda ham (telefon) piksellar orasida chok ko'rinmaydi.
 */
export function renderSuperOrb(
  out: CanvasRenderingContext2D,
  orb: SuperOrb,
  x: number,
  y: number,
  r: number,
  T: SkinTheme,
  reduced = false,
) {
  const buf = buffer(r);
  const c = buf?.getContext("2d");
  if (!buf || !c) return;
  const size = buf.width;
  c.clearRect(0, 0, size, size);
  const cx = r + ORB_PAD,
    cy = r + ORB_PAD;
  const ready = orb.readyT >= 0;
  // to'lganda shar pulsatsiya qiladi (1 px ga kattalashib-kichrayadi)
  const pulse = ready && !reduced && orbPulse(orb.readyT) ? 1 : 0;
  const R = r + pulse;
  const ri = R - 2;
  const k = r / 12;

  if (ready) {
    // tashqi porlash: ikki qavat yumshoq halqa
    const a = reduced ? 0.3 : 0.26 + 0.16 * Math.sin(orb.readyT * 7);
    disk(c, withAlpha(T.glow, a * 0.5), cx, cy, R + 4);
    disk(c, withAlpha(T.glow, a), cx, cy, R + 2);
  }
  // kontur, gardish va shisha tubi
  disk(c, "#0b0a10", cx, cy, R);
  disk(c, ready ? T.glow : "#d9d4e0", cx, cy, R - 1);
  disk(c, "#17121f", cx, cy, ri);
  // shisha tubining pastki-o'ng cheti biroz yorug' (hajm)
  c.fillStyle = "rgba(255,255,255,0.07)";
  for (let dy = 1; dy <= ri; dy++) {
    const h = halfWidth(ri, dy);
    if (h > 1) c.fillRect(cx + h - 1, cy + dy, 1, 1);
  }

  // suyuqlik: har ustun o'z balandligida (to'lqin + qiyalik)
  const level = Math.max(0, Math.min(1, orb.level));
  if (level > 0.015) {
    const body = ready ? mixColor(T.accent, T.glow, 0.38 + 0.2 * Math.sin(orb.t * 7)) : T.accent;
    const deep = ready ? mixColor(T.accentDark, T.accent, 0.55) : T.accentDark;
    const light = mixColor(body, T.glow, 0.5);
    // to'liq sharda ham yuza ko'rinsin: 96% dan yuqoriga chiqmaydi
    const base = cy + ri - level * (2 * ri) * 0.96;
    const amp = (0.55 + 1.9 * orb.slosh) * k;
    const drain = orb.draining;
    // chuqur qism: pastki uchdan bir
    const deepY = cy + Math.round(ri * 0.42);
    for (let dx = -ri; dx <= ri; dx++) {
      const h = halfWidth(ri, dx);
      if (h < 0) continue;
      const wave =
        Math.sin((dx * 0.62) / k + orb.t * 3.1) * amp +
        Math.sin((dx * 1.05) / k - orb.t * 4.6) * amp * 0.45;
      // bo'shayotganda o'rtasi girdobdek cho'kadi
      const funnel =
        drain >= 0 ? (1 - Math.abs(dx) / (ri + 1)) * 5 * k * Math.sin(drain * Math.PI) : 0;
      let top = Math.round(base + wave + orb.tilt * dx + funnel);
      const bottom = cy + h;
      if (top > bottom) continue;
      top = Math.max(cy - h, top);
      const X = cx + dx;
      c.fillStyle = body;
      c.fillRect(X, top, 1, bottom - top + 1);
      // chuqur qismi to'qroq; chegarasi shashka naqshli (bir qator)
      const dark = Math.max(top + 2, deepY + (dx & 1));
      if (dark <= bottom) {
        c.fillStyle = deep;
        c.fillRect(X, dark, 1, bottom - dark + 1);
      }
      // yuza: yorqin chiziq, ostida ochroq qatlam
      if (bottom - top >= 2) {
        c.fillStyle = light;
        c.fillRect(X, top + 1, 1, 1);
      }
      c.fillStyle = T.glow;
      c.fillRect(X, top, 1, 1);
    }
    // pufakchalar: suyuqlik ichida ko'tariladi
    c.fillStyle = withAlpha(T.edge, ready ? 0.95 : 0.8);
    for (const b of orb.bubbles) {
      const bx = Math.round(b.x * ri * 0.72 + Math.sin(b.phase) * 1.2 * k);
      const h = halfWidth(ri, bx);
      if (h < 2) continue;
      const surf = base + orb.tilt * bx;
      const by = Math.round(cy + h - 1 - b.y * (cy + h - 1 - surf));
      if (by <= surf + 2 || by > cy + h - 1) continue;
      const sz = b.big && k >= 1 ? 2 : 1;
      c.fillRect(cx + bx, by, sz, sz);
    }
  }

  // shisha yaltirog'i: chap yuqorida yoy, o'ng pastda xira nuqta
  const g = Math.max(2, Math.round(ri * 0.62));
  c.fillStyle = "rgba(255,255,255,0.9)";
  c.fillRect(cx - g + 1, cy - g + 2, 1, Math.max(2, Math.round(3 * k)));
  c.fillRect(cx - g + 2, cy - g + 1, Math.max(2, Math.round(3 * k)), 1);
  c.fillStyle = "rgba(255,255,255,0.4)";
  c.fillRect(cx - g + 2, cy - g + 2, 1, 1);
  c.fillRect(cx + g - 2, cy + g - 1, 1, 1);

  // toshib chiqayotgan uchqunlar. Uch rang: glint — qaynoq yadro, glow — tana, accent — dum va
  // so'nayotgan zarra. So'nish globalAlpha pog'onalari bilan (har kadr rang satri yaratilmaydi).
  for (const s of orb.sparks) {
    // yoshi: 0 — hozir chiqdi, 1 — so'ndi
    const age = 1 - Math.max(0, s.life / s.max);
    // joyi r = 12 shar uchun hisoblangan; boshqa o'lchamda radius bo'ylab (r − 12) px suriladi:
    // gardishdan masofasi pikselda saqlanadi, ya'ni har qanday sharda ORB_PAD ichida qoladi
    const grow = r === 12 ? 1 : 1 + (r - 12) / Math.max(1, Math.sqrt(s.x * s.x + s.y * s.y));
    const hx = cx + s.x * grow,
      hy = cy + s.y * grow;
    const sx = Math.round(hx),
      sy = Math.round(hy);
    if (reduced) {
      // "Effektlarni kamaytirish": dumsiz va miltillamaydigan, silliq so'nuvchi oddiy nuqta
      if (s.kind === EMBER && age < 0.5) {
        c.globalAlpha = (1 - age) * 0.8;
        c.fillStyle = T.glint;
        plus(c, sx, sy, 1);
      }
      c.globalAlpha = 1 - age;
      c.fillStyle = s.kind === EMBER ? T.glow : T.accent;
      c.fillRect(sx, sy, 1, 1);
      continue;
    }
    if (s.kind === STAR) {
      // yulduzcha: nuqta → "+" → katta "+" → "+" → nuqta (bir marta chaqnab, kichrayib so'nadi)
      const mid = age > 0.14 && age < 0.78;
      const big = age > 0.34 && age < 0.58;
      if (big) {
        c.globalAlpha = 0.7;
        c.fillStyle = T.accent;
        plus(c, sx, sy, 2);
      }
      if (mid) {
        c.globalAlpha = big ? 1 : 0.8;
        c.fillStyle = T.glow;
        plus(c, sx, sy, 1);
      }
      const hot = mid || age <= 0.14;
      c.globalAlpha = hot ? 1 : age < 0.9 ? 0.65 : 0.35;
      c.fillStyle = hot ? T.glint : T.glow;
      c.fillRect(sx, sy, 1, 1);
      continue;
    }
    // hayoti oxirida pog'onalab xiralashadi; uchib borayotganda sal miltillaydi
    const fade = age < 0.72 ? 1 : age < 0.88 ? 0.6 : 0.3;
    const flick = age > 0.3 && (Math.floor(s.life * 16) & 1) === 1 ? 0.75 : 1;
    // dum: tezligiga qarab orqasida 1–2 piksel (sekinlashganda boshiga yig'ilib yo'qoladi)
    const tx = Math.round(hx - s.vx * 0.05),
      ty = Math.round(hy - s.vy * 0.05);
    if (tx !== sx || ty !== sy) {
      const ux = Math.round(hx - s.vx * 0.1),
        uy = Math.round(hy - s.vy * 0.1);
      c.fillStyle = T.accent;
      if (ux !== tx || uy !== ty) {
        c.globalAlpha = 0.35 * fade;
        c.fillRect(ux, uy, 1, 1);
      }
      c.globalAlpha = 0.7 * fade;
      c.fillRect(tx, ty, 1, 1);
    }
    // bosh: uchqun tug'ilganda "+" bo'lib chaqnaydi, so'ng bitta pikselga kichrayadi
    const hot = s.kind === EMBER && age < 0.3;
    if (hot) {
      c.globalAlpha = 0.85;
      c.fillStyle = T.glow;
      plus(c, sx, sy, 1);
    }
    c.globalAlpha = fade * flick;
    c.fillStyle = hot ? T.glint : age < 0.65 ? T.glow : T.accent;
    c.fillRect(sx, sy, 1, 1);
  }
  c.globalAlpha = 1;

  out.imageSmoothingEnabled = false;
  out.drawImage(buf, Math.round(x) - cx, Math.round(y) - cy);
}

// ---------------- cut-in karta ----------------

/** Karta chizishi uchun matn funksiyasi (Game.text) */
export type CardText = (
  s: string,
  x: number,
  y: number,
  size: number,
  color: string,
  align?: CanvasTextAlign,
) => void;

const W = 320,
  H = 240;
const ease = (k: number) => 1 - (1 - Math.min(1, Math.max(0, k))) ** 3;

/**
 * CUT-IN KARTA: ekran qorayadi, diagonal oltin tasma bo'ylab qahramonning katta piksel-art portreti
 * chapdan siljib kiradi, o'ngdan super nomi katta piksel harflarda keladi, tasmada oltin nur
 * chiziqlari yuguradi. k — karta ulushi (0..1). portrait — tayyor portret kanvasi (portrait.ts).
 * "Effektlarni kamaytirish": chaqnash va yuguruvchi chiziqlar yo'q.
 */
export function renderSuperCard(
  c: CanvasRenderingContext2D,
  def: SuperDef,
  cast: Pick<SuperCast, "t" | "cardTime">,
  T: SkinTheme,
  portrait: HTMLCanvasElement | null,
  text: CardText,
  reduced = false,
) {
  const d = Math.max(0.01, cast.cardTime);
  const k = Math.min(1, cast.t / d);
  // kirish (birinchi ~35%) va chiqish (oxirgi ~15%)
  const inK = ease(k / 0.35);
  const out = k > 0.86 ? (k - 0.86) / 0.14 : 0;
  const a = Math.min(1, k / 0.12) * (1 - out);
  c.save();
  px(c, `rgba(4,2,10,${0.78 * a})`, 0, 0, W, H);

  // diagonal tasma: chapda pastroq, o'ngda balandroq (qiyalik ~ −9°)
  const slope = -0.16;
  const mid = 122;
  const half = 44 * Math.min(1, inK * 1.3);
  const yAt = (x: number) => mid + (x - W / 2) * slope;
  c.globalAlpha = a;
  c.beginPath();
  c.moveTo(0, yAt(0) - half);
  c.lineTo(W, yAt(W) - half);
  c.lineTo(W, yAt(W) + half);
  c.lineTo(0, yAt(0) + half);
  c.closePath();
  c.save();
  c.clip();
  const g = c.createLinearGradient(0, yAt(0) - half, 0, yAt(0) + half + 50);
  g.addColorStop(0, withAlpha(T.accentDark, 0.92));
  g.addColorStop(0.5, withAlpha(mixColor(T.accentDark, T.ink, 0.45), 0.96));
  g.addColorStop(1, withAlpha(T.ink, 0.96));
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  // oltin nur chiziqlari: tasma bo'ylab o'ngga yuguradi
  const lines = reduced ? 5 : 11;
  for (let i = 0; i < lines; i++) {
    const seed = (i * 73) % 97;
    const ly = -half + ((seed / 97) * 2 - 1) * 0 + ((i + 0.5) / lines) * half * 2;
    const len = 26 + (seed % 5) * 14;
    const sp = reduced ? 0 : 260 + (seed % 7) * 60;
    const x0 = ((seed * 11 + cast.t * sp) % (W + len * 2)) - len;
    const col = i % 3 === 0 ? T.glow : T.accent;
    c.fillStyle = withAlpha(col, i % 3 === 0 ? 0.5 : 0.28);
    for (let s = 0; s < len; s += 2) {
      const x = x0 + s;
      c.fillRect(Math.round(x), Math.round(yAt(x) + ly), 2, i % 3 === 0 ? 1 : 2);
    }
  }
  c.restore();
  // tasma chetlari: oltin chiziq va yupqa oq yadro
  for (const side of [-1, 1]) {
    for (let x = 0; x < W; x += 2) {
      const y = Math.round(yAt(x) + side * half);
      px(c, T.accent, x, y - (side < 0 ? 2 : 0), 2, 2);
      px(c, T.edge, x, y - (side < 0 ? 0 : -2), 2, 1);
    }
  }

  // portret: chapdan tasma bo'ylab siljib kiradi (2x)
  if (portrait) {
    const size = portrait.width * 2;
    const tx = -size + (size + 6) * inK - out * 30;
    const cxp = tx + size / 2;
    const ty = yAt(cxp) - size / 2 - 6;
    c.imageSmoothingEnabled = false;
    // orqasida yorug'lik halqasi
    if (!reduced) {
      c.fillStyle = withAlpha(T.glow, 0.16 + 0.06 * Math.sin(cast.t * 30));
      c.beginPath();
      c.arc(cxp, ty + size / 2, size * 0.52, 0, Math.PI * 2);
      c.fill();
    }
    c.drawImage(portrait, Math.round(tx), Math.round(ty), size, size);
    // ko'z tirqishidagi yaltirash: kirib bo'lgach bir marta chaqnaydi
    const gk = (k - 0.36) / 0.3;
    if (gk > 0 && gk < 1) {
      const gl = Math.sin(gk * Math.PI);
      const gx = Math.round(tx + size * 0.585),
        gy = Math.round(ty + size * 0.36);
      const len = Math.round(3 + gl * 9);
      px(c, withAlpha(T.edge, gl), gx - len, gy, len * 2 + 1, 1);
      px(c, withAlpha(T.edge, gl), gx, gy - Math.round(len * 0.7), 1, Math.round(len * 1.4) + 1);
      px(c, withAlpha(T.glow, gl), gx - 1, gy - 1, 3, 3);
    }
  }

  // super nomi: o'ngdan keladi, soyali katta piksel harflar; ostida kichik qator
  const nx = 228 + (1 - inK) * 180 + out * 40;
  const ny = Math.round(yAt(nx)) + 2;
  const size = def.name.length > 11 ? 14 : 16;
  text(def.name, nx + 2, ny + 2, size, T.ink);
  text(def.name, nx, ny, size, T.glow);
  // harflar ustidan o'tuvchi yorug' chiziq
  if (!reduced && k > 0.3 && k < 0.8) {
    const sx = nx - 100 + ((k - 0.3) / 0.5) * 200;
    c.save();
    c.globalCompositeOperation = "lighter";
    c.fillStyle = withAlpha(T.edge, 0.35);
    c.beginPath();
    c.moveTo(sx, ny - 18);
    c.lineTo(sx + 10, ny - 18);
    c.lineTo(sx + 2, ny + 4);
    c.lineTo(sx - 8, ny + 4);
    c.closePath();
    c.fill();
    c.restore();
  }
  text(def.card.sub, nx, ny + 14, 6, T.accent);
  px(c, T.accent, Math.round(nx - 60 * inK), ny + 18, Math.round(120 * inK), 1);
  c.globalAlpha = 1;

  // kirishda qisqa oq chaqnash (kamaytirilganda — yo'q)
  if (!reduced && k < 0.1) px(c, `rgba(255,255,255,${0.5 * (1 - k / 0.1)})`, 0, 0, W, H);
  c.restore();
}
