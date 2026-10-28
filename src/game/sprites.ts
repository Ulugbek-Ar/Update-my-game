import type { AnimState } from "./animation";

export type SpriteKind =
  | "knight"
  | "mage"
  | "skeleton"
  | "archer"
  | "shield"
  | "demon"
  | "slime"
  | "bat"
  | "frost"
  | "golem"
  | "iceblob"
  | "wolf"
  | "queen";
type Point = readonly [number, number];
type Pose = {
  bob: number;
  lean: number;
  leftFoot: Point;
  rightFoot: Point;
  hand: Point;
  tip: Point;
  otherHand: Point;
};

// Every entry is a separately rasterized pose, not a shifted copy of a sprite.
const poses: Record<"idle" | "walk" | "attack" | "hurt", readonly Pose[]> = {
  idle: [
    {
      bob: 0,
      lean: 0,
      leftFoot: [12, 27],
      rightFoot: [20, 27],
      hand: [23, 19],
      tip: [27, 28],
      otherHand: [9, 19],
    },
    {
      bob: 1,
      lean: 0,
      leftFoot: [12, 27],
      rightFoot: [20, 27],
      hand: [24, 20],
      tip: [28, 28],
      otherHand: [8, 20],
    },
  ],
  walk: [
    {
      bob: 0,
      lean: 0,
      leftFoot: [10, 28],
      rightFoot: [20, 25],
      hand: [24, 18],
      tip: [28, 26],
      otherHand: [8, 21],
    },
    {
      bob: -1,
      lean: 0,
      leftFoot: [13, 26],
      rightFoot: [19, 26],
      hand: [23, 19],
      tip: [27, 28],
      otherHand: [9, 19],
    },
    {
      bob: 0,
      lean: 0,
      leftFoot: [12, 25],
      rightFoot: [22, 28],
      hand: [22, 21],
      tip: [26, 29],
      otherHand: [8, 17],
    },
    {
      bob: 1,
      lean: 0,
      leftFoot: [13, 27],
      rightFoot: [19, 27],
      hand: [24, 20],
      tip: [28, 27],
      otherHand: [9, 20],
    },
  ],
  attack: [
    {
      bob: -1,
      lean: -1,
      leftFoot: [11, 28],
      rightFoot: [21, 26],
      hand: [23, 11],
      tip: [19, 2],
      otherHand: [8, 18],
    },
    {
      bob: 1,
      lean: 2,
      leftFoot: [11, 26],
      rightFoot: [22, 28],
      hand: [24, 19],
      tip: [30, 25],
      otherHand: [11, 19],
    },
    {
      bob: 0,
      lean: 1,
      leftFoot: [12, 27],
      rightFoot: [20, 27],
      hand: [23, 21],
      tip: [27, 29],
      otherHand: [9, 20],
    },
  ],
  hurt: [
    {
      bob: 1,
      lean: -3,
      leftFoot: [12, 28],
      rightFoot: [22, 27],
      hand: [21, 21],
      tip: [29, 27],
      otherHand: [6, 16],
    },
  ],
};

// Five colors each, including the ink outline. White is only a damage effect.
export const PALETTES: Record<SpriteKind, readonly string[]> = {
  knight: ["#080e19", "#183b62", "#287faf", "#68cde4", "#c5e4ec"],
  // Sehrgar: siyoh, qora to'n, to'q qizil (astar, kamar, tasma, kristall), kumushrang soqol, teri
  mage: ["#050307", "#2b1c2e", "#a3192a", "#d9d4e0", "#e8c39e"],
  skeleton: ["#101015", "#747b82", "#d6d9cf", "#935331", "#bd8250"],
  // Kamonchi — "qora suyak": ko'mir suyak, binafsha polda ko'rinadigan yaltiroq, to'q yog'och, qizil ko'z
  archer: ["#050507", "#1d1c26", "#8a88a3", "#4a2c18", "#ff3b3b"],
  // Muz qalqonli skelet (2-dunyo): ko'kish suyak soyasi, ayozli oq suyak, muz qoplagan qalqon, sovuq gardish va tig'
  shield: ["#0d1b2a", "#6f8fab", "#e8f4fb", "#5b9fd6", "#c6ecff"],
  demon: ["#170b11", "#681e2b", "#b23238", "#f4cb45", "#a7a3a0"],
  slime: ["#0b1a10", "#2c7a3c", "#5bc85b", "#a6f08e", "#f2fbe4"],
  bat: ["#120a1a", "#4a2470", "#8a4fc0", "#c99ae8", "#ffe14d"],
  // 2-dunyo. Muz ruhi: ko'k-oq arvoh, ko'zlarida sovuq yorug'lik
  frost: ["#0d1b2a", "#5d8fb8", "#9fd0ef", "#e6f6ff", "#7fe9ff"],
  // Qor odam (kind "golem"): ko'mir, qor soyasi, qor, sabzi, yog'och chelak va shox qo'llar
  golem: ["#141821", "#9db7cc", "#f4f9ff", "#ff8a2a", "#5a3a22"],
  // Muz slime: to'q muz, och ko'k shaffof tana, yaltiroq, ichidagi kristall
  iceblob: ["#0b1a2e", "#3f86c2", "#a3dcf7", "#eefaff", "#2fc6f0"],
  // Qor bo'risi: to'q kulrang yag'ir, kulrang, oq ko'krak, muz ko'k ko'z
  wolf: ["#13161d", "#5a6372", "#a7b0bd", "#eef2f6", "#5fe3ff"],
  // Qor Malikasi: siyoh, to'q ko'k soch va burmalar, oqish-ko'k ko'ylak, oq teri va mo'yna, muz toj
  queen: ["#0e1626", "#4a6fa5", "#a9cdee", "#eef7ff", "#7fe9ff"],
};

/** Integer-only rasterizer: no paths, antialiasing, images, or sprite sheets. */
class Pixels {
  data = new Uint8Array(32 * 32);

  rect(color: number, x: number, y: number, w: number, h: number) {
    for (let py = Math.round(y); py < Math.round(y + h); py++)
      for (let px = Math.round(x); px < Math.round(x + w); px++)
        if (px >= 1 && px < 31 && py >= 1 && py < 31) this.data[py * 32 + px] = color;
  }

  line(color: number, start: Point, end: Point, width: number) {
    const steps = Math.max(Math.abs(end[0] - start[0]), Math.abs(end[1] - start[1]), 1);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      this.rect(
        color,
        Math.round(start[0] + (end[0] - start[0]) * t) - Math.floor(width / 2),
        Math.round(start[1] + (end[1] - start[1]) * t) - Math.floor(width / 2),
        width,
        width,
      );
    }
  }

  polygon(color: number, points: readonly Point[]) {
    for (let y = 1; y < 31; y++) {
      for (let x = 1; x < 31; x++) {
        let inside = false;
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
          const a = points[i],
            b = points[j];
          if (!a || !b) continue;
          if (
            a[1] > y + 0.5 !== b[1] > y + 0.5 &&
            x + 0.5 < ((b[0] - a[0]) * (y + 0.5 - a[1])) / (b[1] - a[1]) + a[0]
          )
            inside = !inside;
        }
        if (inside) this.data[y * 32 + x] = color;
      }
    }
  }

  ellipse(color: number, cx: number, cy: number, rx: number, ry: number, flatBelow = 99) {
    for (let y = 1; y < 31; y++)
      for (let x = 1; x < 31; x++) {
        const dx = (x + 0.5 - cx) / rx,
          dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1 && y < flatBelow) this.data[y * 32 + x] = color;
      }
  }

  outlined() {
    const result = this.data.slice();
    for (let y = 1; y < 31; y++)
      for (let x = 1; x < 31; x++) {
        if (!this.data[y * 32 + x]) continue;
        for (const [dx, dy] of [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ] as const) {
          const index = (y + dy) * 32 + x + dx;
          if (!this.data[index]) result[index] = 1;
        }
      }
    return result;
  }
}

function sword(p: Pixels, pose: Pose, skeleton: boolean) {
  const [hx, hy] = pose.hand,
    [tx, ty] = pose.tip;
  const dx = tx - hx,
    dy = ty - hy;
  const length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length,
    ny = dx / length;
  p.line(1, [hx, hy], [tx, ty], 4);
  p.line(skeleton ? 4 : 5, [hx + dx * 0.18, hy + dy * 0.18], [tx, ty], 2);
  p.line(
    skeleton ? 5 : 3,
    [hx - nx * 3 + dx * 0.15, hy - ny * 3 + dy * 0.15],
    [hx + nx * 3 + dx * 0.15, hy + ny * 3 + dy * 0.15],
    2,
  );
  p.rect(skeleton ? 3 : 4, hx - 1, hy - 1, 3, 3);
}

function knight(p: Pixels, pose: Pose, back: boolean) {
  const { bob: b, lean: l } = pose;
  p.line(2, [13, 20 + b], pose.leftFoot, 4);
  p.line(2, [19, 20 + b], pose.rightFoot, 4);
  p.rect(3, pose.leftFoot[0] - 2, pose.leftFoot[1] - 1, 5, 2);
  p.rect(3, pose.rightFoot[0] - 2, pose.rightFoot[1] - 1, 5, 2);
  p.polygon(2, [
    [10 + l, 13 + b],
    [21 + l, 13 + b],
    [21, 22 + b],
    [11, 22 + b],
  ]);
  p.rect(3, 12 + l, 14 + b, 7, 6);
  p.rect(4, 13 + l, 14 + b, 2, 5);
  p.rect(2, 10, 21 + b, 12, 2);
  p.rect(5, 15, 21 + b, 2, 2);
  p.line(2, [11 + l, 14 + b], pose.otherHand, 4);
  p.line(3, [21 + l, 14 + b], pose.hand, 4);
  p.rect(4, 8 + l, 13 + b, 5, 3);
  p.rect(4, 19 + l, 13 + b, 5, 3);
  p.polygon(3, [
    [12 + l, 5 + b],
    [18 + l, 4 + b],
    [21 + l, 8 + b],
    [20 + l, 13 + b],
    [11 + l, 13 + b],
    [10 + l, 8 + b],
  ]);
  p.rect(4, 13 + l, 5 + b, 3, 3);
  p.rect(5, 14 + l, 4 + b, 2, 2);
  p.rect(2, 11 + l, 9 + b, 9, 2);
  if (!back) {
    p.rect(1, 12 + l, 9 + b, 7, 1);
    p.rect(4, 13 + l, 9 + b, 2, 1);
    p.rect(2, 15 + l, 11 + b, 1, 2);
    p.rect(2, 18 + l, 11 + b, 1, 2);
  }
  sword(p, pose, false);
}

/** Sehrgar tayog'ining uchi (sehrli tosh) qo'lga nisbatan: har kadr alohida. */
const staffTops: Record<"idle" | "walk" | "attack" | "hurt", readonly Point[]> = {
  idle: [
    [1, -11],
    [1, -10],
  ],
  walk: [
    [2, -11],
    [1, -11],
    [0, -11],
    [1, -10],
  ],
  attack: [
    [-1, -9],
    [6, -4],
    [3, -10],
  ],
  hurt: [[4, -9]],
};

/** Soqol uchining chayqalishi (px): yurish va hujumda kadrdan kadrga o'zgaradi. */
export const BEARD_SWAY: Record<"idle" | "walk" | "attack" | "hurt", readonly number[]> = {
  idle: [0, 0],
  walk: [0, 1, 0, -1],
  attack: [-1, 1, 0],
  hurt: [-1],
};

/** Uchli qora qalpoq: qizil tasma, kumush bezak, uchi orqaga egilgan. (x, y) — hoshiya chap-yuqorisi. */
function wizardHat(p: Pixels, x: number, y: number) {
  p.rect(2, x, y, 14, 2);
  p.polygon(2, [
    [x + 2, y],
    [x + 12, y],
    [x + 9, y - 4],
    [x + 6, y - 6],
    [x + 1, y - 7],
    [x + 4, y - 4],
  ]);
  p.rect(3, x + 2, y - 1, 10, 1);
  p.rect(4, x + 7, y - 3, 1, 1);
  p.rect(4, x + 1, y + 1, 1, 1);
}

/**
 * Sehrgar: 2 — qora to'n, 3 — to'q qizil astar/kamar/tasma/kristall,
 * 4 — kumushrang soqol, qoshlar va bezaklar, 5 — teri.
 */
function mage(
  p: Pixels,
  pose: Pose,
  back: boolean,
  top: Point,
  glow = false,
  sway = 0,
  hat = true,
) {
  const { bob: b, lean: l } = pose;
  // oyoqlar to'n ostidan ko'rinadi
  p.rect(2, pose.leftFoot[0] - 2, pose.leftFoot[1] - 1, 4, 2);
  p.rect(2, pose.rightFoot[0] - 1, pose.rightFoot[1] - 1, 4, 2);
  // qora to'n: yelkadan pastga kengayadi
  p.polygon(2, [
    [11 + l, 13 + b],
    [21 + l, 13 + b],
    [23, 26],
    [9, 26],
  ]);
  if (!back) {
    // old tomondagi qizil astar (to'n ochilgan joy)
    p.polygon(3, [
      [15 + l, 18 + b],
      [17 + l, 18 + b],
      [18, 25],
      [14, 25],
    ]);
    p.rect(2, 16, 21 + b, 1, 4);
  }
  // etak naqshi: qizil hoshiya va zigzag, ichida kumush nuqtalar
  p.rect(3, 9, 25, 14, 1);
  for (let x = 10; x < 23; x += 3) p.rect(3, x, 24, 1, 1);
  p.rect(4, 11, 25, 1, 1);
  p.rect(4, 20, 25, 1, 1);
  // to'ndagi mayda kumush bezaklar
  p.rect(4, 11 + l, 22 + b, 1, 1);
  p.rect(4, 20 + l, 22 + b, 1, 1);
  // kamar va kumush to'qa
  p.rect(3, 11 + l, 20 + b, 10, 1);
  p.rect(4, 16 + l, 20 + b, 1, 1);
  // qo'llar: qora yeng, qizil yeng uchi, teri
  const sleeve = (shoulder: Point, hand: Point) => {
    p.line(2, shoulder, hand, 3);
    const cx = Math.round(shoulder[0] + (hand[0] - shoulder[0]) * 0.7),
      cy = Math.round(shoulder[1] + (hand[1] - shoulder[1]) * 0.7);
    p.rect(3, cx - 1, cy - 1, 3, 2);
    p.rect(5, hand[0] - 1, hand[1] - 1, 2, 2);
  };
  sleeve([12 + l, 15 + b], pose.otherHand);
  // tayoq: qora, kumush halqa, uchida qizil kristall
  const [hx, hy] = pose.hand;
  const tx = hx + top[0],
    ty = hy + top[1];
  p.line(2, [hx - (top[0] >> 2), hy + 7], [tx, ty], 2);
  p.rect(4, Math.round(hx + top[0] * 0.75) - 1, Math.round(hy + top[1] * 0.75), 2, 1);
  sleeve([20 + l, 15 + b], pose.hand);
  if (glow) p.rect(3, tx - 2, ty - 2, 5, 5);
  p.rect(3, tx - 1, ty - 1, 3, 3);
  // kristall yaltirashi
  p.rect(4, tx - (glow ? 1 : 0), ty - 1, 1, 1);
  if (glow) {
    p.rect(4, tx + 2, ty, 1, 1);
    p.rect(4, tx, ty + 2, 1, 1);
  }
  // bosh
  if (back) {
    // orqadan: kumushrang sochlar va soqolning chetlari
    p.ellipse(4, 16 + l, 11 + b, 3.5, 3);
    p.rect(2, 16 + l, 11 + b, 1, 3);
    p.rect(4, 12 + l, 13 + b, 1, 3);
    p.rect(4, 20 + l, 13 + b, 1, 3);
  } else {
    p.ellipse(5, 16 + l, 11 + b, 3.5, 3);
    // kumush qoshlar va qalpoq soyasidagi ko'zlar
    p.rect(4, 13 + l, 10 + b, 2, 1);
    p.rect(4, 17 + l, 10 + b, 2, 1);
    p.rect(1, 14 + l, 11 + b, 1, 1);
    p.rect(1, 17 + l, 11 + b, 1, 1);
    // uzun soqol: iyakdan ko'krakkacha, uchi ingichka va chayqaladi
    const w = sway;
    p.polygon(4, [
      [12 + l, 12 + b],
      [20 + l, 12 + b],
      [20 + l, 15 + b],
      [18 + l + w, 19 + b],
      [16 + l + w, 22 + b],
      [14 + l + w, 19 + b],
      [12 + l, 15 + b],
    ]);
    // mo'ylov va soqol tolalari
    p.rect(4, 12 + l, 13 + b, 9, 1);
    p.rect(5, 16 + l, 12 + b, 1, 1);
    p.rect(1, 15 + l, 14 + b, 3, 1);
    p.rect(2, 15 + l + w, 17 + b, 1, 2);
    p.rect(2, 17 + l + w, 16 + b, 1, 2);
  }
  if (hat) wizardHat(p, 9 + l, 8 + b);
}

/** Sehrgarning yiqilishi: qalpoq boshdan uchib ketadi, kumush soqol ko'rinib qoladi. */
function mageFallen(p: Pixels, frame: number) {
  if (frame === 0) {
    const pose: Pose = {
      bob: 5,
      lean: -3,
      leftFoot: [12, 28],
      rightFoot: [23, 28],
      hand: [23, 25],
      tip: [29, 28],
      otherHand: [7, 23],
    };
    mage(p, pose, false, [5, -8], false, -1, false);
    // qalpoq orqaga uchib ketmoqda
    p.polygon(2, [
      [2, 10],
      [9, 7],
      [3, 2],
    ]);
    p.line(3, [3, 9], [8, 7], 1);
    p.rect(4, 4, 6, 1, 1);
    return;
  }
  if (frame === 1) {
    p.line(2, [16, 23], [25, 27], 3);
    p.line(2, [17, 25], [21, 29], 3);
    p.polygon(2, [
      [9, 17],
      [15, 18],
      [21, 24],
      [17, 28],
      [10, 24],
      [7, 21],
    ]);
    p.line(3, [11, 20], [16, 24], 1);
    p.line(3, [17, 27], [20, 24], 1);
    // boshi qalpoqsiz: teri, yumuq ko'z, kumush qosh va soqol
    p.ellipse(5, 8, 15, 3, 3);
    p.rect(4, 6, 13, 3, 1);
    p.rect(1, 6, 14, 2, 1);
    p.polygon(4, [
      [5, 16],
      [11, 16],
      [13, 21],
      [10, 22],
      [6, 19],
    ]);
    // qalpoq uchib yerga tushmoqda
    p.polygon(2, [
      [1, 11],
      [6, 7],
      [2, 3],
    ]);
    p.line(3, [2, 10], [5, 8], 1);
    // tayoq yerga
    p.line(2, [20, 18], [28, 22], 1);
    p.rect(3, 27, 21, 3, 3);
    p.rect(4, 28, 21, 1, 1);
    return;
  }
  // yerda yotibdi: to'n, qizil hoshiya, yonida qalpoq va tayoq
  p.line(2, [20, 27], [27, 27], 3);
  p.rect(2, 10, 24, 12, 5);
  p.rect(3, 10, 28, 12, 1);
  p.rect(3, 15, 24, 1, 4);
  p.ellipse(5, 7, 25, 3, 2.5);
  p.rect(4, 5, 23, 3, 1);
  p.rect(1, 5, 24, 2, 1);
  p.polygon(4, [
    [6, 26],
    [11, 25],
    [14, 27],
    [11, 29],
    [6, 29],
  ]);
  p.polygon(2, [
    [1, 21],
    [7, 21],
    [2, 15],
  ]);
  p.rect(3, 1, 20, 6, 1);
  p.line(2, [17, 30], [27, 30], 1);
  p.rect(3, 27, 28, 3, 3);
  p.rect(4, 28, 28, 1, 1);
}

/** Skelet tanasi (qurolsiz) — skelet jangchi va kamonchi uchun umumiy. */
function boneBody(p: Pixels, pose: Pose) {
  const { bob: b, lean: l } = pose;
  p.line(2, [13, 21 + b], pose.leftFoot, 3);
  p.line(2, [19, 21 + b], pose.rightFoot, 3);
  p.line(3, [13, 22 + b], pose.leftFoot, 1);
  p.line(3, [19, 22 + b], pose.rightFoot, 1);
  p.rect(3, pose.leftFoot[0] - 2, pose.leftFoot[1], 4, 2);
  p.rect(3, pose.rightFoot[0] - 1, pose.rightFoot[1], 4, 2);
  p.rect(2, 11, 20 + b, 10, 3);
  p.rect(1, 14, 21 + b, 4, 1);
  p.line(2, [16 + l, 12 + b], [16, 21 + b], 3);
  for (let row = 0; row < 3; row++) {
    p.rect(3, 11 + l, 14 + b + row * 2, 10, 1);
    p.rect(2, 11 + l, 14 + b + row * 2, 1, 2);
    p.rect(2, 20 + l, 14 + b + row * 2, 1, 2);
  }
  p.line(2, [11 + l, 14 + b], pose.otherHand, 3);
  p.line(3, [11 + l, 14 + b], pose.otherHand, 1);
  p.line(2, [21 + l, 14 + b], pose.hand, 3);
  p.line(3, [21 + l, 14 + b], pose.hand, 1);
  p.polygon(2, [
    [12 + l, 4 + b],
    [19 + l, 4 + b],
    [21 + l, 7 + b],
    [20 + l, 11 + b],
    [18 + l, 13 + b],
    [13 + l, 12 + b],
    [11 + l, 8 + b],
  ]);
  p.rect(3, 13 + l, 5 + b, 6, 4);
  p.rect(1, 12 + l, 8 + b, 3, 3);
  p.rect(1, 17 + l, 8 + b, 3, 3);
  p.rect(1, 16 + l, 10 + b, 1, 2);
  p.rect(3, 13 + l, 12 + b, 6, 1);
  p.rect(1, 14 + l, 12 + b, 1, 1);
  p.rect(1, 17 + l, 12 + b, 1, 1);
}

function skeleton(p: Pixels, pose: Pose) {
  boneBody(p, pose);
  sword(p, pose, true);
}

// ---- Kamonchi skelet: 2 — qora suyak/o'q, 3 — yaltiroq, ip va pat, 4 — yog'och, 5 — qizil (ko'z, o'q uchi) ----

/** Yelka ortidagi o'qdon (tanadan oldin chiziladi, tana uni qisman yopadi). */
function quiver(p: Pixels, b: number) {
  p.line(4, [6, 21 + b], [9, 10 + b], 3);
  p.line(3, [7, 18 + b], [8, 14 + b], 1);
  // o'qlarning patlari yelka ustidan chiqib turadi
  p.rect(3, 7, 6 + b, 1, 3);
  p.rect(3, 9, 5 + b, 1, 3);
  p.rect(3, 11, 6 + b, 1, 2);
}

/** Ko'z teshiklari yorqin qizil (oddiy skeletda qora). */
function redEyes(p: Pixels, pose: Pose) {
  const { bob: b, lean: l } = pose;
  p.rect(5, 12 + l, 8 + b, 3, 3);
  p.rect(5, 17 + l, 8 + b, 3, 3);
}

/**
 * Kamon: yog'och yoy top..bottom, oldinga (kamonchi qaragan tomonga) egilgan.
 * pull — ip tortilgan nuqta (null bo'lsa ip to'g'ri), arrow — ipda o'q bor,
 * twang — qo'yib yuborilgan ip titrashi.
 */
function bow(
  p: Pixels,
  top: Point,
  bottom: Point,
  bulge: number,
  pull: Point | null,
  arrow: boolean,
  twang = false,
) {
  const mx = (top[0] + bottom[0]) / 2,
    my = (top[1] + bottom[1]) / 2;
  const dx = bottom[0] - top[0],
    dy = bottom[1] - top[1];
  const len = Math.hypot(dx, dy) || 1;
  // ipga perpendikulyar, x musbat tomonga (oldinga)
  let nx = -dy / len,
    ny = dx / len;
  if (nx < 0) {
    nx = -nx;
    ny = -ny;
  }
  const cx = mx + nx * bulge * 2,
    cy = my + ny * bulge * 2;
  // ip
  if (pull) {
    p.line(3, top, pull, 1);
    p.line(3, pull, bottom, 1);
  } else if (twang) {
    const k: Point = [Math.round(mx + nx), Math.round(my + ny)];
    p.line(3, top, k, 1);
    p.line(3, k, bottom, 1);
    p.rect(3, Math.round(mx - nx * 2), Math.round(my - 3), 1, 1);
    p.rect(3, Math.round(mx - nx * 2), Math.round(my + 3), 1, 1);
  } else p.line(3, top, bottom, 1);
  // yoy (kvadratik egri)
  const steps = 8;
  let prev: Point = top;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps,
      u = 1 - t;
    const pt: Point = [
      Math.round(u * u * top[0] + 2 * u * t * cx + t * t * bottom[0]),
      Math.round(u * u * top[1] + 2 * u * t * cy + t * t * bottom[1]),
    ];
    p.line(4, prev, pt, 2);
    prev = pt;
  }
  p.rect(3, Math.round(mx + nx * bulge) - 1, Math.round(my + ny * bulge) - 1, 2, 3);
  // o'q: ipdan oldinga, uchi kamondan chiqib turadi
  if (pull && arrow) {
    const tipX = Math.min(30, Math.round(mx + nx * (bulge + 5)));
    const tipY = pull[1];
    // qora o'q, qizil uchi
    p.line(2, pull, [tipX, tipY], 1);
    p.rect(5, tipX - 1, tipY - 1, 2, 3);
    p.rect(3, pull[0] - 1, pull[1] - 1, 1, 1);
    p.rect(3, pull[0] - 1, pull[1] + 1, 1, 1);
  }
}

/** Kamon tutgan qo'l yaqinidagi pastga tushirilgan kamon (ip to'g'ri). */
function loweredBow(p: Pixels, hand: Point) {
  bow(p, [hand[0] + 1, hand[1] - 7], [hand[0] - 2, hand[1] + 7], 3, null, false);
}

// attack: 0 — o'qni qo'yadi, 1 — to'liq tortgan, 2 — qo'yib yubordi
const archerShots: readonly {
  pose: Pose;
  top: Point;
  bottom: Point;
  pull: Point | null;
  arrow: boolean;
  twang: boolean;
}[] = [
  {
    pose: {
      bob: 0,
      lean: 0,
      leftFoot: [12, 27],
      rightFoot: [20, 27],
      hand: [24, 15],
      tip: [24, 15],
      otherHand: [20, 16],
    },
    top: [24, 7],
    bottom: [24, 23],
    pull: [21, 15],
    arrow: true,
    twang: false,
  },
  {
    pose: {
      bob: 0,
      lean: -1,
      leftFoot: [10, 28],
      rightFoot: [21, 27],
      hand: [26, 14],
      tip: [26, 14],
      otherHand: [15, 14],
    },
    top: [25, 5],
    bottom: [25, 23],
    pull: [16, 14],
    arrow: true,
    twang: false,
  },
  {
    pose: {
      bob: 1,
      lean: 0,
      leftFoot: [10, 28],
      rightFoot: [21, 27],
      hand: [26, 15],
      tip: [26, 15],
      otherHand: [8, 13],
    },
    top: [26, 7],
    bottom: [26, 24],
    pull: null,
    arrow: false,
    twang: true,
  },
];

function archer(p: Pixels, state: AnimState, frame: number) {
  if (state === "attack") {
    const shot = archerShots[frame] ?? archerShots[0]!;
    quiver(p, shot.pose.bob);
    boneBody(p, shot.pose);
    redEyes(p, shot.pose);
    // tortilgan bosqichda kamon oldinga qaraydi: yoy qattiqroq egiladi
    bow(p, shot.top, shot.bottom, frame === 1 ? 3 : 2, shot.pull, shot.arrow, shot.twang);
    return;
  }
  const pose = (
    state === "idle" || state === "walk" || state === "hurt" ? poses[state] : poses.idle
  )[frame];
  if (!pose) return;
  quiver(p, pose.bob);
  boneBody(p, pose);
  redEyes(p, pose);
  loweredBow(p, pose.hand);
}

// ---- Qalqonli skelet: 2/3 — suyak, 4 — yog'och qalqon, 5 — temir gardish va qisqa qilich ----

/** Qalqonning oldinga siljishi: hujumda (itarish) qalqon oldinga cho'ziladi. */
const shieldPush: Record<"idle" | "walk" | "attack" | "hurt", readonly number[]> = {
  idle: [0, 0],
  walk: [0, 0, 0, 0],
  attack: [1, 4, 2],
  hurt: [-2],
};

/** Katta yumaloq yog'och-temir qalqon: (cx, cy) markazida. */
function roundShield(p: Pixels, cx: number, cy: number) {
  p.ellipse(5, cx, cy, 5.5, 7);
  p.ellipse(4, cx, cy, 4, 5.5);
  // taxta choklari va markazdagi temir do'mboq
  p.rect(2, Math.round(cx) - 2, Math.round(cy) - 4, 1, 9);
  p.rect(2, Math.round(cx) + 2, Math.round(cy) - 3, 1, 7);
  p.rect(5, Math.round(cx) - 1, Math.round(cy) - 1, 3, 3);
  p.rect(3, Math.round(cx), Math.round(cy) - 1, 1, 1);
  // muz qoplami: chetida ayoz, pastida sumalaklar
  p.rect(3, Math.round(cx) - 3, Math.round(cy) - 6, 2, 1);
  p.rect(3, Math.round(cx) + 2, Math.round(cy) + 4, 1, 1);
  p.rect(5, Math.round(cx) - 2, Math.round(cy) + 7, 1, 2);
  p.rect(5, Math.round(cx) + 1, Math.round(cy) + 7, 1, 3);
}

/** Qisqa qilich orqa qo'lda, tig'i yuqoriga. */
function shortSword(p: Pixels, hand: Point) {
  const [hx, hy] = hand;
  p.line(1, [hx, hy], [hx - 2, hy - 9], 4);
  p.line(5, [hx, hy - 2], [hx - 2, hy - 9], 2);
  p.rect(4, hx - 2, hy - 1, 4, 1);
  p.rect(4, hx, hy, 1, 2);
}

function shieldBearer(p: Pixels, pose: Pose, push: number) {
  shortSword(p, pose.otherHand);
  boneBody(p, pose);
  // bosh suyagi ustida ayoz
  p.rect(5, 13 + pose.lean, 4 + pose.bob, 6, 1);
  roundShield(p, 22 + push + pose.lean, 17 + pose.bob);
}

const axePoses: readonly { hand: Point; tip: Point }[] = [
  { hand: [23, 10], tip: [20, 3] },
  { hand: [23, 17], tip: [28, 21] },
  { hand: [22, 21], tip: [25, 27] },
];

function demon(p: Pixels, pose: Pose, attackFrame: number | null) {
  const { bob: b, lean: l } = pose;
  p.line(2, [12, 21 + b], pose.leftFoot, 5);
  p.line(2, [19, 21 + b], pose.rightFoot, 5);
  p.rect(2, pose.leftFoot[0] - 3, pose.leftFoot[1], 6, 2);
  p.rect(2, pose.rightFoot[0] - 2, pose.rightFoot[1], 6, 2);
  p.rect(5, pose.leftFoot[0] - 3, pose.leftFoot[1] + 1, 2, 1);
  p.rect(5, pose.rightFoot[0] + 2, pose.rightFoot[1] + 1, 2, 1);
  p.polygon(2, [
    [8 + l, 12 + b],
    [22 + l, 12 + b],
    [22, 20 + b],
    [19, 24 + b],
    [11, 24 + b],
    [8, 19 + b],
  ]);
  p.polygon(3, [
    [10 + l, 13 + b],
    [20 + l, 13 + b],
    [19, 19 + b],
    [12, 20 + b],
  ]);
  p.rect(2, 15 + l, 14 + b, 1, 6);
  p.rect(2, 10, 21 + b, 11, 3);
  p.rect(4, 14, 21 + b, 3, 2);
  const weapon =
    attackFrame === null
      ? { hand: pose.hand, tip: [27, 26] as Point }
      : (axePoses[attackFrame] ?? axePoses[0]);
  if (!weapon) return;
  p.line(2, [9 + l, 14 + b], pose.otherHand, 5);
  p.line(2, [21 + l, 14 + b], weapon.hand, 5);
  p.rect(3, 7 + l, 13 + b, 5, 4);
  p.rect(3, 20 + l, 13 + b, 5, 4);
  p.polygon(2, [
    [11 + l, 6 + b],
    [18 + l, 6 + b],
    [21 + l, 9 + b],
    [19 + l, 13 + b],
    [12 + l, 13 + b],
    [9 + l, 9 + b],
  ]);
  p.rect(3, 12 + l, 7 + b, 6, 2);
  // Two swept horns, not the old crown.
  p.polygon(5, [
    [11 + l, 8 + b],
    [8 + l, 6 + b],
    [7 + l, 2 + b],
    [10 + l, 4 + b],
    [13 + l, 7 + b],
  ]);
  p.polygon(5, [
    [18 + l, 7 + b],
    [21 + l, 4 + b],
    [22 + l, 2 + b],
    [23 + l, 6 + b],
    [20 + l, 9 + b],
  ]);
  p.rect(1, 11 + l, 9 + b, 9, 2);
  p.rect(4, 12 + l, 9 + b, 2, 1);
  p.rect(4, 17 + l, 9 + b, 2, 1);
  p.rect(1, 14 + l, 12 + b, 4, 1);
  p.rect(5, 14 + l, 12 + b, 1, 1);
  p.rect(5, 17 + l, 12 + b, 1, 1);
  const [hx, hy] = weapon.hand,
    [tx, ty] = weapon.tip;
  const dx = tx - hx,
    dy = ty - hy,
    length = Math.hypot(dx, dy) || 1;
  const ux = dx / length,
    uy = dy / length,
    nx = -uy,
    ny = ux;
  p.line(1, [hx - ux * 2, hy - uy * 2], [tx, ty], 3);
  p.line(5, [hx - ux * 2, hy - uy * 2], [tx, ty], 1);
  // Broad double-bit axe rotates through an overhead-to-ground arc.
  const point = (along: number, across: number): Point => [
    tx + ux * along + nx * across,
    ty + uy * along + ny * across,
  ];
  p.polygon(5, [
    point(-2, -4),
    point(1, -5),
    point(2, -3),
    point(1, 0),
    point(2, 3),
    point(1, 5),
    point(-2, 4),
    point(-3, 2),
    point(-1, 0),
    point(-3, -2),
  ]);
  p.line(2, point(-2, -2), point(-2, 2), 1);
  p.rect(3, hx - 1, hy - 1, 3, 3);
}

function fallen(p: Pixels, kind: SpriteKind, frame: number) {
  if (kind === "mage") return mageFallen(p, frame);
  const skeletonBody = kind === "skeleton" || kind === "archer" || kind === "shield";
  const light = skeletonBody ? 3 : kind === "knight" ? 4 : 3;
  // Separate buckling, side-fall, and fully prone silhouettes.
  if (frame === 0) {
    const pose: Pose = {
      bob: 5,
      lean: -3,
      leftFoot: [12, 28],
      rightFoot: [23, 28],
      hand: [23, 25],
      tip: [29, 28],
      otherHand: [7, 23],
    };
    if (kind === "knight") knight(p, pose, false);
    else if (kind === "archer") {
      quiver(p, pose.bob);
      boneBody(p, pose);
      redEyes(p, pose);
      // kamon qo'ldan sirg'alib tushmoqda
      bow(p, [27, 18], [22, 29], 2, null, false);
    } else if (kind === "shield") {
      boneBody(p, pose);
      // qalqon qo'ldan tushib, yerga qiyshaymoqda
      roundShield(p, 25, 23);
    } else if (skeletonBody) skeleton(p, pose);
    else demon(p, pose, 2);
    return;
  }
  if (frame === 1) {
    p.line(2, [16, 23], [25, 27], skeletonBody ? 2 : 4);
    p.line(2, [17, 25], [21, 29], skeletonBody ? 2 : 4);
    p.polygon(2, [
      [9, 17],
      [15, 18],
      [21, 24],
      [17, 28],
      [10, 24],
      [7, 21],
    ]);
    p.line(light, [10, 19], [16, 24], skeletonBody ? 1 : 3);
    p.rect(2, 5, 13, 7, 8);
    p.rect(light, 6, 14, 4, 4);
    p.rect(1, 6, 18, 5, 1);
    p.line(light, [19, 27], [29, 28], 2);
    if (kind === "demon") {
      p.line(5, [6, 14], [3, 11], 2);
      p.line(5, [10, 14], [11, 10], 2);
      p.rect(5, 26, 25, 4, 4);
    }
    if (kind === "shield") {
      p.ellipse(5, 25, 26, 5, 3.5);
      p.ellipse(4, 25, 26, 3.5, 2.5);
      p.rect(5, 24, 25, 2, 2);
    }
    if (kind === "archer") {
      // ko'z so'nmoqda (oxirgi kadrda o'chadi), kamon yerga qulamoqda
      p.rect(5, 7, 15, 1, 1);
      bow(p, [24, 17], [29, 27], 2, null, false);
    }
    return;
  }
  p.line(2, [16, 27], [27, 27], skeletonBody ? 2 : 4);
  p.line(2, [16, 25], [25, 24], skeletonBody ? 2 : 3);
  p.rect(2, 9, 24, 10, 5);
  p.rect(light, 10, 24, 7, skeletonBody ? 1 : 2);
  p.rect(2, 3, 23, 7, 6);
  p.rect(light, 4, 24, 4, 2);
  p.rect(1, 4, 26, 5, 1);
  p.line(light, [15, 29], [29, 29], 1);
  if (skeletonBody) for (let x = 11; x < 18; x += 2) p.rect(1, x, 25, 1, 2);
  if (kind === "demon") {
    p.line(5, [4, 24], [2, 20], 2);
    p.line(5, [8, 24], [10, 21], 2);
    p.rect(5, 26, 27, 4, 3);
  }
  // qalqon yerda yotibdi
  if (kind === "shield") {
    p.ellipse(5, 25, 28, 5.5, 2.5);
    p.ellipse(4, 25, 28, 4, 1.5);
  }
  // kamon yerda yotibdi
  if (kind === "archer") bow(p, [18, 29], [30, 29], 1, null, false);
}

/** Slime: dome body that squashes/stretches per frame. */
const slimeFrames: Record<
  AnimState,
  readonly { w: number; h: number; lift: number; lean: number }[]
> = {
  idle: [
    { w: 10, h: 9, lift: 0, lean: 0 },
    { w: 11, h: 8, lift: 0, lean: 0 },
  ],
  walk: [
    { w: 12, h: 7, lift: 0, lean: 0 },
    { w: 8, h: 11, lift: 2, lean: 1 },
    { w: 9, h: 10, lift: 4, lean: 1 },
    { w: 11, h: 8, lift: 1, lean: 0 },
  ],
  attack: [
    { w: 12, h: 6, lift: 0, lean: -1 },
    { w: 8, h: 12, lift: 3, lean: 2 },
    { w: 13, h: 7, lift: 0, lean: 3 },
  ],
  hurt: [{ w: 12, h: 7, lift: 0, lean: -3 }],
  death: [
    { w: 12, h: 6, lift: 0, lean: 0 },
    { w: 13, h: 4, lift: 0, lean: 0 },
    { w: 14, h: 2, lift: 0, lean: 0 },
  ],
};

function slime(p: Pixels, state: AnimState, frame: number) {
  const f = slimeFrames[state][frame] ?? slimeFrames[state][0];
  if (!f) return;
  const base = 27 - f.lift,
    cx = 16 + f.lean;
  p.ellipse(2, cx, base, f.w, f.h * 2, base);
  p.ellipse(3, cx - 1, base - 1, f.w - 2, f.h * 2 - 3, base - 1);
  if (state !== "death" || frame === 0) {
    p.rect(4, cx - f.w + 4, base - f.h * 2 + 5, 3, 2);
    p.rect(5, cx - f.w + 4, base - f.h * 2 + 5, 1, 1);
    const ey = base - Math.max(3, Math.round(f.h * 0.9));
    const closed = state === "hurt";
    p.rect(1, cx - 4, ey, 2, closed ? 1 : 3);
    p.rect(1, cx + 2, ey, 2, closed ? 1 : 3);
    if (!closed) {
      p.rect(5, cx - 4, ey, 1, 1);
      p.rect(5, cx + 2, ey, 1, 1);
    }
    if (state === "attack") p.rect(1, cx - 2, ey + 4, 5, 2);
  } else {
    for (let i = 0; i < frame * 2; i++) p.rect(4, 6 + i * 5, 29 - (i % 2) * 2, 2, 1);
  }
  if (f.lift > 0) p.rect(2, cx - 3, base, 6, 1);
}

/** Bat: wings flap through distinct angles. */
const batWings: Record<AnimState, readonly { wing: number; bob: number; tilt: number }[]> = {
  idle: [
    { wing: 0, bob: 0, tilt: 0 },
    { wing: 1, bob: 1, tilt: 0 },
  ],
  walk: [
    { wing: -6, bob: 1, tilt: 0 },
    { wing: -1, bob: 0, tilt: 0 },
    { wing: 5, bob: -1, tilt: 0 },
    { wing: 1, bob: 0, tilt: 0 },
  ],
  attack: [
    { wing: -7, bob: -2, tilt: -1 },
    { wing: 4, bob: 2, tilt: 2 },
    { wing: 1, bob: 0, tilt: 1 },
  ],
  hurt: [{ wing: 6, bob: 2, tilt: -3 }],
  death: [
    { wing: 6, bob: 3, tilt: 2 },
    { wing: 8, bob: 6, tilt: 4 },
    { wing: 9, bob: 9, tilt: 6 },
  ],
};

function bat(p: Pixels, state: AnimState, frame: number) {
  const f = batWings[state][frame] ?? batWings[state][0];
  if (!f) return;
  const cy = 15 + f.bob,
    cx = 16 + f.tilt,
    w = f.wing;
  for (const side of [-1, 1]) {
    const sx = (x: number) => cx + side * x;
    p.polygon(2, [
      [sx(3), cy - 2],
      [sx(9), cy - 4 + w],
      [sx(14), cy - 3 + w * 1.4],
      [sx(13), cy + 2 + w],
      [sx(10), cy + 1 + w * 0.6],
      [sx(7), cy + 4 + w * 0.4],
      [sx(3), cy + 3],
    ]);
    p.line(3, [sx(4), cy - 1], [sx(12), cy - 2 + w * 1.3], 1);
    p.line(3, [sx(8), cy - 2 + w * 0.6], [sx(10), cy + 1 + w * 0.6], 1);
  }
  p.ellipse(3, cx, cy + 1, 4.5, 5);
  p.ellipse(4, cx, cy + 3, 2.5, 2.5);
  p.polygon(3, [
    [cx - 4, cy - 2],
    [cx - 4, cy - 7],
    [cx - 1, cy - 3],
  ]);
  p.polygon(3, [
    [cx + 4, cy - 2],
    [cx + 4, cy - 7],
    [cx + 1, cy - 3],
  ]);
  if (state === "death" || state === "hurt") {
    p.rect(1, cx - 3, cy - 1, 2, 1);
    p.rect(1, cx + 1, cy - 1, 2, 1);
  } else {
    p.rect(5, cx - 3, cy - 1, 2, 2);
    p.rect(5, cx + 1, cy - 1, 2, 2);
  }
  p.rect(1, cx - 1, cy + 2, 3, 1);
  p.rect(5, cx - 1, cy + 3, 1, state === "attack" ? 2 : 1);
  p.rect(5, cx + 1, cy + 3, 1, state === "attack" ? 2 : 1);
  p.rect(2, cx - 2, cy + 6, 1, 2);
  p.rect(2, cx + 1, cy + 6, 1, 2);
}

// ---------------- 2-dunyo: muz mavjudotlari ----------------

/** Muz ruhi: suzuvchi arvoh, dumi to'lqinlanadi. */
const frostFrames: Record<
  AnimState,
  readonly { bob: number; tail: number; mouth: number; tilt: number }[]
> = {
  idle: [
    { bob: 0, tail: 0, mouth: 0, tilt: 0 },
    { bob: 1, tail: 2, mouth: 0, tilt: 0 },
  ],
  walk: [
    { bob: 0, tail: -3, mouth: 0, tilt: 0 },
    { bob: -1, tail: -1, mouth: 0, tilt: 0 },
    { bob: 0, tail: 3, mouth: 0, tilt: 0 },
    { bob: 1, tail: 1, mouth: 0, tilt: 0 },
  ],
  attack: [
    { bob: -1, tail: -2, mouth: 1, tilt: -1 },
    { bob: -2, tail: 2, mouth: 2, tilt: -2 },
    { bob: 1, tail: 0, mouth: 3, tilt: 2 },
  ],
  hurt: [{ bob: 1, tail: 4, mouth: 1, tilt: -3 }],
  death: [
    { bob: 2, tail: 4, mouth: 1, tilt: 0 },
    { bob: 4, tail: 0, mouth: 0, tilt: 0 },
    { bob: 7, tail: 0, mouth: 0, tilt: 0 },
  ],
};

function frostGhost(p: Pixels, state: AnimState, frame: number) {
  const f = frostFrames[state][frame] ?? frostFrames[state][0];
  if (!f) return;
  const b = f.bob,
    t = f.tail,
    l = f.tilt;
  if (state === "death" && frame > 0) {
    // tarqalib ketayotgan qor bulutchalari
    const n = frame === 1 ? 5 : 3;
    for (let i = 0; i < n; i++) {
      const x = 7 + i * (frame === 1 ? 4 : 7),
        y = 10 + b + ((i * 5) % 7);
      p.ellipse(frame === 1 ? 3 : 4, x, y, frame === 1 ? 2.5 : 1.5, frame === 1 ? 2 : 1.5);
    }
    if (frame === 1) p.rect(5, 15, 13 + b, 2, 1);
    return;
  }
  // tana: boshdan to'lqinsimon dumgacha
  p.polygon(3, [
    [9 + l, 11 + b],
    [23 + l, 11 + b],
    [23, 17 + b],
    [20 + t, 23 + b],
    [17 + Math.round(t * 1.5), 28 + b],
    [14 + t, 24 + b],
    [9, 18 + b],
  ]);
  p.ellipse(3, 16 + l, 11 + b, 7.5, 6.5);
  // ichki oqish yorug'lik va pastki soyalar
  p.ellipse(4, 14 + l, 9 + b, 3, 2.5);
  p.line(2, [12, 19 + b], [15 + t, 24 + b], 1);
  p.line(2, [20, 19 + b], [18 + t, 25 + b], 1);
  // qo'lchalar
  p.line(2, [9, 15 + b], [6 + l, 18 + b + (state === "attack" ? -3 : 0)], 2);
  p.line(2, [23, 15 + b], [26 + l, 18 + b + (state === "attack" ? -3 : 0)], 2);
  // ko'zlar: bo'shliq, ichida sovuq nur
  const closed = state === "hurt" || state === "death";
  p.rect(1, 12 + l, 10 + b, 3, closed ? 1 : 3);
  p.rect(1, 18 + l, 10 + b, 3, closed ? 1 : 3);
  if (!closed) {
    p.rect(5, 13 + l, 11 + b, 1, 1);
    p.rect(5, 19 + l, 11 + b, 1, 1);
  }
  // og'iz: nafas tayyorgarligida kattalashadi
  if (f.mouth) p.ellipse(1, 16.5 + l, 15.5 + b, f.mouth, f.mouth === 3 ? 2 : 1);
  if (f.mouth === 3) {
    // sovuq nafas puflanmoqda
    p.ellipse(5, 16.5 + l, 20 + b, 3, 2);
    p.rect(4, 15 + l, 20 + b, 3, 1);
  }
}

// ---- Qor odam (kind "golem"): 1 — ko'mir, 2 — qor soyasi, 3 — qor, 4 — sabzi, 5 — chelak va shox qo'llar ----

/** Uchta qor shar: pastki, o'rta, bosh; soyasi chap-pastda. */
function snowBall(p: Pixels, cx: number, cy: number, rx: number, ry: number) {
  p.ellipse(2, cx, cy, rx, ry);
  p.ellipse(3, cx + 0.6, cy - 0.8, rx - 1.2, ry - 1.2);
}

/** Shox qo'l: yelkadan uchigacha, uchida ikki barmoq-novda. */
function twigArm(p: Pixels, from: Point, to: Point) {
  p.line(5, from, to, 1);
  const sx = Math.sign(to[0] - from[0]) || 1;
  p.rect(5, to[0] - sx, to[1] - 2, 1, 2);
  p.rect(5, to[0] + sx, to[1] - 1, 1, 1);
}

/** Chelak qalpoq: (x, y) — chelak tagining chap uchi. */
function bucket(p: Pixels, x: number, y: number) {
  p.rect(5, x + 1, y - 3, 7, 3);
  p.rect(5, x, y, 9, 1);
  p.rect(1, x + 3, y - 2, 1, 1);
}

interface SnowFrame {
  /** butun gavda balandligi */
  dy: number;
  /** bosh va o'rta sharning yonga og'ishi */
  tilt: number;
  /** qo'l uchlari: o'ng (oldingi) va chap */
  hand: Point;
  other: Point;
  /** pastki shar ezilishi (yerga urilganda) */
  squash?: number;
  /** yerga urilganda qor parchalari */
  puff?: boolean;
  /** zarba yegan: ko'zlar qisilgan */
  hurt?: boolean;
}

const snowFrames: Record<"idle" | "walk" | "attack" | "hurt", readonly SnowFrame[]> = {
  idle: [
    { dy: 0, tilt: 0, hand: [27, 11], other: [5, 12] },
    { dy: 1, tilt: 0, hand: [27, 12], other: [5, 11] },
  ],
  // qor ustida chayqalib sirpanadi
  walk: [
    { dy: 0, tilt: -1, hand: [27, 13], other: [5, 10] },
    { dy: -1, tilt: 0, hand: [28, 11], other: [4, 11] },
    { dy: 0, tilt: 1, hand: [27, 10], other: [5, 13] },
    { dy: 1, tilt: 0, hand: [26, 12], other: [6, 12] },
  ],
  // yerga urish: 0 — qo'llar tepada, 1 — sakradi, 2 — yerga tushdi
  attack: [
    { dy: 0, tilt: 0, hand: [26, 3], other: [6, 3] },
    { dy: -2, tilt: 0, hand: [28, 5], other: [4, 5] },
    { dy: 1, tilt: 0, hand: [29, 22], other: [3, 22], squash: 1, puff: true },
  ],
  hurt: [{ dy: 1, tilt: -2, hand: [27, 7], other: [6, 16], hurt: true }],
};

function snowman(p: Pixels, f: SnowFrame) {
  const { dy, tilt } = f;
  const mid = Math.round(tilt / 2);
  const sq = f.squash ?? 0;
  snowBall(p, 16, 24 + dy + sq, 8 + sq, 6 - sq);
  twigArm(p, [11 + mid, 15 + dy], f.other);
  twigArm(p, [21 + mid, 15 + dy], f.hand);
  snowBall(p, 16 + mid, 16 + dy, 6, 5);
  snowBall(p, 16 + tilt, 9 + dy, 4.5, 4);
  // ko'mir tugmalar
  p.rect(1, 16 + mid, 14 + dy, 1, 1);
  p.rect(1, 16 + mid, 17 + dy, 1, 1);
  p.rect(1, 16, 22 + dy + sq, 1, 1);
  // ko'mir ko'zlar (zarba yeganda qisilgan) va og'iz
  const hx = 16 + tilt,
    hy = 9 + dy;
  if (f.hurt) {
    p.rect(1, hx - 3, hy - 1, 2, 1);
    p.rect(1, hx + 1, hy - 1, 2, 1);
  } else {
    p.rect(1, hx - 2, hy - 2, 1, 2);
    p.rect(1, hx + 1, hy - 2, 1, 2);
  }
  p.rect(1, hx - 1, hy + 2, 1, 1);
  p.rect(1, hx + 1, hy + 2, 1, 1);
  // sabzi burun — oldinga
  p.rect(4, hx + 1, hy, 3, 2);
  p.rect(4, hx + 4, hy + 1, 2, 1);
  // chelak qalpoq
  bucket(p, hx - 4, hy - 4);
  if (f.puff) {
    // yerga urilganda qor parchalari sochiladi
    p.rect(3, 2, 26, 2, 2);
    p.rect(3, 28, 25, 2, 2);
    p.rect(3, 4, 22, 1, 1);
    p.rect(3, 27, 21, 1, 1);
  }
}

/** Qor odam yiqilishi: chelak tushadi, bosh qulaydi, so'ng qor uyumi qoladi. */
function snowmanFallen(p: Pixels, frame: number) {
  if (frame === 0) {
    // bosh og'di, chelak sirg'alib tushmoqda
    snowBall(p, 16, 25, 8, 5);
    twigArm(p, [11, 17], [5, 22]);
    twigArm(p, [21, 17], [27, 21]);
    snowBall(p, 15, 18, 6, 5);
    snowBall(p, 20, 12, 4.5, 4);
    p.rect(1, 19, 10, 1, 2);
    p.rect(1, 22, 10, 1, 2);
    p.rect(4, 23, 12, 3, 2);
    bucket(p, 22, 6);
    return;
  }
  if (frame === 1) {
    // bosh yerga yumaladi, o'rta shar ezildi
    snowBall(p, 14, 26, 9, 4);
    snowBall(p, 13, 21, 6, 3.5);
    snowBall(p, 25, 26, 4, 3.5);
    p.rect(1, 24, 25, 1, 1);
    p.rect(4, 27, 26, 3, 1);
    twigArm(p, [8, 21], [3, 18]);
    bucket(p, 19, 29);
    return;
  }
  // qor uyumi: sabzi, ko'mir va chelak yerda
  p.ellipse(2, 15, 28, 12, 4, 31);
  p.ellipse(3, 15, 28, 10.5, 3, 31);
  p.rect(4, 17, 27, 3, 1);
  p.rect(1, 11, 27, 1, 1);
  p.rect(1, 14, 26, 1, 1);
  bucket(p, 22, 29);
  p.line(5, [3, 27], [7, 25], 1);
}

// ---- Muz slime: 2 — to'q muz, 3 — och ko'k tana, 4 — yaltiroq, 5 — ichidagi muz kristall ----

function iceblob(p: Pixels, state: AnimState, frame: number) {
  const f = slimeFrames[state][frame] ?? slimeFrames[state][0];
  if (!f) return;
  const base = 27 - f.lift,
    cx = 16 + f.lean;
  const top = base - f.h * 2;
  // tana: tomchi shakli — tepasida uchli muz cho'qqi
  p.ellipse(2, cx, base, f.w, f.h * 2, base);
  if (state !== "death" || frame === 0)
    p.polygon(2, [
      [cx - 2, top + 3],
      [cx + f.lean, top - 3],
      [cx + 3, top + 3],
    ]);
  p.ellipse(3, cx, base - 1, f.w - 2, f.h * 2 - 3, base - 1);
  if (state !== "death" || frame === 0) {
    // ichidagi muz kristall: tananing pastki o'rtasida katta romb va yaltirog'i
    const ky = base - 4;
    p.polygon(5, [
      [cx + 1, ky - 4],
      [cx + 5, ky],
      [cx + 1, ky + 3],
      [cx - 3, ky],
    ]);
    p.rect(4, cx, ky - 2, 1, 3);
    // yuzidagi yaltiroq uchqunlar
    p.rect(4, cx - f.w + 3, top + 6, 1, 1);
    p.rect(4, cx - f.w + 4, top + 5, 1, 3);
    // ko'zlar: kristalldan yuqorida
    const ey = Math.min(top + 5, ky - 6);
    const closed = state === "hurt";
    p.rect(1, cx - 3, ey, 2, closed ? 1 : 2);
    p.rect(1, cx + 2, ey, 2, closed ? 1 : 2);
    if (state === "attack") p.rect(1, cx - 1, ey + 3, 3, 1);
    // pastki chetida muz sumalaklari
    p.rect(4, cx - f.w + 2, base, 1, 1);
    p.rect(4, cx + f.w - 3, base, 1, 1);
  } else {
    // erib ketmoqda: ko'lmak va muz siniqlari
    for (let i = 0; i < frame * 2; i++) p.rect(5, 7 + i * 5, 29 - (i % 2) * 2, 2, 1);
  }
  if (f.lift > 0) p.rect(2, cx - 3, base, 6, 1);
}

// ---- Qor bo'risi: 2 — to'q kulrang yag'ir, 3 — kulrang, 4 — oq ko'krak va panjalar, 5 — muz ko'k ko'z ----

interface WolfFrame {
  /** gavda va boshning vertikal siljishi */
  by: number;
  hy: number;
  /** boshning gorizontal siljishi */
  hx?: number;
  /** dum uchi balandligi */
  tail: number;
  /** oyoqlar uchining x siljishi: old-o'ng, old-chap, orqa-o'ng, orqa-chap */
  legs: readonly [number, number, number, number];
  /** oyoqlar uchi qaysi balandlikda (28 — yerda) */
  feet?: readonly [number, number];
  /** og'iz ochiq va oldida bug' (hansirash) */
  pant?: boolean;
  /** ko'z yumilgan */
  blink?: boolean;
}

const wolfFrames: Record<"idle" | "walk" | "attack" | "hurt", readonly WolfFrame[]> = {
  idle: [
    { by: 0, hy: 0, tail: 2, legs: [0, 0, 0, 0] },
    { by: 1, hy: 1, tail: 0, legs: [0, 0, 0, 0] },
  ],
  walk: [
    { by: 0, hy: 0, tail: 1, legs: [2, -2, -2, 2] },
    { by: -1, hy: -1, tail: 0, legs: [0, 0, 0, 0] },
    { by: 0, hy: 0, tail: -1, legs: [-2, 2, 2, -2] },
    { by: 1, hy: 1, tail: 0, legs: [1, -1, -1, 1] },
  ],
  // 0 — cho'kdi (ogohlantirish), 1 — sakradi (cho'zilgan), 2 — charchadi (bosh pastda, hansiraydi)
  attack: [
    { by: 3, hy: 5, hx: 1, tail: 4, legs: [-2, -1, 2, 1] },
    { by: -3, hy: -2, hx: 1, tail: -3, legs: [6, 4, -6, -5], feet: [22, 24] },
    { by: 1, hy: 5, tail: 4, legs: [0, 0, 0, 0], pant: true },
  ],
  hurt: [{ by: 0, hy: -2, hx: -1, tail: 5, legs: [-1, -1, 1, 1], blink: true }],
};

function wolf(p: Pixels, f: WolfFrame) {
  const { by, hy } = f;
  const hx = f.hx ?? 0;
  const [frontY, backY] = f.feet ?? [28, 28];
  // orqadagi (uzoq) oyoqlar to'qroq
  p.line(2, [22, 20 + by], [22 + f.legs[1], frontY], 2);
  p.line(2, [10, 20 + by], [10 + f.legs[3], backY], 2);
  // dum: yo'g'on, uchi oq
  p.line(2, [8, 16 + by], [4, 15 + by + f.tail], 3);
  p.rect(4, 2, 14 + by + f.tail, 2, 2);
  // gavda: ustki yag'ir to'q, qorni oq
  p.ellipse(2, 15, 17 + by, 9, 4.5);
  p.ellipse(3, 15, 18 + by, 8, 3.5);
  p.ellipse(4, 16, 20 + by, 5, 1.2);
  // oldingi (yaqin) oyoqlar, oq panjalar
  p.line(3, [20, 20 + by], [20 + f.legs[0], frontY], 2);
  p.line(3, [12, 20 + by], [12 + f.legs[2], backY], 2);
  p.rect(4, 20 + f.legs[0] - 1, frontY, 2, 1);
  p.rect(4, 12 + f.legs[2] - 1, backY, 2, 1);
  // bo'yin va bosh
  const x = 24 + hx,
    y = 13 + hy;
  p.line(3, [20, 16 + by], [x - 1, y + 1], 4);
  p.ellipse(3, x, y, 4, 3.5);
  p.rect(2, x - 3, y - 3, 5, 2);
  // quloq
  p.polygon(2, [
    [x - 3, y - 2],
    [x - 1, y - 7],
    [x + 1, y - 2],
  ]);
  // tumshuq, oq jag', burun
  p.rect(3, x + 2, y, 4, 2);
  p.rect(4, x + 1, y + 2, 4, 1);
  p.rect(1, x + 6, y, 1, 1);
  if (f.pant) {
    // og'iz ochiq, sovuqda bug' chiqadi
    p.rect(1, x + 2, y + 3, 3, 1);
    p.rect(4, x + 6, y + 4, 2, 1);
    p.rect(4, x + 7, y + 2, 1, 1);
  }
  // muz ko'k ko'z
  p.rect(f.blink ? 1 : 5, x, y - 1, 1, 1);
}

/** Bo'ri yiqilishi: yon tomonga cho'kadi, so'ng yonboshlab yotadi. */
function wolfFallen(p: Pixels, frame: number) {
  if (frame === 0) {
    wolf(p, { by: 4, hy: 8, hx: 1, tail: 5, legs: [-3, -3, 3, 3], blink: true });
    return;
  }
  const y = frame === 1 ? 23 : 25;
  // yonboshlab yotibdi: oyoqlar yon tomonga cho'zilgan
  p.line(2, [9, y], [4, y + 3], 3);
  p.ellipse(2, 15, y, 9, frame === 1 ? 4 : 3);
  p.ellipse(3, 15, y + 1, 8, frame === 1 ? 3 : 2);
  p.line(3, [12, y + 2], [10, 29], 2);
  p.line(3, [19, y + 2], [22, 29], 2);
  p.ellipse(3, 25, y + 2, 4, 3);
  p.rect(2, 22, y - 1, 4, 2);
  p.rect(4, 27, y + 3, 3, 1);
  p.rect(1, 25, y + 1, 1, 1);
}

/** Qor Malikasi: oqish-ko'k ko'ylak, muz toj, qo'lida muz tayoq (uchi qo'lga nisbatan). */
function queen(p: Pixels, pose: Pose, staffTop: Point, glow: boolean) {
  const { bob: b, lean: l } = pose;
  const fl = pose.leftFoot[0] - 12,
    fr = pose.rightFoot[0] - 20;
  // muz tayoq (gavda orqasida)
  const [hx, hy] = pose.hand;
  const top: Point = [hx + staffTop[0], hy + staffTop[1]];
  p.line(4, [hx, hy + 4], top, 1);
  // keng ko'ylak, etagi oyoq bilan chayqaladi
  p.polygon(3, [
    [12 + l, 12 + b],
    [20 + l, 12 + b],
    [25 + fr, 28],
    [7 + fl, 28],
  ]);
  p.line(2, [14 + l, 16 + b], [11 + fl, 27], 1);
  p.line(2, [18 + l, 16 + b], [21 + fr, 27], 1);
  p.rect(4, 8 + fl, 27, 17 + fr - fl, 2);
  // ko'ylak yuqorisi va kamar
  p.rect(2, 13 + l, 12 + b, 6, 4);
  p.rect(5, 13 + l, 16 + b, 6, 1);
  // qo'llar
  p.line(3, [13 + l, 13 + b], pose.otherHand, 2);
  p.line(3, [19 + l, 13 + b], pose.hand, 2);
  p.rect(4, pose.otherHand[0] - 1, pose.otherHand[1] - 1, 2, 2);
  p.rect(4, hx - 1, hy - 1, 3, 3);
  // tayoq uchidagi muz kristall
  const [tx, ty] = top;
  p.polygon(5, [
    [tx, ty - 3],
    [tx + 2, ty],
    [tx, ty + 3],
    [tx - 2, ty],
  ]);
  if (glow) p.rect(4, tx - 1, ty - 1, 2, 2);
  else p.rect(4, tx, ty, 1, 1);
  // bosh: oq yuz, to'q ko'k soch, muz toj
  p.rect(2, 12 + l, 6 + b, 8, 7);
  p.ellipse(4, 16 + l, 9.5 + b, 3, 3.5);
  p.rect(1, 14 + l, 9 + b, 1, 1);
  p.rect(1, 17 + l, 9 + b, 1, 1);
  p.rect(5, 13 + l, 4 + b, 7, 2);
  p.rect(5, 13 + l, 2 + b, 1, 2);
  p.rect(5, 16 + l, 1 + b, 1, 3);
  p.rect(5, 19 + l, 2 + b, 1, 2);
}

function queenFallen(p: Pixels, frame: number) {
  if (frame === 0) {
    // tiz cho'kdi, tayoq qo'ldan tushmoqda
    queen(p, { ...poses.hurt[0]!, bob: 4, lean: -2 }, [6, 1], false);
    return;
  }
  if (frame === 1) {
    // muzga aylanib cho'kmoqda
    p.polygon(3, [
      [10, 18],
      [20, 18],
      [27, 28],
      [4, 28],
    ]);
    p.rect(4, 5, 27, 22, 2);
    p.ellipse(4, 14, 16, 3, 3);
    p.rect(2, 11, 13, 7, 3);
    p.rect(5, 12, 11, 6, 2);
    p.line(4, [20, 24], [29, 27], 1);
    return;
  }
  // muz ko'lmak, ustida toj qolgan
  p.ellipse(3, 16, 27, 13, 3);
  p.ellipse(4, 13, 27, 5, 1.5);
  p.rect(5, 18, 23, 7, 2);
  p.rect(5, 18, 21, 1, 2);
  p.rect(5, 21, 20, 1, 3);
  p.rect(5, 24, 21, 1, 2);
  p.line(4, [4, 29], [12, 29], 1);
}

export function spritePixels(kind: SpriteKind, state: AnimState, frame: number, back = false) {
  const p = new Pixels();
  if (kind === "frost") {
    frostGhost(p, state, frame);
    return p.outlined();
  }
  if (kind === "iceblob") {
    iceblob(p, state, frame);
    return p.outlined();
  }
  if (kind === "golem" || kind === "wolf") {
    const f = Math.min(2, Math.max(0, frame));
    if (state === "death") {
      if (kind === "golem") snowmanFallen(p, f);
      else wolfFallen(p, f);
    } else if (kind === "golem") snowman(p, snowFrames[state][frame] ?? snowFrames[state][0]!);
    else wolf(p, wolfFrames[state][frame] ?? wolfFrames[state][0]!);
    return p.outlined();
  }
  if (kind === "queen") {
    const f = Math.min(2, Math.max(0, frame));
    if (state === "death") {
      queenFallen(p, f);
      return p.outlined();
    }
    const pose = poses[state][frame] ?? poses[state][0]!;
    queen(
      p,
      pose,
      staffTops[state][frame] ?? staffTops[state][0]!,
      state === "attack" && frame === 1,
    );
    return p.outlined();
  }
  if (kind === "slime") {
    slime(p, state, frame);
    return p.outlined();
  }
  if (kind === "bat") {
    bat(p, state, frame);
    return p.outlined();
  }
  if (kind === "archer" && state !== "death") {
    archer(p, state, frame);
    return p.outlined();
  }
  if (state === "death") fallen(p, kind, Math.min(2, Math.max(0, frame)));
  else {
    const pose = poses[state][frame] ?? poses[state][0];
    if (pose) {
      if (kind === "knight") knight(p, pose, back);
      else if (kind === "mage")
        mage(
          p,
          pose,
          back,
          staffTops[state][frame] ?? staffTops[state][0]!,
          state === "attack" && frame === 1,
          BEARD_SWAY[state][frame] ?? 0,
        );
      else if (kind === "skeleton") skeleton(p, pose);
      else if (kind === "shield") shieldBearer(p, pose, shieldPush[state][frame] ?? 0);
      else demon(p, pose, state === "attack" ? frame : null);
    }
  }
  return p.outlined();
}

const cache = new Map<string, HTMLCanvasElement>();

export function renderSprite(
  ctx: CanvasRenderingContext2D,
  kind: SpriteKind,
  state: AnimState,
  frame: number,
  x: number,
  y: number,
  flash: boolean,
  flip = false,
  back = false,
) {
  const key = `${kind}:${state}:${frame}:${flash}:${back}`;
  let canvas = cache.get(key);
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.width = canvas.height = 32;
    const raster = canvas.getContext("2d");
    if (!raster) return;
    const data = spritePixels(kind, state, frame, back);
    const palette = PALETTES[kind];
    for (let py = 0; py < 32; py++)
      for (let px = 0; px < 32; px++) {
        const color = data[py * 32 + px];
        if (!color) continue;
        raster.fillStyle =
          flash && color > 1 ? "#ffffff" : (palette[color - 1] ?? palette[0] ?? "#000000");
        raster.fillRect(px, py, 1, 1);
      }
    cache.set(key, canvas);
  }
  const size =
    kind === "demon" || kind === "queen"
      ? 64
      : kind === "golem"
        ? 40
        : kind === "slime" || kind === "bat" || kind === "frost" || kind === "iceblob"
          ? 26
          : 32;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (state === "death") ctx.globalAlpha = [1, 0.65, 0.3][frame] ?? 0.3;
  ctx.translate(Math.round(x), Math.round(y));
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(canvas, -size / 2, -size / 2, size, size);
  ctx.restore();
}

// Kuch kartalari ikonkalari (12x12): X — kuch rangi, qolganlari ICON_COLORS dan.
const ICON_COLORS: Record<string, string> = {
  o: "#ffffff",
  g: "#5bc85b",
  k: "#8a6a3a",
  r: "#ff4d6d",
  d: "#a8741a",
  // Sehrgar palitrasi: to'q qizil, och qizil, olovli to'q sariq, kumush, qora
  R: "#c1121f",
  L: "#ff4d4d",
  F: "#ff9a3c",
  S: "#d9d4e0",
  K: "#1f1520",
};
export const UPGRADE_ICONS: Record<string, readonly string[]> = {
  heart: [
    "............",
    ".XXX....XXX.",
    "XXoXX..XXXXX",
    "XoXXXXXXXXXX",
    "XXXXXXXXXXXX",
    "XXXXXXXXXXXX",
    ".XXXXXXXXXX.",
    "..XXXXXXXX..",
    "...XXXXXX...",
    "....XXXX....",
    ".....XX.....",
    "............",
  ],
  blade: [
    "..........oX",
    ".........oXX",
    "........oXX.",
    ".......oXX..",
    "......oXX...",
    ".....oXX....",
    ".k..oXX.....",
    "..koXX......",
    "...kk.......",
    "..kkkk......",
    ".kk..k......",
    "kk..........",
  ],
  reach: [
    "............",
    "............",
    ".k..........",
    ".kkooooooo..",
    "kkkXXXXXXXXX",
    ".kkXXXXXXXX.",
    ".k..........",
    "............",
    ".o........o.",
    "oooooooooooo",
    ".o........o.",
    "............",
  ],
  haste: [
    "...XXXXXX...",
    "..XoooXooX..",
    ".XooooXoooX.",
    "XoooooXooooX",
    "XoooooXooooX",
    "XoooooXXXXoX",
    "XooooooooooX",
    "XooooooooooX",
    ".XooooooooX.",
    "..XooooooX..",
    "...XXXXXX...",
    "............",
  ],
  wind: [
    "............",
    "X...........",
    "XX..........",
    "XXX.........",
    "XoXX........",
    "XXoXXX......",
    ".XXoXXXX....",
    ".XXXoXXXXX..",
    "..XXXoXXXXXX",
    "...XXXXoXXX.",
    "....XXXXX...",
    "......XX....",
  ],
  vamp: [
    ".....XX.....",
    ".....XX.....",
    "....XXXX....",
    "....XXXX....",
    "...XXXXXX...",
    "..XXXXXXXX..",
    "..XoXXXXXX..",
    ".XXoXXXXXXX.",
    ".XXoXXXXXXX.",
    ".XXXXXXXXXX.",
    "..XXXXXXXX..",
    "...XXXXXX...",
  ],
  thorns: [
    "X....XX....X",
    ".X.XXXXXX.X.",
    "..XooooooX..",
    ".XXoXXXXoXX.",
    "XXXoXXXXoXXX",
    ".XXoXXXXoXX.",
    "..XoXXXXoX..",
    ".XXXoXXoXXX.",
    "X.XXXooXXX.X",
    "...XXXXXX...",
    "....XXXX....",
    ".....XX.....",
  ],
  dash2: [
    "............",
    "X.....X.....",
    "XX....XX....",
    "oXX...oXX...",
    ".oXX...oXX..",
    "..oXX...oXX.",
    "..oXX...oXX.",
    ".oXX...oXX..",
    "oXX...oXX...",
    "XX....XX....",
    "X.....X.....",
    "............",
  ],
  mend: [
    "....kkkk....",
    ".....XX.....",
    ".....XX.....",
    "....XXXX....",
    "..XXXXXXXX..",
    ".XoXXXXXXXX.",
    ".XggggggggX.",
    "XgoggggggggX",
    "XggggggggggX",
    "XggggggggggX",
    ".XggggggggX.",
    "..XXXXXXXX..",
  ],
  // ---- Sehrgar kartalari: qilich yoki tig'siz ----
  // Sehrgar: to'q qizil sehrli yurak, ichida olovli yulduzcha
  mheart: [
    "............",
    ".XXX....XXX.",
    "XXoXX..XXXXX",
    "XoXXXXXXXXXX",
    "XXXXXFXXXXXX",
    "XXXXFFFXXXXX",
    ".XXXXFXXXXX.",
    "..XXXXXXXX..",
    "...XXXXXX...",
    "....XXXX....",
    ".....XX.....",
    "............",
  ],
  // Olovli sehrli shar
  fireball: [
    "........L...",
    "......LXL...",
    "....LXXXXL..",
    "...LXXLLXXL.",
    "..LXXLooLXX.",
    ".LXXLoooLXL.",
    ".XXXLoooLX..",
    ".XXXXLLLXX..",
    "..XXXXXXX...",
    "...XXXXX....",
    "............",
    "............",
  ],
  // Keng sehrli halqa, markazida qizil shar
  ring: [
    "....XXXX....",
    "..XX....XX..",
    ".X........X.",
    ".X...RR...X.",
    "X...RFFR...X",
    "X...RFoR...X",
    "X...RFFR...X",
    "X....RR....X",
    ".X........X.",
    ".X........X.",
    "..XX....XX..",
    "....XXXX....",
  ],
  // Afsun kitobi: qizil muqova, oltin varaqlar
  book: [
    "............",
    ".RRRR..RRRR.",
    "RXXXXRRXXXXR",
    "RXKKXRRXKKXR",
    "RXXXXRRXXXXR",
    "RXKKXRRXLLXR",
    "RXXXXRRXLLXR",
    "RXKKXRRXXXXR",
    "RXXXXRRXXXXR",
    ".RRRRXXRRRR.",
    "....RRRR....",
    "............",
  ],
  // Qanotli kumush yulduz, qizil iz
  wstar: [
    ".....X......",
    ".....X......",
    "....XLX.....",
    "XXXXXLXXXXX.",
    ".XXXLLLXXX..",
    "..XXXLXXX...",
    "..XX.X.XX...",
    ".XX.....XX..",
    "LL.......LL.",
    ".LL.....LL..",
    "..L.....L...",
    "............",
  ],
  // Qizil ruh alangasi
  spirit: [
    ".....X......",
    "....XX......",
    "....XXX.X...",
    "...XXXX.XX..",
    "..XXXFXXXX..",
    "..XXFFXXXX..",
    ".XXFFFFXXXX.",
    ".XXFoooFXXX.",
    ".XXFKoFKXXX.",
    "..XXFFFFXX..",
    "...XXXXXX...",
    "....XXXX....",
  ],
  // Kumush-oq ayoz kristali, qizil yadro
  ice: [
    ".....X......",
    "...X.X.X....",
    "....XXX.....",
    ".X..XoX..X..",
    "..X.XLX.X...",
    "XXXXLLLXXXX.",
    "..X.XLX.X...",
    ".X..XoX..X..",
    "....XXX.....",
    "...X.X.X....",
    ".....X......",
    "............",
  ],
  // Portal — qizil chekkali ikki qora halqa
  portal: [
    "............",
    ".XXX....XXX.",
    "XKKKX..XKKKX",
    "XKFKX..XKFKX",
    "XFoFX..XFoFX",
    "XFoFX..XFoFX",
    "XKFKX..XKFKX",
    "XKKKX..XKKKX",
    ".XXX....XXX.",
    "..S......S..",
    "...SSSSSS...",
    "............",
  ],
  // Shifobaxsh iksir — kumush shishada qizil suyuqlik
  elixir: [
    "....SSSS....",
    ".....SS.....",
    ".....SS.....",
    "....SooS....",
    "...SXXXXS...",
    "..SXoXXXXS..",
    ".SXoXXXXXXS.",
    ".SXXXXXXXXS.",
    ".SXXXXFXXXS.",
    "..SXXFFFXS..",
    "...SSSSSS...",
    "............",
  ],
  // Uch shar — yelpig'ich
  orbs: [
    "..........XX",
    ".........XoX",
    "...RR....XX.",
    "..RRR.......",
    "XX......XX..",
    "XoX....XoX..",
    ".XX....XX...",
    "........RR..",
    "...XX..RRR..",
    "..XoX.......",
    "..XX........",
    "FF..........",
  ],
  // Teshuvchi shar — shar nishonni teshib o'tadi
  crystal: [
    "............",
    ".....SS.....",
    ".....SS.....",
    ".....SS..XX.",
    "....FSS.XooX",
    "FF.FFFFFXooX",
    "....FSS.XooX",
    ".....SS..XX.",
    ".....SS.....",
    ".....SS.....",
    "............",
    "............",
  ],
  // Do'kon: omad tumori — taqa ichida yurak
  luck: [
    "............",
    ".XX......XX.",
    "XoX......XXX",
    "XoX......XXX",
    "XXX.r..r.XXX",
    "XXX.rrrr.XXX",
    "XXX..rr..XXX",
    ".XXX....XXX.",
    ".XXXX..XXXX.",
    "..XXXXXXXX..",
    "...XXXXXX...",
    "............",
  ],
  // Yutuq kubogi
  trophy: [
    "............",
    ".XXXXXXXXXX.",
    "XXoXXXXXXXXX",
    "X.XoXXXXXX.X",
    "X.XoXXXXXX.X",
    ".XXXXXXXXXX.",
    "..XXXXXXXX..",
    "....XXXX....",
    ".....XX.....",
    "....XXXX....",
    "...dddddd...",
    "...dddddd...",
  ],
  // Oltin tanga
  coin: [
    "....XXXX....",
    "..XXXXXXXX..",
    ".XXoodddXXX.",
    ".XoXXXXXXdX.",
    "XXoXXddXXXdX",
    "XXXXdXXXXXdX",
    "XXXXXddXXXdX",
    "XXXXXXXdXXdX",
    ".XXXddXXXdX.",
    ".XXXXXXXddX.",
    "..XXdddddX..",
    "....XXXX....",
  ],
};

const iconCache = new Map<string, HTMLCanvasElement>();

/** Kuch ikonkasini (x, y) chap-yuqori burchakdan size x size o'lchamda chizadi. */
export function renderUpgradeIcon(
  ctx: CanvasRenderingContext2D,
  id: string,
  color: string,
  x: number,
  y: number,
  size = 12,
) {
  const rows = UPGRADE_ICONS[id];
  if (!rows) return;
  const key = `${id}:${color}`;
  let canvas = iconCache.get(key);
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.width = canvas.height = 12;
    const raster = canvas.getContext("2d");
    if (!raster) return;
    rows.forEach((row, py) =>
      [...row].forEach((ch, px) => {
        if (ch === ".") return;
        raster.fillStyle = ch === "X" ? color : (ICON_COLORS[ch] ?? color);
        raster.fillRect(px, py, 1, 1);
      }),
    );
    iconCache.set(key, canvas);
  }
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(canvas, Math.round(x), Math.round(y), size, size);
  ctx.restore();
}
