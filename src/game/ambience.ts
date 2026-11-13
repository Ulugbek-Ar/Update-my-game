/**
 * MUHIT ANIMATSIYA QATLAMI (v3.8). Plitalar qayta chizilmaydi — tayyor pol ustidan yengil,
 * holatsiz (vaqtdan hisoblanadigan) qatlam: mash'ala nuri polda miltillaydi, o't tutamlari
 * tebranadi, muz yaltiraydi, havoda cho'g', barg va chang zarralari suzadi.
 *
 * Faqat ko'rinish: to'qnashuv va o'yin mantig'iga ta'sir qilmaydi; Math.random ishlatilmaydi
 * (zarralar joyi indeks va vaqtdan hisoblanadi), shuning uchun zarrachalar chegarasiga (Effects)
 * ham yuk bo'lmaydi. Soni qat'iy (AMBIENCE_MAX), "Effektlarni kamaytirish"da uchdan biriga tushadi
 * va miltillash to'xtaydi. Sakura bog'ining gulbarglari va hovuzi — sakura.ts da.
 */
import { ROOM, px } from "./animation";
import type { World } from "./waves";

type Ctx = CanvasRenderingContext2D;

/** Bir dunyodagi muhit zarralari soni (turi bo'yicha) */
export interface AmbienceSet {
  /** tebranuvchi o't tutamlari (yerda) */
  grass: number;
  /** muz yaltirashi (yerda) */
  glints: number;
  /** yuqoriga suzuvchi cho'g'lar */
  embers: number;
  /** tushayotgan barglar */
  leaves: number;
  /** havodagi chang zarralari */
  motes: number;
}

/** Bir kadrda chiziladigan muhit zarralarining eng ko'p soni */
export const AMBIENCE_MAX = 40;

export function ambienceSet(world: World, boss: boolean, reduced: boolean): AmbienceSet {
  const base: AmbienceSet =
    world === 1
      ? { grass: 0, glints: 0, embers: boss ? 16 : 9, leaves: 0, motes: 8 }
      : world === 2
        ? { grass: 0, glints: 12, embers: 0, leaves: 0, motes: 5 }
        : world === 3
          ? { grass: 14, glints: 0, embers: 0, leaves: 8, motes: 5 }
          : { grass: 12, glints: 0, embers: boss ? 8 : 0, leaves: 0, motes: 5 };
  if (!reduced) return base;
  const cut = (n: number) => Math.ceil(n / 3);
  return {
    grass: cut(base.grass),
    glints: cut(base.glints),
    embers: cut(base.embers),
    leaves: cut(base.leaves),
    motes: 0,
  };
}

export function ambienceTotal(s: AmbienceSet) {
  return s.grass + s.glints + s.embers + s.leaves + s.motes;
}

/** Deterministik "tasodif": i-zarra uchun 0..1 (salt — qaysi xossa) */
function rnd(i: number, salt: number) {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

const W = ROOM.wall;
const TORCH_X = [64, 160, 256] as const;

/** Mash'ala ostidagi polda iliq nur dog'i: alanga bilan birga miltillaydi. */
function torchPools(c: Ctx, time: number, reduced: boolean) {
  for (const [i, tx] of TORCH_X.entries()) {
    const fl = reduced ? 0 : (Math.sin(time * 9 + i * 2) + Math.sin(time * 13.7 + i)) / 2;
    c.save();
    c.translate(tx, W);
    c.scale(1, 1.5);
    const g = c.createRadialGradient(0, 0, 2, 0, 0, 40 + fl * 3);
    g.addColorStop(0, `rgba(255,170,70,${0.13 + 0.03 * fl})`);
    g.addColorStop(1, "rgba(255,170,70,0)");
    c.fillStyle = g;
    c.fillRect(-46, 0, 92, 46);
    c.restore();
  }
}

/** Sakura bog'ida o't hovuz, ko'prik va tosh so'qmoq ustiga chizilmaydi */
function onSakuraDecor(x: number, y: number) {
  return (x > 200 && y > 148) || Math.abs(x - 160) < 18;
}

/**
 * Yerdagi qatlam (poldan keyin, jonzotlardan oldin): mash'ala nuri, o't tutamlari, muz yaltirashi.
 */
export function renderGroundAmbience(
  c: Ctx,
  world: World,
  time: number,
  boss: boolean,
  reduced: boolean,
) {
  const s = ambienceSet(world, boss, reduced);
  if (world === 1) torchPools(c, time, reduced);
  for (let i = 0; i < s.grass; i++) {
    const x = W + 6 + Math.floor(rnd(i, 1) * (ROOM.w - 2 * W - 16));
    const y = W + 16 + Math.floor(rnd(i, 2) * (ROOM.h - 2 * W - 24));
    if (world === 4 && onSakuraDecor(x, y)) continue;
    // poyasi joyida, uchi shamolda tebranadi
    const sway = reduced ? 0 : Math.round(Math.sin(time * 1.6 + i * 1.9) * 1.2);
    const col =
      world === 3
        ? i % 2
          ? "#3f6a34"
          : "#2f5228"
        : boss
          ? "#55504c"
          : i % 2
            ? "#587a5e"
            : "#4a6652";
    px(c, col, x, y - 1, 1, 2);
    px(c, col, x + sway, y - 3, 1, 2);
    px(c, col, x + 2, y - 2, 1, 3);
    px(c, col, x + 2 + sway, y - 5, 1, 3);
    px(c, col, x + 4, y - 1, 1, 2);
    px(c, col, x + 4 + sway, y - 3, 1, 2);
  }
  for (let i = 0; i < s.glints; i++) {
    // joyida miltillovchi uchqun: ko'pincha ko'rinmaydi, ba'zan yulduzcha bo'lib chaqnaydi
    const tw = reduced ? 0.7 : Math.sin(time * (1.4 + rnd(i, 5)) + i * 2.3);
    if (tw < 0.55) continue;
    const x = W + 8 + Math.floor(rnd(i, 3) * (ROOM.w - 2 * W - 16));
    const y = W + 10 + Math.floor(rnd(i, 4) * (ROOM.h - 2 * W - 20));
    c.globalAlpha = ((tw - 0.55) / 0.45) * 0.8;
    px(c, "#ffffff", x, y, 1, 1);
    if (tw > 0.85) {
      px(c, "#dff3ff", x - 1, y, 3, 1);
      px(c, "#dff3ff", x, y - 1, 1, 3);
    }
  }
  c.globalAlpha = 1;
}

/**
 * Havodagi qatlam (jonzotlardan keyin): cho'g'lar yuqoriga suzadi, barglar qiya tushadi, chang
 * zarralari sekin suzadi.
 */
export function renderAirAmbience(
  c: Ctx,
  world: World,
  time: number,
  boss: boolean,
  reduced: boolean,
) {
  const s = ambienceSet(world, boss, reduced);
  for (let i = 0; i < s.embers; i++) {
    const life = 3.2 + rnd(i, 3) * 2.4;
    const k = ((time + rnd(i, 4) * life) % life) / life;
    const x = W + rnd(i, 6) * (ROOM.w - 2 * W) + Math.sin(time * 1.3 + i) * 5;
    const y = ROOM.h - W - k * (ROOM.h - 2 * W) * (0.5 + rnd(i, 7) * 0.5);
    c.globalAlpha = Math.sin(k * Math.PI) * 0.75;
    px(c, k < 0.5 ? "#ffb84a" : "#ff7a2a", x, y, 1, 1);
  }
  for (let i = 0; i < s.leaves; i++) {
    const fall = 10 + rnd(i, 8) * 8;
    const y = ((time * fall + i * 47) % (ROOM.h + 10)) - 5;
    const drift = i * 89 + time * (7 + (i % 4) * 2) + Math.sin(time * 1.1 + i) * 8;
    const x = ((drift % ROOM.w) + ROOM.w) % ROOM.w;
    const tw = Math.sin(time * 2.4 + i * 1.7);
    c.globalAlpha = 0.6 + 0.25 * tw;
    px(c, i % 3 === 0 ? "#8a6a34" : i % 3 === 1 ? "#5f8f3f" : "#b89a4a", x, y, tw > 0 ? 2 : 1, 1);
  }
  for (let i = 0; i < s.motes; i++) {
    const x = W + ((rnd(i, 9) * 260 + time * (2 + rnd(i, 10) * 2)) % (ROOM.w - 2 * W));
    const span = ROOM.h - 2 * W - 12;
    const y = W + 6 + ((rnd(i, 11) * 180 + Math.sin(time * 0.5 + i * 2.1) * 10 + 200) % span);
    c.globalAlpha = 0.14 + 0.12 * Math.sin(time * 0.9 + i * 1.3);
    px(c, world === 2 ? "#ffffff" : "#e8dcc8", x, y, 1, 1);
  }
  c.globalAlpha = 1;
}
