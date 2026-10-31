/** Sarguzasht xaritasi: bosh menyudan keyin dunyo tanlanadigan piksel ekran (kod bilan chiziladi). */
import { ROOM, px } from "./animation";
import { gameKeysLocked } from "./input";
import { actionKey, normKey, type KeyBinds } from "./keys";
import { currentSettings, loadSettings } from "./settings";
import { HEROES, type Hero } from "./hero";
import { renderSprite } from "./sprites";
import { MAP_WORLDS, isWorldOpen, worldBest, worldWins, type MapWorld } from "./progress";

/** Xaritada oxirgi tanlangan dunyo */
export const MAP_SEL_KEY = "pixel-rpg-map-world";
/** O'ynash mumkin bo'lgan dunyolar */
export const PLAYABLE_WORLDS: readonly MapWorld[] = [1, 2, 3];

export interface MapNode {
  world: MapWorld;
  name: string;
  /** Ochiq dunyo tavsifi */
  desc: string;
  /** Qulf sababi */
  lock: string;
  x: number;
  y: number;
  color: string;
}

export const MAP_NODES: readonly MapNode[] = [
  {
    world: 1,
    name: "OLOVLI ZINDON",
    desc: "Slime, skeletlar va Iblis",
    lock: "",
    x: 64,
    y: 138,
    color: "#ff9a3c",
  },
  {
    world: 2,
    name: "MUZ SARDOBASI",
    desc: "Muz moblari va Qor Malikasi",
    lock: "Avval 1-dunyoni yuting",
    x: 160,
    y: 84,
    color: "#9fd0ef",
  },
  {
    world: 3,
    name: "ZULMAT O'RMONI",
    desc: "O'rmon moblari va O'rmon Shohi",
    lock: "Avval 2-dunyoni yuting",
    x: 256,
    y: 138,
    color: "#a6f08e",
  },
];

/** Tugunni bosish maydoni (radius) */
const NODE_HIT = 22;

/** Xarita holati — chizishdan alohida, test qilinadi. */
export class MapState {
  sel: MapWorld = 1;
  open: Record<MapWorld, boolean> = { 1: true, 2: false, 3: false };
  best: Record<MapWorld, number> = { 1: 0, 2: 0, 3: 0 };
  wins: Record<MapWorld, Hero[]> = { 1: [], 2: [], 3: [] };
  /** Qulfli dunyoga kirishga urinilganda qisqa titrash va xabar */
  shake = 0;
  msg = "";
  msgTimer = 0;

  constructor(public playable: readonly MapWorld[] = PLAYABLE_WORLDS) {
    this.refresh();
    let saved = 1;
    try {
      saved = Number(localStorage.getItem(MAP_SEL_KEY)) || 1;
    } catch {
      /* saqlash imkonsiz */
    }
    const w = MAP_WORLDS.find((x) => x === saved) ?? 1;
    this.sel = this.canEnter(w) ? w : 1;
  }

  /** localStorage'dan qulflar, rekordlar va yutgan qahramonlarni qayta o'qiydi. */
  refresh() {
    this.wins = worldWins();
    for (const w of MAP_WORLDS) {
      this.open[w] = isWorldOpen(w);
      this.best[w] = worldBest(w);
    }
  }

  canEnter(w: MapWorld) {
    return this.open[w] && this.playable.includes(w);
  }

  /** A/D: chap-o'ngga (qulfli dunyoga ham borib ko'rish mumkin). */
  move(dir: -1 | 1) {
    const i = MAP_WORLDS.indexOf(this.sel) + dir;
    const w = MAP_WORLDS[Math.max(0, Math.min(MAP_WORLDS.length - 1, i))]!;
    this.sel = w;
  }

  /** Tanlangan dunyoga kirish; qulfli bo'lsa xabar chiqadi va null qaytadi. */
  enter(): MapWorld | null {
    const w = this.sel;
    if (this.canEnter(w)) {
      try {
        localStorage.setItem(MAP_SEL_KEY, String(w));
      } catch {
        /* saqlash imkonsiz */
      }
      return w;
    }
    this.shake = 0.3;
    this.msg = this.open[w] ? "TEZ KUNDA" : "QULFLANGAN";
    this.msgTimer = 1.4;
    return null;
  }

  /** Xona koordinatasidagi tugun (yo'q bo'lsa null). */
  nodeAt(x: number, y: number) {
    return MAP_NODES.find((n) => Math.hypot(n.x - x, n.y - y) < NODE_HIT) ?? null;
  }

  update(dt: number) {
    if (this.shake > 0) this.shake -= dt;
    if (this.msgTimer > 0) this.msgTimer -= dt;
  }
}

/** Xarita ekrani: o'z sikli va boshqaruvi bilan (klaviatura, sichqoncha, sensor). */
export class WorldMap {
  state: MapState;
  time = 0;
  /** Sensorli qurilma: pastdagi yozuv shunga qarab */
  touch = false;
  onEnter: ((w: MapWorld) => void) | null = null;
  onBack: (() => void) | null = null;
  private ctx: CanvasRenderingContext2D;
  private raf = 0;
  private last = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    public hero: Hero,
    playable: readonly MapWorld[] = PLAYABLE_WORLDS,
  ) {
    this.ctx = canvas.getContext("2d")!;
    this.state = new MapState(playable);
  }

  /**
   * Klaviatura: chap/o'ng yurish tugmalari (asl A/D) yoki strelkalar — tanlash, Enter yoki hujum
   * tugmasi (asl Space) — kirish, Esc yoki pauza tugmasi — orqaga. Tugmalar SOZLAMALAR dan.
   */
  private onKey = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT" || t.tagName === "SELECT")) return;
    if (e.repeat || gameKeysLocked()) return;
    const k = loadSettings().keys;
    const key = normKey(e.code);
    if (k.left.includes(key) || key === "ArrowLeft") this.state.move(-1);
    else if (k.right.includes(key) || key === "ArrowRight") this.state.move(1);
    else if (key === "Enter" || k.attack.includes(key)) this.enter();
    else if (key === "Escape" || k.pause.includes(key)) this.onBack?.();
    else return;
    e.preventDefault();
  };

  /** Sichqoncha va sensor: dunyoga bosish tanlaydi, tanlangan dunyoga yana bosish — kirish. */
  private onPointer = (e: PointerEvent) => {
    const { x, y } = this.toRoom(e);
    const n = this.state.nodeAt(x, y);
    if (!n) return;
    if (n.world === this.state.sel) this.enter();
    else this.state.sel = n.world;
  };

  enter() {
    const w = this.state.enter();
    if (w) this.onEnter?.(w);
  }

  move(dir: -1 | 1) {
    this.state.move(dir);
  }

  private toRoom(e: { clientX: number; clientY: number }) {
    const r = this.canvas.getBoundingClientRect();
    const bx = ((e.clientX - r.left) / r.width) * this.canvas.width;
    const by = ((e.clientY - r.top) / r.height) * this.canvas.height;
    const scale = Math.min(this.canvas.width / ROOM.w, this.canvas.height / ROOM.h);
    return {
      x: (bx - (this.canvas.width - ROOM.w * scale) / 2) / scale,
      y: (by - (this.canvas.height - ROOM.h * scale) / 2) / scale,
    };
  }

  start() {
    window.addEventListener("keydown", this.onKey);
    this.canvas.addEventListener("pointerdown", this.onPointer);
    this.last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.time += dt;
      this.state.update(dt);
      this.render();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener("keydown", this.onKey);
    this.canvas.removeEventListener("pointerdown", this.onPointer);
  }

  render() {
    const c = this.ctx;
    c.clearRect(0, 0, c.canvas.width, c.canvas.height);
    const scale = Math.min(c.canvas.width / ROOM.w, c.canvas.height / ROOM.h);
    c.save();
    c.translate((c.canvas.width - ROOM.w * scale) / 2, (c.canvas.height - ROOM.h * scale) / 2);
    c.scale(scale, scale);
    c.imageSmoothingEnabled = false;
    renderMap(c, this.state, this.time, this.hero, this.touch);
    c.restore();
  }
}

// ---------------- chizish ----------------

/** Butun piksel qatorlardan iborat ellips (silliqlashsiz). */
function blob(
  c: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color: string,
) {
  for (let y = -ry; y <= ry; y++) {
    const w = Math.round(rx * Math.sqrt(1 - (y / ry) ** 2));
    px(c, color, cx - w, cy + y, w * 2, 1);
  }
}

function text(
  c: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  size: number,
  color: string,
  align: CanvasTextAlign = "center",
) {
  c.font = `${size}px "Press Start 2P", monospace`;
  c.textAlign = align;
  c.fillStyle = "#000";
  c.fillText(s, x + 1, y + 1);
  c.fillStyle = color;
  c.fillText(s, x, y);
}

/** Yo'l: ikki tugun orasidagi egri chiziq bo'ylab nuqtalar. */
function path(c: CanvasRenderingContext2D, a: MapNode, b: MapNode, bend: number, lit: boolean) {
  const mx = (a.x + b.x) / 2,
    my = (a.y + b.y) / 2 + bend;
  const steps = 22;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = (1 - t) ** 2 * a.x + 2 * (1 - t) * t * mx + t * t * b.x;
    const y = (1 - t) ** 2 * a.y + 2 * (1 - t) * t * my + t * t * b.y;
    px(c, "#1a1018", x - 1, y, 3, 2);
    px(c, lit ? "#e8c37a" : "#5a4a3a", x - 1, y - 1, 3, 2);
  }
}

/** Qulf ikonkasi */
function padlock(c: CanvasRenderingContext2D, x: number, y: number) {
  px(c, "#141018", x - 4, y - 7, 9, 13);
  px(c, "#9a9ea8", x - 3, y - 6, 7, 5);
  px(c, "#141018", x - 1, y - 4, 3, 3);
  px(c, "#141018", x - 5, y - 1, 11, 8);
  px(c, "#ffcc33", x - 4, y, 9, 6);
  px(c, "#a8741a", x - 4, y + 5, 9, 1);
  px(c, "#141018", x, y + 1, 1, 3);
}

/** 1-dunyo: tosh darvoza, ikki mash'ala */
function dungeon(c: CanvasRenderingContext2D, x: number, y: number, t: number) {
  px(c, "#1b1426", x - 14, y - 16, 28, 20);
  px(c, "#5c4a6e", x - 13, y - 15, 26, 18);
  for (let r = 0; r < 4; r++) px(c, "#6e5a82", x - 13 + (r % 2) * 5, y - 14 + r * 4, 10, 2);
  px(c, "#4a3b59", x - 13, y - 18, 4, 3);
  px(c, "#4a3b59", x - 5, y - 18, 4, 3);
  px(c, "#4a3b59", x + 3, y - 18, 4, 3);
  px(c, "#4a3b59", x + 10, y - 18, 3, 3);
  // eshik
  px(c, "#120a10", x - 5, y - 8, 10, 11);
  px(c, "#120a10", x - 4, y - 10, 8, 2);
  px(c, "#3a1010", x - 3, y - 4, 6, 7);
  for (const tx of [x - 10, x + 9]) {
    const fl = Math.sin(t * 9 + tx) > 0 ? 0 : 1;
    px(c, "#2a1f38", tx - 1, y - 7, 2, 4);
    px(c, "#ff9a3c", tx - 1, y - 11 + fl, 3, 4);
    px(c, "#ffe14d", tx, y - 10 + fl, 1, 2);
  }
}

/** 2-dunyo: muz qasr */
function iceCastle(c: CanvasRenderingContext2D, x: number, y: number, t: number) {
  const tower = (tx: number, h: number) => {
    px(c, "#2a3b52", tx - 4, y - h, 9, h + 2);
    px(c, "#a9cdee", tx - 3, y - h + 1, 7, h);
    px(c, "#eef7ff", tx - 3, y - h + 1, 2, h);
    // uchli tom
    for (let k = 0; k < 6; k++)
      px(c, k > 3 ? "#7fe9ff" : "#4a6fa5", tx - 4 + k * 0.7, y - h - k, 9 - k * 1.4, 1);
  };
  tower(x - 10, 16);
  tower(x + 10, 16);
  tower(x, 24);
  px(c, "#141e2c", x - 3, y - 8, 6, 9);
  // qor
  px(c, "#ffffff", x - 15, y + 1, 30, 2);
  const gl = Math.sin(t * 3) > 0.7;
  px(c, gl ? "#ffffff" : "#7fe9ff", x - 1, y - 18, 2, 2);
}

/** 3-dunyo: to'q daraxtlar va svetlyachoklar */
function forest(c: CanvasRenderingContext2D, x: number, y: number, t: number) {
  const tree = (tx: number, ty: number, h: number) => {
    px(c, "#2a1a10", tx - 1, ty - 4, 3, 6);
    for (let k = 0; k < h; k++) {
      const w = Math.round((k / h) * 8) + 1;
      px(c, k % 3 === 0 ? "#0d1f12" : "#1f3d22", tx - w, ty - 4 - h + k, w * 2 + 1, 1);
    }
  };
  tree(x - 11, y + 1, 14);
  tree(x + 11, y + 1, 14);
  tree(x, y - 1, 20);
  // ikki sariq ko'z — o'rmon ichida kimdir bor
  if (Math.sin(t * 0.9) > -0.6) {
    px(c, "#ffe14d", x - 3, y - 4, 1, 1);
    px(c, "#ffe14d", x + 2, y - 4, 1, 1);
  }
  for (let i = 0; i < 5; i++) {
    const a = t * (0.8 + i * 0.13) + i * 2.1;
    const on = Math.sin(t * 3 + i * 1.7) > -0.2;
    if (on)
      px(
        c,
        i % 2 ? "#d8ff7a" : "#a6f08e",
        x + Math.cos(a) * (12 + i),
        y - 12 + Math.sin(a * 1.3) * 7,
        1,
        1,
      );
  }
}

/** Qahramon belgisi (7x7): ritsar dubulg'asi, sehrgar qalpog'i, ovchi kapyushoni, mergan shlyapasi. */
export function heroBadge(
  c: CanvasRenderingContext2D,
  hero: Hero,
  x: number,
  y: number,
  on: boolean,
) {
  const [main, dark, hi] = !on
    ? ["#3b3346", "#241d2e", "#3b3346"]
    : hero === "knight"
      ? ["#68cde4", "#183b62", "#c5e4ec"]
      : hero === "mage"
        ? ["#a3192a", "#2b1c2e", "#d9d4e0"]
        : hero === "gunner"
          ? ["#d9a441", "#8a5a2a", "#ffe2a0"]
          : hero === "paladin"
            ? ["#f2c14e", "#7a5a12", "#fff2b0"]
            : ["#4f8a3a", "#1f4a24", "#c9a26b"];
  px(c, "#000", x - 1, y - 1, 9, 9);
  if (hero === "knight") {
    px(c, main, x + 1, y, 5, 7);
    px(c, main, x, y + 2, 7, 4);
    px(c, dark, x + 1, y + 3, 5, 1);
    px(c, hi, x + 3, y, 1, 2);
  } else if (hero === "gunner") {
    // keng qirrali shlyapa, mis tasma
    px(c, main, x, y + 4, 7, 2);
    px(c, main, x + 1, y + 1, 5, 3);
    px(c, dark, x + 1, y + 3, 5, 1);
    px(c, hi, x + 3, y + 3, 1, 1);
    px(c, dark, x + 3, y + 1, 1, 1);
  } else if (hero === "paladin") {
    // yopiq dubulg'a: ko'z tirqishi va oltin toj-chiziq
    px(c, main, x + 1, y, 5, 7);
    px(c, main, x, y + 1, 7, 5);
    px(c, dark, x + 1, y + 3, 5, 1);
    px(c, hi, x + 3, y, 1, 7);
  } else if (hero === "mage") {
    px(c, dark, x, y + 5, 7, 2);
    px(c, dark, x + 1, y + 3, 5, 2);
    px(c, dark, x + 2, y + 1, 3, 2);
    px(c, dark, x + 3, y, 2, 1);
    px(c, main, x + 1, y + 4, 5, 1);
    px(c, hi, x + 3, y + 2, 1, 1);
  } else {
    px(c, main, x + 1, y, 5, 7);
    px(c, main, x, y + 3, 7, 4);
    px(c, dark, x + 2, y + 3, 3, 3);
    px(c, hi, x + 2, y + 4, 1, 1);
    px(c, hi, x + 4, y + 4, 1, 1);
  }
}

let background: HTMLCanvasElement | null = null;

/** Xarita foni: tun osmoni va uchta o'lka (lava, muz, o'rmon). */
function mapBackground() {
  if (background) return background;
  const cv = document.createElement("canvas");
  cv.width = ROOM.w;
  cv.height = ROOM.h;
  const c = cv.getContext("2d")!;
  px(c, "#0d0a18", 0, 0, ROOM.w, ROOM.h);
  blob(c, 160, 150, 158, 72, "#1d1a28");
  blob(c, 64, 150, 62, 46, "#3a2830");
  blob(c, 64, 154, 50, 34, "#4a2c36");
  blob(c, 160, 96, 60, 38, "#465b73");
  blob(c, 160, 100, 48, 28, "#7a93ad");
  blob(c, 256, 150, 62, 46, "#0f1d12");
  blob(c, 256, 154, 50, 34, "#16261a");
  // lava yoriqlari, qor parchalari va o'rmon ildizlari
  for (let i = 0; i < 8; i++) {
    px(c, "#b23238", 30 + i * 9, 170 + ((i * 7) % 11), 4, 1);
    px(c, "#eef7ff", 124 + i * 9, 112 + ((i * 5) % 9), 2, 1);
    px(c, "#2a1a10", 222 + i * 9, 172 + ((i * 5) % 10), 5, 1);
  }
  background = cv;
  return cv;
}

/** Xaritani 320x240 xona koordinatalarida chizadi. */
/** Xarita ko'rsatmasi (kompyuter): qayta belgilangan tugmalar bilan. */
export function mapKeysHint(k: KeyBinds) {
  const pause = actionKey(k, "pause");
  return `${actionKey(k, "left")}/${actionKey(k, "right")} — tanlash · Enter — kirish · ${pause === "Esc" ? "Esc" : `Esc/${pause}`} — orqaga`;
}

export function renderMap(
  c: CanvasRenderingContext2D,
  s: MapState,
  t: number,
  hero: Hero,
  touch = false,
) {
  // osmon va yer (bir marta chiziladi — masshtabda qatorlar orasida chiziq qolmaydi)
  c.drawImage(mapBackground(), 0, 0);
  for (let i = 0; i < 40; i++) {
    const sx = (i * 73) % ROOM.w,
      sy = (i * 37) % 54;
    if (Math.sin(t * 2 + i) > -0.3) px(c, i % 5 ? "#5a5470" : "#e0d6ee", sx, sy, 1, 1);
  }

  const [n1, n2, n3] = MAP_NODES as [MapNode, MapNode, MapNode];
  path(c, n1, n2, -6, s.open[2]);
  path(c, n2, n3, -6, s.open[3]);

  text(c, "SARGUZASHT XARITASI", ROOM.w / 2, 18, 9, "#ffcc33");

  for (const n of MAP_NODES) {
    const open = s.open[n.world];
    const sel = n.world === s.sel;
    const shake = sel && s.shake > 0 ? (Math.floor(s.shake * 40) % 2 ? 2 : -2) : 0;
    const x = n.x + shake,
      y = n.y;
    if (sel) {
      // tanlangan dunyo atrofida yorug'lik
      c.fillStyle = `rgba(255,204,51,${0.12 + 0.06 * Math.sin(t * 4)})`;
      c.beginPath();
      c.ellipse(x, y - 4, 26, 18, 0, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = open ? 1 : 0.4;
    if (n.world === 1) dungeon(c, x, y, t);
    else if (n.world === 2) iceCastle(c, x, y, t);
    else forest(c, x, y, t);
    c.globalAlpha = 1;
    if (!open) padlock(c, x, y - 6);

    // nom, rekord va yutgan qahramonlar
    text(c, `${n.world}`, x - 18, y - 20, 6, open ? n.color : "#6a6078");
    text(c, n.name, x, y + 14, 5, open ? n.color : "#6a6078");
    if (open) text(c, `REKORD ${s.best[n.world]}`, x, y + 23, 5, "#e0d6ee");
    HEROES.forEach((h, i) =>
      heroBadge(
        c,
        h,
        x - (HEROES.length * 10) / 2 + i * 10 + 1,
        y + 28,
        s.wins[n.world].includes(h),
      ),
    );

    if (sel) {
      // qahramon dunyo yonida turadi, ustida miltillovchi strelka
      const frame = Math.floor(t * 2) % 2;
      renderSprite(c, hero, "idle", frame, x + 22, y - 9, false, true);
      const by = y - 34 + Math.round(Math.sin(t * 5) * 2);
      px(c, "#ffcc33", x - 3, by, 7, 2);
      px(c, "#ffcc33", x - 2, by + 2, 5, 1);
      px(c, "#ffcc33", x - 1, by + 3, 3, 1);
      px(c, "#ffcc33", x, by + 4, 1, 1);
    }
  }

  // pastki panel: tanlangan dunyo
  const n = MAP_NODES.find((m) => m.world === s.sel)!;
  px(c, "rgba(8,4,16,0.78)", 0, 196, ROOM.w, 44);
  text(c, `${n.world}-DUNYO: ${n.name}`, ROOM.w / 2, 210, 7, s.open[n.world] ? n.color : "#8a8098");
  const status = !s.open[n.world] ? `QULF: ${n.lock}` : s.canEnter(n.world) ? n.desc : "Tez kunda";
  text(c, status, ROOM.w / 2, 222, 5, s.open[n.world] ? "#e0d6ee" : "#ff9a9a");
  text(
    c,
    touch ? "Dunyoga bosing · yana bosing — kirish" : mapKeysHint(currentSettings().keys),
    ROOM.w / 2,
    234,
    5,
    "#b8a8cc",
  );
  if (s.msgTimer > 0) {
    c.globalAlpha = Math.min(1, s.msgTimer * 3);
    px(c, "rgba(0,0,0,0.7)", 0, 40, ROOM.w, 18);
    text(c, s.msg, ROOM.w / 2, 53, 8, "#ff6a6a");
    c.globalAlpha = 1;
  }
}
