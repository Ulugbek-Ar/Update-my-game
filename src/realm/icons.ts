/** Buyum ikonkalari (12x12) — kod bilan chiziladi, har biri ko'pi bilan 5 rang (siyoh bilan). */
import type { Rarity } from "./schema";

/** Noyoblik rangi: oddiy — kulrang-oq, noyob — ko'k, afsonaviy — to'q sariq */
export const RARITY_COLOR: Record<Rarity, string> = {
  common: "#d9d4e0",
  rare: "#5fb3ff",
  legendary: "#ffb02e",
};
export const RARITY_NAME: Record<Rarity, string> = {
  common: "ODDIY",
  rare: "NOYOB",
  legendary: "AFSONAVIY",
};

interface Icon {
  /** belgi -> rang ("." — shaffof) */
  colors: Record<string, string>;
  rows: readonly string[];
}

export const ITEM_ICONS: Record<string, Icon> = {
  bread: {
    colors: { k: "#1a0f08", a: "#8a5426", b: "#c98a44", c: "#f0c27a" },
    rows: [
      "............",
      "............",
      "....kkkk....",
      "..kkbcccbk..",
      ".kbccbcccbk.",
      ".kbcbccbcbk.",
      "kbbbbbbbbbbk",
      "kabbbbbbbbak",
      ".kaaaaaaaak.",
      "..kkkkkkkk..",
      "............",
      "............",
    ],
  },
  potion: {
    colors: { k: "#120a12", g: "#b8c4d0", r: "#c1121f", p: "#ff6a6a", w: "#ffffff" },
    rows: [
      "....kkkk....",
      "....kggk....",
      ".....kk.....",
      "....kggk....",
      "...kggggk...",
      "..kgrrrrgk..",
      ".kgrppwrrgk.",
      ".kgrpprrrgk.",
      ".kgrrrrrrgk.",
      "..kgrrrrgk..",
      "...kkkkkk...",
      "............",
    ],
  },
  meat: {
    colors: { k: "#1a0808", m: "#a8323a", l: "#e0646a", b: "#efe2c4" },
    rows: [
      "............",
      "...kkkk.....",
      "..kmmllk....",
      ".kmmmmllk...",
      ".kmmmmmlk...",
      ".kmmmmmmk...",
      "..kmmmmkk...",
      "...kkkkbk...",
      ".......kbk..",
      "......kbbbk.",
      "......kbkbk.",
      ".......k.k..",
    ],
  },
  tusk: {
    colors: { k: "#140e08", w: "#efe2c4", s: "#b8a888" },
    rows: [
      "............",
      "..........k.",
      ".........kwk",
      "........kwwk",
      ".......kwwsk",
      "......kwwsk.",
      ".....kwwsk..",
      "...kkwwsk...",
      "..kwwwsk....",
      ".kwwssk.....",
      ".kkkkk......",
      "............",
    ],
  },
  tail: {
    colors: { k: "#140808", p: "#d98b8b", d: "#a65e5e" },
    rows: [
      "............",
      "..kk........",
      ".kpk........",
      ".kpk........",
      "..kpk.......",
      "...kpkk.....",
      "....kppk....",
      ".....kdpk...",
      "......kdpk..",
      ".......kppk.",
      "........kkk.",
      "............",
    ],
  },
  core: {
    colors: { k: "#0d0c11", s: "#77727f", l: "#b3adb9", g: "#5fe0c8" },
    rows: [
      "............",
      "..kkk..kkk..",
      ".klssk.ksssk",
      "kllsssksssk.",
      "klsssggsssk.",
      "ksssggggssk.",
      ".kssggggsk..",
      "..ksssgssk..",
      "...kssssk...",
      "....kssk....",
      ".....kk.....",
      "............",
    ],
  },
  glow: {
    colors: { k: "#081022", b: "#1d3f7a", c: "#45b8e0", w: "#fff6c8" },
    rows: [
      "............",
      ".....k......",
      "....kck.....",
      "...kbcbk..k.",
      "..kbcwcbk...",
      ".kbcwwwcbk..",
      "..kbcwcbk...",
      "...kbcbk....",
      "k...kck.....",
      ".....k......",
      "............",
      "............",
    ],
  },
  star: {
    colors: { k: "#1a1206", y: "#ffd84a", w: "#fff6c8", o: "#e09a2a" },
    rows: [
      ".....kk.....",
      ".....kyk....",
      "....kywk....",
      "kkkkkywykkkk",
      "kyyyywwyyyok",
      ".kyyywwyyok.",
      "..kyyyyyok..",
      "..kyyokyyk..",
      ".kyyok.kyyk.",
      ".kyok...kok.",
      ".kk......kk.",
      "............",
    ],
  },
  coin: {
    colors: { k: "#1a1206", d: "#a8741a", y: "#ffcc33", w: "#fff2a8" },
    rows: [
      "............",
      "...kkkkkk...",
      "..kddddddk..",
      ".kdywyyyydk.",
      ".kdwykkyydk.",
      ".kdyyk.kydk.",
      ".kdyyk.kydk.",
      ".kdyykkyydk.",
      ".kdyyyyyydk.",
      "..kddddddk..",
      "...kkkkkk...",
      "............",
    ],
  },
  amulet: {
    colors: { k: "#120a08", c: "#8a6a44", g: "#f0c050", r: "#c1121f" },
    rows: [
      "..k......k..",
      "..kc....ck..",
      "...kc..ck...",
      "....kcck....",
      ".....kk.....",
      "....kggk....",
      "...kgrrgk...",
      "...kgrrgk...",
      "....kggk....",
      ".....kk.....",
      "............",
      "............",
    ],
  },
  horn: {
    colors: { k: "#120608", d: "#5a0e14", r: "#a8323a", o: "#ff7a2a", y: "#ffe14d" },
    rows: [
      "........kk..",
      ".......kyk..",
      "......kok...",
      ".....kork...",
      "....kordk...",
      "...korrdk...",
      "..korrdk....",
      ".korrddk....",
      ".krrddk.....",
      ".kdddk......",
      "..kkk.......",
      "............",
    ],
  },
  ember: {
    colors: { k: "#120608", c: "#8a6a44", r: "#c1121f", o: "#ff9a3c", y: "#ffe14d" },
    rows: [
      "..k......k..",
      "..kc....ck..",
      "...kc..ck...",
      "....kcck....",
      ".....kk.....",
      "....kook....",
      "...koyyok...",
      "...koyrok...",
      "....krrk....",
      ".....kk.....",
      "............",
      "............",
    ],
  },
  ring: {
    colors: { k: "#0a0a14", s: "#c9ccd6", b: "#3a5ad8", l: "#9ab8ff" },
    rows: [
      "............",
      ".....kk.....",
      "....kblk....",
      "....kbbk....",
      "...kksskk...",
      "..ksk..ksk..",
      ".ksk....ksk.",
      ".ksk....ksk.",
      "..ksk..ksk..",
      "...kssssk...",
      "....kkkk....",
      "............",
    ],
  },
  // Qari Merganning mis gilzasi: ichi bo'sh jez patron, pastida qalin gardish
  casing: {
    colors: { k: "#120c08", b: "#d9a441", l: "#ffe2a0", d: "#8a5a2a" },
    rows: [
      "............",
      "....kkkk....",
      "...kllbbk...",
      "...klbbbk...",
      "...klbbbk...",
      "...klbbbk...",
      "...klbbbk...",
      "...klbbbk...",
      "..kddddddk..",
      "..kddddddk..",
      "...kkkkkk...",
      "............",
    ],
  },
  blade: {
    colors: { k: "#0b0a0e", s: "#7a7084", l: "#d9d4e0", g: "#c9a25a", e: "#ff7a2a" },
    rows: [
      "..........kk",
      ".........kll",
      "........klsk",
      ".......klsk.",
      "......klsk..",
      ".....klsk...",
      "..k.klsk....",
      "..kgksk.....",
      "...kgk......",
      "..kgekg.....",
      ".kgk..k.....",
      ".kk.........",
    ],
  },
};

const cache = new Map<string, HTMLCanvasElement>();

/** Ikonkani (x, y) ga size o'lchamda chizadi. */
export function drawItemIcon(
  c: CanvasRenderingContext2D,
  icon: string,
  x: number,
  y: number,
  size = 12,
) {
  const def = ITEM_ICONS[icon];
  if (!def) return;
  let canvas = cache.get(icon);
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.width = canvas.height = 12;
    const r = canvas.getContext("2d");
    if (!r) return;
    def.rows.forEach((row, py) =>
      [...row].forEach((ch, px) => {
        const col = def.colors[ch];
        if (!col) return;
        r.fillStyle = col;
        r.fillRect(px, py, 1, 1);
      }),
    );
    cache.set(icon, canvas);
  }
  c.drawImage(canvas, Math.round(x), Math.round(y), size, size);
}
