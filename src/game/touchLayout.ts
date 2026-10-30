/**
 * Sensor boshqaruvi joylashuvi (sof hisob, DOM'siz — test qilinadi). Koordinatalar — CSS piksel,
 * butun ekran (viewport) bo'yicha; elementlar doim xavfsiz hudud (telefon kesigi) ichida turadi.
 * Foydalanuvchi joylashtirgan elementlar xavfsiz hudud o'lchamiga nisbatan (0–1) saqlanadi —
 * boshqa o'lchamli telefonda ham shu nisbatda turadi.
 */
import type { Hero } from "./hero";
import type { ControlId, ControlPos, TouchSettings } from "./settings";

export interface Insets {
  l: number;
  r: number;
  t: number;
  b: number;
}

export interface Viewport {
  w: number;
  h: number;
  safe: Insets;
}

/** Element markazi va diametri */
export interface Placed {
  x: number;
  y: number;
  size: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Past gorizontal ekran (~360–412 px): asl o'lchamlar kichikroq (v2.4 dagi CSS bilan bir xil) */
export function compactScreen(vp: Viewport) {
  return vp.h <= 450;
}

/** 100% dagi diametrlar, px */
const BASE: Record<ControlId, [normal: number, compact: number]> = {
  stick: [128, 80],
  attack: [80, 64],
  dash: [56, 48],
  reload: [44, 40],
  pause: [40, 32],
  interact: [56, 48],
  journal: [40, 32],
  map: [40, 32],
};

/** Chapaqay rejimida ko'zgudek almashadigan elementlar (pauza, jurnal, xarita yuqori o'ngda qoladi) */
export const MIRRORED: ReadonlySet<ControlId> = new Set([
  "stick",
  "attack",
  "dash",
  "reload",
  "interact",
]);

export function controlSize(id: ControlId, ts: TouchSettings, vp: Viewport) {
  const base = BASE[id][compactScreen(vp) ? 1 : 0];
  return Math.round((base * (id === "stick" ? ts.stickSize : ts.buttonSize)) / 100);
}

export function safeRect(vp: Viewport): Rect {
  const { l, r, t, b } = vp.safe;
  return { x: l, y: t, w: Math.max(1, vp.w - l - r), h: Math.max(1, vp.h - t - b) };
}

/** Markazni shunday cheklaydiki, element butunlay xavfsiz hudud ichida qoladi. */
export function clampCenter(x: number, y: number, size: number, vp: Viewport) {
  const s = safeRect(vp);
  const fit = (v: number, lo: number, len: number) =>
    len <= size ? lo + len / 2 : Math.max(lo + size / 2, Math.min(lo + len - size / 2, v));
  return { x: fit(x, s.x, s.w), y: fit(y, s.y, s.h) };
}

/** Asl joylashuv (v2.4 dagi CSS'ga yaqin); chapaqayda joystik o'ngda, tugmalar chapda. */
export function defaultPos(id: ControlId, ts: TouchSettings, vp: Viewport) {
  const compact = compactScreen(vp);
  const pad = compact ? 12 : 24;
  const { w, h, safe } = vp;
  const left = ts.leftHanded && MIRRORED.has(id);
  // elementning chetdan masofasi: kamida pad, kesik bo'lsa — kesikdan keyin
  const edgeX = (size: number, fromLeft: boolean) =>
    fromLeft ? Math.max(pad, safe.l) + size / 2 : w - Math.max(pad, safe.r) - size / 2;
  const padB = Math.max(pad, safe.b);
  // past HUD qatori (urinish, oltin) ochiq qolsin
  const lift = compact ? 24 : 0;
  if (id === "stick") {
    const S = controlSize("stick", ts, vp);
    return { x: edgeX(S, !ts.leftHanded), y: h - padB - lift - S / 2 };
  }
  if (id === "pause" || id === "journal" || id === "map") {
    const P = controlSize(id, ts, vp);
    const x0 = w - Math.max(12, safe.r) - P / 2;
    const k = id === "pause" ? 0 : id === "journal" ? 1.25 : 2.5;
    return { x: x0 - k * P, y: Math.max(12, safe.t) + P / 2 };
  }
  const A = controlSize("attack", ts, vp);
  const ax = edgeX(A, left);
  const ay = h - padB - (compact ? 24 : 8) - A / 2;
  // tugmalar hujum tugmasi atrofida; "ichkari" — ekran o'rtasi tomoni
  const inward = left ? 1 : -1;
  if (id === "attack") return { x: ax, y: ay };
  if (id === "dash") return { x: ax + inward * 0.7 * A, y: ay - 1.15 * A };
  if (id === "reload") return { x: ax - inward * 0.2 * A, y: ay - 1.15 * A };
  return { x: ax + inward * 1.05 * A, y: ay + 0.05 * A };
}

/** Element joyi va o'lchami: foydalanuvchi joylashtirgan bo'lsa — nisbatdan, aks holda asl joy. */
export function placeControl(id: ControlId, ts: TouchSettings, vp: Viewport): Placed {
  const size = controlSize(id, ts, vp);
  const custom = ts.layout[id];
  let pos: { x: number; y: number };
  if (custom) {
    const s = safeRect(vp);
    const fx = ts.leftHanded && MIRRORED.has(id) ? 1 - custom.x : custom.x;
    pos = { x: s.x + fx * s.w, y: s.y + custom.y * s.h };
  } else pos = defaultPos(id, ts, vp);
  return { ...clampCenter(pos.x, pos.y, size, vp), size };
}

/** Ekrandagi markaz -> saqlanadigan nisbat (chapaqayda ko'zgudan qaytariladi). */
export function toFraction(id: ControlId, x: number, y: number, ts: TouchSettings, vp: Viewport) {
  const s = safeRect(vp);
  const round = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 10000) / 10000;
  const fx = (x - s.x) / s.w;
  return {
    x: round(ts.leftHanded && MIRRORED.has(id) ? 1 - fx : fx),
    y: round((y - s.y) / s.h),
  } satisfies ControlPos;
}

/** Suzuvchi joystik hududi: ekranning chap yarmi (chapaqayda — o'ng yarmi). */
export function floatingZone(ts: TouchSettings, vp: Viewport): Rect {
  const half = vp.w / 2;
  return { x: ts.leftHanded ? half : 0, y: 0, w: half, h: vp.h };
}

export function inRect(r: Rect, x: number, y: number) {
  return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
}

/** Suzuvchi joystik barmoq tekkan joyda paydo bo'ladi (ekran chetida — sig'adigan qilib). */
export function floatingCenter(x: number, y: number, size: number, vp: Viewport) {
  return clampCenter(x, y, size, vp);
}

/**
 * Joystik siljishi -> yurish yo'nalishi. Har o'q bo'yicha o'lik zonadan kam surilsa — 0
 * (asl 25% — v2.4 gacha bo'lgan xatti-harakat). knob — dastakning markazdan siljishi.
 */
export function stickAxis(dx: number, dy: number, radius: number, deadzone: number) {
  const l = Math.hypot(dx, dy);
  if (l > radius && l > 0) {
    dx = (dx / l) * radius;
    dy = (dy / l) * radius;
  }
  const t = deadzone / 100;
  const ax = radius > 0 ? dx / radius : 0,
    ay = radius > 0 ? dy / radius : 0;
  return {
    x: Math.abs(ax) > t ? ax : 0,
    y: Math.abs(ay) > t ? ay : 0,
    knob: { x: dx, y: dy },
  };
}

// ---- tugma yozuvlari: tugma ichiga sig'adi, sig'masa — kod bilan chizilgan ikonka ----

/** Shundan kichik shrift o'qilmaydi — o'rniga ikonka */
export const MIN_LABEL_FONT = 4;
const MIN_SUB_FONT = 3.5;

/**
 * Dumaloq tugma ichiga sig'adigan shrift o'lchami (Press Start 2P: har harf eni 1em).
 * sub — ikkinchi kichik qator (sig'masa tashlab ketiladi). Asosiy yozuv sig'masa — null (ikonka).
 */
export function fitLabel(
  diameter: number,
  main: string,
  sub?: string,
): { main: number; sub: number } | null {
  const r = (diameter - 4) / 2 - 1.5;
  const chord = (y: number) => (Math.abs(y) >= r ? 0 : 2 * Math.sqrt(r * r - y * y));
  const edge = (top: number, h: number) => Math.max(Math.abs(top), Math.abs(top + h));
  for (let f = Math.min(14, diameter * 0.17); f >= MIN_LABEL_FONT; f -= 0.25) {
    const fs = sub ? f * 0.72 : 0;
    if (sub && fs < MIN_SUB_FONT) break;
    const gap = sub ? f * 0.35 : 0;
    const top = -(f + gap + fs) / 2;
    if (main.length * f > chord(edge(top, f))) continue;
    if (sub && sub.length * fs > chord(edge(top + f + gap, fs))) continue;
    const round = (v: number) => Math.round(v * 100) / 100;
    return { main: round(f), sub: round(fs) };
  }
  return sub ? fitLabel(diameter, main) : null;
}

export type TouchIcon =
  | "sword"
  | "orb"
  | "arrow"
  | "bullet"
  | "dash"
  | "teleport"
  | "jump"
  | "slide"
  | "talk"
  | "book"
  | "map";

export interface ButtonLabel {
  text: string;
  /** Ikkinchi qator (bosib turish) */
  sub?: string;
  aria: string;
  icon: TouchIcon;
}

/** To'rtala qahramonning hujum va qobiliyat tugmalari */
export function touchLabels(hero: Hero): Record<"attack" | "dash", ButtonLabel> {
  switch (hero) {
    case "mage":
      return {
        attack: { text: "SHAR", aria: "Sehrli shar", icon: "orb" },
        dash: { text: "TELEPORT", aria: "Teleport", icon: "teleport" },
      };
    case "hunter":
      return {
        attack: { text: "O'Q", aria: "O'q", icon: "arrow" },
        dash: { text: "SAKRASH", sub: "tursa: tuzoq", aria: "Sakrash", icon: "jump" },
      };
    case "gunner":
      return {
        attack: { text: "O'Q", aria: "O'q", icon: "bullet" },
        dash: { text: "SIRPANISH", sub: "tursa: tutun", aria: "Sirpanish", icon: "slide" },
      };
    default:
      return {
        attack: { text: "ZARBA", aria: "Hujum", icon: "sword" },
        dash: { text: "DASH", aria: "Dash", icon: "dash" },
      };
  }
}

/** Olam tugmalari */
export const REALM_LABELS: Record<"interact" | "journal" | "map", ButtonLabel> = {
  interact: { text: "GAPLASH", aria: "Gaplashish", icon: "talk" },
  journal: { text: "JURNAL", aria: "Topshiriqlar jurnali", icon: "book" },
  map: { text: "XARITA", aria: "Xarita", icon: "map" },
};
