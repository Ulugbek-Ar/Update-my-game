import { ROOM, applyHit, clampToRoom, overlap, px, separate, type Body } from "./animation";
import { Input } from "./input";
import { Player } from "./player";
import { Enemy, GOLEM_SPLIT, ICEBLOB_CHILL, OWL_ALT, TENGU_ALT, type EnemyKind } from "./enemy";
import {
  Boss,
  ForestKing,
  KING_HP,
  KING_LIGHT,
  Queen,
  QUEEN_HP,
  WIND_PUSH,
  impSummonCount,
  spiderSummonCount,
  summonCount,
} from "./boss";
import { INTRO_TIME, PHASE_GUARD, bossHpFor } from "./bossPower";
import { introFrame, phasePulse } from "./mobAnim";
import { renderAirAmbience, renderGroundAmbience } from "./ambience";
import { CombatFx, chestPop, flyerPos, renderChestRays, renderSpark } from "./combatFx";
import {
  HEART_BREAK,
  HudFx,
  PICK_RISE,
  PICK_TIME,
  SHIMMER_LEN,
  SHIMMER_SPEED,
  cardFlip,
  cardGlow,
  framePoint,
} from "./hudFx";
import { ONI_HP, Oni } from "./oni";
import {
  PETALS,
  PETALS_REDUCED,
  SAKURA_BOSS_COLORS,
  SAKURA_COLORS,
  renderPetals,
  renderSakuraLights,
  sakuraDecor,
  sakuraTile,
  sakuraWalls,
} from "./sakura";
import { GAME_VERSION } from "./version";
import { sfx } from "./audio";
import { loadSettings, onSettingsChange } from "./settings";
import { actionKey, moveLabel } from "./keys";
import { touchLabels } from "./touchLayout";
import { BOSS_BUZZ, HIT_BUZZ, vibrate } from "./haptics";
import { Effects } from "./effects";
import { renderUpgradeIcon } from "./sprites";
import {
  WAVES,
  BOSS_WAVE,
  pickUpgrades,
  isBossWave,
  bossHp,
  endlessNumber,
  ENDLESS_BOSS_EVERY,
  waveEnemies,
  waveSpeed,
  waveSpeed2,
  waveSpeed3,
  waveSpeed4,
  type World,
  upgradeIcon,
  isChestWave,
  type Upgrade,
} from "./waves";
import {
  DODGE_CD,
  DODGE_SLOW,
  HAMLA_DMG,
  IAI_DELAY,
  IAI_GAP,
  IAI_WIDTH,
  PARRY_BOOST,
  PARRY_STUN,
  VOW_TIME,
  SKY_RADIUS,
  SKY_STUN,
  SPIN_TIME,
  VOW_RADIUS,
  type Bolt,
  type Target,
} from "./player";
import {
  CUT_LIFE,
  MOON_LIFE,
  STREAK_LIFE,
  renderCritReady,
  renderCut,
  renderFocus,
  renderKatanaArc,
  renderMark,
  renderMoonFlash,
  renderStreak,
  type Cut,
  type MoonFlash,
  type Streak,
} from "./samuraiFx";
import {
  CRACK_LIFE,
  QUAKE_LIFE,
  renderCrack,
  renderQuake,
  renderShockwave,
  renderSkyColumn,
  renderVowAura,
  renderWindupSparks,
  renderDazeStars,
  type Crack,
  type Quake,
} from "./paladinFx";
import { bestKeys, chargeRingColor, hudBarColors, withAlpha, type Hero } from "./hero";
import { loadPlayableHero, playableHero } from "./save";
import { unlockAchievement, type Achievement, type AchievementId } from "./achievements";
import { dailyRandoms, saveDaily } from "./daily";
import { BOSS_GOLD, KILL_GOLD, addGold, applyShop, dropBonus, loadGold, loadShop } from "./shop";
import { recordWorldWin } from "./progress";
import { ThreatTable } from "./threat";
import { HORN_ITEM, hornWanted, recordBossKey, sendToRealm } from "./realmLink";
import { XP, addXp } from "@/account/xp";
import { addStats } from "@/account/stats";
import {
  BLAST_DMG,
  BLAST_RADIUS,
  DASH_BOOST,
  DROP_BONUS,
  GUARD_BONUS,
  HERO_TAG,
  TAGS,
  TAG_ICONS,
  TELE_BLAST_MUL,
  TELE_BLAST_RADIUS,
  WARD_EVERY,
  addTag,
  hasTag,
  synergies,
  tagProgress,
  type Tag,
  type TagCounts,
} from "./synergy";
import { renderPixelIcon } from "./pixelIcon";
import { SuperMeter } from "./super";
import { skinLook, skinPalette } from "./skins";
import {
  defaultLook,
  heroBurst,
  heroImpact,
  heroTrail,
  renderFlair,
  type SkinLook,
} from "./skinFx";
import {
  COIN_RAIN,
  CRIT_AVG,
  CRIT_CHANCE,
  CRIT_COLOR,
  CRIT_FREEZE,
  CRIT_MUL,
  SLOWMO_SPEED,
  SLOWMO_TIME,
  critSourceFn,
  rollCrit,
} from "./crit";
import {
  ARTIFACT_CHEST,
  BIG_TRAP_DMG,
  CHAIN_RADIUS,
  COLLECTOR_AT,
  COMBO_HEAL_EVERY,
  FLAME_LIFE,
  FLAME_RADIUS,
  FLAME_TICK,
  FROST_HEART_TIME,
  GOLD_BOOST,
  LAST_BREATH_TIME,
  LAST_SHOT_MUL,
  MAGNET_RADIUS,
  MAGNET_SPEED,
  PHASE_WAVE_DMG,
  PHASE_WAVE_RADIUS,
  REVENGE_MUL,
  SLOW_RING,
  SPIN_GUARD,
  TENTH_EVERY,
  VOW_LIGHT_RADIUS,
  artifactById,
  artifactColors,
  rollArtifact,
  type ArtifactId,
} from "./artifacts";

const STORAGE_KEY = "pixel-rpg-attempt";
/** Uchuvchi yozuv markazi ekran (xona) chetidan chiqib ketmasin: half — yozuv kengligining yarmi */
const fitX = (x: number, half = 24) => Math.max(half, Math.min(ROOM.w - half, x));
/** Xavf jadvalidagi o'yinchi id'si (bir kishilik o'yin) */
const PLAYER_ID = "me";
/** Ritsar rekordlari (Sehrgarniki — hero.ts dagi bestKeys) */
export const BEST_KEY = bestKeys("knight").best;
/** Cheksiz rejim rekordi alohida saqlanadi */
export const ENDLESS_BEST_KEY = bestKeys("knight").endless;
/** Birinchi o'yindagi ko'rsatmalar ko'rsatib bo'lingan */
export const TUTORIAL_KEY = "pixel-rpg-tutorial-done";
/** Samuray bilan birinchi o'yindagi maslahatlar (IAI, chetlanish, parry) ko'rsatib bo'lingan */
export const SAMURAI_TIPS_KEY = "pixel-rpg-samurai-tips-done";
/** Parry bilan qaytarilgan snaryad: tezligi va oddiy dushmanga zarari (o'yinchi zararidan) */
export const REFLECT_SPEED = 1.7;
export const REFLECT_MUL = 2;
/** Bossga qaytgan zarar cheklangan: har snaryad shuncha, soniyasiga jami shundan oshmaydi */
export const PARRY_BOSS_DMG = 1;
export const PARRY_BOSS_CAP = 3;
/** GULBARG BO'RONI: mukammal chetlanishdagi gulbarg zarbasi radiusi */
export const PETAL_RADIUS = 36;
/** SOVUQ QON: jon shuncha yoki kam bo'lsa kritik ehtimoliga qo'shimcha */
export const COLD_BLOOD_HP = 2;
export const COLD_BLOOD_CRIT = 0.25;
/** "10 ta mukammal chetlanish" yutug'i (bitta o'yinda) */
export const DODGE_ACH = 10;
/** 1-dunyo yutilgan: xaritada 2-dunyo ochiladi */
export { WORLD1_WON_KEY } from "./progress";
export type Hint = "attack" | "spin" | "dash" | "iai" | "dodge" | "parry";
const HINTS: Hint[] = ["attack", "spin", "dash"];
/** Samurayning bir martalik maslahatlari */
const SAMURAI_TIPS: Hint[] = ["iai", "dodge", "parry"];
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
  /** Zarar (g'azabdagi boss sharlari +1) */
  dmg?: number;
  /** Kim otgan (parry bilan qaytarilsa — shunga uchadi) */
  owner?: Enemy | Boss;
  /** Ko'k olov (Kitsune) */
  blue?: boolean;
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
  imp: 15,
  ninja: 25,
  tengu: 25,
  kitsune: 25,
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
  imp: "#ff6a2a",
  ninja: "#4d4a80",
  tengu: "#e4e0ea",
  kitsune: "#5ab8ff",
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
  /** 4-dunyo: kechki bog' maysasi, hovuz va ko'prik, sakura daraxtlari (sakura.ts) */
  sakura?: boolean;
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
/** 4-dunyo: Sakura bog'i va Oni xonasi (chizilishi — sakura.ts) */
const SAKURA_FLOOR: FloorTheme = { ...SAKURA_COLORS, moss: 0, red: false, sakura: true };
const SAKURA_BOSS_FLOOR: FloorTheme = { ...SAKURA_BOSS_COLORS, moss: 0, red: false, sakura: true };
/**
 * Pol variantlari: -1 Iblis xonasi, -2 muz, -3 Malika xonasi, -4 o'rmon, -5 Shoh xonasi,
 * -6 Sakura bog'i, -7 Oni xonasi
 */
const FLOOR_SAKURA = -6;
const FLOOR_SAKURA_BOSS = -7;
const FLOOR_ICE = -2;
const FLOOR_ICE_BOSS = -3;
const FLOOR_FOREST = -4;
const FLOOR_FOREST_BOSS = -5;
const BOSS_POINTS = 300;
const QUEEN_POINTS = 500;
const QUEEN_GOLD = 40;
const KING_POINTS = 700;
const KING_GOLD = 50;
const ONI_POINTS = 800;
const ONI_GOLD = 55;
/** Har dunyo nomi (to'lqin bannerida) va Bossi */
const WORLD_TITLES: Record<World, string> = {
  1: "1-DUNYO: OLOVLI ZINDON",
  2: "2-DUNYO: MUZ SARDOBASI",
  3: "3-DUNYO: ZULMAT O'RMONI",
  4: "4-DUNYO: SAKURA BOG'I",
};
const WORLD_COLORS: Record<World, string> = {
  1: "#ffcc33",
  2: "#9fd0ef",
  3: "#a6f08e",
  4: "#ff8fb8",
};
/** Qadam changi rangi: tosh, qor, tuproq, bog' */
const STEP_DUST: Record<World, string> = { 1: "#8d819f", 2: "#f2f8fc", 3: "#5a4a34", 4: "#8a9a86" };
/** Muz qalqoni ta'siri */
const FROST_RADIUS = 56;
const FROST_TIME = 1.5;
const COMBO_TIME = 2.5;
const DROP_CHANCE = 0.15;
const COIN_LIFE = 12;
const TOTAL_WAVES = WAVES.length;
/** Boss kirish kartochkasi: ismi, laqabi va rangi */
const BOSS_CARDS = {
  devil: { name: "IBLIS", nick: "OLOVLI ZINDON HUKMDORI", color: "#ff6a2a" },
  queen: { name: "QOR MALIKASI", nick: "ABADIY MUZ BEKASI", color: "#7fe9ff" },
  king: { name: "O'RMON SHOHI", nick: "ZULMAT O'RMONI QALBI", color: "#d8ff7a" },
  oni: { name: "ONI", nick: "SAKURA BOG'INING LA'NATI", color: "#ff6a5a" },
} as const;
/** Faza almashganda banner: [2-faza, 3-faza] */
const PHASE_BANNERS = {
  devil: [
    { title: "2-FAZA: OLOV YO'LAGI", sub: "Chiziqdan chetga qoch!" },
    { title: "3-FAZA: YONAYOTGAN ARENA", sub: "Chetlardan uzoqlash!" },
  ],
  queen: [
    { title: "2-FAZA: MUZ QAMOQ", sub: "Nurdan qoch, qotsang — tez bos!" },
    { title: "3-FAZA: KO'ZGULAR", sub: "Soyasi borini ur!" },
  ],
  king: [
    { title: "2-FAZA: HAYOT GULLARI", sub: "Gullarni yo'q qil!" },
    { title: "3-FAZA: ZULMAT", sub: "Svetlyachoklarga qara!" },
  ],
  // Oni ikki fazali
  oni: [{ title: "2-FAZA: NIQOB YORILDI", sub: "Olov halqasi va uch zarba!" }],
} as const;
/** Muz polda sirpanish: harakat shu tezlikda (1/s) yangi yo'nalishga moslashadi */
const ICE_GRIP = 2.2;
/** HUD'da bir qatordagi artefakt ikonkalari */
const ART_PER_ROW = 8;
/** "SINERGIYA!" yozuvi shuncha turadi */
const SYN_NOTE = 2.2;

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

/** Tugagan o'yin natijasi (reyting uchun; faqat kirgan o'yinchida yuboriladi) */
export interface RunResult {
  /** world — 1-dunyodan boshlangan o'yinning 1-dunyo qismi; endless; daily — kunlik sinov */
  mode: "world" | "endless" | "daily";
  hero: Hero;
  score: number;
  /** dunyo/kunlik — 1..5, cheksiz — cheksiz to'lqin raqami */
  wave: number;
  /** o'yin vaqti, soniya (pauzasiz) */
  time: number;
  won: boolean;
  /** kunlik sinov sanasi */
  date: string | null;
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
  // Mergan kartalari
  "ammoMax",
  "reloadTime",
  "range",
  "bounce",
  // Paladin kartalari
  "shockwave",
  "aura",
  // Samuray kartalari
  "iaiRange",
  "iaiDouble",
  "dodgeWindow",
  "parryBoost",
  "petalStorm",
  "coldBlood",
  // sinergiya bonuslari (synergy.ts)
  "spinCd",
  "chargeTime",
  "strongMul",
  "fanPierce",
] as const;
type Powers = Pick<Player, (typeof POWER_KEYS)[number]>;
function savePowers(p: Player): Powers {
  return Object.fromEntries(POWER_KEYS.map((k) => [k, p[k]])) as Powers;
}

/** Butun o'yin holati shu obyektda — React state'da emas. */
export class Game {
  input = new Input();
  player = new Player();
  /** Faol skin ko'rinishi (applySkin): effekt ranglari va shakllari */
  look: SkinLook = defaultLook("knight");
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
  /** Paladin: SHANG yoriqlari va OSMON HUKMI zarb to'lqinlari (faqat chizish) */
  cracks: Crack[] = [];
  quakes: Quake[] = [];
  /** Portlash halqalari (sinergiya va artefaktlar; faqat chizish) */
  rings: { x: number; y: number; r: number; life: number; max: number; color: string }[] = [];
  /** Samuray: IAI yo'lida belgilanganlar, kechikkan kesiklar navbati va chizmalar (iz, kesik) */
  iaiMarks: (Enemy | Boss)[] = [];
  private iaiCuts: {
    t: number;
    i: number;
    pass: number;
    mul: number;
    crit: boolean;
    targets: (Enemy | Boss)[];
    dir: number;
  } | null = null;
  cuts: Cut[] = [];
  streaks: Streak[] = [];
  /** Afsonaviy "Qizil oy": mukammal chetlanishda ortda yonadigan yarim oy */
  moons: MoonFlash[] = [];
  private iaiFrom = { x: 0, y: 0 };
  /** Mukammal chetlanish: qolgan sekin vaqt (real soniya) — Samurayning o'zi sekinlashmaydi */
  focus = 0;
  /** Shu o'yindagi mukammal chetlanishlar ("10 ta mukammal chetlanish" yutug'i) */
  perfectDodges = 0;
  /** Bossga qaytgan zarar hisobi (soniyasiga cheklangan) */
  private reflectBudget = { t: 0, dmg: 0 };
  /** Shu kadrda "SHIK!" yozuvi chiqdi (bir kadrda bir marta) */
  private parryNote = false;
  /** Super zaryadi (super.ts). v4.0 gacha yopiq: to'lmaydi, HUD'da va boshqaruvda ko'rinmaydi */
  superMeter = new SuperMeter("knight");
  /** Xavf jadvali (onlayn bilan bir xil mantiq; bir kishilik o'yinda nishon bitta — o'yinchi) */
  private threat = new ThreatTable();
  /** Boss to'lqinida o'yinchi hali jon yo'qotmagan ("Qalqonsiz devor" yutug'i) */
  private bossClean = true;
  /** Paladin: shu SHANG zarbasida o'ldirilganlar ("SHANG!" yutug'i) */
  private slamKills = { id: 0, kills: 0 };
  /** O'rmon Shohi 3-fazasidagi qorong'ilik (0..1, asta kuchayadi) */
  darkness = 0;
  /** Boss kirish sahnasi qolgan vaqti (kamera yaqinlashadi, nom kartochkasi) */
  intro = 0;
  /** Kirish sahnasida boss zarbasi ko'rsatildi (ovoz bir marta) — faqat ko'rinish */
  private introHit = false;
  /** Faza almashganda ekran chaqnashi */
  phaseFlash = 0;
  /** Muz polda sirpanish tezligi */
  private slip = { vx: 0, vy: 0, on: false };
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
  /** Profil statistikasiga allaqachon qo'shilgan qism (o'yin oxirida farqi yoziladi) */
  private statsDone = newStats();
  /** Shu o'yinda olingan XP va yengilgan bosslar (profil statistikasi) */
  runXp = 0;
  private runBosses = 0;
  /** Oxirgi marta hisobga qo'shilgan oltin va umumiy hisob — yakun ekranida */
  lastGold = 0;
  totalGold = 0;
  /** Do'kondan: yurak tushish ehtimoliga qo'shimcha */
  private dropBonus = 0;
  fx = new Effects();
  /** Jang hissi (combatFx.ts): zarba uchqunlari va HUD'ga uchuvchi belgilar — faqat ko'rinish */
  cfx = new CombatFx();
  /** HUD animatsiyalari (hudFx.ts): yuraklar, oltin hisobi — faqat ko'rinish */
  hud = new HudFx();
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
  /** 4-dunyo (Sakura bog'i) rekordi */
  ch4Best = 0;
  newCh4Best = false;
  /** Dunyo boshidagi kuchlar va ochko — 2-/3-dunyoda o'lganda shu holatdan qayta boshlanadi */
  private chStart: { powers: Powers; score: number; tags: TagCounts } | null = null;
  /** Shu o'yinda olingan kartalar teglari (sinergiyalar — synergy.ts) */
  tagCounts: TagCounts = {};
  /** HIMOYA sinergiyasi: keyingi qalqongacha o'tgan vaqt */
  private wardT = 0;
  /** Yangi ochilgan sinergiya yozuvi (ekran tepasida 2 s) */
  synNote: { tag: Tag; timer: number } | null = null;
  /** O'tgan kadrda dash/teleport/sakrash davom etayotgan edi (TEZLIK sinergiyasi) */
  private wasDashing = false;
  /** Shu o'yindagi artefaktlar (artifacts.ts) — o'lim yoki qayta boshlashda yo'qoladi */
  artifacts: ArtifactId[] = [];
  /** OLOV IZI: yerdagi olov va har dushmanga keyingi kuyish vaqti */
  flames: { x: number; y: number; life: number }[] = [];
  private burnAt = new WeakMap<object, number>();
  /** O'NINCHI ZARB: o'yinchi zarbalari hisobi; QASOS: keyingi zarba kuchli; SO'NGGI NAFAS ishlatildi */
  private hitCount = 0;
  private revengeReady = false;
  private lastBreathUsed = false;
  /** PO'LAT AYLANA: o'tgan kadrda aylana zarba bormidi */
  private wasSpinning = false;
  /** Chaqmoq chiziqlari (faqat chizish) */
  zaps: { x1: number; y1: number; x2: number; y2: number; life: number }[] = [];
  /** Bosilgan/yangi olingan artefakt tavsifi (HUD'da) va pauzada tanlangani */
  artInfo: { id: ArtifactId; timer: number } | null = null;
  private pauseArt = -1;
  /** 1-dunyo yutilgan va 2-dunyoda hali o'lmagan ("Ikki dunyo" yutug'i) */
  private noDeathRun = false;
  /** Shu to'lqinda sovuq nafas tegdimi / to'lqinda Muz ruhi bormidi ("Sovuqqa chidam") */
  private waveChilled = false;
  private waveHasFrost = false;
  /** "Olti o'q": shu barabandagi o'qlar bilan o'ldirilgan dushmanlar */
  private drum = { load: -1, kills: 0 };
  /** hint — pastki qatorda qobiliyat ko'rsatmasi (dashHint) */
  banner: { title: string; sub: string; timer: number; hint?: boolean } = {
    title: "",
    sub: "",
    timer: 0,
  };
  paused = false;
  /** Sensorli qurilma: ko'rsatmalar shunga qarab chiqadi (React belgilaydi). */
  touch = false;
  /** Pauzadagi SOZLAMALAR tugmasi (React oynani ochadi) */
  onSettings: (() => void) | null = null;
  private offSettings: (() => void) | null = null;
  /** "Bosh menyuga qaytish" bosilganda React menyusini ko'rsatadi. */
  onExit: (() => void) | null = null;
  /** O'yin tugadi (o'lim, g'alaba, kunlik sinovdan chiqish) — reyting uchun */
  onRunEnd: ((r: RunResult) => void) | null = null;
  /** cheksiz rejim boshlangan paytdagi o'yin vaqti (cheksiz natija vaqti shundan) */
  private endlessFrom = 0;
  msgTimer = 0;
  time = 0;
  /** Sozlamalar: ekran silkinishi */
  shakeOn = true;
  /** Sozlamalar: zarar raqamlari */
  damageNumsOn = true;
  /** Kritik zarba tasodifi (testda qat'iy) */
  critRand: () => number = critSourceFn();
  /** Boss o'ldi: qolgan sekin harakat vaqti (real soniya) va tanga yomg'iri (faqat ko'rinish) */
  slowmo = 0;
  coinRain: { x: number; y: number; vy: number; life: number }[] = [];
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
    this.ch4Best = load(bestKeys(hero).ch4);
    this.totalGold = loadGold();
    const settings = loadSettings();
    this.shakeOn = settings.shake;
    this.damageNumsOn = settings.damageNumbers;
    sfx.setVolumes(settings.music, settings.sfx);
    if (!load(TUTORIAL_KEY)) this.hints = [...HINTS];
    // Samuray bilan birinchi o'yin: IAI, chetlanish va parry maslahatlari (bir martalik)
    if (hero === "samurai" && !load(SAMURAI_TIPS_KEY)) this.hints = [...SAMURAI_TIPS];
    this.reset();
  }

  /**
   * Tanlangan skin: palitra (sprite), ko'rinish (effekt ranglari va shakllari) va ovoz ohangi.
   * Faqat ko'rinish — Player raqamlari (zarar, tezlik, cooldown, maydon) o'zgarmaydi.
   */
  applySkin() {
    this.player.skin = skinPalette(this.hero);
    this.look = skinLook(this.hero);
    this.player.tone = this.look.fx.tone;
    this.player.flair = this.look.fx.flair;
  }

  /** Faol skinning qobiliyat ranglari (skinFx.ts: SkinTheme) */
  get theme() {
    return this.look.theme;
  }

  /** Qahramon effekti portlashi — skin zarrachalari bilan (skinFx.ts) */
  private hb(x: number, y: number, color: string, n: number, speed = 60, size = 2) {
    heroBurst(this.fx, this.look, x, y, color, n, speed, size);
  }

  /** Default skinda — asl (v3.6) rang, boshqa skinda — skin rangi */
  private skinned(original: string, skin: string) {
    return this.look.tier === "default" ? original : skin;
  }

  /** Qahramon harakat izi — skin izi bilan */
  private ht(x: number, y: number, color: string) {
    heroTrail(this.fx, this.look, x, y, color);
  }

  /** Boshlang'ich holat: 1-to'lqin, HP to'liq. */
  reset() {
    this.player = new Player(this.hero);
    this.superMeter = new SuperMeter(this.hero);
    this.applySkin();
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
    this.cracks = [];
    this.quakes = [];
    this.clearSamurai();
    this.perfectDodges = 0;
    this.threat.clear();
    this.tagCounts = {};
    this.wardT = 0;
    this.wasDashing = false;
    this.synNote = null;
    this.rings = [];
    this.slowmo = 0;
    this.coinRain = [];
    this.clearArtifacts();
    this.darkness = 0;
    this.drops = [];
    this.coins = [];
    this.chest = null;
    this.chestsOpened = 0;
    this.bonusPick = false;
    this.runGold = 0;
    this.stats = newStats();
    this.statsDone = newStats();
    this.runXp = 0;
    this.runBosses = 0;
    this.fx = new Effects();
    this.cfx.clear();
    this.hud.reset(this.player.hp, this.runGold);
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
    this.newCh4Best = false;
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
    sfx.playMusic(this.chapter === 4 ? "sakura" : this.chapter === 3 ? "forest" : "ice");
  }

  /**
   * Muallif paneli (server admin deb tasdiqlagan o'yinchi): o'yin tanlangan dunyoning shu
   * to'lqinidan boshlanadi (0 — 1-to'lqin, BOSS_WAVE — boss). Oddiy o'yinda chaqirilmaydi;
   * muallif natijalari reytingga yozilmaydi (server).
   */
  jumpToWave(i: number) {
    const w = Math.max(0, Math.min(BOSS_WAVE, Math.floor(i)));
    this.hints = [];
    if (this.startPick) {
      // 2-3-dunyo: bepul kuch tanlovisiz to'g'ri jangga
      this.startPick = false;
      this.chStart = {
        powers: savePowers(this.player),
        score: this.score,
        tags: { ...this.tagCounts },
      };
      this.choices = [];
      this.enterChapter();
    }
    this.startWave(w);
  }

  /** Bepul kuch tanlangach: dunyo boshidagi holat saqlanadi va 1-to'lqin boshlanadi. */
  private beginWorld() {
    this.startPick = false;
    this.chStart = {
      powers: savePowers(this.player),
      score: this.score,
      tags: { ...this.tagCounts },
    };
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
    this.bossClean = true;
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
    const sakura = ch === 4;
    // qobiliyat ko'rsatmasi chizish paytida yoziladi: telefonda — tugma nomi, kompyuterda —
    // belgilangan tugma (o'yin yaratilganda touch hali ma'lum emas)
    const hint = i === 0 && !this.hints.length;
    this.banner = later
      ? boss
        ? sakura
          ? { title: "BOSS: ONI", sub: "Gurzidan chetlan yoki zarbani qaytar!", timer: 2.2 }
          : forest
            ? { title: "BOSS: O'RMON SHOHI", sub: "Yoriqlardan qoch!", timer: 2.2 }
            : { title: "BOSS: QOR MALIKASI", sub: "Ko'k doiradan qoch!", timer: 2.2 }
        : i === 0
          ? { title: WORLD_TITLES[ch], sub: `TO'LQIN 1/${TOTAL_WAVES}`, timer: 2.6 }
          : { title: `TO'LQIN ${i + 1}/${TOTAL_WAVES}`, sub: `${ch}-DUNYO`, timer: 1.6 }
      : boss
        ? endless
          ? sakura
            ? { title: "ONI QAYTDI!", sub: `Oni joni: ${bossHp(i, ONI_HP)}`, timer: 2.2 }
            : forest
              ? { title: "SHOH QAYTDI!", sub: `Shoh joni: ${bossHp(i, KING_HP)}`, timer: 2.2 }
              : ice
                ? {
                    title: "MALIKA QAYTDI!",
                    sub: `Malika joni: ${bossHp(i, QUEEN_HP)}`,
                    timer: 2.2,
                  }
                : { title: "BOSS QAYTDI!", sub: `Iblis joni: ${bossHp(i)}`, timer: 2.2 }
          : { title: "BOSS: IBLIS", sub: "Qizil doiradan qoch!", timer: 2.2 }
        : endless
          ? { title: `CHEKSIZ: ${endless}-TO'LQIN`, sub: "", timer: 1.6 }
          : i === 0 && this.daily
            ? { title: `TO'LQIN 1/${TOTAL_WAVES}`, sub: `KUNLIK SINOV · ${this.daily}`, timer: 1.6 }
            : i === 0
              ? {
                  title: WORLD_TITLES[1],
                  sub: `TO'LQIN 1/${TOTAL_WAVES}`,
                  timer: 2.2,
                  hint,
                }
              : { title: `TO'LQIN ${i + 1}/${TOTAL_WAVES}`, sub: "", timer: 1.6 };
    const kinds = waveEnemies(i, Math.random, ch);
    this.waveChilled = false;
    this.waveHasFrost = ch2 && (boss || kinds.includes("frost"));
    kinds.forEach((kind, n) => {
      const [x, y] = this.spawnPoint();
      const e = new Enemy(kind, x, y);
      e.spawn = e.spawnMax = 1 + n * 0.18 + (boss ? 1.2 : 0);
      e.speedMul = later
        ? sakura
          ? waveSpeed4(i)
          : forest
            ? waveSpeed3(i)
            : waveSpeed2(i)
        : waveSpeed(i);
      this.enemies.push(e);
    });
    this.fx.snowOn = ice;
    this.fx.wind = 0;
    this.intro = 0;
    this.introHit = false;
    this.phaseFlash = 0;
    this.slip = { vx: 0, vy: 0, on: false };
    this.webs = [];
    this.clouds = [];
    this.traps = [];
    this.smokes = [];
    this.clearSamurai();
    this.darkness = 0;
    this.chest = null;
    if (isChestWave(i) && this.spawnRand() < CHEST_CHANCE) this.spawnChest(...this.spawnPoint());
    this.flames = [];
    if (this.hasArtifact("aegis")) this.player.ward = Math.max(this.player.ward, 1);
    if (boss) {
      // boss joni o'yinchining shu paytdagi kuchiga moslashadi (bossPower.ts)
      const cycle = Math.floor(endless / ENDLESS_BOSS_EVERY);
      const p = this.player;
      this.boss = sakura
        ? new Oni(bossHpFor(p, bossHp(i, ONI_HP), cycle, this.powerFactor()))
        : forest
          ? new ForestKing(bossHpFor(p, bossHp(i, KING_HP), cycle, this.powerFactor()))
          : ice
            ? new Queen(bossHpFor(p, bossHp(i, QUEEN_HP), cycle, this.powerFactor()))
            : new Boss(bossHpFor(p, bossHp(i), cycle, this.powerFactor()));
      // kirish sahnasi: boss shu vaqt ichida paydo bo'ladi, dunyo to'xtab turadi
      this.intro = INTRO_TIME;
      this.boss.spawn = this.boss.spawnMax = INTRO_TIME + 0.4;
      this.input.clearQueued();
      sfx.roar();
      this.fx.addShake(0.4);
    } else sfx.wave();
    sfx.playMusic(
      boss
        ? sakura
          ? "oni"
          : forest
            ? "king"
            : ice
              ? "queen"
              : "boss"
        : sakura
          ? "sakura"
          : forest
            ? "forest"
            : ice
              ? "ice"
              : "normal",
    );
  }

  /** Kirish kartochkasi va faza bannerlari uchun boss turi. */
  bossKind(b: Boss = this.boss!) {
    return b instanceof Oni
      ? "oni"
      : b instanceof ForestKing
        ? "king"
        : b instanceof Queen
          ? "queen"
          : "devil";
  }

  /** Kirish sahnasini o'tkazib yuborish (klaviatura, sensor yoki sichqoncha). */
  skipIntro() {
    this.intro = 0;
    if (this.boss) this.boss.spawn = Math.min(this.boss.spawn, 0.3);
  }

  /** Iblis: 2-fazadan olov imp'lari (xonada ko'pi bilan 2 ta). */
  private updateDevil(b: Boss) {
    if (!b.wantSummon) return;
    b.wantSummon = false;
    const alive = this.enemies.filter((e) => e.kind === "imp" && !e.dead).length;
    const n = impSummonCount(alive);
    for (let k = 0; k < n; k++) {
      const e = new Enemy("imp", b.x + (k ? 26 : -26), b.y - 10);
      e.spawn = e.spawnMax = 0.8;
      this.enemies.push(e);
    }
    if (n) this.fx.burst(b.x, b.y, "#ff6a2a", 16, 70, 2);
  }

  /** O'rmon Shohi: ildiz ovozi va o'rgimchak chaqirish (xonada ko'pi bilan 3 ta). */
  private updateForestKing(k: ForestKing) {
    for (const w of k.wilted) {
      this.fx.burst(w.x, w.y - 8, "#e0679a", 14, 70, 2);
      this.fx.burst(w.x, w.y - 8, "#a6f08e", 8, 50, 1);
      this.fx.text(w.x, w.y - 20, "GUL SO'LDI", "#ffb3d0");
      this.score += 50;
      sfx.kill();
    }
    k.wilted = [];
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
    if (q.justEncased) {
      q.justEncased = false;
      sfx.iceSpike();
      this.fx.burst(p.x, p.y, "#dceeff", 16, 60, 2);
      this.fx.text(p.x, p.y - 20, this.touch ? "TEZ BOS!" : "TEZ BOS: HUJUM / DASH!", "#7fe9ff");
    }
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
  startChapter(n: 2 | 3 | 4 = 2) {
    if (n === 2) this.noDeathRun = true;
    this.chapter = n;
    const p = this.player;
    p.heal(1);
    this.chStart = { powers: savePowers(p), score: this.score, tags: { ...this.tagCounts } };
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
    this.applySkin();
    Object.assign(this.player, s.powers);
    this.score = s.score;
    this.tagCounts = { ...s.tags };
    this.wardT = 0;
    // roguelike: artefaktlar o'lim bilan yo'qoladi
    this.clearArtifacts();
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
    // Mergan dunyoga to'la baraban bilan kiradi
    p.ammo = p.ammoMax;
    p.reloadT = p.fanLeft = p.hideT = 0;
    this.phase = "play";
    this.newBest = false;
    this.newCh2Best = false;
    this.newCh3Best = false;
    this.newCh4Best = false;
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
    ch.hp = this.hasArtifact("key") ? 0 : ch.hp - 1;
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
    const heart = rand() < CHEST_HEART || this.hasArtifact("key");
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
    // artefakt: 15% (kunlik sinovda yo'q)
    const artifact = rand() < ARTIFACT_CHEST ? this.gainArtifact(ch.x, ch.y - 24) : null;
    return { gold, heart, card, artifact };
  }

  /** Bajarilgan harakat ko'rsatmasini yashiradi; hammasi bajarilsa qayta chiqmaydi. */
  private doneHint(h: Hint) {
    if (!this.hints.includes(h)) return;
    const key = this.hintKey();
    this.hints = this.hints.filter((x) => x !== h);
    if (!this.hints.length) save(key, 1);
  }

  /** Ko'rsatmalar qaysi kalitda saqlanadi: umumiy darslik yoki Samuray maslahatlari */
  private hintKey() {
    return this.hints.some((h) => SAMURAI_TIPS.includes(h)) ? SAMURAI_TIPS_KEY : TUTORIAL_KEY;
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

  /** Sensor: hozir joystik bilan yurish mumkinmi (jang paytida, pauzasiz). */
  acceptsMove() {
    return this.phase === "play" && this.stage === "fight" && !this.paused && !this.player.dead;
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
    if (this.daily && this.phase === "play") {
      this.saveDailyResult(false);
      this.reportRun(false);
    }
    this.bankGold();
    this.flushStats(this.phase === "play");
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
  /**
   * Pauza tugmalari: davom etish, SOZLAMALAR (o'ynab turib boshqaruvni moslash), qaytadan
   * boshlash (kunlik sinovda yo'q) va bosh menyu.
   */
  private pauseButtons() {
    const list: [label: string, act: () => void][] = [
      [
        this.touch ? "Davom etish" : `Davom etish: ${actionKey(this.input.keyBinds, "pause")}`,
        () => this.setPaused(false),
      ],
      ["Sozlamalar", () => this.onSettings?.()],
      // kunlik sinovda qayta boshlash yo'q — bitta urinish
      ...(this.daily ? [] : [["Qaytadan boshlash", () => this.restart()] as [string, () => void]]),
      [this.daily ? "Menyuga (urinish tugaydi)" : "Bosh menyuga qaytish", () => this.exitToMenu()],
    ];
    return list.map(([label, act], i) => ({
      label,
      act,
      rect: { x: ROOM.w / 2 - 80, y: ROOM.h / 2 - 2 + i * 22, w: 160, h: 18 },
    }));
  }
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
      const art = this.artifacts.findIndex((_, i) => hit(this.pauseArtRect(i)));
      if (art >= 0) {
        this.pauseArt = art;
        return;
      }
      this.pauseButtons()
        .find((b) => hit(b.rect))
        ?.act();
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
    if (this.intro > 0) return this.skipIntro();
    if (this.phase === "play" && this.stage === "fight") {
      // HUD'dagi artefakt ikonkasi: bosilsa tavsifi chiqadi
      const art = this.artifacts.findIndex((_, i) => hit(this.artRect(i)));
      if (art >= 0) this.artInfo = { id: this.artifacts[art]!, timer: 3 };
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
    // o'yin ichida SOZLAMALAR o'zgarsa darhol qo'llanadi
    this.offSettings = onSettingsChange((st) => {
      this.shakeOn = st.shake;
      this.damageNumsOn = st.damageNumbers;
    });
    this.canvas.addEventListener("click", this.onClick);
    document.addEventListener("visibilitychange", this.onVisibility);
    window.addEventListener("blur", this.onBlur);
    this.last = performance.now();
    const loop = (now: number) => {
      // last har kadrda yangilanadi: pauza vaqti dt ga qo'shilmaydi
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      if (this.input.consumePause()) this.setPaused(!this.paused);
      if (this.input.consumeAction("mute")) sfx.toggleMute();
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
    this.offSettings?.();
    this.offSettings = null;
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
    // tanga HUD'dagi oltin hisobiga uchib boradi (oltin allaqachon qo'shilgan — faqat ko'rinish)
    this.cfx.fly("coin", c.x, c.y, ROOM.w - 8, ROOM.h - 9, this.fx.isReduced());
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
    this.endlessFrom = this.stats.time;
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
    // tanlangan karta porlab yuqoriga uchadi (hudFx.ts) — faqat ko'rinish
    if (!this.fx.isReduced()) this.hud.pick({ ...this.cardRect(i), color: u.color, name: u.name });
    u.apply(this.player);
    sfx.upgrade();
    this.fx.text(this.player.x, this.player.y - 16, u.name, u.color);
    this.fx.burst(this.player.x, this.player.y, u.color, 18, 70);
    for (const tag of u.tags) this.gainTag(tag);
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

  /** Karta tegi: 2 ta — kichik bonus, 3 ta — SINERGIYA (qahramon rangida yozuv va uchqunlar). */
  private gainTag(tag: Tag) {
    const p = this.player;
    const got = addTag(this.tagCounts, tag, p);
    if (!got) return;
    const def = TAGS[tag];
    if (got === "two") {
      this.fx.text(p.x, p.y - 26, `${def.name} 2/3: ${def.two}`, def.color);
      return;
    }
    const theme = this.theme;
    this.synNote = { tag, timer: SYN_NOTE };
    this.fx.text(p.x, p.y - 26, "SINERGIYA!", theme.accent);
    this.fx.burst(p.x, p.y, theme.accent, 30, 110, 2);
    this.fx.burst(p.x, p.y, theme.glow, 14, 70, 1);
    this.fx.addShake(0.2);
    if (tag === "himoya") {
      p.ward = Math.max(p.ward, 1);
      this.wardT = 0;
    }
    this.onSynergy();
  }

  /** Sinergiya ochildi: bir o'yinda 2 ta — "Sinergiya ustasi". */
  private onSynergy() {
    if (synergies(this.tagCounts).length >= 2) this.achieve("synergy2");
  }

  /** Shu tegdan sinergiya ochilganmi */
  syn(tag: Tag) {
    return hasTag(this.tagCounts, tag);
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
    // chap/o'ng — qayta belgilangan yurish tugmalari yoki strelkalar
    const left = inp.consumeAction("left") || inp.consumeKey("ArrowLeft");
    const right = inp.consumeAction("right") || inp.consumeKey("ArrowRight");
    if (left) this.choiceIndex = (this.choiceIndex + n - 1) % n;
    if (right) this.choiceIndex = (this.choiceIndex + 1) % n;
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
    const p0 = this.player;
    const dropExtra = hasTag(this.tagCounts, "hayot", 2) ? DROP_BONUS : 0;
    if (Math.random() < DROP_CHANCE + this.dropBonus + dropExtra)
      this.drops.push({ x: e.x, y: e.y, life: 9 });
    // ZARAR sinergiyasi: o'lgan dushman kichik portlash bilan atrofdagilarga 1 zarar (zanjir yo'q)
    // (boss — yo'q: bitta nishonga zarar boss formulasiga ta'sir qilmasin)
    if (this.syn("zarar") && !this.blasting)
      this.blast(e.x, e.y, BLAST_RADIUS, BLAST_DMG, "#ff6a4d", false);
    if (this.hasArtifact("chain") && !this.blasting) this.chainZap(e);
    if (this.hasArtifact("combo") && this.combo % COMBO_HEAL_EVERY === 0 && p0.heal(1))
      this.fx.text(p0.x, p0.y - 14, "+1 YURAK", artifactById("combo").color);
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

  /**
   * O'yinchining to'g'ridan-to'g'ri zarbasi (qilich, shar, o'q, hamla): artefakt ko'paytuvchilari
   * (O'NINCHI ZARB, QASOS) shu yerda.
   */
  private strike(t: Enemy | Boss, dmg: number, knock: boolean | number = true, force = false) {
    let mul = 1;
    this.hitCount++;
    if (this.hasArtifact("tenth") && this.hitCount % TENTH_EVERY === 0) {
      mul *= 2;
      this.fx.text(t.x - 10, t.y - t.size / 2 - 16, "x2", artifactById("tenth").color);
    }
    if (this.revengeReady) {
      this.revengeReady = false;
      mul *= REVENGE_MUL;
      this.fx.text(t.x, t.y - t.size / 2 - 22, "QASOS!", artifactById("revenge").color);
      this.fx.burst(t.x, t.y, artifactById("revenge").color, 10, 80, 1);
    }
    // kritik zarba: 2 baravar, sariq "KRIT!", kattaroq uchqun, biroz uzunroq hit-stop
    // Samuray: mukammal chetlanishdan keyingi zarba — kafolatlangan kritik; SOVUQ QON — jon kam
    // bo'lsa ehtimol oshadi
    const p = this.player;
    const sure = force || (p.critReady && !t.dead);
    if (p.critReady && !t.dead) p.critReady = false;
    const chance =
      CRIT_CHANCE + (p.coldBlood && p.hp <= COLD_BLOOD_HP && !p.dead ? COLD_BLOOD_CRIT : 0);
    const crit = !t.dead && (sure || rollCrit(this.critRand, chance));
    if (crit) {
      mul *= CRIT_MUL;
      this.freeze = Math.max(this.freeze, CRIT_FREEZE);
      // zarar raqamidan (t.y − size/2 − 10) yuqoriroqda
      this.fx.text(fitX(t.x), t.y - t.size / 2 - 30, "KRIT!", CRIT_COLOR);
      this.fx.burst(t.x, t.y, CRIT_COLOR, 14, 100, 2);
      this.fx.burst(t.x, t.y, "#ffffff", 6, 70, 1);
    }
    this.damageTarget(t, dmg * mul, knock, crit);
  }

  /**
   * Boss joni uchun o'yinchi kuchiga qo'shimcha: kritik zarbaning o'rtacha ulushi (+8%) va bossga
   * ta'sir qiladigan artefaktlar. Sinergiyalar Player ko'rsatkichlarida (heroDps ularni o'qiydi).
   */
  powerFactor() {
    let extra = 0;
    if (this.hasArtifact("tenth")) extra += 1 / TENTH_EVERY;
    if (this.hasArtifact("lastshot") && this.player.gunner)
      extra += (LAST_SHOT_MUL - 1) / Math.max(1, this.player.ammoMax);
    if (this.hasArtifact("flame")) extra += 0.05;
    if (this.hasArtifact("revenge")) extra += 0.03;
    // Samuray kartalari: SOVUQ QON (jon kam paytdagi kritik), GULBARG BO'RONI (chetlanish zarbasi)
    if (this.player.coldBlood) extra += COLD_BLOOD_CRIT * 0.3;
    if (this.player.petalStorm) extra += 0.05;
    return CRIT_AVG * (1 + extra);
  }

  hasArtifact(id: ArtifactId) {
    return this.artifacts.includes(id);
  }

  private clearArtifacts() {
    this.artifacts = [];
    this.flames = [];
    this.burnAt = new WeakMap();
    this.hitCount = 0;
    this.revengeReady = false;
    this.lastBreathUsed = false;
    this.wasSpinning = false;
    this.zaps = [];
    this.artInfo = null;
    this.pauseArt = -1;
  }

  /** Yangi artefakt (takrorlanmaydi). Kunlik sinovda tushmaydi. */
  gainArtifact(x: number, y: number, rand: () => number = Math.random) {
    if (this.daily) return null;
    const a = rollArtifact(this.hero, this.artifacts, rand);
    if (!a) return null;
    this.artifacts.push(a.id);
    this.artInfo = { id: a.id, timer: 3.5 };
    this.fx.text(fitX(x, 60), Math.max(30, y), `ARTEFAKT: ${a.name}`, a.color);
    this.fx.burst(x, y + 10, a.color, 20, 90, 2);
    this.fx.burst(x, y + 10, "#ffffff", 8, 60, 1);
    sfx.upgrade();
    if (a.id === "aegis") this.player.ward = Math.max(this.player.ward, 1);
    if (this.artifacts.length >= COLLECTOR_AT) this.achieve("collector");
    return a.id;
  }

  /** Atrofdagi dushmanlarga portlash (sinergiya/artefakt); undan o'lganlar yana portlamaydi. */
  private blasting = false;
  private blast(x: number, y: number, r: number, dmg: number, color: string, boss = true) {
    this.fx.burst(x, y, color, 16, 90, 2);
    this.fx.burst(x, y, "#fff2a8", 6, 50, 1);
    this.rings.push({ x, y: y + 4, r, life: 0.3, max: 0.3, color });
    const targets: (Enemy | Boss)[] = this.enemies.filter((e) => e.active);
    if (boss && this.boss?.active) targets.push(this.boss);
    this.blasting = true;
    for (const t of targets)
      if (Math.hypot(t.x - x, t.y - y) - t.size / 2 < r) this.damageTarget(t, dmg, 160);
    this.blasting = false;
  }

  /** CHAQMOQ ZANJIRI: o'lgan dushmandan eng yaqin dushmanga 1 zarar. */
  private chainZap(from: Enemy) {
    let near: Enemy | null = null;
    let nearD = CHAIN_RADIUS;
    for (const e of this.enemies) {
      if (e === from || !e.active) continue;
      const d = Math.hypot(e.x - from.x, e.y - from.y);
      if (d < nearD) {
        nearD = d;
        near = e;
      }
    }
    if (!near) return;
    this.zaps.push({ x1: from.x, y1: from.y, x2: near.x, y2: near.y, life: 0.18 });
    this.fx.burst(near.x, near.y, artifactById("chain").color, 6, 60, 1);
    this.blasting = true;
    this.damageTarget(near, 1, 120);
    this.blasting = false;
  }

  private onPlayerHurt() {
    const p = this.player;
    if (this.hasArtifact("revenge") && p.hp > 0) this.revengeReady = true;
    if (this.hasArtifact("lastbreath") && p.hp === 1 && !this.lastBreathUsed) {
      this.lastBreathUsed = true;
      p.invuln = Math.max(p.invuln, LAST_BREATH_TIME);
      this.fx.text(p.x, p.y - 22, "SO'NGGI NAFAS!", artifactById("lastbreath").color);
      this.fx.burst(p.x, p.y, "#ffffff", 16, 80, 2);
    }
    if (this.hasArtifact("frostheart") && p.hp > 0) {
      for (const e of this.enemies) if (e.active) e.stun = Math.max(e.stun, FROST_HEART_TIME);
      if (this.boss?.active) this.boss.slow = Math.max(this.boss.slow, FROST_HEART_TIME);
      this.fx.burst(p.x, p.y, artifactById("frostheart").color, 18, 100, 2);
    }
    if (this.hasArtifact("vowlight") && p.vowing) this.vowLight();
    // HIMOYA bonusi: zarbadan keyin biroz uzoqroq daxlsizlik
    if (hasTag(this.tagCounts, "himoya", 2) && p.hp > 0) p.invuln += GUARD_BONUS;
    // telefonda qisqa tebranish; boss jangida — kuchliroq
    if (this.touch) vibrate(this.boss?.active ? BOSS_BUZZ : HIT_BUZZ);
    this.waveHurt = true;
    if (this.boss) this.bossClean = false;
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
  private damageTarget(t: Enemy | Boss, dmg: number, knock: boolean | number = true, crit = false) {
    const p = this.player;
    this.threat.add(PLAYER_ID, dmg, this.hero);
    const hpBefore = t.hp;
    if (t instanceof Boss) {
      // boss zarbadan to'xtamaydi; faza almashinuvida daxlsiz
      if (!t.takeDamage(dmg)) {
        if (t.invulnerable && !t.dead) {
          sfx.block();
          this.fx.burst(t.x, t.y - 6, "#e0d6ee", 4, 40, 1);
        }
        return;
      }
    } else applyHit(t, dmg, p.x, p.y, typeof knock === "number" ? knock : knock ? 220 : 0);
    this.superMeter.add(hpBefore - Math.max(0, t.hp));
    // zarba nuqtasida kichik uchqun, kritikda — alohida oltin chaqnash (faqat ko'rinish)
    const hd = Math.hypot(t.x - p.x, t.y - p.y) || 1;
    const edge = Math.min(t.size / 2, 8);
    this.cfx.spark(
      t.x - ((t.x - p.x) / hd) * edge,
      t.y - 3 - ((t.y - p.y) / hd) * edge,
      crit,
      this.fx.isReduced(),
    );
    // zarar raqami: haqiqatda ketgan jon; ochko yozuvi (+20) bilan ustma-ust tushmasin
    if (this.damageNumsOn)
      this.fx.damage(t.x + 4, t.y - t.size / 2 - 10, hpBefore - Math.max(0, t.hp), crit);
    if (t.hp > 0) return;
    if (t instanceof Enemy) this.onKill(t);
    else {
      const queen = t instanceof Queen;
      const king = t instanceof ForestKing;
      const oni = t instanceof Oni;
      const pts = oni ? ONI_POINTS : king ? KING_POINTS : queen ? QUEEN_POINTS : BOSS_POINTS;
      this.score += pts;
      if (!king && !oni) this.achieve(queen ? "queen" : "boss");
      if (p.paladin && this.bossClean) this.achieve("wallNoShield");
      this.fx.text(t.x, t.y - 24, `+${pts}`, "#ffcc33");
      // Abadiyat olami: birinchi g'alabada darvoza kaliti, faol topshiriqda — Iblis shoxi
      // (Oni Abadiyat olami darvozasini ochmaydi — uning kaliti yo'q)
      if (!oni && recordBossKey(king ? "king" : queen ? "queen" : "devil"))
        this.fx.text(t.x, t.y - 44, "DARVOZA KALITI!", "#c9a25a");
      this.runBosses++;
      // yozuv boss ostida: tepada XP, kalit va ochko yozuvlari bor
      this.gainArtifact(t.x, t.y + 40);
      this.gainXp(king || oni ? XP.king : queen ? XP.queen : XP.devil, t.x, t.y - 54);
      if (!king && !queen && !oni && hornWanted()) {
        sendToRealm(HORN_ITEM);
        this.fx.text(t.x, t.y - 34, "IBLIS SHOXI — OLAMGA", "#ff7a2a");
        this.fx.burst(t.x, t.y - 10, "#ff7a2a", 16, 80, 2);
      }
      this.fx.burst(
        t.x,
        t.y,
        oni ? "#ff8fb8" : king ? "#a6f08e" : queen ? "#7fe9ff" : "#f4cb45",
        40,
        120,
        3,
      );
      // sekin harakat va tanga yomg'iri (oflayn o'yin; oltin miqdori o'zgarmaydi)
      this.slowmo = SLOWMO_TIME;
      for (let k = 0; k < COIN_RAIN; k++)
        this.coinRain.push({
          x: ROOM.wall + Math.random() * (ROOM.w - ROOM.wall * 2),
          y: -10 - Math.random() * 120,
          vy: 70 + Math.random() * 60,
          life: 3,
        });
      this.fx.addShake(0.6);
      this.shots = [];
      // Boss xazinasi: 5 ta tanga atrofga sochiladi
      const gold = oni ? ONI_GOLD : king ? KING_GOLD : queen ? QUEEN_GOLD : BOSS_GOLD;
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
    // haqiqiy vaqt: mukammal chetlanishda dunyo sekinlashadi, Samuray esa yo'q
    const raw = dt;
    // boss o'ldi: 1 s sekin harakat (o'yin tezligi 0.3)
    if (this.slowmo > 0) {
      this.slowmo -= dt;
      dt *= SLOWMO_SPEED;
    }
    if (this.focus > 0) this.focus = this.slowmo > 0 ? this.focus - raw : 0;
    if (this.coinRain.length) {
      for (const r of this.coinRain) {
        r.y += r.vy * dt;
        r.life -= dt;
      }
      this.coinRain = this.coinRain.filter((r) => r.life > 0 && r.y < ROOM.h + 8);
    }
    this.time += dt;
    this.fx.update(dt);
    this.cfx.update(dt);
    // HUD'ga yetib kelgan tanga/yurak: hisob bir lahza "sakraydi" (hudFx — faqat ko'rinish)
    for (const kind of this.cfx.arrived) this.hud.arrive(kind);
    this.cfx.arrived.length = 0;
    this.hud.update(dt, this.player.hp, this.runGold, this.banner.timer, this.banner.title);
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
      // sekin vaqtda hit-stop cho'zilib ketmasin
      this.freeze -= this.focus > 0 ? raw : dt;
      return;
    }
    if (this.intro > 0) {
      // boss kirishi: dunyo to'xtaydi, boss paydo bo'ladi; istalgan tugma — o'tkazib yuborish
      const b = this.boss;
      if (!b || b.spawn <= 0) this.intro = 0;
      else {
        this.intro -= dt;
        b.update(dt, this.player);
        // boss o'z zarbasini ko'rsatdi (mobAnim.ts): zarba kadrida bir marta ovoz
        if (!this.introHit && introFrame(b.spawn, b.spawnMax) === 2) {
          this.introHit = true;
          // (yangi ekran silkinishi qo'shilmaydi — faqat ovoz)
          sfx.stomp();
        }
        const skip =
          this.input.consumeEnter() || this.input.consumeAttack() || this.input.consumeDash();
        if (skip || this.intro <= 0) this.skipIntro();
        return;
      }
    }
    if (this.phaseFlash > 0) this.phaseFlash -= dt;
    if (this.banner.timer > 0) this.banner.timer -= dt;
    if (this.comboTimer > 0) this.comboTimer -= dt;
    else this.combo = 0;

    const p = this.player;
    const hpBefore = p.hp;
    if (p.hunter) p.threat = this.nearestThreat();
    const px0 = p.x,
      py0 = p.y;
    this.parryNote = false;
    p.update(this.focus > 0 ? raw : dt, this.input);
    // qadam changi (faqat ko'rinish): oyoq yerga tekkan kadrda
    if (p.vis.step) {
      p.vis.step = false;
      if (!p.dashing && !p.dead) this.fx.dust(p.x, p.y + 12, STEP_DUST[this.chapter]);
    }
    this.applySlip(px0, py0, dt);
    this.updateSynergies(dt);
    this.updateArtifacts(dt);
    if (p.brokeIce) {
      p.brokeIce = false;
      sfx.block();
      this.fx.burst(p.x, p.y, "#eef7ff", 18, 90, 2);
      this.fx.text(p.x, p.y - 16, "MUZ SINDI!", "#eef7ff");
    }
    if (p.traps.length) {
      for (const t of p.traps) this.traps.push({ ...t, life: TRAP_LIFE, snapT: -1 });
      p.traps = [];
      // ko'pi bilan 2 ta: eng eskisi yo'qoladi
      while (this.traps.filter((t) => t.snapT < 0).length > MAX_TRAPS) {
        const i = this.traps.findIndex((t) => t.snapT < 0);
        this.traps.splice(i, 1);
      }
      this.hb(p.x, p.y + 6, this.theme.rim, 6, 40, 1);
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
        this.hb(s.x, s.y, this.theme.core, 18, 70, 3);
        this.hb(s.x, s.y, this.theme.spark, 10, 40, 3);
      }
      p.smokes = [];
      this.fx.text(p.x, p.y - 16, "TUTUN", "#d9d2c6");
    }
    if (p.smokeDenied) {
      p.smokeDenied = false;
      this.fx.text(p.x, p.y - 16, `TUTUN ${Math.ceil(p.smokeCooldown)}s`, "#b8a8cc");
    }
    this.updateSmokes(dt);
    this.threat.update(dt);
    if (p.paladin) this.updatePaladin(dt);
    if (p.samurai) this.updateSamurai(dt, px0, py0);
    if (this.hints.length) {
      if (p.attackTimer > 0) this.doneHint("attack");
      if (p.spinning || p.iai) this.doneHint("spin");
      if (p.dashing && !p.iai) this.doneHint("dash");
    }
    if (p.chill > 0) this.waveChilled = true;
    if (p.teleportFrom) {
      // teleport: chiqqan joyda qora tutun, ikkala joyda qizil uchqunlar
      const T = this.theme;
      this.hb(p.teleportFrom.x, p.teleportFrom.y, T.shade, 14, 30, 3);
      this.hb(p.teleportFrom.x, p.teleportFrom.y, T.spark, 6, 70, 1);
      this.hb(p.x, p.y, T.mist, 8, 25, 3);
      this.hb(p.x, p.y, T.hot, 10, 60, 1);
      if (this.hasArtifact("flame"))
        for (const at of [p.teleportFrom, { x: p.x, y: p.y }])
          for (let k = 0; k < 3; k++)
            this.flames.push({ x: at.x + (k - 1) * 6, y: at.y + 4, life: FLAME_LIFE });
      // SEHR sinergiyasi: chiqqan joyda olov portlaydi
      if (this.syn(HERO_TAG.mage) && p.mage)
        this.blast(
          p.teleportFrom.x,
          p.teleportFrom.y,
          TELE_BLAST_RADIUS,
          p.damage * TELE_BLAST_MUL,
          "#ff5a3c",
          false,
        );
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
    if (p.dashing && !p.mage) this.ht(p.x, p.y + 2, this.theme.trail);
    // Samuray dashi: orqasidan gulbarglar uchadi
    if (p.dashing && p.samurai && Math.random() < 0.6)
      this.fx.burst(p.x - p.dashX * 6, p.y + 2, this.theme.spark, 1, 30, 2, "leaf");
    if (p.bolts.length) {
      // OXIRGI O'Q: barabandagi oxirgi o'q kuchliroq
      if (p.gunner && p.ammo === 0 && this.hasArtifact("lastshot")) {
        const last = p.bolts[p.bolts.length - 1]!;
        last.power = LAST_SHOT_MUL;
        last.size += 1;
      }
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
        // olov imp — kichik olov shari, kitsune — ko'k olov, kamonchi — o'q
        const imp = e.kind === "imp";
        const fox = e.kind === "kitsune";
        for (const s of e.shots)
          this.shots.push(
            fox
              ? { ...s, size: 5, blue: true, owner: e }
              : imp
                ? { ...s, size: 5, owner: e }
                : { ...s, size: 4, arrow: true, owner: e },
          );
        e.shots = [];
        if (fox) sfx.foxfire();
        else if (imp) sfx.fireball();
        else sfx.arrow();
      }
      if (e.cue) {
        // Sakura bog'i moblari: tutun, tig' va sho'ng'ish ovozlari hamda uchqunlari
        const cue = e.cue;
        e.cue = null;
        if (cue === "vanish" || cue === "appear") {
          this.fx.burst(e.x, e.y - 2, KILL_COLOR.ninja, 10, 50, 2);
          if (cue === "appear") sfx.ninja();
          else sfx.smoke();
        } else if (cue === "slash") sfx.ninjaSlash();
        else if (cue === "dive") {
          sfx.swoop();
          this.fx.addShake(0.05);
          this.fx.burst(e.x, e.y + 5, KILL_COLOR.tengu, 8, 60, 1);
        } else sfx.foxCharge();
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
      if (boss.justPhased) {
        // yangi faza: qisqa daxlsizlik, ekran chaqnaydi, sahna rangi o'zgaradi, yangi hujum
        boss.justPhased = false;
        const b = PHASE_BANNERS[this.bossKind(boss)][boss.phase - 2]!;
        this.banner = { title: b.title, sub: b.sub, timer: 2 };
        this.phaseFlash = 0.5;
        this.shots = [];
        sfx.roar();
        this.fx.addShake(0.5);
        this.fx.burst(boss.x, boss.y, BOSS_CARDS[this.bossKind(boss)].color, 30, 110, 2);
        // HAYOT sinergiyasi: faza almashganda +1 yurak
        if (this.syn("hayot") && p.heal(1)) this.fx.text(p.x, p.y - 14, "+1 YURAK", "#ff4d6d");
        if (this.hasArtifact("phasewave"))
          this.blast(
            p.x,
            p.y,
            PHASE_WAVE_RADIUS,
            PHASE_WAVE_DMG,
            artifactById("phasewave").color,
            false,
          );
      }
      if (boss.justBerserk) {
        boss.justBerserk = false;
        this.banner = { title: "G'AZAB!", sub: "Boss tezlashdi, zarbalari kuchaydi!", timer: 2 };
        sfx.roar();
        this.fx.addShake(0.4);
      }
      if (boss.justWarned) {
        boss.justWarned = false;
        sfx.warn();
      }
      if (boss.justSlammed) {
        this.fx.addShake(0.2);
        if (boss instanceof Queen) sfx.blizzard();
      }
      if (boss instanceof Queen) this.updateQueen(boss, dt);
      if (boss instanceof ForestKing) this.updateForestKing(boss);
      if (boss instanceof Oni) {
        if (boss.justIgnited) {
          boss.justIgnited = false;
          sfx.fireball();
          this.fx.addShake(0.12);
        }
      } else if (!(boss instanceof Queen) && !(boss instanceof ForestKing)) this.updateDevil(boss);
      if (boss.shots.length) {
        for (const s of boss.shots)
          this.shots.push({ ...s, size: 6, dmg: boss.dmg(1), owner: boss });
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
      if (!s.arrow && Math.random() < 0.5)
        this.fx.trail(s.x, s.y, s.blue ? "rgba(90,184,255,0.7)" : "rgba(255,140,40,0.7)");
    }
    const inRoom = (s: Shot) =>
      s.x > ROOM.wall && s.x < ROOM.w - ROOM.wall && s.y > ROOM.wall && s.y < ROOM.h - ROOM.wall;
    this.shots = this.shots.filter(inRoom);
    this.updateWebs(dt);
    this.updateClouds(dt);
    this.updateTraps(dt);
    this.updatePoison(dt);
    // O'rmon Shohi 3-fazasida xona asta qorong'ilashadi
    const dark = boss instanceof ForestKing && boss.dark;
    this.darkness = Math.max(0, Math.min(1, this.darkness + (dark ? dt : -dt * 2)));

    // sehrli sharlar: birinchi tekkan dushmanga zarar, dushman o'q/olovini ham yo'q qiladi
    if (this.bolts.length) {
      const targets: (Enemy | Boss)[] = this.enemies.filter((e) => e.active);
      if (boss?.active) targets.push(boss);
      const T = this.theme;
      this.bolts = this.bolts.filter((b) => {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.reflect) {
          // parry bilan qaytarilgan snaryad: pushti iz
          if (Math.random() < 0.6) this.ht(b.x, b.y, withAlpha(T.accent, 0.7));
        } else if (b.bullet || b.wave) {
          // Mergan o'qi: ingichka mis iz, masofasi tugasa so'nadi (Paladin to'lqini — oq-oltin nur)
          if (Math.random() < 0.5) this.ht(b.x, b.y, withAlpha(T.glow, b.wave ? 0.6 : 0.55));
          b.range = (b.range ?? Infinity) - Math.hypot(b.vx, b.vy) * dt;
          if (b.range <= 0) {
            this.hb(b.x, b.y, T.mist, 3, 20, 1);
            return false;
          }
        }
        // Sehrgar shari — qora tutunli iz, kuchli o'q — yashil iz
        else if (!b.arrow && Math.random() < 0.6) this.ht(b.x, b.y, withAlpha(T.shade, 0.75));
        if (b.arrow && (b.power ?? 1) > 1 && Math.random() < 0.7)
          this.ht(b.x, b.y, withAlpha(T.accent, 0.7));
        const body = { x: b.x, y: b.y, size: b.size } as Body;
        const t = targets.find((t) => !t.dead && !b.hit.includes(t) && overlap(body, t));
        // qalqon oldidan kelgan sharni to'sadi (kuchli o'q teshib 1 zarar beradi)
        const strong = (b.power ?? 1) > 1 || !!b.wave;
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
        // Malikaning ko'zgu nusxasi sharni yutadi, Shohning hayot guli zarar oladi
        const part = !t && boss?.active ? boss.partAt(body) : null;
        if (part && !b.hit.includes(part)) {
          this.strikePart(boss!, part, p.damage * (b.power ?? 1), b.x, b.y);
          b.hit.push(part);
          return false;
        }
        if (t) {
          sfx.hit();
          this.fx.addShake(0.06);
          this.hb(
            b.x,
            b.y,
            b.wave ? T.accent : b.bullet ? T.glow : b.arrow ? T.spark : T.hot,
            6,
            60,
            1,
          );
          heroImpact(this.fx, this.look, b.x, b.y);
          if (b.poison && !t.dead) {
            t.poison = POISON_TIME;
            this.fx.burst(t.x, t.y, "#a6f08e", 5, 40, 1);
          }
          if (b.reflect) this.reflectHit(t);
          else this.strike(t, p.damage * (b.power ?? 1));
          if (b.bullet && t instanceof Enemy && t.dead) this.drumKill(b.load ?? 0);
          // teshuvchi shar keyingi dushmangacha uchishda davom etadi
          b.hit.push(t);
          if (--b.left <= 0) return false;
        }
        const n = this.shots.length;
        this.shots = this.shots.filter((s) => !overlap(body, s as unknown as Body));
        if (this.shots.length < n) {
          this.score += 5 * (n - this.shots.length);
          this.hb(b.x, b.y, b.arrow || p.mage ? T.core : this.skinned("#a3192a", T.core), 6, 50);
          // zarb to'lqini o'qlarni yutib, uchishda davom etadi
          return !!b.wave;
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
          // Paladin zarbasi og'irroq: uzunroq hit-stop
          this.freeze = p.paladin ? 0.07 : 0.045;
          this.fx.addShake(p.spinning ? 0.14 : 0.08);
          this.hb(t.x, t.y, p.spinning && !p.mage ? this.theme.accent : this.theme.spark, 5, 60, 1);
          heroImpact(this.fx, this.look, t.x, t.y);
          // Paladin: SHANG kuchli itaradi, OSMON HUKMI gangitadi (boss — sekinlashadi)
          const heavy = p.paladin;
          if (heavy && p.spinning && !t.dead) {
            if (t instanceof Enemy) t.stun = Math.max(t.stun, SKY_STUN);
            else t.slow = Math.max(t.slow, SKY_STUN);
            this.fx.text(t.x, t.y - 14, "GANGIDI", this.theme.glow);
          }
          const wasAlive = !t.dead;
          if (this.hasArtifact("slowring") && p.mage && p.spinning && !t.dead)
            t.slow = Math.max(t.slow, SLOW_RING);
          this.strike(t, blocked ? 1 : p.hitDamage, heavy ? 340 : true);
          if (heavy && !p.spinning && wasAlive && t.dead && t instanceof Enemy) this.slamKill();
        }
      }
      const part = boss?.active ? boss.partAt(box) : null;
      if (part && !p.hitSet.has(part)) {
        p.hitSet.add(part);
        this.freeze = 0.03;
        this.strikePart(boss!, part, p.hitDamage, part.x, part.y);
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
        // Samuray parry oynasida: snaryad yo'q bo'lmaydi — egasiga qaytadi
        if (p.parrying) {
          this.parryShot(s);
          return false;
        }
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
        if (
          e.active &&
          // IAI bilan belgilangan (kesilishini kutayotgan) dushman tegib zarar bermaydi
          !this.iaiMarks.includes(e) &&
          overlap(p, e) &&
          p.takeHit(1, e.x, e.y, 180) &&
          e.kind === "iceblob"
        )
          // muz slime tegsa sekinlashtiradi
          p.chill = Math.max(p.chill, ICEBLOB_CHILL);
      if (boss?.active && overlap(p, boss)) p.takeHit(boss.dmg(1), boss.x, boss.y, 220);
      this.shots = this.shots.filter((s) => {
        if (!overlap(p, s as unknown as Body)) return true;
        if (p.parrying && !p.evading) {
          this.parryShot(s);
          return false;
        }
        return !p.takeHit(s.dmg ?? 1, s.x, s.y, 160);
      });
    }
    // Samuray: shu kadrda qaytarilgan zarbalar va mukammal chetlanish (dushman hujumlaridan keyin)
    if (p.samurai) this.resolveSamurai();
    if (p.hp < hpBefore) this.onPlayerHurt();

    // yurak terish
    for (const d of this.drops) d.life -= dt;
    this.drops = this.drops.filter((d) => {
      if (d.life <= 0) return false;
      if (Math.hypot(d.x - p.x, d.y - p.y) > 11 || p.dead) return true;
      if (p.heal(1)) {
        this.fx.text(d.x, d.y - 8, "+1 YURAK", "#ff4d6d");
        // yurak HUD'dagi o'z katagiga uchib boradi
        this.cfx.fly("heart", d.x, d.y, 8 + (p.hp - 1) * 10, 7, this.fx.isReduced());
      } else {
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
      if (this.hasArtifact("goldwind")) p.boost = Math.max(p.boost, GOLD_BOOST);
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
        this.flushStats(true);
        this.reportRun(false);
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
              this.hero === "mage"
                ? "winMage"
                : this.hero === "hunter"
                  ? "winHunter"
                  : this.hero === "gunner"
                    ? "winGunner"
                    : this.hero === "paladin"
                      ? "winPaladin"
                      : this.hero === "samurai"
                        ? "winSamurai"
                        : "winKnight",
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
            if (this.chapter === 4) {
              // Sakura bog'i: Samuray bilan tugatilsa — alohida yutuq
              if (this.hero === "samurai") this.achieve("winSakura");
              if (this.score > this.ch4Best) {
                this.ch4Best = this.score;
                this.newCh4Best = true;
                save(bestKeys(this.hero).ch4, this.ch4Best);
              }
            }
            this.stats.waves++;
            this.flushStats(true);
            this.reportRun(true);
            this.phase = "victory";
            sfx.stopMusic();
            sfx.victory();
          }
        }
      } else this.clearWave();
    }
  }

  /** QASAM NURI: QASAM paytida zarba yeganda atrofga nur. */
  private vowLight() {
    const p = this.player;
    this.blast(p.x, p.y, VOW_LIGHT_RADIUS, 1, artifactById("vowlight").color);
  }

  /** Artefaktlarning har kadrdagi ta'siri: olov izi, magnit, aylana himoyasi, chaqmoq izlari. */
  private updateArtifacts(dt: number) {
    const p = this.player;
    for (const z of this.zaps) z.life -= dt;
    this.zaps = this.zaps.filter((z) => z.life > 0);
    if (this.artInfo && (this.artInfo.timer -= dt) <= 0) this.artInfo = null;
    if (!this.artifacts.length) return;
    if (this.hasArtifact("flame")) {
      if (p.dashing && !p.mage && Math.random() < 0.7)
        this.flames.push({ x: p.x, y: p.y + 4, life: FLAME_LIFE });
      for (const f of this.flames) f.life -= dt;
      this.flames = this.flames.filter((f) => f.life > 0);
      if (this.flames.length) {
        const targets: (Enemy | Boss)[] = this.enemies.filter((e) => e.active);
        if (this.boss?.active) targets.push(this.boss);
        for (const t of targets) {
          if ((this.burnAt.get(t) ?? 0) > this.time) continue;
          const hot = this.flames.some(
            (f) => Math.hypot(f.x - t.x, f.y - t.y) < FLAME_RADIUS + t.size / 2,
          );
          if (!hot) continue;
          this.burnAt.set(t, this.time + FLAME_TICK);
          this.fx.burst(t.x, t.y, "#ff8a2a", 4, 40, 1);
          this.damageTarget(t, 1, false);
        }
      }
    }
    if (this.hasArtifact("magnet") && !p.dead) {
      for (const o of [...this.coins, ...this.drops]) {
        const dx = p.x - o.x,
          dy = p.y - o.y;
        const d = Math.hypot(dx, dy);
        if (d < MAGNET_RADIUS && d > 1) {
          const step = Math.min(d, MAGNET_SPEED * dt);
          o.x += (dx / d) * step;
          o.y += (dy / d) * step;
        }
      }
    }
    if (this.hasArtifact("spinguard") && p.spinning && !this.wasSpinning) {
      p.invuln = Math.max(p.invuln, SPIN_GUARD);
      this.fx.burst(p.x, p.y, artifactById("spinguard").color, 10, 70, 1);
    }
    this.wasSpinning = p.spinning;
  }

  /** TEZLIK (dashdan keyin tezlashish) va HIMOYA (har 20 s qalqon) sinergiyalari. */
  private updateSynergies(dt: number) {
    const p = this.player;
    if (this.synNote && (this.synNote.timer -= dt) <= 0) this.synNote = null;
    for (const r of this.rings) r.life -= dt;
    this.rings = this.rings.filter((r) => r.life > 0);
    if (this.wasDashing && !p.dashing && this.syn("tezlik")) {
      p.boost = Math.max(p.boost, DASH_BOOST);
      this.fx.burst(p.x, p.y, TAGS.tezlik.color, 6, 50, 1);
    }
    this.wasDashing = p.dashing;
    if (p.boost > 0 && Math.random() < 0.4) this.fx.trail(p.x, p.y + 4, "rgba(127,216,255,0.6)");
    if (this.syn("himoya") && p.ward < 1) {
      this.wardT += dt;
      if (this.wardT >= WARD_EVERY) {
        this.wardT = 0;
        p.ward = 1;
        this.fx.text(p.x, p.y - 18, "QALQON", TAGS.himoya.color);
      }
    }
    if (p.warded) {
      p.warded = false;
      this.fx.burst(p.x, p.y - 4, TAGS.himoya.color, 10, 70, 1);
      this.fx.text(p.x, p.y - 18, "TO'SILDI", TAGS.himoya.color);
    }
  }

  /**
   * Paladin: SHANG tayyorgarligidagi uchqunlar, zarba tushganda yoriq va zarb to'lqini, OSMON HUKMI
   * to'lqini, QASAM aurasi va MUQADDAS HAMLA yo'lidagilarni itarish.
   */
  private updatePaladin(dt: number) {
    const p = this.player;
    const T = this.theme;
    const { accent, accentDark, glow } = T;
    for (const k of this.cracks) k.life -= dt;
    this.cracks = this.cracks.filter((k) => k.life > 0);
    for (const q of this.quakes) q.life -= dt;
    this.quakes = this.quakes.filter((q) => q.life > 0);
    if (p.slamT > 0 && Math.random() < 0.6) {
      // qilich boshi uzra porlaydi: oq-oltin uchqunlar (muqaddas nur)
      const col = Math.random() < 0.5 ? accent : glow;
      this.hb(p.x + (Math.random() - 0.5) * 10, p.y - 26, col, 1, 40, 1);
    }
    if (p.slammed) {
      p.slammed = false;
      this.slamKills = { id: this.slamKills.id + 1, kills: 0 };
      const len = p.reach * 2;
      const tx = p.x + p.fx * (len + 2),
        ty = p.y + p.fy * (len + 2) + 6;
      this.cracks.push({
        x: p.x + p.fx * 8,
        y: p.y + 6 + p.fy * 8,
        fx: p.fx,
        fy: p.fy,
        len,
        life: CRACK_LIFE,
        seed: Math.random() * 1000,
      });
      this.quakes.push({ x: tx, y: ty, r: 18, life: QUAKE_LIFE * 0.6, max: QUAKE_LIFE * 0.6 });
      for (let i = 0; i <= 4; i++) {
        const k = i / 4;
        this.hb(p.x + p.fx * len * k, p.y + 6 + p.fy * len * k, i % 2 ? glow : accent, 3, 70, 1);
      }
      this.hb(tx, ty, accentDark, 6, 50, 2);
      this.hb(tx, ty, T.edge, 3, 40, 1);
      heroImpact(this.fx, this.look, tx, ty);
      this.fx.addShake(0.3);
      this.freeze = Math.max(this.freeze, 0.05);
      // yozuv devor yonida ham ekranga sig'adi
      this.fx.text(fitX(p.x + p.fx * 18), Math.max(30, p.y - 22), "SHANG!", accent);
    }
    if (p.judged) {
      p.judged = false;
      this.quakes.push({ x: p.x, y: p.y + 4, r: SKY_RADIUS, life: QUAKE_LIFE, max: QUAKE_LIFE });
      this.hb(p.x, p.y, glow, 24, 120, 2);
      this.hb(p.x, p.y, accent, 14, 80, 2);
      this.fx.addShake(0.45);
      this.freeze = Math.max(this.freeze, 0.06);
      this.fx.text(fitX(p.x, 50), Math.max(30, p.y - 26), "OSMON HUKMI!", accent);
    }
    if (p.vowed) {
      p.vowed = false;
      this.hb(p.x, p.y, accent, 16, 90, 2);
      this.fx.text(p.x, p.y - 22, "QASAM!", accent);
      this.threat.taunt(PLAYER_ID, p.vowT);
      // atrofdagilar Paladinga qarab buriladi (bir kishilik o'yinda ham nishon — Paladin)
      for (const e of this.enemies)
        if (e.active && Math.hypot(e.x - p.x, e.y - p.y) < VOW_RADIUS)
          this.fx.text(e.x, e.y - 14, "!", accent);
    }
    if (p.vowDenied) {
      p.vowDenied = false;
      this.fx.text(p.x, p.y - 16, `QASAM ${Math.ceil(p.vowCooldown)}s`, "#b8a8cc");
    }
    if (p.auraPulse) {
      p.auraPulse = false;
      this.hb(p.x, p.y, glow, 12, 60, 1);
      this.fx.text(p.x, p.y - 18, "+1 YURAK", glow);
    }
    if (p.absorbed) {
      p.absorbed = false;
      if (this.hasArtifact("vowlight") && p.vowing) this.vowLight();
      this.hb(p.x, p.y - 4, glow, 6, 60, 1);
      this.fx.text(p.x, p.y - 18, "BLOK", glow);
    }
    if (p.dashing) {
      // MUQADDAS HAMLA: yo'lidagi dushmanlar 1 zarar bilan itariladi
      const ram = { x: p.x + p.dashX * 4, y: p.y + p.dashY * 4, size: p.size + 8 } as Body;
      const targets: (Enemy | Boss)[] = this.enemies.filter((e) => e.active);
      if (this.boss?.active) targets.push(this.boss);
      for (const t of targets) {
        if (p.rammed.has(t) || !overlap(ram, t)) continue;
        p.rammed.add(t);
        sfx.hit();
        this.fx.addShake(0.1);
        this.hb(t.x, t.y, accent, 6, 70, 1);
        this.strike(t, HAMLA_DMG * p.damage, 300);
      }
    }
  }

  /**
   * Superni ishlatish (v4.0 uchun API joyi). Superlar yopiq (super.ts: SUPERS_ENABLED) — zaryad
   * to'lmaydi va bu yerda hech narsa bo'lmaydi; hech qaysi tugma buni chaqirmaydi.
   */
  useSuper() {
    return this.superMeter.use();
  }

  /** Samurayning o'tkinchi holati (belgilar, kesiklar, chizmalar) — to'lqin va o'yin boshida. */
  private clearSamurai() {
    this.iaiMarks = [];
    this.iaiCuts = null;
    this.cuts = [];
    this.streaks = [];
    this.moons = [];
    this.focus = 0;
    this.reflectBudget = { t: 0, dmg: 0 };
  }

  /**
   * Samuray: IAI sirpanishi yo'lidagilarni belgilash, kechikkan kesiklar ("chiq-chiq"), zaryad
   * to'lgandagi yaltirash va chizmalar taymeri. x0, y0 — shu kadrdagi harakatdan oldingi joy.
   */
  private updateSamurai(dt: number, x0: number, y0: number) {
    const p = this.player;
    const T = this.theme;
    for (const k of this.cuts) k.life -= dt;
    this.cuts = this.cuts.filter((k) => k.life > 0);
    for (const k of this.streaks) k.life -= dt;
    this.streaks = this.streaks.filter((k) => k.life > 0);
    for (const m of this.moons) m.life -= dt;
    this.moons = this.moons.filter((m) => m.life > 0);
    if (this.reflectBudget.t > 0) this.reflectBudget.t -= dt;
    if (p.chargeFull) {
      // zaryad to'ldi: yaltirash va jarang
      p.chargeFull = false;
      sfx.iaiReady();
      this.hb(p.x, p.y - 2, T.glow, 8, 70, 1);
    }
    if (p.iaiStarted) {
      p.iaiStarted = false;
      this.iaiMarks = [];
      this.iaiFrom = { x: x0, y: y0 };
      this.hb(x0, y0 + 2, T.spark, 8, 60, 1);
      this.doneHint("iai");
      this.achieve("firstIai");
    }
    if (p.iai || p.iaiDone) this.sweepIai(x0, y0);
    if (p.iaiDone) {
      const d = p.iaiDone;
      p.iaiDone = null;
      this.streaks.push({
        x1: this.iaiFrom.x,
        y1: this.iaiFrom.y,
        x2: p.x,
        y2: p.y,
        life: STREAK_LIFE,
      });
      // yo'l bo'ylab gulbarglar
      const n = this.fx.isReduced() ? 3 : 7;
      for (let i = 0; i < n; i++) {
        const k = (i + 0.5) / n;
        this.fx.burst(
          this.iaiFrom.x + (p.x - this.iaiFrom.x) * k,
          this.iaiFrom.y + (p.y - this.iaiFrom.y) * k,
          i % 2 ? T.accent : T.glow,
          1,
          40,
          2,
          "leaf",
        );
      }
      this.iaiCuts = {
        t: IAI_DELAY,
        i: 0,
        pass: 0,
        mul: d.mul,
        crit: d.crit,
        targets: this.iaiMarks,
        dir: Math.atan2(p.y - this.iaiFrom.y, p.x - this.iaiFrom.x),
      };
    }
    const c = this.iaiCuts;
    if (c) {
      c.t -= dt;
      // afsonaviy skin: katana qinga qaytgan lahzada ("chik") kesiklar boshlanadi
      if (c.t <= 0 && c.i === 0 && c.pass === 0 && p.flair === "moon") sfx.sheathe();
      while (c.t <= 0 && c.i < c.targets.length) {
        const t = c.targets[c.i++]!;
        c.t += IAI_GAP;
        if (t.dead || (t instanceof Enemy ? t.removed : !t.active)) continue;
        sfx.iaiCut();
        // kesik chizig'i: sirpanish yo'nalishiga qiya; ikkinchi kesim — teskari qiyalikda
        const a = c.dir + (c.pass ? -0.9 : 0.9) + (Math.random() - 0.5) * 0.3;
        this.cuts.push({
          x: t.x,
          y: t.y - 2,
          a,
          len: t.size / 2 + 9,
          life: CUT_LIFE,
          // Qor lotos: kesik — muz chizig'i
          shards: this.look.fx.particle === "shard",
        });
        this.hb(t.x, t.y, T.accent, 5, 80, 1);
        heroImpact(this.fx, this.look, t.x, t.y);
        this.fx.addShake(0.06);
        this.strike(t, p.damage * c.mul, 200, c.crit);
      }
      if (c.i >= c.targets.length && c.t <= 0) {
        // IKKI KESIM: tirik qolganlar yana bir marta kesiladi
        if (p.iaiDouble && c.pass === 0 && c.targets.some((t) => !t.dead)) {
          c.pass = 1;
          c.i = 0;
          c.t = IAI_GAP * 2;
        } else {
          this.iaiCuts = null;
          this.iaiMarks = [];
        }
      }
    }
  }

  /** IAI sirpanishi: (x0, y0) dan hozirgi joygacha yo'lak — tegib o'tganlar belgilanadi. */
  private sweepIai(x0: number, y0: number) {
    const p = this.player;
    const dx = p.x - x0,
      dy = p.y - y0;
    const len = Math.hypot(dx, dy);
    const ux = len ? dx / len : p.dashX,
      uy = len ? dy / len : p.dashY;
    const near = (x: number, y: number, r: number) => {
      const t = Math.max(0, Math.min(len, (x - x0) * ux + (y - y0) * uy));
      return Math.hypot(x - (x0 + ux * t), y - (y0 + uy * t)) < r + IAI_WIDTH / 2;
    };
    const targets: (Enemy | Boss)[] = this.enemies.filter((e) => e.active);
    if (this.boss?.active) targets.push(this.boss);
    for (const t of targets) {
      if (this.iaiMarks.includes(t) || !near(t.x, t.y, t.size / 2)) continue;
      this.iaiMarks.push(t);
      // belgilangan dushman kesilguncha qotib turadi (boss — yo'q)
      if (t instanceof Enemy)
        t.stun = Math.max(t.stun, IAI_DELAY + this.iaiMarks.length * IAI_GAP + 0.1);
      this.hb(t.x, t.y, this.theme.glow, 3, 50, 1);
    }
    // yo'ldagi snaryadlar kesiladi, sandiq va Shohning gullari zarba oladi
    const before = this.shots.length;
    this.shots = this.shots.filter((s) => {
      if (!near(s.x, s.y, s.size / 2)) return true;
      this.fx.burst(s.x, s.y, s.arrow ? "#ff3b3b" : "#ff9a3c", 6, 50);
      return false;
    });
    if (this.shots.length < before) this.score += 5 * (before - this.shots.length);
    const ch = this.chest;
    if (ch && ch.openT < 0 && !p.hitSet.has(ch) && near(ch.x, ch.y, CHEST_SIZE / 2)) {
      p.hitSet.add(ch);
      this.hitChest();
    }
    const part = this.boss?.active ? this.boss.partAt(p) : null;
    if (part && !p.hitSet.has(part)) {
      p.hitSet.add(part);
      this.strikePart(this.boss!, part, p.damage * (p.iai?.mul ?? 1), part.x, part.y);
    }
  }

  /**
   * Samuray: dushman hujumlaridan keyin — mukammal chetlanish (sekin vaqt, gulbarglar, keyingi
   * zarba kritik) va parry (hujumchi gangiydi, "SHIK!").
   */
  private resolveSamurai() {
    const p = this.player;
    const T = this.theme;
    if (p.perfect) {
      p.perfect = false;
      p.critReady = true;
      this.perfectDodges++;
      if (this.perfectDodges >= DODGE_ACH) this.achieve("dodge10");
      this.doneHint("dodge");
      // vaqt sekinlashadi (boss o'limidagi sekin harakat kodi), Samurayning o'zi — yo'q
      this.slowmo = Math.max(this.slowmo, DODGE_SLOW);
      this.focus = DODGE_SLOW;
      sfx.perfectDodge();
      this.fx.text(fitX(p.x, 40), Math.max(30, p.y - 24), "CHETLANDI!", T.accent);
      // sakura gulbarglari sochiladi
      this.fx.burst(p.x, p.y, T.accent, 16, 100, 2, "leaf");
      this.fx.burst(p.x, p.y, T.glow, 10, 70, 2, "leaf");
      // Qizil oy: Samuray ortida qizil yarim oy yonib so'nadi
      if (p.flair === "moon") this.moons.push({ x: p.x, y: p.y - 12, life: MOON_LIFE });
      // GULBARG BO'RONI: atrofga gulbarg zarbasi
      if (p.petalStorm) this.blast(p.x, p.y, PETAL_RADIUS, p.damage, T.accent);
      // SAKURA SHAMOLI (artefakt): Iai darhol tayyor
      if (this.hasArtifact("iaireset") && p.spinCooldown > 0) {
        p.spinCooldown = 0;
        this.fx.text(p.x, p.y - 34, "IAI TAYYOR", artifactById("iaireset").color);
      }
    }
    if (p.parried.length) {
      for (const hit of p.parried) {
        const foe = this.foeAt(hit.x, hit.y);
        this.parryFx((p.x + hit.x) / 2, (p.y + hit.y) / 2 - 2);
        if (foe instanceof Enemy) {
          // yaqin hujumchi qisqa gangiydi va orqaga itariladi
          foe.stun = Math.max(foe.stun, PARRY_STUN);
          const d = Math.hypot(foe.x - p.x, foe.y - p.y) || 1;
          if (!foe.heavy) {
            foe.vx = ((foe.x - p.x) / d) * 160;
            foe.vy = ((foe.y - p.y) / d) * 160;
          }
        } else if (foe) {
          // boss gangimaydi — qisqa sekinlashadi; zarbasi baribir bekor
          foe.slow = Math.max(foe.slow, PARRY_STUN);
          if (foe.parried()) {
            // Oni gandiraklab qoldi: hujum qilish fursati
            this.fx.text(foe.x, foe.y - 44, "GANDIRAKLADI!", "#ffcc33");
            this.fx.burst(foe.x, foe.y - 10, "#ffcc33", 12, 90, 2, "star");
          }
          this.achieve("parryBoss");
        }
      }
      p.parried = [];
    }
  }

  /** Parry: metall uchqun, "SHIK!" yozuvi va ovoz (bir kadrda bir marta). */
  private parryFx(x: number, y: number) {
    const p = this.player;
    const T = this.theme;
    this.fx.burst(x, y, "#ffffff", 7, 110, 1, "star");
    this.fx.burst(x, y, T.glow, 5, 80, 1);
    this.doneHint("parry");
    if (p.parryBoost) p.boost = Math.max(p.boost, PARRY_BOOST);
    if (this.parryNote) return;
    this.parryNote = true;
    sfx.parry();
    this.fx.addShake(0.08);
    this.freeze = Math.max(this.freeze, 0.04);
    this.fx.text(fitX(p.x), Math.max(30, p.y - 22), "SHIK!", T.glow);
  }

  /** Zarba kelgan nuqtadagi hujumchi (dushman yoki boss); muhit zarbasi bo'lsa — null. */
  private foeAt(x: number, y: number): Enemy | Boss | null {
    const e = this.enemies.find((e) => !e.dead && Math.hypot(e.x - x, e.y - y) < 3);
    if (e) return e;
    const b = this.boss;
    return b && !b.dead && Math.hypot(b.x - x, b.y - y) < 3 ? b : null;
  }

  /** Parry snaryadni qaytaradi: egasiga (tirik bo'lsa) qarab, tezroq uchadi. */
  private parryShot(s: Shot) {
    const p = this.player;
    p.parryHit = true;
    p.parryPose = 0.22;
    const sp = Math.hypot(s.vx, s.vy) * REFLECT_SPEED;
    const o = s.owner && !s.owner.dead ? s.owner : null;
    let dx = -s.vx,
      dy = -s.vy;
    if (o) {
      dx = o.x - s.x;
      dy = o.y - s.y;
    }
    const l = Math.hypot(dx, dy) || 1;
    this.bolts.push({
      x: s.x,
      y: s.y,
      vx: (dx / l) * sp,
      vy: (dy / l) * sp,
      size: s.size + 1,
      left: 1,
      hit: [],
      reflect: s.arrow ? "arrow" : s.blue ? "blue" : "fire",
    });
    this.score += 10;
    this.parryFx(s.x, s.y);
    if (o instanceof Boss) this.achieve("parryBoss");
  }

  /**
   * Qaytgan snaryad tegdi: oddiy dushmanga REFLECT_MUL × zarar; bossga — cheklangan (har snaryad
   * PARRY_BOSS_DMG, soniyasiga jami PARRY_BOSS_CAP dan oshmaydi) — boss tez o'lib qolmasin.
   */
  private reflectHit(t: Enemy | Boss) {
    const p = this.player;
    if (!(t instanceof Boss)) return this.strike(t, p.damage * REFLECT_MUL);
    const b = this.reflectBudget;
    if (b.t <= 0) {
      b.t = 1;
      b.dmg = 0;
    }
    const dmg = Math.min(PARRY_BOSS_DMG, PARRY_BOSS_CAP - b.dmg);
    if (dmg <= 0) return;
    b.dmg += dmg;
    this.damageTarget(t, dmg, false);
  }

  /** SHANG zarbasi dushmanni o'ldirdi: bitta zarbada 4 ta — "SHANG!" yutug'i. */
  private slamKill() {
    if (++this.slamKills.kills >= 4) this.achieve("shang4");
  }

  /**
   * Dushman va Boss nishoni. Tutunda yashiringan Mergan ko'rinmaydi: dushmanlar tutun tashlangan joyni
   * nishonga oladi va o'sha joyga uradi — u yerda Mergan yo'q (tegib ketish va o'qlar baribir zarar beradi).
   */
  private aiTarget(): Target {
    const p = this.player;
    const at = this.hideAt;
    // xavf jadvali: nomzod bitta (o'yinchi); QASAM — majburiy nishon, tutun ham yashira olmaydi
    const forced = this.threat.pick([{ id: PLAYER_ID }])?.id === this.threat.forced;
    if (!p.hidden || !at || forced) return p;
    return {
      x: at.x,
      y: at.y,
      size: p.size,
      fx: 0,
      fy: 0,
      chill: 0,
      takeHit: () => false,
      ensnare: () => false,
      encase: () => false,
      evading: true,
    };
  }

  /** Boss qismiga zarba: ko'zgu yutadi (zarar yo'q), gul zarar oladi. */
  private strikePart(b: Boss, part: { x: number; y: number }, dmg: number, x: number, y: number) {
    if (b.strikePart(part as Parameters<Boss["strikePart"]>[0], dmg)) {
      sfx.hit();
      this.fx.burst(x, y, "#e0679a", 6, 60, 1);
      return;
    }
    sfx.block();
    this.fx.burst(x, y, "#dceeff", 8, 70, 1);
    this.fx.text(part.x, part.y - 26, "KO'ZGU!", "#a9cdee");
  }

  /**
   * Malikaning muz poli: o'yinchi harakati darhol emas, asta yangi yo'nalishga o'tadi (sirpanchiq,
   * to'xtash qiyin). Dash/teleport/sakrash/sirpanish va muz qamoq bunga kirmaydi.
   */
  private applySlip(x0: number, y0: number, dt: number) {
    const p = this.player;
    const q = this.boss;
    const on = q instanceof Queen && q.onIce(p.x, p.y + 4) && !p.dashing && !p.dead && dt > 0;
    if (!on) {
      this.slip.on = false;
      return;
    }
    const vx = (p.x - x0) / dt,
      vy = (p.y - y0) / dt;
    if (!this.slip.on) this.slip = { vx, vy, on: true };
    const k = 1 - Math.exp(-ICE_GRIP * dt);
    this.slip.vx += (vx - this.slip.vx) * k;
    this.slip.vy += (vy - this.slip.vy) * k;
    p.x = x0 + this.slip.vx * dt;
    p.y = y0 + this.slip.vy * dt;
    clampToRoom(p);
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

  /** Mergan o'qi dushmanni o'ldirdi: bitta barabandan 6 ta — "Olti o'q" yutug'i. */
  private drumKill(load: number) {
    if (this.drum.load !== load) this.drum = { load, kills: 0 };
    if (++this.drum.kills >= 6) this.achieve("drumKills");
  }

  /** O'q otildi: to'pponcha og'zida uchqun va kulrang porox tutuni. */
  private muzzle(b: Bolt) {
    const T = this.theme;
    this.hb(b.x, b.y, T.glow, 4, 80, 1);
    this.hb(b.x, b.y, T.accent, 2, 50, 1);
    this.hb(b.x, b.y - 2, T.hot, 3, 16, 2);
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
    this.hb(b.x, b.y, this.theme.glow, 6, 70, 1);
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
        if (this.hasArtifact("bigtrap")) this.damageTarget(e, BIG_TRAP_DMG, false);
        t.snapT = 0;
        t.x = e.x;
        t.y = e.y + e.size / 2 - 2;
        sfx.block();
        this.hb(e.x, e.y + 4, this.theme.rim, 8, 60, 1);
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

  /** O'yinchi darajasi: XP qo'shiladi (sovg'asi menyuda olinadi), ekranda "+10 XP" */
  private gainXp(n: number, x: number, y: number) {
    addXp(n);
    this.runXp += n;
    this.fx.text(x, y, `+${n} XP`, "#9fd0ef");
  }

  /** Reyting: 1-dunyo (1-dunyodan boshlangan o'yinning 1-dunyo qismi), cheksiz va kunlik */
  private reportRun(won: boolean) {
    const cb = this.onRunEnd;
    if (!cb) return;
    const base = { hero: this.hero, score: this.score, won };
    if (this.daily)
      return cb({
        ...base,
        mode: "daily",
        wave: Math.min(this.wave + 1, TOTAL_WAVES),
        time: this.stats.time,
        date: this.daily,
      });
    if (this.endless)
      return cb({
        ...base,
        mode: "endless",
        wave: Math.max(1, endlessNumber(this.wave)),
        time: this.stats.time - this.endlessFrom,
        won: false,
        date: null,
      });
    if (this.startWorld === 1 && this.chapter === 1)
      cb({
        ...base,
        mode: "world",
        wave: Math.min(this.wave + 1, TOTAL_WAVES),
        time: this.stats.time,
        date: null,
      });
  }

  /** Profil statistikasi: shu o'yinning hali yozilmagan qismi (run — o'yin tugadi) */
  private flushStats(run: boolean) {
    const s = this.stats;
    const d = this.statsDone;
    addStats({
      time: s.time - d.time,
      kills: s.kills - d.kills,
      waves: s.waves - d.waves,
      bosses: this.runBosses,
      runs: run ? 1 : 0,
    });
    this.statsDone = { ...s };
    this.runBosses = 0;
  }

  private clearWave() {
    this.stats.waves++;
    this.gainXp(XP.wave, ROOM.w / 2, 72);
    // birinchi to'lqin o'tildi — ko'rsatmalar keyingi o'yinlarda chiqmaydi
    if (this.hints.length && !this.endless) {
      save(this.hintKey(), 1);
      this.hints = [];
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
    if (this.chapter === 4) return isBossWave(this.wave) ? FLOOR_SAKURA_BOSS : FLOOR_SAKURA;
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
              : index === FLOOR_SAKURA
                ? SAKURA_FLOOR
                : index === FLOOR_SAKURA_BOSS
                  ? SAKURA_BOSS_FLOOR
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
        if (t.sakura) {
          sakuraTile(c, x, y, r, rnd2, index === FLOOR_SAKURA_BOSS);
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
    if (t.sakura) sakuraDecor(c, index === FLOOR_SAKURA_BOSS);
    // devorlar
    px(c, t.wall, 0, 0, ROOM.w, ROOM.wall);
    px(c, t.wallDark, 0, ROOM.h - ROOM.wall, ROOM.w, ROOM.wall);
    px(c, t.wallDark, 0, 0, ROOM.wall, ROOM.h);
    px(c, t.wallDark, ROOM.w - ROOM.wall, 0, ROOM.wall, ROOM.h);
    if (t.forest) this.forestWalls(c, rnd2);
    else if (t.sakura) sakuraWalls(c, index === FLOOR_SAKURA_BOSS, rnd2);
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
    else if (!t.forest && !t.sakura)
      for (const tx of [64, 160, 256]) px(c, "#2a1f38", tx - 2, 8, 4, 6);
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
    if (this.chapter === 4) {
      // mash'alalar o'rniga tosh fonuslar, hovuz yaltirashi va kechki shafaq
      renderSakuraLights(c, this.time, fi === FLOOR_SAKURA_BOSS);
      return;
    }
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
    const T = this.theme;
    // kuchli zarba yig'ilishi: o'yinchi atrofida to'lib boruvchi halqa
    if (p.charge > 0.12) {
      const k = Math.min(1, p.charge / p.chargeTime);
      const full = k >= 1;
      c.strokeStyle = chargeRingColor(T, full, this.time);
      c.lineWidth = full ? 2 : 1;
      c.beginPath();
      c.arc(p.x, p.y, 13, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k);
      c.stroke();
    }
    // Ovchining kuchli o'qi va Merganning yelpig'ich o'qlari uchib ketadi — atrofda halqa yo'q
    if (p.spinning && (p.hunter || p.gunner)) return;
    // Paladin: OSMON HUKMI to'lqini va SHANG yo'lagi alohida chiziladi (paladinFx)
    if (p.paladin) return;
    // Samuray: ingichka katana yoyi (kombo bo'yicha yo'nalishi almashadi, 3-zarba keng)
    if (p.samurai) return renderKatanaArc(c, p, T);
    if (p.spinning && p.mage) {
      // sehrli halqa: kengayib boruvchi qizil-qora to'lqin
      const k = p.spinTimer / SPIN_TIME;
      const r = p.reach * 1.2 * (1.15 - k * 0.5);
      c.strokeStyle = withAlpha(T.ink, 0.3 + 0.5 * k);
      c.lineWidth = 4;
      c.beginPath();
      c.arc(p.x, p.y, r + 1, 0, Math.PI * 2);
      c.stroke();
      c.strokeStyle = withAlpha(T.edge, 0.4 + 0.6 * k);
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
      c.strokeStyle = withAlpha(T.inner, 0.2 + 0.4 * k);
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
      c.strokeStyle = withAlpha(T.edge, 0.85 * k);
      c.lineWidth = 2;
      c.beginPath();
      c.arc(p.x, p.y, r, a0, a0 + Math.PI * 1.6);
      c.stroke();
      c.strokeStyle = withAlpha(T.inner, 0.6 * k);
      c.lineWidth = 1;
      c.beginPath();
      c.arc(p.x, p.y, r * 0.75, 0, Math.PI * 2);
      c.stroke();
      return;
    }
    if (p.attackTimer <= 0 || p.ranged) return;
    const k = p.attackTimer / 0.24;
    const ang = Math.atan2(p.fy, p.fx);
    c.strokeStyle = withAlpha(T.edge, 0.75 * k);
    c.lineWidth = 2;
    c.beginPath();
    c.arc(p.x, p.y, p.reach * 0.95, ang - 1.1 + (1 - k) * 0.6, ang + 1.1 - (1 - k) * 0.2);
    c.stroke();
    c.strokeStyle = withAlpha(T.inner, 0.5 * k);
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
    if (this.intro > 0 && this.boss) {
      // kirish: kamera bossga yaqinlashadi, oxirida qaytadi (faqat chizishda — xona o'zgarmaydi)
      const t = INTRO_TIME - this.intro;
      const k = Math.min(1, t / 0.5, this.intro / 0.4);
      const z = 1 + 0.7 * k * k * (3 - 2 * k);
      const bx = this.boss.x,
        by = this.boss.y;
      const cx = ROOM.w / 2 + (bx - ROOM.w / 2) * k,
        cy = ROOM.h / 2 + (by - ROOM.h / 2) * k;
      c.translate(ROOM.w / 2, ROOM.h / 2);
      c.scale(z, z);
      c.translate(-cx, -cy);
    }
    this.renderRoom(c);
    // muhit qatlami (ambience.ts): mash'ala nuri, tebranuvchi o't, muz yaltirashi — faqat ko'rinish
    renderGroundAmbience(c, this.chapter, this.time, isBossWave(this.wave), this.fx.isReduced());
    this.renderPhaseTint(c);

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

    // bosslarning poldagi ogohlantirishlari: olov izi, muz, nur, nayzalar, ildizlar, gullar, tikanlar
    this.boss?.renderFloor(c, this.time);
    // yerdagi to'rlar, ildiz yoriqlari va boyo'g'li soyalari
    for (const w of this.webs) if (!w.flying) this.renderWeb(c, w);
    for (const t of this.traps) if (t.snapT < 0) this.renderTrap(c, t);
    for (const e of this.enemies) e.renderFloor(c);
    // Paladin: yerdagi yoriqlar, zarb to'lqinlari va QASAM aurasi
    for (const k of this.cracks) renderCrack(c, k, this.theme);
    for (const q of this.quakes) renderQuake(c, q, this.theme);
    // Samuray: IAI sirpanish izi (yerda) va qizil oy silueti (o'yinchi ortida)
    for (const k of this.streaks) renderStreak(c, k, this.theme);
    for (const m of this.moons) renderMoonFlash(c, m, this.theme, this.fx.isReduced());
    // OLOV IZI: yerdagi kichik alangalar
    for (const f of this.flames) {
      const fl = Math.floor(this.time * 12 + f.x) % 2;
      const a = Math.min(1, f.life * 2);
      c.globalAlpha = a;
      px(c, "#c1121f", Math.round(f.x) - 2, Math.round(f.y) - 1, 5, 2);
      px(c, "#ff8a2a", Math.round(f.x) - 1, Math.round(f.y) - 3 - fl, 3, 3);
      px(c, "#ffe14d", Math.round(f.x), Math.round(f.y) - 3 - fl, 1, 2);
      c.globalAlpha = 1;
    }
    // CHAQMOQ ZANJIRI: siniq chiziq
    for (const z of this.zaps) {
      c.save();
      c.globalAlpha = Math.min(1, z.life * 8);
      c.strokeStyle = "#ffe14d";
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(z.x1, z.y1);
      const mx = (z.x1 + z.x2) / 2 + (Math.random() - 0.5) * 10,
        my = (z.y1 + z.y2) / 2 + (Math.random() - 0.5) * 10;
      c.lineTo(mx, my);
      c.lineTo(z.x2, z.y2);
      c.stroke();
      c.restore();
    }
    for (const r of this.rings) {
      const k = 1 - r.life / r.max;
      const rad = r.r * (0.4 + 0.6 * k);
      c.save();
      c.strokeStyle = withAlpha(r.color, 0.9 * (1 - k));
      c.lineWidth = 2;
      c.beginPath();
      c.ellipse(r.x, r.y, rad, rad * 0.7, 0, 0, Math.PI * 2);
      c.stroke();
      c.restore();
    }
    if (this.player.paladin && this.player.vowing && !this.player.dead)
      renderVowAura(c, this.player, this.time, this.theme);

    // chuqurlik bo'yicha tartib
    const p = this.player;
    const all: { y: number; r: () => void }[] = this.enemies.map((e) => ({
      y: e.y,
      r: () => {
        if (!e.dead)
          this.shadow(
            c,
            e.x,
            e.y +
              (e.kind === "wisp" || e.kind === "frost" || e.kind === "imp" ? 11 : e.size / 2 + 1),
            // baland uchayotgan boyo'g'lining soyasi kichikroq
            e.kind === "owl"
              ? e.size * (1 - (e.alt / OWL_ALT) * 0.45)
              : e.kind === "tengu"
                ? e.size * (1 - (e.alt / TENGU_ALT) * 0.45)
                : e.size,
          );
        e.render(c);
        // Merganda sekinlashish faqat tutundan — muz uchqunlari chizilmaydi
        if (e.slow > 0 && !e.dead && !p.gunner && !p.paladin) this.frost(c, e.x, e.y, e.size);
        // Paladin OSMON HUKMIdan gangigan: boshi uzra oq-oltin yulduzchalar
        if (p.paladin && (e.stun > 0 || e.slow > 0) && !e.dead)
          renderDazeStars(c, e.x, e.y - e.size / 2 - 7, this.time, this.theme);
        // Samuray parry bilan gangitgan (belgilangani emas — unda kesik belgisi bor)
        if (p.samurai && e.stun > 0 && !e.dead && !this.iaiMarks.includes(e))
          renderDazeStars(c, e.x, e.y - e.size / 2 - 7, this.time, this.theme);
      },
    }));
    const boss = this.boss;
    if (boss)
      all.push({
        y: boss.y,
        r: () => {
          if (!boss.dead) this.shadow(c, boss.x, boss.y + 24, 30);
          // ko'zgular bor paytda haqiqiy Malikaning soyasi och muz polda ham aniq ko'rinsin
          if (boss instanceof Queen && boss.mirrors.length) this.shadow(c, boss.x, boss.y + 24, 34);
          const lively = !this.fx.isReduced();
          if (this.intro > 0 && lively) {
            // kirish sahnasi: xona qorayadi, boss (va undan keyin chiziladiganlar) yoritilgan qoladi
            const t = INTRO_TIME - this.intro;
            const a = Math.min(1, t / 0.4, this.intro / 0.4);
            px(c, `rgba(0,0,0,${0.5 * a})`, -8, -8, ROOM.w + 16, ROOM.h + 16);
          }
          // faza almashganda qisqa "o'zgarish" pulsi (faqat ko'rinish)
          const [bx, by] = lively ? phasePulse(boss.guard, PHASE_GUARD) : [1, 1];
          const pulse = bx !== 1 && !boss.dead;
          if (pulse) {
            const foot = boss.y + 24;
            c.save();
            c.translate(boss.x, foot);
            c.scale(bx, by);
            c.translate(-boss.x, -foot);
          }
          boss.render(c);
          if (pulse) c.restore();
          // Paladin: Boss OSMON HUKMIdan sekinlashdi — muz emas, gangish yulduzchalari
          if (boss.slow > 0 && !boss.dead && p.paladin)
            renderDazeStars(c, boss.x, boss.y - boss.size / 2 - 6, this.time, this.theme);
          else if (boss.slow > 0 && !boss.dead && !p.gunner)
            this.frost(c, boss.x, boss.y, boss.size);
        },
      });
    // ko'zgu nusxalari: soyasi yo'q — haqiqiy Malikani shundan ajratish mumkin
    if (boss instanceof Queen)
      for (const m of boss.mirrors) all.push({ y: m.y, r: () => boss.renderMirror(c, m) });
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
          // afsonaviy skin: turgandagi harakat va hujum flourishi
          renderFlair(c, this.look, p, this.time, this.fx.isReduced());
          // sovuq nafasdan sekinlashgan
          if (p.chill > 0 && !p.dead) this.frost(c, p.x, p.y, p.size);
          if (p.encased) this.renderIceBlock(c);
        },
      });
    all.sort((a, b) => a.y - b.y).forEach((o) => o.r());

    this.renderSlash(c);
    if (this.player.samurai) {
      // belgilangan (hali kesilmagan) dushmanlar, kesik chiziqlari va "kritik tayyor" uchqunlari
      for (const t of this.iaiMarks)
        if (!t.dead) renderMark(c, t.x, t.y - t.size / 2 - 6, this.time, this.theme);
      for (const k of this.cuts) renderCut(c, k, this.theme);
      if (this.player.critReady && !this.player.dead)
        renderCritReady(c, this.player, this.time, this.theme);
    }
    if (this.player.paladin && !this.player.dead) {
      renderSkyColumn(c, this.player, this.time, 0, this.theme);
      renderWindupSparks(c, this.player, this.time, this.theme);
    }
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
      // kitsune olovi — ko'k, qolganlari — to'q sariq
      c.fillStyle = s.blue ? "rgba(60,140,230,0.4)" : "rgba(255,120,40,0.35)";
      c.beginPath();
      c.arc(s.x, s.y, 5, 0, Math.PI * 2);
      c.fill();
      px(c, s.blue ? "#3c8ce6" : "#ff6a2a", s.x - 2, s.y - 2, 4, 4);
      px(c, s.blue ? "#d8f0ff" : "#ffe14d", s.x - 1, s.y - 1, 2, 2);
    }
    const T = this.theme;
    for (const b of this.bolts) {
      if (b.arrow) {
        this.renderArrow(c, b);
        continue;
      }
      if (b.bullet) {
        this.renderBullet(c, b);
        continue;
      }
      if (b.wave) {
        renderShockwave(c, b, this.theme);
        continue;
      }
      if (b.reflect) {
        this.renderReflect(c, b);
        continue;
      }
      // sehrli shar: och qizil/to'q sariq chekka, to'q qizil yadro (skin ranglarida)
      c.fillStyle = withAlpha(T.rim, 0.4);
      c.beginPath();
      c.arc(b.x, b.y, b.size - 1, 0, Math.PI * 2);
      c.fill();
      const h = Math.round(b.size / 3);
      px(c, T.hot, b.x - h - 1, b.y - h, h * 2 + 2, h * 2);
      px(c, T.hot, b.x - h, b.y - h - 1, h * 2, h * 2 + 2);
      px(c, T.core, b.x - h, b.y - h, h * 2, h * 2);
      px(c, T.glint, b.x - h, b.y - h, 1, 1);
    }
    for (const w of this.webs) if (w.flying) this.renderWeb(c, w);
    for (const cl of this.clouds) this.renderCloud(c, cl);
    for (const sm of this.smokes) this.renderSmoke(c, sm);
    this.fx.renderParticles(c);
    for (const sp of this.cfx.sparks) renderSpark(c, sp, this.fx.isReduced());
    if (this.darkness > 0) {
      // O'rmon Shohi g'azabi: faqat o'yinchi atrofi yorug'
      const g = c.createRadialGradient(p.x, p.y, KING_LIGHT * 0.4, p.x, p.y, KING_LIGHT);
      g.addColorStop(0, "rgba(2,6,3,0)");
      g.addColorStop(1, `rgba(2,6,3,${0.88 * this.darkness})`);
      c.fillStyle = g;
      c.fillRect(0, 0, ROOM.w, ROOM.h);
      if (boss instanceof ForestKing) {
        boss.renderSwarm(c, this.time);
        boss.renderEyes(c);
      }
    }
    if (this.chapter === 3) this.renderFireflies(c);
    // havodagi muhit zarralari: cho'g', barg, chang (soni qat'iy, effektlar kamaytirilganda — kamroq)
    renderAirAmbience(c, this.chapter, this.time, isBossWave(this.wave), this.fx.isReduced());
    // Sakura bog'i: doimiy tushayotgan gulbarglar (effektlar kamaytirilganda — kamroq)
    if (this.chapter === 4) renderPetals(c, this.time, this.petalCount());
    this.fx.renderSnow(c);
    this.fx.renderTexts((s, x, y, color, a) => {
      c.globalAlpha = a;
      this.text(s, x, y, 6, color);
      c.globalAlpha = 1;
    });
    this.fx.renderDamages((s, x, y, size, color, a) => {
      c.globalAlpha = a;
      this.text(s, Math.round(x), Math.round(y), size, color);
      c.globalAlpha = 1;
    });

    // tanga yomg'iri (boss o'lganda)
    for (const r of this.coinRain)
      this.coin(c, r.x - 3, r.y - 3, Math.floor(this.time * 8 + r.x) % 4);
    // mukammal chetlanish: sekin vaqt — chetlarda pushti nur
    if (this.focus > 0) renderFocus(c, Math.min(1, this.focus / 0.2), this.theme);
    // vinyetka
    const v = c.createRadialGradient(ROOM.w / 2, ROOM.h / 2, 90, ROOM.w / 2, ROOM.h / 2, 210);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(0,0,0,0.45)");
    c.fillStyle = v;
    c.fillRect(0, 0, ROOM.w, ROOM.h);
    if (this.phaseFlash > 0) {
      c.fillStyle = `rgba(255,255,255,${this.phaseFlash * 0.9})`;
      c.fillRect(0, 0, ROOM.w, ROOM.h);
    }
    // past HP — qizil chekka
    if (p.hp === 1 && !p.dead) {
      c.fillStyle = `rgba(200,0,30,${0.12 + 0.08 * Math.sin(this.time * 6)})`;
      c.fillRect(0, 0, ROOM.w, ROOM.h);
    }
    c.restore();

    if (this.intro > 0) this.renderIntro();
    else {
      this.renderHud();
      this.renderFlyers();
    }
    this.renderPicked();
    this.renderOverlays();
    this.renderToast();
    c.restore();
  }

  /** Sahna o'zgarishi: boss fazasi oshgani sari xona rangi quyuqlashadi. */
  private renderPhaseTint(c: CanvasRenderingContext2D) {
    const b = this.boss;
    if (!b || b.dead || b.phase < 2) return;
    const kind = this.bossKind(b);
    const a = b.phase === 2 ? 0.12 : 0.22;
    const pulse = 0.04 * Math.sin(this.time * 3);
    c.fillStyle =
      kind === "devil"
        ? `rgba(200,40,10,${a + pulse})`
        : kind === "queen"
          ? `rgba(60,140,255,${a + pulse})`
          : kind === "oni"
            ? `rgba(190,30,40,${a + pulse})`
            : `rgba(10,40,5,${a + pulse})`;
    c.fillRect(0, 0, ROOM.w, ROOM.h);
  }

  /** Muz qamoq: o'yinchi atrofida muz bo'lagi, yorilish darajasi — qolgan bosishlar. */
  private renderIceBlock(c: CanvasRenderingContext2D) {
    const p = this.player;
    const x = Math.round(p.x - 10),
      y = Math.round(p.y - 13);
    c.fillStyle = "rgba(169,205,238,0.55)";
    c.fillRect(x, y, 20, 24);
    c.strokeStyle = "#eef7ff";
    c.lineWidth = 1;
    c.strokeRect(x + 0.5, y + 0.5, 19, 23);
    c.fillStyle = "#ffffff";
    c.fillRect(x + 3, y + 3, 2, 6);
    // yoriqlar: har bosish bittadan
    c.strokeStyle = "#4a6fa5";
    c.beginPath();
    const cracks = 6 - Math.min(6, p.ice);
    for (let i = 0; i < cracks; i++) {
      const sx = x + 4 + ((i * 7) % 13),
        sy = y + 4 + ((i * 11) % 17);
      c.moveTo(sx, sy);
      c.lineTo(sx + (i % 2 ? 4 : -3), sy + 5);
    }
    c.stroke();
    if (Math.floor(this.time * 6) % 2)
      this.text(this.touch ? "TEZ BOS!" : "HUJUM / DASH!", p.x, y - 4, 5, "#7fe9ff");
  }

  /** Boss kirishi: katta nom kartochkasi (ismi va laqabi). */
  private renderIntro() {
    const b = this.boss;
    if (this.intro <= 0 || !b) return;
    const c = this.ctx;
    const card = BOSS_CARDS[this.bossKind(b)];
    const t = INTRO_TIME - this.intro;
    const a = Math.min(1, t / 0.3, this.intro / 0.3);
    const slide = Math.round((1 - Math.min(1, t / 0.35)) * 60);
    c.globalAlpha = a;
    px(c, "rgba(0,0,0,0.85)", 0, 0, ROOM.w, 26);
    px(c, "rgba(0,0,0,0.85)", 0, ROOM.h - 26, ROOM.w, 26);
    px(c, "rgba(8,4,16,0.8)", 0, 150, ROOM.w, 46);
    px(c, card.color, 0, 150, ROOM.w, 1);
    px(c, card.color, 0, 195, ROOM.w, 1);
    // katta nom chapdan o'ngga "yoziladi", ostidagi chiziq markazdan o'sadi
    const w = card.name.length * 16;
    const k = this.fx.isReduced() ? 1 : Math.min(1, t / 0.55);
    c.save();
    c.beginPath();
    c.rect(ROOM.w / 2 - slide - w / 2 - 4, 154, (w + 8) * k, 26);
    c.clip();
    this.text(card.name, ROOM.w / 2 - slide, 176, 16, card.color);
    c.restore();
    px(c, card.color, Math.round(ROOM.w / 2 - (w / 2) * k), 180, Math.round(w * k), 1);
    this.text(card.nick, ROOM.w / 2 + slide, 189, 6, "#e0d6ee");
    if (Math.floor(this.time * 3) % 2)
      this.text(
        this.touch ? "o'tkazish: ekranga bosing" : "o'tkazish: istalgan tugma",
        ROOM.w / 2,
        ROOM.h - 10,
        5,
        "#b8a8cc",
      );
    c.globalAlpha = 1;
  }

  /** Ovchi o'qi: jigarrang dasta, temir uch, yashil pat; kuchli o'q kattaroq va yashil nurli. */
  private renderArrow(c: CanvasRenderingContext2D, b: Bolt) {
    const l = Math.hypot(b.vx, b.vy) || 1;
    const ux = b.vx / l,
      uy = b.vy / l;
    const strong = (b.power ?? 1) > 1;
    const len = strong ? 9 : 6;
    const T = this.theme;
    if (strong) {
      c.fillStyle = withAlpha(T.accent, 0.35);
      c.beginPath();
      c.arc(b.x, b.y, 5, 0, Math.PI * 2);
      c.fill();
    }
    for (let k = -len; k <= 1; k++)
      px(c, strong ? T.spark : T.core, b.x + ux * k, b.y + uy * k, 1, 1);
    px(c, T.glint, b.x + ux * 2 - 0.5, b.y + uy * 2 - 0.5, 2, 2);
    if (b.poison) px(c, "#a6f08e", b.x + ux * 2, b.y + uy * 2, 1, 1);
    const fx = b.x - ux * len,
      fy = b.y - uy * len;
    px(c, T.accentDark, fx - uy, fy + ux, 1, 1);
    px(c, T.accentDark, fx + uy, fy - ux, 1, 1);
    px(c, T.edge, fx - uy - ux, fy + ux - uy, 1, 1);
    px(c, T.edge, fx + uy - ux, fy - ux - uy, 1, 1);
  }

  /** Parry bilan qaytarilgan snaryad: asl shakli (o'q yoki olov shari), lekin Samuray rangida. */
  private renderReflect(c: CanvasRenderingContext2D, b: Bolt) {
    const T = this.theme;
    const l = Math.hypot(b.vx, b.vy) || 1;
    const ux = b.vx / l,
      uy = b.vy / l;
    if (b.reflect === "arrow") {
      for (let k = -4; k <= 1; k++) px(c, T.ink, b.x + ux * k, b.y + uy * k, 1, 1);
      px(c, T.glow, b.x + ux * 2 - 0.5, b.y + uy * 2 - 0.5, 2, 2);
      px(c, T.accent, b.x - ux * 5 - uy, b.y - uy * 5 + ux, 1, 1);
      px(c, T.accent, b.x - ux * 5 + uy, b.y - uy * 5 - ux, 1, 1);
      return;
    }
    c.fillStyle = withAlpha(T.accent, 0.35);
    c.beginPath();
    c.arc(b.x, b.y, 5, 0, Math.PI * 2);
    c.fill();
    px(c, b.reflect === "blue" ? "#7fd8ff" : T.accent, b.x - 2, b.y - 2, 4, 4);
    px(c, T.edge, b.x - 1, b.y - 1, 2, 2);
  }

  /** Mergan o'qi: yaltiroq mis o'q va orqasida qisqa iz. */
  private renderBullet(c: CanvasRenderingContext2D, b: Bolt) {
    const l = Math.hypot(b.vx, b.vy) || 1;
    const ux = b.vx / l,
      uy = b.vy / l;
    const T = this.theme;
    for (let k = 2; k <= 5; k++)
      px(c, k < 4 ? T.accent : T.accentDark, b.x - ux * k - 0.5, b.y - uy * k - 0.5, 1, 1);
    px(c, T.ink, b.x - 1.5, b.y - 1.5, 3, 3);
    px(c, T.glow, b.x - 1, b.y - 1, 2, 2);
  }

  /** Tutun bombasi: sekin aylanuvchi quyuq kulrang tutun, chetlari so'nib boradi. */
  private renderSmoke(c: CanvasRenderingContext2D, sm: Smoke) {
    const a = Math.min(1, sm.life * 1.5, (SMOKE_LIFE - sm.life) * 6);
    const T = this.theme;
    for (let k = 0; k < 8; k++) {
      const ang = this.time * 0.6 + k * 0.8;
      const r = k === 0 ? 0 : SMOKE_RADIUS * 0.5;
      c.fillStyle = withAlpha(k % 2 ? T.inner : T.rim, 0.34 * a);
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
      px(c, T.edge, sm.x + Math.cos(ang) * (6 + k * 4), sm.y - 6 + Math.sin(ang * 1.2) * 9, 2, 1);
    }
  }

  /** Ovchi tuzog'i: ochiq — tishli temir jag'lar, yopilgan — dushman oyog'ida. */
  private renderTrap(c: CanvasRenderingContext2D, t: Trap) {
    const x = Math.round(t.x),
      y = Math.round(t.y);
    const T = this.theme;
    if (t.snapT >= 0) {
      const a = Math.min(1, (TRAP_STUN - t.snapT) * 3);
      c.globalAlpha = a;
      px(c, T.ink, x - 6, y - 2, 13, 5);
      px(c, T.rim, x - 5, y - 1, 11, 3);
      for (let k = -4; k <= 4; k += 2) px(c, T.mist, x + k, y - 2, 1, 1);
      c.globalAlpha = 1;
      return;
    }
    if (t.life < 2 && Math.floor(t.life * 8) % 2) return;
    // halqa va zanjir
    px(c, T.ink, x - 7, y - 4, 15, 9);
    px(c, T.shade, x - 6, y - 3, 13, 7);
    px(c, T.rim, x - 6, y - 3, 13, 1);
    px(c, T.rim, x - 6, y + 3, 13, 1);
    px(c, T.rim, x - 6, y - 3, 1, 7);
    px(c, T.rim, x + 6, y - 3, 1, 7);
    for (let k = -4; k <= 4; k += 2) {
      px(c, T.mist, x + k, y - 2, 1, 2);
      px(c, T.mist, x + k, y + 1, 1, 2);
    }
    px(c, T.spark, x - 1, y - 1, 3, 3);
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

  /** Sakura bog'idagi gulbarglar soni ("Effektlarni kamaytirish" bilan kamayadi). */
  petalCount() {
    return this.fx.isReduced() ? PETALS_REDUCED : PETALS;
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
    // ochilganda qisqa "sakrash" va tepaga yoyiluvchi oltin nurlar (combatFx.ts) — faqat ko'rinish
    const lively = !this.fx.isReduced();
    const [sx, sy] = lively ? chestPop(ch.openT) : [1, 1];
    c.save();
    if (sx !== 1 || sy !== 1) {
      c.translate(ch.x, ch.y + 7);
      c.scale(sx, sy);
      c.translate(-ch.x, -(ch.y + 7));
    }
    this.drawChest(c, ch);
    c.restore();
    if (lively) renderChestRays(c, ch.x, ch.y - 2, ch.openT);
  }

  private drawChest(c: CanvasRenderingContext2D, ch: Chest) {
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

  /** Tanlangan karta sharpasi: oq chaqnab, o'z rangida porlab yuqoriga uchadi va so'nadi. */
  private renderPicked() {
    const k = this.hud.picked;
    if (!k) return;
    const c = this.ctx;
    const q = k.t / PICK_TIME;
    const y = k.y - Math.round(q * q * PICK_RISE);
    // yengil: tez so'nadi, jang ko'rinishini to'smaydi
    c.globalAlpha = (1 - q) * 0.6;
    px(c, q < 0.25 ? "#ffffff" : k.color, k.x, y, k.w, k.h);
    c.globalAlpha = (1 - q) * 0.3;
    px(c, "#ffffff", k.x + 2, y + 2, k.w - 4, k.h - 4);
    c.globalAlpha = 1 - q;
    this.text(k.name, k.x + k.w / 2, y + k.h / 2, 6, "#1f1730");
    c.globalAlpha = 1;
  }

  /** Terilgan tanga va yuraklar HUD'dagi joyiga uchib boradi (combatFx.ts) — faqat ko'rinish. */
  private renderFlyers() {
    const c = this.ctx;
    for (const f of this.cfx.flyers) {
      const { x, y } = flyerPos(f);
      if (f.kind === "coin")
        this.coin(c, Math.round(x) - 3, Math.round(y) - 3, Math.floor(f.t * 14) % 4);
      else this.heart(c, Math.round(x) - 4, Math.round(y) - 3, "#ff4d6d");
    }
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
    // yuraklar: zarba yeganda titraydi, yangi terilgani bir lahza sakraydi (hudFx.ts)
    const lively = !this.fx.isReduced();
    const hpop = lively ? Math.round(HudFx.pop(this.hud.heartPop) * 2) : 0;
    for (let i = 0; i < p.maxHp; i++) {
      const on = i < p.hp;
      const [ox, oy] = lively ? this.hud.heartOffset(i, this.time) : [0, 0];
      const up = on && i === p.hp - 1 ? hpop : 0;
      this.heart(c, 4 + i * 10 + ox, 4 + oy - up, on ? (up ? "#ff8fa3" : "#ff4d6d") : "#3b2a3a");
      if (on) px(c, "#ffb3c1", 5 + i * 10 + ox, 5 + oy - up, 1, 1);
    }
    // yo'qolgan yurak ikkiga bo'linib, pastga tushib so'nadi
    if (lively)
      for (const b of this.hud.broken) {
        const k = b.t / HEART_BREAK;
        const x = 4 + b.index * 10,
          dx = Math.round(k * 5),
          dy = Math.round(k * k * 12);
        c.globalAlpha = 1 - k;
        const col = b.t < 0.06 ? "#ffffff" : "#ff4d6d";
        // chap yarmi
        px(c, col, x + 1 - dx, 4 + dy, 2, 1);
        px(c, col, x - dx, 5 + dy, 4, 3);
        px(c, col, x + 1 - dx, 8 + dy, 3, 1);
        px(c, col, x + 2 - dx, 9 + dy, 2, 1);
        px(c, col, x + 3 - dx, 10 + dy, 1, 1);
        // o'ng yarmi
        px(c, col, x + 5 + dx, 4 + dy, 2, 1);
        px(c, col, x + 4 + dx, 5 + dy, 4, 3);
        px(c, col, x + 4 + dx, 8 + dy, 3, 1);
        px(c, col, x + 4 + dx, 9 + dy, 2, 1);
        px(c, col, x + 4 + dx, 10 + dy, 1, 1);
        c.globalAlpha = 1;
      }
    // dash tayyorligi
    const k = Math.max(0, Math.min(1, 1 - p.dashCooldown / p.dashCd));
    px(c, "#000", 4, 13, 32, 3);
    // dash va kuchli zarba chiziqlari qahramon (skin) rangida (skinFx.ts: SkinTheme)
    const { on, off, empty } = hudBarColors(this.theme);
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
      const T = this.theme;
      px(c, tk >= 1 ? T.spark : T.shade, 5, 22, 30 * tk, 1);
      if (tk >= 1) {
        px(c, T.rim, 38, 20, 5, 1);
        px(c, T.rim, 38, 23, 5, 1);
        px(c, T.mist, 39, 21, 1, 2);
        px(c, T.mist, 41, 21, 1, 2);
      }
    }
    if (p.gunner) this.renderGunHud(p);
    if (p.samurai) {
      // mukammal chetlanish tayyorligi (sovish 1.5 s); kritik tayyor bo'lsa — miltillovchi yulduzcha
      const t = this.theme;
      const dk = Math.max(0, Math.min(1, 1 - p.perfectCooldown / DODGE_CD));
      px(c, "#000", 4, 21, 32, 3);
      px(c, dk >= 1 ? t.glow : t.accentDark, 5, 22, 30 * dk, 1);
      if (p.critReady) {
        const on = Math.floor(this.time * 8) % 2 === 0;
        px(c, on ? CRIT_COLOR : t.glow, 38, 22, 5, 1);
        px(c, on ? CRIT_COLOR : t.glow, 40, 20, 1, 5);
      }
    }
    if (p.paladin) {
      // QASAM: faol bo'lsa — qolgan vaqt (yorqin), aks holda qayta tiklanish
      const t = this.theme;
      const vk = p.vowing
        ? p.vowT / VOW_TIME
        : Math.max(0, Math.min(1, 1 - p.vowCooldown / p.vowCd));
      px(c, "#000", 4, 21, 32, 3);
      px(c, p.vowing ? t.glow : vk >= 1 ? t.accent : t.accentDark, 5, 22, 30 * vk, 1);
      if (vk >= 1 || p.vowing) {
        // kichik quyosh belgisi
        px(c, t.accent, 39, 20, 3, 3);
        px(c, t.glow, 40, 19, 1, 5);
        px(c, t.glow, 38, 21, 5, 1);
      }
    }

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
    // faol sinergiyalar: o'ng yuqorida kichik teg belgilari
    synergies(this.tagCounts).forEach((t, i) => {
      const x = ROOM.w - 11 - i * 9;
      px(c, "#000", x - 1, 25, 9, 9);
      this.tagIcon(t, x, 26);
    });
    // qalqon (HIMOYA sinergiyasi / artefakt): yuraklar yonida
    if (p.ward > 0) {
      const x = 4 + p.maxHp * 10 + 1;
      this.tagIcon("himoya", x, 4);
    }
    // artefaktlar: chap tomonda, chiziqlar ostida kichik ikonkalar (sensor tugmalaridan uzoqda)
    this.artifacts.forEach((id, i) => {
      const r = this.artRect(i);
      const sel = this.artInfo?.id === id;
      px(c, sel ? artifactById(id).color : "#000", r.x - 1, r.y - 1, r.w + 2, r.h + 2);
      px(c, "#1a1222", r.x, r.y, r.w, r.h);
      this.artIcon(id, r.x, r.y);
    });
    if (this.artInfo && this.phase === "play" && this.stage === "fight") {
      const a = artifactById(this.artInfo.id);
      const rows = Math.ceil(this.artifacts.length / ART_PER_ROW);
      const y = 40 + rows * 11 + 1;
      const lines = this.wrap(a.desc, 26);
      c.globalAlpha = Math.min(1, this.artInfo.timer * 3);
      px(c, a.color, 3, y, 140, 12 + lines.length * 8);
      px(c, "#1a1222", 4, y + 1, 138, 10 + lines.length * 8);
      this.text(a.name, 7, y + 8, 5, a.color, "left");
      lines.forEach((l, j) => this.text(l, 7, y + 17 + j * 8, 5, "#e0d6ee", "left"));
      c.globalAlpha = 1;
    }
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
      // hisob "aylanib" sanaladi, tanga yetib kelganda bir lahza sakraydi (hudFx.ts)
      const roll = !this.fx.isReduced();
      const gp = roll ? Math.round(HudFx.pop(this.hud.goldPop) * 2) : 0;
      this.coin(c, ROOM.w - 10, ROOM.h - 11 - gp);
      this.text(
        String(roll ? Math.round(this.hud.gold) : this.runGold),
        ROOM.w - 13,
        ROOM.h - 5 - gp,
        5,
        gp ? "#fff2a8" : "#ffcc33",
        "right",
      );
    }

    const boss = this.boss;
    if (boss && isBossWave(this.wave) && !(boss.dead && boss.anim.done)) {
      const bw = 140,
        bx = (ROOM.w - bw) / 2,
        by = ROOM.h - 10;
      const queen = boss instanceof Queen;
      const king = boss instanceof ForestKing;
      const oni = boss instanceof Oni;
      this.text(
        oni ? "ONI" : king ? "O'RMON SHOHI" : queen ? "QOR MALIKASI" : "IBLIS",
        ROOM.w / 2,
        by - 2,
        5,
        boss.enraged ? (king ? "#d8ff7a" : queen ? "#a8eeff" : "#ff6a6a") : "#e0d6ee",
      );
      px(c, "#000", bx - 1, by, bw + 2, 6);
      px(
        c,
        oni
          ? boss.enraged
            ? "#ff5a4a"
            : "#b8322e"
          : king
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
      // faza chegaralari (odatda 60% va 30%; Oni — 50%) va daxlsizlik
      const marks = boss.phaseMarks;
      for (const m of marks) px(c, "#000", bx + bw * m, by + 1, 1, 4);
      if (boss.invulnerable) px(c, "rgba(255,255,255,0.5)", bx, by + 1, bw, 4);
      for (let i = 0; i <= marks.length; i++)
        px(c, i < boss.phase ? "#ffcc33" : "#3b2a3a", bx + bw + 4 + i * 4, by + 1, 3, 4);
      if (boss.berserk && Math.floor(this.time * 4) % 2)
        this.text("G'AZAB", bx - 4, by + 5, 5, "#ff4d4d", "right");
    }

    if (this.hintsVisible()) this.renderHints();
    if (this.synNote && this.stage === "fight" && !this.paused) this.renderSynNote(this.synNote);

    // pauzada banner pauza oynasi ustidan ko'rinmasin
    if (this.banner.timer > 0 && this.phase === "play" && this.stage === "fight" && !this.paused) {
      const a = Math.min(1, this.banner.timer * 2);
      c.globalAlpha = a;
      const sub = this.banner.hint ? this.dashHint() : this.banner.sub;
      // banner sirpanib kiradi: tasma o'rtadan ochiladi, sarlavha chapdan, izoh o'ngdan (hudFx.ts)
      const bin = this.fx.isReduced() ? 1 : this.hud.bannerIn;
      const bh = sub ? 40 : 28;
      const open = Math.max(2, Math.round(bh * bin));
      px(c, "rgba(0,0,0,0.55)", 0, 92 + Math.round((bh - open) / 2), ROOM.w, open);
      const off = Math.round((1 - bin) * 200);
      this.text(this.banner.title, ROOM.w / 2 - off, 112, 12, "#ffcc33");
      if (sub) this.text(sub, ROOM.w / 2 + off, 126, 6, "#e0d6ee");
      c.globalAlpha = 1;
    }
  }

  /**
   * Merganning HUD qismi: tutun bombasi chizig'i (kulrang), barabandagi o'qlar (otilgani xira)
   * va qayta o'qlash chizig'i.
   */
  private renderGunHud(p: Game["player"]) {
    const c = this.ctx;
    const theme = this.theme;
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

  /** Pauzadagi boshqaruv qatori: telefonda — tugma nomlari, kompyuterda — belgilangan tugmalar. */
  private controlsLine() {
    const { mage, hunter, gunner, paladin, samurai } = this.player;
    if (this.touch && paladin) return "Joystik yurish · SHANG zarba · HAMLA / qasam";
    if (this.touch && samurai) return "Joystik yurish · KATANA zarba / iai · DASH";
    if (this.touch)
      return mage
        ? "Joystik yurish · SHAR otish · TELEPORT"
        : hunter
          ? "Joystik yurish · O'Q otish · SAKRASH / tuzoq"
          : gunner
            ? "Joystik yurish · O'Q otish · SIRPANISH / tutun"
            : "Joystik yurish · ZARBA hujum · DASH sirpanish";
    const k = this.input.keyBinds;
    const M = moveLabel(k),
      A = actionKey(k, "attack"),
      D = actionKey(k, "dash");
    if (paladin) return `${M} yurish · ${A} SHANG · ${D} hamla/qasam`;
    if (samurai) return `${M} yurish · ${A} katana, bosib tur: iai · ${D} dash`;
    return mage
      ? `${M} yurish · ${A} shar · ${D} teleport`
      : hunter
        ? `${M} yurish · ${A} o'q · ${D} sakrash/tuzoq`
        : gunner
          ? `${M} · ${A} o'q · ${actionKey(k, "reload")} o'qlash · ${D} sirpanish/tutun`
          : `${M} yurish · ${A} zarba · ${D} dash`;
  }

  /** Qobiliyat nomi: dash / teleport / orqaga sakrash / sirpanish */
  private dashName() {
    const { mage, hunter, gunner, paladin } = this.player;
    if (paladin) return "muqaddas hamla";
    return mage ? "teleport" : hunter ? "orqaga sakrash" : gunner ? "sirpanish" : "dash";
  }

  /**
   * Dunyo bannerdagi qobiliyat ko'rsatmasi: telefonda — tugma nomi ("TELEPORT tugmasi — sakrash"),
   * kompyuterda — qayta belgilangan tugma ("Shift — teleport").
   */
  private dashHint() {
    if (!this.touch) return `${actionKey(this.input.keyBinds, "dash")} — ${this.dashName()}`;
    const { mage, hunter, gunner, paladin } = this.player;
    const button = touchLabels(this.hero).dash.text;
    if (paladin) return `${button} tugmasi — oldinga yugurish, bosib tur — qasam`;
    return `${button} tugmasi — ${mage ? "sakrash" : hunter ? "orqaga sakrash" : gunner ? "+2 o'q" : "sirpanish"}`;
  }

  /** Birinchi o'yin ko'rsatmalari: HUD chiziqlari ostida, chap tomonda. */
  private renderHints() {
    const c = this.ctx;
    const { mage, hunter, gunner, paladin, samurai } = this.player;
    const k = this.input.keyBinds;
    const A = actionKey(k, "attack"),
      D = actionKey(k, "dash");
    // Samurayning bir martalik maslahatlari: IAI, mukammal chetlanish va parry
    const tips = this.touch
      ? {
          iai: "KATANA ni bosib turing — IAI",
          dodge: "Zarbadan oldin DASH — mukammal chetlanish",
          parry: "Zarba tegayotganda KATANA — parry",
        }
      : {
          iai: `${A} ni bosib turing — IAI`,
          dodge: `Zarbadan oldin ${D} — mukammal chetlanish`,
          parry: `Zarba tegayotganda ${A} — parry`,
        };
    const base: Record<"attack" | "spin" | "dash", string> = samurai
      ? this.touch
        ? { attack: "KATANA — zarba", spin: tips.iai, dash: "DASH — chetlanish" }
        : { attack: `${A} — katana zarbasi`, spin: tips.iai, dash: `${D} — dash` }
      : paladin
        ? this.touch
          ? {
              attack: "SHANG — qilich bilan yerga urish",
              spin: "SHANG ni bosib turing — osmon hukmi",
              dash: "HAMLA — yugurish, bosib tur — qasam",
            }
          : {
              attack: `${A} — SHANG zarbasi`,
              spin: `${A} ni bosib turing — osmon hukmi`,
              dash: `${D} — hamla, bosib tur — qasam`,
            }
        : this.touch
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
                  spin: mage
                    ? "SHAR ni bosib turing — halqa"
                    : "ZARBA ni bosib turing — aylana zarba",
                  dash: mage ? "TELEPORT — sakrash" : "DASH — sirpanish",
                }
          : gunner
            ? {
                attack: `${A} — o'q, ${actionKey(k, "reload")} — qayta o'qlash`,
                spin: `${A} ni bosib turing — barabanni bo'shatish`,
                dash: `${D} — sirpanish, bosib tur — tutun`,
              }
            : hunter
              ? {
                  attack: `${A} — o'q`,
                  spin: `${A} ni bosib turing — teshuvchi o'q`,
                  dash: `${D} — orqaga sakrash, bosib tur — tuzoq`,
                }
              : {
                  attack: mage ? `${A} — sehrli shar` : `${A} — zarba`,
                  spin: mage
                    ? `${A} ni bosib turing — sehrli halqa`
                    : `${A} ni bosib turing — aylana zarba`,
                  dash: `${D} — ${this.dashName()}`,
                };
    const label: Record<Hint, string> = { ...base, ...tips };
    // Ovchida HUD'da uchinchi (tuzoq) chizig'i, Merganda tutun chizig'i va baraban bor —
    // ko'rsatmalar pastroqda
    const top = gunner ? 40 : hunter || paladin || samurai ? 28 : 24;
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
      // ekran yoshi: kirish qulfi (0.6 s) davomida sarlavha tushadi, kartalar birma-bir ochiladi
      const calm = this.fx.isReduced();
      const age = calm ? 9 : 0.6 - Math.max(0, this.upgradeLock);
      const drop = Math.round((1 - Math.min(1, age / 0.2)) ** 2 * -34);
      c.save();
      c.translate(0, drop);
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
      this.text(
        this.touch ? "Kuch tanlang: kartani bosing" : "Kuch tanlang: 1 / 2 / 3",
        ROOM.w / 2,
        58,
        6,
        "#e0d6ee",
      );
      c.restore();
      // Sehrgar kartalari qizil-qora, Ovchiniki yashil-jigarrang, Merganniki mis-kulrang:
      // ramka va fon binafsha emas
      // skin tanlangan bo'lsa — ramka skin rangida
      const [frame, inner] =
        this.look.tier !== "default"
          ? [this.theme.accentDark, "#140f1c"]
          : this.player.mage
            ? ["#5a2a30", "#1f1520"]
            : this.player.hunter
              ? ["#4a3a22", "#151c11"]
              : this.player.gunner
                ? ["#5a4426", "#18140f"]
                : ["#5c4a6e", "#1f1730"];
      this.choices.forEach((u, i) => {
        const r = this.cardRect(i);
        const sel = i === this.choiceIndex;
        const lift = sel ? -3 : 0;
        const ink = u.text ?? u.color;
        // karta aylanib chiqadi: eni 0 dan to'liqgacha (o'rtasiga nisbatan)
        const flip = cardFlip(i, age);
        if (flip <= 0) return;
        c.save();
        if (flip < 1) {
          c.translate(r.x + r.w / 2, 0);
          c.scale(flip, 1);
          c.translate(-(r.x + r.w / 2), 0);
        }
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
        // teg: ikonka va "ZARAR 2/3" (shu kartani olsa nechta bo'ladi); 3/3 — sinergiya ochiladi
        const tag = u.tags[0];
        if (tag) {
          const label = tagProgress(this.tagCounts, tag);
          const ready = (this.tagCounts[tag] ?? 0) + 1 === 3;
          c.font = `5px "Press Start 2P", monospace`;
          const w = c.measureText(label).width + 9;
          const tx = r.x + (r.w - w) / 2;
          this.tagIcon(tag, tx, r.y + 88 + lift);
          this.text(
            label,
            tx + 9,
            r.y + 94 + lift,
            5,
            ready && Math.floor(this.time * 4) % 2 ? "#ffffff" : TAGS[tag].color,
            "left",
          );
        }
        // noyob (qahramonga xos) va afsonaviy (sinergiyani ochadigan) karta ramkasi yaltiraydi
        const glow = calm
          ? "none"
          : cardGlow(!!u.hero, !!tag && (this.tagCounts[tag] ?? 0) + 1 === 3);
        if (glow !== "none" && flip >= 1) {
          const legend = glow === "legend";
          for (let n = 0; n < (legend ? 2 : 1); n++) {
            const head = this.time * SHIMMER_SPEED + i * 60 + n * (r.w + r.h);
            for (let d = 0; d < SHIMMER_LEN; d++) {
              const [fx, fy] = framePoint(r.w, r.h, head - d);
              c.globalAlpha = 1 - d / SHIMMER_LEN;
              px(c, legend ? "#ffe14d" : "#ffffff", r.x + fx, r.y + lift + fy, 1, 1);
              px(c, legend ? "#ffe14d" : "#ffffff", r.x + (fx ? fx - 1 : 1), r.y + lift + fy, 1, 1);
            }
          }
          c.globalAlpha = 1;
        }
        c.restore();
      });
      if (!this.touch) {
        const k = this.input.keyBinds;
        const lr = `${actionKey(k, "left")}/${actionKey(k, "right")}`;
        this.text(`${lr} tanlash, Enter — olish`, ROOM.w / 2, 196, 5, "#b8a8cc");
      }
    }
    if (this.paused) {
      px(c, "rgba(0,0,0,0.7)", 0, 0, ROOM.w, ROOM.h);
      // artefaktlar bo'lsa — yuqorida to'liq ro'yxat, sarlavha biroz pastroq
      const arts = this.artifacts.length > 0;
      if (arts) this.renderPauseArtifacts();
      this.text("PAUZA", ROOM.w / 2, ROOM.h / 2 - (arts ? 32 : 40), 18, "#ffcc33");
      this.text(
        this.touch
          ? `Ovoz: ${sfx.muted ? "o'chiq" : "yoqiq"}`
          : `Ovoz: ${sfx.muted ? "o'chiq" : "yoqiq"} (${actionKey(this.input.keyBinds, "mute")})`,
        ROOM.w / 2,
        ROOM.h / 2 - (arts ? 14 : 20),
        6,
        "#b8a8cc",
      );
      for (const { rect: b, label } of this.pauseButtons()) {
        px(c, "#ffcc33", b.x, b.y, b.w, b.h);
        px(c, "#2a1f38", b.x + 1, b.y + 1, b.w - 2, b.h - 2);
        this.text(label, ROOM.w / 2, b.y + 12, 7, "#e0d6ee");
      }
      this.text(this.controlsLine(), ROOM.w / 2, ROOM.h - 22, 5, "#b8a8cc");
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
      const record =
        ch === 4
          ? this.newCh4Best
          : ch === 3
            ? this.newCh3Best
            : ch === 2
              ? this.newCh2Best
              : this.newBest;
      const chBest = ch === 4 ? this.ch4Best : ch === 3 ? this.ch3Best : this.ch2Best;
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
        : ch >= 3
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

  /** HUD'dagi artefakt ikonkasi joyi (9x9; 8 tadan qator) */
  private artRect(i: number) {
    return { x: 4 + (i % ART_PER_ROW) * 11, y: 40 + Math.floor(i / ART_PER_ROW) * 11, w: 9, h: 9 };
  }

  /** Pauzadagi to'liq ro'yxat: 3 ustun, ikonka + nom */
  private pauseArtRect(i: number) {
    return { x: 8 + (i % 3) * 104, y: 15 + Math.floor(i / 3) * 10, w: 100, h: 9 };
  }

  private artIcon(id: ArtifactId, x: number, y: number) {
    const a = artifactById(id);
    renderPixelIcon(this.ctx, `art:${id}`, a.icon, artifactColors(a), x, y);
  }

  /** Yangi sinergiya: qahramon rangida "SINERGIYA!", teg ikonkasi va yangi qoida */
  private renderSynNote(n: { tag: Tag; timer: number }) {
    const c = this.ctx;
    const def = TAGS[n.tag];
    const theme = this.theme;
    const a = Math.min(1, n.timer * 3, (SYN_NOTE - n.timer) * 8);
    c.globalAlpha = Math.max(0, a);
    const lift = Math.round(Math.max(0, 0.12 - (SYN_NOTE - n.timer)) * 40);
    px(c, "rgba(0,0,0,0.55)", 0, 58 - lift, ROOM.w, 30);
    px(c, theme.accent, 0, 58 - lift, ROOM.w, 1);
    px(c, theme.accent, 0, 87 - lift, ROOM.w, 1);
    this.text("SINERGIYA!", ROOM.w / 2, 72 - lift, 10, theme.accent);
    c.font = `6px "Press Start 2P", monospace`;
    const line = `${def.name}: ${def.three}`;
    const w = c.measureText(line).width + 10;
    this.tagIcon(n.tag, ROOM.w / 2 - w / 2, 77 - lift);
    this.text(line, ROOM.w / 2 + 5, 84 - lift, 6, def.color);
    c.globalAlpha = 1;
  }

  /** Teg ikonkasi 7x7 (synergy.ts) */
  private tagIcon(tag: Tag, x: number, y: number) {
    renderPixelIcon(
      this.ctx,
      `tag:${tag}`,
      TAG_ICONS[tag],
      { X: TAGS[tag].color, k: "#120a18", w: "#ffffff" },
      x,
      y,
    );
  }

  /** Pauza: shu o'yindagi barcha artefaktlar; bosilgani (yoki oxirgisi) tavsifi bilan. */
  private renderPauseArtifacts() {
    const c = this.ctx;
    this.text(`ARTEFAKTLAR: ${this.artifacts.length}`, ROOM.w / 2, 10, 5, "#ffcc33");
    const sel = this.pauseArt >= 0 ? this.pauseArt : this.artifacts.length - 1;
    this.artifacts.forEach((id, i) => {
      const r = this.pauseArtRect(i);
      const a = artifactById(id);
      if (i === sel) px(c, "rgba(255,255,255,0.12)", r.x - 1, r.y - 1, r.w + 2, r.h + 2);
      this.artIcon(id, r.x, r.y);
      this.text(a.name, r.x + 12, r.y + 7, 5, i === sel ? a.color : "#e0d6ee", "left");
    });
    const a = artifactById(this.artifacts[sel]!);
    const rows = Math.ceil(this.artifacts.length / 3);
    this.text(a.desc, ROOM.w / 2, 15 + rows * 10 + 6, 5, a.color);
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
