import type { AnimState } from "./animation";

export type SpriteKind = "knight" | "skeleton" | "archer" | "demon" | "slime" | "bat";
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
const palettes: Record<SpriteKind, readonly string[]> = {
  knight: ["#080e19", "#183b62", "#287faf", "#68cde4", "#c5e4ec"],
  skeleton: ["#101015", "#747b82", "#d6d9cf", "#935331", "#bd8250"],
  // Kamonchi: o'sha skelet chizmasi, moxli-yashil palitra
  archer: ["#0e1410", "#4e6b45", "#cfd8b0", "#6b4226", "#a8743a"],
  demon: ["#170b11", "#681e2b", "#b23238", "#f4cb45", "#a7a3a0"],
  slime: ["#0b1a10", "#2c7a3c", "#5bc85b", "#a6f08e", "#f2fbe4"],
  bat: ["#120a1a", "#4a2470", "#8a4fc0", "#c99ae8", "#ffe14d"],
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

// ---- Kamonchi skelet: 4 — yog'och, 5 — och yog'och/o'q, 3 — ip va pat ----

/** Yelka ortidagi o'qdon (tanadan oldin chiziladi, tana uni qisman yopadi). */
function quiver(p: Pixels, b: number) {
  p.line(4, [6, 21 + b], [9, 10 + b], 3);
  p.line(5, [7, 18 + b], [8, 14 + b], 1);
  // o'qlarning patlari yelka ustidan chiqib turadi
  p.rect(3, 7, 6 + b, 1, 3);
  p.rect(5, 9, 5 + b, 1, 3);
  p.rect(3, 11, 6 + b, 1, 2);
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
  p.rect(5, Math.round(mx + nx * bulge) - 1, Math.round(my + ny * bulge) - 1, 2, 3);
  // o'q: ipdan oldinga, uchi kamondan chiqib turadi
  if (pull && arrow) {
    const tipX = Math.min(30, Math.round(mx + nx * (bulge + 5)));
    const tipY = pull[1];
    p.line(5, pull, [tipX, tipY], 1);
    p.rect(3, tipX - 1, tipY - 1, 2, 3);
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
  loweredBow(p, pose.hand);
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
  const skeletonBody = kind === "skeleton" || kind === "archer";
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
      // kamon qo'ldan sirg'alib tushmoqda
      bow(p, [27, 18], [22, 29], 2, null, false);
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
    // kamon yerga qulamoqda
    if (kind === "archer") bow(p, [24, 17], [29, 27], 2, null, false);
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

export function spritePixels(kind: SpriteKind, state: AnimState, frame: number, back = false) {
  const p = new Pixels();
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
      else if (kind === "skeleton") skeleton(p, pose);
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
    const palette = palettes[kind];
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
  const size = kind === "demon" ? 64 : kind === "slime" || kind === "bat" ? 26 : 32;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (state === "death") ctx.globalAlpha = [1, 0.65, 0.3][frame] ?? 0.3;
  ctx.translate(Math.round(x), Math.round(y));
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(canvas, -size / 2, -size / 2, size, size);
  ctx.restore();
}

// Kuch kartalari ikonkalari (12x12): X — kuch rangi, qolganlari ICON_COLORS dan.
const ICON_COLORS: Record<string, string> = { o: "#ffffff", g: "#5bc85b", k: "#8a6a3a" };
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
