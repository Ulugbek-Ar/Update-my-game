/**
 * 4-dunyo — SAKURA BOG'I ko'rinishi (faqat chizish; to'qnashuv va o'yin mantig'iga ta'sir qilmaydi):
 * kechki bog' maysasi, tosh so'qmoq, hovuz va yog'och ko'prik, devor ortidagi sakura daraxtlari,
 * tosh fonuslar, kechki yorug'lik va doimiy tushayotgan gulbarglar.
 *
 * Pol bir marta chiziladi (Game.buildFloor keshlaydi); fonus nuri, hovuz yaltirashi va gulbarglar —
 * har kadr ustidan chiziladigan yengil qatlam. Gulbarglar holatsiz (vaqtdan hisoblanadi): soni
 * qat'iy chegaralangan, "Effektlarni kamaytirish"da kamayadi.
 */
import { ROOM, px } from "./animation";

/** Pol va devor ranglari (FloorTheme: a, b, grout, wall, wallDark, brick) */
export const SAKURA_COLORS = {
  a: "#2f3f39",
  b: "#2f3f39",
  grout: "#27352f",
  wall: "#3b2a37",
  wallDark: "#2c2030",
  brick: "#4b3646",
} as const;
/** Oni xonasi: qorong'iroq, qizg'ish bog' */
export const SAKURA_BOSS_COLORS = { ...SAKURA_COLORS, a: "#33302f", b: "#33302f" } as const;

/** Tushayotgan gulbarglar soni: odatda va "Effektlarni kamaytirish"da */
export const PETALS = 22;
export const PETALS_REDUCED = 8;
/** Fonuslar turgan joylar (tepa devor) */
export const LANTERN_X = [64, 160, 256] as const;

/** Hovuz (o'ng pastki burchak) va uning ustidagi ko'prik */
const POND = { x: 250, y: 180, rx: 40, ry: 23 };
const BRIDGE = { x: 206, y: 174, w: 88, h: 12 };

const PINK = ["#e0679a", "#ff8fb8", "#ffb3cf", "#ffd6e6"] as const;

type Ctx = CanvasRenderingContext2D;

/** Butun piksel qatorlardan iborat ellips (silliqlashsiz). */
function blob(c: Ctx, cx: number, cy: number, rx: number, ry: number, color: string) {
  for (let y = -ry; y <= ry; y++) {
    const w = Math.round(rx * Math.sqrt(1 - (y / ry) ** 2));
    px(c, color, cx - w, cy + y, w * 2, 1);
  }
}

/** Bitta maysa plitasi: o't tutamlari, to'kilgan gulbarglar, mayda toshlar va gulchalar. */
export function sakuraTile(
  c: Ctx,
  x: number,
  y: number,
  r: number,
  rnd: () => number,
  boss = false,
) {
  // maysa biroz ola-chipor: har plita o'z tusida
  const tone = rnd();
  if (tone < 0.3) px(c, boss ? "#2f2c2b" : "#2b3a34", x, y, 16, 16);
  else if (tone > 0.8) px(c, boss ? "#383433" : "#33453d", x, y, 16, 16);
  const ox = Math.floor(rnd() * 9),
    oy = Math.floor(rnd() * 9);
  if (r < 0.2) {
    // o't tutami
    const g = boss ? "#4a4440" : "#46604e";
    px(c, g, x + ox + 1, y + oy + 2, 1, 3);
    px(c, g, x + ox + 3, y + oy, 1, 5);
    px(c, g, x + ox + 5, y + oy + 2, 1, 3);
  } else if (r < 0.38) {
    // to'kilgan gulbarglar
    px(c, PINK[1], x + ox, y + oy + 3, 2, 1);
    px(c, PINK[3], x + ox + 5, y + oy, 1, 1);
    if (r < 0.28) px(c, PINK[0], x + ox + 3, y + oy + 6, 2, 1);
  } else if (r < 0.44) {
    // tosh
    px(c, "#55586a", x + ox + 1, y + oy + 2, 5, 3);
    px(c, "#7c8092", x + ox + 2, y + oy + 2, 3, 1);
    px(c, "#232a2a", x + ox + 1, y + oy + 5, 5, 1);
  } else if (r < 0.48 && !boss) {
    // oq gulcha
    px(c, "#f4f0f8", x + ox + 2, y + oy + 2, 1, 3);
    px(c, "#f4f0f8", x + ox + 1, y + oy + 3, 3, 1);
    px(c, "#f2c24a", x + ox + 2, y + oy + 3, 1, 1);
  }
}

/** Plitalar ustidan: tosh so'qmoq, hovuz va ko'prik (devorlardan oldin chiziladi). */
export function sakuraDecor(c: Ctx, boss: boolean) {
  // tosh so'qmoq: pastdan tepadagi darvoza tomon ilang-bilang
  const stones: readonly (readonly [number, number])[] = [
    [160, 206],
    [150, 184],
    [164, 162],
    [154, 140],
    [165, 118],
    [156, 96],
    [162, 74],
    [158, 52],
    [160, 32],
  ];
  for (const [i, [sx, sy]] of stones.entries()) {
    const rx = 7 + (i % 2),
      ry = 4;
    blob(c, sx, sy + 1, rx, ry, "#1f2826");
    blob(c, sx, sy, rx, ry, boss ? "#5a5258" : "#666a7c");
    blob(c, sx - 1, sy - 1, rx - 3, ry - 2, boss ? "#72686e" : "#84889a");
    px(c, boss ? "#463f44" : "#4c5062", sx + 2, sy + 1, 3, 1);
  }
  if (boss) {
    // Oni xonasi: hovuz o'rnida kuygan yer va qizil iplar bilan o'ralgan muqaddas doira
    blob(c, 160, 122, 58, 40, "rgba(120,30,34,0.16)");
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      px(c, i % 3 ? "#7a1c1c" : "#c8362e", 160 + Math.cos(a) * 58, 122 + Math.sin(a) * 40, 2, 1);
    }
    return;
  }
  // hovuz: qirg'oq, suv, sayoz joylar
  blob(c, POND.x, POND.y, POND.rx + 2, POND.ry + 2, "#20302c");
  blob(c, POND.x, POND.y, POND.rx, POND.ry, "#1f4c58");
  blob(c, POND.x - 3, POND.y - 2, POND.rx - 8, POND.ry - 7, "#2a6470");
  blob(c, POND.x - 8, POND.y - 5, POND.rx - 22, POND.ry - 15, "#357c84");
  // suv ostidagi toshlar va nilufar barglari
  px(c, "#3b5a5e", POND.x - 22, POND.y + 9, 4, 2);
  px(c, "#3b5a5e", POND.x + 14, POND.y - 12, 3, 2);
  for (const [lx, ly, bloom] of [
    [-24, -6, true],
    [18, 10, false],
    [26, -3, true],
    [-6, 14, false],
  ] as const) {
    px(c, "#2f6a40", POND.x + lx, POND.y + ly, 5, 3);
    px(c, "#4c9458", POND.x + lx + 1, POND.y + ly, 3, 2);
    if (bloom) px(c, PINK[2], POND.x + lx + 2, POND.y + ly, 1, 1);
  }
  // yog'och ko'prik: taxtalar, qizil tutqichlar va ustunchalar
  const b = BRIDGE;
  px(c, "#17201f", b.x, b.y + b.h, b.w, 2);
  px(c, "#6a4226", b.x, b.y, b.w, b.h);
  for (let i = 0; i < b.w; i += 4) {
    // o'rtasi yorug'roq — ko'prik biroz do'ng
    const mid = Math.abs(i - b.w / 2) < b.w / 4;
    px(c, mid ? "#8e5c36" : "#7c4e2e", b.x + i, b.y + 1, 3, b.h - 2);
  }
  px(c, "#8a2420", b.x, b.y - 1, b.w, 2);
  px(c, "#8a2420", b.x, b.y + b.h - 1, b.w, 2);
  px(c, "#c8362e", b.x, b.y - 1, b.w, 1);
  for (let i = 0; i <= b.w - 3; i += 17) {
    px(c, "#5c1614", b.x + i, b.y - 3, 3, 4);
    px(c, "#5c1614", b.x + i, b.y + b.h - 2, 3, 4);
    px(c, "#e0564a", b.x + i, b.y - 3, 3, 1);
  }
}

/** Sakura daraxti toji: pushti to'p-to'p gullar (cx — tana o'rtasi). */
function canopy(c: Ctx, cx: number, top: number, rnd: () => number) {
  for (const [dx, dy, rx, ry] of [
    [-13, 7, 9, 5],
    [12, 8, 10, 5],
    [0, 4, 13, 7],
    [-6, 11, 9, 4],
    [7, 12, 8, 4],
  ] as const) {
    blob(c, cx + dx, top + dy + 1, rx, ry, PINK[0]);
    blob(c, cx + dx, top + dy, rx, ry - 1, PINK[1]);
    blob(c, cx + dx - 1, top + dy - 1, rx - 3, Math.max(1, ry - 3), PINK[2]);
  }
  for (let i = 0; i < 10; i++)
    px(c, PINK[3], cx - 18 + Math.floor(rnd() * 36), top + 2 + Math.floor(rnd() * 12), 1, 1);
}

/**
 * Devorlar: bambuk to'siq, tepada tosh fonuslar, devor ortidan egilgan sakura daraxtlari.
 * Oni xonasida o'rtadagi fonus o'rnida qizil torii darvozasi turadi.
 */
export function sakuraWalls(c: Ctx, boss: boolean, rnd: () => number) {
  const W = ROOM.wall;
  // tepa devor: to'q suvoq va yog'och to'sin
  px(c, "#4a3442", 0, 0, ROOM.w, W);
  px(c, "#2a1d28", 0, W - 3, ROOM.w, 3);
  px(c, "#5c4252", 0, 0, ROOM.w, 2);
  for (let x = 6; x < ROOM.w; x += 20) px(c, "#3b2a37", x, 2, 2, W - 5);
  // yon va pastki devor: bambuk to'siq
  const bamboo = (x: number, y: number, w: number, h: number, vertical: boolean) => {
    px(c, "#3c5238", x, y, w, h);
    if (vertical) {
      px(c, "#5a7a4c", x + 1, y, 1, h);
      for (let k = 3; k < h; k += 7) px(c, "#27382a", x, y + k, w, 1);
    } else {
      px(c, "#5a7a4c", x, y + 1, w, 1);
      for (let k = 3; k < w; k += 7) px(c, "#27382a", x + k, y, 1, h);
    }
  };
  px(c, "#22301f", 0, W, W, ROOM.h - W);
  px(c, "#22301f", ROOM.w - W, W, W, ROOM.h - W);
  px(c, "#22301f", 0, ROOM.h - W, ROOM.w, W);
  for (let x = 1; x < W - 2; x += 5) {
    bamboo(x, W, 4, ROOM.h - W, true);
    bamboo(ROOM.w - W + x, W, 4, ROOM.h - W, true);
  }
  for (let x = 0; x < ROOM.w; x += 5) bamboo(x, ROOM.h - W + 1, 4, W - 1, true);
  // to'siqni bog'lab turgan ko'ndalang xodalar
  bamboo(0, ROOM.h - W + 4, ROOM.w, 3, false);
  bamboo(2, 70, W - 4, 3, false);
  bamboo(2, 150, W - 4, 3, false);
  bamboo(ROOM.w - W + 2, 70, W - 4, 3, false);
  bamboo(ROOM.w - W + 2, 150, W - 4, 3, false);
  // sakura daraxtlari: tanasi devorda, toji xona ustiga biroz egilgan
  for (const tx of boss ? [26, 294] : [26, 110, 210, 294]) {
    px(c, "#2a1a14", tx - 3, 3, 7, W - 2);
    px(c, "#4a3022", tx - 2, 3, 3, W - 2);
    px(c, "#2a1a14", tx + 3, 8, 6, 2);
    canopy(c, tx, -2, rnd);
  }
  // fonuslar (nuri har kadr alohida chiziladi) yoki Oni darvozasi
  for (const lx of LANTERN_X) {
    if (boss && lx === 160) continue;
    px(c, "#3c3e4c", lx - 4, 12, 8, 3);
    px(c, "#5c6072", lx - 3, 5, 6, 7);
    px(c, "#2a2c38", lx - 2, 6, 4, 5);
    px(c, "#7c8092", lx - 5, 3, 10, 2);
    px(c, "#9a9eb0", lx - 3, 1, 6, 2);
    px(c, "#5c6072", lx - 1, 0, 2, 1);
  }
  if (boss) {
    px(c, "#7a1c1c", 141, 2, 4, W - 2);
    px(c, "#7a1c1c", 175, 2, 4, W - 2);
    px(c, "#c8362e", 142, 2, 2, W - 2);
    px(c, "#c8362e", 176, 2, 2, W - 2);
    px(c, "#2a1418", 134, 0, 52, 2);
    px(c, "#d8483a", 136, 2, 48, 3);
    px(c, "#a02822", 139, 8, 42, 2);
    px(c, "#120a10", 146, 10, 28, W - 10);
  }
}

/**
 * Har kadr: fonus alangasi va nuri, hovuz yaltirashi, kechki yorug'lik (tepadan iliq shafaq).
 * boss — Oni xonasi (hovuz yo'q, o'rtada darvoza).
 */
export function renderSakuraLights(c: Ctx, time: number, boss: boolean) {
  // kechki shafaq: tepadan iliq pushti-to'q sariq nur
  const sky = c.createLinearGradient(0, 0, 0, 130);
  sky.addColorStop(0, boss ? "rgba(255,90,60,0.14)" : "rgba(255,150,110,0.13)");
  sky.addColorStop(1, "rgba(255,150,110,0)");
  c.fillStyle = sky;
  c.fillRect(0, 0, ROOM.w, 130);
  for (const [i, lx] of LANTERN_X.entries()) {
    if (boss && lx === 160) continue;
    const fl = Math.sin(time * 7 + i * 2) + Math.sin(time * 11 + i);
    const g = c.createRadialGradient(lx, 10, 2, lx, 10, 44 + fl * 2);
    g.addColorStop(0, "rgba(255,205,120,0.24)");
    g.addColorStop(1, "rgba(255,205,120,0)");
    c.fillStyle = g;
    c.fillRect(lx - 50, 0, 100, 60);
    px(c, fl > 0 ? "#ffd27a" : "#ffb85a", lx - 2, 6, 4, 5);
    px(c, "#fff2c0", lx - 1, 7 + (fl > 0.6 ? 0 : 1), 2, 2);
  }
  if (boss) return;
  // hovuz: sekin siljiydigan yaltiroq chiziqchalar
  for (let i = 0; i < 6; i++) {
    const k = (time * 0.12 + i * 0.37) % 1;
    const a = Math.sin(k * Math.PI);
    if (a < 0.25) continue;
    const gx = POND.x - 26 + ((i * 23) % 52) + k * 6,
      gy = POND.y - 13 + ((i * 11) % 27);
    // ko'prik ostidagi suvda yaltirash ko'rinmaydi
    if (gy > BRIDGE.y - 3 && gy < BRIDGE.y + BRIDGE.h + 2) continue;
    c.globalAlpha = 0.25 + 0.45 * a;
    px(c, "#bfe9e6", gx, gy, 3, 1);
  }
  c.globalAlpha = 1;
}

/**
 * Doimiy tushayotgan gulbarglar: n ta, holatsiz (vaqtdan hisoblanadi) — zarrachalar chegarasiga
 * ta'sir qilmaydi. Har gulbarg pastga tushadi, shamolda o'ngga suriladi va tebranadi.
 */
export function renderPetals(c: Ctx, time: number, n: number) {
  for (let i = 0; i < n; i++) {
    const fall = 9 + ((i * 7) % 9);
    const y = ((time * fall + i * 53) % (ROOM.h + 12)) - 6;
    const drift = time * (5 + (i % 5)) + Math.sin(time * (0.8 + (i % 4) * 0.2) + i) * 9;
    const x = (((i * 97 + drift) % ROOM.w) + ROOM.w) % ROOM.w;
    const tw = Math.sin(time * 3 + i * 1.3);
    c.globalAlpha = 0.5 + 0.3 * tw;
    px(c, i % 3 ? PINK[2] : PINK[3], x, y, tw > 0 ? 2 : 1, 1);
  }
  c.globalAlpha = 1;
}
