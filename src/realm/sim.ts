/**
 * RealmSim — ochiq olam mantiqi. DOM, canvas va Date.now'siz; qat'iy 20 Hz tick.
 * O'yinchi harakatlari buyruq (RealmCommand) bo'lib kiradi, holat va voqealar (RealmEvent) chiqadi.
 * Keyin aynan shu klass serverda ishlaydi: bir xil buyruqlar -> bir xil holat.
 */
import { Player, type Bolt, type PlayerInput } from "@/game/player";
import type { Hero } from "@/game/hero";
import { RealmMap } from "./map";
import { Rng } from "./rng";
import type {
  DialogChoice,
  GameObjectDef,
  ItemDef,
  MobKind,
  RealmData,
  RegionDef,
  SecretDef,
} from "./schema";
import { SOLID, TILE, TILE_IDS, WATER } from "./tiles";
import {
  RING_MAX,
  RING_SPEED,
  RING_W,
  RealmMob,
  damageMob,
  updateMob,
  type Mark,
  type MobCtx,
  type MobEvent,
  type Ring,
} from "./mobs";

export const TICK_RATE = 20;
export const TICK_DT = 1 / TICK_RATE;
/** Kecha-kunduz sikli: 10 daqiqa */
export const DAY_TICKS = 600 * TICK_RATE;
/** Olam ertalabdan boshlanadi */
export const DAY_START = 0.08;
export const INV_SLOTS = 8;
/** Interaktiv narsa shu masofada (oldinga 8px siljigan nuqtadan) */
export const INTERACT_R = 24;
/** Suv ostidagi sandiqni qirg'oqdan izlash masofasi */
export const SUBMERGED_R = 40;
/** Tuman: shu radiusdagi plitkalar o'rganiladi */
export const EXPLORE_R = 9;
export const RESPAWN_TIME = 2.5;
/** Jangdan tashqarida jon tiklanishi */
export const REGEN_DELAY = 8;
export const REGEN_EVERY = 5;
/** Mergan tutun bombasi (asosiy o'yindagidek): radius va davomiylik */
export const SMOKE_R = 30;
export const SMOKE_TIME = 3;

export type RealmCommand =
  | { type: "move"; x: number; y: number }
  | { type: "attack"; down: boolean }
  | { type: "ability"; down: boolean }
  /** Mergan: qayta o'qlash */
  | { type: "reload" }
  /** sichqoncha bilan nishonga burilish (yo'nalish vektori) */
  | { type: "aim"; x: number; y: number }
  | { type: "interact" }
  | { type: "choose"; index: number }
  | { type: "close" }
  | { type: "use"; slot: number }
  | { type: "buy"; item: string }
  | { type: "sell"; slot: number };

export interface PlayerCommand {
  pid: string;
  cmd: RealmCommand;
}

export type RealmUi =
  | { kind: "dialog"; npc: string; node: string }
  | { kind: "shop"; npc: string }
  | { kind: "lore"; secret: string }
  | { kind: "sign"; text: string[]; title?: string };

export type RealmEvent =
  | MobEvent
  | { type: "hit"; x: number; y: number; dmg: number; kind: MobKind | "wall" }
  | { type: "kill"; x: number; y: number; kind: MobKind; pid: string }
  | { type: "pickup"; pid: string; item: string; n: number; x: number; y: number }
  | { type: "gold"; pid: string; n: number; x: number; y: number }
  | { type: "secret"; pid: string; id: string; x: number; y: number }
  | { type: "toast"; pid: string; text: string }
  | { type: "quest"; pid: string; text: string }
  | { type: "landmark"; pid: string; name: string }
  | { type: "torch"; x: number; y: number; lit: boolean }
  | { type: "door"; x: number; y: number }
  | { type: "chest"; x: number; y: number }
  | { type: "star"; x: number; y: number }
  | { type: "respawn"; pid: string }
  | { type: "teleport"; pid: string; fromX: number; fromY: number; x: number; y: number }
  | { type: "rocks"; x: number; y: number; r: number }
  | { type: "heal"; pid: string; x: number; y: number }
  | { type: "shot"; x: number; y: number }
  | { type: "smoke"; x: number; y: number };

export interface Stack {
  item: string;
  n: number;
}

export type QuestStatus = "none" | "active" | "ready" | "done";

export interface QuestProgress {
  status: Exclude<QuestStatus, "none">;
  step: number;
  progress: number;
}

export interface GroundItem {
  id: number;
  x: number;
  y: number;
  item: string | null;
  n: number;
  /** null bo'lsa — oltin */
  gold: number;
  t: number;
}

interface Projectile extends Bolt {
  owner: string;
  life: number;
  hitSet: Set<number>;
}

interface Trap {
  x: number;
  y: number;
  life: number;
}

/** Saqlanadigan o'yinchi holati (realm save). */
export interface RealmPlayerSave {
  hero: Hero;
  x: number;
  y: number;
  hp: number;
  gold: number;
  inv: (Stack | null)[];
  quests: Record<string, QuestProgress>;
  secrets: string[];
  fragments: string[];
  opened: string[];
  torchStep: number;
  landmarks: string[];
  kills: number;
  /** o'rganilgan plitkalar (bitset, base64) */
  explored: string;
  starNight: number;
}

export interface RealmWorldSave {
  tick: number;
  rng: number;
  overrides: [number, number][];
  doors: string[];
  wallHits: Record<string, number>;
}

/** Buyruqlardan Player o'qiydigan boshqaruv (klaviatura o'rniga). */
class CommandInput implements PlayerInput {
  ax = 0;
  ay = 0;
  atkQ = false;
  atkHeld = false;
  dashQ = false;
  dashHeldNow = false;
  reloadQ = false;
  axis() {
    return { x: this.ax, y: this.ay };
  }
  consumeAttack() {
    const a = this.atkQ;
    this.atkQ = false;
    return a;
  }
  consumeDash() {
    const a = this.dashQ;
    this.dashQ = false;
    return a;
  }
  attackHeld() {
    return this.atkHeld;
  }
  dashHeld() {
    return this.dashHeldNow;
  }
  consumeReload() {
    const a = this.reloadQ;
    this.reloadQ = false;
    return a;
  }
}

/** Dialog/do'kon ochiqligida o'yinchi joyida turadi. */
const IDLE_INPUT: PlayerInput = {
  axis: () => ({ x: 0, y: 0 }),
  consumeAttack: () => false,
  consumeDash: () => false,
  attackHeld: () => false,
  dashHeld: () => false,
  consumeReload: () => false,
};

export class RealmPlayer {
  p: Player;
  input = new CommandInput();
  px: number;
  py: number;
  inv: (Stack | null)[] = Array.from({ length: INV_SLOTS }, () => null);
  gold = 0;
  quests: Record<string, QuestProgress> = {};
  secrets: string[] = [];
  fragments: string[] = [];
  opened: string[] = [];
  torchStep = 0;
  landmarks: string[] = [];
  kills = 0;
  ui: RealmUi | null = null;
  explored: Uint8Array;
  lastHurt = -1e9;
  regenT = 0;
  deadT = 0;
  /** tunda yorug'lik radiusi ko'paytuvchisi (Tungi uzuk) */
  light = 1;
  /** qaysi tunda yulduz tushdi (bir tunda bitta) */
  starNight = -1;
  starAt = -1;
  /** hozir turgan belgi (joy nomi bir marta chiqadi) */
  here: string | null = null;
  /** asosiy o'yinda yengilgan bosslar kalitlari (saqlanmaydi — klient asosiy o'yindan beradi) */
  keys: string[] = [];
  base: { maxHp: number; damage: number; speed: number };

  constructor(
    public id: string,
    public hero: Hero,
    x: number,
    y: number,
    tiles: number,
  ) {
    this.p = this.makePlayer(x, y);
    this.base = { maxHp: this.p.maxHp, damage: this.p.damage, speed: this.p.speed };
    this.px = x;
    this.py = y;
    this.explored = new Uint8Array(Math.ceil(tiles / 8));
  }

  makePlayer(x: number, y: number) {
    const p = new Player(this.hero);
    p.x = x;
    p.y = y;
    // xona chegarasi yo'q — to'qnashuvni RealmSim plitkalar bilan hal qiladi
    p.clamp = () => {};
    return p;
  }
}

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

/** Darvoza kalitini beradigan boss */
const GATE_BOSS: Record<"devil" | "queen" | "king", string> = {
  devil: "Iblis (1-dunyo)",
  queen: "Qor Malikasi (2-dunyo)",
  king: "O'rmon Shohi (3-dunyo)",
};

/** Plitka markazi (px) */
export const tileCenter = (t: number) => t * TILE + TILE / 2;

function toB64(bytes: Uint8Array) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromB64(s: string, into: Uint8Array) {
  try {
    const bin = atob(s);
    for (let i = 0; i < bin.length && i < into.length; i++) into[i] = bin.charCodeAt(i);
  } catch {
    /* buzilgan saqlash — tuman qaytadan */
  }
}

export class RealmSim {
  readonly region: RegionDef;
  readonly map: RealmMap;
  tick = 0;
  rng: Rng;
  players = new Map<string, RealmPlayer>();
  mobs: RealmMob[] = [];
  marks: Mark[] = [];
  /** Sardorning yer bo'ylab tarqalayotgan to'lqin halqalari (ustidan dash bilan o'tiladi) */
  rings: Ring[] = [];
  items: GroundItem[] = [];
  projectiles: Projectile[] = [];
  traps: Trap[] = [];
  /** Mergan tutun bombalari: ichidagi moblar sekinlashadi, Mergan ko'rinmaydi */
  smokes: { x: number; y: number; life: number }[] = [];
  /** dunyo o'zgarishlari: buzilgan devor, ochilgan zinapoya (plitka indeksi -> plitka) */
  overrides = new Map<number, number>();
  doors = new Set<string>();
  wallHits: Record<string, number> = {};
  /** plitka o'zgarsa oshadi (chizuvchi chunk keshini yangilaydi) */
  mapVersion = 0;
  /** shu tickdagi voqealar (klient effekt va ovoz chiqaradi) */
  events: RealmEvent[] = [];
  private nextId = 1;
  private zones: { left: number[]; alive: Set<number> }[];
  private wallTokens = new Map<string, object>();
  private objects = new Map<string, GameObjectDef>();
  private lastNight = false;

  constructor(
    public data: RealmData,
    seed = data.region.seed,
  ) {
    this.region = data.region;
    this.map = new RealmMap(this.region);
    this.rng = new Rng(seed);
    for (const o of this.region.objects) this.objects.set(o.id, o);
    this.zones = this.region.mobZones.map(() => ({ left: [], alive: new Set() }));
    this.lastNight = this.night;
    this.region.mobZones.forEach((z, i) => {
      if (!this.zoneActive(z.time)) {
        this.zones[i]!.left = Array.from({ length: z.count }, () => 0);
        return;
      }
      for (let n = 0; n < z.count; n++) this.spawnInZone(i);
    });
  }

  // ---------- vaqt ----------

  /** 0..1: 0 — tong, ~0.3 — tush, 0.6..0.95 — tun */
  get dayTime() {
    return (this.tick / DAY_TICKS + DAY_START) % 1;
  }

  /** 0 — kunduz, 1 — to'liq tun (o'tishlar silliq) */
  get darkness() {
    const t = this.dayTime;
    if (t >= 0.6 && t < 0.95) return 1;
    if (t >= 0.55 && t < 0.6) return (t - 0.55) / 0.05;
    if (t >= 0.95) return 1 - (t - 0.95) / 0.05;
    return 0;
  }

  get night() {
    return this.darkness >= 0.5;
  }

  /** Nechanchi tun (yulduz voqeasi har tunda bir marta) */
  get nightIndex() {
    return Math.floor(this.tick / DAY_TICKS + DAY_START);
  }

  private zoneActive(time: "any" | "day" | "night") {
    return time === "any" || (time === "night") === this.night;
  }

  // ---------- xarita ----------

  tileAt(tx: number, ty: number) {
    return this.overrides.get(ty * this.map.w + tx) ?? this.map.base(tx, ty);
  }

  setTile(tx: number, ty: number, t: number) {
    this.overrides.set(ty * this.map.w + tx, t);
    this.mapVersion++;
  }

  object(id: string) {
    return this.objects.get(id);
  }

  /** Yopiq eshik (tunda ochiladigan) ham devor */
  private doorAt(tx: number, ty: number) {
    for (const o of this.region.objects)
      if (o.type === "door" && o.x === tx && o.y === ty && !this.doors.has(o.id)) return true;
    return false;
  }

  solidAt(tx: number, ty: number) {
    return SOLID[this.tileAt(tx, ty)] === true || this.doorAt(tx, ty);
  }

  /** Tana (markaz, o'lcham) qattiq plitkaga tegadimi. Oyoq qismi muhim — yuqori 2px bosh devorga kirishi mumkin. */
  boxBlocked(x: number, y: number, size: number) {
    const h = size / 2 - 1;
    const x0 = Math.floor((x - h) / TILE),
      x1 = Math.floor((x + h) / TILE);
    const y0 = Math.floor((y - h + 2) / TILE),
      y1 = Math.floor((y + h) / TILE);
    for (let ty = y0; ty <= y1; ty++)
      for (let tx = x0; tx <= x1; tx++) if (this.solidAt(tx, ty)) return true;
    return false;
  }

  /** Bosqichma-bosqich siljitish (teleport devordan o'tib ketmaydi); true — to'siqqa urildi. */
  moveBody(b: { x: number; y: number; size: number; ghost?: boolean }, dx: number, dy: number) {
    if (b.ghost) {
      b.x = Math.max(8, Math.min(this.map.w * TILE - 8, b.x + dx));
      b.y = Math.max(8, Math.min(this.map.h * TILE - 8, b.y + dy));
      return false;
    }
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 4));
    let blocked = false;
    for (let i = 0; i < n; i++) {
      const nx = b.x + dx / n;
      if (!this.boxBlocked(nx, b.y, b.size)) b.x = nx;
      else blocked = true;
      const ny = b.y + dy / n;
      if (!this.boxBlocked(b.x, ny, b.size)) b.y = ny;
      else blocked = true;
    }
    return blocked;
  }

  // ---------- o'yinchilar ----------

  addPlayer(id: string, hero: Hero, save?: RealmPlayerSave | null) {
    const [sx, sy] = this.region.spawn;
    const rp = new RealmPlayer(id, hero, tileCenter(sx), tileCenter(sy), this.map.w * this.map.h);
    if (save) {
      rp.p.x = rp.px = save.x;
      rp.p.y = rp.py = save.y;
      rp.gold = save.gold;
      rp.inv = Array.from({ length: INV_SLOTS }, (_, i) => {
        const s = save.inv[i];
        return s && this.data.items[s.item] ? { item: s.item, n: s.n } : null;
      });
      rp.quests = { ...save.quests };
      rp.secrets = [...save.secrets];
      rp.fragments = [...save.fragments];
      rp.opened = [...save.opened];
      rp.torchStep = save.torchStep;
      rp.landmarks = [...save.landmarks];
      rp.kills = save.kills;
      rp.starNight = save.starNight;
      fromB64(save.explored, rp.explored);
      // devor ichida qolgan bo'lsa — qishloqqa
      if (this.boxBlocked(rp.p.x, rp.p.y, rp.p.size)) {
        rp.p.x = rp.px = tileCenter(sx);
        rp.p.y = rp.py = tileCenter(sy);
      }
    }
    this.applyBonuses(rp);
    if (save) rp.p.hp = Math.max(1, Math.min(rp.p.maxHp, save.hp));
    this.players.set(id, rp);
    this.explore(rp);
    return rp;
  }

  /** O'yinchi xonadan chiqdi: moblar uni quvlashni to'xtatadi, o'qlari so'nadi. */
  removePlayer(id: string) {
    if (!this.players.delete(id)) return;
    for (const m of this.mobs) if (m.target === id) m.target = null;
    this.projectiles = this.projectiles.filter((b) => b.owner !== id);
  }

  savePlayer(id: string): RealmPlayerSave | null {
    const rp = this.players.get(id);
    if (!rp) return null;
    return {
      hero: rp.hero,
      x: Math.round(rp.p.x),
      y: Math.round(rp.p.y),
      hp: rp.p.dead ? rp.p.maxHp : rp.p.hp,
      gold: rp.gold,
      inv: rp.inv.map((s) => (s ? { ...s } : null)),
      quests: JSON.parse(JSON.stringify(rp.quests)) as Record<string, QuestProgress>,
      secrets: [...rp.secrets],
      fragments: [...rp.fragments],
      opened: [...rp.opened],
      torchStep: rp.torchStep,
      landmarks: [...rp.landmarks],
      kills: rp.kills,
      explored: toB64(rp.explored),
      starNight: rp.starNight,
    };
  }

  saveWorld(): RealmWorldSave {
    return {
      tick: this.tick,
      rng: this.rng.s,
      overrides: [...this.overrides.entries()],
      doors: [...this.doors],
      wallHits: { ...this.wallHits },
    };
  }

  loadWorld(w: RealmWorldSave) {
    this.tick = w.tick;
    this.rng.s = w.rng >>> 0;
    this.overrides = new Map(w.overrides);
    this.mapVersion++;
    this.doors = new Set(w.doors);
    this.wallHits = { ...w.wallHits };
    this.lastNight = this.night;
    // vaqtga mos moblar
    this.mobs = [];
    this.region.mobZones.forEach((z, i) => {
      this.zones[i] = { left: [], alive: new Set() };
      if (!this.zoneActive(z.time)) {
        this.zones[i]!.left = Array.from({ length: z.count }, () => 0);
        return;
      }
      for (let n = 0; n < z.count; n++) this.spawnInZone(i);
    });
  }

  /** Inventardagi buyumlarning doimiy kuchlari (har biri bir marta hisoblanadi). */
  applyBonuses(rp: RealmPlayer) {
    const seen = new Set<string>();
    let maxHp = 0,
      damage = 0,
      speed = 0,
      light = 0;
    for (const s of rp.inv) {
      if (!s || seen.has(s.item)) continue;
      seen.add(s.item);
      const b = this.data.items[s.item]?.bonus;
      if (!b) continue;
      maxHp += b.maxHp ?? 0;
      damage += b.damage ?? 0;
      speed += b.speed ?? 0;
      light += b.light ?? 0;
    }
    const p = rp.p;
    p.maxHp = rp.base.maxHp + maxHp;
    p.hp = Math.min(p.hp, p.maxHp);
    p.damage = rp.base.damage + damage;
    p.speed = rp.base.speed + speed;
    rp.light = 1 + light * 0.6;
  }

  /** Inventarga qo'shadi; sig'maganini qaytaradi. */
  addItem(rp: RealmPlayer, item: string, n: number) {
    const def = this.data.items[item];
    if (!def) return n;
    for (const s of rp.inv) {
      if (n <= 0) break;
      if (s && s.item === item && s.n < def.stack) {
        const k = Math.min(n, def.stack - s.n);
        s.n += k;
        n -= k;
      }
    }
    for (let i = 0; i < rp.inv.length && n > 0; i++) {
      if (rp.inv[i]) continue;
      const k = Math.min(n, def.stack);
      rp.inv[i] = { item, n: k };
      n -= k;
    }
    this.applyBonuses(rp);
    return n;
  }

  countItem(rp: RealmPlayer, item: string) {
    return rp.inv.reduce((a, s) => a + (s && s.item === item ? s.n : 0), 0);
  }

  removeItem(rp: RealmPlayer, item: string, n: number) {
    for (let i = 0; i < rp.inv.length && n > 0; i++) {
      const s = rp.inv[i];
      if (!s || s.item !== item) continue;
      const k = Math.min(n, s.n);
      s.n -= k;
      n -= k;
      if (s.n <= 0) rp.inv[i] = null;
    }
    this.applyBonuses(rp);
  }

  /** Buyum yoki oltinni yerga tashlaydi (inventar to'la bo'lsa ham shu yo'l). */
  drop(x: number, y: number, item: string | null, n: number, gold = 0) {
    this.items.push({ id: this.nextId++, x, y, item, n, gold, t: 0 });
  }

  /** Tashqaridan kelgan buyum (asosiy o'yindan "pochta"): inventarga, sig'masa — oyog'i ostiga. */
  grant(rp: RealmPlayer, item: string, n = 1) {
    if (!this.data.items[item]) return;
    this.give(rp, item, n, rp.p.x, rp.p.y);
  }

  /** Belgilangan buyumni olish (sandiq): sig'maganini yerga. */
  private give(rp: RealmPlayer, item: string, n: number, x: number, y: number) {
    const left = this.addItem(rp, item, n);
    if (n - left > 0)
      this.events.push({ type: "pickup", pid: rp.id, item, n: n - left, x: rp.p.x, y: rp.p.y });
    if (left > 0) this.drop(x, y + 10, item, left);
  }

  // ---------- topshiriqlar ----------

  questStatus(rp: RealmPlayer, id: string): QuestStatus {
    return rp.quests[id]?.status ?? "none";
  }

  private questStep(rp: RealmPlayer, id: string) {
    const q = rp.quests[id];
    if (!q || q.status !== "active") return null;
    return this.data.quests[id]?.steps[q.step] ?? null;
  }

  private advance(rp: RealmPlayer, id: string) {
    const q = rp.quests[id];
    const def = this.data.quests[id];
    if (!q || !def) return;
    q.step++;
    q.progress = 0;
    if (q.step >= def.steps.length) {
      q.status = "ready";
      this.events.push({
        type: "quest",
        pid: rp.id,
        text: `${def.name}: ${def.back ?? "oqsoqolga qayt"}`,
      });
    } else {
      const next = def.steps[q.step]!;
      this.events.push({ type: "quest", pid: rp.id, text: next.text });
      // keyingi qadam allaqachon bajarilgan bo'lishi mumkin (masalan, joy topilgan)
      this.checkQuestNow(rp, id);
    }
  }

  /** O'yinchi belgi (joy) doirasi ichidami */
  inLandmark(rp: RealmPlayer, id: string) {
    const l = this.region.landmarks.find((l) => l.id === id);
    return !!l && dist(rp.p, { x: tileCenter(l.x), y: tileCenter(l.y) }) < l.r * TILE;
  }

  private checkQuestNow(rp: RealmPlayer, id: string) {
    const s = this.questStep(rp, id);
    if (s?.type === "find" && this.inLandmark(rp, s.landmark)) this.advance(rp, id);
  }

  startQuest(rp: RealmPlayer, id: string) {
    const def = this.data.quests[id];
    if (!def || rp.quests[id]) return;
    rp.quests[id] = { status: "active", step: 0, progress: 0 };
    this.events.push({ type: "quest", pid: rp.id, text: `Yangi topshiriq: ${def.name}` });
    this.checkQuestNow(rp, id);
  }

  completeQuest(rp: RealmPlayer, id: string) {
    const q = rp.quests[id];
    const def = this.data.quests[id];
    if (!q || !def || q.status !== "ready") return;
    q.status = "done";
    rp.gold += def.reward.gold;
    if (def.reward.gold)
      this.events.push({ type: "gold", pid: rp.id, n: def.reward.gold, x: rp.p.x, y: rp.p.y });
    for (const l of def.reward.items) this.give(rp, l.item, l.n, rp.p.x, rp.p.y);
    this.events.push({ type: "quest", pid: rp.id, text: `Bajarildi: ${def.name}` });
  }

  private onKillQuest(rp: RealmPlayer, kind: MobKind) {
    for (const id of Object.keys(rp.quests)) {
      const s = this.questStep(rp, id);
      if (s?.type !== "kill" || s.mob !== kind) continue;
      const q = rp.quests[id]!;
      q.progress++;
      if (q.progress >= s.count) this.advance(rp, id);
      else
        this.events.push({
          type: "quest",
          pid: rp.id,
          text: `${s.text}: ${q.progress}/${s.count}`,
        });
    }
  }

  /** NPC bilan gaplashish: "gaplash" va "olib bor" qadamlari shu yerda bajariladi. */
  private onTalk(rp: RealmPlayer, npc: string) {
    for (const id of Object.keys(rp.quests)) {
      const s = this.questStep(rp, id);
      if (!s) continue;
      if (s.type === "talk" && s.npc === npc) this.advance(rp, id);
      else if (s.type === "deliver" && s.npc === npc && this.countItem(rp, s.item) >= s.count) {
        this.removeItem(rp, s.item, s.count);
        this.advance(rp, id);
      }
    }
  }

  /** Shartlarga mos (ko'rinadigan) dialog tanlovlari. */
  visibleChoices(rp: RealmPlayer): DialogChoice[] {
    const ui = rp.ui;
    if (ui?.kind !== "dialog") return [];
    const node = this.data.dialogs[ui.npc]?.nodes[ui.node];
    if (!node) return [];
    return node.choices.filter((c) =>
      [c.if ?? []].flat().every((k) => k.state.includes(this.questStatus(rp, k.quest))),
    );
  }

  private choose(rp: RealmPlayer, index: number) {
    const ui = rp.ui;
    if (ui?.kind !== "dialog") return;
    const c = this.visibleChoices(rp)[index];
    if (!c) return;
    let shop = false;
    for (const a of c.do) {
      if ("startQuest" in a) this.startQuest(rp, a.startQuest);
      else if ("completeQuest" in a) this.completeQuest(rp, a.completeQuest);
      else if ("shop" in a) shop = true;
    }
    if (shop) rp.ui = { kind: "shop", npc: ui.npc };
    else if (c.next) rp.ui = { kind: "dialog", npc: ui.npc, node: c.next };
    else rp.ui = null;
  }

  // ---------- savdo ----------

  shopList(npc: string) {
    return this.data.shops[npc] ?? [];
  }

  private buy(rp: RealmPlayer, item: string) {
    if (rp.ui?.kind !== "shop" || !this.shopList(rp.ui.npc).includes(item)) return;
    const def = this.data.items[item];
    if (!def || def.price === undefined || rp.gold < def.price) {
      this.events.push({ type: "toast", pid: rp.id, text: "Oltin yetmaydi" });
      return;
    }
    if (this.addItem(rp, item, 1) > 0) {
      this.events.push({ type: "toast", pid: rp.id, text: "Inventar to'la" });
      return;
    }
    rp.gold -= def.price;
    this.events.push({ type: "pickup", pid: rp.id, item, n: 1, x: rp.p.x, y: rp.p.y });
  }

  private sell(rp: RealmPlayer, slot: number) {
    if (rp.ui?.kind !== "shop") return;
    const s = rp.inv[slot];
    if (!s) return;
    const def = this.data.items[s.item];
    if (!def) return;
    rp.gold += def.sell;
    this.events.push({ type: "gold", pid: rp.id, n: def.sell, x: rp.p.x, y: rp.p.y });
    this.removeItem(rp, s.item, 1);
  }

  private use(rp: RealmPlayer, slot: number) {
    const s = rp.inv[slot];
    if (!s || rp.p.dead) return;
    const def: ItemDef | undefined = this.data.items[s.item];
    if (!def) return;
    if (def.heal) {
      if (rp.p.hp >= rp.p.maxHp) {
        this.events.push({ type: "toast", pid: rp.id, text: "Jon to'la" });
        return;
      }
      rp.p.heal(def.heal);
      this.removeItem(rp, s.item, 1);
      this.events.push({ type: "heal", pid: rp.id, x: rp.p.x, y: rp.p.y });
    } else if (def.bonus) this.events.push({ type: "toast", pid: rp.id, text: def.desc });
    else this.events.push({ type: "toast", pid: rp.id, text: "Savdogarga sotsa bo'ladi" });
  }

  // ---------- sirlar ----------

  private secret<T extends SecretDef["type"]>(type: T) {
    return this.region.secrets.filter((s): s is Extract<SecretDef, { type: T }> => s.type === type);
  }

  private discover(rp: RealmPlayer, id: string, x: number, y: number) {
    if (rp.secrets.includes(id)) return;
    rp.secrets.push(id);
    this.events.push({ type: "secret", pid: rp.id, id, x, y });
  }

  /** Obyekt shu o'yinchiga ko'rinadimi (yashirin sandiq sir ochilgach chiqadi). */
  visible(rp: RealmPlayer, o: GameObjectDef) {
    if (o.type === "fragment") return !rp.fragments.includes(o.id);
    if (o.type === "chest") {
      if (o.submerged) return rp.opened.includes(o.id);
      if (o.hidden)
        return this.secret("torches").some(
          (s) => s.reveal.includes(o.id) && rp.secrets.includes(s.id),
        );
    }
    return true;
  }

  torchLit(rp: RealmPlayer, id: string) {
    for (const s of this.secret("torches")) {
      const i = s.order.indexOf(id);
      if (i < 0) continue;
      return rp.secrets.includes(s.id) || i < rp.torchStep;
    }
    return false;
  }

  doorOpen(id: string) {
    return this.doors.has(id);
  }

  private hitWall(rp: RealmPlayer, s: Extract<SecretDef, { type: "breakwall" }>) {
    if (this.tileAt(s.x, s.y) !== TILE_IDS.cracked) return;
    const n = (this.wallHits[s.id] ?? 0) + 1;
    this.wallHits[s.id] = n;
    const x = tileCenter(s.x),
      y = tileCenter(s.y);
    this.events.push({ type: "hit", x, y, dmg: 0, kind: "wall" });
    if (n >= s.hits) {
      this.setTile(s.x, s.y, TILE_IDS.rubble);
      this.discover(rp, s.id, x, y);
    }
  }

  private wallToken(id: string) {
    let t = this.wallTokens.get(id);
    if (!t) {
      t = {};
      this.wallTokens.set(id, t);
    }
    return t;
  }

  // ---------- interaktiv narsalar ----------

  /** O'yinchi oldidagi eng yaqin interaktiv narsa (yashirinlari ko'rsatilmaydi). */
  interactTarget(rp: RealmPlayer) {
    const p = rp.p;
    const fx = p.x + p.fx * 8,
      fy = p.y + p.fy * 8;
    let best: { kind: "npc" | "object"; id: string; x: number; y: number; d: number } | null = null;
    const consider = (kind: "npc" | "object", id: string, x: number, y: number, r: number) => {
      const d = Math.hypot(fx - x, fy - y);
      if (d < r && (!best || d < best.d)) best = { kind, id, x, y, d };
    };
    for (const n of this.region.npcs)
      consider("npc", n.id, tileCenter(n.x), tileCenter(n.y), INTERACT_R);
    for (const o of this.region.objects) {
      if (o.type === "lamp" || !this.visible(rp, o)) continue;
      if (o.type === "chest" && rp.opened.includes(o.id)) continue;
      if (o.type === "door" && this.doors.has(o.id)) continue;
      if (o.type === "torch" && this.torchLit(rp, o.id)) continue;
      consider("object", o.id, tileCenter(o.x), tileCenter(o.y), INTERACT_R);
    }
    return best as { kind: "npc" | "object"; id: string; x: number; y: number } | null;
  }

  private interact(rp: RealmPlayer) {
    const t = this.interactTarget(rp);
    if (!t) {
      // daryo ostidagi sandiq: hech narsa ko'rinmaydi, lekin qirg'oqdan izlasa bo'ladi
      for (const s of this.secret("riverchest")) {
        const o = this.object(s.chest);
        if (!o || o.type !== "chest" || rp.opened.includes(o.id)) continue;
        const x = tileCenter(o.x),
          y = tileCenter(o.y);
        if (dist(rp.p, { x, y }) < SUBMERGED_R) {
          this.discover(rp, s.id, x, y);
          this.openChest(rp, o);
          this.events.push({ type: "toast", pid: rp.id, text: "Suv ostidan sandiq chiqdi!" });
          return;
        }
      }
      return;
    }
    if (t.kind === "npc") {
      const npc = this.region.npcs.find((n) => n.id === t.id)!;
      this.onTalk(rp, npc.id);
      const d = this.data.dialogs[npc.dialog];
      if (d) rp.ui = { kind: "dialog", npc: npc.id, node: d.heroStart?.[rp.hero] ?? d.start };
      return;
    }
    const o = this.object(t.id);
    if (!o) return;
    switch (o.type) {
      case "sign":
        rp.ui = { kind: "sign", text: o.text };
        return;
      case "gate":
        rp.ui = {
          kind: "sign",
          title: o.name,
          text: rp.keys.includes(o.key)
            ? [
                "Kalit qulfga mos keldi. Darvoza ortidan tanish dunyo shamoli esadi.",
                "TEZ ORADA: bu yo'l keyingi yangilanishda ochiladi.",
              ]
            : [
                "Darvoza qulflangan.",
                `Kalitni ${GATE_BOSS[o.key]} beradi — uni asosiy o'yinda yeng.`,
              ],
        };
        return;
      case "chest":
        this.openChest(rp, o);
        return;
      case "fragment":
        return this.takeFragment(rp, o.id);
      case "torch":
        return this.lightTorch(rp, o.id);
      case "door":
        if (o.night && !this.night) {
          this.events.push({
            type: "toast",
            pid: rp.id,
            text: "Eshik qimirlamaydi. Ustida oy belgisi o'yilgan.",
          });
          return;
        }
        this.doors.add(o.id);
        this.events.push({ type: "door", x: tileCenter(o.x), y: tileCenter(o.y) });
        for (const s of this.secret("nightdoor"))
          if (s.door === o.id) this.discover(rp, s.id, tileCenter(o.x), tileCenter(o.y));
        return;
    }
  }

  private openChest(rp: RealmPlayer, o: Extract<GameObjectDef, { type: "chest" }>) {
    if (rp.opened.includes(o.id)) return;
    rp.opened.push(o.id);
    const x = tileCenter(o.x),
      y = tileCenter(o.y);
    this.events.push({ type: "chest", x, y });
    if (o.gold) {
      rp.gold += o.gold;
      this.events.push({ type: "gold", pid: rp.id, n: o.gold, x, y });
    }
    for (const l of o.loot) this.give(rp, l.item, l.n, x, y);
  }

  private takeFragment(rp: RealmPlayer, id: string) {
    if (rp.fragments.includes(id)) return;
    rp.fragments.push(id);
    const o = this.object(id)!;
    for (const s of this.secret("tablet")) {
      if (!s.fragments.includes(id)) continue;
      const have = s.fragments.filter((f) => rp.fragments.includes(f)).length;
      this.events.push({
        type: "toast",
        pid: rp.id,
        text: `Qadimiy tosh yozuv bo'lagi (${have}/${s.fragments.length})`,
      });
      if (have === s.fragments.length) {
        this.discover(rp, s.id, tileCenter(o.x), tileCenter(o.y));
        rp.ui = { kind: "lore", secret: s.id };
      }
    }
  }

  private lightTorch(rp: RealmPlayer, id: string) {
    for (const s of this.secret("torches")) {
      if (!s.order.includes(id) || rp.secrets.includes(s.id)) continue;
      const o = this.object(id)!;
      if (s.order[rp.torchStep] === id) {
        rp.torchStep++;
        this.events.push({ type: "torch", x: tileCenter(o.x), y: tileCenter(o.y), lit: true });
        if (rp.torchStep >= s.order.length) {
          for (const t of s.tiles) this.setTile(t.x, t.y, TILE_IDS[t.tile]);
          this.discover(rp, s.id, tileCenter(o.x), tileCenter(o.y));
          this.events.push({
            type: "toast",
            pid: rp.id,
            text: "Tosh siljib, yashirin joy ochildi!",
          });
        }
      } else {
        // noto'g'ri tartib — hammasi o'chadi
        rp.torchStep = 0;
        this.events.push({ type: "torch", x: tileCenter(o.x), y: tileCenter(o.y), lit: false });
        this.events.push({ type: "toast", pid: rp.id, text: "Mash'alalar o'chib qoldi..." });
      }
    }
  }

  // ---------- moblar ----------

  private spawnInZone(zi: number) {
    const z = this.region.mobZones[zi]!;
    // zonadagi mob soni (o'layotgan jasad ham) chegaradan oshmaydi: yagona Sardor eski jasadi
    // yo'qolmaguncha qayta tug'ilmaydi — bir vaqtda ikkita Sardor bo'lmaydi
    if (this.mobs.filter((m) => m.zone === z.id).length >= z.count) return false;
    let x = tileCenter(z.x),
      y = tileCenter(z.y);
    const size = z.mob === "warden" ? 28 : 16;
    for (let i = 0; i < 12 && z.r > 0; i++) {
      const a = this.rng.next() * Math.PI * 2,
        r = this.rng.next() * z.r * TILE;
      const nx = tileCenter(z.x) + Math.cos(a) * r,
        ny = tileCenter(z.y) + Math.sin(a) * r;
      if (z.mob === "wisp" || !this.boxBlocked(nx, ny, size)) {
        x = nx;
        y = ny;
        break;
      }
    }
    // o'yinchining ko'z oldida paydo bo'lmaydi
    for (const rp of this.players.values()) if (dist(rp.p, { x, y }) < 70) return false;
    const m = new RealmMob(this.nextId++, z.mob, x, y, z.id, tileCenter(z.x), tileCenter(z.y));
    m.t = this.rng.range(0.5, 3);
    this.mobs.push(m);
    this.zones[zi]!.alive.add(m.id);
    return true;
  }

  private updateZones() {
    const night = this.night;
    const turned = night !== this.lastNight;
    this.lastNight = night;
    this.region.mobZones.forEach((z, zi) => {
      const zs = this.zones[zi]!;
      if (turned && !this.zoneActive(z.time)) {
        // vaqti o'tdi: jangda bo'lmaganlar yo'qoladi (ertaga/kechasi qaytadi)
        this.mobs = this.mobs.filter((m) => {
          if (m.zone !== z.id || m.target || m.dead) return true;
          if (m.kind === "wisp") return true; // ruh o'zi so'nadi
          zs.alive.delete(m.id);
          zs.left.push(0);
          return false;
        });
      }
      for (let i = 0; i < zs.left.length; i++) zs.left[i]! -= TICK_DT;
      if (!this.zoneActive(z.time)) return;
      const ready = zs.left.findIndex((t) => t <= 0);
      if (ready >= 0 && zs.alive.size < z.count && this.spawnInZone(zi)) zs.left.splice(ready, 1);
    });
  }

  private killMob(m: RealmMob, rp: RealmPlayer | null) {
    const zi = this.region.mobZones.findIndex((z) => z.id === m.zone);
    const z = this.region.mobZones[zi];
    if (z) {
      this.zones[zi]!.alive.delete(m.id);
      this.zones[zi]!.left.push(z.respawn);
    }
    if (!rp) return;
    if (m.kind === "warden") return this.wardenLoot(m, rp);
    rp.kills++;
    this.events.push({ type: "kill", x: m.x, y: m.y, kind: m.kind, pid: rp.id });
    const d = this.data.drops[m.kind];
    if (d) {
      const g = d.gold[0] + this.rng.int(d.gold[1] - d.gold[0] + 1);
      if (g > 0) this.drop(m.x + this.rng.range(-6, 6), m.y + this.rng.range(-4, 4), null, 0, g);
      for (const l of d.items)
        if (this.rng.next() < l.chance)
          this.drop(m.x + this.rng.range(-8, 8), m.y + this.rng.range(-6, 6), l.item, 1);
    }
    this.onKillQuest(rp, m.kind);
  }

  /**
   * Sardor luti har o'yinchiga alohida: jangda zarar bergan har kimga o'z oltini va buyumlari
   * to'g'ridan-to'g'ri (sig'masa — oyog'i ostiga), topshiriq hisobi ham har biriga.
   */
  private wardenLoot(m: RealmMob, killer: RealmPlayer) {
    const d = this.data.drops[m.kind];
    const ids = new Set([...m.hitters, killer.id]);
    for (const id of ids) {
      const rp = this.players.get(id);
      if (!rp) continue;
      rp.kills++;
      this.events.push({ type: "kill", x: m.x, y: m.y, kind: m.kind, pid: rp.id });
      if (d) {
        const g = d.gold[0] + this.rng.int(d.gold[1] - d.gold[0] + 1);
        if (g > 0) {
          rp.gold += g;
          this.events.push({ type: "gold", pid: rp.id, n: g, x: m.x, y: m.y });
        }
        for (const l of d.items) if (this.rng.next() < l.chance) this.give(rp, l.item, 1, m.x, m.y);
      }
      this.onKillQuest(rp, m.kind);
    }
    m.hitters.clear();
  }

  private hit(rp: RealmPlayer, m: RealmMob, dmg: number, knock: number) {
    if (m.dead || m.spawnT > 0.3) return false;
    const evading = m.evading;
    if (m.kind === "warden") m.hitters.add(rp.id);
    const killed = damageMob(m, dmg, rp.p.x, rp.p.y, knock, this);
    if (!evading) this.events.push({ type: "hit", x: m.x, y: m.y - 6, dmg, kind: m.kind });
    if (!m.target && !m.evading && !m.dead) m.target = rp.id;
    if (killed) this.killMob(m, rp);
    return true;
  }

  event(e: MobEvent) {
    this.events.push(e);
  }

  // ---------- asosiy tick ----------

  /** Bitta qat'iy tick (1/20 s). Buyruqlar shu tick boshida qo'llanadi. */
  step(commands: readonly PlayerCommand[] = []) {
    this.tick++;
    this.events = [];
    const dt = TICK_DT;
    for (const rp of this.players.values()) {
      rp.px = rp.p.x;
      rp.py = rp.p.y;
    }
    for (const m of this.mobs) {
      m.px = m.x;
      m.py = m.y;
    }
    for (const c of commands) {
      const rp = this.players.get(c.pid);
      if (rp) this.command(rp, c.cmd);
    }

    for (const rp of this.players.values()) this.updatePlayer(rp, dt);
    this.updateMobs(dt);
    this.updateProjectiles(dt);
    this.updateTraps(dt);
    this.updateSmokes(dt);
    this.updateMarks(dt);
    this.updateRings(dt);
    this.updateItems(dt);
    this.updateZones();
    for (const rp of this.players.values()) this.updateWorldFor(rp);
    this.mobs = this.mobs.filter((m) => !(m.dead && m.deathT > 1));
  }

  /** Buyruqni o'yinchiga qo'llash (step ichida; onlayn klient o'z bashorati uchun ham chaqiradi). */
  command(rp: RealmPlayer, c: RealmCommand) {
    const inp = rp.input;
    switch (c.type) {
      case "move":
        inp.ax = Math.max(-1, Math.min(1, c.x || 0));
        inp.ay = Math.max(-1, Math.min(1, c.y || 0));
        return;
      case "attack":
        if (c.down && !rp.ui) inp.atkQ = true;
        inp.atkHeld = c.down && !rp.ui;
        return;
      case "ability":
        if (c.down && !rp.ui) inp.dashQ = true;
        inp.dashHeldNow = c.down && !rp.ui;
        return;
      case "reload":
        if (!rp.ui) inp.reloadQ = true;
        return;
      case "aim": {
        const p = rp.p;
        if (rp.ui || p.dashing || p.attackTimer > 0 || (!c.x && !c.y)) return;
        if (Math.abs(c.x) >= Math.abs(c.y)) {
          p.fx = Math.sign(c.x);
          p.fy = 0;
        } else {
          p.fx = 0;
          p.fy = Math.sign(c.y);
        }
        return;
      }
      case "interact":
        if (rp.ui?.kind === "sign" || rp.ui?.kind === "lore") rp.ui = null;
        else if (!rp.ui && !rp.p.dead) this.interact(rp);
        return;
      case "choose":
        return this.choose(rp, c.index);
      case "close":
        rp.ui = null;
        return;
      case "use":
        return this.use(rp, c.slot);
      case "buy":
        return this.buy(rp, c.item);
      case "sell":
        return this.sell(rp, c.slot);
    }
  }

  /**
   * O'yinchi harakati: eng yaqin tahdid, Player.update va plitka to'qnashuvi.
   * Onlayn klient o'z qahramonini shu bilan oldindan ko'rsatadi (prediction) — server bilan bir xil kod.
   */
  movePlayer(rp: RealmPlayer, dt: number) {
    const p = rp.p;
    let threat: RealmMob | null = null,
      td = Infinity;
    for (const m of this.mobs) {
      if (m.dead) continue;
      const d = dist(m, p);
      if (d < td) {
        td = d;
        threat = m;
      }
    }
    p.threat = threat ? { x: threat.x, y: threat.y } : null;
    const x0 = p.x,
      y0 = p.y;
    p.update(dt, rp.ui ? IDLE_INPUT : rp.input);
    // to'qnashuv: Player o'z yo'lida yurdi, endi plitkalarga qarab qaytadan siljitamiz
    const dx = p.x - x0,
      dy = p.y - y0;
    p.x = x0;
    p.y = y0;
    if (dx || dy) this.moveBody(p, dx, dy);
  }

  private updatePlayer(rp: RealmPlayer, dt: number) {
    const p = rp.p;
    if (p.dead) {
      p.anim.update(dt);
      rp.deadT += dt;
      if (rp.deadT >= RESPAWN_TIME) this.respawn(rp);
      return;
    }
    const hpBefore = p.hp;
    this.movePlayer(rp, dt);
    if (p.teleportFrom) {
      this.events.push({
        type: "teleport",
        pid: rp.id,
        fromX: p.teleportFrom.x,
        fromY: p.teleportFrom.y,
        x: p.x,
        y: p.y,
      });
      p.teleportFrom = null;
    }
    if (p.cutFree) p.cutFree = false;
    if (p.trapDenied) {
      p.trapDenied = false;
      this.events.push({ type: "toast", pid: rp.id, text: `Tuzoq: ${Math.ceil(p.trapCooldown)}s` });
    }
    for (const t of p.traps) this.traps.push({ x: t.x, y: t.y, life: 20 });
    p.traps = [];
    while (this.traps.length > 2 * this.players.size) this.traps.shift();
    for (const b of p.bolts) {
      this.projectiles.push({ ...b, owner: rp.id, life: 1.2, hitSet: new Set() });
      if (b.bullet) this.events.push({ type: "shot", x: b.x, y: b.y });
    }
    p.bolts = [];
    // Mergan: tutun bombasi; tutundan chiqsa yana ko'rinadi
    for (const s of p.smokes) {
      this.smokes.push({ x: s.x, y: s.y, life: SMOKE_TIME });
      this.events.push({ type: "smoke", x: s.x, y: s.y });
    }
    p.smokes = [];
    if (p.smokeDenied) {
      p.smokeDenied = false;
      this.events.push({
        type: "toast",
        pid: rp.id,
        text: `Tutun: ${Math.ceil(p.smokeCooldown)}s`,
      });
    }
    if (p.hidden && !this.inSmoke(p)) p.hideT = 0;

    // yaqin jang: zarba qutisi moblarga va yoriq devorga
    const box = p.attackBox();
    if (box) {
      for (const m of this.mobs) {
        if (m.dead || p.hitSet.has(m)) continue;
        const s = (box.size + m.size) / 2;
        if (Math.abs(box.x - m.x) < s && Math.abs(box.y - m.y) < s) {
          p.hitSet.add(m);
          this.hit(rp, m, p.hitDamage, p.spinning ? 200 : 140);
        }
      }
      for (const w of this.secret("breakwall")) {
        const tok = this.wallToken(w.id);
        if (p.hitSet.has(tok)) continue;
        const cx = tileCenter(w.x),
          cy = tileCenter(w.y);
        const s = (box.size + TILE) / 2;
        if (Math.abs(box.x - cx) < s && Math.abs(box.y - cy) < s) {
          p.hitSet.add(tok);
          this.hitWall(rp, w);
        }
      }
    }
    if (p.hp < hpBefore) rp.lastHurt = this.tick;
    // jangdan tashqarida sekin tiklanish
    if (this.tick - rp.lastHurt > REGEN_DELAY * TICK_RATE && p.hp < p.maxHp) {
      rp.regenT += dt;
      if (rp.regenT >= REGEN_EVERY) {
        rp.regenT = 0;
        p.heal(1);
        this.events.push({ type: "heal", pid: rp.id, x: p.x, y: p.y });
      }
    } else rp.regenT = 0;
  }

  private respawn(rp: RealmPlayer) {
    const [sx, sy] = this.region.spawn;
    const old = rp.p;
    rp.p = rp.makePlayer(tileCenter(sx), tileCenter(sy));
    rp.p.fx = old.fx;
    rp.p.fy = old.fy;
    rp.base = { maxHp: rp.p.maxHp, damage: rp.p.damage, speed: rp.p.speed };
    this.applyBonuses(rp);
    rp.p.hp = rp.p.maxHp;
    rp.px = rp.p.x;
    rp.py = rp.p.y;
    rp.deadT = 0;
    rp.ui = null;
    for (const m of this.mobs) if (m.target === rp.id) m.target = null;
    this.events.push({ type: "respawn", pid: rp.id });
  }

  private mobCtx: MobCtx | null = null;

  /** Nuqta biror tutun ichidami (Mergan tutun bombasi) */
  inSmoke(b: { x: number; y: number }) {
    return this.smokes.some((s) => dist(s, b) < SMOKE_R);
  }

  private updateSmokes(dt: number) {
    for (const s of this.smokes) s.life -= dt;
    this.smokes = this.smokes.filter((s) => s.life > 0);
  }

  private updateMobs(dt: number) {
    const targets = [...this.players.values()].map((rp) => ({
      id: rp.id,
      p: rp.p,
      hidden: rp.p.hidden,
    }));
    this.mobCtx ??= {
      rng: this.rng,
      dt,
      night: false,
      players: [],
      // tutun ichidagi mob yarim tezlikda yuradi
      move: (b, dx, dy) => {
        const k = this.smokes.length && this.inSmoke(b) ? 0.5 : 1;
        return this.moveBody(b, dx * k, dy * k);
      },
      mark: (m) => this.marks.push(m),
      event: (e) => this.events.push(e),
      ring: (x, y) => this.rings.push({ x, y, r: 8, hit: new Set() }),
      summon: (kind, x, y, from) => {
        // Sardor uyg'otgan tosh qo'riqchi: zonasi yo'q (qayta tug'ilmaydi), darhol jangga
        const m = new RealmMob(this.nextId++, kind, x, y, "");
        if (this.boxBlocked(x, y, m.size)) {
          m.x = m.px = m.homeX = from.x;
          m.y = m.py = m.homeY = from.y;
        }
        m.state = "wake";
        m.t = 0.6;
        m.target = from.target;
        this.mobs.push(m);
        this.events.push({ type: "wake", x: m.x, y: m.y, kind });
      },
    };
    const ctx = this.mobCtx;
    ctx.night = this.night;
    ctx.players = targets;
    for (const m of this.mobs) {
      const before = new Map(targets.map((t) => [t.id, t.p.hp]));
      updateMob(m, ctx);
      for (const t of targets)
        if (t.p.hp < (before.get(t.id) ?? 0)) this.players.get(t.id)!.lastHurt = this.tick;
      // so'ngan ruh (kunduz) — lut yo'q, zonasi qayta tug'diradi
      if (m.dead && m.deathT === 0 && m.hp > 0) {
        m.deathT = 1e-6;
        this.killMob(m, null);
      }
    }
    // dash oxirida mob ichida qolsa himoya dumi uzayadi
    for (const rp of this.players.values()) {
      const p = rp.p;
      p.inFoe = this.mobs.some(
        (m) =>
          !m.dead &&
          Math.abs(m.x - p.x) < (m.size + p.size) / 2 &&
          Math.abs(m.y - p.y) < (m.size + p.size) / 2,
      );
    }
  }

  private updateProjectiles(dt: number) {
    this.projectiles = this.projectiles.filter((b) => {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0) return false;
      // Mergan o'qi o'z masofasini uchib bo'lgach so'nadi
      if (b.range !== undefined) {
        b.range -= Math.hypot(b.vx, b.vy) * dt;
        if (b.range <= 0) return false;
      }
      const rp = this.players.get(b.owner);
      const tx = Math.floor(b.x / TILE),
        ty = Math.floor(b.y / TILE);
      const tile = this.tileAt(tx, ty);
      if (SOLID[tile] && !WATER[tile]) {
        if (rp && tile === TILE_IDS.cracked)
          for (const w of this.secret("breakwall"))
            if (w.x === tx && w.y === ty) this.hitWall(rp, w);
        return false;
      }
      if (this.doorAt(tx, ty)) return false;
      if (!rp) return false;
      for (const m of this.mobs) {
        if (m.dead || b.hitSet.has(m.id)) continue;
        const s = (b.size + m.size) / 2;
        if (Math.abs(b.x - m.x) < s && Math.abs(b.y - m.y) < s) {
          b.hitSet.add(m.id);
          this.hit(rp, m, rp.p.damage * (b.power ?? 1), 120);
          if (--b.left <= 0) return false;
        }
      }
      return true;
    });
  }

  private updateTraps(dt: number) {
    this.traps = this.traps.filter((t) => {
      t.life -= dt;
      if (t.life <= 0) return false;
      const m = this.mobs.find(
        (m) => !m.dead && !m.ghost && Math.abs(m.x - t.x) < 10 && Math.abs(m.y - t.y) < 10,
      );
      if (m) {
        m.stun = Math.max(m.stun, m.kind === "warden" ? 1 : 2.5);
        this.events.push({ type: "bonk", x: t.x, y: t.y });
        return false;
      }
      return true;
    });
  }

  /** To'lqin halqalari kengayadi; halqa chizig'iga tushgan o'yinchi 1 zarar oladi (dashda — yo'q). */
  private updateRings(dt: number) {
    for (const g of this.rings) {
      g.r += RING_SPEED * dt;
      for (const rp of this.players.values()) {
        const p = rp.p;
        if (p.dead || g.hit.has(rp.id)) continue;
        if (Math.abs(dist(p, g) - g.r) >= RING_W / 2 + p.size / 2) continue;
        if (!p.takeHit(1, g.x, g.y, 150)) continue;
        g.hit.add(rp.id);
        rp.lastHurt = this.tick;
        this.events.push({ type: "mobHurtPlayer", pid: rp.id, x: p.x, y: p.y });
      }
    }
    this.rings = this.rings.filter((g) => g.r < RING_MAX);
  }

  private updateMarks(dt: number) {
    const live = new Map(this.mobs.filter((m) => !m.dead).map((m) => [m.id, m]));
    this.marks = this.marks.filter((k) => {
      const m = live.get(k.owner);
      if (!m) return false;
      if (!k.dmg) {
        // hujum ogohlantirishi: aynan tayyorgarlik (windup) davomida, mob bilan birga siljiydi
        if (m.state !== "windup") return false;
        k.ox ??= k.x - m.x;
        k.oy ??= k.y - m.y;
        k.x = m.x + k.ox;
        k.y = m.y + k.oy;
        k.t = m.t;
        return k.t > 0;
      }
      k.t -= dt;
      if (k.t > 0) return true;
      if (k.dmg) {
        this.events.push({ type: "rocks", x: k.x, y: k.y, r: k.r });
        for (const rp of this.players.values()) {
          const p = rp.p;
          if (!p.dead && dist(p, k) < k.r + p.size / 2 && p.takeHit(k.dmg, k.x, k.y, 160)) {
            rp.lastHurt = this.tick;
            this.events.push({ type: "mobHurtPlayer", pid: rp.id, x: p.x, y: p.y });
          }
        }
      }
      return false;
    });
  }

  private updateItems(dt: number) {
    this.items = this.items.filter((it) => {
      it.t += dt;
      if (it.t > 120) return false;
      if (it.t < 0.4) return true;
      for (const rp of this.players.values()) {
        if (rp.p.dead || dist(rp.p, it) > 12) continue;
        if (it.item === null) {
          rp.gold += it.gold;
          this.events.push({ type: "gold", pid: rp.id, n: it.gold, x: it.x, y: it.y });
          return false;
        }
        const left = this.addItem(rp, it.item, it.n);
        if (left < it.n)
          this.events.push({
            type: "pickup",
            pid: rp.id,
            item: it.item,
            n: it.n - left,
            x: it.x,
            y: it.y,
          });
        it.n = left;
        if (left <= 0) return false;
      }
      return true;
    });
  }

  /** Tuman, joy nomlari, "top" topshiriqlari va tungi yulduz. */
  private updateWorldFor(rp: RealmPlayer) {
    if (this.tick % 2 === 0) this.explore(rp);
    if (this.tick % 5 === 0) {
      // eng kichik (ichki) joy nomi ko'rsatiladi: zal xarobaning ichida
      let here: { id: string; name: string; r: number } | null = null;
      for (const l of this.region.landmarks)
        if (this.inLandmark(rp, l.id) && (!here || l.r < here.r)) here = l;
      if ((here?.id ?? null) !== rp.here) {
        rp.here = here?.id ?? null;
        if (here) {
          this.events.push({ type: "landmark", pid: rp.id, name: here.name });
          if (!rp.landmarks.includes(here.id)) rp.landmarks.push(here.id);
        }
      }
      for (const id of Object.keys(rp.quests)) this.checkQuestNow(rp, id);
    }
    // tunda bir marta osmondan yulduz tushadi
    const ni = this.nightIndex;
    if (this.night && rp.starNight !== ni && !rp.p.dead) {
      if (rp.starAt < 0) rp.starAt = this.tick + TICK_RATE * this.rng.range(20, 80);
      if (this.tick >= rp.starAt) {
        rp.starAt = -1;
        rp.starNight = ni;
        for (let i = 0; i < 16; i++) {
          const a = this.rng.next() * Math.PI * 2,
            r = this.rng.range(48, 96);
          const x = rp.p.x + Math.cos(a) * r,
            y = rp.p.y + Math.sin(a) * r;
          if (this.boxBlocked(x, y, 10)) continue;
          this.drop(x, y, "star", 1);
          this.events.push({ type: "star", x, y });
          this.events.push({ type: "toast", pid: rp.id, text: "Osmondan yulduz tushdi!" });
          break;
        }
      }
    } else if (!this.night) rp.starAt = -1;
  }

  explore(rp: RealmPlayer) {
    const cx = Math.floor(rp.p.x / TILE),
      cy = Math.floor(rp.p.y / TILE);
    const R = EXPLORE_R;
    for (let y = cy - R; y <= cy + R; y++)
      for (let x = cx - R; x <= cx + R; x++) {
        if (x < 0 || y < 0 || x >= this.map.w || y >= this.map.h) continue;
        if ((x - cx) ** 2 + (y - cy) ** 2 > R * R) continue;
        const i = y * this.map.w + x;
        rp.explored[i >> 3]! |= 1 << (i & 7);
      }
  }

  isExplored(rp: RealmPlayer, tx: number, ty: number) {
    if (tx < 0 || ty < 0 || tx >= this.map.w || ty >= this.map.h) return false;
    const i = ty * this.map.w + tx;
    return ((rp.explored[i >> 3] ?? 0) & (1 << (i & 7))) !== 0;
  }

  /** Determinizm testlari va tarmoq sinxroni uchun ixcham holat. */
  digest() {
    const r = (n: number) => Math.round(n * 1000) / 1000;
    return JSON.stringify({
      tick: this.tick,
      rng: this.rng.s,
      players: [...this.players.values()].map((rp) => ({
        id: rp.id,
        x: r(rp.p.x),
        y: r(rp.p.y),
        hp: rp.p.hp,
        gold: rp.gold,
        inv: rp.inv,
        quests: rp.quests,
        secrets: rp.secrets,
      })),
      mobs: this.mobs.map((m) => [m.id, m.kind, r(m.x), r(m.y), m.hp, m.state]),
      items: this.items.map((i) => [i.item, i.n, i.gold, r(i.x), r(i.y)]),
      overrides: [...this.overrides],
    });
  }
}
