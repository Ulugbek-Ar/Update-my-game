import {
  Animator,
  Body,
  ROOM,
  updatePhysics,
  isFlashing,
  clampToRoom,
  type AnimState,
} from "./animation";
import type { Input } from "./input";
import { SAMURAI_FRAME, SAMURAI_FRAMES, renderSprite, type SpritePalette } from "./sprites";
import { sfx } from "./audio";
import type { Hero } from "./hero";
import type { FlairKind, ToneKind } from "./skinFx";
import { currentSettings } from "./settings";
import { HeroVisual, heroScale, subFrame } from "./heroAnim";

export const PLAYER_MAX_HP = 6;
const ATTACK_TIME = 0.24;
const HURT_TIME = 0.25;
const INVULN = 0.8;
const DASH_TIME = 0.16;
const DASH_SPEED = 270;
/** Kuchli (aylana) zarba: shuncha bosib turib qo'yib yuborish kerak */
export const CHARGE_TIME = 0.6;
export const SPIN_CD = 3;
export const SPIN_TIME = 0.3;
/** Sehrgar */
export const MAGE_MAX_HP = 5;
export const TELEPORT_DIST = 50;
const TELEPORT_TIME = 0.12;
/** Muz ruhining sovuq nafasi: shuncha sekin yuradi */
export const CHILL_SPEED = 0.5;
/** Ovchi: 5 yurak, eng tez yuradigan qahramon */
export const HUNTER_MAX_HP = 5;
export const HUNTER_SPEED = 108;
/** Kuchaytirilgan o'q: teshib o'tadi, 2x zarar, shuncha qayta tiklanadi */
export const POWER_SHOT_CD = 2;
/** Orqaga sakrash */
export const JUMP_TIME = 0.2;
export const JUMP_SPEED = 220;
/** Dushman shu masofada bo'lsa, sakrash undan uzoqqa */
export const JUMP_THREAT = 110;
/** Shift'ni shuncha bosib tursa — sakrash o'rniga tuzoq */
export const TRAP_HOLD = 0.35;
export const TRAP_CD = 6;
/** Mergan: 5 yurak, tezlik 92 */
export const GUNNER_MAX_HP = 5;
export const GUNNER_SPEED = 92;
/** Barabandagi o'qlar, qayta o'qlash vaqti va o'qlar orasidagi vaqt */
export const GUN_AMMO = 6;
export const RELOAD_TIME = 1.2;
export const GUN_CD = 0.25;
/** Tez uchadigan o'q va uning uchish masofasi (UZOQ NISHON bilan uzoqroq) */
export const GUN_SPEED = 300;
export const GUN_RANGE = 170;
/** Barabanni bo'shatish: hamma o'q shuncha vaqtda yelpig'ich (±FAN_SPREAD rad) bo'lib uchadi */
export const FAN_TIME = 0.4;
export const FAN_SPREAD = 0.5;
export const FAN_CD = 3;
/** Sirpanish: qisqa va tez, oxirida barabanga 2 ta o'q */
export const SLIDE_TIME = 0.18;
export const SLIDE_SPEED = 250;
export const SLIDE_AMMO = 2;
/** Tutun bombasi: Shift'ni bosib turish (Ovchi tuzog'idek), tutun ichida shuncha soniya ko'rinmaydi */
export const SMOKE_CD = 6;
export const SMOKE_HIDE = 2;
/** Paladin (tank): 8 yurak — eng ko'p, tezlik 76 — eng sekin, itarilish 50% kam */
export const PALADIN_MAX_HP = 8;
export const PALADIN_SPEED = 76;
export const PALADIN_KNOCK = 0.5;
/** SHANG: qilichni ko'tarish (tayyorgarlik), so'ng yo'lak bo'ylab zarba; qayta tiklanish bosishdan */
export const SHANG_WINDUP = 0.4;
export const SHANG_CD = 0.9;
export const SHANG_TIME = 0.22;
/** Zarba yo'lagi: uzunligi reach × 2 (Ritsarniki reach + reach/4 ≈ 20 px — Paladinda 40 px), eni */
export const PALADIN_REACH = 20;
export const SHANG_W = 18;
/** OSMON HUKMI: 1s zaryad, 360° oltin zarb to'lqini (3x zarar), dushmanlar 1s gangiydi */
export const SKY_CHARGE = 1;
export const SKY_CD = 4;
export const SKY_RADIUS = 48;
export const SKY_STUN = 1;
/** MUQADDAS HAMLA: qisqa og'ir yugurish, yo'lidagilarni itaradi (1 zarar) */
export const HAMLA_TIME = 0.2;
export const HAMLA_SPEED = 230;
export const HAMLA_DMG = 1;
/** QASAM: shuncha soniya atrofdagi hamma Paladinni nishonga oladi, zarar 50% kam */
export const VOW_TIME = 4;
export const VOW_CD = 10;
export const VOW_RADIUS = 80;
/** ZARB TO'LQINI (karta): SHANGdan keyin oldinga uchadigan to'lqin — tezligi, masofasi, eni */
export const WAVE_SPEED = 190;
export const WAVE_RANGE = 120;
export const WAVE_SIZE = 14;
/** MUQADDAS AURA (karta): shuncha soniyada 1 yurak (onlayn — shu radiusdagi do'stlarga ham) */
export const AURA_EVERY = 15;
export const AURA_RADIUS = 90;
/**
 * Samuray qiz: 4 yurak (xato qilsa jazolanadi), tezlik 102 — Ovchidan keyingi eng tez qahramon.
 * Katana tez (0.3 s da bir, zarba 0.18 s) va qisqa; har zarba Ritsarnikining 75% i.
 */
export const SAMURAI_MAX_HP = 4;
export const SAMURAI_SPEED = 102;
export const KATANA_CD = 0.3;
export const KATANA_TIME = 0.18;
export const KATANA_REACH = 14;
export const KATANA_MUL = 0.75;
/** Kombo: shuncha ichida yana bosilsa davom etadi; 3-zarba keng yoy (maydoni shuncha baravar) */
export const COMBO_WINDOW = 0.6;
export const COMBO_WIDE = 1.7;
/**
 * IAI: hujumni IAI_MIN dan ko'p bosib turib qo'yib yuborilsa — chaqmoqdek sirpanib o'tadi. Zaryad
 * to'lgani sari (chargeTime da to'liq) masofa IAI_MIN_DIST dan IAI_MAX_DIST gacha, zarar 1x dan
 * strongMul gacha oshadi. Yo'lidagilar belgilanadi va IAI_DELAY dan keyin ketma-ket kesiladi.
 */
export const IAI_MIN = 0.3;
export const IAI_CHARGE = 0.8;
export const IAI_CD = 3;
export const IAI_TIME = 0.12;
export const IAI_MIN_DIST = 44;
export const IAI_MAX_DIST = 92;
/** Sirpanish yo'lagining eni (belgilash uchun) */
export const IAI_WIDTH = 18;
export const IAI_DELAY = 0.25;
/** Kesiklar orasi ("chiq-chiq") */
export const IAI_GAP = 0.06;
/** Sirpanishdan keyin shuncha qimirlamaydi (himoya dumi ichida) */
export const IAI_LOCK = 0.18;
/** Zaryad paytida shuncha sekin yuradi (qo'l dastada, oyoqlar keng) */
export const IAI_MOVE = 0.55;
/** UZUN IAI kartasi: har biri shuncha masofa qo'shadi */
export const IAI_RANGE_CARD = 26;
/**
 * MUKAMMAL CHETLANISH: dash boshlanganidan shuncha ichida tegishi kerak bo'lgan zarba — vaqt
 * sekinlashadi, keyingi hujum kritik. Spam qilib bo'lmaydi: DODGE_CD sovish.
 */
export const DODGE_WINDOW = 0.15;
export const DODGE_WINDOW_CARD = 0.08;
export const DODGE_CD = 1.5;
/** Vaqt shuncha (real) soniya sekinlashadi; Samurayning o'zi sekinlashmaydi */
export const DODGE_SLOW = 0.6;
/**
 * PARRY: oddiy hujumning dastlabki PARRY_WINDOW soniyasida tekkan zarba bekor bo'ladi (snaryad
 * egasiga qaytadi, hujumchi gangiydi). Bo'sh ketgan oyna PARRY_WHIFF_CD sovitadi — hujumni
 * to'xtovsiz bosib parry qilib bo'lmaydi.
 */
export const PARRY_WINDOW = 0.12;
export const PARRY_WHIFF_CD = 0.5;
/** Parry dan keyingi qisqa daxlsizlik va hujumchining gangishi */
export const PARRY_GUARD = 0.3;
export const PARRY_STUN = 0.7;
/** QAYTGAN PO'LAT kartasi: parry dan keyin shuncha soniya tezlashish */
export const PARRY_BOOST = 2;
/** Muz qamoq: tugmalarni shuncha marta bosmasa ham shuncha soniyadan keyin o'zi eriydi */
export const ENCASE_MAX = 3.5;
/** Dash/teleport/sakrash tugagach shuncha himoya dumi (o'yinchi biroz shaffof) */
export const DASH_GUARD = 0.2;
/** Dash oxirida dushman ichida qolsa — chiqquncha himoya, lekin shundan oshmaydi */
export const DASH_GUARD_MAX = 0.35;
/** Tezlashish (TEZLIK sinergiyasi, OLTIN SHAMOL artefakti): yurish tezligi shuncha baravar */
export const BOOST_SPEED = 1.35;

/** Player o'qiydigan boshqaruv: klaviatura/sensor (Input) yoki olamdagi buyruqlar (RealmSim). */
export type PlayerInput = Pick<Input, "consumeAttack" | "consumeDash" | "axis" | "attackHeld"> & {
  dashHeld?: () => boolean;
  /** Mergan: R tugmasi (telefonda o'q belgisi) — qayta o'qlash */
  consumeReload?: () => boolean;
};

/**
 * Dushman va Boss AI ko'radigan nishon: o'yinchining o'zi yoki tutun bombasidagi soxta nishon
 * (yashiringan Merganni ko'rmaydi — uning oxirgi ko'ringan joyini nishonga oladi).
 */
export type Target = Pick<
  Player,
  "x" | "y" | "size" | "fx" | "fy" | "chill" | "takeHit" | "ensnare" | "encase" | "evading"
>;

/** Sehrgarning sehrli shari */
export interface Bolt {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  /** Yana nechta dushmanga tega oladi */
  left: number;
  /** Allaqachon tekkanlar (teshuvchi shar bir dushmanga ikki marta tegmaydi) */
  hit: object[];
  /** Ovchi o'qi (aks holda Sehrgar shari) */
  arrow?: boolean;
  /** Zarar ko'paytuvchisi: kuchaytirilgan o'q 2x */
  power?: number;
  /** Zaharli uch: tekkan dushman zaharlanadi */
  poison?: boolean;
  /** Mergan o'qi */
  bullet?: boolean;
  /** Yana shuncha piksel uchadi (Mergan o'qi), so'ng so'nadi */
  range?: number;
  /** Devordan yana necha marta qaytadi (Rikoshet) */
  bounce?: number;
  /** Qaysi baraban (qayta o'qlashlar hisobi) — "Olti o'q" yutug'i uchun */
  load?: number;
  /** Paladinning ZARB TO'LQINI (hamma dushmandan o'tadi) */
  wave?: boolean;
  /** Samuray parry bilan qaytargan dushman snaryadi: o'q yoki olov shari (rangi — ko'k olov) */
  reflect?: "arrow" | "fire" | "blue";
}

/** Faol IAI sirpanishi */
export interface IaiDash {
  speed: number;
  /** Zarar ko'paytuvchisi (1 .. strongMul) va zaryad ulushi (0..1) */
  mul: number;
  k: number;
  /** Mukammal chetlanishdan keyin: barcha kesiklar kritik */
  crit: boolean;
  from: { x: number; y: number };
}

export class Player implements Body {
  x = 160;
  y = 190;
  size = 12;
  vx = 0;
  vy = 0;
  hp = PLAYER_MAX_HP;
  maxHp = PLAYER_MAX_HP;
  flash = 0;
  fx = 0;
  fy = -1;
  attackTimer = 0;
  cooldown = 0;
  hurtTimer = 0;
  invuln = 0;
  dashTimer = 0;
  dashCooldown = 0;
  dashX = 0;
  dashY = 0;
  /** Ketma-ket qolgan dashlar (Ikki karra dash bilan 2 ta) */
  dashCharges = 1;
  /** Dash tugaganidan beri o'tgan vaqt (-1 — himoya dumi yo'q) */
  guardAge = -1;
  /** O'yinchi dushman tanasi ichida (Game/RealmSim belgilaydi) — himoya dumi uzayadi */
  inFoe = false;
  /** Hujum tugmasi bosib turilgan vaqt */
  charge = 0;
  spinTimer = 0;
  spinCooldown = 0;
  // Kuchaytirishlar o'zgartiradigan ko'rsatkichlar
  speed = 90;
  damage = 1;
  reach = 16;
  attackCd = 0.4;
  dashCd = 0.8;
  /** 0 — yo'q, aks holda har N o'ldirishda +1 yurak */
  lifesteal = 0;
  dashMax = 1;
  /** Zarba yeganda yaqin dushmanga 1 zarar */
  thorns = false;
  /** Sehrli shar tezligi (Sehrgar) */
  boltSpeed = 170;
  boltSize = 6;
  /** Bir zarbadagi sharlar soni (Uch shar) */
  multishot = 1;
  /** Shar nechta dushmandan o'tib keta oladi (Teshuvchi shar) */
  pierce = 0;
  /** Muz qalqoni: zarba yeganda atrofdagi dushmanlar sekinlashadi */
  frost = false;
  /** Sovuq nafasdan sekinlashish qolgan vaqti (Muz ruhi) */
  chill = 0;
  /** To'r yoki ildiz ushlagan: shuncha soniya yurolmaydi (zarba bilan uziladi) */
  snare = 0;
  /** Shu kadrda to'r zarba bilan uzildi (Game effekt chiqaradi) */
  cutFree = false;
  /** Muz qamoq: chiqish uchun yana shuncha bosish kerak (0 — qamoqda emas) va qolgan vaqt */
  ice = 0;
  iceT = 0;
  /** Shu kadrda muz sindi (Game effekt chiqaradi) */
  brokeIce = false;
  /** Zaharli bulut ichida o'tgan vaqt: har 1s da 1 zarar (Game hisoblaydi) */
  poison = 0;
  /** Shu kadrda otilgan sharlar — Game o'ziga oladi */
  bolts: Bolt[] = [];
  /** Kuchli zarba (aylana/halqa/kuchli o'q) qayta tiklanishi */
  spinCd = SPIN_CD;
  /** Ovchi: tuzoq qayta tiklanishi, shu kadrda qo'yilgan tuzoqlar, zaharli uch */
  trapCd = TRAP_CD;
  trapCooldown = 0;
  traps: { x: number; y: number }[] = [];
  /** Tuzoq hali tayyor emas (Game xabar chiqaradi) */
  trapDenied = false;
  poisonTip = false;
  /** Mergan: barabandagi o'qlar va sig'imi (Katta baraban bilan 8) */
  ammo = GUN_AMMO;
  ammoMax = GUN_AMMO;
  /** Qayta o'qlash vaqti va qolgan vaqti (0 — o'qlanmayapti) */
  reloadTime = RELOAD_TIME;
  reloadT = 0;
  /** Nechanchi baraban: har to'liq qayta o'qlashda oshadi */
  loadId = 0;
  /** O'q uchish masofasi va devordan qaytishlar soni (Rikoshet) */
  range = GUN_RANGE;
  bounce = 0;
  /** Barabanni bo'shatish: hali otilmagan o'qlar, jami o'qlar va o'tgan vaqt */
  fanLeft = 0;
  fanTotal = 0;
  fanT = 0;
  /** Tutun bombasi: qayta tiklanish, shu kadrda tashlangan bombalar, "hali tayyor emas" xabari */
  smokeCd = SMOKE_CD;
  smokeCooldown = 0;
  smokes: { x: number; y: number }[] = [];
  smokeDenied = false;
  /** Tutun ichida yashiringan vaqt (dushmanlar ko'rmaydi; tutundan chiqsa Game nollaydi) */
  hideT = 0;
  /** Paladin: SHANG tayyorgarligi qolgan vaqti (qilich boshi uzra), zarba tushgan kadr (Game effekt) */
  slamT = 0;
  slammed = false;
  /** OSMON HUKMI yerga tushgan kadr (Game: to'lqin, gangitish) */
  judged = false;
  /** Kuchli zarba zaryadi shuncha bosib turilganda to'ladi (Paladinda 1s) */
  chargeTime = CHARGE_TIME;
  /** QASAM: qolgan vaqt, qayta tiklanish, shu kadrda boshlandi, "hali tayyor emas" */
  vowT = 0;
  vowCd = VOW_CD;
  vowCooldown = 0;
  vowed = false;
  vowDenied = false;
  /** QASAMdagi yarim zarar hisobi: 0.5 lar yig'ilib butun yurak bo'lganda olinadi */
  private halfDmg = 0;
  /** Zarba zirhda (yoki QASAMda) to'liq so'ndi — Game "BLOK" yozuvini chiqaradi */
  absorbed = false;
  /** Kartalar: ZARB TO'LQINI, MUQADDAS AURA (taymer va shu kadrda tiklanish — Game/RealmSim effekti) */
  shockwave = false;
  aura = false;
  auraT = 0;
  auraPulse = false;
  /**
   * Kuchli zarba ko'paytuvchisi: aylana zarba / halqa / kuchli o'q 2x, OSMON HUKMI 3x.
   * Sinergiya (synergy.ts) oshiradi; onlayn olamda doim asl qiymat.
   */
  strongMul = 2;
  /** Tezlashish qolgan vaqti (yurish BOOST_SPEED baravar; dash qiymatlari o'zgarmaydi) */
  boost = 0;
  /** Bitta zarbani to'sadigan qalqonlar (HIMOYA sinergiyasi, artefakt) va shu kadrda to'sildi */
  ward = 0;
  warded = false;
  /** POROX sinergiyasi: barabanni bo'shatishdagi o'qlar teshib o'tadi */
  fanPierce = false;
  /** Skin palitrasi (skins.ts; undefined — asl ranglar). Faqat ko'rinish */
  skin: SpritePalette | undefined = undefined;
  /** Afsonaviy skin ovoz ohangi (skinFx.ts; null — yo'q). Faqat ovoz */
  tone: ToneKind | null = null;
  /** Samuray: oddiy zarba davomiyligi (boshqalarda ATTACK_TIME) */
  attackTime = ATTACK_TIME;
  /** Kombo: joriy zarba raqami (0, 1, 2 — keng yoy) va keyingi zarbagacha qolgan vaqt */
  comboStep = 0;
  comboT = 0;
  /** Faol IAI sirpanishi; tugagan kadrda iaiDone (Game kesiklarni rejalashtiradi) */
  iai: IaiDash | null = null;
  iaiDone: { mul: number; crit: boolean } | null = null;
  /** Shu kadrda IAI boshlandi (Game effekt chiqaradi) */
  iaiStarted = false;
  /** Sirpanishdan keyingi qotish va kesish/qinga qaytarish pozasi qolgan vaqti */
  iaiLock = 0;
  iaiPose = 0;
  /** UZUN IAI qo'shgan masofa; IKKI KESIM — har dushman ikki marta kesiladi */
  iaiRange = 0;
  iaiDouble = false;
  /** Zaryad to'ldi (shu kadrda) — Game yaltirash va ovoz chiqaradi */
  chargeFull = false;
  /** Dash boshlanganidan beri o'tgan vaqt (-1 — dash yo'q): mukammal chetlanish oynasi */
  dashAge = -1;
  dodgeWindow = DODGE_WINDOW;
  perfectCooldown = 0;
  /** Shu kadrda mukammal chetlanish bo'ldi (Game: sekin vaqt, gulbarglar, kritik) */
  perfect = false;
  /** Keyingi hujum kafolatlangan kritik (mukammal chetlanishdan keyin) */
  critReady = false;
  /** Parry oynasi qolgan vaqti, shu oynada zarba qaytarildimi va bo'sh ketgandan keyingi sovish */
  parryT = 0;
  parryHit = false;
  parryCooldown = 0;
  /** Shu kadrda qaytarilgan zarbalar: zarba kelgan nuqta (Game hujumchini gangitadi) */
  parried: { x: number; y: number }[] = [];
  /** Parry pozasi (katana tik) qolgan vaqti — faqat ko'rinish */
  parryPose = 0;
  /** Kartalar: QAYTGAN PO'LAT, GULBARG BO'RONI, SOVUQ QON */
  parryBoost = false;
  petalStorm = false;
  coldBlood = false;
  /**
   * Afsonaviy skin animatsiyasi (skinFx.ts; null — yo'q). "moon" (Qizil oy): IAI dan keyin katanani
   * qinga qaytarish kadri. Faqat ko'rinish — satr (son/mantiqiy emas): skin kuch bermaydi
   */
  flair: FlairKind | null = null;
  /** Vizual qatlam holati (heroAnim.ts): burilish va qadam — faqat chizish uchun */
  vis = new HeroVisual();
  /** HAMLA paytida allaqachon itarilganlar */
  rammed = new Set<object>();
  /** Shift bosib turilgan vaqt (-1 — bosilmagan, -2 — tuzoq qo'yildi, qo'yib yuborilishi kutilmoqda) */
  private shiftHold = -1;
  /** Eng yaqin dushman (Game belgilaydi) — orqaga sakrash undan uzoqlashadi */
  threat: { x: number; y: number } | null = null;
  /** Teleport boshlangan nuqta — Game effekt chizib, null qiladi */
  teleportFrom: { x: number; y: number } | null = null;
  /** Chegaraga qisish: xonada 320x240, ochiq olamda (RealmSim) plitka to'qnashuvi alohida */
  clamp: (b: Body) => void = clampToRoom;
  /** Joriy hujumda allaqachon urilganlar */
  hitSet = new Set<object>();
  anim = new Animator({
    idle: { frames: 2, frameTime: 0.5, loop: true },
    walk: { frames: 4, frameTime: 0.12, loop: true },
    attack: { frames: 3, frameTime: ATTACK_TIME / 3, loop: false },
    hurt: { frames: 1, frameTime: HURT_TIME, loop: false },
    death: { frames: 3, frameTime: 1 / 3, loop: false },
  });

  constructor(public hero: Hero = "knight") {
    if (hero === "mage") {
      this.hp = this.maxHp = MAGE_MAX_HP;
      this.speed = 95;
      this.attackCd = 0.45;
      this.dashCd = 0.9;
    }
    if (hero === "hunter") {
      this.hp = this.maxHp = HUNTER_MAX_HP;
      this.speed = HUNTER_SPEED;
      this.attackCd = 0.38;
      this.dashCd = 0.9;
      this.spinCd = POWER_SHOT_CD;
      this.boltSpeed = 210;
      this.boltSize = 5;
    }
    if (hero === "paladin") {
      this.hp = this.maxHp = PALADIN_MAX_HP;
      this.speed = PALADIN_SPEED;
      this.attackCd = SHANG_CD;
      this.dashCd = 1;
      this.reach = PALADIN_REACH;
      this.spinCd = SKY_CD;
      this.chargeTime = SKY_CHARGE;
      this.strongMul = 3;
      // hujum kadrlari (4 ta) qo'lda boshqariladi: ko'tarish, porlash, urish, qaytarish
      this.anim.defs.attack = { frames: 4, frameTime: 99, loop: false };
    }
    if (hero === "gunner") {
      this.hp = this.maxHp = GUNNER_MAX_HP;
      this.speed = GUNNER_SPEED;
      this.attackCd = GUN_CD;
      this.dashCd = 0.9;
      this.spinCd = FAN_CD;
      this.boltSpeed = GUN_SPEED;
      this.boltSize = 4;
    }
    if (hero === "samurai") {
      this.hp = this.maxHp = SAMURAI_MAX_HP;
      this.speed = SAMURAI_SPEED;
      this.attackCd = KATANA_CD;
      this.attackTime = KATANA_TIME;
      this.reach = KATANA_REACH;
      this.dashCd = 0.7;
      this.spinCd = IAI_CD;
      this.chargeTime = IAI_CHARGE;
      // ko'proq kadr: soch va kamar hilpiraydi, yugurish silliq; umumiy davomiylik o'sha (1 s, 0.48 s)
      this.anim.defs.idle = {
        frames: SAMURAI_FRAMES.idle,
        frameTime: 1 / SAMURAI_FRAMES.idle,
        loop: true,
      };
      this.anim.defs.walk = {
        frames: SAMURAI_FRAMES.walk,
        frameTime: 0.48 / SAMURAI_FRAMES.walk,
        loop: true,
      };
      this.anim.defs.attack = { frames: 3, frameTime: KATANA_TIME / 3, loop: false };
    }
  }

  get mage() {
    return this.hero === "mage";
  }

  get hunter() {
    return this.hero === "hunter";
  }

  get gunner() {
    return this.hero === "gunner";
  }

  get paladin() {
    return this.hero === "paladin";
  }

  get samurai() {
    return this.hero === "samurai";
  }

  /** Parry oynasi ochiq: shu payt tekkan zarba qaytariladi */
  get parrying() {
    return this.parryT > 0;
  }

  /** QASAM faol: atrofdagi dushmanlar Paladinni nishonga oladi, zarar yarmiga kamayadi */
  get vowing() {
    return this.vowT > 0;
  }

  /** SHANG qilich ko'tarilmoqda yoki zarba yo'lagi faol */
  get slamming() {
    return this.slamT > 0 || (this.paladin && this.attackTimer > 0);
  }

  /** Mergan qayta o'qlamoqda */
  get reloading() {
    return this.reloadT > 0;
  }

  /** Mergan tutun ichida yashiringan: dushmanlar uni ko'rmaydi */
  get hidden() {
    return this.hideT > 0;
  }

  /** Masofadan uradigan qahramon (Sehrgar shari, Ovchi va Mergan o'qi) */
  get ranged() {
    return this.mage || this.hunter || this.gunner;
  }

  get dead() {
    return this.anim.state === "death";
  }

  get dashing() {
    return this.dashTimer > 0;
  }

  /** Dash tugagach qisqa himoya: 0.2s, dushman ichida qolsa chiqquncha (eng ko'pi 0.35s). */
  get guarded() {
    const t = this.guardAge;
    return t >= 0 && (t < DASH_GUARD || (this.inFoe && t < DASH_GUARD_MAX));
  }

  /** Dash/teleport/sakrash paytida yoki undan keyingi himoya dumida daxlsiz. */
  get evading() {
    return this.dashing || this.guarded;
  }

  get spinning() {
    return this.spinTimer > 0;
  }

  /** Kuchli zarba tayyor va tugma yetarlicha bosib turilgan. */
  get charged() {
    return this.charge >= this.chargeTime;
  }

  /** Joriy zarba zarari: aylana zarba 2x; Paladinda SHANG 2x, OSMON HUKMI 3x. */
  get hitDamage() {
    if (this.paladin) return this.damage * (this.spinning ? this.strongMul : 2);
    // katana: tez, lekin har zarba yengilroq (IAI zarari alohida — Game: iai.mul)
    if (this.samurai) return this.damage * KATANA_MUL;
    return this.spinning ? this.damage * this.strongMul : this.damage;
  }

  /** Zarba tegsa true qaytaradi. Dash paytida va himoya dumida daxlsiz. */
  takeHit(dmg: number, fromX: number, fromY: number, force: number) {
    if (this.invuln > 0 || this.dead) return false;
    if (this.evading) {
      // MUKAMMAL CHETLANISH: dash boshlanganidan dodgeWindow ichida tegishi kerak bo'lgan zarba
      if (
        this.samurai &&
        !this.iai &&
        this.dashAge >= 0 &&
        this.dashAge <= this.dodgeWindow &&
        this.perfectCooldown <= 0
      ) {
        this.perfect = true;
        this.perfectCooldown = DODGE_CD;
      }
      return false;
    }
    if (this.parryT > 0) {
      // PARRY: zarba bekor; Game hujumchini gangitadi (snaryadni Game o'zi qaytaradi)
      this.parried.push({ x: fromX, y: fromY });
      this.parryHit = true;
      this.invuln = Math.max(this.invuln, PARRY_GUARD);
      this.parryPose = 0.22;
      return false;
    }
    if (this.ward > 0) {
      // qalqon: zarba to'liq to'siladi, qisqa daxlsizlik
      this.ward--;
      this.warded = true;
      this.invuln = INVULN / 2;
      this.flash = 0.15;
      sfx.block();
      return true;
    }
    if (this.paladin) {
      // og'ir zirh: katta (2+ yurakli) zarba bir yurakka kamayadi; QASAMda yana yarmi
      if (dmg >= 2) dmg -= 1;
      if (this.vowing) {
        this.halfDmg += dmg / 2;
        dmg = Math.floor(this.halfDmg);
        this.halfDmg -= dmg;
      }
      force *= PALADIN_KNOCK;
      if (dmg <= 0) {
        // zirhga urildi: zarar yo'q, qisqa daxlsizlik
        this.absorbed = true;
        this.invuln = INVULN / 2;
        this.flash = 0.15;
        sfx.block();
        return true;
      }
    }
    this.hp -= dmg;
    if (this.hp <= 0) sfx.death();
    else sfx.hurt();
    this.flash = 0.4;
    this.invuln = INVULN;
    const dx = this.x - fromX,
      dy = this.y - fromY;
    const l = Math.hypot(dx, dy) || 1;
    this.vx = (dx / l) * force;
    this.vy = (dy / l) * force;
    // Paladin zarba paytida to'xtamaydi (og'ir zirh): SHANG va OSMON HUKMI davom etadi
    const steady = this.paladin && (this.slamming || this.spinning) && this.hp > 0;
    if (!steady) {
      this.attackTimer = 0;
      this.charge = 0;
    }
    if (this.hp <= 0) this.anim.set("death", true);
    else if (!steady) {
      this.hurtTimer = HURT_TIME;
      this.anim.set("hurt", true);
    }
    return true;
  }

  /** Muz ichida qotadi (Qor Malikasining nuri); dash paytida ta'sir qilmaydi. */
  encase(taps: number) {
    if (this.dead || this.evading) return false;
    this.ice = Math.max(this.ice, taps);
    this.iceT = ENCASE_MAX;
    this.charge = 0;
    this.attackTimer = 0;
    return true;
  }

  /** Muz qamoqda */
  get encased() {
    return this.ice > 0;
  }

  /** To'r yoki ildiz ushlaydi; dash paytida (va himoya dumida) ta'sir qilmaydi. */
  ensnare(t: number) {
    if (this.dead || this.evading) return false;
    this.snare = Math.max(this.snare, t);
    return true;
  }

  heal(n: number) {
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + n);
    return this.hp > before;
  }

  /** Hujum zonasi (faqat hujum vaqtida). */
  attackBox(): Body | null {
    if (this.paladin) return this.paladinBox();
    // aylana zarba — o'yinchi atrofidagi katta maydon (Ovchida kuchli o'q, Merganda o'qlar uchadi)
    if (this.spinning && !this.hunter && !this.gunner)
      return { x: this.x, y: this.y, size: this.reach * 2.4 } as Body;
    // Sehrgar va Ovchining oddiy zarbasi — shar/o'q, u alohida uchadi
    if (this.attackTimer <= 0 || this.ranged) return null;
    // Samuray kombosining 3-zarbasi: keng yoy — maydon kattaroq va tanaga yaqinroq
    const wide = this.samurai && this.comboStep === 2;
    const off = this.reach * (wide ? 0.55 : 0.75);
    const size = wide ? this.reach * COMBO_WIDE : this.reach;
    return { x: this.x + this.fx * off, y: this.y + this.fy * off, size } as Body;
  }

  /**
   * Paladin zarba maydoni: OSMON HUKMI — atrofdagi keng doira (kvadrat), SHANG — qarab turgan tomonga
   * uzun yo'lak (uzunligi reach × 2, eni SHANG_W): tanadan boshlab qilich uchigacha.
   */
  private paladinBox(): Body | null {
    if (this.spinning) return { x: this.x, y: this.y, size: SKY_RADIUS * 2 } as Body;
    if (this.attackTimer <= 0) return null;
    const len = this.reach * 2;
    const c = len / 2 + 2;
    const horiz = this.fx !== 0;
    return {
      x: this.x + this.fx * c,
      y: this.y + this.fy * c,
      size: SHANG_W,
      w: horiz ? len : SHANG_W,
      h: horiz ? SHANG_W : len,
    } as unknown as Body;
  }

  update(dt: number, input: PlayerInput) {
    // vizual holat (burilish, qadam): mantiq undan hech narsa o'qimaydi
    this.vis.update(dt, this.fx, this.anim);
    this.anim.update(dt);
    updatePhysics(this, dt, this.clamp);
    if (this.dead) return;
    if (this.guardAge >= 0) {
      this.guardAge += dt;
      if (!this.guarded) this.guardAge = -1;
    }
    this.cooldown -= dt;
    this.invuln -= dt;
    this.hurtTimer -= dt;
    this.dashCooldown -= dt;
    this.spinCooldown -= dt;
    this.trapCooldown -= dt;
    this.smokeCooldown -= dt;
    this.vowCooldown -= dt;
    if (this.vowT > 0) this.vowT -= dt;
    if (this.boost > 0) this.boost -= dt;
    if (this.hideT > 0) this.hideT -= dt;
    if (this.gunner) this.updateGun(dt, input);
    if (this.samurai) this.tickSamurai(dt);
    if (this.chill > 0) this.chill -= dt;
    if (this.snare > 0) this.snare -= dt;
    if (this.dashCooldown <= 0) this.dashCharges = this.dashMax;
    if (this.attackTimer > 0) this.attackTimer -= dt;
    if (this.spinTimer > 0) this.spinTimer -= dt;
    if (this.paladin) this.updateSlam(dt);
    if (this.aura) {
      this.auraT += dt;
      if (this.auraT >= AURA_EVERY) {
        this.auraT -= AURA_EVERY;
        this.auraPulse = true;
        this.heal(1);
      }
    }

    if (this.ice > 0) {
      // muz qamoq: har bosish (hujum yoki dash, telefonda ham) muzni yoradi
      this.iceT -= dt;
      if (input.consumeAttack()) this.ice--;
      if (input.consumeDash()) this.ice--;
      if (this.ice <= 0 || this.iceT <= 0) {
        this.ice = this.iceT = 0;
        this.brokeIce = true;
      }
      if (this.anim.state !== "hurt" || this.anim.done) this.anim.set("idle");
      return;
    }

    const wantAttack = input.consumeAttack();
    const wantDash = input.consumeDash();
    const { x, y } = input.axis();
    if (wantAttack && this.snare > 0) {
      // to'rni zarba bilan uzish
      this.snare = 0;
      this.cutFree = true;
    }

    if (this.dashTimer > 0) {
      const left = this.dashTimer;
      this.dashTimer -= dt;
      // dash tugagan kadrdayoq himoya dumi boshlanadi — quvib kelgan mob darhol ura olmaydi
      if (this.dashTimer <= 0) this.guardAge = 0;
      // Mergan sirpanish oxirida barabanga o'q soladi
      if (this.dashTimer <= 0 && this.gunner) this.slideReload();
      if (this.mage) return;
      const sp = this.iai
        ? this.iai.speed
        : this.hunter
          ? JUMP_SPEED
          : this.gunner
            ? SLIDE_SPEED
            : this.paladin
              ? HAMLA_SPEED
              : DASH_SPEED;
      // IAI masofasi aniq: oxirgi kadrda faqat qolgan vaqtcha siljiydi (oddiy dash o'zgarmagan)
      const adv = this.iai ? Math.min(dt, left) : dt;
      this.x += this.dashX * sp * adv;
      this.y += this.dashY * sp * adv;
      this.clamp(this);
      if (this.dashTimer <= 0 && this.iai) this.endIai();
      return;
    }
    if (this.iaiLock > 0) {
      // IAI dan keyin: kesish pozasida qotib turadi (himoya dumi ichida)
      this.iaiLock -= dt;
      this.clamp(this);
      return;
    }

    // Ovchi: Shift'ni qisqa bosish — orqaga sakrash, bosib turish — tuzoq;
    // Mergan: qisqa bosish — sirpanish, bosib turish — tutun bombasi
    // Paladin: qisqa bosish — MUQADDAS HAMLA, bosib turish — QASAM
    if ((this.hunter || this.gunner || this.paladin) && this.updateShift(dt, wantDash, input, x, y))
      return;

    if (
      wantDash &&
      !this.hunter &&
      !this.gunner &&
      !this.paladin &&
      this.dashCharges > 0 &&
      this.hurtTimer <= 0 &&
      this.snare <= 0
    ) {
      let dx = x,
        dy = y;
      if (!dx && !dy) {
        dx = this.fx;
        dy = this.fy;
      }
      const l = Math.hypot(dx, dy) || 1;
      this.dashX = dx / l;
      this.dashY = dy / l;
      this.dashTimer = DASH_TIME;
      this.dashCharges--;
      this.dashCooldown = this.dashCd;
      this.attackTimer = 0;
      this.charge = 0;
      // Samuray: mukammal chetlanish oynasi shu lahzadan; dash parry oynasini yopadi
      if (this.samurai) {
        this.dashAge = 0;
        this.parryT = 0;
        this.iaiPose = this.parryPose = 0;
      }
      sfx.dash();
      if (this.tone) sfx.skinTone(this.tone, 0.6);
      if (this.mage) {
        // teleport: bir zumda sakrab o'tadi, qisqa vaqt ko'rinmaydi va daxlsiz
        this.teleportFrom = { x: this.x, y: this.y };
        this.x += this.dashX * TELEPORT_DIST;
        this.y += this.dashY * TELEPORT_DIST;
        this.dashTimer = TELEPORT_TIME;
        this.clamp(this);
        this.anim.set("idle");
        return;
      }
      this.anim.set("walk");
      return;
    }

    // Mergan faqat barabanda o'q bo'lsa va qayta o'qlamayotganda otadi
    const loaded = !this.gunner || (this.ammo > 0 && !this.reloading);
    // bosib turish -> qo'yib yuborilganda aylana zarba
    if (input.attackHeld()) {
      if (this.spinCooldown <= 0 && this.hurtTimer <= 0 && !this.spinning && loaded) {
        const before = this.charge;
        this.charge += dt;
        if (this.samurai) {
          // IAI zaryadi: o'sib boruvchi ohang, to'lganda — yaltirash (Game)
          if (before < IAI_MIN && this.charge >= IAI_MIN) sfx.iaiCharge(this.chargeTime - IAI_MIN);
          if (before < this.chargeTime && this.charge >= this.chargeTime) this.chargeFull = true;
        }
      }
    } else if (this.samurai) {
      // IAI: yetarlicha bosib turilgan bo'lsa — qo'yib yuborilganda sirpanib kesib o'tadi
      if (this.charge >= IAI_MIN && this.spinCooldown <= 0 && this.snare <= 0) {
        this.startIai(x, y);
        return;
      }
      this.charge = 0;
    } else {
      if (this.charged && this.spinCooldown <= 0) {
        this.spinTimer = this.gunner ? FAN_TIME : SPIN_TIME;
        this.spinCooldown = this.spinCd;
        this.attackTimer = 0;
        this.hitSet.clear();
        if (this.gunner) sfx.cylinder();
        else if (this.paladin) {
          // OSMON HUKMI: qilich yerga tushdi — to'lqin va gangitish (Game)
          sfx.judgment();
          this.judged = true;
          this.slamT = 0;
        } else sfx.spin();
        if (this.tone) sfx.skinTone(this.tone, 1.3);
        this.anim.set("attack", true);
        // Ovchi: kuchaytirilgan o'q — hamma dushmanni teshib o'tadi, 2x zarar
        if (this.hunter) this.shoot(true);
        // Mergan: barabanni bo'shatish — qolgan hamma o'q 0.4s ichida yelpig'ich bo'lib uchadi
        if (this.gunner) this.startFan();
      }
      this.charge = 0;
    }

    if (wantAttack && this.paladin) {
      // SHANG: avval qilichni boshi uzra ko'taradi (tayyorgarlik), zarba updateSlam'da tushadi
      if (this.cooldown <= 0 && this.hurtTimer <= 0 && !this.spinning && !this.slamming) {
        this.slamT = SHANG_WINDUP;
        this.cooldown = Math.max(this.attackCd, SHANG_WINDUP + SHANG_TIME);
        this.hitSet.clear();
        sfx.heave();
        this.anim.set("attack", true);
      }
    } else if (
      wantAttack &&
      this.cooldown <= 0 &&
      this.hurtTimer <= 0 &&
      !this.spinning &&
      loaded
    ) {
      this.attackTimer = this.attackTime;
      this.cooldown = this.attackCd;
      this.hitSet.clear();
      if (this.samurai) this.startSlash();
      else if (this.gunner) sfx.gunshot();
      else sfx.attack();
      if (this.tone) sfx.skinTone(this.tone);
      this.anim.set("attack", true);
      if (this.ranged) this.shoot(false);
    }
    // bo'sh barabanda tepki bosilsa — qayta o'qlash
    if (wantAttack && this.gunner && this.ammo <= 0 && !this.reloading) this.startReload();

    // Ovchi kuchli o'qdan keyin joyida turmaydi — o'q uchib ketadi
    const busy =
      this.attackTimer > 0 ||
      this.hurtTimer > 0 ||
      this.slamT > 0 ||
      (this.spinning && !this.hunter);
    if (!busy) {
      if ((x || y) && this.snare <= 0) {
        const l = Math.max(1, Math.hypot(x, y));
        // Samuray IAI zaryadida sekin sirpanib yuradi (qo'l dastada); yursa kesish pozasi tugaydi
        const stance = this.samurai && this.charge >= IAI_MIN ? IAI_MOVE : 1;
        if (this.samurai) this.iaiPose = this.parryPose = 0;
        const speed =
          this.speed *
          stance *
          (this.chill > 0 ? CHILL_SPEED : 1) *
          (this.boost > 0 ? BOOST_SPEED : 1);
        this.x += (x / l) * speed * dt;
        this.y += (y / l) * speed * dt;
        if (Math.abs(x) >= Math.abs(y)) {
          this.fx = Math.sign(x);
          this.fy = 0;
        } else {
          this.fx = 0;
          this.fy = Math.sign(y);
        }
        this.anim.set("walk");
      } else this.anim.set("idle");
    }
    this.clamp(this);
  }

  /** Samurayning har kadrdagi taymerlari: chetlanish oynasi, parry, kombo va pozalar. */
  private tickSamurai(dt: number) {
    this.perfectCooldown -= dt;
    this.parryCooldown -= dt;
    if (this.dashAge >= 0) {
      this.dashAge += dt;
      if (this.dashAge > 1) this.dashAge = -1;
    }
    if (this.comboT > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0) this.comboStep = 0;
    }
    if (this.parryT > 0) {
      this.parryT -= dt;
      // oyna bo'sh ketdi — keyingi parry biroz kechikadi (hujumni bosib parry qilib bo'lmaydi)
      if (this.parryT <= 0 && !this.parryHit) this.parryCooldown = PARRY_WHIFF_CD;
    }
    if (this.iaiPose > 0) this.iaiPose -= dt;
    if (this.parryPose > 0) this.parryPose -= dt;
  }

  /** Katana zarbasi: kombo sanog'i (3-zarba — keng yoy) va parry oynasi. */
  private startSlash() {
    this.comboStep = this.comboT > 0 ? (this.comboStep + 1) % 3 : 0;
    this.comboT = COMBO_WINDOW;
    this.iaiPose = this.parryPose = 0;
    if (this.parryCooldown <= 0) {
      this.parryT = PARRY_WINDOW;
      this.parryHit = false;
    }
    sfx.katana(this.comboStep);
  }

  /**
   * IAI: yurish yo'nalishi (bo'lmasa — qarab turgan tomon) bo'ylab sirpanadi. Zaryad ulushi k:
   * masofa IAI_MIN_DIST..IAI_MAX_DIST (+ UZUN IAI), zarar 1x..strongMul. Devordan o'tmaydi (clamp).
   */
  private startIai(ax: number, ay: number) {
    const k = Math.max(
      0,
      Math.min(1, (this.charge - IAI_MIN) / Math.max(0.01, this.chargeTime - IAI_MIN)),
    );
    let dx = ax,
      dy = ay;
    if (!dx && !dy) {
      dx = this.fx;
      dy = this.fy;
    }
    const l = Math.hypot(dx, dy) || 1;
    this.dashX = dx / l;
    this.dashY = dy / l;
    if (Math.abs(dx) >= Math.abs(dy)) {
      this.fx = Math.sign(dx);
      this.fy = 0;
    } else {
      this.fx = 0;
      this.fy = Math.sign(dy);
    }
    const dist = IAI_MIN_DIST + (IAI_MAX_DIST - IAI_MIN_DIST) * k + this.iaiRange;
    this.iai = {
      speed: dist / IAI_TIME,
      mul: 1 + (this.strongMul - 1) * k,
      k,
      crit: this.critReady,
      from: { x: this.x, y: this.y },
    };
    this.critReady = false;
    this.dashTimer = IAI_TIME;
    // IAI — hujum: mukammal chetlanish hisoblanmaydi
    this.dashAge = -1;
    this.spinCooldown = this.spinCd;
    this.attackTimer = 0;
    this.parryT = 0;
    this.charge = 0;
    this.comboStep = 0;
    this.comboT = 0;
    this.hitSet.clear();
    this.iaiStarted = true;
    sfx.iai();
    if (this.tone) sfx.skinTone(this.tone, 1.3);
    this.anim.set("attack", true);
  }

  /** Sirpanish tugadi: Game belgilanganlarni IAI_DELAY dan keyin kesadi; qisqa qotish. */
  private endIai() {
    const d = this.iai!;
    this.iaiDone = { mul: d.mul, crit: d.crit };
    this.iai = null;
    this.iaiLock = IAI_LOCK;
    this.iaiPose = IAI_DELAY + 0.12;
  }

  /** Sehrgar shari yoki Ovchi o'qi; Uch shar/Uch o'q bilan yelpig'ich bo'lib uchadi. */
  private shoot(power: boolean) {
    const base = Math.atan2(this.fy, this.fx);
    if (this.gunner) return this.fire(base);
    const spread = this.hunter ? 0.22 : 0.28;
    for (let i = 0; i < this.multishot; i++) {
      const a = base + (i - (this.multishot - 1) / 2) * spread;
      const speed = this.boltSpeed * (power ? 1.25 : 1);
      this.bolts.push({
        x: this.x + this.fx * 8,
        y: this.y + this.fy * 8 - 2,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        size: this.boltSize + (power ? 2 : 0),
        // kuchaytirilgan o'q hamma dushmandan o'tadi
        left: power ? 99 : 1 + this.pierce,
        hit: [],
        ...(this.hunter
          ? { arrow: true, power: power ? this.strongMul : 1, poison: this.poisonTip }
          : {}),
      });
    }
  }

  /** Mergan o'qi: qarab turgan tomonga (yelpig'ichda — a burchakka) tez uchadi; barabandan 1 o'q. */
  private fire(a: number, fan = false) {
    this.bolts.push({
      x: this.x + Math.cos(a) * 9,
      y: this.y + Math.sin(a) * 9 - 2,
      vx: Math.cos(a) * this.boltSpeed,
      vy: Math.sin(a) * this.boltSpeed,
      size: this.boltSize,
      left: fan && this.fanPierce ? 99 : 1 + this.pierce,
      hit: [],
      bullet: true,
      range: this.range,
      bounce: this.bounce,
      load: this.loadId,
    });
    this.ammo--;
    // baraban bo'shadi — o'zi qayta o'qlanadi (yelpig'ich tugagach)
    if (this.ammo <= 0 && this.fanLeft <= 0) this.startReload();
  }

  /** Barabanni bo'shatish: barabandagi hamma o'q navbat bilan otiladi (updateGun). */
  private startFan() {
    this.fanTotal = this.fanLeft = this.ammo;
    this.fanT = 0;
  }

  /** Qayta o'qlash: baraban aylanadi, RELOAD_TIME dan keyin to'ladi. */
  startReload() {
    if (!this.gunner || this.reloading || this.ammo >= this.ammoMax || this.fanLeft > 0) return;
    this.reloadT = this.reloadTime;
    this.charge = 0;
    sfx.cylinder();
  }

  /** Merganning har kadrdagi qurol holati: qayta o'qlash, R tugmasi va yelpig'ich o'qlari. */
  private updateGun(dt: number, input: PlayerInput) {
    if (input.consumeReload?.() && !this.dead) this.startReload();
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) {
        this.reloadT = 0;
        this.ammo = this.ammoMax;
        this.loadId++;
        sfx.reload();
      }
    }
    if (this.fanLeft <= 0) return;
    this.fanT += dt;
    const n = this.fanTotal;
    const gap = FAN_TIME / n;
    // k-o'q k*gap da: yelpig'ich bir chetidan ikkinchisiga
    while (this.fanLeft > 0 && this.fanT >= (n - this.fanLeft) * gap) {
      const k = n - this.fanLeft;
      const spread = n > 1 ? (k / (n - 1) - 0.5) * 2 * FAN_SPREAD : 0;
      this.fanLeft--;
      this.fire(Math.atan2(this.fy, this.fx) + spread, true);
      sfx.gunshot();
      this.anim.set("attack", true);
      this.anim.frame = 1;
    }
    if (this.fanLeft <= 0) this.startReload();
  }

  /** Sirpanish tugadi: barabanga 2 ta o'q (qayta o'qlash ketayotgan bo'lsa — to'xtaydi, otish mumkin). */
  private slideReload() {
    this.ammo = Math.min(this.ammoMax, this.ammo + SLIDE_AMMO);
    this.reloadT = 0;
  }

  /** Oldinga qisqa sirpanish (dashdek daxlsiz, oxirida himoya dumi); yo'nalish — yurish yoki qarab turgan tomon. */
  private slide(ax: number, ay: number) {
    if (this.dashCharges <= 0 || this.hurtTimer > 0 || this.snare > 0) return false;
    let dx = ax,
      dy = ay;
    if (!dx && !dy) {
      dx = this.fx;
      dy = this.fy;
    }
    const l = Math.hypot(dx, dy) || 1;
    this.dashX = dx / l;
    this.dashY = dy / l;
    this.dashTimer = SLIDE_TIME;
    this.dashCharges--;
    this.dashCooldown = this.dashCd;
    this.attackTimer = 0;
    this.charge = 0;
    // sirpanish yelpig'ichni to'xtatadi: otilmagan o'qlar barabanda qoladi
    this.fanLeft = 0;
    this.spinTimer = 0;
    sfx.dash();
    this.anim.set("walk");
    return true;
  }

  /** Tutun bombasi: oyog'i ostida tutun, Mergan tutun ichida SMOKE_HIDE soniya ko'rinmaydi. */
  private throwSmoke() {
    if (this.smokeCooldown > 0) {
      this.smokeDenied = true;
      return;
    }
    this.smokes.push({ x: this.x, y: this.y });
    this.smokeCooldown = this.smokeCd;
    this.hideT = SMOKE_HIDE;
    sfx.smoke();
  }

  /**
   * Ovchining Shift tugmasi: qisqa bosilsa (qo'yib yuborilganda) orqaga sakraydi,
   * TRAP_HOLD dan ko'p bosib turilsa oyog'i ostiga tuzoq qo'yadi (6s qayta tiklanadi).
   * Merganda xuddi shunday: qisqa bosish — oldinga sirpanish, bosib turish — tutun bombasi.
   * true — shu kadrda harakat tugadi (sakrash/sirpanish boshlandi).
   */
  private updateShift(dt: number, pressed: boolean, input: PlayerInput, ax = 0, ay = 0) {
    const held = input.dashHeld?.() ?? false;
    if (pressed && this.shiftHold === -1) this.shiftHold = 0;
    if (this.shiftHold === -2) {
      if (!held) this.shiftHold = -1;
      return false;
    }
    if (this.shiftHold < 0) return false;
    if (held) {
      this.shiftHold += dt;
      if (this.shiftHold >= TRAP_HOLD) {
        this.shiftHold = -2;
        if (this.gunner) this.throwSmoke();
        else if (this.paladin) this.swearVow();
        else if (this.trapCooldown <= 0) {
          this.traps.push({ x: this.x, y: this.y + 4 });
          this.trapCooldown = this.trapCd;
          sfx.chestHit();
        } else this.trapDenied = true;
      }
      return false;
    }
    // qo'yib yuborildi — orqaga sakrash (Merganda — sirpanish)
    this.shiftHold = -1;
    if (this.paladin) return this.hamla(ax, ay);
    return this.gunner ? this.slide(ax, ay) : this.backJump();
  }

  /**
   * Paladin kadrlari va SHANG: tayyorgarlik (0 — ko'tarish, 1 — boshi uzra porlaydi) tugaganda zarba
   * tushadi (2 — urish, 3 — qaytarish). OSMON HUKMI zaryadida qilich osmonga ko'tarilgan (1-kadr).
   */
  private updateSlam(dt: number) {
    if (this.slamT > 0) {
      this.slamT -= dt;
      if (this.slamT <= 0) {
        this.slamT = 0;
        this.attackTimer = SHANG_TIME;
        this.hitSet.clear();
        this.slammed = true;
        sfx.shang();
        if (this.shockwave) this.launchWave();
      }
    }
    if (this.anim.state !== "attack") return;
    const a = this.anim;
    if (this.slamT > 0) a.frame = this.slamT > SHANG_WINDUP / 2 ? 0 : 1;
    else if (this.attackTimer > 0 || this.spinning)
      a.frame =
        (this.spinning ? this.spinTimer / SPIN_TIME : this.attackTimer / SHANG_TIME) > 0.45 ? 2 : 3;
    else {
      a.frame = 3;
      a.done = true;
    }
  }

  /** ZARB TO'LQINI: qilich tushgan joydan oldinga uchadi, yo'lidagi hamma dushmanga zarar beradi. */
  private launchWave() {
    const off = this.reach * 2;
    this.bolts.push({
      x: this.x + this.fx * off,
      y: this.y + this.fy * off + 2,
      vx: this.fx * WAVE_SPEED,
      vy: this.fy * WAVE_SPEED,
      size: WAVE_SIZE,
      left: 99,
      hit: [],
      wave: true,
      range: WAVE_RANGE,
    });
  }

  /** MUQADDAS HAMLA: og'ir oldinga yugurish (dashdek daxlsiz, oxirida himoya dumi). */
  private hamla(ax: number, ay: number) {
    if (this.dashCharges <= 0 || this.hurtTimer > 0 || this.snare > 0 || this.slamT > 0)
      return false;
    let dx = ax,
      dy = ay;
    if (!dx && !dy) {
      dx = this.fx;
      dy = this.fy;
    }
    const l = Math.hypot(dx, dy) || 1;
    this.dashX = dx / l;
    this.dashY = dy / l;
    this.dashTimer = HAMLA_TIME;
    this.dashCharges--;
    this.dashCooldown = this.dashCd;
    this.attackTimer = 0;
    this.charge = 0;
    this.rammed.clear();
    sfx.dash();
    this.anim.set("walk");
    return true;
  }

  /** QASAM: 4s davomida atrofdagilar Paladinni nishonga oladi, zarar 50% kam (10s qayta tiklanadi). */
  private swearVow() {
    if (this.vowCooldown > 0) {
      this.vowDenied = true;
      return;
    }
    this.vowT = VOW_TIME;
    this.vowCooldown = this.vowCd;
    this.halfDmg = 0;
    this.vowed = true;
    sfx.vow();
  }

  private backJump() {
    if (this.dashCharges <= 0 || this.hurtTimer > 0 || this.snare > 0) return false;
    let dx = -this.fx,
      dy = -this.fy;
    const t = this.threat;
    if (t) {
      const d = Math.hypot(this.x - t.x, this.y - t.y);
      if (d > 0 && d < JUMP_THREAT) {
        dx = (this.x - t.x) / d;
        dy = (this.y - t.y) / d;
      }
    }
    const l = Math.hypot(dx, dy) || 1;
    this.dashX = dx / l;
    this.dashY = dy / l;
    this.dashTimer = JUMP_TIME;
    this.dashCharges--;
    this.dashCooldown = this.dashCd;
    this.attackTimer = 0;
    this.charge = 0;
    sfx.dash();
    // sakrayotganda ham nishonga qarab turadi (yuz burilmaydi)
    this.anim.set("walk");
    return true;
  }

  /** Qarab turgan tomonda xona devori yaqin (faqat xonada; ochiq olamda devor plitkalari boshqa). */
  private nearWall() {
    if (this.clamp !== clampToRoom || !this.fx) return false;
    const room = 40;
    return this.fx > 0 ? this.x > ROOM.w - room : this.x < room;
  }

  render(ctx: CanvasRenderingContext2D) {
    // teleport paytida sehrgar ko'rinmaydi
    if (this.dashing && this.mage) return;
    if (this.dashing) ctx.globalAlpha = 0.7;
    // himoya dumi: biroz shaffof
    else if (this.guarded) ctx.globalAlpha = 0.6;
    // tutunda yashiringan Mergan: zo'rg'a ko'rinadi
    else if (this.hidden) ctx.globalAlpha = 0.35;
    // Paladin OSMON HUKMI zaryadida qilichni osmonga ko'tarib turadi (porlagan hujum kadri)
    const skyward =
      this.paladin && this.charge > 0.25 && !this.slamming && !this.spinning && !this.dashing;
    let frame = skyward ? 1 : this.anim.frame;
    // xona devori yonida SHANG qilichi tik tushib yerga sanchiladi (4-5 kadr) — ekrandan chiqmaydi
    if (this.paladin && !skyward && this.anim.state === "attack" && frame >= 2 && this.nearWall())
      frame += 2;
    let state = skyward ? "attack" : this.anim.state;
    if (this.samurai) {
      [state, frame] = this.samuraiFrame();
      if (this.iai) this.renderAfterimages(ctx, state, frame);
    }
    // vizual qatlam (heroAnim.ts): oraliq kadr, burilish va zarba siqilishi — faqat ko'rinish
    const plain = state === this.anim.state && frame === this.anim.frame;
    const sub = plain && !this.samurai ? subFrame(this.anim) : 0;
    const [sx, sy] = plain ? heroScale(this.vis, this.anim) : [1, 1];
    const scaled = sx !== 1 || sy !== 1;
    if (scaled) {
      // oyoq nuqtasiga nisbatan — sprayt yerdan uzilmaydi
      const foot = this.y + 13;
      ctx.save();
      ctx.translate(this.x, foot);
      ctx.scale(sx, sy);
      ctx.translate(-this.x, -foot);
    }
    renderSprite(
      ctx,
      this.hero,
      state,
      frame,
      this.x,
      this.y,
      // yiqilgach (o'limning 2-3-kadri) oq miltillash yo'q — piksellar o'z rangida tarqaladi
      (isFlashing(this) && !(this.dead && frame > 0)) || this.anim.state === "hurt",
      this.fx < 0,
      this.fy < 0,
      this.skin,
      sub,
    );
    if (scaled) ctx.restore();
    ctx.globalAlpha = 1;
  }

  /**
   * Samuray kadri: Animator holati ustiga maxsus pozalar — IAI zaryadi, kesishi, qinga qaytarish
   * (afsonaviy skin), dash, parry va komboning keng 3-zarbasi. Faqat ko'rinish.
   */
  samuraiFrame(): [AnimState, number] {
    const F = SAMURAI_FRAME;
    const a = this.anim;
    if (this.dead || a.state === "hurt") return [a.state, a.frame];
    if (this.iai) return ["attack", F.iai];
    if (this.dashing) return ["attack", F.dash];
    if (this.iaiPose > 0)
      return ["attack", this.flair === "moon" && this.iaiPose < IAI_DELAY ? F.sheathe : F.iai];
    if (this.parryPose > 0) return ["attack", F.parry];
    if (this.attackTimer > 0) {
      const k = Math.min(2, Math.floor((1 - this.attackTimer / this.attackTime) * 3));
      return ["attack", (this.comboStep === 2 ? F.wide : 0) + k];
    }
    if (this.charge >= IAI_MIN) return ["attack", F.charge];
    // hujum tugagach Animator "attack"da qolsa (yurmayotgan bo'lsa) — oxirgi kadr
    if (a.state === "attack") return ["attack", Math.min(2, a.frame)];
    return [a.state, a.frame];
  }

  /** IAI: orqada qoladigan oqish siluetlar (effektlar kamaytirilganda — bitta). */
  private renderAfterimages(ctx: CanvasRenderingContext2D, state: AnimState, frame: number) {
    const n = currentSettings().reduceFx ? 1 : 3;
    const alpha = ctx.globalAlpha;
    for (let i = n; i >= 1; i--) {
      ctx.globalAlpha = 0.34 - i * 0.08;
      renderSprite(
        ctx,
        this.hero,
        state,
        frame,
        this.x - this.dashX * i * 13,
        this.y - this.dashY * i * 13,
        true,
        this.fx < 0,
        this.fy < 0,
        this.skin,
      );
    }
    ctx.globalAlpha = alpha;
  }
}
