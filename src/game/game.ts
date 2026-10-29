import { ROOM, applyHit, clampToRoom, overlap, px, separate, type Body } from "./animation";
import { Input } from "./input";
import { Player } from "./player";
import { Enemy, GOLEM_SPLIT, ICEBLOB_CHILL, OWL_ALT, type EnemyKind } from "./enemy";
import {
  Boss,
  ForestKing,
  KING_HP,
  KING_LIGHT,
  Queen,
  QUEEN_HP,
  WIND_PUSH,
  spiderSummonCount,
  summonCount,
} from "./boss";
import { GAME_VERSION } from "./version";
import { sfx } from "./audio";
import { loadSettings } from "./settings";
import { Effects } from "./effects";
import { renderUpgradeIcon } from "./sprites";
import {
  WAVES,
  BOSS_WAVE,
  pickUpgrades,
  isBossWave,
  bossHp,
  endlessNumber,
  waveEnemies,
  waveSpeed,
  waveSpeed2,
  waveSpeed3,
  type World,
  upgradeIcon,
  isChestWave,
  type Upgrade,
} from "./waves";
import { CHARGE_TIME, SPIN_TIME, type Bolt, type Target } from "./player";
import { HERO_THEME, bestKeys, chargeRingColor, hudBarColors, withAlpha, type Hero } from "./hero";
import { loadPlayableHero, playableHero } from "./save";
import { unlockAchievement, type Achievement, type AchievementId } from "./achievements";
import { dailyRandoms, saveDaily } from "./daily";
import { BOSS_GOLD, KILL_GOLD, addGold, applyShop, dropBonus, loadGold, loadShop } from "./shop";
import { recordWorldWin } from "./progress";
import { HORN_ITEM, hornWanted, recordBossKey, sendToRealm } from "./realmLink";

const STORAGE_KEY = "pixel-rpg-attempt";
/** Ritsar rekordlari (Sehrgarniki — hero.ts dagi bestKeys) */
export const BEST_KEY = bestKeys("knight").best;
/** Cheksiz rejim rekordi alohida saqlanadi */
export const ENDLESS_BEST_KEY = bestKeys("knight").endless;
/** Birinchi o'yindagi ko'rsatmalar ko'rsatib bo'lingan */
export const TUTORIAL_KEY = "pixel-rpg-tutorial-done";
/** 1-dunyo yutilgan: xaritada 2-dunyo ochiladi */
export { WORLD1_WON_KEY } from "./progress";
export type Hint = "attack" | "spin" | "dash";
const HINTS: Hint[] = ["attack", "spin", "dash"];
type Phase = "play" | "attempt" | "victory";
type Stage = "fight" | "upgrade";

interface Shot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  /** Kamonchi o'qi (aks holda Boss olov shari) */
  arrow?: boolean;
}
interface Drop {
  x: number;
  y: number;
  life: number;
}
/** O'rgimchak to'ri: yoy bo'lib uchadi (o'yinchi ustidan o'tadi), so'ng yerga tushib WEB_LIFE turadi */
export interface Web {
  x: number;
  y: number;
  vx: number;
  vy: number;
  tx: number;
  ty: number;
  flying: boolean;
  life: number;
  /** Uchish masofasi (yoy balandligi uchun) */
  dist?: number;
}
/** Zaharli bulut (qo'ziqorindan) */
export interface Cloud {
  x: number;
  y: number;
  life: number;
}
export const WEB_RADIUS = 9;
export const WEB_LIFE = 5;
/** To'rga tushgan o'yinchi shuncha yurolmaydi (zarba bilan uziladi) */
export const WEB_SNARE = 1;
export const CLOUD_RADIUS = 28;
export const CLOUD_LIFE = 3;
/** Bulut ichida har shuncha soniyada 1 zarar */
export const CLOUD_TICK = 1;
/** Ovchi tuzog'i: shuncha turadi, tushgan dushman TRAP_STUN qotadi; xonada ko'pi bilan 2 ta */
export const TRAP_LIFE = 20;
export const TRAP_STUN = 2;
export const MAX_TRAPS = 2;
const TRAP_SIZE = 12;
/** Zaharli uch: shuncha soniya, har soniyada 1 zarar */
export const POISON_TIME = 3;
export interface Trap {
  x: number;
  y: number;
  life: number;
  /** Yopilgandan beri o'tgan vaqt (-1 — ochiq) */
  snapT: number;
}
/** Mergan tutun bombasi: shuncha turadi; ichidagi dushmanlar sekinlashadi, Mergan ko'rinmaydi */
export const SMOKE_RADIUS = 30;
export const SMOKE_LIFE = 3;
/** Tutundagi dushman sekinlashuvi (har kadr yangilanadi — tutundan chiqqach shuncha qoladi) */
export const SMOKE_SLOW = 0.25;
export interface Smoke {
  x: number;
  y: number;
  life: number;
}
/** Oltin tanga: terilganda shuncha oltin beradi */
interface Coin extends Drop {
  value: number;
}
/** Xazina sandig'i: 3 marta urilganda ochiladi */
export interface Chest {
  x: number;
  y: number;
  hp: number;
  /** Zarba tekkanda qisqa titrash */
  hitFlash: number;
  /** Ochilgandan beri o'tgan vaqt (-1 — yopiq) */
  openT: number;
}
export const CHEST_CHANCE = 0.35;
export const CHEST_HITS = 3;
const CHEST_SIZE = 14;
/** Sandiq ichidagi mukofotlar */
export const CHEST_GOLD = [8, 15] as const;
export const CHEST_HEART = 0.4;
export const CHEST_CARD = 0.1;

const KILL_POINTS: Record<EnemyKind, number> = {
  blob: 10,
  wisp: 15,
  rammer: 20,
  archer: 20,
  shield: 25,
  frost: 20,
  golem: 35,
  iceblob: 10,
  wolf: 20,
  spider: 15,
  shroom: 20,
  treant: 40,
  owl: 20,
};
const KILL_COLOR: Record<EnemyKind, string> = {
  blob: "#5bc85b",
  wisp: "#8a4fc0",
  rammer: "#d6d9cf",
  archer: "#8a88a3",
  shield: "#5b9fd6",
  frost: "#9fd0ef",
  golem: "#f4f9ff",
  iceblob: "#a3dcf7",
  wolf: "#a7b0bd",
  spider: "#4b3a58",
  shroom: "#a6f08e",
  treant: "#6b4a2a",
  owl: "#c9b8a0",
};

/** Xona bezagi: to'lqinlar oralig'ida pol rangi va bezaklari o'zgaradi. */
interface FloorTheme {
  a: string;
  b: string;
  grout: string;
  wall: string;
  wallDark: string;
  brick: string;
  /** Mox bilan qoplangan plitalar ulushi */
  moss: number;
  /** Qizil (lavali) yoriqlar — Boss xonasi */
  red: boolean;
  /** 2-dunyo: muz plitalar, qorli yoriqlar, sumalaklar, sovuq kristallar */
  ice?: boolean;
  /** 3-dunyo: o'rmon tuprog'i, ildizlar, qo'ziqorinlar, devorda daraxt tanalari */
  forest?: boolean;
}
const STONE_WALLS = { wall: "#5c4a6e", wallDark: "#4a3b59", brick: "#6e5a82" };
const FLOORS: FloorTheme[] = [
  { a: "#3a2f4a", b: "#342a43", grout: "#2c2339", ...STONE_WALLS, moss: 0, red: false },
  { a: "#3e3047", b: "#382a40", grout: "#2f2337", ...STONE_WALLS, moss: 0, red: false },
  { a: "#34344b", b: "#2f2f44", grout: "#272739", ...STONE_WALLS, moss: 0, red: false },
  {
    a: "#333a40",
    b: "#2e343a",
    grout: "#262b31",
    wall: "#4f5a56",
    wallDark: "#404a47",
    brick: "#5f6d66",
    moss: 0.28,
    red: false,
  },
];
const BOSS_FLOOR: FloorTheme = {
  a: "#3a2830",
  b: "#34232b",
  grout: "#2a1b22",
  wall: "#5e3a44",
  wallDark: "#4a2c36",
  brick: "#734552",
  moss: 0,
  red: true,
};
const ICE_WALLS = { wall: "#5d7590", wallDark: "#465b73", brick: "#7a93ad" };
const ICE_FLOOR: FloorTheme = {
  a: "#9fb1c0",
  b: "#97a9b8",
  grout: "#7c90a2",
  ...ICE_WALLS,
  moss: 0,
  red: false,
  ice: true,
};
/** Qor Malikasi xonasi: biroz to'qroq muz, polda ko'k yoriqlar */
const ICE_BOSS_FLOOR: FloorTheme = { ...ICE_FLOOR, a: "#8ea2b4", b: "#879bad", grout: "#6f8499" };
/** 3-dunyo: Zulmat o'rmoni — to'q yashil-qora tuproq, devorlarda daraxt tanalari */
const FOREST_FLOOR: FloorTheme = {
  a: "#1b2418",
  b: "#1b2418",
  grout: "#151d13",
  wall: "#2a1d12",
  wallDark: "#20160d",
  brick: "#3a2817",
  moss: 0,
  red: false,
  forest: true,
};
/** O'rmon Shohi xonasi: to'qroq, polda nurli ildizlar */
const FOREST_BOSS_FLOOR: FloorTheme = { ...FOREST_FLOOR, a: "#161e15", b: "#161e15" };
/** Pol variantlari: -1 Iblis xonasi, -2 muz, -3 Malika xonasi, -4 o'rmon, -5 Shoh xonasi */
const FLOOR_ICE = -2;
const FLOOR_ICE_BOSS = -3;
const FLOOR_FOREST = -4;
const FLOOR_FOREST_BOSS = -5;
const BOSS_POINTS = 300;
const QUEEN_POINTS = 500;
const QUEEN_GOLD = 40;
const KING_POINTS = 700;
const KING_GOLD = 50;
/** Har dunyo nomi (to'lqin bannerida) va Bossi */
const WORLD_TITLES: Record<World, string> = {
  1: "1-DUNYO: OLOVLI ZINDON",
  2: "2-DUNYO: MUZ SARDOBASI",
  3: "3-DUNYO: ZULMAT O'RMONI",
};
const WORLD_COLORS: Record<World, string> = { 1: "#ffcc33", 2: "#9fd0ef", 3: "#a6f08e" };
/** Muz qalqoni ta'siri */
const FROST_RADIUS = 56;
const FROST_TIME = 1.5;
const COMBO_TIME = 2.5;
const DROP_CHANCE = 0.15;
const COIN_LIFE = 12;
const TOTAL_WAVES = WAVES.length;

function load(key: string) {
  try {
    return Number(localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
}
function save(key: string, v: number) {
  try {
    localStorage.setItem(key, String(v));
  } catch {
    /* saqlash imkonsiz */
  }
}

/** O'yin oxiridagi statistika hisoblagichlari */
export interface RunStats {
  waves: number;
  kills: number;
  maxCombo: number;
  gold: number;
  chests: number;
  /** soniya, pauzasiz */
  time: number;
}
function newStats(): RunStats {
  return { waves: 0, kills: 0, maxCombo: 0, gold: 0, chests: 0, time: 0 };
}

/** 2-dunyo boshidagi kuchlar: o'lganda 2-dunyo shu holatdan qayta boshlanadi. */
const POWER_KEYS = [
  "hp",
  "maxHp",
  "speed",
  "damage",
  "reach",
  "attackCd",
  "dashCd",
  "lifesteal",
  "dashMax",
  "thorns",
  "boltSpeed",
  "boltSize",
  "multishot",
  "pierce",
  "frost",
] as const;
type Powers = Pick<Player, (typeof POWER_KEYS)[number]>;
function savePowers(p: Player): Powers {
  return Object.fromEntries(POWER_KEYS.map((k) => [k, p[k]])) as Powers;
}

/** Butun o'yin holati shu obyektda — React state'da emas. */
export class Game {
  input = new Input();
  player = new Player();
  enemies: Enemy[] = [];
  boss: Boss | null = null;
  shots: Shot[] = [];
  /** Sehrgarning uchib ketayotgan sharlari */
  bolts: Bolt[] = [];
  /** 3-dunyo: o'rgimchak to'rlari va zaharli bulutlar */
  webs: Web[] = [];
  clouds: Cloud[] = [];
  /** Ovchi tuzoqlari */
  traps: Trap[] = [];
  /** Mergan tutun bombalari va yashiringan joyi (dushmanlar shu nuqtani nishonga oladi) */
  smokes: Smoke[] = [];
  hideAt: { x: number; y: number } | null = null;
  /** O'rmon Shohi g'azabidagi qorong'ilik (0..1, asta kuchayadi) */
  darkness = 0;
  drops: Drop[] = [];
  coins: Coin[] = [];
  chest: Chest | null = null;
  /** Shu o'yinda ochilgan sandiqlar (Xazinachi yutug'i) */
  chestsOpened = 0;
  /** Sandiqdan chiqqan bepul kuch kartasi tanlanmoqda (to'lqin davom etadi) */
  bonusPick = false;
  /** Shu o'yinda terilgan oltin (o'yin tugaganda umumiy hisobga qo'shiladi) */
  runGold = 0;
  /** Yakun ekranidagi statistika; reset() da nollanadi, pauza vaqti kirmaydi */
  stats = newStats();
  /** Oxirgi marta hisobga qo'shilgan oltin va umumiy hisob — yakun ekranida */
  lastGold = 0;
  totalGold = 0;
  /** Do'kondan: yurak tushish ehtimoliga qo'shimcha */
  private dropBonus = 0;
  fx = new Effects();
  attempt = 1;
  phase: Phase = "play";
  stage: Stage = "fight";
  wave = 0;
  choices: Upgrade[] = [];
  choiceIndex = 0;
  private upgradeLock = 0;
  score = 0;
  best = 0;
  newBest = false;
  combo = 0;
  comboTimer = 0;
  killsForHeal = 0;
  waveHurt = false;
  /** Boss yengilgandan keyingi cheksiz rejim */
  endless = false;
  endlessBest = 0;
  /** 1 — Olovli zindon, 2 — Muz sardobasi, 3 — Zulmat o'rmoni (oldingisini yutib yoki xaritadan) */
  chapter: World = 1;
  /** Xaritada tanlangan boshlang'ich dunyo */
  startWorld: World = 1;
  /** 2- yoki 3-dunyo xaritadan boshlandi: 1-to'lqindan oldin bepul kuch tanlanmoqda */
  startPick = false;
  /** 2- va 3-dunyoni yutgan o'yinlar rekordi (alohida) */
  ch2Best = 0;
  newCh2Best = false;
  ch3Best = 0;
  newCh3Best = false;
  /** Dunyo boshidagi kuchlar va ochko — 2-/3-dunyoda o'lganda shu holatdan qayta boshlanadi */
  private chStart: { powers: Powers; score: number } | null = null;
  /** 1-dunyo yutilgan va 2-dunyoda hali o'lmagan ("Ikki dunyo" yutug'i) */
  private noDeathRun = false;
  /** Shu to'lqinda sovuq nafas tegdimi / to'lqinda Muz ruhi bormidi ("Sovuqqa chidam") */
  private waveChilled = false;
  private waveHasFrost = false;
  banner = { title: "", sub: "", timer: 0 };
  paused = false;
  /** Sensorli qurilma: ko'rsatmalar shunga qarab chiqadi (React belgilaydi). */
  touch = false;
  /** "Bosh menyuga qaytish" bosilganda React menyusini ko'rsatadi. */
  onExit: (() => void) | null = null;
  msgTimer = 0;
  time = 0;
  /** Sozlamalar: ekran silkinishi */
  shakeOn = true;
  /** Kunlik sinov sanasi (oddiy o'yinda null): seed shu sanadan */
  daily: string | null = null;
  /** Yangi ochilgan yutuqlar xabari */
  toasts: { a: Achievement; timer: number }[] = [];
  /** Dushman joylari va kuch kartalari uchun tasodif (kunlik sinovda seed bilan) */
  private spawnRand: () => number = Math.random;
  private cardRand: () => number = Math.random;
  /** Birinchi o'yinda 1-to'lqindagi hali bajarilmagan harakat ko'rsatmalari */
  hints: Hint[] = [];
  private freeze = 0;
  private raf = 0;
  private last = 0;
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private floor: HTMLCanvasElement | null = null;
  private floorKey = NaN;

  constructor(
    canvas: HTMLCanvasElement,
    public hero: Hero = loadPlayableHero(),
    opts: { daily?: string; world?: World } = {},
  ) {
    // qulfli (sotib olinmagan) qahramon bilan o'ynab bo'lmaydi — kunlik sinovda ham
    hero = this.hero = playableHero(hero);
    this.daily = opts.daily ?? null;
    // kunlik sinov doim 1-dunyoda
    this.startWorld = this.daily ? 1 : (opts.world ?? 1);
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.ctx.imageSmoothingEnabled = false;
    const saved = load(STORAGE_KEY);
    this.attempt = saved > 0 ? saved : 1;
    this.best = load(bestKeys(hero).best);
    this.endlessBest = load(bestKeys(hero).endless);
    this.ch2Best = load(bestKeys(hero).ch2);
    this.ch3Best = load(bestKeys(hero).ch3);
    this.totalGold = loadGold();
    const settings = loadSettings();
    this.shakeOn = settings.shake;
    sfx.setVolumes(settings.music, settings.sfx);
    if (!load(TUTORIAL_KEY)) this.hints = [...HINTS];
    this.reset();
  }

  /** Boshlang'ich holat: 1-to'lqin, HP to'liq. */
  reset() {
    this.player = new Player(this.hero);
    const shop = loadShop();
    applyShop(this.player, shop);
    this.dropBonus = dropBonus(shop);
    this.enemies = [];
    this.boss = null;
    this.shots = [];
    this.bolts = [];
    this.webs = [];
    this.clouds = [];
    this.traps = [];
    this.smokes = [];
    this.hideAt = null;
    this.darkness = 0;
    this.drops = [];
    this.coins = [];
    this.chest = null;
    this.chestsOpened = 0;
    this.bonusPick = false;
    this.runGold = 0;
    this.stats = newStats();
    this.fx = new Effects();
    this.score = 0;
    this.newBest = false;
    this.combo = 0;
    this.comboTimer = 0;
    this.killsForHeal = 0;
    this.phase = "play";
    this.endless = false;
    this.chapter = 1;
    this.startPick = false;
    this.chStart = null;
    this.noDeathRun = false;
    this.newCh2Best = false;
    this.newCh3Best = false;
    this.input.clearQueued();
    if (this.daily) {
      // kunlik sinov: har safar bir xil seed — bir xil to'lqinlar va kartalar
      const r = dailyRandoms(this.daily);
      this.spawnRand = r.spawn;
      this.cardRand = r.cards;
      this.hints = [];
      // urinish boshlanishi bilan sarflanadi (chiqib ketib qayta boshlab bo'lmaydi)
      this.saveDailyResult(false);
    }
    if (this.startWorld > 1) return this.startFromWorld();
    this.startWave(0);
  }

  /**
   * Xaritadan 2- yoki 3-dunyo: boshlang'ich kuchlarsiz (faqat do'kon), lekin 1-to'lqindan oldin
   * 1 ta bepul kuch tanlanadi. O'lganda dunyo shu tanlangan kuch bilan qayta boshlanadi.
   */
  private startFromWorld() {
    this.chapter = this.startWorld;
    this.hints = [];
    this.wave = -1;
    this.boss = null;
    this.fx.snowOn = this.chapter === 2;
    this.banner.timer = 0;
    this.choices = pickUpgrades(this.player, 3, this.cardRand);
    this.choiceIndex = 0;
    this.upgradeLock = 0.6;
    this.startPick = true;
    this.stage = this.choices.length ? "upgrade" : "fight";
    if (!this.choices.length) this.beginWorld();
    sfx.playMusic(this.chapter === 3 ? "forest" : "ice");
  }

  /** Bepul kuch tanlangach: dunyo boshidagi holat saqlanadi va 1-to'lqin boshlanadi. */
  private beginWorld() {
    this.startPick = false;
    this.chStart = { powers: savePowers(this.player), score: this.score };
    this.enterChapter();
  }

  /** Kunlik sinov natijasi: shu kunning yagona urinishi. */
  private saveDailyResult(won: boolean) {
    if (!this.daily) return;
    saveDaily({
      date: this.daily,
      hero: this.hero,
      score: this.score,
      wave: Math.min(this.wave + 1, TOTAL_WAVES),
      won,
    });
  }

  /** Yutuqni ochadi va yangi bo'lsa o'yin ichida xabar chiqaradi. */
  private achieve(id: AchievementId) {
    const a = unlockAchievement(id);
    if (!a) return;
    this.toasts.push({ a, timer: 3 });
    sfx.upgrade();
  }

  private startWave(i: number) {
    this.wave = i;
    this.stage = "fight";
    if (endlessNumber(i) >= 10) this.achieve("endless10");
    if (this.daily && i >= 2) this.achieve("daily");
    this.waveHurt = false;
    this.boss = null;
    this.player.charge = 0;
    const boss = isBossWave(i);
    const endless = endlessNumber(i);
    const ch2 = this.ch2;
    const later = this.later;
    const ch = this.chapter;
    // muz dunyosi: 2-dunyo va undan keyingi cheksiz rejim; o'rmon — 3-dunyo
    const ice = ch === 2;
    const forest = ch === 3;
    const hint =
      i === 0 && !this.hints.length
        ? this.player.mage
          ? "Shift — teleport"
          : this.player.hunter
            ? "Shift — orqaga sakrash"
            : this.player.gunner
              ? "Shift — sirpanish"
              : "Shift — dash"
        : "";
    this.banner = later
      ? boss
        ? forest
          ? { title: "BOSS: O'RMON SHOHI", sub: "Yoriqlardan qoch!", timer: 2.2 }
          : { title: "BOSS: QOR MALIKASI", sub: "Ko'k doiradan qoch!", timer: 2.2 }
        : i === 0
          ? { title: WORLD_TITLES[ch], sub: `TO'LQIN 1/${TOTAL_WAVES}`, timer: 2.6 }
          : { title: `TO'LQIN ${i + 1}/${TOTAL_WAVES}`, sub: `${ch}-DUNYO`, timer: 1.6 }
      : boss
        ? endless
          ? forest
            ? { title: "SHOH QAYTDI!", sub: `Shoh joni: ${bossHp(i, KING_HP)}`, timer: 2.2 }
            : ice
              ? { title: "MALIKA QAYTDI!", sub: `Malika joni: ${bossHp(i, QUEEN_HP)}`, timer: 2.2 }
              : { title: "BOSS QAYTDI!", sub: `Iblis joni: ${bossHp(i)}`, timer: 2.2 }
          : { title: "BOSS: IBLIS", sub: "Qizil doiradan qoch!", timer: 2.2 }
        : endless
          ? { title: `CHEKSIZ: ${endless}-TO'LQIN`, sub: "", timer: 1.6 }
          : i === 0 && this.daily
            ? { title: `TO'LQIN 1/${TOTAL_WAVES}`, sub: `KUNLIK SINOV · ${this.daily}`, timer: 1.6 }
            : i === 0
              ? {
                  title: WORLD_TITLES[1],
                  sub: hint || `TO'LQIN 1/${TOTAL_WAVES}`,
                  timer: 2.2,
                }
              : { title: `TO'LQIN ${i + 1}/${TOTAL_WAVES}`, sub: "", timer: 1.6 };
    const kinds = waveEnemies(i, Math.random, ch);
    this.waveChilled = false;
    this.waveHasFrost = ch2 && (boss || kinds.includes("frost"));
    kinds.forEach((kind, n) => {
      const [x, y] = this.spawnPoint();
      const e = new Enemy(kind, x, y);
      e.spawn = e.spawnMax = 1 + n * 0.18 + (boss ? 1.2 : 0);
      e.speedMul = later ? (forest ? waveSpeed3(i) : waveSpeed2(i)) : waveSpeed(i);
      this.enemies.push(e);
    });
    this.fx.snowOn = ice;
    this.fx.wind = 0;
    this.webs = [];
    this.clouds = [];
    this.traps = [];
    this.smokes = [];
    this.darkness = 0;
    this.chest = null;
    if (isChestWave(i) && this.spawnRand() < CHEST_CHANCE) this.spawnChest(...this.spawnPoint());
    if (boss) {
      this.boss = forest
        ? new ForestKing(bossHp(i, KING_HP))
        : ice
          ? new Queen(bossHp(i, QUEEN_HP))
          : new Boss(bossHp(i));
      this.boss.spawn = this.boss.spawnMax = 1.6;
      sfx.roar();
      this.fx.addShake(0.4);
    } else sfx.wave();
    sfx.playMusic(
      boss
        ? forest
          ? "king"
          : ice
            ? "queen"
            : "boss"
        : forest
          ? "forest"
          : ice
            ? "ice"
            : "normal",
    );
  }

  /** O'rmon Shohi: ildiz ovozi va o'rgimchak chaqirish (xonada ko'pi bilan 3 ta). */
  private updateForestKing(k: ForestKing) {
    if (k.justRooted) {
      k.justRooted = false;
      sfx.root();
      this.fx.addShake(0.06);
    }
    if (k.wantSummon) {
      k.wantSummon = false;
      const alive = this.enemies.filter((e) => e.kind === "spider" && !e.dead).length;
      const n = spiderSummonCount(alive);
      for (let j = 0; j < n; j++) {
        const e = new Enemy("spider", k.x + (j ? 24 : -24), k.y + 12);
        e.spawn = e.spawnMax = 0.8;
        e.speedMul = waveSpeed3(BOSS_WAVE);
        this.enemies.push(e);
      }
      if (n) this.fx.burst(k.x, k.y, "#a6f08e", 16, 70, 2);
    }
  }

  /** Qor Malikasi: nayza ovozi, bo'ron o'yinchini suradi, yarim jondan pastda ruh chaqiradi. */
  private updateQueen(q: Queen, dt: number) {
    const p = this.player;
    if (q.justSpiked) {
      q.justSpiked = false;
      sfx.iceSpike();
      this.fx.addShake(0.08);
    }
    const blowing = q.wind.t > 0 && !q.dead;
    if (blowing && !p.dead) {
      p.x += q.wind.dir * WIND_PUSH * dt;
      clampToRoom(p);
    }
    this.fx.wind = blowing ? q.wind.dir : 0;
    if (q.wantSummon) {
      q.wantSummon = false;
      const alive = this.enemies.filter((e) => e.kind === "frost" && !e.dead).length;
      const n = summonCount(alive);
      for (let k = 0; k < n; k++) {
        const e = new Enemy("frost", q.x + (k ? 22 : -22), q.y + 10);
        e.spawn = e.spawnMax = 0.8;
        e.speedMul = waveSpeed2(BOSS_WAVE);
        this.enemies.push(e);
      }
      if (n) this.fx.burst(q.x, q.y, "#9fd0ef", 16, 70, 2);
    }
  }

  /** 2-dunyo davom etmoqda (cheksiz rejimda emas). */
  get ch2() {
    return this.chapter === 2 && !this.endless;
  }

  /** 2- yoki 3-dunyo davom etmoqda (cheksiz rejimda emas). */
  get later() {
    return this.chapter > 1 && !this.endless;
  }

  /**
   * Boss yengildi: keyingi dunyoga kuchlar, yuraklar va ochko saqlanadi, 1 yurak tiklanadi.
   * 1-dunyodan 2-ga o'tishda "Ikki dunyo" yutug'i uchun o'lmasdan o'ynash hisobi boshlanadi.
   */
  startChapter(n: 2 | 3 = 2) {
    if (n === 2) this.noDeathRun = true;
    this.chapter = n;
    const p = this.player;
    p.heal(1);
    this.chStart = { powers: savePowers(p), score: this.score };
    this.enterChapter();
  }

  startChapter2() {
    this.startChapter(2);
  }

  startChapter3() {
    this.startChapter(3);
  }

  /** 2-/3-dunyoda o'lgandan keyin: dunyo boshidagi kuchlar va ochko bilan qayta boshlash. */
  retryChapter() {
    const s = this.chStart;
    if (!s) return this.reset();
    this.player = new Player(this.hero);
    Object.assign(this.player, s.powers);
    this.score = s.score;
    this.enterChapter();
  }

  retryChapter2() {
    this.retryChapter();
  }

  private enterChapter() {
    const p = this.player;
    p.x = 160;
    p.y = 190;
    p.vx = p.vy = 0;
    p.chill = 0;
    this.phase = "play";
    this.newBest = false;
    this.newCh2Best = false;
    this.newCh3Best = false;
    this.combo = 0;
    this.comboTimer = 0;
    this.killsForHeal = 0;
    this.enemies = [];
    this.shots = [];
    this.bolts = [];
    this.webs = [];
    this.clouds = [];
    this.drops = [];
    this.coins = [];
    this.chest = null;
    this.bonusPick = false;
    this.input.clearQueued();
    this.startWave(0);
  }

  /** Sandiqning to'qnashuv tanasi (ref — hitSet uchun sandiqning o'zi). */
  private chestBody() {
    const ch = this.chest!;
    return { x: ch.x, y: ch.y, size: CHEST_SIZE, ref: ch } as unknown as Body & { ref: Chest };
  }

  spawnChest(x: number, y: number) {
    this.chest = { x, y, hp: CHEST_HITS, hitFlash: 0, openT: -1 };
  }

  /** Sandiqqa bitta zarba; 3-zarbada ochiladi. */
  hitChest() {
    const ch = this.chest;
    if (!ch || ch.openT >= 0) return;
    ch.hp--;
    ch.hitFlash = 0.15;
    sfx.chestHit();
    this.fx.burst(ch.x, ch.y, "#9a5e2e", 6, 50, 1);
    if (ch.hp <= 0) this.openChest();
    else this.fx.addShake(0.05);
  }

  /** Ochilish: oltin uchqunlar, 8–15 oltin, 40% yurak, 10% bepul kuch kartasi. */
  openChest(rand: () => number = this.spawnRand) {
    const ch = this.chest;
    if (!ch) return null;
    ch.openT = 0;
    this.chestsOpened++;
    this.stats.chests++;
    if (this.chestsOpened >= 3) this.achieve("chests");
    sfx.chestOpen();
    this.fx.addShake(0.12);
    this.fx.burst(ch.x, ch.y - 4, "#ffcc33", 22, 90, 2);
    this.fx.burst(ch.x, ch.y - 4, "#fff2a8", 10, 60, 1);
    const gold = CHEST_GOLD[0] + Math.floor(rand() * (CHEST_GOLD[1] - CHEST_GOLD[0] + 1));
    for (let k = 0; k < 5; k++) {
      const a = Math.PI * (0.15 + (k / 4) * 0.7);
      this.coins.push({
        x: ch.x + Math.cos(a) * 16,
        y: ch.y + 6 + Math.sin(a) * 10,
        life: COIN_LIFE,
        value: Math.floor(gold / 5) + (k < gold % 5 ? 1 : 0),
      });
    }
    this.fx.text(ch.x, ch.y - 14, `+${gold} OLTIN`, "#ffcc33");
    const heart = rand() < CHEST_HEART;
    if (heart) this.drops.push({ x: ch.x, y: ch.y + 14, life: 9 });
    const card = rand() < CHEST_CARD;
    if (card) {
      this.choices = pickUpgrades(this.player, 3, this.cardRand);
      if (this.choices.length) {
        this.bonusPick = true;
        this.choiceIndex = 0;
        this.upgradeLock = 0.6;
        this.stage = "upgrade";
        this.input.clearQueued();
      }
    }
    return { gold, heart, card };
  }

  /** Bajarilgan harakat ko'rsatmasini yashiradi; hammasi bajarilsa qayta chiqmaydi. */
  private doneHint(h: Hint) {
    if (!this.hints.includes(h)) return;
    this.hints = this.hints.filter((x) => x !== h);
    if (!this.hints.length) save(TUTORIAL_KEY, 1);
  }

  private hintsVisible() {
    return (
      this.hints.length > 0 &&
      this.wave === 0 &&
      !this.endless &&
      this.phase === "play" &&
      this.stage === "fight"
    );
  }

  /** O'yinchidan uzoqroq tasodifiy nuqta. */
  private spawnPoint(): [number, number] {
    const m = ROOM.wall + 14;
    let best: [number, number] = [m, m];
    let bestD = -1;
    for (let k = 0; k < 20; k++) {
      const x = m + this.spawnRand() * (ROOM.w - m * 2);
      const y = m + this.spawnRand() * (ROOM.h - m * 2);
      const d = Math.hypot(x - this.player.x, y - this.player.y);
      if (d > 90) return [x, y];
      if (d > bestD) {
        bestD = d;
        best = [x, y];
      }
    }
    return best;
  }

  /** Pauza faqat jang paytida, o'lim animatsiyasi yoki urinish yozuvida emas. */
  private canPause() {
    return this.phase === "play" && !this.player.dead;
  }

  setPaused(on: boolean) {
    if (on && !this.canPause()) return;
    if (this.paused === on) return;
    this.paused = on;
    if (on) sfx.suspend();
    else sfx.resume();
  }

  /** O'yinni to'xtatib, React bosh menyusiga qaytish. */
  exitToMenu() {
    if (this.daily && this.phase === "play") this.saveDailyResult(false);
    this.bankGold();
    this.setPaused(false);
    this.onExit?.();
  }

  /** Urinish sonini o'zgartirmasdan boshidan boshlash. */
  restart() {
    this.bankGold();
    this.reset();
    this.setPaused(false);
  }

  // Tugmalar (xona koordinatalarida)
  private resumeBtn = { x: ROOM.w / 2 - 80, y: ROOM.h / 2 + 4, w: 160, h: 18 };
  private restartBtn = { x: ROOM.w / 2 - 80, y: ROOM.h / 2 + 28, w: 160, h: 18 };
  private menuBtn = { x: ROOM.w / 2 - 80, y: ROOM.h / 2 + 52, w: 160, h: 18 };
  private chapterBtn = { x: ROOM.w / 2 - 80, y: 150, w: 160, h: 18 };
  private endlessBtn = { x: ROOM.w / 2 - 80, y: 172, w: 160, h: 18 };
  private newRunBtn = { x: ROOM.w / 2 - 80, y: 194, w: 160, h: 18 };
  /** 2-dunyoda o'lganda: qayta boshlash yoki bosh menyu */
  private retryBtn = { x: ROOM.w / 2 - 80, y: 154, w: 160, h: 18 };
  private quitBtn = { x: ROOM.w / 2 - 80, y: 178, w: 160, h: 18 };
  private cardRect(i: number) {
    const w = 92,
      gap = 8,
      h = 100;
    const x0 = (ROOM.w - (w * 3 + gap * 2)) / 2;
    return { x: x0 + i * (w + gap), y: 74, w, h };
  }

  private toRoom(e: MouseEvent) {
    const r = this.canvas.getBoundingClientRect();
    // CSS masshtabi -> bufer -> xona koordinatalari
    const bx = ((e.clientX - r.left) / r.width) * this.canvas.width;
    const by = ((e.clientY - r.top) / r.height) * this.canvas.height;
    const scale = Math.min(this.canvas.width / ROOM.w, this.canvas.height / ROOM.h);
    return {
      x: (bx - (this.canvas.width - ROOM.w * scale) / 2) / scale,
      y: (by - (this.canvas.height - ROOM.h * scale) / 2) / scale,
    };
  }

  private onClick = (e: MouseEvent) => {
    const { x, y } = this.toRoom(e);
    const hit = (b: { x: number; y: number; w: number; h: number }) =>
      x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
    if (this.paused) {
      if (hit(this.resumeBtn)) this.setPaused(false);
      else if (hit(this.restartBtn) && !this.daily) this.restart();
      else if (hit(this.menuBtn)) this.exitToMenu();
      return;
    }
    if (this.phase === "victory") {
      if (this.daily) {
        if (hit(this.endlessBtn)) this.exitToMenu();
      } else if (this.chapter < 3 && hit(this.chapterBtn))
        this.startChapter((this.chapter + 1) as 2 | 3);
      else if (hit(this.endlessBtn)) this.startEndless();
      else if (hit(this.newRunBtn)) this.newRun();
      return;
    }
    if (this.phase === "attempt" && this.later) {
      if (hit(this.retryBtn)) this.retryChapter();
      else if (hit(this.quitBtn)) this.exitToMenu();
      return;
    }
    if (this.phase === "play" && this.stage === "upgrade") {
      if (this.upgradeLock > 0) return;
      for (let i = 0; i < this.choices.length; i++)
        if (hit(this.cardRect(i))) return this.choose(i);
    }
  };

  private onVisibility = () => {
    if (document.hidden) this.setPaused(true);
  };
  private onBlur = () => this.setPaused(true);

  start() {
    this.input.attach();
    this.canvas.addEventListener("click", this.onClick);
    document.addEventListener("visibilitychange", this.onVisibility);
    window.addEventListener("blur", this.onBlur);
    this.last = performance.now();
    const loop = (now: number) => {
      // last har kadrda yangilanadi: pauza vaqti dt ga qo'shilmaydi
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      if (this.input.consumePause()) this.setPaused(!this.paused);
      if (this.input.consumeKey("KeyM")) sfx.toggleMute();
      if (this.paused) {
        // pauzada bosilgan hujum/Enter navbatlari tozalanadi
        this.input.clearQueued();
        this.player.charge = 0;
      } else {
        this.update(dt);
      }
      this.input.endFrame();
      this.render();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.input.detach();
    this.canvas.removeEventListener("click", this.onClick);
    document.removeEventListener("visibilitychange", this.onVisibility);
    window.removeEventListener("blur", this.onBlur);
    sfx.stopMusic();
    sfx.resume();
  }

  private newRun() {
    this.attempt = 1;
    save(STORAGE_KEY, 1);
    this.reset();
  }

  /** Terilgan oltinni umumiy hisobga (localStorage) o'tkazadi. */
  private bankGold() {
    this.lastGold = this.runGold;
    this.totalGold = addGold(this.runGold);
    this.runGold = 0;
  }

  private pickCoin(c: Coin) {
    this.runGold += c.value;
    this.stats.gold += c.value;
    if (this.runGold >= 50) this.achieve("rich");
    this.fx.text(c.x, c.y - 8, `+${c.value}`, "#ffcc33");
  }

  /** To'lqin yakunida yerda qolgan tangalar o'zi teriladi. */
  private collectCoins() {
    for (const c of this.coins) this.pickCoin(c);
    if (this.coins.length) sfx.pickup();
    this.coins = [];
  }

  private commitBest() {
    // kunlik sinov oddiy rekordlarga kirmaydi
    if (this.daily) return;
    if (this.endless) {
      if (this.score > this.endlessBest) {
        this.endlessBest = this.score;
        this.newBest = true;
        save(bestKeys(this.hero).endless, this.endlessBest);
      }
    } else if (this.score > this.best) {
      this.best = this.score;
      this.newBest = true;
      save(bestKeys(this.hero).best, this.best);
    }
  }

  /** G'alabadan so'ng: kuchlar saqlanadi, ochko 0 dan, to'lqinlar cheksiz. */
  private startEndless() {
    this.endless = true;
    this.phase = "play";
    this.score = 0;
    this.newBest = false;
    this.combo = 0;
    this.comboTimer = 0;
    this.player.hp = this.player.maxHp;
    this.shots = [];
    this.bolts = [];
    this.drops = [];
    this.coins = [];
    this.chestsOpened = 0;
    this.input.clearQueued();
    this.startWave(BOSS_WAVE + 1);
  }

  private choose(i: number) {
    const u = this.choices[i];
    if (!u) return;
    u.apply(this.player);
    sfx.upgrade();
    this.fx.text(this.player.x, this.player.y - 16, u.name, u.color);
    this.fx.burst(this.player.x, this.player.y, u.color, 18, 70);
    this.input.clearQueued();
    if (this.bonusPick) {
      // sandiqdagi bepul karta: to'lqin shu joyidan davom etadi
      this.bonusPick = false;
      this.stage = "fight";
      return;
    }
    if (this.startPick) return this.beginWorld();
    this.startWave(this.wave + 1);
  }

  private updateUpgrade(dt: number) {
    if (this.upgradeLock > 0) {
      this.upgradeLock -= dt;
      this.input.clearQueued();
      return;
    }
    const n = this.choices.length;
    const inp = this.input;
    for (let i = 0; i < n; i++)
      if (inp.consumeKey(`Digit${i + 1}`, `Numpad${i + 1}`)) return this.choose(i);
    if (inp.consumeKey("ArrowLeft", "KeyA")) this.choiceIndex = (this.choiceIndex + n - 1) % n;
    if (inp.consumeKey("ArrowRight", "KeyD")) this.choiceIndex = (this.choiceIndex + 1) % n;
    if (inp.consumeEnter() || inp.consumeAttack()) this.choose(this.choiceIndex);
    inp.consumeDash();
  }

  private onKill(e: Enemy) {
    this.combo = this.comboTimer > 0 ? this.combo + 1 : 1;
    this.stats.kills++;
    this.stats.maxCombo = Math.max(this.stats.maxCombo, this.combo);
    this.achieve("first");
    if (this.combo >= 10) this.achieve("combo10");
    if (this.combo >= 50) this.achieve("combo50");
    this.comboTimer = COMBO_TIME;
    const mult = Math.min(5, 1 + Math.floor((this.combo - 1) / 2));
    const pts = KILL_POINTS[e.kind] * mult;
    this.score += pts;
    this.fx.text(
      e.x,
      e.y - 10,
      mult > 1 ? `+${pts} x${mult}` : `+${pts}`,
      mult > 1 ? "#ffcc33" : "#ffffff",
    );
    this.fx.burst(e.x, e.y, KILL_COLOR[e.kind], 14, 80);
    sfx.kill();
    if (e.kind === "golem") {
      // qor odam 2 ta Muz slime'ga bo'linadi
      for (let k = 0; k < GOLEM_SPLIT; k++) {
        const s = new Enemy("iceblob", e.x + (k ? 8 : -8), e.y + 2);
        s.spawn = s.spawnMax = 0.3;
        s.speedMul = e.speedMul;
        this.enemies.push(s);
      }
      this.fx.burst(e.x, e.y, "#d8ecf7", 16, 90, 2);
    }
    if (Math.random() < DROP_CHANCE + this.dropBonus) this.drops.push({ x: e.x, y: e.y, life: 9 });
    this.coins.push({ x: e.x + 5, y: e.y + 3, life: COIN_LIFE, value: KILL_GOLD[e.kind] });
    const p = this.player;
    if (p.lifesteal) {
      this.killsForHeal++;
      if (this.killsForHeal >= p.lifesteal) {
        this.killsForHeal = 0;
        if (p.heal(1)) this.fx.text(p.x, p.y - 14, "+1 YURAK", "#ff4d6d");
      }
    }
  }

  private onPlayerHurt() {
    const p = this.player;
    this.waveHurt = true;
    this.combo = 0;
    this.comboTimer = 0;
    this.fx.addShake(0.25);
    this.fx.burst(p.x, p.y, "#ff4d6d", 10, 70);
    if (p.frost) {
      // muz qalqoni: atrofdagi dushmanlar 1.5s sekinlashadi
      const targets: (Enemy | Boss)[] = this.enemies.filter((e) => e.active);
      if (this.boss?.active) targets.push(this.boss);
      for (const t of targets)
        if (Math.hypot(t.x - p.x, t.y - p.y) - t.size / 2 < FROST_RADIUS) {
          t.slow = FROST_TIME;
          this.fx.burst(t.x, t.y, "#9be7ff", 5, 40);
        }
      this.fx.burst(p.x, p.y, "#c9f3ff", 14, 90);
    }
    if (p.thorns) {
      // tikanli zirh: eng yaqin dushmanga 1 zarar
      const targets: (Enemy | Boss)[] = this.enemies.filter((e) => e.active);
      if (this.boss?.active) targets.push(this.boss);
      let near: Enemy | Boss | null = null;
      let nearD = Infinity;
      for (const t of targets) {
        const d = Math.hypot(t.x - p.x, t.y - p.y) - t.size / 2;
        if (d < 40 && d < nearD) {
          nearD = d;
          near = t;
        }
      }
      if (near) {
        this.fx.burst(near.x, near.y, "#c9a26b", 8, 60);
        this.damageTarget(near, 1);
      }
    }
  }

  /** Qalqon to'sdi: "dzing", uchqun, zarar yo'q; qilich bo'lsa o'yinchi biroz orqaga itariladi. */
  private shieldBlock(e: Enemy, melee: boolean) {
    sfx.block();
    e.blockFlash = 0.15;
    const a = e.shieldAngle;
    const sx = e.x + Math.cos(a) * 10,
      sy = e.y + Math.sin(a) * 10 + 2;
    this.fx.burst(sx, sy, "#ffe14d", 8, 80, 1);
    this.fx.burst(sx, sy, "#d9d4e0", 4, 50, 1);
    if (melee) {
      const p = this.player;
      p.vx = Math.cos(a) * 150;
      p.vy = Math.sin(a) * 150;
      this.freeze = 0.03;
    }
  }

  /** Dushman yoki Bossga zarar; o'lsa ochko va effektlar. */
  private damageTarget(t: Enemy | Boss, dmg: number, knock = true) {
    const p = this.player;
    applyHit(t, dmg, p.x, p.y, !knock ? 0 : t instanceof Boss ? 120 : 220);
    if (t.hp > 0) return;
    if (t instanceof Enemy) this.onKill(t);
    else {
      const queen = t instanceof Queen;
      const king = t instanceof ForestKing;
      const pts = king ? KING_POINTS : queen ? QUEEN_POINTS : BOSS_POINTS;
      this.score += pts;
      if (!king) this.achieve(queen ? "queen" : "boss");
      this.fx.text(t.x, t.y - 24, `+${pts}`, "#ffcc33");
      // Abadiyat olami: birinchi g'alabada darvoza kaliti, faol topshiriqda — Iblis shoxi
      if (recordBossKey(king ? "king" : queen ? "queen" : "devil"))
        this.fx.text(t.x, t.y - 44, "DARVOZA KALITI!", "#c9a25a");
      if (!king && !queen && hornWanted()) {
        sendToRealm(HORN_ITEM);
        this.fx.text(t.x, t.y - 34, "IBLIS SHOXI — OLAMGA", "#ff7a2a");
        this.fx.burst(t.x, t.y - 10, "#ff7a2a", 16, 80, 2);
      }
      this.fx.burst(t.x, t.y, king ? "#a6f08e" : queen ? "#7fe9ff" : "#f4cb45", 40, 120, 3);
      this.fx.addShake(0.6);
      this.shots = [];
      // Boss xazinasi: 5 ta tanga atrofga sochiladi
      const gold = king ? KING_GOLD : queen ? QUEEN_GOLD : BOSS_GOLD;
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        this.coins.push({
          x: t.x + Math.cos(a) * 18,
          y: t.y + Math.sin(a) * 14,
          life: COIN_LIFE,
          value: gold / 5,
        });
      }
    }
  }

  update(dt: number) {
    this.time += dt;
    this.fx.update(dt);
    // kuch tanlash ekranida yutuq xabari navbatda kutadi (sarlavhani yopmaydi)
    if (this.toasts.length && !this.toastHeld) {
      this.toasts[0]!.timer -= dt;
      if (this.toasts[0]!.timer <= 0) this.toasts.shift();
    }
    if (this.phase === "attempt" && this.later) {
      // 2-/3-dunyoda o'lim: o'yinchi o'zi tanlaydi
      if (this.input.consumeEnter() || this.input.consumeKey("KeyR")) this.retryChapter();
      else if (this.input.consumeKey("KeyQ")) this.exitToMenu();
      return;
    }
    if (this.phase === "attempt") {
      this.msgTimer -= dt;
      if (this.msgTimer <= 0) {
        if (this.daily) this.exitToMenu();
        else if (this.endless) this.newRun();
        else this.reset();
      }
      return;
    }
    if (this.phase === "victory") {
      this.boss?.update(dt, this.player);
      if (this.daily) {
        if (this.input.consumeEnter()) this.exitToMenu();
        return;
      }
      if (this.chapter < 3 && this.input.consumeEnter())
        this.startChapter((this.chapter + 1) as 2 | 3);
      else if (this.chapter < 3 ? this.input.consumeKey("KeyE") : this.input.consumeEnter())
        this.startEndless();
      else if (this.input.consumeKey("KeyR")) this.newRun();
      return;
    }
    // o'yin vaqti: update() pauzada chaqirilmaydi
    this.stats.time += dt;
    if (this.stage === "upgrade") return this.updateUpgrade(dt);
    if (this.freeze > 0) {
      this.freeze -= dt;
      return;
    }
    if (this.banner.timer > 0) this.banner.timer -= dt;
    if (this.comboTimer > 0) this.comboTimer -= dt;
    else this.combo = 0;

    const p = this.player;
    const hpBefore = p.hp;
    if (p.hunter) p.threat = this.nearestThreat();
    p.update(dt, this.input);
    if (p.traps.length) {
      for (const t of p.traps) this.traps.push({ ...t, life: TRAP_LIFE, snapT: -1 });
      p.traps = [];
      // ko'pi bilan 2 ta: eng eskisi yo'qoladi
      while (this.traps.filter((t) => t.snapT < 0).length > MAX_TRAPS) {
        const i = this.traps.findIndex((t) => t.snapT < 0);
        this.traps.splice(i, 1);
      }
      this.fx.burst(p.x, p.y + 6, "#9a9ea8", 6, 40, 1);
      this.fx.text(p.x, p.y - 16, "TUZOQ", "#c9a26b");
    }
    if (p.trapDenied) {
      p.trapDenied = false;
      this.fx.text(p.x, p.y - 16, `TUZOQ ${Math.ceil(p.trapCooldown)}s`, "#b8a8cc");
    }
    if (p.smokes.length) {
      for (const s of p.smokes) {
        this.smokes.push({ ...s, life: SMOKE_LIFE });
        this.hideAt = { x: s.x, y: s.y };
        this.fx.burst(s.x, s.y, "#b8b0a4", 18, 70, 3);
        this.fx.burst(s.x, s.y, "#6e6860", 10, 40, 3);
      }
      p.smokes = [];
      this.fx.text(p.x, p.y - 16, "TUTUN", "#d9d2c6");
    }
    if (p.smokeDenied) {
      p.smokeDenied = false;
      this.fx.text(p.x, p.y - 16, `TUTUN ${Math.ceil(p.smokeCooldown)}s`, "#b8a8cc");
    }
    this.updateSmokes(dt);
    if (this.hints.length) {
      if (p.attackTimer > 0) this.doneHint("attack");
      if (p.spinning) this.doneHint("spin");
      if (p.dashing) this.doneHint("dash");
    }
    if (p.chill > 0) this.waveChilled = true;
    if (p.teleportFrom) {
      // teleport: chiqqan joyda qora tutun, ikkala joyda qizil uchqunlar
      this.fx.burst(p.teleportFrom.x, p.teleportFrom.y, "#1a1118", 14, 30, 3);
      this.fx.burst(p.teleportFrom.x, p.teleportFrom.y, "#ff3b3b", 6, 70, 1);
      this.fx.burst(p.x, p.y, "#2b1c2e", 8, 25, 3);
      this.fx.burst(p.x, p.y, "#ff5a3c", 10, 60, 1);
      p.teleportFrom = null;
    }
    if (p.cutFree) {
      p.cutFree = false;
      this.fx.burst(p.x, p.y, "#e8e4f0", 10, 70, 1);
      this.fx.text(p.x, p.y - 16, "UZILDI!", "#e8e4f0");
    }
    const ch = this.chest;
    if (ch) {
      if (ch.hitFlash > 0) ch.hitFlash -= dt;
      if (ch.openT >= 0) {
        ch.openT += dt;
        if (ch.openT < 0.8 && Math.random() < 0.5)
          this.fx.burst(ch.x + (Math.random() - 0.5) * 10, ch.y - 4, "#ffe14d", 1, 40, 1);
      }
      // sandiq to'siq: o'yinchi ichidan o'tmaydi
      const dx = p.x - ch.x,
        dy = p.y - ch.y,
        min = (p.size + CHEST_SIZE) / 2;
      if (Math.abs(dx) < min && Math.abs(dy) < min) {
        if (Math.abs(dx) > Math.abs(dy)) p.x = ch.x + (dx < 0 ? -min : min);
        else p.y = ch.y + (dy < 0 ? -min : min);
      }
    }
    // Sehrgar teleporti bir zumda — izi yo'q, uning o'rniga tutun va uchqunlar
    if (p.dashing && !p.mage) this.fx.trail(p.x, p.y + 2, HERO_THEME[this.hero].trail);
    if (p.bolts.length) {
      // Mergan o'qi: og'izda uchqun va porox tutuni
      for (const b of p.bolts) if (b.bullet) this.muzzle(b);
      this.bolts.push(...p.bolts);
      p.bolts = [];
    }
    // tutunda yashiringan Merganni dushmanlar ko'rmaydi: oxirgi ko'rgan joyini nishonga oladi
    const target = this.aiTarget();
    for (const e of this.enemies) {
      e.update(dt, target);
      if (e.justStomped) {
        e.justStomped = false;
        sfx.stomp();
        this.fx.addShake(0.15);
        this.fx.burst(e.x, e.y + 8, "#d8ecf7", 10, 70, 1);
      }
      if (e.shots.length) {
        for (const s of e.shots) this.shots.push({ ...s, size: 4, arrow: true });
        e.shots = [];
        sfx.arrow();
      }
      if (e.webs.length) {
        for (const w of e.webs)
          this.webs.push({
            ...w,
            flying: true,
            life: WEB_LIFE,
            dist: Math.hypot(w.tx - w.x, w.ty - w.y),
          });
        e.webs = [];
        sfx.web();
      }
      if (e.wantCloud) {
        e.wantCloud = false;
        this.clouds.push({ x: e.x, y: e.y + 2, life: CLOUD_LIFE });
        sfx.poison();
        this.fx.burst(e.x, e.y - 4, "#a6f08e", 14, 60, 2);
      }
      if (e.justRooted) {
        e.justRooted = false;
        sfx.root();
        this.fx.addShake(0.08);
        this.fx.burst(e.rootX, e.rootY + 4, "#6b4a2a", 10, 60, 1);
      }
    }
    const boss = this.boss;
    if (boss) {
      boss.update(dt, target);
      if (boss.justEnraged) {
        boss.justEnraged = false;
        this.banner = {
          title: "G'AZAB!",
          sub:
            boss instanceof Queen
              ? "Malika ruhlarni chaqiradi"
              : boss instanceof ForestKing
                ? "O'rmon qorong'ilashdi"
                : "Iblis olov sochadi",
          timer: 1.6,
        };
        sfx.roar();
        this.fx.addShake(0.4);
      }
      if (boss.justSlammed) {
        this.fx.addShake(0.2);
        if (boss instanceof Queen) sfx.blizzard();
      }
      if (boss instanceof Queen) this.updateQueen(boss, dt);
      if (boss instanceof ForestKing) this.updateForestKing(boss);
      if (boss.shots.length) {
        for (const s of boss.shots) this.shots.push({ ...s, size: 6 });
        boss.shots = [];
        sfx.fireball();
      }
    }
    this.enemies = this.enemies.filter((e) => !e.removed);

    // ustma-ust yig'ilmaslik
    const alive = this.enemies.filter((e) => e.active);
    for (let i = 0; i < alive.length; i++) {
      for (let j = i + 1; j < alive.length; j++) separate(alive[i]!, alive[j]!);
      if (boss?.active) separate(alive[i]!, boss, 1);
    }

    // olov sharlari
    for (const s of this.shots) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (!s.arrow && Math.random() < 0.5) this.fx.trail(s.x, s.y, "rgba(255,140,40,0.7)");
    }
    const inRoom = (s: Shot) =>
      s.x > ROOM.wall && s.x < ROOM.w - ROOM.wall && s.y > ROOM.wall && s.y < ROOM.h - ROOM.wall;
    this.shots = this.shots.filter(inRoom);
    this.updateWebs(dt);
    this.updateClouds(dt);
    this.updateTraps(dt);
    this.updatePoison(dt);
    // O'rmon Shohi g'azabida xona asta qorong'ilashadi
    const dark = boss instanceof ForestKing && boss.dark;
    this.darkness = Math.max(0, Math.min(1, this.darkness + (dark ? dt : -dt * 2)));

    // sehrli sharlar: birinchi tekkan dushmanga zarar, dushman o'q/olovini ham yo'q qiladi
    if (this.bolts.length) {
      const targets: (Enemy | Boss)[] = this.enemies.filter((e) => e.active);
      if (boss?.active) targets.push(boss);
      this.bolts = this.bolts.filter((b) => {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.bullet) {
          // Mergan o'qi: ingichka mis iz, masofasi tugasa so'nadi
          if (Math.random() < 0.5) this.fx.trail(b.x, b.y, "rgba(255,226,160,0.55)");
          b.range = (b.range ?? Infinity) - Math.hypot(b.vx, b.vy) * dt;
          if (b.range <= 0) {
            this.fx.burst(b.x, b.y, "#9a948a", 3, 20, 1);
            return false;
          }
        }
        // Sehrgar shari — qora tutunli iz, kuchli o'q — yashil iz
        else if (!b.arrow && Math.random() < 0.6) this.fx.trail(b.x, b.y, "rgba(26,17,24,0.75)");
        if (b.arrow && (b.power ?? 1) > 1 && Math.random() < 0.7)
          this.fx.trail(b.x, b.y, "rgba(166,240,142,0.7)");
        const body = { x: b.x, y: b.y, size: b.size } as Body;
        const t = targets.find((t) => !t.dead && !b.hit.includes(t) && overlap(body, t));
        // qalqon oldidan kelgan sharni to'sadi (kuchli o'q teshib 1 zarar beradi)
        const strong = (b.power ?? 1) > 1;
        if (t instanceof Enemy && t.blocks(t.x - b.vx, t.y - b.vy)) {
          if (!strong) {
            this.shieldBlock(t, false);
            return false;
          }
          this.shieldBlock(t, false);
          this.damageTarget(t, 1);
          b.hit.push(t);
          return true;
        }
        if (!t && this.chest && this.chest.openT < 0 && overlap(body, this.chestBody())) {
          this.hitChest();
          return false;
        }
        if (t) {
          sfx.hit();
          this.fx.addShake(0.06);
          this.fx.burst(b.x, b.y, b.bullet ? "#ffe2a0" : b.arrow ? "#c9a26b" : "#ff5a3c", 6, 60, 1);
          if (b.poison && !t.dead) {
            t.poison = POISON_TIME;
            this.fx.burst(t.x, t.y, "#a6f08e", 5, 40, 1);
          }
          this.damageTarget(t, p.damage * (b.power ?? 1));
          // teshuvchi shar keyingi dushmangacha uchishda davom etadi
          b.hit.push(t);
          if (--b.left <= 0) return false;
        }
        const n = this.shots.length;
        this.shots = this.shots.filter((s) => !overlap(body, s as unknown as Body));
        if (this.shots.length < n) {
          this.score += 5 * (n - this.shots.length);
          this.fx.burst(b.x, b.y, b.arrow ? "#7a4a24" : "#a3192a", 6, 50);
          return false;
        }
        // Rikoshet: Mergan o'qi devordan bir marta qaytadi
        if (!inRoom(b as Shot) && b.bounce) return this.ricochet(b);
        return inRoom(b as Shot);
      });
    }

    // o'yinchi hujumi
    const box = p.attackBox();
    if (box) {
      const targets: (Enemy | Boss)[] = this.enemies.filter((e) => e.active);
      if (boss?.active) targets.push(boss);
      for (const t of targets) {
        if (!p.hitSet.has(t) && overlap(box, t)) {
          p.hitSet.add(t);
          // qalqon: oldidan kelgan zarba to'siladi, aylana zarba/halqa teshib 1 zarar beradi
          const blocked = t instanceof Enemy && t.blocks(p.x, p.y);
          if (blocked && !p.spinning) {
            this.shieldBlock(t, true);
            continue;
          }
          sfx.hit();
          this.freeze = 0.045;
          this.fx.addShake(p.spinning ? 0.14 : 0.08);
          this.fx.burst(
            t.x,
            t.y,
            p.mage ? "#ff3b3b" : p.spinning ? HERO_THEME[this.hero].accent : "#ffffff",
            5,
            60,
            1,
          );
          this.damageTarget(t, blocked ? 1 : p.hitDamage);
        }
      }
      const cb = this.chest && this.chest.openT < 0 ? this.chestBody() : null;
      if (cb && !p.hitSet.has(cb.ref) && overlap(box, cb)) {
        p.hitSet.add(cb.ref);
        this.hitChest();
      }
      // zarba yerdagi to'rni uzadi
      this.webs = this.webs.filter((w) => {
        if (w.flying || !overlap(box, { x: w.x, y: w.y, size: WEB_RADIUS * 2 } as Body))
          return true;
        this.fx.burst(w.x, w.y, "#e8e4f0", 8, 50, 1);
        return false;
      });
      // qilich olov shari va o'qlarni ham urib yo'q qiladi
      const before = this.shots.length;
      this.shots = this.shots.filter((s) => {
        if (!overlap(box, s as unknown as Body)) return true;
        this.fx.burst(s.x, s.y, s.arrow ? "#ff3b3b" : "#ff9a3c", 6, 50);
        return false;
      });
      if (this.shots.length < before) this.score += 5 * (before - this.shots.length);
    }

    // dash oxirida dushman ichida qolsa himoya dumi chiqquncha uzayadi
    p.inFoe =
      this.enemies.some((e) => e.active && overlap(p, e)) || !!(boss?.active && overlap(p, boss));
    // kontakt zarar
    if (!p.dead) {
      for (const e of this.enemies)
        if (e.active && overlap(p, e) && p.takeHit(1, e.x, e.y, 180) && e.kind === "iceblob")
          // muz slime tegsa sekinlashtiradi
          p.chill = Math.max(p.chill, ICEBLOB_CHILL);
      if (boss?.active && overlap(p, boss)) p.takeHit(1, boss.x, boss.y, 220);
      this.shots = this.shots.filter((s) => {
        if (!overlap(p, s as unknown as Body)) return true;
        return !p.takeHit(1, s.x, s.y, 160);
      });
    }
    if (p.hp < hpBefore) this.onPlayerHurt();

    // yurak terish
    for (const d of this.drops) d.life -= dt;
    this.drops = this.drops.filter((d) => {
      if (d.life <= 0) return false;
      if (Math.hypot(d.x - p.x, d.y - p.y) > 11 || p.dead) return true;
      if (p.heal(1)) this.fx.text(d.x, d.y - 8, "+1 YURAK", "#ff4d6d");
      else {
        this.score += 25;
        this.fx.text(d.x, d.y - 8, "+25", "#ffffff");
      }
      sfx.pickup();
      this.fx.burst(d.x, d.y, "#ff4d6d", 8, 40);
      return false;
    });
    // tanga terish
    for (const co of this.coins) co.life -= dt;
    this.coins = this.coins.filter((co) => {
      if (co.life <= 0) return false;
      if (Math.hypot(co.x - p.x, co.y - p.y) > 11 || p.dead) return true;
      this.pickCoin(co);
      sfx.pickup();
      this.fx.burst(co.x, co.y, "#ffcc33", 6, 40);
      return false;
    });

    // o'lim -> urinish
    if (p.dead) {
      if (p.anim.done) {
        this.commitBest();
        this.bankGold();
        this.saveDailyResult(false);
        this.noDeathRun = false;
        // cheksiz rejimda o'yin allaqachon yutilgan, kunlik sinov alohida — urinish oshmaydi
        if (!this.endless && !this.daily) {
          this.attempt++;
          save(STORAGE_KEY, this.attempt);
        }
        this.phase = "attempt";
        this.msgTimer = 2.6;
        sfx.stopMusic();
      }
      return;
    }

    // sandiq kartasi shu kadrda ochilgan bo'lsa, avval u tanlanadi
    if (this.bonusPick) return;
    // to'lqin tugadi
    if (this.enemies.length === 0) {
      if (isBossWave(this.wave)) {
        if (boss?.dead && boss.anim.done) {
          if (this.endless) this.clearWave();
          else {
            this.commitBest();
            this.collectCoins();
            this.bankGold();
            this.saveDailyResult(true);
            this.achieve(
              this.hero === "mage" ? "winMage" : this.hero === "hunter" ? "winHunter" : "winKnight",
            );
            // dunyo yutildi: xaritada keyingi dunyo ochiladi (kunlik sinov ham hisob)
            recordWorldWin(this.chapter, this.hero);
            if (this.chapter === 2) {
              if (this.noDeathRun) this.achieve("twoChapters");
              if (this.score > this.ch2Best) {
                this.ch2Best = this.score;
                this.newCh2Best = true;
                save(bestKeys(this.hero).ch2, this.ch2Best);
              }
            }
            if (this.chapter === 3 && this.score > this.ch3Best) {
              this.ch3Best = this.score;
              this.newCh3Best = true;
              save(bestKeys(this.hero).ch3, this.ch3Best);
            }
            this.stats.waves++;
            this.phase = "victory";
            sfx.stopMusic();
            sfx.victory();
          }
        }
      } else this.clearWave();
    }
  }

  /**
   * Dushman va Boss nishoni. Tutunda yashiringan Mergan ko'rinmaydi: dushmanlar tutun tashlangan joyni
   * nishonga oladi va o'sha joyga uradi — u yerda Mergan yo'q (tegib ketish va o'qlar baribir zarar beradi).
   */
  private aiTarget(): Target {
    const p = this.player;
    const at = this.hideAt;
    if (!p.hidden || !at) return p;
    return {
      x: at.x,
      y: at.y,
      size: p.size,
      fx: 0,
      fy: 0,
      chill: 0,
      takeHit: () => false,
      ensnare: () => false,
    };
  }

  /** Tutun bulutlari: ichidagi dushmanlar sekinlashadi; tutundan chiqqan Mergan yana ko'rinadi. */
  private updateSmokes(dt: number) {
    for (const s of this.smokes) s.life -= dt;
    this.smokes = this.smokes.filter((s) => s.life > 0);
    const inside = (b: { x: number; y: number }) =>
      this.smokes.some((s) => Math.hypot(b.x - s.x, b.y - s.y) < SMOKE_RADIUS);
    const p = this.player;
    if (p.hidden && !inside(p)) p.hideT = 0;
    const all: (Enemy | Boss)[] = this.enemies.filter((e) => e.active);
    if (this.boss?.active) all.push(this.boss);
    for (const t of all) if (inside(t)) t.slow = Math.max(t.slow, SMOKE_SLOW);
  }

  /** O'q otildi: to'pponcha og'zida uchqun va kulrang porox tutuni. */
  private muzzle(b: Bolt) {
    this.fx.burst(b.x, b.y, "#ffe2a0", 4, 80, 1);
    this.fx.burst(b.x, b.y, "#d9a441", 2, 50, 1);
    this.fx.burst(b.x, b.y - 2, "#a8a298", 3, 16, 2);
  }

  /** O'q devorga tegdi: tegilgan o'q bo'yicha qaytadi (yana tegishi mumkin). */
  private ricochet(b: Bolt) {
    const lo = ROOM.wall,
      hiX = ROOM.w - ROOM.wall,
      hiY = ROOM.h - ROOM.wall;
    if (b.x <= lo || b.x >= hiX) {
      b.vx = -b.vx;
      b.x = Math.max(lo + 1, Math.min(hiX - 1, b.x));
    }
    if (b.y <= lo || b.y >= hiY) {
      b.vy = -b.vy;
      b.y = Math.max(lo + 1, Math.min(hiY - 1, b.y));
    }
    b.bounce = (b.bounce ?? 1) - 1;
    b.hit = [];
    sfx.ricochet();
    this.fx.burst(b.x, b.y, "#ffe2a0", 6, 70, 1);
    return true;
  }

  /** To'rlar: uchib borib yerga tushadi; o'yinchi ustidan yursa 1s yurolmaydi (dash/teleportda o'tadi). */
  private updateWebs(dt: number) {
    const p = this.player;
    for (const w of this.webs) {
      if (w.flying) {
        w.x += w.vx * dt;
        w.y += w.vy * dt;
        // nishonga yetdi (yoki o'tib ketdi) — yerga tushadi
        if ((w.tx - w.x) * w.vx + (w.ty - w.y) * w.vy <= 0) {
          w.x = w.tx;
          w.y = w.ty;
          w.flying = false;
        }
      } else w.life -= dt;
      // uchayotgan to'r tepadan o'tadi — faqat yerdagisi ushlaydi
      if (p.dead || p.evading || w.flying || w.life <= 0) continue;
      if (Math.hypot(p.x - w.x, p.y - w.y) < WEB_RADIUS - 2 + p.size / 2) {
        p.ensnare(WEB_SNARE);
        w.life = 0;
        sfx.web();
        this.fx.burst(p.x, p.y, "#e8e4f0", 8, 40, 1);
        this.fx.text(p.x, p.y - 16, "TO'R!", "#e8e4f0");
      }
    }
    this.webs = this.webs.filter((w) => w.life > 0);
  }

  /** Ovchiga eng yaqin faol dushman yoki Boss (orqaga sakrash undan uzoqlashadi). */
  private nearestThreat() {
    const p = this.player;
    let best: { x: number; y: number } | null = null;
    let bestD = Infinity;
    const all: (Enemy | Boss)[] = this.enemies.filter((e) => e.active);
    if (this.boss?.active) all.push(this.boss);
    for (const t of all) {
      const d = Math.hypot(t.x - p.x, t.y - p.y);
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    return best;
  }

  /** Tuzoq: ustiga kelgan birinchi dushmanni 2s qotiradi (Bossdan tashqari), so'ng yo'qoladi. */
  private updateTraps(dt: number) {
    for (const t of this.traps) {
      if (t.snapT >= 0) {
        t.snapT += dt;
        continue;
      }
      t.life -= dt;
      const body = { x: t.x, y: t.y, size: TRAP_SIZE } as Body;
      const e = this.enemies.find((e) => e.active && e.stun <= 0 && overlap(body, e));
      if (e) {
        e.stun = TRAP_STUN;
        t.snapT = 0;
        t.x = e.x;
        t.y = e.y + e.size / 2 - 2;
        sfx.block();
        this.fx.burst(e.x, e.y + 4, "#9a9ea8", 8, 60, 1);
        this.fx.text(e.x, e.y - 14, "QOTDI!", "#c9a26b");
      }
    }
    this.traps = this.traps.filter((t) => (t.snapT < 0 ? t.life > 0 : t.snapT < TRAP_STUN));
  }

  /** Zaharli uch: zaharlangan dushman (va Boss) har 1s da 1 zarar oladi. */
  private updatePoison(dt: number) {
    const all: (Enemy | Boss)[] = this.enemies.filter((e) => !e.dead && e.poison > 0);
    if (this.boss && !this.boss.dead && this.boss.poison > 0) all.push(this.boss);
    for (const t of all) {
      t.poison -= dt;
      t.poisonTick += dt;
      if (Math.random() < 0.15) this.fx.trail(t.x, t.y - 4, "rgba(166,240,142,0.7)");
      if (t.poisonTick >= 1) {
        t.poisonTick -= 1;
        this.fx.text(t.x, t.y - 12, "-1", "#a6f08e");
        this.damageTarget(t, 1, false);
      }
      if (t.poison <= 0) t.poisonTick = 0;
    }
  }

  /** Zaharli bulut: ichida har 1s da 1 zarar; tez o'tib ketsang zarar yo'q. */
  private updateClouds(dt: number) {
    const p = this.player;
    for (const c of this.clouds) c.life -= dt;
    this.clouds = this.clouds.filter((c) => c.life > 0);
    const inside =
      !p.dead && this.clouds.some((c) => Math.hypot(p.x - c.x, p.y - c.y) < CLOUD_RADIUS);
    if (!inside) {
      p.poison = 0;
      return;
    }
    p.poison += dt;
    if (p.poison >= CLOUD_TICK) {
      p.poison -= CLOUD_TICK;
      if (p.takeHit(1, p.x, p.y, 0)) this.fx.burst(p.x, p.y - 4, "#a6f08e", 8, 40, 1);
    }
  }

  private clearWave() {
    this.stats.waves++;
    // birinchi to'lqin o'tildi — ko'rsatmalar keyingi o'yinlarda chiqmaydi
    if (this.hints.length && !this.endless) {
      this.hints = [];
      save(TUTORIAL_KEY, 1);
    }
    if (this.ch2 && this.waveHasFrost && !this.waveChilled) this.achieve("noChill");
    let bonus = 50 * (this.wave + 1 + (this.later ? (this.chapter - 1) * TOTAL_WAVES : 0));
    if (!this.waveHurt) {
      bonus += 100;
      this.achieve("clean");
      this.fx.text(ROOM.w / 2, 60, "BENUQSON! +100", "#a6f08e");
    }
    this.score += bonus;
    this.shots = [];
    this.bolts = [];
    this.webs = [];
    this.clouds = [];
    this.traps = [];
    this.smokes = [];
    this.collectCoins();
    // ochilmagan sandiq to'lqin bilan yo'qoladi
    this.chest = null;
    this.choices = pickUpgrades(this.player, 3, this.cardRand);
    this.choiceIndex = 0;
    this.upgradeLock = 0.6;
    this.input.clearQueued();
    sfx.clear();
    if (this.choices.length) this.stage = "upgrade";
    else this.startWave(this.wave + 1);
  }

  // ---------------- chizish ----------------

  /** Joriy to'lqin uchun pol varianti: -1 — Boss xonasi. */
  private floorIndex() {
    if (this.chapter === 2) return isBossWave(this.wave) ? FLOOR_ICE_BOSS : FLOOR_ICE;
    if (this.chapter === 3) return isBossWave(this.wave) ? FLOOR_FOREST_BOSS : FLOOR_FOREST;
    if (isBossWave(this.wave)) return -1;
    const n = endlessNumber(this.wave);
    return n > 0 ? n % FLOORS.length : Math.min(this.wave, FLOORS.length - 1);
  }

  private buildFloor(index: number) {
    const t =
      index === FLOOR_ICE
        ? ICE_FLOOR
        : index === FLOOR_ICE_BOSS
          ? ICE_BOSS_FLOOR
          : index === FLOOR_FOREST
            ? FOREST_FLOOR
            : index === FLOOR_FOREST_BOSS
              ? FOREST_BOSS_FLOOR
              : index < 0
                ? BOSS_FLOOR
                : FLOORS[index]!;
    const cv = document.createElement("canvas");
    cv.width = ROOM.w;
    cv.height = ROOM.h;
    const c = cv.getContext("2d")!;
    px(c, "#1b1426", 0, 0, ROOM.w, ROOM.h);
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    // mox va yoriqlar alohida tasodifiy oqimda — asosiy naqsh o'zgarmaydi
    let seed2 = 11 + Math.max(0, index);
    const rnd2 = () => (seed2 = (seed2 * 16807) % 2147483647) / 2147483647;
    for (let y = ROOM.wall; y < ROOM.h - ROOM.wall; y += 16)
      for (let x = ROOM.wall; x < ROOM.w - ROOM.wall; x += 16) {
        px(c, ((x + y) / 16) % 2 ? t.a : t.b, x, y, 16, 16);
        const r = rnd();
        if (t.forest) {
          this.forestTile(c, x, y, r, rnd2);
          continue;
        }
        px(c, t.grout, x, y + 15, 16, 1);
        px(c, t.grout, x + 15, y, 1, 16);
        if (t.ice) {
          if (r < 0.14) {
            // yoriq, ichida qor
            px(c, "#6a8095", x + 3, y + 6, 6, 1);
            px(c, "#6a8095", x + 8, y + 7, 1, 3);
            px(c, "#f2f8fc", x + 4, y + 5, 3, 1);
            px(c, "#f2f8fc", x + 9, y + 8, 1, 2);
          } else if (r < 0.24) {
            // muz yaltirog'i
            px(c, "#dfeaf3", x + 3, y + 3, 4, 1);
            px(c, "#dfeaf3", x + 3, y + 4, 1, 2);
          } else if (r < 0.3) {
            // qor uyumchasi
            px(c, "#e8f1f8", x + 6, y + 10, 6, 2);
            px(c, "#ffffff", x + 7, y + 9, 3, 1);
          }
          continue;
        }
        if (r < 0.12) {
          // yoriq
          px(c, "#251d31", x + 4, y + 6, 5, 1);
          px(c, "#251d31", x + 8, y + 7, 1, 3);
        } else if (r < 0.18) {
          // tosh parchasi
          px(c, "#4a3d5c", x + 9, y + 4, 2, 2);
          px(c, "#4a3d5c", x + 3, y + 11, 1, 1);
        } else if (r < 0.21) {
          // suyak
          px(c, "#8d8a84", x + 4, y + 8, 7, 1);
          px(c, "#8d8a84", x + 3, y + 7, 2, 1);
          px(c, "#8d8a84", x + 10, y + 9, 2, 1);
        }
        if (rnd2() < t.moss) {
          // mox to'dasi
          const ox = Math.floor(rnd2() * 6),
            oy = Math.floor(rnd2() * 6);
          px(c, "#2f5a2c", x + ox, y + oy + 2, 9, 4);
          px(c, "#3f6b3a", x + ox + 1, y + oy + 1, 7, 4);
          px(c, "#4f8a45", x + ox + 2, y + oy + 1, 3, 2);
          px(c, "#3f6b3a", x + ox + 6, y + oy + 6, 3, 2);
        }
      }
    if (t === FOREST_BOSS_FLOOR) {
      // Shoh xonasi: polda yashil nur taratuvchi ildizlar
      for (let k = 0; k < 9; k++) {
        let cx = ROOM.wall + 8 + rnd2() * (ROOM.w - ROOM.wall * 2 - 16);
        let cy = ROOM.wall + 8 + rnd2() * (ROOM.h - ROOM.wall * 2 - 16);
        const dir = rnd2() * Math.PI * 2;
        for (let st = 0; st < 16 + rnd2() * 10; st++) {
          const a = dir + (rnd2() - 0.5) * 1.2;
          cx += Math.cos(a) * 2;
          cy += Math.sin(a) * 2;
          px(c, "#1a0f08", cx - 1, cy, 3, 2);
          px(c, st % 5 === 0 ? "#d8ff7a" : "#3a5a2a", cx, cy, 2, 1);
        }
      }
    }
    if (t === ICE_BOSS_FLOOR) {
      // Malika xonasi: polda muzlagan ko'k yoriqlar
      for (let k = 0; k < 8; k++) {
        let cx = ROOM.wall + 8 + rnd2() * (ROOM.w - ROOM.wall * 2 - 16);
        let cy = ROOM.wall + 8 + rnd2() * (ROOM.h - ROOM.wall * 2 - 16);
        const dir = rnd2() * Math.PI * 2;
        for (let st = 0; st < 12 + rnd2() * 10; st++) {
          const a = dir + (rnd2() - 0.5) * 1.4;
          cx += Math.cos(a) * 2;
          cy += Math.sin(a) * 2;
          px(c, "#5d7590", cx - 1, cy, 3, 1);
          px(c, st % 4 === 0 ? "#bff4ff" : "#7fc4e8", cx, cy, 2, 1);
        }
      }
    }
    if (t.red) {
      // Boss xonasi: polda qizil cho'g'li yoriqlar
      for (let k = 0; k < 9; k++) {
        let cx = ROOM.wall + 8 + rnd2() * (ROOM.w - ROOM.wall * 2 - 16);
        let cy = ROOM.wall + 8 + rnd2() * (ROOM.h - ROOM.wall * 2 - 16);
        const dir = rnd2() * Math.PI * 2;
        for (let st = 0; st < 14 + rnd2() * 10; st++) {
          const a = dir + (rnd2() - 0.5) * 1.4;
          cx += Math.cos(a) * 2;
          cy += Math.sin(a) * 2;
          px(c, "#1a0c10", cx - 1, cy, 3, 1);
          px(c, st % 4 === 0 ? "#ff6a2a" : "#b23238", cx, cy, 2, 1);
        }
      }
    }
    // devorlar
    px(c, t.wall, 0, 0, ROOM.w, ROOM.wall);
    px(c, t.wallDark, 0, ROOM.h - ROOM.wall, ROOM.w, ROOM.wall);
    px(c, t.wallDark, 0, 0, ROOM.wall, ROOM.h);
    px(c, t.wallDark, ROOM.w - ROOM.wall, 0, ROOM.wall, ROOM.h);
    if (t.forest) this.forestWalls(c, rnd2);
    else
      for (let x = 0; x < ROOM.w; x += 16) {
        px(c, t.brick, x, 2, 14, 5);
        px(c, t.brick, x + 8, 9, 14, 5);
      }
    // devor ostidagi soya
    px(c, "rgba(0,0,0,0.35)", ROOM.wall, ROOM.wall, ROOM.w - ROOM.wall * 2, 4);
    px(c, "rgba(0,0,0,0.2)", ROOM.wall, ROOM.wall, 3, ROOM.h - ROOM.wall * 2);
    px(c, "rgba(0,0,0,0.2)", ROOM.w - ROOM.wall - 3, ROOM.wall, 3, ROOM.h - ROOM.wall * 2);
    if (t.ice) {
      // devorda qor va muz sumalaklari
      px(c, "#e8f1f8", 0, 0, ROOM.w, 2);
      for (let x = 2; x < ROOM.w; x += 7 + Math.floor(rnd2() * 6)) {
        const h = 3 + Math.floor(rnd2() * 6);
        px(c, "#cfe6f5", x, ROOM.wall, 2, h);
        px(c, "#ffffff", x, ROOM.wall, 1, Math.max(1, h - 2));
        px(c, "#cfe6f5", x, ROOM.wall + h, 1, 1);
      }
      // kristall tagliklari
      for (const tx of [64, 160, 256]) px(c, "#3b4d63", tx - 3, 10, 6, 4);
    }
    // mash'ala tutqichlari (o'rmonda mash'ala o'rniga svetlyachoklar)
    else if (!t.forest) for (const tx of [64, 160, 256]) px(c, "#2a1f38", tx - 2, 8, 4, 6);
    this.floor = cv;
    this.floorKey = index;
  }

  /** O'rmon tuprog'i: ildizlar, qo'ziqorinchalar, o't tutamlari, xazon barglar. */
  private forestTile(
    c: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    rnd: () => number,
  ) {
    if (r < 0.1) {
      // ildiz
      px(c, "#120c07", x, y + 10, 12, 2);
      px(c, "#3a2817", x + 1, y + 9, 10, 2);
      px(c, "#4a3420", x + 2, y + 9, 6, 1);
      px(c, "#3a2817", x + 10, y + 6, 2, 4);
    } else if (r < 0.16) {
      // qo'ziqorincha
      const red = rnd() < 0.5;
      px(c, "#e8dcc0", x + 7, y + 8, 2, 3);
      px(c, red ? "#b23238" : "#7a2fa0", x + 5, y + 6, 6, 2);
      px(c, "#f2fbe4", x + 6, y + 6, 1, 1);
      px(c, "#0b0710", x + 5, y + 11, 6, 1);
    } else if (r < 0.26) {
      // o't tutami
      px(c, "#2f5a2c", x + 4, y + 9, 1, 3);
      px(c, "#3f6b3a", x + 6, y + 8, 1, 4);
      px(c, "#2f5a2c", x + 8, y + 10, 1, 2);
    } else if (r < 0.32) {
      // xazon barglar
      px(c, "#5a3a1a", x + 3, y + 4, 2, 1);
      px(c, "#7a4a24", x + 10, y + 11, 2, 1);
    } else if (r < 0.36) {
      // tosh
      px(c, "#2a3328", x + 9, y + 3, 3, 2);
    }
    // tuproq dog'lari
    px(c, "#232d20", x + Math.floor(rnd() * 14), y + Math.floor(rnd() * 14), 2, 1);
    px(c, "#121810", x + Math.floor(rnd() * 14), y + Math.floor(rnd() * 14), 1, 1);
  }

  /** O'rmon devorlari: g'isht o'rniga daraxt tanalari, tepada barglar. */
  private forestWalls(c: CanvasRenderingContext2D, rnd: () => number) {
    const trunk = (x: number, y: number, w: number, h: number, vertical: boolean) => {
      px(c, "#3a2817", x, y, w, h);
      if (vertical) {
        px(c, "#4a3420", x + 1, y, 2, h);
        px(c, "#2a1d12", x + Math.floor(w / 2), y, 1, h);
        px(c, "#2a1d12", x + w - 3, y + 2, 1, h - 4);
      } else {
        px(c, "#4a3420", x, y + 1, w, 2);
        px(c, "#2a1d12", x, y + Math.floor(h / 2), w, 1);
        px(c, "#2a1d12", x + 2, y + h - 3, w - 4, 1);
      }
      // butoq izi
      const kx = x + Math.floor(rnd() * Math.max(1, w - 4)),
        ky = y + Math.floor(rnd() * Math.max(1, h - 4));
      px(c, "#20160d", kx, ky, 3, 2);
      px(c, "#5a3e24", kx + 1, ky, 1, 1);
    };
    // tepada va pastda tik daraxt tanalari
    for (let x = -4; x < ROOM.w; x += 18) {
      trunk(x, 0, 13, ROOM.wall, true);
      trunk(x + 6, ROOM.h - ROOM.wall, 12, ROOM.wall, true);
    }
    // chap va o'ng devorda yotgan tanalar
    for (let y = 0; y < ROOM.h; y += 20) {
      trunk(1, y, ROOM.wall - 2, 14, false);
      trunk(ROOM.w - ROOM.wall + 1, y + 8, ROOM.wall - 2, 14, false);
    }
    // eng tepada barglar
    px(c, "#14261a", 0, 0, ROOM.w, 3);
    for (let x = 0; x < ROOM.w; x += 5) px(c, x % 3 ? "#1f3d22" : "#2f5a2c", x, 2 + (x % 4), 4, 2);
    // devordan polga o'tgan ildizlar
    for (let k = 0; k < 10; k++) {
      const x = ROOM.wall + 10 + Math.floor(rnd() * (ROOM.w - ROOM.wall * 2 - 20));
      const len = 4 + Math.floor(rnd() * 8);
      px(c, "#2a1a10", x, ROOM.wall, 2, len);
      px(c, "#3a2817", x + 1, ROOM.wall + len - 1, 3, 1);
    }
  }

  private renderRoom(c: CanvasRenderingContext2D) {
    const fi = this.floorIndex();
    if (!this.floor || this.floorKey !== fi) this.buildFloor(fi);
    c.drawImage(this.floor!, 0, 0);
    if (this.chapter === 3) {
      // mash'alalar o'rniga yashil-sariq svetlyachok to'dalari
      for (const [i, tx] of [64, 160, 256].entries()) {
        const fl = Math.sin(this.time * 1.7 + i * 2);
        const g = c.createRadialGradient(tx, 12, 2, tx, 12, 40 + fl * 4);
        g.addColorStop(0, "rgba(200,255,120,0.2)");
        g.addColorStop(1, "rgba(200,255,120,0)");
        c.fillStyle = g;
        c.fillRect(tx - 50, 0, 100, 64);
        for (let k = 0; k < 4; k++) {
          const a = this.time * (1.3 + k * 0.4) + k * 1.6 + i;
          const on = Math.sin(this.time * 4 + k * 2 + i) > -0.3;
          if (on)
            px(
              c,
              k % 2 ? "#e8ff8a" : "#a6f08e",
              tx + Math.cos(a) * (4 + k * 2),
              11 + Math.sin(a * 1.4) * 4,
              1,
              1,
            );
        }
      }
      return;
    }
    if (this.chapter === 2) {
      // mash'alalar o'rniga sovuq ko'k kristallar
      for (const [i, tx] of [64, 160, 256].entries()) {
        const fl = Math.sin(this.time * 2.5 + i * 2);
        const g = c.createRadialGradient(tx, 10, 2, tx, 10, 44 + fl * 3);
        g.addColorStop(0, "rgba(120,210,255,0.24)");
        g.addColorStop(1, "rgba(120,210,255,0)");
        c.fillStyle = g;
        c.fillRect(tx - 50, 0, 100, 64);
        px(c, "#4a8fd0", tx - 2, 3, 4, 7);
        px(c, "#7fe9ff", tx - 1, 2, 2, 7);
        px(c, fl > 0.6 ? "#ffffff" : "#c9f6ff", tx - 1, 3, 1, 2);
      }
      return;
    }
    // mash'alalar
    for (const [i, tx] of [64, 160, 256].entries()) {
      const fl = Math.sin(this.time * 9 + i * 2) + Math.sin(this.time * 13 + i);
      const g = c.createRadialGradient(tx, 14, 2, tx, 14, 46 + fl * 2);
      g.addColorStop(0, "rgba(255,170,60,0.22)");
      g.addColorStop(1, "rgba(255,170,60,0)");
      c.fillStyle = g;
      c.fillRect(tx - 50, 0, 100, 64);
      px(c, "#ff9a3c", tx - 2, 4 + (fl > 0 ? 0 : 1), 4, 4);
      px(c, "#ffe14d", tx - 1, 5 + (fl > 0 ? 0 : 1), 2, 3);
    }
  }

  private shadow(c: CanvasRenderingContext2D, x: number, y: number, w: number) {
    c.fillStyle = "rgba(0,0,0,0.32)";
    c.beginPath();
    c.ellipse(Math.round(x), Math.round(y), w / 2, w / 5, 0, 0, Math.PI * 2);
    c.fill();
  }

  private renderSlash(c: CanvasRenderingContext2D) {
    const p = this.player;
    if (p.dead) return;
    // kuchli zarba yig'ilishi: o'yinchi atrofida to'lib boruvchi halqa
    if (p.charge > 0.12) {
      const k = Math.min(1, p.charge / CHARGE_TIME);
      const full = k >= 1;
      c.strokeStyle = chargeRingColor(this.hero, full, this.time);
      c.lineWidth = full ? 2 : 1;
      c.beginPath();
      c.arc(p.x, p.y, 13, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k);
      c.stroke();
    }
    // Ovchining kuchli o'qi va Merganning yelpig'ich o'qlari uchib ketadi — atrofda halqa yo'q
    if (p.spinning && (p.hunter || p.gunner)) return;
    if (p.spinning && p.mage) {
      // sehrli halqa: kengayib boruvchi qizil-qora to'lqin
      const k = p.spinTimer / SPIN_TIME;
      const r = p.reach * 1.2 * (1.15 - k * 0.5);
      c.strokeStyle = `rgba(20,10,16,${0.3 + 0.5 * k})`;
      c.lineWidth = 4;
      c.beginPath();
      c.arc(p.x, p.y, r + 1, 0, Math.PI * 2);
      c.stroke();
      c.strokeStyle = `rgba(214,40,50,${0.4 + 0.6 * k})`;
      c.lineWidth = 2;
      c.beginPath();
      // to'lqinsimon chekka
      for (let i = 0; i <= 48; i++) {
        const a = (i / 48) * Math.PI * 2;
        const rr = r + Math.sin(a * 8 + this.time * 20) * 1.5;
        if (i) c.lineTo(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr);
        else c.moveTo(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr);
      }
      c.stroke();
      c.strokeStyle = `rgba(255,120,80,${0.2 + 0.4 * k})`;
      c.lineWidth = 1;
      c.beginPath();
      c.arc(p.x, p.y, r * 0.7, 0, Math.PI * 2);
      c.stroke();
      return;
    }
    if (p.spinning) {
      const k = p.spinTimer / SPIN_TIME;
      const r = p.reach * 1.2;
      const a0 = (1 - k) * Math.PI * 4;
      c.strokeStyle = `rgba(255,255,255,${0.85 * k})`;
      c.lineWidth = 2;
      c.beginPath();
      c.arc(p.x, p.y, r, a0, a0 + Math.PI * 1.6);
      c.stroke();
      c.strokeStyle = withAlpha(HERO_THEME[this.hero].accent, 0.6 * k);
      c.lineWidth = 1;
      c.beginPath();
      c.arc(p.x, p.y, r * 0.75, 0, Math.PI * 2);
      c.stroke();
      return;
    }
    if (p.attackTimer <= 0 || p.ranged) return;
    const k = p.attackTimer / 0.24;
    const ang = Math.atan2(p.fy, p.fx);
    c.strokeStyle = `rgba(255,255,255,${0.75 * k})`;
    c.lineWidth = 2;
    c.beginPath();
    c.arc(p.x, p.y, p.reach * 0.95, ang - 1.1 + (1 - k) * 0.6, ang + 1.1 - (1 - k) * 0.2);
    c.stroke();
    c.strokeStyle = `rgba(104,205,228,${0.5 * k})`;
    c.lineWidth = 1;
    c.beginPath();
    c.arc(p.x, p.y, p.reach * 0.7, ang - 0.9, ang + 0.9);
    c.stroke();
  }

  render() {
    const c = this.ctx;
    // Fit the unchanged logical room uniformly inside the drawing buffer.
    c.clearRect(0, 0, c.canvas.width, c.canvas.height);
    const scale = Math.min(c.canvas.width / ROOM.w, c.canvas.height / ROOM.h);
    c.save();
    c.translate((c.canvas.width - ROOM.w * scale) / 2, (c.canvas.height - ROOM.h * scale) / 2);
    c.scale(scale, scale);
    c.save();
    // xona tashqarisi ko'rinmasligi uchun silkinish xona ichida kesiladi
    c.beginPath();
    c.rect(0, 0, ROOM.w, ROOM.h);
    c.clip();
    if (this.fx.shake > 0 && !this.paused && this.shakeOn) {
      const s = Math.min(1, this.fx.shake * 6) * 3;
      c.translate(Math.round((Math.random() - 0.5) * s), Math.round((Math.random() - 0.5) * s));
    }
    this.renderRoom(c);

    // yurak tushumlari
    for (const d of this.drops) {
      if (d.life < 2 && Math.floor(d.life * 8) % 2) continue;
      const y = d.y + Math.round(Math.sin(this.time * 4 + d.x) * 1.5);
      this.shadow(c, d.x, d.y + 6, 7);
      this.heart(c, d.x - 4, y - 4, "#ff4d6d");
    }
    // oltin tangalar
    for (const co of this.coins) {
      if (co.life < 2 && Math.floor(co.life * 8) % 2) continue;
      const y = co.y + Math.round(Math.sin(this.time * 5 + co.x) * 1.5);
      this.shadow(c, co.x, co.y + 5, 6);
      this.coin(c, co.x - 3, y - 3, Math.floor(this.time * 6 + co.x) % 4);
    }

    // Malikaning poldagi ogohlantirish doiralari va nayzalari, Shohning ildizlari
    if (this.boss instanceof Queen || this.boss instanceof ForestKing) this.boss.renderFloor(c);
    // yerdagi to'rlar, ildiz yoriqlari va boyo'g'li soyalari
    for (const w of this.webs) if (!w.flying) this.renderWeb(c, w);
    for (const t of this.traps) if (t.snapT < 0) this.renderTrap(c, t);
    for (const e of this.enemies) e.renderFloor(c);

    // chuqurlik bo'yicha tartib
    const p = this.player;
    const all: { y: number; r: () => void }[] = this.enemies.map((e) => ({
      y: e.y,
      r: () => {
        if (!e.dead)
          this.shadow(
            c,
            e.x,
            e.y + (e.kind === "wisp" || e.kind === "frost" ? 11 : e.size / 2 + 1),
            // baland uchayotgan boyo'g'lining soyasi kichikroq
            e.kind === "owl" ? e.size * (1 - (e.alt / OWL_ALT) * 0.45) : e.size,
          );
        e.render(c);
        // Merganda sekinlashish faqat tutundan — muz uchqunlari chizilmaydi
        if (e.slow > 0 && !e.dead && !p.gunner) this.frost(c, e.x, e.y, e.size);
      },
    }));
    const boss = this.boss;
    if (boss)
      all.push({
        y: boss.y,
        r: () => {
          if (!boss.dead) this.shadow(c, boss.x, boss.y + 24, 30);
          boss.render(c);
          if (boss.slow > 0 && !boss.dead && !p.gunner) this.frost(c, boss.x, boss.y, boss.size);
        },
      });
    const ch = this.chest;
    if (ch) all.push({ y: ch.y, r: () => this.renderChest(c, ch) });
    // yopilgan tuzoq dushman oyog'ida, uning ustida chiziladi
    for (const t of this.traps)
      if (t.snapT >= 0) all.push({ y: t.y + 0.5, r: () => this.renderTrap(c, t) });
    if (this.phase !== "attempt" || !p.dead)
      all.push({
        y: p.y,
        r: () => {
          if (!p.dead) this.shadow(c, p.x, p.y + 12, 12);
          p.render(c);
          // sovuq nafasdan sekinlashgan
          if (p.chill > 0 && !p.dead) this.frost(c, p.x, p.y, p.size);
        },
      });
    all.sort((a, b) => a.y - b.y).forEach((o) => o.r());

    this.renderSlash(c);
    for (const s of this.shots) {
      if (s.arrow) {
        // qora suyak o'qi: qora tayoq, qizil uchi, kulrang pat
        const l = Math.hypot(s.vx, s.vy) || 1;
        const ux = s.vx / l,
          uy = s.vy / l;
        for (let k = -4; k <= 1; k++) px(c, "#0b0a10", s.x + ux * k, s.y + uy * k, 1, 1);
        px(c, "#ff3b3b", s.x + ux * 2 - 0.5, s.y + uy * 2 - 0.5, 2, 2);
        px(c, "#8a88a3", s.x - ux * 5 - uy, s.y - uy * 5 + ux, 1, 1);
        px(c, "#8a88a3", s.x - ux * 5 + uy, s.y - uy * 5 - ux, 1, 1);
        continue;
      }
      c.fillStyle = "rgba(255,120,40,0.35)";
      c.beginPath();
      c.arc(s.x, s.y, 5, 0, Math.PI * 2);
      c.fill();
      px(c, "#ff6a2a", s.x - 2, s.y - 2, 4, 4);
      px(c, "#ffe14d", s.x - 1, s.y - 1, 2, 2);
    }
    for (const b of this.bolts) {
      if (b.arrow) {
        this.renderArrow(c, b);
        continue;
      }
      if (b.bullet) {
        this.renderBullet(c, b);
        continue;
      }
      // sehrli shar: och qizil/to'q sariq chekka, to'q qizil yadro
      c.fillStyle = "rgba(255,110,50,0.4)";
      c.beginPath();
      c.arc(b.x, b.y, b.size - 1, 0, Math.PI * 2);
      c.fill();
      const h = Math.round(b.size / 3);
      px(c, "#ff5a3c", b.x - h - 1, b.y - h, h * 2 + 2, h * 2);
      px(c, "#ff5a3c", b.x - h, b.y - h - 1, h * 2, h * 2 + 2);
      px(c, "#a3192a", b.x - h, b.y - h, h * 2, h * 2);
      px(c, "#ffb36b", b.x - h, b.y - h, 1, 1);
    }
    for (const w of this.webs) if (w.flying) this.renderWeb(c, w);
    for (const cl of this.clouds) this.renderCloud(c, cl);
    for (const sm of this.smokes) this.renderSmoke(c, sm);
    this.fx.renderParticles(c);
    if (this.darkness > 0) {
      // O'rmon Shohi g'azabi: faqat o'yinchi atrofi yorug'
      const g = c.createRadialGradient(p.x, p.y, KING_LIGHT * 0.4, p.x, p.y, KING_LIGHT);
      g.addColorStop(0, "rgba(2,6,3,0)");
      g.addColorStop(1, `rgba(2,6,3,${0.88 * this.darkness})`);
      c.fillStyle = g;
      c.fillRect(0, 0, ROOM.w, ROOM.h);
      if (boss instanceof ForestKing) boss.renderEyes(c);
    }
    if (this.chapter === 3) this.renderFireflies(c);
    this.fx.renderSnow(c);
    this.fx.renderTexts((s, x, y, color, a) => {
      c.globalAlpha = a;
      this.text(s, x, y, 6, color);
      c.globalAlpha = 1;
    });

    // vinyetka
    const v = c.createRadialGradient(ROOM.w / 2, ROOM.h / 2, 90, ROOM.w / 2, ROOM.h / 2, 210);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(0,0,0,0.45)");
    c.fillStyle = v;
    c.fillRect(0, 0, ROOM.w, ROOM.h);
    // past HP — qizil chekka
    if (p.hp === 1 && !p.dead) {
      c.fillStyle = `rgba(200,0,30,${0.12 + 0.08 * Math.sin(this.time * 6)})`;
      c.fillRect(0, 0, ROOM.w, ROOM.h);
    }
    c.restore();

    this.renderHud();
    this.renderOverlays();
    this.renderToast();
    c.restore();
  }

  /** Ovchi o'qi: jigarrang dasta, temir uch, yashil pat; kuchli o'q kattaroq va yashil nurli. */
  private renderArrow(c: CanvasRenderingContext2D, b: Bolt) {
    const l = Math.hypot(b.vx, b.vy) || 1;
    const ux = b.vx / l,
      uy = b.vy / l;
    const strong = (b.power ?? 1) > 1;
    const len = strong ? 9 : 6;
    if (strong) {
      c.fillStyle = "rgba(166,240,142,0.35)";
      c.beginPath();
      c.arc(b.x, b.y, 5, 0, Math.PI * 2);
      c.fill();
    }
    for (let k = -len; k <= 1; k++)
      px(c, strong ? "#c9a26b" : "#7a4a24", b.x + ux * k, b.y + uy * k, 1, 1);
    px(c, "#d9d4e0", b.x + ux * 2 - 0.5, b.y + uy * 2 - 0.5, 2, 2);
    if (b.poison) px(c, "#a6f08e", b.x + ux * 2, b.y + uy * 2, 1, 1);
    const fx = b.x - ux * len,
      fy = b.y - uy * len;
    px(c, "#4f8a3a", fx - uy, fy + ux, 1, 1);
    px(c, "#4f8a3a", fx + uy, fy - ux, 1, 1);
    px(c, "#7bd14f", fx - uy - ux, fy + ux - uy, 1, 1);
    px(c, "#7bd14f", fx + uy - ux, fy - ux - uy, 1, 1);
  }

  /** Mergan o'qi: yaltiroq mis o'q va orqasida qisqa iz. */
  private renderBullet(c: CanvasRenderingContext2D, b: Bolt) {
    const l = Math.hypot(b.vx, b.vy) || 1;
    const ux = b.vx / l,
      uy = b.vy / l;
    for (let k = 2; k <= 5; k++)
      px(c, k < 4 ? "#d9a441" : "#8a5a2a", b.x - ux * k - 0.5, b.y - uy * k - 0.5, 1, 1);
    px(c, "#0b0907", b.x - 1.5, b.y - 1.5, 3, 3);
    px(c, "#ffe2a0", b.x - 1, b.y - 1, 2, 2);
  }

  /** Tutun bombasi: sekin aylanuvchi quyuq kulrang tutun, chetlari so'nib boradi. */
  private renderSmoke(c: CanvasRenderingContext2D, sm: Smoke) {
    const a = Math.min(1, sm.life * 1.5, (SMOKE_LIFE - sm.life) * 6);
    for (let k = 0; k < 8; k++) {
      const ang = this.time * 0.6 + k * 0.8;
      const r = k === 0 ? 0 : SMOKE_RADIUS * 0.5;
      c.fillStyle = `rgba(${k % 2 ? "120,114,106" : "168,160,150"},${0.34 * a})`;
      c.beginPath();
      c.arc(
        sm.x + Math.cos(ang) * r,
        sm.y + Math.sin(ang) * r * 0.75,
        SMOKE_RADIUS * 0.55,
        0,
        Math.PI * 2,
      );
      c.fill();
    }
    for (let k = 0; k < 5; k++) {
      const ang = this.time * 1.3 + k * 1.7;
      px(
        c,
        "#d9d2c6",
        sm.x + Math.cos(ang) * (6 + k * 4),
        sm.y - 6 + Math.sin(ang * 1.2) * 9,
        2,
        1,
      );
    }
  }

  /** Ovchi tuzog'i: ochiq — tishli temir jag'lar, yopilgan — dushman oyog'ida. */
  private renderTrap(c: CanvasRenderingContext2D, t: Trap) {
    const x = Math.round(t.x),
      y = Math.round(t.y);
    if (t.snapT >= 0) {
      const a = Math.min(1, (TRAP_STUN - t.snapT) * 3);
      c.globalAlpha = a;
      px(c, "#1a1a20", x - 6, y - 2, 13, 5);
      px(c, "#9a9ea8", x - 5, y - 1, 11, 3);
      for (let k = -4; k <= 4; k += 2) px(c, "#e8e8f0", x + k, y - 2, 1, 1);
      c.globalAlpha = 1;
      return;
    }
    if (t.life < 2 && Math.floor(t.life * 8) % 2) return;
    // halqa va zanjir
    px(c, "#1a1a20", x - 7, y - 4, 15, 9);
    px(c, "#5a3e24", x - 6, y - 3, 13, 7);
    px(c, "#9a9ea8", x - 6, y - 3, 13, 1);
    px(c, "#9a9ea8", x - 6, y + 3, 13, 1);
    px(c, "#9a9ea8", x - 6, y - 3, 1, 7);
    px(c, "#9a9ea8", x + 6, y - 3, 1, 7);
    for (let k = -4; k <= 4; k += 2) {
      px(c, "#e8e8f0", x + k, y - 2, 1, 2);
      px(c, "#e8e8f0", x + k, y + 1, 1, 2);
    }
    px(c, "#c9a26b", x - 1, y - 1, 3, 3);
  }

  /** O'rgimchak to'ri: uchayotganda kichik to'p, yerda nurli to'r. */
  private renderWeb(c: CanvasRenderingContext2D, w: Web) {
    const x = Math.round(w.x),
      y = Math.round(w.y + 4);
    if (w.flying) {
      // yoy bo'lib uchadi: yerda soyasi, tepada to'r to'pi
      const k = w.dist ? 1 - Math.hypot(w.tx - w.x, w.ty - w.y) / w.dist : 1;
      const h = Math.round(Math.sin(Math.PI * Math.max(0, Math.min(1, k))) * 16);
      px(c, "rgba(0,0,0,0.3)", x - 2, y + 1, 5, 2);
      px(c, "#1a1520", x - 2, y - 2 - h, 5, 5);
      px(c, "#e8e4f0", x - 1, y - 1 - h, 3, 3);
      return;
    }
    c.globalAlpha = Math.min(1, w.life * 2) * 0.85;
    c.fillStyle = "#e8e4f0";
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      for (let r = 2; r <= WEB_RADIUS; r += 2)
        c.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r * 0.7), 1, 1);
    }
    for (const r of [4, 8])
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        c.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r * 0.7), 1, 1);
      }
    c.globalAlpha = 1;
  }

  /** Zaharli bulut: sekin aylanuvchi yashil tutun. */
  private renderCloud(c: CanvasRenderingContext2D, cl: Cloud) {
    const a = Math.min(1, cl.life * 2, (CLOUD_LIFE - cl.life) * 5);
    for (let k = 0; k < 7; k++) {
      const ang = this.time * 0.8 + k * 0.9;
      const r = k === 0 ? 0 : CLOUD_RADIUS * 0.55;
      c.fillStyle = `rgba(${k % 2 ? "120,200,60" : "160,230,90"},${0.22 * a})`;
      c.beginPath();
      c.arc(
        cl.x + Math.cos(ang) * r,
        cl.y + Math.sin(ang) * r * 0.7,
        CLOUD_RADIUS * 0.5,
        0,
        Math.PI * 2,
      );
      c.fill();
    }
    c.strokeStyle = `rgba(166,240,142,${0.35 * a})`;
    c.lineWidth = 1;
    c.beginPath();
    c.arc(cl.x, cl.y, CLOUD_RADIUS, 0, Math.PI * 2);
    c.stroke();
    for (let k = 0; k < 6; k++) {
      const ang = this.time * 1.6 + k;
      px(c, "#d8ff7a", cl.x + Math.cos(ang) * (k * 4), cl.y - 4 + Math.sin(ang * 1.3) * 8, 1, 1);
    }
  }

  /** 3-dunyo: xona bo'ylab uchib yuradigan miltillovchi svetlyachoklar. */
  private renderFireflies(c: CanvasRenderingContext2D) {
    for (let i = 0; i < 12; i++) {
      const x = 30 + ((i * 53) % 260) + Math.sin(this.time * 0.5 + i) * 18;
      const y = 40 + ((i * 71) % 170) + Math.cos(this.time * 0.7 + i * 2) * 12;
      const b = Math.max(0, Math.sin(this.time * 2.3 + i * 1.7));
      if (b <= 0.05) continue;
      c.fillStyle = `rgba(210,255,120,${0.22 * b})`;
      c.fillRect(Math.round(x) - 2, Math.round(y) - 2, 5, 5);
      c.globalAlpha = b;
      px(c, i % 3 ? "#e8ff8a" : "#a6f08e", x, y, 1, 1);
      c.globalAlpha = 1;
    }
  }

  /** Kod bilan chizilgan sandiq: yog'och, temir tasmalar, oltin qulf; ochilganda qopqoq ko'tariladi. */
  private renderChest(c: CanvasRenderingContext2D, ch: Chest) {
    this.shadow(c, ch.x, ch.y + 7, 18);
    const shake = ch.hitFlash > 0 ? (Math.floor(ch.hitFlash * 60) % 2 ? 1 : -1) : 0;
    const x = Math.round(ch.x - 8) + shake,
      y = Math.round(ch.y - 5);
    const k = ch.openT < 0 ? 0 : Math.min(1, ch.openT / 0.3);
    if (k > 0) {
      // ochiq qopqoq orqada, ichida oltin yaltiraydi
      const lid = Math.round(k * 4);
      px(c, "#2a1a10", x, y - lid, 16, 4 + lid);
      px(c, "#5a3418", x + 1, y - lid + 1, 14, 2 + lid);
      px(c, "#9a9ea8", x + 3, y - lid, 2, 4 + lid);
      px(c, "#9a9ea8", x + 11, y - lid, 2, 4 + lid);
      const g = 0.35 + 0.25 * Math.sin(this.time * 10);
      c.fillStyle = `rgba(255,214,90,${g})`;
      c.beginPath();
      c.ellipse(x + 8, y + 2, 12, 7, 0, 0, Math.PI * 2);
      c.fill();
      px(c, "#ffcc33", x + 2, y + 2, 12, 3);
      px(c, "#fff2a8", x + 4, y + 2, 2, 1);
      px(c, "#fff2a8", x + 10, y + 3, 1, 1);
    }
    // quti
    px(c, "#2a1a10", x, y + 4, 16, 8);
    px(c, "#7a4a24", x + 1, y + 5, 14, 6);
    px(c, "#5a3418", x + 1, y + 8, 14, 1);
    if (k === 0) {
      // yopiq qopqoq
      px(c, "#2a1a10", x, y, 16, 5);
      px(c, "#9a5e2e", x + 1, y + 1, 14, 3);
      px(c, "#b87a42", x + 1, y + 1, 14, 1);
    }
    // temir tasmalar va oltin qulf
    px(c, "#9a9ea8", x + 3, y + (k ? 4 : 0), 2, k ? 8 : 12);
    px(c, "#9a9ea8", x + 11, y + (k ? 4 : 0), 2, k ? 8 : 12);
    px(c, "#ffcc33", x + 7, y + 4, 2, 3);
    px(c, "#a8741a", x + 7, y + 6, 2, 1);
    if (ch.hitFlash > 0) {
      c.fillStyle = "rgba(255,255,255,0.45)";
      c.fillRect(x, y, 16, 12);
    }
  }

  /** Muz qalqonidan sekinlashgan dushman atrofida muz uchqunlari. */
  private frost(c: CanvasRenderingContext2D, x: number, y: number, size: number) {
    const r = size / 2 + 3;
    c.fillStyle = "rgba(155,231,255,0.3)";
    c.beginPath();
    c.ellipse(Math.round(x), Math.round(y), r, r * 0.8, 0, 0, Math.PI * 2);
    c.fill();
    for (let i = 0; i < 4; i++) {
      const a = this.time * 2 + (i * Math.PI) / 2;
      const fx = x + Math.cos(a) * r,
        fy = y + Math.sin(a) * r * 0.7;
      px(c, "#c9f3ff", fx - 1, fy, 3, 1);
      px(c, "#c9f3ff", fx, fy - 1, 1, 3);
    }
  }

  private heart(c: CanvasRenderingContext2D, x: number, y: number, color: string) {
    px(c, color, x + 1, y, 2, 1);
    px(c, color, x + 5, y, 2, 1);
    px(c, color, x, y + 1, 8, 3);
    px(c, color, x + 1, y + 4, 6, 1);
    px(c, color, x + 2, y + 5, 4, 1);
    px(c, color, x + 3, y + 6, 2, 1);
  }

  /** 6x6 piksel tanga; frame — aylanish kadri (0 va 2 — to'liq, 1 va 3 — yonidan). */
  private coin(c: CanvasRenderingContext2D, x: number, y: number, frame = 0) {
    if (frame % 2) {
      px(c, "#a8741a", x + 2, y, 2, 6);
      px(c, "#ffcc33", x + 2, y + 1, 1, 4);
      return;
    }
    px(c, "#a8741a", x + 1, y, 4, 6);
    px(c, "#a8741a", x, y + 1, 6, 4);
    px(c, "#ffcc33", x + 1, y + 1, 4, 4);
    px(c, "#fff2a8", x + 1, y + 1, 1, 2);
    px(c, "#a8741a", x + 3, y + 2, 1, 2);
  }

  private renderHud() {
    const c = this.ctx;
    const p = this.player;
    for (let i = 0; i < p.maxHp; i++) {
      const on = i < p.hp;
      this.heart(c, 4 + i * 10, 4, on ? "#ff4d6d" : "#3b2a3a");
      if (on) px(c, "#ffb3c1", 5 + i * 10, 5, 1, 1);
    }
    // dash tayyorligi
    const k = Math.max(0, Math.min(1, 1 - p.dashCooldown / p.dashCd));
    px(c, "#000", 4, 13, 32, 3);
    // dash va kuchli zarba chiziqlari qahramon rangida (hero.ts: HERO_THEME)
    const { on, off, empty } = hudBarColors(this.hero);
    px(c, k >= 1 ? on : off, 5, 14, 30 * k, 1);
    if (p.dashMax > 1)
      for (let i = 0; i < p.dashMax; i++)
        px(c, i < p.dashCharges ? on : empty, 38 + i * 4, 13, 3, 3);
    // kuchli zarba tayyorligi
    const sk = Math.max(0, Math.min(1, 1 - p.spinCooldown / p.spinCd));
    px(c, "#000", 4, 17, 32, 3);
    px(
      c,
      p.charged && Math.floor(this.time * 12) % 2 ? "#ffffff" : sk >= 1 ? on : off,
      5,
      18,
      30 * sk,
      1,
    );
    if (p.hunter) {
      // tuzoq tayyorligi: kichik temir jag' belgisi va chiziq
      const tk = Math.max(0, Math.min(1, 1 - p.trapCooldown / p.trapCd));
      px(c, "#000", 4, 21, 32, 3);
      px(c, tk >= 1 ? "#c9a26b" : "#5a3e24", 5, 22, 30 * tk, 1);
      if (tk >= 1) {
        px(c, "#9a9ea8", 38, 20, 5, 1);
        px(c, "#9a9ea8", 38, 23, 5, 1);
        px(c, "#e8e8f0", 39, 21, 1, 2);
        px(c, "#e8e8f0", 41, 21, 1, 2);
      }
    }
    if (p.gunner) this.renderGunHud(p);

    this.text(
      isBossWave(this.wave)
        ? "BOSS"
        : this.endless
          ? `CHEKSIZ ${endlessNumber(this.wave)}`
          : `TO'LQIN ${Math.max(0, this.wave) + 1}/${TOTAL_WAVES}`,
      ROOM.w / 2,
      11,
      7,
      "#e0d6ee",
    );
    if (this.chapter > 1)
      this.text(`${this.chapter}-DUNYO`, ROOM.w / 2, 20, 5, WORLD_COLORS[this.chapter]);
    this.text(String(this.score).padStart(6, "0"), ROOM.w - 4, 11, 7, "#ffcc33", "right");
    if (this.combo >= 2) this.text(`KOMBO x${this.combo}`, ROOM.w - 4, 21, 5, "#ff9a3c", "right");
    this.text(
      this.daily ? `KUNLIK ${this.daily}` : `URINISH ${this.attempt}`,
      4,
      ROOM.h - 5,
      5,
      "rgba(224,214,238,0.7)",
      "left",
    );
    // terilgan oltin — o'ng pastki burchakda (yakun ekranlarida alohida ko'rsatiladi)
    if (this.phase === "play") {
      this.coin(c, ROOM.w - 10, ROOM.h - 11);
      this.text(String(this.runGold), ROOM.w - 13, ROOM.h - 5, 5, "#ffcc33", "right");
    }

    const boss = this.boss;
    if (boss && isBossWave(this.wave) && !(boss.dead && boss.anim.done)) {
      const bw = 140,
        bx = (ROOM.w - bw) / 2,
        by = ROOM.h - 10;
      const queen = boss instanceof Queen;
      const king = boss instanceof ForestKing;
      this.text(
        king ? "O'RMON SHOHI" : queen ? "QOR MALIKASI" : "IBLIS",
        ROOM.w / 2,
        by - 2,
        5,
        boss.enraged ? (king ? "#d8ff7a" : queen ? "#a8eeff" : "#ff6a6a") : "#e0d6ee",
      );
      px(c, "#000", bx - 1, by, bw + 2, 6);
      px(
        c,
        king
          ? boss.enraged
            ? "#d8ff7a"
            : "#4f8a3a"
          : queen
            ? boss.enraged
              ? "#7fe9ff"
              : "#4a8fd0"
            : boss.enraged
              ? "#b23238"
              : "#8e44ad",
        bx,
        by + 1,
        (bw * Math.max(0, boss.hp)) / boss.maxHp,
        4,
      );
      px(c, "rgba(255,255,255,0.25)", bx, by + 1, (bw * Math.max(0, boss.hp)) / boss.maxHp, 1);
    }

    if (this.hintsVisible()) this.renderHints();

    // pauzada banner pauza oynasi ustidan ko'rinmasin
    if (this.banner.timer > 0 && this.phase === "play" && this.stage === "fight" && !this.paused) {
      const a = Math.min(1, this.banner.timer * 2);
      c.globalAlpha = a;
      px(c, "rgba(0,0,0,0.55)", 0, 92, ROOM.w, this.banner.sub ? 40 : 28);
      this.text(this.banner.title, ROOM.w / 2, 112, 12, "#ffcc33");
      if (this.banner.sub) this.text(this.banner.sub, ROOM.w / 2, 126, 6, "#e0d6ee");
      c.globalAlpha = 1;
    }
  }

  /**
   * Merganning HUD qismi: tutun bombasi chizig'i (kulrang), barabandagi o'qlar (otilgani xira)
   * va qayta o'qlash chizig'i.
   */
  private renderGunHud(p: Game["player"]) {
    const c = this.ctx;
    const theme = HERO_THEME.gunner;
    const sk = Math.max(0, Math.min(1, 1 - p.smokeCooldown / p.smokeCd));
    px(c, "#000", 4, 21, 32, 3);
    px(c, sk >= 1 ? "#c8c0b4" : "#5a544c", 5, 22, 30 * sk, 1);
    for (let i = 0; i < p.ammoMax; i++) {
      const full = i < p.ammo;
      const x = 4 + i * 5,
        y = 26;
      px(c, "#000", x, y, 4, 7);
      px(c, full ? theme.glow : "#3a332b", x + 1, y + 1, 2, 1);
      px(c, full ? theme.accent : "#2e2820", x + 1, y + 2, 2, 3);
      px(c, full ? theme.accentDark : "#241f19", x + 1, y + 5, 2, 1);
    }
    if (p.reloading) {
      const k = Math.max(0, Math.min(1, 1 - p.reloadT / p.reloadTime));
      px(c, "#000", 4, 34, 32, 3);
      px(c, Math.floor(this.time * 10) % 2 ? theme.glow : theme.accent, 5, 35, 30 * k, 1);
    }
  }

  /** Birinchi o'yin ko'rsatmalari: HUD chiziqlari ostida, chap tomonda. */
  private renderHints() {
    const c = this.ctx;
    const { mage, hunter, gunner } = this.player;
    const label: Record<Hint, string> = this.touch
      ? gunner
        ? {
            attack: "O'Q — otish, o'q belgisi — o'qlash",
            spin: "O'Q ni bosib turing — barabanni bo'shatish",
            dash: "SIRPANISH, bosib tur — tutun",
          }
        : hunter
          ? {
              attack: "O'Q — o'q otish",
              spin: "O'Q ni bosib turing — teshuvchi o'q",
              dash: "SAKRASH — orqaga, bosib tur — tuzoq",
            }
          : {
              attack: mage ? "SHAR — sehrli shar" : "ZARBA — zarba",
              spin: mage ? "SHAR ni bosib turing — halqa" : "ZARBA ni bosib turing — aylana zarba",
              dash: mage ? "TELEPORT — sakrash" : "DASH — sirpanish",
            }
      : gunner
        ? {
            attack: "Space — o'q, R — qayta o'qlash",
            spin: "Bosib turing — barabanni bo'shatish",
            dash: "Shift — sirpanish, bosib tur — tutun",
          }
        : hunter
          ? {
              attack: "Space — o'q",
              spin: "Bosib turing — teshuvchi o'q",
              dash: "Shift — orqaga sakrash, bosib tur — tuzoq",
            }
          : {
              attack: mage ? "Space — sehrli shar" : "Space — zarba",
              spin: mage ? "Bosib turing — sehrli halqa" : "Bosib turing — aylana zarba",
              dash: mage ? "Shift — teleport" : "Shift — dash",
            };
    // Ovchida HUD'da uchinchi (tuzoq) chizig'i, Merganda tutun chizig'i va baraban bor —
    // ko'rsatmalar pastroqda
    const top = gunner ? 40 : hunter ? 28 : 24;
    const w = Math.max(...this.hints.map((h) => label[h].length)) * 5 + 12;
    px(c, "rgba(8,4,16,0.6)", 4, top, w, this.hints.length * 10 + 4);
    const blink = Math.floor(this.time * 3) % 2 ? "#ffcc33" : "#8a6a1a";
    this.hints.forEach((h, i) => {
      px(c, blink, 7, top + 5 + i * 10, 3, 3);
      this.text(label[h], 13, top + 9 + i * 10, 5, "#e0d6ee", "left");
    });
  }

  private wrap(s: string, max: number) {
    const lines: string[] = [];
    let cur = "";
    for (const w of s.split(" ")) {
      if ((cur + " " + w).trim().length > max) {
        if (cur) lines.push(cur);
        cur = w;
      } else cur = (cur + " " + w).trim();
    }
    if (cur) lines.push(cur);
    return lines;
  }

  private renderOverlays() {
    const c = this.ctx;
    if (this.phase === "play" && this.stage === "upgrade" && !this.paused) {
      px(c, "rgba(8,4,16,0.78)", 0, 0, ROOM.w, ROOM.h);
      this.text(
        this.bonusPick
          ? "XAZINA: BEPUL KUCH!"
          : this.startPick
            ? `${this.chapter}-DUNYO: BEPUL KUCH!`
            : this.endless
              ? `CHEKSIZ ${endlessNumber(this.wave)} TOZALANDI`
              : `${this.wave + 1}-TO'LQIN TOZALANDI`,
        ROOM.w / 2,
        40,
        9,
        "#a6f08e",
      );
      this.text("Kuch tanlang: 1 / 2 / 3", ROOM.w / 2, 58, 6, "#e0d6ee");
      // Sehrgar kartalari qizil-qora, Ovchiniki yashil-jigarrang: ramka va fon binafsha emas
      const [frame, inner] = this.player.mage
        ? ["#5a2a30", "#1f1520"]
        : this.player.hunter
          ? ["#4a3a22", "#151c11"]
          : ["#5c4a6e", "#1f1730"];
      this.choices.forEach((u, i) => {
        const r = this.cardRect(i);
        const sel = i === this.choiceIndex;
        const lift = sel ? -3 : 0;
        const ink = u.text ?? u.color;
        px(c, sel ? u.color : frame, r.x, r.y + lift, r.w, r.h);
        px(c, inner, r.x + 2, r.y + 2 + lift, r.w - 4, r.h - 4);
        renderUpgradeIcon(c, upgradeIcon(u), u.color, r.x + r.w / 2 - 10, r.y + 9 + lift, 20);
        this.text(String(i + 1), r.x + 8, r.y + 12 + lift, 6, ink);
        this.wrap(u.name, 12).forEach((l, j) =>
          this.text(l, r.x + r.w / 2, r.y + 38 + j * 9 + lift, 6, ink),
        );
        this.wrap(u.desc, 15).forEach((l, j) =>
          this.text(l, r.x + r.w / 2, r.y + 62 + j * 8 + lift, 5, "#e0d6ee"),
        );
      });
      this.text("A/D tanlash, Enter — olish", ROOM.w / 2, 196, 5, "#b8a8cc");
    }
    if (this.paused) {
      px(c, "rgba(0,0,0,0.7)", 0, 0, ROOM.w, ROOM.h);
      this.text("PAUZA", ROOM.w / 2, ROOM.h / 2 - 34, 18, "#ffcc33");
      this.text(
        this.touch
          ? `Ovoz: ${sfx.muted ? "o'chiq" : "yoqiq"}`
          : `Ovoz: ${sfx.muted ? "o'chiq" : "yoqiq"} (M)`,
        ROOM.w / 2,
        ROOM.h / 2 - 14,
        6,
        "#b8a8cc",
      );
      for (const [b, label] of [
        [this.resumeBtn, this.touch ? "Davom etish" : "Davom etish: Esc"],
        // kunlik sinovda qayta boshlash yo'q — bitta urinish
        ...(this.daily ? [] : ([[this.restartBtn, "Qaytadan boshlash"]] as const)),
        [this.menuBtn, this.daily ? "Menyuga (urinish tugaydi)" : "Bosh menyuga qaytish"],
      ] as const) {
        px(c, "#ffcc33", b.x, b.y, b.w, b.h);
        px(c, "#2a1f38", b.x + 1, b.y + 1, b.w - 2, b.h - 2);
        this.text(label, ROOM.w / 2, b.y + 12, 7, "#e0d6ee");
      }
      this.text(
        this.touch
          ? this.player.mage
            ? "Chap doira yurish · SHAR otish · TELEPORT"
            : this.player.hunter
              ? "Chap doira yurish · O'Q otish · SAKRASH / tuzoq"
              : this.player.gunner
                ? "Chap doira yurish · O'Q otish · SIRPANISH / tutun"
                : "Chap doira yurish · ZARBA hujum · DASH sirpanish"
          : this.player.mage
            ? "WASD yurish · Space shar · Shift teleport"
            : this.player.hunter
              ? "WASD yurish · Space o'q · Shift sakrash/tuzoq"
              : this.player.gunner
                ? "WASD · Space o'q · R o'qlash · Shift sirpanish/tutun"
                : "WASD yurish · Space zarba · Shift dash",
        ROOM.w / 2,
        ROOM.h - 22,
        5,
        "#b8a8cc",
      );
    }
    if (this.phase === "attempt" && this.later) {
      // 2-/3-dunyoda o'lim: qayta boshlash yoki bosh menyu
      const ch = this.chapter;
      px(c, "rgba(0,0,0,0.75)", 0, 0, ROOM.w, ROOM.h);
      this.text("YIQILDINGIZ", ROOM.w / 2, 46, 10, "#ff4d6d");
      this.text(`${ch}-DUNYO · Urinish №${this.attempt}`, ROOM.w / 2, 66, 8, WORLD_COLORS[ch]);
      this.text(`Ochko: ${this.score}   Rekord: ${this.best}`, ROOM.w / 2, 82, 6, "#e0d6ee");
      if (this.newBest) this.text("YANGI REKORD!", ROOM.w / 2, 94, 6, "#a6f08e");
      this.renderGoldResult(108);
      this.renderStats(122);
      for (const [b, label] of [
        [this.retryBtn, this.touch ? `${ch}-DUNYONI QAYTA BOSHLASH` : `${ch}-DUNYONI QAYTA: Enter`],
        [this.quitBtn, this.touch ? "BOSH MENYU" : "BOSH MENYU: Q"],
      ] as const) {
        px(c, WORLD_COLORS[ch], b.x, b.y, b.w, b.h);
        px(c, "#1d2a3a", b.x + 1, b.y + 1, b.w - 2, b.h - 2);
        this.text(label, ROOM.w / 2, b.y + 12, 7, "#e0d6ee");
      }
    } else if (this.phase === "attempt") {
      px(c, "rgba(0,0,0,0.75)", 0, 0, ROOM.w, ROOM.h);
      this.text("YIQILDINGIZ", ROOM.w / 2, ROOM.h / 2 - 30, 10, "#ff4d6d");
      this.text(
        this.daily
          ? "KUNLIK SINOV TUGADI"
          : this.endless
            ? `CHEKSIZ: ${endlessNumber(this.wave)}-TO'LQIN`
            : `Urinish №${this.attempt}`,
        ROOM.w / 2,
        ROOM.h / 2,
        this.endless || this.daily ? 10 : 14,
        "#ffcc33",
      );
      this.text(
        this.daily
          ? `Ochko: ${this.score}   ${this.wave + 1}-to'lqin · ertaga yana`
          : this.endless
            ? `Ochko: ${this.score}   Cheksiz rekord: ${this.endlessBest}`
            : `Ochko: ${this.score}   Rekord: ${this.best}`,
        ROOM.w / 2,
        ROOM.h / 2 + 22,
        6,
        "#e0d6ee",
      );
      if (this.newBest) this.text("YANGI REKORD!", ROOM.w / 2, ROOM.h / 2 + 36, 6, "#a6f08e");
      this.renderGoldResult(ROOM.h / 2 + 54);
      this.renderStats(ROOM.h / 2 + 70);
    }
    if (this.phase === "victory") {
      px(c, "rgba(10,5,20,0.8)", 0, 0, ROOM.w, ROOM.h);
      // statistika sig'ishi uchun yozuvlar yuqoriroqda (tugmalar joyida qoladi)
      const ch = this.chapter;
      const later = ch > 1;
      if (later) this.text(`${ch}-DUNYO TUGADI`, ROOM.w / 2, 54, 16, WORLD_COLORS[ch]);
      else this.text("G'ALABA!", ROOM.w / 2, 56, 20, "#ffcc33");
      this.text(
        this.daily ? "Kunlik sinovni yutdingiz" : `${this.attempt}-urinishda yutdingiz`,
        ROOM.w / 2,
        78,
        8,
        "#ffffff",
      );
      this.text(`Ochko: ${this.score}`, ROOM.w / 2, 96, 8, "#ffcc33");
      const record = ch === 3 ? this.newCh3Best : ch === 2 ? this.newCh2Best : this.newBest;
      const chBest = ch === 3 ? this.ch3Best : this.ch2Best;
      this.text(
        this.daily
          ? "Ertaga yangi sinov"
          : later
            ? record
              ? `YANGI ${ch}-DUNYO REKORDI!`
              : `${ch}-dunyo rekordi: ${chBest}`
            : record
              ? "YANGI REKORD!"
              : `Rekord: ${this.best}`,
        ROOM.w / 2,
        110,
        6,
        record ? "#a6f08e" : "#b8a8cc",
      );
      this.renderStats(126);
      const buttons: (readonly [typeof this.endlessBtn, string])[] = this.daily
        ? [[this.endlessBtn, this.touch ? "BOSH MENYU" : "BOSH MENYU: Enter"]]
        : ch === 3
          ? [
              [this.endlessBtn, this.touch ? "CHEKSIZ REJIM" : "CHEKSIZ REJIM: Enter"],
              [this.newRunBtn, this.touch ? "Qaytadan boshlash" : "Qaytadan: R"],
            ]
          : [
              [
                this.chapterBtn,
                this.touch ? `${ch + 1}-DUNYOGA O'TISH` : `${ch + 1}-DUNYOGA O'TISH: Enter`,
              ],
              [this.endlessBtn, this.touch ? "CHEKSIZ REJIM" : "CHEKSIZ REJIM: E"],
              [this.newRunBtn, this.touch ? "Qaytadan boshlash" : "Qaytadan: R"],
            ];
      for (const [b, label] of buttons) {
        px(c, "#ffcc33", b.x, b.y, b.w, b.h);
        px(c, "#2a1f38", b.x + 1, b.y + 1, b.w - 2, b.h - 2);
        this.text(label, ROOM.w / 2, b.y + 12, 7, "#e0d6ee");
      }
      this.renderGoldResult(226);
      this.text(`v${GAME_VERSION}`, ROOM.w - 34, ROOM.h - 8, 6, "rgba(255,255,255,0.45)");
    }
  }

  /** Kuch tanlash ekrani ochiq: yutuq xabari kuch tanlangandan keyin chiqadi. */
  get toastHeld() {
    return this.phase === "play" && this.stage === "upgrade";
  }

  /** Yutuq ochildi: yuqorida navbat bilan bitta xabar. */
  private renderToast() {
    const t = this.toasts[0];
    if (!t || this.toastHeld) return;
    const c = this.ctx;
    const a = Math.min(1, t.timer * 3, (3 - t.timer) * 6);
    c.globalAlpha = Math.max(0, a);
    const w = 184,
      x = (ROOM.w - w) / 2,
      y = 26;
    px(c, "#ffcc33", x, y, w, 26);
    px(c, "#2a1f38", x + 1, y + 1, w - 2, 24);
    renderUpgradeIcon(c, "trophy", "#ffcc33", x + 6, y + 5, 16);
    this.text("YUTUQ OCHILDI!", x + 28, y + 11, 5, "#ffcc33", "left");
    this.text(t.a.name, x + 28, y + 21, 6, "#e0d6ee", "left");
    c.globalAlpha = 1;
  }

  /** Yakun ekrani statistikasi: 2 ustun, 3 qator, 5px. */
  private renderStats(y: number) {
    const st = this.stats;
    const t = Math.floor(st.time);
    const time = `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
    const left = [`To'lqin: ${st.waves}`, `Dushman: ${st.kills}`, `Sandiq: ${st.chests}`];
    const right = [`Eng uzun kombo: ${st.maxCombo}`, `Oltin: ${st.gold}`, `Vaqt: ${time}`];
    for (let i = 0; i < 3; i++) {
      this.text(left[i]!, 78, y + i * 9, 5, "#b8a8cc", "left");
      this.text(right[i]!, 166, y + i * 9, 5, "#b8a8cc", "left");
    }
  }

  /** Yakun ekrani: "+N OLTIN (jami M)". */
  private renderGoldResult(y: number) {
    const s = `+${this.lastGold} OLTIN  (jami ${this.totalGold})`;
    const c = this.ctx;
    c.font = `6px "Press Start 2P", monospace`;
    const w = c.measureText(s).width;
    this.coin(c, ROOM.w / 2 - w / 2 - 9, y - 6);
    this.text(s, ROOM.w / 2 + 2, y, 6, "#ffcc33");
  }

  private text(
    s: string,
    x: number,
    y: number,
    size: number,
    color: string,
    align: CanvasTextAlign = "center",
  ) {
    const c = this.ctx;
    c.font = `${size}px "Press Start 2P", monospace`;
    c.textAlign = align;
    c.fillStyle = "#000";
    c.fillText(s, x + 1, y + 1);
    c.fillStyle = color;
    c.fillText(s, x, y);
  }
}
