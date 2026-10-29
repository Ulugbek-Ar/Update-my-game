/** Plitkalar rasmi: kod bilan, har bir plitka joyiga qarab ozgina farq qiladi (hash). */
import { hash2 } from "./rng";
import { TILE, TILE_BY_ID, TILE_IDS, type TileName } from "./tiles";

type Ctx = CanvasRenderingContext2D;

function px(c: Ctx, color: string, x: number, y: number, w = 1, h = 1) {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
}

/** Minikarta rangi */
export const TILE_COLOR: Record<TileName, string> = {
  grass: "#4a7a3a",
  grass2: "#3f6e33",
  flowers: "#5a8a44",
  path: "#8a6a44",
  water: "#2a5a8a",
  bridge: "#7a5230",
  tree: "#24502a",
  bush: "#35652e",
  rock: "#6a6a72",
  cliff: "#4a4038",
  floor: "#6e6a72",
  ruinwall: "#45414d",
  cracked: "#45414d",
  wall: "#b89a6a",
  roof: "#8a3a2a",
  door: "#6a4222",
  fence: "#7a5a34",
  marsh: "#3a4a2e",
  sand: "#c8b07a",
  cavefloor: "#2e2723",
  cave: "#0a0806",
  reeds: "#4a5a30",
  field: "#6a4e2e",
  well: "#77727f",
  pine: "#1c4226",
  rubble: "#6e6a72",
  stairs: "#2a2630",
  window: "#b89a6a",
  pool: "#2a5a8a",
  pillar: "#8a8692",
};

function grass(c: Ctx, x: number, y: number, r: (i: number) => number, dark = false) {
  px(c, dark ? "#46753a" : "#4a7a3a", x, y, TILE, TILE);
  for (let i = 0; i < 6; i++) {
    const gx = x + Math.floor(r(i) * 15),
      gy = y + Math.floor(r(i + 10) * 14);
    px(c, dark ? "#38652d" : "#3b6a2e", gx, gy, 1, 2);
  }
  if (r(30) < 0.5)
    px(c, dark ? "#55864a" : "#6a9a4a", x + Math.floor(r(31) * 14), y + Math.floor(r(32) * 14));
}

function stone(c: Ctx, x: number, y: number, base: string, dark: string, light: string) {
  px(c, base, x, y, TILE, TILE);
  px(c, dark, x, y + 7, TILE, 1);
  px(c, dark, x, y + 15, TILE, 1);
  px(c, dark, x + 7, y, 1, 7);
  px(c, dark, x + 3, y + 8, 1, 7);
  px(c, dark, x + 12, y + 8, 1, 7);
  px(c, light, x, y, 7, 1);
  px(c, light, x + 8, y, 8, 1);
  px(c, light, x, y + 8, 3, 1);
  px(c, light, x + 4, y + 8, 8, 1);
}

/**
 * O'rmon: qo'shni daraxtlar bitta yashil massaga qo'shiladi; chekkalari faqat o'rmon tugagan joyda
 * yumaloqlanadi, tanasi esa faqat pastki qatorda ko'rinadi.
 */
function canopy(
  c: Ctx,
  x: number,
  y: number,
  r: (i: number) => number,
  same: (dx: number, dy: number) => boolean,
  pine: boolean,
) {
  const dark = pine ? "#0f2a17" : "#1a3a1c",
    mid = pine ? "#1f4a2a" : "#2d5a26",
    light = pine ? "#2e6a3a" : "#3f7a34",
    shine = pine ? "#3a7a46" : "#5a9a44";
  const up = same(0, -1),
    down = same(0, 1),
    left = same(-1, 0),
    right = same(1, 0);
  grass(c, x, y, r, pine);
  // pastki qator: tana va soya
  const bottom = down ? TILE : 11;
  if (!down) {
    px(c, "rgba(0,0,0,0.25)", x + 2, y + 13, 12, 2);
    px(c, "#2a1a10", x + 6, y + 10, 4, 5);
    px(c, "#5a3a22", x + 7, y + 10, 2, 5);
  }
  const top = up ? 0 : 2,
    l = left ? 0 : 1,
    rr = right ? TILE : 15;
  px(c, dark, x + l, y + top, rr - l, bottom - top);
  // yumaloq burchaklar faqat ochiq tomonda
  const cut = (cx: number, cy: number) => px(c, pine ? "#46753a" : "#4a7a3a", x + cx, y + cy);
  if (!up && !left) cut(l, top);
  if (!up && !right) cut(rr - 1, top);
  if (!down && !left) cut(l, bottom - 1);
  if (!down && !right) cut(rr - 1, bottom - 1);
  px(
    c,
    mid,
    x + l + (left ? 0 : 1),
    y + top + (up ? 0 : 1),
    rr - l - (left ? 0 : 1) - (right ? 0 : 1),
    bottom - top - (up ? 0 : 1) - (down ? 0 : 2),
  );
  // barg to'dalari: joyiga qarab har xil
  for (let i = 0; i < 3; i++) {
    const bx = x + 1 + Math.floor(r(70 + i) * 10),
      by = y + top + 1 + Math.floor(r(80 + i) * Math.max(1, bottom - top - 6));
    px(c, light, bx, by, 4, 3);
    px(c, light, bx + 1, by - 1, 2, 1);
    if (r(90 + i) < 0.5) px(c, shine, bx + 1, by, 1, 1);
  }
  if (!pine && r(3) < 0.18)
    px(c, "#c1121f", x + 3 + Math.floor(r(4) * 9), y + top + 3 + Math.floor(r(5) * 5));
  if (pine && !up) {
    // archa uchi
    px(c, dark, x + 6, y, 4, 2);
    px(c, light, x + 7, y, 2, 2);
  }
}

/** Bitta plitkani (x, y) piksel nuqtaga chizadi; at — qo'shni plitka (o'rmon chegaralari uchun). */
export function drawTile(
  c: Ctx,
  id: number,
  x: number,
  y: number,
  tx: number,
  ty: number,
  at: (dx: number, dy: number) => number = () => -1,
) {
  const name = TILE_BY_ID[id] ?? "grass";
  const r = (i: number) => hash2(id * 131 + i, tx, ty);
  switch (name) {
    case "grass":
      return grass(c, x, y, r);
    case "grass2":
      return grass(c, x, y, r, true);
    case "flowers": {
      grass(c, x, y, r);
      const cols = ["#ffd84a", "#e88aa8", "#f2f0e6", "#9ab8ff"];
      for (let i = 0; i < 3; i++) {
        const fx = x + 2 + Math.floor(r(40 + i) * 11),
          fy = y + 2 + Math.floor(r(50 + i) * 11);
        px(c, cols[Math.floor(r(60 + i) * cols.length)]!, fx, fy, 2, 2);
        px(c, "#7a5a1a", fx, fy + 2);
      }
      return;
    }
    case "path":
    case "rubble": {
      if (name === "rubble") stone(c, x, y, "#6e6a72", "#57535c", "#7e7a84");
      else px(c, "#8a6a44", x, y, TILE, TILE);
      for (let i = 0; i < 5; i++)
        px(
          c,
          name === "rubble" ? "#4a4652" : i % 2 ? "#6e5236" : "#a88458",
          x + Math.floor(r(i) * 14),
          y + Math.floor(r(i + 7) * 14),
          name === "rubble" ? 3 : 2,
          name === "rubble" ? 2 : 1,
        );
      return;
    }
    case "sand":
      px(c, "#c8b07a", x, y, TILE, TILE);
      for (let i = 0; i < 5; i++)
        px(
          c,
          i % 2 ? "#b09868" : "#dcc48e",
          x + Math.floor(r(i) * 15),
          y + Math.floor(r(i + 9) * 15),
        );
      return;
    case "water":
    case "pool":
      px(c, "#2a5a8a", x, y, TILE, TILE);
      px(c, "#244e7a", x, y + 12, TILE, 4);
      for (let i = 0; i < 2; i++)
        px(c, "#3a7ab0", x + Math.floor(r(i) * 10), y + 3 + Math.floor(r(i + 4) * 8), 5, 1);
      return;
    case "bridge":
      px(c, "#7a5230", x, y, TILE, TILE);
      for (let i = 0; i < 4; i++) px(c, "#4a3018", x + i * 4 + 3, y, 1, TILE);
      px(c, "#9a6e42", x, y + 1, TILE, 1);
      if (r(1) < 0.3) px(c, "#4a3018", x + 5, y + 7, 2, 1);
      return;
    case "tree":
    case "pine": {
      const forest = (t: number) => t === TILE_IDS.tree || t === TILE_IDS.pine;
      canopy(c, x, y, r, (dx, dy) => forest(at(dx, dy)), name === "pine");
      return;
    }
    case "bush":
      grass(c, x, y, r);
      // dumaloq buta (burchaklari kesilgan)
      px(c, "#1a3a1c", x + 3, y + 4, 10, 11);
      px(c, "#1a3a1c", x + 2, y + 6, 12, 7);
      px(c, "#35652e", x + 4, y + 5, 8, 9);
      px(c, "#35652e", x + 3, y + 7, 10, 5);
      px(c, "#4f8a3a", x + 5, y + 6, 3, 2);
      if (r(2) < 0.5) {
        px(c, "#c1121f", x + 9, y + 9);
        px(c, "#c1121f", x + 6, y + 11);
      }
      return;
    case "rock":
      grass(c, x, y, r);
      px(c, "#2a2a30", x + 3, y + 4, 10, 11);
      px(c, "#2a2a30", x + 2, y + 6, 12, 8);
      px(c, "#6a6a72", x + 4, y + 5, 8, 8);
      px(c, "#6a6a72", x + 3, y + 7, 10, 5);
      px(c, "#9a9aa4", x + 5, y + 5, 4, 2);
      px(c, "#45454e", x + 4, y + 12, 8, 1);
      return;
    case "cliff":
      px(c, "#4a4038", x, y, TILE, TILE);
      px(c, "#3a332e", x, y + 5, TILE, 1);
      px(c, "#3a332e", x, y + 11, TILE, 1);
      px(c, "#5e544a", x + Math.floor(r(1) * 8), y + 1, 6, 2);
      px(c, "#5e544a", x + Math.floor(r(2) * 8), y + 7, 7, 2);
      px(c, "#2e2823", x + Math.floor(r(3) * 12), y + 12, 3, 2);
      return;
    case "floor":
      stone(c, x, y, "#6e6a72", "#57535c", "#7e7a84");
      if (r(5) < 0.25) px(c, "#4f6e3a", x + Math.floor(r(6) * 12), y + Math.floor(r(7) * 12), 2, 1);
      return;
    case "ruinwall":
    case "cracked":
      stone(c, x, y, "#5a5662", "#3e3b45", "#8a8692");
      px(c, "#2a2830", x, y + 14, TILE, 2);
      if (r(8) < 0.35) px(c, "#4f6e3a", x + Math.floor(r(9) * 12), y + 1, 3, 1);
      if (name === "cracked") {
        // juda nozik yoriq — diqqatli o'yinchi sezadi
        px(c, "#2e2b33", x + 6, y + 2, 1, 2);
        px(c, "#2e2b33", x + 7, y + 4, 1, 2);
        px(c, "#2e2b33", x + 6, y + 6, 1, 1);
        px(c, "#2e2b33", x + 8, y + 9, 1, 3);
      }
      return;
    case "wall":
    case "window":
    case "door":
      px(c, "#b89a6a", x, y, TILE, TILE);
      px(c, "#6a4a2a", x, y, TILE, 2);
      px(c, "#6a4a2a", x, y + 14, TILE, 2);
      px(c, "#6a4a2a", x, y, 2, TILE);
      px(c, "#cbb084", x + 3, y + 3, 10, 1);
      if (name === "window") {
        px(c, "#2a1a10", x + 4, y + 4, 8, 8);
        px(c, "#ffd87a", x + 5, y + 5, 6, 6);
        px(c, "#6a4a2a", x + 7, y + 5, 2, 6);
      }
      if (name === "door") {
        px(c, "#2a1a10", x + 3, y + 2, 10, 14);
        px(c, "#6a4222", x + 4, y + 3, 8, 13);
        px(c, "#4a2e16", x + 7, y + 3, 1, 13);
        px(c, "#f0c050", x + 10, y + 9);
      }
      return;
    case "roof":
      px(c, "#8a3a2a", x, y, TILE, TILE);
      for (let i = 0; i < 4; i++) px(c, "#6a2a1e", x, y + i * 4 + 3, TILE, 1);
      for (let i = 0; i < 4; i++)
        px(c, "#a84a32", x + ((i * 5 + (ty % 2) * 2) % 14), y + i * 4, 3, 1);
      return;
    case "fence":
      grass(c, x, y, r);
      px(c, "#3a2614", x, y + 6, TILE, 3);
      px(c, "#7a5a34", x, y + 6, TILE, 2);
      px(c, "#3a2614", x + 2, y + 2, 3, 12);
      px(c, "#9a7444", x + 3, y + 3, 1, 10);
      px(c, "#3a2614", x + 11, y + 2, 3, 12);
      px(c, "#9a7444", x + 12, y + 3, 1, 10);
      return;
    case "marsh":
    case "reeds":
      px(c, "#3a4a2e", x, y, TILE, TILE);
      if (r(1) < 0.5) px(c, "#2e4a4a", x + Math.floor(r(2) * 9), y + Math.floor(r(3) * 11), 6, 3);
      px(c, "#46583a", x + Math.floor(r(4) * 14), y + Math.floor(r(5) * 14), 2, 1);
      if (name === "reeds")
        for (let i = 0; i < 4; i++) {
          const rx = x + 2 + Math.floor(r(10 + i) * 12);
          px(c, "#8a9a4a", rx, y + 4 + Math.floor(r(20 + i) * 4), 1, 8);
          px(c, "#5a3a22", rx, y + 3 + Math.floor(r(20 + i) * 4), 1, 2);
        }
      return;
    case "field":
      px(c, "#6a4e2e", x, y, TILE, TILE);
      for (let i = 0; i < 4; i++) {
        px(c, "#563e22", x, y + i * 4 + 2, TILE, 1);
        px(c, "#7aa84a", x + 2 + ((i * 5 + tx) % 12), y + i * 4, 1, 2);
      }
      return;
    case "well":
      grass(c, x, y, r);
      px(c, "#3b3843", x + 1, y + 1, 14, 14);
      px(c, "#77727f", x + 2, y + 2, 12, 12);
      px(c, "#14202a", x + 4, y + 4, 8, 8);
      px(c, "#2a5a8a", x + 5, y + 5, 6, 6);
      return;
    case "cavefloor":
      px(c, "#2e2723", x, y, TILE, TILE);
      px(c, "#3a322c", x + Math.floor(r(1) * 10), y + Math.floor(r(2) * 12), 5, 2);
      px(c, "#221c19", x + Math.floor(r(3) * 12), y + Math.floor(r(4) * 12), 3, 2);
      return;
    case "cave":
      px(c, "#0a0806", x, y, TILE, TILE);
      px(c, "#1a1512", x, y, TILE, 2);
      return;
    case "stairs":
      px(c, "#2a2630", x, y, TILE, TILE);
      for (let i = 0; i < 4; i++) px(c, i % 2 ? "#57535c" : "#77727f", x + 1, y + i * 4, 14, 2);
      return;
    case "pillar":
      stone(c, x, y, "#6e6a72", "#57535c", "#7e7a84");
      px(c, "#2a2830", x + 2, y + 2, 12, 13);
      px(c, "#8a8692", x + 3, y + 2, 10, 11);
      px(c, "#b3adb9", x + 4, y + 3, 4, 2);
      px(c, "#57535c", x + 3, y + 12, 10, 1);
      return;
  }
}
