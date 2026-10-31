/**
 * Ochiq olamni chizish: kamera, ekrandan tashqarini chizmaslik (culling), tun yorug'ligi,
 * HUD, mini-xarita, tuman va oynalar. Mantiqqa ta'sir qilmaydi — faqat RealmSim holatini o'qiydi.
 */
import { renderSprite, spriteFootOffset, type SpriteKind } from "@/game/sprites";
import type { Effects } from "@/game/effects";
import { HERO_ROLE, HERO_THEME, hudBarColors, type Hero } from "@/game/hero";
import { drawRoleIcon } from "@/game/roles";
import { VOW_TIME } from "@/game/player";
import {
  renderCrack,
  renderDazeStars,
  renderQuake,
  renderShockwave,
  renderSkyColumn,
  renderVowAura,
  renderWindupSparks,
  type Crack,
  type Quake,
} from "@/game/paladinFx";
import { actionKey, moveLabel, type KeyBinds } from "@/game/keys";
import { touchLabels } from "@/game/touchLayout";
import { PHRASES, ROOM_CAP } from "./net/protocol";
import type { RealmPlayer, RealmSim } from "./sim";
import { SMOKE_R, SMOKE_TIME, tileCenter } from "./sim";
import { CHUNK, CHUNK_PX, LAVA, SOLID, TILE, TILE_BY_ID, TILE_IDS, WATER } from "./tiles";
import { TILE_COLOR, drawTile } from "./tileArt";
import { drawItemIcon, RARITY_COLOR, RARITY_NAME } from "./icons";
import { MOB_STATS, RING_MAX, RING_W, WARDEN_SHIELD_ARC, type Mark, type RealmMob } from "./mobs";
import { KING_ENRAGE, KING_RESPAWN, PHASE_TEXT, TITLE_TEXT } from "./raid";
import type { GameObjectDef, RealmArea } from "./schema";

export const VIEW_W = 320;
export const VIEW_H = 240;
const FONT = '"Press Start 2P", monospace';

export type Panel = "none" | "journal" | "map" | "pause" | "intro" | "invite";

export interface UiButton {
  x: number;
  y: number;
  w: number;
  h: number;
  act: () => void;
}

export interface Toast {
  text: string;
  color: string;
  t: number;
}

/** Onlayn holat (HUD belgisi) */
export interface NetView {
  mode: "online" | "offline" | "connecting";
  /** xonadagi o'yinchilar */
  n: number;
  /** ms */
  ping: number;
  code: string | null;
}

export interface RealmView {
  sim: RealmSim;
  me: RealmPlayer;
  net: NetView;
  /** boshqa o'yinchilar ismi (id -> "Mehmon-1234") */
  names: Map<string, string>;
  /** chat pufakchalari (id -> ibora, qolgan vaqt) */
  bubbles: Map<string, { text: string; t: number }>;
  /** tayyor iboralar ro'yxati ochiq */
  chatOpen: boolean;
  /** do'st chaqirish havolasi (onlayn bo'lsa) */
  link: string | null;
  /** ulashish: Telegram oynasi yoki telefonning ulashish oynasi */
  share: "telegram" | "share" | null;
  /** server sozlangan (qayta ulanish mumkin) */
  canConnect: boolean;
  alpha: number;
  time: number;
  fx: Effects;
  touch: boolean;
  /** Olamda ishlaydigan (qayta belgilangan) tugmalar — ko'rsatmalar uchun */
  keys: KeyBinds;
  panel: Panel;
  /** dialog/do'kon tanlovi */
  sel: number;
  hover: { x: number; y: number } | null;
  /** Paladin SHANG yoriqlari va zarb to'lqinlari (faqat chizish, klient voqealardan to'ldiradi) */
  cracks: Crack[];
  quakes: Quake[];
  /** reyd boss kirish sahnasi (nom kartochkasi): qolgan ulush 0..1 */
  intro: number;
  /** o'z qahramoni halok bo'lgan vaqt (reydda qayta tug'ilish hisobi) */
  deadAt: number;
  toasts: Toast[];
  banner: { text: string; sub: string; t: number; color: string };
  shake: number;
  /** renderer har kadrda to'ldiradi (sichqoncha/sensor bosishlari uchun) */
  buttons: UiButton[];
  act: {
    choose(i: number): void;
    buy(item: string): void;
    sell(slot: number): void;
    use(slot: number): void;
    close(): void;
    panel(p: Panel): void;
    exit(): void;
    /** Pauzadagi SOZLAMALAR */
    settings(): void;
    /** DO'STNI CHAQIRISH oynasi, havolani nusxalash va ulashish */
    invite(): void;
    copy(): void;
    share(): void;
    /** tayyor iboralar: ro'yxatni ochish va ibora yuborish */
    chat(): void;
    say(i: number): void;
    reconnect(): void;
  };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Mavjudot orqasida qolsa uni yopadigan baland plitkalar (devor, ustun, daraxt, tosh) */
const TALL: boolean[] = SOLID.map((solid, id) => solid && !WATER[id] && id !== TILE_IDS.fence);

/** Darvozalar nuri: har biri o'z dunyosining rangida */
const GATE_COLOR = {
  devil: { dark: "#3a0a10", mid: "#c1121f", light: "#ff9a3c" },
  queen: { dark: "#0e2a40", mid: "#45b8e0", light: "#c4f3ff" },
  king: { dark: "#10260e", mid: "#4a8a3a", light: "#a6f08e" },
} as const;

function px(c: CanvasRenderingContext2D, color: string, x: number, y: number, w = 1, h = 1) {
  c.fillStyle = color;
  c.fillRect(Math.round(x), Math.round(y), w, h);
}

export function text(
  c: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  size: number,
  color: string,
  align: CanvasTextAlign = "left",
) {
  c.font = `${size}px ${FONT}`;
  c.textAlign = align;
  c.fillStyle = "#000";
  c.fillText(s, Math.round(x) + 1, Math.round(y) + 1);
  c.fillStyle = color;
  c.fillText(s, Math.round(x), Math.round(y));
}

/** So'zlar bo'yicha qatorlarga bo'lish (piksel shrift: belgi kengligi = o'lcham). */
export function wrap(s: string, max: number) {
  const out: string[] = [];
  let line = "";
  for (const w of s.split(" ")) {
    if (line && (line + " " + w).length > max) {
      out.push(line);
      line = w;
    } else line = line ? `${line} ${w}` : w;
  }
  if (line) out.push(line);
  return out;
}

function heart(c: CanvasRenderingContext2D, x: number, y: number, color: string) {
  px(c, "#000", x, y + 1, 9, 5);
  px(c, "#000", x + 1, y, 3, 8);
  px(c, "#000", x + 5, y, 3, 8);
  px(c, "#000", x + 2, y + 6, 5, 2);
  px(c, color, x + 1, y + 1, 3, 4);
  px(c, color, x + 5, y + 1, 3, 4);
  px(c, color, x + 2, y + 4, 5, 2);
  px(c, color, x + 3, y + 6, 3, 1);
}

function coin(c: CanvasRenderingContext2D, x: number, y: number) {
  px(c, "#a8741a", x + 1, y, 4, 6);
  px(c, "#a8741a", x, y + 1, 6, 4);
  px(c, "#ffcc33", x + 1, y + 1, 4, 4);
  px(c, "#fff2a8", x + 1, y + 1, 1, 2);
}

function panel(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  border = "#5c4a6e",
) {
  px(c, "#000", x - 1, y - 1, w + 2, h + 2);
  px(c, border, x, y, w, h);
  px(c, "#1f1730", x + 2, y + 2, w - 4, h - 4);
}

/** Kul tog'i havosi: yog'ayotgan kul va ko'tarilayotgan cho'g' (ekran koordinatasida, faqat bezak) */
interface Flake {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ember: boolean;
}

export class RealmRenderer {
  private chunks = new Map<number, HTMLCanvasElement>();
  private chunkVer = -1;
  private light: HTMLCanvasElement | null = null;
  private mapCanvas: HTMLCanvasElement | null = null;
  private mapT = -1;
  /** joriy kadrdagi hudud (kamera, xarita va havo shunga qarab) */
  private area: RealmArea | undefined;
  private flakes: Flake[] = [];
  private lastT = 0;

  private chunk(sim: RealmSim, cx: number, cy: number) {
    if (sim.mapVersion !== this.chunkVer) {
      this.chunks.clear();
      this.chunkVer = sim.mapVersion;
    }
    const key = cy * 1024 + cx;
    let cv = this.chunks.get(key);
    if (cv) {
      // LRU: oxirgi ishlatilgan oxirida
      this.chunks.delete(key);
      this.chunks.set(key, cv);
      return cv;
    }
    cv = document.createElement("canvas");
    cv.width = cv.height = CHUNK_PX;
    const c = cv.getContext("2d")!;
    for (let ty = 0; ty < CHUNK; ty++)
      for (let tx = 0; tx < CHUNK; tx++) {
        const gx = cx * CHUNK + tx,
          gy = cy * CHUNK + ty;
        drawTile(c, sim.tileAt(gx, gy), tx * TILE, ty * TILE, gx, gy, (dx, dy) =>
          sim.tileAt(gx + dx, gy + dy),
        );
      }
    this.chunks.set(key, cv);
    while (this.chunks.size > 16) this.chunks.delete(this.chunks.keys().next().value!);
    return cv;
  }

  /** O'rganilgan joylar xaritasi (1 piksel = 1 plitka), tuman — qora. */
  private exploredMap(v: RealmView) {
    const { sim, me } = v;
    if (!this.mapCanvas) {
      this.mapCanvas = document.createElement("canvas");
      this.mapCanvas.width = sim.map.w;
      this.mapCanvas.height = sim.map.h;
    }
    if (v.time - this.mapT < 0.5) return this.mapCanvas;
    this.mapT = v.time;
    const c = this.mapCanvas.getContext("2d")!;
    const img = c.createImageData(sim.map.w, sim.map.h);
    const rgb = new Map<number, [number, number, number]>();
    for (let ty = 0; ty < sim.map.h; ty++)
      for (let tx = 0; tx < sim.map.w; tx++) {
        const i = (ty * sim.map.w + tx) * 4;
        img.data[i + 3] = 255;
        if (!sim.isExplored(me, tx, ty)) continue;
        const t = sim.tileAt(tx, ty);
        let col = rgb.get(t);
        if (!col) {
          const hex = TILE_COLOR[TILE_BY_ID[t] ?? "grass"];
          col = [1, 3, 5].map((o) => parseInt(hex.slice(o, o + 2), 16)) as [number, number, number];
          rgb.set(t, col);
        }
        img.data[i] = col[0];
        img.data[i + 1] = col[1];
        img.data[i + 2] = col[2];
      }
    c.putImageData(img, 0, 0);
    return this.mapCanvas;
  }

  render(c: CanvasRenderingContext2D, v: RealmView) {
    v.buttons = [];
    const { sim, me } = v;
    const scale = Math.min(c.canvas.width / VIEW_W, c.canvas.height / VIEW_H);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.imageSmoothingEnabled = false;
    c.fillStyle = "#0a0712";
    c.fillRect(0, 0, c.canvas.width, c.canvas.height);
    c.translate((c.canvas.width - VIEW_W * scale) / 2, (c.canvas.height - VIEW_H * scale) / 2);
    c.scale(scale, scale);
    c.save();
    c.beginPath();
    c.rect(0, 0, VIEW_W, VIEW_H);
    c.clip();

    const ix = lerp(me.px, me.p.x, v.alpha),
      iy = lerp(me.py, me.p.y, v.alpha);
    // kamera joriy hudud ichida qoladi: qo'shni hudud (vodiy/Kul tog'i) ko'rinib qolmaydi
    const area = (this.area = sim.areaAt(me.p.x, me.p.y));
    const ax = (area?.x ?? 0) * TILE,
      ay = (area?.y ?? 0) * TILE;
    const maxX = ax + (area?.w ?? sim.map.w) * TILE - VIEW_W,
      maxY = ay + (area?.h ?? sim.map.h) * TILE - VIEW_H;
    let camX = Math.round(Math.max(ax, Math.min(maxX, ix - VIEW_W / 2)));
    let camY = Math.round(Math.max(ay, Math.min(maxY, iy - VIEW_H / 2)));
    if (v.shake > 0) {
      const s = Math.min(1, v.shake * 6) * 3;
      camX += Math.round((Math.random() - 0.5) * s);
      camY += Math.round((Math.random() - 0.5) * s);
    }

    c.save();
    c.translate(-camX, -camY);
    this.world(c, v, camX, camY, ix, iy);
    c.restore();
    if (area?.id === "ashmount") {
      this.heatHaze(c, v, camX, camY, scale);
      this.ashFall(c, v);
    } else this.flakes = [];
    this.lastT = v.time;
    this.night(c, v, camX, camY, ix, iy);
    c.save();
    c.translate(-camX, -camY);
    v.fx.renderTexts((s, x, y, color, a) => {
      c.globalAlpha = a;
      text(c, s, x, y, 6, color, "center");
      c.globalAlpha = 1;
    });
    this.prompt(c, v);
    c.restore();
    this.hud(c, v);
    this.overlays(c, v);
    c.restore();
  }

  // ---------------- dunyo ----------------

  private world(
    c: CanvasRenderingContext2D,
    v: RealmView,
    camX: number,
    camY: number,
    ix: number,
    iy: number,
  ) {
    const { sim, me } = v;
    // faqat ko'rinadigan chunk'lar
    const cx0 = Math.floor(camX / CHUNK_PX),
      cx1 = Math.floor((camX + VIEW_W - 1) / CHUNK_PX);
    const cy0 = Math.floor(camY / CHUNK_PX),
      cy1 = Math.floor((camY + VIEW_H - 1) / CHUNK_PX);
    for (let cy = cy0; cy <= cy1; cy++)
      for (let cx = cx0; cx <= cx1; cx++)
        c.drawImage(this.chunk(sim, cx, cy), cx * CHUNK_PX, cy * CHUNK_PX);

    const tx0 = Math.floor(camX / TILE),
      ty0 = Math.floor(camY / TILE);
    const tx1 = tx0 + VIEW_W / TILE + 1,
      ty1 = ty0 + VIEW_H / TILE + 1;
    // suv yaltirashi (jonli)
    for (let ty = ty0; ty <= ty1; ty++)
      for (let tx = tx0; tx <= tx1; tx++) {
        const t = sim.tileAt(tx, ty);
        if (t !== TILE_IDS.water && t !== TILE_IDS.pool) continue;
        const ph = Math.floor(v.time * 2 + tx * 0.7 + ty * 1.3) % 4;
        px(c, "#4a8ac0", tx * TILE + ((ph * 4 + ty * 3) % 12), ty * TILE + 4 + ph * 2, 4, 1);
      }
    // lava oqimi: siljiyotgan yorqin chiziqlar va pufakchalar (jonli)
    for (let ty = ty0; ty <= ty1; ty++)
      for (let tx = tx0; tx <= tx1; tx++) {
        if (!LAVA[sim.tileAt(tx, ty)]) continue;
        const k = Math.floor(v.time * 3 + tx * 0.9 + ty * 1.7) % 6;
        px(c, "#ffb02e", tx * TILE + ((k * 5 + ty * 3) % 12), ty * TILE + 2 + (k % 3) * 5, 4, 1);
        const b = (v.time * 0.7 + ((tx * 13 + ty * 7) % 10) / 10) % 1;
        if (b < 0.25) {
          const bx = tx * TILE + ((tx * 7 + ty * 3) % 11) + 2,
            by = ty * TILE + ((tx * 5 + ty) % 9) + 3;
          px(c, b < 0.18 ? "#ffd36a" : "#8a1e10", bx, by, 2, 2);
        }
      }
    // yashirin sandiq ustida vaqti-vaqti bilan pufakchalar (yagona ishora)
    for (const s of sim.region.secrets) {
      if (s.type !== "riverchest") continue;
      const o = sim.object(s.chest);
      if (!o || me.opened.includes(o.id)) continue;
      const x = tileCenter(o.x),
        y = tileCenter(o.y);
      if (!inView(x, y, camX, camY)) continue;
      const k = (v.time % 3.2) / 3.2;
      // lava ostidagi sandiq — olovli pufakchalar
      const bub = LAVA[sim.tileAt(o.x, o.y)] ? "#ffd36a" : "#9fd0ef";
      if (k < 0.35) {
        px(c, bub, x - 2 + Math.sin(v.time * 9) * 2, y - k * 20, 2, 2);
        px(c, bub, x + 3, y + 2 - k * 14, 1, 1);
      }
    }

    // yerdagi hujum ogohlantirishlari (sim'dagi windup vaqtiga bog'langan)
    for (const k of sim.marks) {
      if (!inView(k.x, k.y, camX, camY, 160)) continue;
      drawMark(c, k, v.time);
    }
    // Paladin: SHANG yoriqlari va zarb to'lqinlari (oq yadro, oltin chekka)
    for (const k of v.cracks) if (inView(k.x, k.y, camX, camY, 80)) renderCrack(c, k);
    for (const q of v.quakes) if (inView(q.x, q.y, camX, camY, 80)) renderQuake(c, q);
    // reyd zali: yarmi lavaga to'lmoqda (ogohlantirish — miltillovchi yoriqlar) yoki to'lgan
    const raid = sim.raid;
    if (raid && raid.lava >= 0) {
      const mid = (raid.x0 + raid.x1) / 2;
      const x0 = raid.lava === 0 ? raid.x0 : mid,
        x1 = raid.lava === 0 ? mid : raid.x1;
      if (raid.lavaWarn) {
        const blink = Math.floor(v.time * 6) % 2 === 0;
        c.globalAlpha = blink ? 0.32 : 0.18;
        px(c, "#ff3b1a", x0, raid.y0, x1 - x0, raid.y1 - raid.y0);
        c.globalAlpha = 1;
        for (let x = x0 + 8; x < x1; x += 24)
          for (let y = raid.y0 + 8; y < raid.y1; y += 20) {
            px(c, "#2a0a04", x, y, 6, 1);
            px(c, blink ? "#ffd36a" : "#ff5a1a", x + 1, y, 3, 1);
          }
        px(c, "#ffd36a", mid - 1, raid.y0, 2, raid.y1 - raid.y0);
      } else {
        px(c, "#d8451a", x0, raid.y0, x1 - x0, raid.y1 - raid.y0);
        for (let y = raid.y0; y < raid.y1; y += 6)
          for (let x = x0 + ((y / 6) % 2) * 6; x < x1; x += 12) {
            const k = Math.floor(v.time * 3 + x * 0.07 + y * 0.11) % 5;
            px(c, k < 2 ? "#ffb02e" : "#8a1e10", x + k, y + 2, 5, 1);
            if (k === 0) px(c, "#ffd36a", x + 3, y, 2, 2);
          }
        px(c, "#2a0a04", raid.lava === 0 ? mid - 1 : mid, raid.y0, 2, raid.y1 - raid.y0);
      }
    }
    // tuzoqlar
    for (const t of sim.traps) {
      px(c, "#5a3e24", t.x - 5, t.y - 1, 10, 2);
      px(c, "#9a9ea8", t.x - 5, t.y - 3, 10, 1);
      px(c, "#9a9ea8", t.x - 5, t.y + 2, 10, 1);
    }

    const all: { y: number; r: () => void }[] = [];
    // obyektlar
    for (const o of sim.region.objects) {
      const x = tileCenter(o.x),
        y = tileCenter(o.y);
      if (!inView(x, y, camX, camY) || !sim.visible(me, o)) continue;
      all.push({ y: y + (o.type === "gate" ? 14 : 4), r: () => this.object(c, v, o, x, y) });
    }
    // NPC'lar
    for (const n of sim.region.npcs) {
      const x = tileCenter(n.x),
        y = tileCenter(n.y);
      if (!inView(x, y, camX, camY)) continue;
      const frame = Math.floor(v.time * 2 + n.x) % 2;
      const flip = me.p.x < x;
      all.push({
        y: y + 8,
        r: () => {
          shadow(c, x, y + 12, 12);
          renderSprite(c, n.sprite as SpriteKind, "idle", frame, x, y, false, flip);
        },
      });
    }
    // yerdagi buyumlar va oltin
    for (const it of sim.items) {
      if (!inView(it.x, it.y, camX, camY)) continue;
      if (it.t > 110 && Math.floor(v.time * 8) % 2) continue;
      const bob = Math.round(Math.sin(v.time * 4 + it.id) * 1.5);
      all.push({
        y: it.y + 4,
        r: () => {
          shadow(c, it.x, it.y + 6, 8);
          if (it.item === null) coin(c, it.x - 3, it.y - 3 + bob);
          else {
            const def = sim.data.items[it.item];
            if (!def) return;
            const col = RARITY_COLOR[def.rarity];
            if (def.rarity === "legendary") legendaryRays(c, it.x, it.y + bob, v.time + it.id);
            c.globalAlpha = 0.35 + 0.2 * Math.sin(v.time * 5 + it.id);
            px(c, col, it.x - 7, it.y - 7 + bob, 14, 14);
            c.globalAlpha = 1;
            drawItemIcon(c, def.icon, it.x - 6, it.y - 6 + bob);
          }
        },
      });
    }
    // devor va ustunlar oldidagi mavjudotlarni yopadi: plitka pastki cheti oyoqdan pastda bo'lsa,
    // plitka mavjudotdan keyin chiziladi (katta Sardor ustun ichiga kirgandek ko'rinmaydi)
    const occluders = new Set<number>();
    const occlude = (x: number, top: number, w: number, foot: number) => {
      const ty1 = Math.floor((foot + 8) / TILE);
      for (let ty = Math.floor(top / TILE); ty <= ty1; ty++)
        for (let tx = Math.floor((x - w / 2) / TILE); tx <= Math.floor((x + w / 2) / TILE); tx++)
          if (TALL[sim.tileAt(tx, ty)] && (ty + 1) * TILE > foot)
            occluders.add(ty * sim.map.w + tx);
    };
    // moblar (tartib — oyoq bo'yicha)
    for (const m of sim.mobs) {
      const x = lerp(m.px, m.x, v.alpha),
        y = lerp(m.py, m.y, v.alpha);
      if (!inView(x, y, camX, camY, 48)) continue;
      const foot = y + m.size / 2;
      if (m.kind === "warden") occlude(x, y - 48, 56, foot);
      else if (m.kind === "ashking") occlude(x, y - 80, 90, foot);
      else if (m.kind === "sentinel" || m.kind === "obsguard") occlude(x, y - 16, 26, foot);
      all.push({ y: foot, r: () => this.mob(c, v, m, x, y) });
    }
    // o'yinchilar (silliq: oldingi va joriy tick orasida)
    const labels: (() => void)[] = [];
    for (const rp of sim.players.values()) {
      const p = rp.p;
      const x = rp === me ? ix : lerp(rp.px, p.x, v.alpha),
        y = rp === me ? iy : lerp(rp.py, p.y, v.alpha);
      if (!inView(x, y, camX, camY, 48)) continue;
      all.push({
        y: y + p.size / 2,
        r: () => {
          if (!p.dead && !(p.dashing && p.mage)) shadow(c, x, y + 12, 12);
          c.save();
          c.translate(Math.round(x - p.x), Math.round(y - p.y));
          // Paladin QASAMi: oltin aura (boshqalar ham ko'radi — tank bossni ushlab turibdi)
          if (p.paladin && p.vowing && !p.dead) renderVowAura(c, p, v.time);
          p.render(c);
          c.restore();
        },
      });
      // boshqa o'yinchi: ismi va jon chizig'i; har kimning chat iborasi (hamma narsa ustida)
      const name = rp === me ? null : v.names.get(rp.id);
      const bubble = v.bubbles.get(rp.id);
      if (name || bubble) labels.push(() => playerLabel(c, rp, x, y, name ?? null, bubble?.text));
    }
    for (const i of occluders) {
      const tx = i % sim.map.w,
        ty = Math.floor(i / sim.map.w);
      const cx = Math.floor(tx / CHUNK),
        cy = Math.floor(ty / CHUNK);
      all.push({
        y: (ty + 1) * TILE,
        r: () =>
          c.drawImage(
            this.chunk(sim, cx, cy),
            (tx - cx * CHUNK) * TILE,
            (ty - cy * CHUNK) * TILE,
            TILE,
            TILE,
            tx * TILE,
            ty * TILE,
            TILE,
            TILE,
          ),
      });
    }
    all.sort((a, b) => a.y - b.y).forEach((o) => o.r());
    // belgining chegarasi mavjudotlar ustida ham ko'rinadi (katta Sardor doirani yopib qo'ymaydi)
    for (const k of sim.marks) if (inView(k.x, k.y, camX, camY, 160)) drawMark(c, k, v.time, true);
    // Sardorning to'lqin halqalari: chang ko'tarilgan yer yorig'i — ustidan dash bilan o'tiladi
    for (const g of sim.rings) {
      if (!inView(g.x, g.y, camX, camY, RING_MAX + 20)) continue;
      const a = Math.max(0, 1 - g.r / RING_MAX);
      c.strokeStyle = `rgba(255,122,42,${0.85 * a})`;
      c.lineWidth = RING_W;
      c.beginPath();
      c.arc(g.x, g.y, g.r, 0, Math.PI * 2);
      c.stroke();
      c.strokeStyle = `rgba(255,236,170,${0.9 * a})`;
      c.lineWidth = 1;
      c.stroke();
    }
    // o'z Paladini: OSMON HUKMI yorug'lik ustuni va SHANG tayyorgarligi (zaryad faqat o'zida ma'lum)
    if (me.p.paladin && !me.p.dead) {
      c.save();
      c.translate(Math.round(ix - me.p.x), Math.round(iy - me.p.y));
      renderSkyColumn(c, me.p, v.time, camY - (iy - me.p.y));
      renderWindupSparks(c, me.p, v.time);
      c.restore();
    }
    for (const l of labels) l();

    // Mergan tutun bombalari: sekin aylanuvchi kulrang tutun (yashiringan Mergan ustida)
    for (const sm of sim.smokes) {
      if (!inView(sm.x, sm.y, camX, camY, 40)) continue;
      const a = Math.min(1, sm.life * 1.5, (SMOKE_TIME - sm.life) * 6);
      for (let k = 0; k < 8; k++) {
        const ang = v.time * 0.6 + k * 0.8;
        const r = k === 0 ? 0 : SMOKE_R * 0.5;
        c.fillStyle = `rgba(${k % 2 ? "120,114,106" : "168,160,150"},${0.34 * a})`;
        c.beginPath();
        c.arc(sm.x + Math.cos(ang) * r, sm.y + Math.sin(ang) * r * 0.75, SMOKE_R * 0.55, 0, 7);
        c.fill();
      }
    }

    // o'q va sharlar
    for (const b of sim.projectiles) {
      if (b.wave) renderShockwave(c, b);
      else if (b.bullet) {
        // Mergan o'qi: yaltiroq mis o'q, orqasida qisqa iz
        const l = Math.hypot(b.vx, b.vy) || 1;
        for (let k = 2; k <= 5; k++)
          px(c, k < 4 ? "#d9a441" : "#8a5a2a", b.x - (b.vx / l) * k, b.y - (b.vy / l) * k, 1, 1);
        px(c, "#0b0907", b.x - 1.5, b.y - 1.5, 3, 3);
        px(c, "#ffe2a0", b.x - 1, b.y - 1, 2, 2);
      } else if (b.arrow) {
        const a = Math.atan2(b.vy, b.vx);
        c.save();
        c.translate(b.x, b.y);
        c.rotate(a);
        px(c, "#7a4a24", -6, -0.5, 8, 1);
        px(c, "#d9d4e0", 2, -1, 3, 2);
        px(c, HERO_THEME.hunter.accent, -7, -1, 2, 2);
        c.restore();
      } else {
        const col = HERO_THEME[me.hero === "mage" ? "mage" : "knight"].accent;
        px(c, "#000", b.x - b.size / 2 - 1, b.y - b.size / 2 - 1, b.size + 2, b.size + 2);
        px(c, col, b.x - b.size / 2, b.y - b.size / 2, b.size, b.size);
        px(c, "#ffffff", b.x - 1, b.y - 1, 2, 2);
      }
    }
    // lava qurtining olov sharlari: qora chekka, qizil-sariq o'zak va iz
    for (const f of sim.fireballs) {
      if (!inView(f.x, f.y, camX, camY)) continue;
      const l = Math.hypot(f.vx, f.vy) || 1;
      for (let k = 1; k <= 4; k++)
        px(
          c,
          k < 3 ? "#ff8a2a" : "#8a1e10",
          f.x - (f.vx / l) * k * 2 - 1,
          f.y - (f.vy / l) * k * 2 - 1,
          2,
          2,
        );
      px(c, "#120604", f.x - 3, f.y - 3, 6, 6);
      px(c, "#ff5a1a", f.x - 2, f.y - 2, 4, 4);
      px(c, "#ffd36a", f.x - 1, f.y - 1, 2, 2);
    }
    v.fx.renderParticles(c);
  }

  /**
   * Issiq havo titrashi: lava ustidagi va undan biroz yuqoridagi qatorlar sekin to'lqinlanadi —
   * kanvasning ingichka bo'laklari yonga siljiydi (faqat ko'rinish).
   */
  private heatHaze(
    c: CanvasRenderingContext2D,
    v: RealmView,
    camX: number,
    camY: number,
    scale: number,
  ) {
    const sim = v.sim;
    const tx0 = Math.floor(camX / TILE),
      ty0 = Math.floor(camY / TILE);
    const rows = Math.ceil(VIEW_H / TILE) + 5;
    const hot: number[] = [];
    for (let r = 0; r < rows; r++) {
      let n = 0;
      for (let tx = tx0; tx <= tx0 + VIEW_W / TILE + 1; tx++)
        if (LAVA[sim.tileAt(tx, ty0 + r)]) n++;
      hot.push(Math.min(1, n / 4));
    }
    const m = c.getTransform();
    for (let y = 0; y < VIEW_H; y += 2) {
      const r = Math.floor((y + camY) / TILE) - ty0;
      // issiqlik yuqoriga ko'tariladi: pastdagi 3 qatorgacha lava ham ta'sir qiladi
      let heat = 0;
      for (let d = 0; d <= 3; d++) heat = Math.max(heat, (hot[r + d] ?? 0) * (1 - d * 0.22));
      if (heat <= 0.05) continue;
      const off = Math.sin(v.time * 6 + (y + camY) * 0.35) * heat * 1.2;
      if (Math.abs(off) < 0.25) continue;
      c.drawImage(c.canvas, m.e, m.f + y * m.d, VIEW_W * scale, 2 * m.d, off, y, VIEW_W, 2);
    }
  }

  /** Kul tog'i havosi: sekin yog'ayotgan kul parchalari va pastdan ko'tarilayotgan cho'g'lar. */
  private ashFall(c: CanvasRenderingContext2D, v: RealmView) {
    const dt = Math.min(0.1, Math.max(0, v.time - this.lastT));
    const f = this.flakes;
    const fresh = f.length === 0;
    while (f.length < 48) {
      const ember = Math.random() < 0.2;
      f.push({
        x: Math.random() * VIEW_W,
        y: fresh ? Math.random() * VIEW_H : ember ? VIEW_H + 4 : -4,
        vx: (Math.random() - 0.5) * 8 - 3,
        vy: ember ? -(14 + Math.random() * 18) : 9 + Math.random() * 10,
        ember,
      });
    }
    for (let i = f.length - 1; i >= 0; i--) {
      const p = f[i]!;
      p.x += (p.vx + Math.sin(v.time * 1.5 + p.y * 0.06) * 5) * dt;
      p.y += p.vy * dt;
      if (p.y > VIEW_H + 6 || p.y < -8 || p.x < -8 || p.x > VIEW_W + 8) {
        f.splice(i, 1);
        continue;
      }
      if (p.ember) {
        const on = Math.floor(v.time * 8 + i) % 3 !== 0;
        px(c, on ? "#ff8a2a" : "#ffd36a", p.x, p.y, 1, 1);
      } else {
        c.globalAlpha = 0.75;
        px(c, i % 3 ? "#b8b0aa" : "#8e8680", p.x, p.y, i % 4 ? 1 : 2, 1);
        c.globalAlpha = 1;
      }
    }
  }

  private object(
    c: CanvasRenderingContext2D,
    v: RealmView,
    o: GameObjectDef,
    x: number,
    y: number,
  ) {
    const { sim, me } = v;
    switch (o.type) {
      case "lamp": {
        px(c, "#2a1a10", x - 1, y - 8, 3, 14);
        px(c, "#5a3a22", x, y - 8, 1, 14);
        px(c, "#2a1a10", x - 3, y - 13, 7, 6);
        px(c, sim.darkness > 0.2 ? "#ffd87a" : "#8a7a5a", x - 2, y - 12, 5, 4);
        return;
      }
      case "sign":
        px(c, "#2a1a10", x - 1, y - 2, 3, 9);
        px(c, "#2a1a10", x - 7, y - 9, 15, 8);
        px(c, "#8a6a44", x - 6, y - 8, 13, 6);
        px(c, "#5a4026", x - 4, y - 6, 9, 1);
        px(c, "#5a4026", x - 4, y - 4, 7, 1);
        return;
      case "plate": {
        // bosim plitasi: ustida o'yinchi tursa (yoki sir ochilgan bo'lsa) cho'kadi va runasi yonadi
        const done = sim.region.secrets.some(
          (s) => s.type === "plates" && s.plates.includes(o.id) && me.secrets.includes(s.id),
        );
        const down = done || !!sim.plateBy(o.id);
        px(c, "#07060a", x - 7, y - 6, 14, 12);
        px(c, down ? "#2a2236" : "#463a66", x - 6, y - (down ? 4 : 5), 12, down ? 9 : 10);
        px(c, down ? "#1c1626" : "#9a8ac8", x - 6, y - (down ? 4 : 5), 12, 1);
        const rune = down ? (Math.floor(v.time * 4) % 2 ? "#ffd36a" : "#ff8a2a") : "#221a30";
        px(c, rune, x - 1, y - 3, 2, 6);
        px(c, rune, x - 3, y - 1, 6, 2);
        return;
      }
      case "torch": {
        const lit = sim.torchLit(me, o.id);
        px(c, "#2a2830", x - 3, y - 2, 7, 9);
        px(c, "#6e6a72", x - 2, y - 1, 5, 7);
        // tagidagi belgi: oy / quyosh / yulduz
        const m = "#c9a25a";
        if (o.mark === "moon") {
          px(c, m, x - 1, y + 1, 2, 3);
          px(c, m, x + 1, y + 1, 1, 1);
          px(c, m, x + 1, y + 3, 1, 1);
        } else if (o.mark === "sun") {
          px(c, m, x - 1, y + 1, 3, 3);
          px(c, m, x, y, 1, 1);
          px(c, m, x, y + 4, 1, 1);
        } else if (o.mark === "star") {
          px(c, m, x, y, 1, 5);
          px(c, m, x - 2, y + 2, 5, 1);
        } else if (o.mark === "flame") {
          px(c, m, x - 1, y + 2, 3, 2);
          px(c, m, x, y, 1, 2);
          px(c, m, x - 1, y + 1, 1, 1);
        } else if (o.mark === "skull") {
          px(c, m, x - 1, y, 3, 3);
          px(c, "#2a2830", x - 1, y + 1, 1, 1);
          px(c, "#2a2830", x + 1, y + 1, 1, 1);
          px(c, m, x, y + 3, 1, 1);
        } else {
          // toj
          px(c, m, x - 2, y + 2, 5, 2);
          px(c, m, x - 2, y, 1, 2);
          px(c, m, x, y + 1, 1, 1);
          px(c, m, x + 2, y, 1, 2);
        }
        px(c, "#2a2830", x - 4, y - 5, 9, 4);
        px(c, "#45414d", x - 3, y - 4, 7, 2);
        if (lit) {
          const f = Math.floor(v.time * 10) % 3;
          px(c, "#c1121f", x - 3, y - 9 - f, 7, 5 + f);
          px(c, "#ff9a3c", x - 2, y - 10 - f, 5, 5);
          px(c, "#ffe14d", x - 1, y - 8, 3, 3);
        }
        return;
      }
      case "fragment": {
        px(c, "#0d0c11", x - 5, y - 4, 10, 9);
        px(c, "#77727f", x - 4, y - 3, 8, 7);
        px(c, "#b3adb9", x - 4, y - 3, 3, 1);
        px(c, "#3b3843", x - 2, y - 1, 4, 1);
        px(c, "#3b3843", x - 1, y + 1, 3, 1);
        if (Math.floor(v.time * 1.5) % 3 === 0) px(c, "#ffffff", x + 2, y - 4, 1, 1);
        return;
      }
      case "door": {
        if (sim.doorOpen(o.id)) {
          px(c, "#0a0806", x - 8, y - 8, 16, 16);
          return;
        }
        px(c, "#1e1c24", x - 8, y - 8, 16, 16);
        px(c, "#4a4652", x - 7, y - 7, 14, 15);
        px(c, "#2e2b33", x, y - 7, 1, 15);
        // oy o'ymasi: tunda nur sochadi
        const glow = sim.night ? (Math.floor(v.time * 3) % 2 ? "#9fd0ef" : "#c4f3ff") : "#3b3843";
        px(c, glow, x - 3, y - 4, 2, 5);
        px(c, glow, x - 1, y - 5, 1, 1);
        px(c, glow, x - 1, y + 1, 1, 1);
        return;
      }
      case "gate": {
        // tosh ark (2 plitka baland), ichida o'z dunyosining rangidagi nur
        const col = GATE_COLOR[o.key];
        const open = me.keys.includes(o.key);
        px(c, "#0d0c11", x - 12, y - 22, 24, 30);
        px(c, "#5a5662", x - 11, y - 21, 22, 28);
        px(c, "#77727f", x - 11, y - 21, 22, 2);
        px(c, "#3b3843", x - 7, y - 15, 14, 22);
        if (open) {
          const f = Math.floor(v.time * 4) % 3;
          px(c, col.dark, x - 6, y - 14, 12, 21);
          px(c, col.mid, x - 5, y - 12 + f, 10, 17 - f);
          px(c, col.light, x - 2, y - 8 + f, 4, 9);
        } else {
          px(c, "#1a1820", x - 6, y - 14, 12, 21);
          for (let k = -5; k <= 4; k += 3) px(c, "#6e6a72", x + k, y - 14, 1, 21);
          // qulf
          px(c, "#0d0c11", x - 4, y - 5, 8, 7);
          px(c, "#c9a25a", x - 3, y - 4, 6, 5);
          px(c, "#0d0c11", x, y - 3, 1, 2);
          px(c, "#c9a25a", x - 2, y - 8, 1, 4);
          px(c, "#c9a25a", x + 1, y - 8, 1, 4);
          px(c, "#c9a25a", x - 2, y - 8, 4, 1);
        }
        // tepadagi belgi: dunyo rangida; ochiq darvoza qaysi hududga olib borishini yozadi
        px(c, col.mid, x - 2, y - 20, 4, 3);
        const dest = o.to ? sim.object(o.to) : undefined;
        const where = dest ? sim.areaAt(tileCenter(dest.x), tileCenter(dest.y))?.name : undefined;
        text(
          c,
          open ? (where ?? "TEZ ORADA") : "QULFLANGAN",
          x,
          y - 26,
          4,
          open ? col.light : "#8a7a9a",
          "center",
        );
        return;
      }
      case "chest": {
        const open = me.opened.includes(o.id);
        px(c, "#1a0f08", x - 7, y - 6, 14, 12);
        px(c, open ? "#5a3a22" : "#8a5a2a", x - 6, y - 5, 12, 10);
        px(c, "#c9a25a", x - 6, y - 1, 12, 1);
        px(c, "#ffcc33", x - 1, y - 2, 2, 3);
        if (open) px(c, "#1a0f08", x - 5, y - 5, 10, 3);
        return;
      }
    }
  }

  private mob(c: CanvasRenderingContext2D, v: RealmView, m: RealmMob, x: number, y: number) {
    if (m.under) {
      // yer ostidagi lava qurti ko'rinmaydi; uyidagisi — qizigan do'nglik (shu yerda qurt bor)
      if (m.state === "dormant") {
        px(c, "#2a1810", x - 6, y + 3, 12, 3);
        px(c, "#3a1810", x - 4, y + 1, 8, 3);
        if (Math.floor(v.time * 2 + m.id) % 3 === 0) px(c, "#ff5a1a", x - 1, y + 2, 2, 1);
      }
      return;
    }
    const fade = m.spawnT > 0 ? 1 - m.spawnT / 0.5 : 1;
    // hamla: orqada so'nib boruvchi tezlik chiziqlari (chang izi klientda zarrachalar bilan)
    if (m.state === "attack" && (m.kind === "warden" || m.kind === "boar") && !m.dead) {
      const big = m.kind === "warden";
      const half = m.size / 2;
      c.save();
      c.translate(x, y);
      c.rotate(Math.atan2(m.dirY, m.dirX));
      c.fillStyle = "#e8dcc0";
      for (let i = 0; i < (big ? 5 : 3); i++) {
        const lane = ((i * 7) % (half * 2)) - half + 2;
        const len = (big ? 18 : 10) + ((i * 5 + Math.floor(v.time * 30)) % 8);
        const back = half + ((i * 3) % 6);
        for (let s = 0; s < len; s += 2) {
          c.globalAlpha = 0.55 * (1 - s / len);
          c.fillRect(-back - s, lane, 2, 1);
        }
      }
      c.restore();
      c.globalAlpha = 1;
    }
    // yer — to'qnashuv qutisining pastki cheti: oyoq uchlari aynan soya ustida (faqat ruh havoda uchadi)
    const wisp = m.kind === "wisp";
    const ground = wisp ? y + 12 : y + m.size / 2;
    if (!m.dead)
      shadow(c, x, ground, m.kind === "warden" ? 30 : m.kind === "ashking" ? 52 : m.size);
    c.globalAlpha = Math.max(0.15, fade) * (m.evading ? 0.6 : 1);
    const sy = wisp
      ? y + Math.round(Math.sin(v.time * 3 + m.id) * 2) - 4
      : ground - spriteFootOffset(m.kind, m.anim.state, m.anim.frame);
    // haykal holatidagi qo'riqchi: tosh (runa so'ngan); qo'riqchi moxli tusini saqlaydi
    const dormant = m.state === "dormant" && m.statue;
    if (dormant)
      c.filter =
        m.kind === "warden"
          ? "grayscale(1) brightness(0.85)"
          : m.kind === "obsguard"
            ? "grayscale(0.6) brightness(0.7)"
            : "grayscale(0.4) brightness(0.8)";
    renderSprite(
      c,
      m.kind,
      m.anim.state,
      m.anim.frame,
      x,
      sy,
      m.flash > 0 && Math.floor(m.flash * 25) % 2 === 0,
      m.face < 0,
    );
    if (dormant) c.filter = "none";
    c.globalAlpha = 1;
    if (m.shieldUp) {
      // Sardor qalqoni: oldidagi bronza yoy — orqasidan urish kerak
      const a = Math.atan2(m.dirY, m.dirX);
      c.strokeStyle = m.flash > 0 ? "rgba(255,240,170,0.95)" : "rgba(201,162,90,0.7)";
      c.lineWidth = 2;
      c.beginPath();
      c.arc(x, y + 2, m.size / 2 + 6, a - WARDEN_SHIELD_ARC, a + WARDEN_SHIELD_ARC);
      c.stroke();
    }
    // Paladin OSMON HUKMIdan gangigan — oq-oltin yulduzchalar, boshqa gangish — sariq
    if (m.stun > 0 && !m.dead && m.holy) renderDazeStars(c, x, y - m.size / 2 - 8, v.time);
    else if (m.stun > 0 && !m.dead)
      for (let i = 0; i < 3; i++) {
        const a = v.time * 6 + (i * Math.PI * 2) / 3;
        px(c, "#ffe14d", x + Math.cos(a) * 7, y - m.size / 2 - 8 + Math.sin(a) * 2, 2, 2);
      }
    // kichik jon chizig'i (Sardordan tashqari — uniki pastda)
    if (!m.dead && m.hp < m.maxHp && m.kind !== "warden" && m.kind !== "ashking") {
      const w = 14;
      px(c, "#000", x - w / 2 - 1, y - m.size / 2 - 7, w + 2, 3);
      px(c, "#ff4d6d", x - w / 2, y - m.size / 2 - 6, (w * m.hp) / m.maxHp, 1);
    }
  }

  private prompt(c: CanvasRenderingContext2D, v: RealmView) {
    const { sim, me } = v;
    if (me.ui || v.panel !== "none" || me.p.dead) return;
    const t = sim.interactTarget(me);
    if (!t) return;
    let label = "OCHISH";
    if (t.kind === "npc") label = "GAPLASHISH";
    else {
      const o = sim.object(t.id);
      if (o?.type === "sign") label = "O'QISH";
      else if (o?.type === "torch") label = "YOQISH";
      else if (o?.type === "fragment") label = "OLISH";
      else if (o?.type === "gate") label = "KO'RISH";
    }
    const s = v.touch ? label : `[${actionKey(v.keys, "interact")}] ${label}`;
    const w = s.length * 5 + 6;
    const gate = t.kind === "object" && sim.object(t.id)?.type === "gate";
    const y = t.y - (t.kind === "npc" ? 26 : gate ? 34 : 18) + Math.round(Math.sin(v.time * 4));
    px(c, "rgba(0,0,0,0.6)", t.x - w / 2, y - 7, w, 9);
    text(c, s, t.x, y, 5, "#ffe14d", "center");
  }

  // ---------------- tun ----------------

  private night(
    c: CanvasRenderingContext2D,
    v: RealmView,
    camX: number,
    camY: number,
    ix: number,
    iy: number,
  ) {
    const { sim, me } = v;
    const d = sim.darkness;
    const t = sim.dayTime;
    // shom va tong: iliq to'q sariq tus
    if ((t > 0.5 && t < 0.62) || t > 0.93 || t < 0.04) {
      const k =
        t > 0.5 && t < 0.62
          ? 1 - Math.abs(t - 0.57) / 0.05
          : 1 - Math.min(Math.abs(t - 0.97), Math.abs(t + 0.03)) / 0.06;
      c.globalAlpha = Math.max(0, Math.min(0.22, k * 0.22));
      c.fillStyle = "#ff8a3a";
      c.fillRect(0, 0, VIEW_W, VIEW_H);
      c.globalAlpha = 1;
    }
    if (d <= 0) return;
    if (!this.light) {
      this.light = document.createElement("canvas");
      this.light.width = VIEW_W;
      this.light.height = VIEW_H;
    }
    const l = this.light.getContext("2d")!;
    l.globalCompositeOperation = "source-over";
    l.clearRect(0, 0, VIEW_W, VIEW_H);
    l.fillStyle = `rgba(6,8,26,${0.84 * d})`;
    l.fillRect(0, 0, VIEW_W, VIEW_H);
    l.globalCompositeOperation = "destination-out";
    // yumshoq yorug'lik: markazda to'liq, chetiga qarab asta qorayadi
    const glows: { x: number; y: number; r: number }[] = [];
    const hole = (x: number, y: number, r: number) => {
      const sx = Math.round(x - camX),
        sy = Math.round(y - camY);
      if (sx < -r || sy < -r || sx > VIEW_W + r || sy > VIEW_H + r) return;
      const g = l.createRadialGradient(sx, sy, 0, sx, sy, r);
      g.addColorStop(0, "rgba(0,0,0,0.95)");
      g.addColorStop(0.45, "rgba(0,0,0,0.75)");
      g.addColorStop(0.75, "rgba(0,0,0,0.3)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      l.fillStyle = g;
      l.fillRect(sx - r, sy - r, r * 2, r * 2);
      glows.push({ x: sx, y: sy, r });
    };
    hole(ix, iy, 64 * me.light);
    for (const o of sim.region.objects) {
      const x = tileCenter(o.x),
        y = tileCenter(o.y);
      if (o.type === "lamp") hole(x, y - 10, 46);
      else if (o.type === "torch" && sim.torchLit(me, o.id)) hole(x, y - 8, 40);
      else if (o.type === "door" && !sim.doorOpen(o.id)) hole(x, y, 20);
    }
    // uylarning derazalari
    const tx0 = Math.floor(camX / TILE) - 2,
      ty0 = Math.floor(camY / TILE) - 2;
    for (let ty = ty0; ty < ty0 + VIEW_H / TILE + 4; ty++)
      for (let tx = tx0; tx < tx0 + VIEW_W / TILE + 4; tx++)
        if (sim.tileAt(tx, ty) === TILE_IDS.window) hole(tileCenter(tx), tileCenter(ty) + 6, 22);
    for (const m of sim.mobs) if (m.kind === "wisp" && !m.dead) hole(m.x, m.y, 26);
    for (const b of sim.projectiles) if (!b.arrow && !b.bullet) hole(b.x, b.y, 18);
    // Kul tog'i: lava, olov sharlari va yer ustidagi lava qurtlari yoritadi
    for (let ty = ty0; ty < ty0 + VIEW_H / TILE + 4; ty += 2)
      for (let tx = tx0 - (tx0 % 2); tx < tx0 + VIEW_W / TILE + 4; tx += 2)
        if (LAVA[sim.tileAt(tx, ty)]) hole(tileCenter(tx), tileCenter(ty), 26);
    for (const f of sim.fireballs) hole(f.x, f.y, 16);
    for (const m of sim.mobs) if (m.kind === "lavaworm" && !m.under && !m.dead) hole(m.x, m.y, 22);
    l.globalCompositeOperation = "source-over";
    c.drawImage(this.light, 0, 0);
    // iliq nur: yorug'lik doiralari ustida sarg'ish tus
    c.globalCompositeOperation = "lighter";
    for (const o of glows) {
      const g = c.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
      g.addColorStop(0, `rgba(255,150,60,${0.1 * d})`);
      g.addColorStop(1, "rgba(255,150,60,0)");
      c.fillStyle = g;
      c.fillRect(o.x - o.r, o.y - o.r, o.r * 2, o.r * 2);
    }
    c.globalCompositeOperation = "source-over";
    // yulduzlar (osmonga qaragandek — ekran tepasida miltillaydi)
    if (d > 0.6)
      for (let i = 0; i < 14; i++) {
        const sx = (i * 73 + Math.floor(camX * 0.1)) % VIEW_W,
          sy = (i * 37) % 60;
        if (Math.floor(v.time * 2 + i) % 5) px(c, "rgba(220,230,255,0.5)", sx, sy, 1, 1);
      }
  }

  // ---------------- HUD ----------------

  private hud(c: CanvasRenderingContext2D, v: RealmView) {
    const { sim, me } = v;
    const p = me.p;
    for (let i = 0; i < p.maxHp; i++) heart(c, 4 + i * 10, 4, i < p.hp ? "#ff4d6d" : "#3b2a3a");
    const { on, off } = hudBarColors(me.hero);
    const k = Math.max(0, Math.min(1, 1 - p.dashCooldown / p.dashCd));
    px(c, "#000", 4, 14, 32, 3);
    px(c, k >= 1 ? on : off, 5, 15, 30 * k, 1);
    const sk = Math.max(0, Math.min(1, 1 - p.spinCooldown / p.spinCd));
    px(c, "#000", 4, 18, 32, 3);
    px(
      c,
      p.charged && Math.floor(v.time * 12) % 2 ? "#ffffff" : sk >= 1 ? on : off,
      5,
      19,
      30 * sk,
      1,
    );
    if (p.gunner) {
      // Mergan: barabandagi o'qlar (otilgani xira) va qayta o'qlash chizig'i — chiziqlar yonida
      const t = HERO_THEME.gunner;
      for (let i = 0; i < p.ammoMax; i++) {
        const full = i < p.ammo;
        px(c, "#000", 40 + i * 5, 13, 4, 7);
        px(c, full ? t.glow : "#3a332b", 41 + i * 5, 14, 2, 1);
        px(c, full ? t.accent : "#2e2820", 41 + i * 5, 15, 2, 3);
        px(c, full ? t.accentDark : "#241f19", 41 + i * 5, 18, 2, 1);
      }
      if (p.reloading) {
        const rk = Math.max(0, Math.min(1, 1 - p.reloadT / p.reloadTime));
        px(c, "#000", 40, 21, p.ammoMax * 5 - 1, 2);
        px(c, t.glow, 41, 21, (p.ammoMax * 5 - 3) * rk, 1);
      }
    }
    if (p.paladin) {
      // Paladin: QASAM chizig'i (faol — qolgan vaqt) chiziqlar yonida
      const t = HERO_THEME.paladin;
      const vk = p.vowing
        ? p.vowT / VOW_TIME
        : Math.max(0, Math.min(1, 1 - p.vowCooldown / p.vowCd));
      px(c, "#000", 40, 14, 22, 3);
      px(c, p.vowing ? t.glow : vk >= 1 ? t.accent : t.accentDark, 41, 15, 20 * vk, 1);
      drawRoleIcon(c, "tank", 40, 18, vk >= 1 || p.vowing ? t.accent : t.accentDark);
    }
    coin(c, 4, 24);
    text(c, String(me.gold), 13, 30, 6, "#ffcc33");
    // kashfiyotlar chap ustunda: mini-xarita va KUN/TUN bilan to'qnashmaydi (umumiy son ko'rsatilmaydi)
    text(c, `Kashfiyotlar: ${me.secrets.length}/?`, 4, 40, 5, "#c9a25a");

    // faol topshiriq
    const q = Object.entries(me.quests).find(([, s]) => s.status !== "done");
    if (q) {
      const def = sim.data.quests[q[0]]!;
      const st = q[1];
      const step = def.steps[st.step];
      const line =
        st.status === "ready"
          ? (def.back ?? "Oqsoqolga qayt")
          : step
            ? step.type === "kill"
              ? `${step.text} ${st.progress}/${step.count}`
              : step.type === "deliver"
                ? `${step.text} ${Math.min(sim.countItem(me, step.item), step.count)}/${step.count}`
                : step.text
            : "";
      text(c, def.name, 4, 52, 5, "#ffe14d");
      wrap(line, 26).forEach((s, i) => text(c, s, 4, 61 + i * 8, 5, "#e0d6ee"));
    }

    // mini-xarita
    const mw = 60,
      mh = 44,
      mx = VIEW_W - mw - 4,
      my = 4;
    const map = this.exploredMap(v);
    const ptx = Math.floor(p.x / TILE),
      pty = Math.floor(p.y / TILE);
    const ar = this.area;
    const ax = ar?.x ?? 0,
      ay = ar?.y ?? 0;
    const sx = Math.max(ax, Math.min(ax + (ar?.w ?? sim.map.w) - mw, ptx - mw / 2)),
      sy = Math.max(ay, Math.min(ay + (ar?.h ?? sim.map.h) - mh, pty - mh / 2));
    px(c, "#000", mx - 2, my - 2, mw + 4, mh + 4);
    px(c, "#5c4a6e", mx - 1, my - 1, mw + 2, mh + 2);
    c.drawImage(map, sx, sy, mw, mh, mx, my, mw, mh);
    for (const n of sim.region.npcs)
      if (sim.isExplored(me, n.x, n.y) && n.x >= sx && n.y >= sy && n.x < sx + mw && n.y < sy + mh)
        px(c, "#ffe14d", mx + n.x - sx - 1, my + n.y - sy - 1, 2, 2);
    if (Math.floor(v.time * 3) % 2) px(c, "#ffffff", mx + ptx - sx - 1, my + pty - sy - 1, 3, 3);
    v.buttons.push({ x: mx, y: my, w: mw, h: mh, act: () => v.act.panel("map") });
    // vaqt
    const night = sim.night;
    if (night) {
      px(c, "#e6f0ff", mx, my + mh + 4, 5, 5);
      px(c, "#1f1730", mx + 2, my + mh + 4, 3, 3);
    } else {
      px(c, "#ffcc33", mx, my + mh + 4, 5, 5);
      px(c, "#fff2a8", mx + 1, my + mh + 5, 2, 2);
    }
    text(c, night ? "TUN" : "KUN", mx + 8, my + mh + 9, 5, night ? "#9fd0ef" : "#ffe14d");
    this.netBadge(c, v, VIEW_W - 4, my + mh + 19);
    if (v.net.mode === "online" && v.panel === "none" && !me.ui)
      this.netButtons(c, v, my + mh + 32);

    // inventar (8 slot)
    const sw = 17,
      x0 = (VIEW_W - sw * 8) / 2,
      y0 = VIEW_H - 21;
    for (let i = 0; i < 8; i++) {
      const s = me.inv[i];
      const def = s ? sim.data.items[s.item] : undefined;
      const x = x0 + i * sw;
      px(c, "#000", x, y0, sw - 1, sw - 1);
      px(c, def ? RARITY_COLOR[def.rarity] : "#3b2a3a", x + 1, y0 + 1, sw - 3, sw - 3);
      px(c, "#1f1730", x + 2, y0 + 2, sw - 5, sw - 5);
      if (def?.rarity === "legendary") {
        // afsonaviy: chekka bo'ylab yugurayotgan yorqin nuqta va ichki porlash
        const per = (sw - 3) * 4,
          k = Math.floor(v.time * 24 + i * 5) % per,
          e = sw - 3;
        const [gx, gy] =
          k < e
            ? [k, 0]
            : k < e * 2
              ? [e - 1, k - e]
              : k < e * 3
                ? [e * 3 - k - 1, e - 1]
                : [0, per - k - 1];
        px(c, "#fff2c0", x + 1 + gx, y0 + 1 + gy, 1, 1);
        c.globalAlpha = 0.18 + 0.12 * Math.sin(v.time * 5 + i);
        px(c, "#ffb02e", x + 2, y0 + 2, sw - 5, sw - 5);
        c.globalAlpha = 1;
      }
      if (def && s) {
        drawItemIcon(c, def.icon, x + 2, y0 + 2);
        if (s.n > 1) text(c, String(s.n), x + sw - 3, y0 + sw - 3, 5, "#ffffff", "right");
      }
      if (!v.touch) text(c, String(i + 1), x + 2, y0 - 1, 4, "rgba(224,214,238,0.6)");
      v.buttons.push({ x, y: y0, w: sw - 1, h: sw - 1, act: () => v.act.use(i) });
    }

    // Kul qiroli: katta jon chizig'i, faza belgilari va g'azab taymeri (jangda yoki zalda bo'lsa)
    const king = sim.mobs.find((m) => m.kind === "ashking" && !m.dead);
    const raid = sim.raid;
    const inRaid = !!king && !!raid?.active && (raid.inArena(p.x, p.y) || p.dead);
    if (inRaid && king && raid && v.intro <= 0) {
      const bw = 200,
        bx = (VIEW_W - bw) / 2,
        by = VIEW_H - 36;
      const name = `${MOB_STATS.ashking.name} · ${PHASE_TEXT[king.phase] ?? ""}`;
      text(c, name, VIEW_W / 2, by - 3, 6, raid.enraged ? "#ff3b1a" : "#ffb02e", "center");
      px(c, "#000", bx - 1, by, bw + 2, 7);
      px(c, "#3b1a14", bx, by + 1, bw, 5);
      const hpCol = raid.enraged && Math.floor(v.time * 6) % 2 ? "#ffd36a" : "#ff5a1a";
      px(c, hpCol, bx, by + 1, (bw * king.hp) / king.maxHp, 5);
      // faza chegaralari (60% va 30%)
      px(c, "#ffffff", bx + bw * 0.6, by + 1, 1, 5);
      px(c, "#ffffff", bx + bw * 0.3, by + 1, 1, 5);
      // g'azab taymeri va jamoa
      const left = Math.max(0, KING_ENRAGE - raid.elapsed);
      const mm = Math.floor(left / 60),
        ss = Math.floor(left % 60);
      text(
        c,
        raid.enraged ? "G'AZAB!" : `G'AZAB ${mm}:${String(ss).padStart(2, "0")}`,
        bx + bw,
        by + 15,
        5,
        raid.enraged || left < 30 ? "#ff3b1a" : "#e0d6ee",
        "right",
      );
      text(c, `JAMOA: ${raid.party}`, bx, by + 15, 5, "#e0d6ee");
    }
    // Sardor jon chizig'i
    const boss = sim.mobs.find((m) => m.kind === "warden" && m.target === me.id && !m.dead);
    if (boss) {
      const bw = 150,
        bx = (VIEW_W - bw) / 2,
        by = VIEW_H - 34;
      text(
        c,
        MOB_STATS.warden.name,
        VIEW_W / 2,
        by - 3,
        6,
        boss.raging ? "#ff7a2a" : "#e0d6ee",
        "center",
      );
      px(c, "#000", bx - 1, by, bw + 2, 6);
      px(c, "#3b2a3a", bx, by + 1, bw, 4);
      px(c, boss.raging ? "#ff7a2a" : "#c1121f", bx, by + 1, (bw * boss.hp) / boss.maxHp, 4);
      px(c, "#ffffff", bx + bw / 2, by + 1, 1, 4);
    }

    // xabarlar
    v.toasts.slice(-3).forEach((t, i, arr) => {
      const y = VIEW_H - 44 - (arr.length - 1 - i) * 9 - (boss ? 14 : inRaid ? 18 : 0);
      c.globalAlpha = Math.min(1, t.t);
      text(c, t.text, VIEW_W / 2, y, 6, t.color, "center");
      c.globalAlpha = 1;
    });
    // joy nomi / katta e'lon
    const b = v.banner;
    if (b.t > 0) {
      c.globalAlpha = Math.min(1, b.t);
      text(c, b.text, VIEW_W / 2, 74, 10, b.color, "center");
      if (b.sub) text(c, b.sub, VIEW_W / 2, 88, 6, "#e0d6ee", "center");
      c.globalAlpha = 1;
    }
    if (p.dead) {
      px(c, "rgba(0,0,0,0.5)", 0, 96, VIEW_W, 40);
      text(c, "HALOK BO'LDINGIZ", VIEW_W / 2, 114, 10, "#ff4d6d", "center");
      const wait = Math.max(0, Math.ceil(KING_RESPAWN - (v.time - v.deadAt)));
      text(
        c,
        inRaid
          ? `Zal kirishida qayta tug'ilasiz: ${wait} s — jang davom etmoqda`
          : this.area?.id === "ashmount"
            ? "Kul darvozasi yonida o'zingizga kelasiz..."
            : "Qishloqda o'zingizga kelasiz...",
        VIEW_W / 2,
        128,
        6,
        "#e0d6ee",
        "center",
      );
    }
  }

  /** O'ng yuqorida: "ONLAYN: N" va ping yoki "OFLAYN" */
  private netBadge(c: CanvasRenderingContext2D, v: RealmView, x: number, y: number) {
    const n = v.net;
    if (n.mode === "online") {
      const label = `ONLAYN: ${n.n}`;
      px(c, "#7be07b", x - label.length * 5 - 6, y - 5, 4, 4);
      text(c, label, x, y, 5, "#7be07b", "right");
      if (n.ping > 0) {
        const ms = Math.round(n.ping);
        text(c, `${ms} ms`, x, y + 8, 4, ms > 250 ? "#ff9a3c" : "#8a7a9a", "right");
      }
    } else if (n.mode === "connecting")
      text(
        c,
        "ULANISH" + ".".repeat(1 + (Math.floor(v.time * 3) % 3)),
        x,
        y,
        5,
        "#c9a25a",
        "right",
      );
    else text(c, "OFLAYN", x, y, 5, "#8a7a9a", "right");
  }

  /** Onlayn: DO'ST (chaqirish) va CHAT tugmalari, ochiq bo'lsa — tayyor iboralar */
  private netButtons(c: CanvasRenderingContext2D, v: RealmView, y: number) {
    const btn = (label: string, x: number, w: number, act: () => void, on = false) => {
      px(c, on ? "#7be07b" : "#5c4a6e", x, y, w, 12);
      px(c, "#2b1c3e", x + 1, y + 1, w - 2, 10);
      text(c, label, x + w / 2, y + 9, 5, on ? "#7be07b" : "#e0d6ee", "center");
      v.buttons.push({ x, y, w, h: 12, act });
    };
    btn("CHAT", VIEW_W - 4 - 30, 30, () => v.act.chat(), v.chatOpen);
    btn("+DO'ST", VIEW_W - 4 - 30 - 4 - 38, 38, () => v.act.invite());
    if (!v.chatOpen) return;
    PHRASES.forEach((p, i) => {
      const w = 76,
        x = VIEW_W - 4 - w,
        by = y + 16 + i * 14;
      px(c, "#9fd0ef", x, by, w, 12);
      px(c, "#1f1730", x + 1, by + 1, w - 2, 10);
      const label = v.touch ? p : `${i + 1} ${p}`;
      text(c, label, x + 4, by + 9, 5, "#e0d6ee");
      v.buttons.push({ x, y: by, w, h: 12, act: () => v.act.say(i) });
    });
  }

  // ---------------- oynalar ----------------

  /** Reyd boss kirish sahnasi: kino qatorlari, olovli chiziq, katta nom va boss surati. */
  private raidIntro(c: CanvasRenderingContext2D, v: RealmView) {
    const k = v.intro;
    if (k <= 0) return;
    const t = 1 - k;
    const a = Math.min(1, t / 0.12, k / 0.15);
    const slide = Math.round((1 - Math.min(1, t / 0.18)) * 70);
    c.globalAlpha = a;
    px(c, "rgba(0,0,0,0.88)", 0, 0, VIEW_W, 26);
    px(c, "rgba(0,0,0,0.88)", 0, VIEW_H - 26, VIEW_W, 26);
    px(c, "rgba(18,4,3,0.85)", 0, 142, VIEW_W, 56);
    px(c, "#ff6a1a", 0, 142, VIEW_W, 1);
    px(c, "#ffe08a", 0, 143, VIEW_W, 1);
    px(c, "#ff6a1a", 0, 197, VIEW_W, 1);
    renderSprite(c, "ashking", "attack", 2, 46 - slide, 150, false);
    text(c, MOB_STATS.ashking.name, VIEW_W / 2 + 22 - slide, 170, 14, "#ff6a1a", "center");
    text(
      c,
      "Iblisning otasi — lava va olov hukmdori",
      VIEW_W / 2 + 22 + slide,
      184,
      5,
      "#e0d6ee",
      "center",
    );
    text(
      c,
      "REYD · 2–4 O'YINCHI · TANK KERAK",
      VIEW_W / 2 + 22 + slide,
      193,
      4,
      "#ffb02e",
      "center",
    );
    c.globalAlpha = 1;
  }

  private overlays(c: CanvasRenderingContext2D, v: RealmView) {
    this.raidIntro(c, v);
    const { sim, me } = v;
    const ui = me.ui;
    if (ui?.kind === "dialog") return this.dialog(c, v, ui.npc, ui.node);
    if (ui?.kind === "shop") return this.shop(c, v, ui.npc);
    if (ui?.kind === "lore") {
      const s = sim.region.secrets.find((s) => s.id === ui.secret);
      if (s?.type === "tablet") this.textBox(c, v, s.lore[0] ?? "", s.lore.slice(1), "#c9a25a");
      return;
    }
    if (ui?.kind === "sign") return this.textBox(c, v, ui.title ?? "YOZUV", ui.text, "#8a6a44");
    if (v.panel === "journal") return this.journal(c, v);
    if (v.panel === "map") return this.fullMap(c, v);
    if (v.panel === "pause") return this.pause(c, v);
    if (v.panel === "invite") return this.invite(c, v);
    if (v.panel === "intro")
      return this.textBox(
        c,
        v,
        "ABADIYAT OLAMI",
        [
          "Iblis, Qor Malikasi va O'rmon Shohi shu olamdan kelgan. Sening uch dunyong — Abadiyat olamidan ochilgan darvozalar. Iblisni yenganing uchun birinchi darvoza ochildi.",
          v.touch ? touchIntro(v.me.hero) : keysIntro(v.keys),
          "Qishloq oqsoqoli bilan gaplashing. Olamda yashirin sirlar bor — ularni o'zingiz toping.",
        ],
        "#ffe14d",
      );
  }

  private closeBtn(
    c: CanvasRenderingContext2D,
    v: RealmView,
    x: number,
    y: number,
    label = "YOPISH",
  ) {
    const w = label.length * 5 + 10;
    px(c, "#5c4a6e", x, y, w, 12);
    px(c, "#2b1c3e", x + 1, y + 1, w - 2, 10);
    text(c, label, x + w / 2, y + 9, 5, "#e0d6ee", "center");
    v.buttons.push({ x, y, w, h: 12, act: () => v.act.close() });
  }

  private textBox(
    c: CanvasRenderingContext2D,
    v: RealmView,
    title: string,
    lines: string[],
    color: string,
  ) {
    const body = lines.flatMap((l) => [...wrap(l, 46), ""]);
    const h = 34 + body.length * 8;
    const y = Math.max(8, (VIEW_H - h) / 2);
    panel(c, 16, y, 288, h, color);
    text(c, title, VIEW_W / 2, y + 14, 7, color, "center");
    body.forEach((l, i) => text(c, l, 26, y + 28 + i * 8, 5, "#e0d6ee"));
    this.closeBtn(
      c,
      v,
      VIEW_W / 2 - 25,
      y + h - 15,
      v.touch ? "DAVOM" : `[${actionKey(v.keys, "interact")}] DAVOM`,
    );
  }

  private dialog(c: CanvasRenderingContext2D, v: RealmView, npcId: string, nodeId: string) {
    const { sim, me } = v;
    const npc = sim.region.npcs.find((n) => n.id === npcId);
    const node = sim.data.dialogs[npc?.dialog ?? ""]?.nodes[nodeId];
    if (!npc || !node) return;
    const lines = node.text.flatMap((t) => wrap(t, 40));
    const choices = sim.visibleChoices(me);
    const h = 26 + lines.length * 8 + choices.length * 11;
    const y = VIEW_H - h - 4;
    panel(c, 6, y, 308, h, "#c9a25a");
    px(c, "#2b1c3e", 12, y + 6, 38, 38);
    renderSprite(
      c,
      npc.sprite as SpriteKind,
      "idle",
      Math.floor(v.time * 2) % 2,
      31,
      y + 27,
      false,
    );
    text(c, npc.name, 58, y + 13, 6, "#ffe14d");
    lines.forEach((l, i) => text(c, l, 58, y + 24 + i * 8, 5, "#e0d6ee"));
    const cy0 = y + 26 + lines.length * 8;
    choices.forEach((ch, i) => {
      const yy = cy0 + i * 11;
      const sel = v.sel === i;
      const hov = v.hover && v.hover.y >= yy - 1 && v.hover.y < yy + 10 && v.hover.x > 54;
      if (sel || hov) px(c, "#3b2a55", 56, yy - 1, 252, 10);
      text(c, `${i + 1}. ${ch.text}`, 60, yy + 7, 5, sel ? "#ffe14d" : "#b8a8cc");
      v.buttons.push({ x: 54, y: yy - 1, w: 256, h: 11, act: () => v.act.choose(i) });
    });
  }

  private shop(c: CanvasRenderingContext2D, v: RealmView, npc: string) {
    const { sim, me } = v;
    const list = sim.shopList(npc);
    panel(c, 14, 16, 292, 196, "#c9a25a");
    text(c, "SAVDOGAR", 24, 30, 7, "#ffe14d");
    coin(c, 236, 23);
    text(c, String(me.gold), 246, 30, 6, "#ffcc33");
    text(c, "SOTIB OLISH", 24, 46, 5, "#c9a25a");
    list.forEach((id, i) => {
      const def = sim.data.items[id]!;
      const y = 52 + i * 20;
      const sel = v.sel === i;
      px(c, sel ? "#3b2a55" : "#261b38", 22, y, 132, 18);
      drawItemIcon(c, def.icon, 25, y + 3);
      text(c, def.name, 41, y + 8, 5, RARITY_COLOR[def.rarity]);
      text(c, def.desc, 41, y + 16, 4, "#b8a8cc");
      coin(c, 132, y + 5);
      text(c, String(def.price ?? 0), 152, y + 11, 5, "#ffcc33", "right");
      v.buttons.push({ x: 22, y, w: 132, h: 18, act: () => v.act.buy(id) });
    });
    text(c, "SOTISH (bosing)", 166, 46, 5, "#c9a25a");
    for (let i = 0; i < 8; i++) {
      const s = me.inv[i];
      const def = s ? sim.data.items[s.item] : undefined;
      const x = 166 + (i % 4) * 34,
        y = 52 + Math.floor(i / 4) * 34;
      const sel = v.sel === list.length + i;
      px(c, "#000", x, y, 30, 30);
      px(c, def ? RARITY_COLOR[def.rarity] : "#3b2a3a", x + 1, y + 1, 28, 28);
      px(c, sel ? "#3b2a55" : "#1f1730", x + 2, y + 2, 26, 26);
      if (s && def) {
        drawItemIcon(c, def.icon, x + 9, y + 4);
        if (s.n > 1) text(c, String(s.n), x + 27, y + 14, 4, "#ffffff", "right");
        coin(c, x + 4, y + 20);
        text(c, `+${def.sell}`, x + 12, y + 26, 4, "#ffcc33");
        v.buttons.push({ x, y, w: 30, h: 30, act: () => v.act.sell(i) });
      }
    }
    // tanlangan buyum haqida
    const selItem =
      v.sel < list.length ? list[v.sel] : (me.inv[v.sel - list.length]?.item ?? undefined);
    const def = selItem ? sim.data.items[selItem] : undefined;
    if (def) {
      text(c, def.name, 166, 132, 5, RARITY_COLOR[def.rarity]);
      text(c, RARITY_NAME[def.rarity], 166, 141, 4, RARITY_COLOR[def.rarity]);
      wrap(def.desc, 26).forEach((l, i) => text(c, l, 166, 151 + i * 7, 4, "#e0d6ee"));
    }
    if (!v.touch)
      text(
        c,
        `Strelka — tanlash, ${actionKey(v.keys, "attack")} — olish/sotish`,
        24,
        196,
        4,
        "#8a7a9a",
      );
    this.closeBtn(c, v, 250, 194);
  }

  private journal(c: CanvasRenderingContext2D, v: RealmView) {
    const { sim, me } = v;
    panel(c, 14, 10, 292, 220, "#c9a25a");
    text(c, "TOPSHIRIQLAR JURNALI", VIEW_W / 2, 26, 7, "#ffe14d", "center");
    let y = 42;
    const entries = Object.entries(me.quests).sort(
      (a, b) => Number(a[1].status === "done") - Number(b[1].status === "done"),
    );
    if (!entries.length) {
      text(c, "Hozircha topshiriq yo'q.", 26, y, 5, "#b8a8cc");
      text(c, "Qishloq oqsoqoli bilan gaplashing.", 26, y + 9, 5, "#b8a8cc");
    }
    for (const [id, st] of entries) {
      const def = sim.data.quests[id];
      if (!def || y > 200) continue;
      const done = st.status === "done";
      text(c, `${done ? "✓ " : ""}${def.name}`, 24, y, 6, done ? "#6a8a5a" : "#ffe14d");
      y += 9;
      if (!done) {
        for (const l of wrap(def.desc, 46)) {
          text(c, l, 26, y, 4, "#b8a8cc");
          y += 7;
        }
        def.steps.forEach((s, i) => {
          if (i > st.step) return;
          const ok = i < st.step || st.status === "ready";
          const prog =
            !ok && s.type === "kill"
              ? ` ${st.progress}/${s.count}`
              : !ok && s.type === "deliver"
                ? ` ${Math.min(sim.countItem(me, s.item), s.count)}/${s.count}`
                : "";
          text(c, `${ok ? "+" : ">"} ${s.text}${prog}`, 30, y + 2, 5, ok ? "#6a8a5a" : "#e0d6ee");
          y += 9;
        });
        if (st.status === "ready") {
          text(c, `> ${def.back ?? "Oqsoqolga qayt"}ing`, 30, y + 2, 5, "#ffe14d");
          y += 9;
        }
      }
      y += 6;
    }
    text(c, `Kashfiyotlar: ${me.secrets.length}/?`, 24, 212, 5, "#c9a25a");
    text(c, `Joylar: ${me.landmarks.length}`, 150, 212, 5, "#c9a25a");
    // unvonlar (birinchi g'alabalar) — onlayn ism ostida ham ko'rinadi
    const titles = me.titles.map((t) => TITLE_TEXT[t]).filter(Boolean);
    if (titles.length) text(c, `UNVON: ${titles.join(", ")}`, 24, 203, 5, "#ffb02e");
    this.closeBtn(c, v, 248, 204, v.touch ? "YOPISH" : `[${actionKey(v.keys, "journal")}] YOPISH`);
  }

  private fullMap(c: CanvasRenderingContext2D, v: RealmView) {
    const { sim, me } = v;
    px(c, "rgba(0,0,0,0.85)", 0, 0, VIEW_W, VIEW_H);
    const map = this.exploredMap(v);
    // faqat o'yinchi turgan hudud (vodiy yoki Kul tog'i)
    const a = this.area ?? { x: 0, y: 0, w: sim.map.w, h: sim.map.h, name: sim.region.name };
    const inA = (tx: number, ty: number) =>
      tx >= a.x && ty >= a.y && tx < a.x + a.w && ty < a.y + a.h;
    const s = Math.min((VIEW_H - 30) / a.h, (VIEW_W - 20) / a.w);
    const w = a.w * s,
      h = a.h * s;
    const x0 = Math.round((VIEW_W - w) / 2),
      y0 = 20;
    px(c, "#5c4a6e", x0 - 2, y0 - 2, w + 4, h + 4);
    c.drawImage(map, a.x, a.y, a.w, a.h, x0, y0, w, h);
    text(c, a.name, VIEW_W / 2, 13, 7, "#ffe14d", "center");
    for (const l of sim.region.landmarks)
      if (me.landmarks.includes(l.id) && inA(l.x, l.y))
        text(c, l.name, x0 + (l.x - a.x) * s, y0 + (l.y - a.y) * s, 4, "#ffffff", "center");
    for (const n of sim.region.npcs)
      if (sim.isExplored(me, n.x, n.y) && inA(n.x, n.y))
        px(c, "#ffe14d", x0 + (n.x - a.x) * s - 1, y0 + (n.y - a.y) * s - 1, 3, 3);
    if (Math.floor(v.time * 3) % 2)
      px(
        c,
        "#ff4d6d",
        x0 + (me.p.x / TILE - a.x) * s - 2,
        y0 + (me.p.y / TILE - a.y) * s - 2,
        4,
        4,
      );
    v.buttons.push({ x: 0, y: 0, w: VIEW_W, h: VIEW_H, act: () => v.act.panel("none") });
  }

  private pause(c: CanvasRenderingContext2D, v: RealmView) {
    px(c, "rgba(0,0,0,0.6)", 0, 0, VIEW_W, VIEW_H);
    panel(c, 80, 48, 160, 160, "#5c4a6e");
    text(c, "PAUZA", VIEW_W / 2, 70, 8, "#ffe14d", "center");
    const btn = (label: string, y: number, act: () => void) => {
      px(c, "#5c4a6e", 100, y, 120, 18);
      px(c, "#2b1c3e", 101, y + 1, 118, 16);
      text(c, label, VIEW_W / 2, y + 12, 6, "#e0d6ee", "center");
      v.buttons.push({ x: 100, y, w: 120, h: 18, act });
    };
    btn("DAVOM ETISH", 82, () => v.act.panel("none"));
    btn("SOZLAMALAR", 104, () => v.act.settings());
    btn("DO'STNI CHAQIRISH", 126, () => v.act.invite());
    btn("BOSH MENYU", 148, () => v.act.exit());
    text(
      c,
      v.net.mode === "online" ? "Onlayn olam to'xtamaydi" : "Olam saqlanadi",
      VIEW_W / 2,
      190,
      5,
      "#8a7a9a",
      "center",
    );
  }

  /** DO'STNI CHAQIRISH: xona kodi, havola, nusxalash/ulashish; oflayn — qayta ulanish */
  private invite(c: CanvasRenderingContext2D, v: RealmView) {
    px(c, "rgba(0,0,0,0.6)", 0, 0, VIEW_W, VIEW_H);
    const x0 = 36,
      w = VIEW_W - 72,
      y0 = 28,
      h = 186;
    panel(c, x0, y0, w, h, "#7be07b");
    text(c, "DO'STNI CHAQIRISH", VIEW_W / 2, y0 + 18, 8, "#7be07b", "center");
    const btn = (label: string, x: number, y: number, bw: number, act: () => void, hot = false) => {
      px(c, hot ? "#7be07b" : "#5c4a6e", x, y, bw, 16);
      px(c, "#2b1c3e", x + 1, y + 1, bw - 2, 14);
      text(c, label, x + bw / 2, y + 11, 5, hot ? "#7be07b" : "#e0d6ee", "center");
      v.buttons.push({ x, y, w: bw, h: 16, act });
    };
    const close = () => btn("YOPISH", VIEW_W / 2 - 30, y0 + h - 24, 60, () => v.act.close());
    const code = v.net.mode === "online" ? v.net.code : null;
    if (!code || !v.link) {
      const lines = v.canConnect
        ? [
            "Do'st bilan o'ynash uchun onlayn bo'lish kerak.",
            v.net.mode === "connecting"
              ? "Serverga ulanmoqda..."
              : "Internetni tekshiring va qayta ulaning.",
          ]
        : ["Bu versiyada onlayn o'yin yo'q."];
      lines
        .flatMap((l) => wrap(l, 40))
        .forEach((l, i) => text(c, l, VIEW_W / 2, y0 + 50 + i * 10, 5, "#e0d6ee", "center"));
      if (v.canConnect && v.net.mode === "offline")
        btn("QAYTA ULANISH", VIEW_W / 2 - 50, y0 + 100, 100, () => v.act.reconnect(), true);
      close();
      return;
    }
    text(c, "XONA KODI", VIEW_W / 2, y0 + 36, 5, "#8a7a9a", "center");
    text(c, code, VIEW_W / 2, y0 + 58, 16, "#ffe14d", "center");
    text(c, `Xonada: ${v.net.n}/${ROOM_CAP}`, VIEW_W / 2, y0 + 72, 5, "#7be07b", "center");
    wrap(
      "Do'stingiz bosh menyuda XONAGA KIRISH ni bosib shu kodni yozsin yoki havolani ochsin.",
      44,
    ).forEach((l, i) => text(c, l, VIEW_W / 2, y0 + 88 + i * 9, 5, "#e0d6ee", "center"));
    text(c, v.link.replace(/^https?:\/\//, ""), VIEW_W / 2, y0 + 116, 4, "#9fd0ef", "center");
    const bw = 112;
    // ulashish bo'lmasa — nusxalash markazda
    const cx = v.share ? VIEW_W / 2 - bw - 3 : VIEW_W / 2 - bw / 2;
    btn("HAVOLANI NUSXALASH", cx, y0 + 126, bw, () => v.act.copy(), !v.share);
    if (v.share)
      btn(
        v.share === "telegram" ? "TELEGRAMDA YUBORISH" : "ULASHISH",
        VIEW_W / 2 + 3,
        y0 + 126,
        bw,
        () => v.act.share(),
        true,
      );
    close();
  }
}

/** Afsonaviy buyum porlashi: sekin aylanuvchi nurlar va miltillovchi yadro (yerda va inventarda). */
export function legendaryRays(c: CanvasRenderingContext2D, x: number, y: number, t: number) {
  c.save();
  c.translate(Math.round(x), Math.round(y));
  c.globalAlpha = 0.5 + 0.25 * Math.sin(t * 4);
  c.fillStyle = "#fff2c0";
  for (let i = 0; i < 8; i++) {
    c.save();
    c.rotate(t * 0.9 + (i * Math.PI) / 4);
    c.fillRect(-1, -(i % 2 ? 12 : 15), 2, i % 2 ? 4 : 6);
    c.restore();
  }
  c.globalAlpha = 0.25 + 0.15 * Math.sin(t * 6);
  c.fillStyle = "#ffb02e";
  c.beginPath();
  c.arc(0, 0, 10, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

function inView(x: number, y: number, camX: number, camY: number, pad = 32) {
  return x > camX - pad && y > camY - pad && x < camX + VIEW_W + pad && y < camY + VIEW_H + pad;
}

/** Boshqa o'yinchi ustida ism, jon chizig'i va chat iborasi */
function playerLabel(
  c: CanvasRenderingContext2D,
  rp: RealmPlayer,
  x: number,
  y: number,
  name: string | null,
  say: string | undefined,
) {
  const p = rp.p;
  let top = y - 20;
  if (name && !p.dead && !p.hidden) {
    // unvon (masalan, "Kul qirolini yenggan") ism ostida
    const title = rp.titles[0] ? TITLE_TEXT[rp.titles[0]] : undefined;
    if (title) {
      text(c, title, x, top, 4, "#ffb02e", "center");
      top -= 6;
    }
    text(c, name, x, top, 4, HERO_THEME[rp.hero].uiText, "center");
    // rol belgisi ism yonida (TANK, JANGCHI, SEHRGAR, UZOQDAN)
    c.font = `4px ${FONT}`;
    const nw = Math.ceil(c.measureText(name).width);
    drawRoleIcon(c, HERO_ROLE[rp.hero], x - nw / 2 - 10, top - 6);
    const w = 16;
    px(c, "#000", x - w / 2 - 1, top + 2, w + 2, 3);
    px(c, "#3b2a3a", x - w / 2, top + 3, w, 1);
    px(c, "#ff4d6d", x - w / 2, top + 3, (w * Math.max(0, p.hp)) / p.maxHp, 1);
    top -= 7;
  }
  if (say) {
    c.font = `5px ${FONT}`;
    const w = Math.ceil(c.measureText(say).width) + 6;
    px(c, "#000", x - w / 2 - 1, top - 9, w + 2, 11);
    px(c, "#f4efe6", x - w / 2, top - 8, w, 9);
    px(c, "#f4efe6", x - 1, top + 1, 2, 2);
    c.font = `5px ${FONT}`;
    c.textAlign = "center";
    c.fillStyle = "#1f1730";
    c.fillText(say, Math.round(x), Math.round(top - 1));
  }
}

function shadow(c: CanvasRenderingContext2D, x: number, y: number, w: number) {
  c.fillStyle = "rgba(0,0,0,0.3)";
  c.fillRect(Math.round(x - w / 2), Math.round(y - 1), Math.round(w), 2);
  c.fillRect(Math.round(x - w / 2 + 2), Math.round(y - 2), Math.round(w - 4), 4);
}

/**
 * Hujum ogohlantirishi. Doira (yerga zarba) — ichidan qizil bo'lib to'lib boradi;
 * chiziq (hamla) — yarim shaffof qizil yo'lak, ichida harakatlanuvchi yo'nalish o'qlari.
 * To'lish darajasi sim'dagi windup vaqtidan (k.t / k.total) olinadi.
 */
export function drawMark(c: CanvasRenderingContext2D, k: Mark, time: number, edgeOnly = false) {
  const prog = Math.max(0, Math.min(1, 1 - k.t / k.total));
  // oxirgi lahzada chekka yorqinroq miltillaydi (oq to'ldirish yo'q)
  const hot = k.t < 0.2 && Math.floor(time * 16) % 2 === 0;
  const edge = hot ? "#ffb0a0" : "#ff4a3a";
  c.save();
  if (edgeOnly) {
    c.globalAlpha = 0.55;
    c.strokeStyle = edge;
    c.lineWidth = 1;
    if (k.kind === "cone") {
      const a = Math.atan2(k.dy, k.dx);
      c.beginPath();
      c.moveTo(k.x, k.y);
      c.arc(k.x, k.y, k.r, a - k.len, a + k.len);
      c.closePath();
      c.stroke();
    } else if (
      k.kind === "circle" ||
      k.kind === "crack" ||
      k.kind === "meteor" ||
      k.kind === "stack"
    ) {
      c.beginPath();
      c.arc(k.x, k.y, k.r - 0.5, 0, Math.PI * 2);
      c.stroke();
    } else {
      c.translate(k.x, k.y);
      c.rotate(Math.atan2(k.dy, k.dx));
      c.strokeRect(0.5, -k.r + 0.5, k.len - 1, k.r * 2 - 1);
    }
    c.restore();
    return;
  }
  if (k.kind === "cone") {
    // olov konusi: boss yo'nalishida yelpig'ich, chetlari qizil, ichi asta to'ladi
    const a = Math.atan2(k.dy, k.dx);
    c.globalAlpha = 0.2;
    c.fillStyle = "#ff3b1a";
    c.beginPath();
    c.moveTo(k.x, k.y);
    c.arc(k.x, k.y, k.r, a - k.len, a + k.len);
    c.closePath();
    c.fill();
    c.globalAlpha = 0.4;
    c.fillStyle = "#ff8a2a";
    c.beginPath();
    c.moveTo(k.x, k.y);
    c.arc(k.x, k.y, k.r * prog, a - k.len, a + k.len);
    c.closePath();
    c.fill();
    c.globalAlpha = 0.95;
    c.strokeStyle = edge;
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(k.x, k.y);
    c.arc(k.x, k.y, k.r, a - k.len, a + k.len);
    c.closePath();
    c.stroke();
  } else if (k.kind === "stack") {
    // KUL BO'RONI: oltin-oq yig'ilish doirasi, ichiga o'qlar — "hamma shu yerga"
    const pulse = 0.5 + 0.5 * Math.sin(time * 10);
    c.globalAlpha = 0.18 + 0.12 * pulse;
    c.fillStyle = "#ffe08a";
    c.beginPath();
    c.arc(k.x, k.y, k.r, 0, Math.PI * 2);
    c.fill();
    c.globalAlpha = 0.9;
    c.strokeStyle = hot ? "#ffffff" : "#ffb02e";
    c.lineWidth = 2;
    c.beginPath();
    c.arc(k.x, k.y, k.r - 1, 0, Math.PI * 2);
    c.stroke();
    c.strokeStyle = "#ffe08a";
    c.lineWidth = 1;
    c.beginPath();
    c.arc(k.x, k.y, k.r * (1 - prog), 0, Math.PI * 2);
    c.stroke();
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + time;
      const r = k.r + 10 - ((time * 20) % 10);
      const ax = k.x + Math.cos(a) * r,
        ay = k.y + Math.sin(a) * r;
      px(c, "#ffe08a", ax - 1, ay - 1, 3, 3);
    }
  } else if (k.kind === "meteor") {
    // meteor: yerda qizil doira, osmondan tushayotgan olov shari (yaqinlashgani sari pastlaydi)
    c.globalAlpha = 0.25;
    c.fillStyle = "#ff3b3b";
    c.beginPath();
    c.arc(k.x, k.y, k.r, 0, Math.PI * 2);
    c.fill();
    c.globalAlpha = 0.45;
    c.fillStyle = "#e01a1a";
    c.beginPath();
    c.arc(k.x, k.y, k.r * prog, 0, Math.PI * 2);
    c.fill();
    c.globalAlpha = 0.95;
    c.strokeStyle = edge;
    c.lineWidth = 1;
    c.beginPath();
    c.arc(k.x, k.y, k.r - 0.5, 0, Math.PI * 2);
    c.stroke();
    const fall = (1 - prog) * 140;
    c.globalAlpha = 1;
    px(c, "#ff5a1a", k.x - 4 + fall * 0.3, k.y - 4 - fall, 8, 8);
    px(c, "#ffd36a", k.x - 2 + fall * 0.3, k.y - 2 - fall, 4, 4);
    px(c, "#ff8a2a", k.x + 4 + fall * 0.3, k.y - 8 - fall, 3, 3);
  } else if (k.kind === "crack") {
    // yer yorilmoqda: markazdan o'sib boruvchi yoriqlar, ichida lava; chetida xavf doirasi
    c.globalAlpha = 0.18 + 0.2 * prog;
    c.fillStyle = "#ff3b3b";
    c.beginPath();
    c.arc(k.x, k.y, k.r, 0, Math.PI * 2);
    c.fill();
    c.globalAlpha = 1;
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3 + (k.owner % 7) * 0.4;
      const len = k.r * (0.25 + 0.75 * prog);
      let x0 = k.x,
        y0 = k.y;
      for (let s = 1; s <= 3; s++) {
        const bend = (s % 2 ? 0.35 : -0.35) * (i % 2 ? 1 : -1);
        const x1 = k.x + (Math.cos(a + bend * 0.3) * (len * s)) / 3,
          y1 = k.y + (Math.sin(a + bend * 0.3) * (len * s)) / 3;
        c.strokeStyle = "#2a0a04";
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(x0, y0);
        c.lineTo(x1, y1);
        c.stroke();
        c.strokeStyle = hot ? "#ffd36a" : "#ff5a1a";
        c.lineWidth = 1;
        c.stroke();
        x0 = x1;
        y0 = y1;
      }
    }
    c.globalAlpha = 0.9;
    c.strokeStyle = edge;
    c.lineWidth = 1;
    c.beginPath();
    c.arc(k.x, k.y, k.r - 0.5, 0, Math.PI * 2);
    c.stroke();
  } else if (k.kind === "circle") {
    c.globalAlpha = 0.2;
    c.fillStyle = "#ff3b3b";
    c.beginPath();
    c.arc(k.x, k.y, k.r, 0, Math.PI * 2);
    c.fill();
    c.globalAlpha = 0.38;
    c.fillStyle = "#e01a1a";
    c.beginPath();
    c.arc(k.x, k.y, k.r * prog, 0, Math.PI * 2);
    c.fill();
    c.globalAlpha = 0.9;
    c.strokeStyle = edge;
    c.lineWidth = 1;
    c.beginPath();
    c.arc(k.x, k.y, k.r - 0.5, 0, Math.PI * 2);
    c.stroke();
  } else {
    c.translate(k.x, k.y);
    c.rotate(Math.atan2(k.dy, k.dx));
    const w = k.r * 2;
    c.globalAlpha = 0.2;
    c.fillStyle = "#ff3b3b";
    c.fillRect(0, -k.r, k.len, w);
    c.globalAlpha = 0.3;
    c.fillStyle = "#e01a1a";
    c.fillRect(0, -k.r, k.len * prog, w);
    c.globalAlpha = 0.85;
    c.fillStyle = edge;
    c.fillRect(0, -k.r, k.len, 1);
    c.fillRect(0, k.r - 1, k.len, 1);
    // yo'nalish o'qlari (">"), oldinga oqadi
    const a = Math.min(k.r - 3, 6);
    c.strokeStyle = "#ffd0c8";
    c.lineWidth = 2;
    for (let d = (time * 50) % 18; d < k.len - a; d += 18) {
      c.globalAlpha = 0.35 + 0.5 * (d / k.len);
      c.beginPath();
      c.moveTo(d, -a);
      c.lineTo(d + a, 0);
      c.lineTo(d, a);
      c.stroke();
    }
  }
  c.restore();
}

/** Olamga kirish matni (telefon): tugma nomlari bilan — qahramon tugmalari ham. */
export function touchIntro(hero: Hero) {
  const l = touchLabels(hero);
  return `Joystik — yurish, ${l.attack.text} — hujum, ${l.dash.text} — qobiliyat, GAPLASH — NPC va narsalar, JURNAL — topshiriqlar, XARITA — xarita.`;
}

/** Olamga kirish matni (kompyuter): qayta belgilangan tugmalar bilan. */
export function keysIntro(k: KeyBinds) {
  const a = (x: Parameters<typeof actionKey>[1]) => actionKey(k, x);
  return `${moveLabel(k)} — yurish, ${a("attack")} — hujum, ${a("dash")} — qobiliyat, ${a("interact")} — gaplashish, ${a("journal")} — jurnal, ${a("map")} — xarita, 1-8 — buyum.`;
}
