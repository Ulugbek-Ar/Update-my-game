import { Animator, Body, updatePhysics, isFlashing, clampToRoom, ROOM } from "./animation";
import type { Target } from "./player";
import { renderSprite, spriteSize, type SpriteKind } from "./sprites";
import { FLYING_KINDS, mobScale, renderSpawnSmoke, riseShare } from "./mobAnim";
import { currentSettings } from "./settings";
import { DANGER } from "./danger";
import { withAlpha } from "./hero";

export type EnemyKind =
  | "blob"
  | "wisp"
  | "rammer"
  | "archer"
  | "shield"
  | "frost"
  | "golem"
  | "iceblob"
  | "wolf"
  | "spider"
  | "shroom"
  | "treant"
  | "owl"
  | "imp"
  | "ninja"
  | "tengu"
  | "kitsune";

const SPAWN_TIME = 1;
export const ARCHER_RELOAD = 1.5;
/** Kamonchi tortish vaqti: o'q chiqishidan oldingi to'xtash */
export const ARCHER_DRAW = 0.55;
/** Tortishning boshida "o'qni qo'yish" kadri (attack 0), qolgani — to'liq tortish (attack 1) */
export const ARCHER_NOCK = 0.2;
/** O'q chiqqach "qo'yib yuborish" kadri (attack 2) shuncha ko'rinadi */
export const ARCHER_RELEASE = 0.2;
/** O'q kamondan chiqadigan nuqta (sprite markaziga nisbatan, o'yinchi tomonga) */
export const BOW_OFFSET_X = 11;
export const BOW_OFFSET_Y = -2;
const ARROW_SPEED = 110;
/** Qalqonli skelet: qalqon burilish tezligi (rad/s, ~90°/s) */
export const SHIELD_TURN = Math.PI / 2;
/** Qalqon oldidan kelgan zarbani to'sadi: shu burchak ichida (±60°) */
export const SHIELD_ARC = Math.PI / 3;
/** Qalqon bilan itarish: tayyorgarlik, masofa, qayta tiklanish */
export const BASH_WINDUP = 0.5;
export const BASH_RANGE = 24;
export const BASH_CD = 1.6;
/** Sekin yuradi (skelet jangchi 160 bilan yuguradi) */
const SHIELD_SPEED = 26;
/** Muz ruhi: shu masofaga yaqinlashib 1s tayyorlanadi, so'ng oldinga konus shaklida sovuq nafas */
export const FROST_NEAR = 34;
export const FROST_WINDUP = 1;
export const FROST_RANGE = 46;
/** Konusning yarim burchagi (±35°) */
export const FROST_ARC = 0.6;
export const FROST_CD = 2.2;
/** Nafas tekkan o'yinchi shuncha soniya sekin yuradi */
export const FROST_CHILL = 1.5;
const FROST_SPEED = 42;
/** Nafas ko'rinib turadigan vaqt */
const BREATH_SHOW = 0.35;
/** Qor odam (kind "golem"): har 3s da yerga uradi (0.8s qizil doira ogohlantiradi) */
export const STOMP_EVERY = 3;
export const STOMP_WINDUP = 0.8;
export const STOMP_RADIUS = 26;
const GOLEM_SPEED = 16;
/** Qor odam o'lganda shuncha Muz slime'ga bo'linadi */
export const GOLEM_SPLIT = 2;
/** Muz slime tegsa o'yinchi shuncha soniya sekin yuradi */
export const ICEBLOB_CHILL = 0.8;
/** Qor bo'risi: aylanib yuradi, cho'kib (ogohlantirish) sakraydi, so'ng charchab qoladi */
export const WOLF_CIRCLE = 1.6;
export const WOLF_CROUCH = 0.4;
export const WOLF_LEAP_TIME = 0.35;
export const WOLF_LEAP_SPEED = 190;
export const WOLF_TIRED = 1;
/** O'yinchidan shu masofada aylanadi */
export const WOLF_RADIUS = 55;
const WOLF_SPEED = 70;
export type WolfPhase = "circle" | "crouch" | "leap" | "tired";

// ---- 3-dunyo: Zulmat o'rmoni ----
/** O'rmon o'rgimchagi: devor bo'ylab (devordan shuncha ichkarida) tez yuradi */
export const SPIDER_INSET = 7;
const SPIDER_SPEED = 95;
/** To'r otish: tayyorgarlik, qayta tiklanish, masofa */
export const SPIDER_WINDUP = 0.35;
export const SPIDER_WEB_CD = 2.6;
const SPIDER_RANGE = 170;
/** To'r o'yinchi yo'liga — qarab turgan tomonida shuncha oldinga tushadi */
export const WEB_LEAD = 26;
export const WEB_SPEED = 120;
/** Zaharli qo'ziqorin: yaqinlashsa bulut chiqaradi */
export const SHROOM_NEAR = 36;
export const SHROOM_WINDUP = 0.45;
export const SHROOM_CD = 4;
/** Daraxt odam: uzoqdan yerdan ildiz chiqaradi (oldin yoriq chizig'i ogohlantiradi) */
export const TREANT_RANGE = 140;
export const ROOT_WARN = 1;
export const ROOT_RADIUS = 11;
/** Ildiz ushlasa o'yinchi shuncha yurolmaydi */
export const ROOT_SNARE = 0.8;
export const TREANT_CD = 3.2;
const ROOT_SHOW = 0.5;
const TREANT_SPEED = 14;
/** Tungi boyo'g'li: tepada uchadi, soya oldindan ko'rinadi, so'ng sho'ng'iydi */
export const OWL_ALT = 40;
/** Shundan pastda — yerda, urish mumkin */
export const OWL_LOW = 8;
export const OWL_SOAR = 2.2;
export const OWL_MARK = 0.8;
export const OWL_DIVE = 0.25;
export const OWL_REST = 1.3;
export const OWL_RISE = 0.4;
export const OWL_HIT = 12;
const OWL_SPEED = 60;
export type OwlPhase = "soar" | "mark" | "dive" | "rest" | "rise";
/** Olov imp (Iblis chaqiradi): o'yinchi atrofida aylanib uchadi, yaltirab olov shari otadi */
export const IMP_ORBIT = 58;
export const IMP_CD = 2.6;
export const IMP_WINDUP = 0.6;
export const IMP_SHOT_SPEED = 90;
const IMP_SPEED = 70;

// ---- 4-dunyo: Sakura bog'i ----
/**
 * Ninja-soya: yaqinlashadi, tutunga aylanib o'yinchining orqasida paydo bo'ladi va qisqa
 * ogohlantirishdan keyin kesadi (zarba vaqti aniq — parry uchun qulay). Zarbadan keyin ochiq qoladi.
 */
export const NINJA_STALK = 2.2;
export const NINJA_VANISH = 0.35;
export const NINJA_WARN = 0.5;
export const NINJA_STRIKE = 0.18;
export const NINJA_REST = 1;
/** O'yinchi orqasida shu masofada paydo bo'ladi; zarba shu masofagacha yetadi */
export const NINJA_BEHIND = 20;
export const NINJA_REACH = 24;
const NINJA_SPEED = 46;
export type NinjaPhase = "stalk" | "vanish" | "warn" | "strike" | "rest";
/**
 * Tengu-qush: tepada keng aylanadi, soyasi tushgan joyga sho'ng'iydi — ketma-ket ikki marta
 * (ikkinchisining ogohlantirishi qisqaroq), so'ng yerda dam oladi.
 */
export const TENGU_ALT = 40;
export const TENGU_SOAR = 2.4;
export const TENGU_MARK = 0.7;
export const TENGU_MARK2 = 0.45;
export const TENGU_DIVE = 0.22;
export const TENGU_BOUNCE = 0.3;
export const TENGU_REST = 1.2;
export const TENGU_RISE = 0.4;
export const TENGU_HIT = 13;
/** Bir hujumda nechta sho'ng'ish */
export const TENGU_DIVES = 2;
const TENGU_SPEED = 70;
export type TenguPhase = "soar" | "mark" | "dive" | "bounce" | "rest" | "rise";
/** Kitsune-olov: uzoqda turadi, dumlarida olov yig'ib yelpig'ich qilib uchta ko'k shar otadi */
export const KITSUNE_CD = 2.8;
export const KITSUNE_WINDUP = 0.7;
export const KITSUNE_SHOTS = 3;
/** Sharlar orasidagi burchak (rad) */
export const KITSUNE_SPREAD = 0.3;
export const KITSUNE_SHOT_SPEED = 95;
export const KITSUNE_NEAR = 80;
export const KITSUNE_FAR = 125;
const KITSUNE_SPEED = 44;
/** Otgandan keyin "og'iz ochiq" kadri shuncha ko'rinadi */
const KITSUNE_RELEASE = 0.25;
/** Game ovoz va uchqun beradigan voqea (bir kadr) */
export type EnemyCue = "vanish" | "appear" | "slash" | "dive" | "foxfire";

/** O'rgimchak yuradigan devor bo'yi to'rtburchagi */
function track() {
  const l = ROOM.wall + SPIDER_INSET,
    t = ROOM.wall + SPIDER_INSET;
  const r = ROOM.w - l,
    b = ROOM.h - t;
  return { l, t, r, b, w: r - l, h: b - t, len: 2 * (r - l + b - t) };
}

/** Devor bo'yidagi s masofadagi nuqta (yuqori chap burchakdan soat mili bo'ylab). */
export function trackPoint(s: number): [number, number] {
  const k = track();
  let d = ((s % k.len) + k.len) % k.len;
  if (d < k.w) return [k.l + d, k.t];
  d -= k.w;
  if (d < k.h) return [k.r, k.t + d];
  d -= k.h;
  if (d < k.w) return [k.r - d, k.b];
  d -= k.w;
  return [k.l, k.b - d];
}

/** (x, y) ga eng yaqin devor bo'yi nuqtasining s qiymati. */
export function trackParam(x: number, y: number) {
  const k = track();
  const cx = Math.max(k.l, Math.min(k.r, x)),
    cy = Math.max(k.t, Math.min(k.b, y));
  const edges = [
    { d: Math.abs(y - k.t), s: cx - k.l },
    { d: Math.abs(x - k.r), s: k.w + (cy - k.t) },
    { d: Math.abs(y - k.b), s: k.w + k.h + (k.r - cx) },
    { d: Math.abs(x - k.l), s: 2 * k.w + k.h + (k.b - cy) },
  ];
  return edges.reduce((a, b) => (b.d < a.d ? b : a)).s;
}

/** O'rgimchak to'ri: uchib boradi (tx, ty) ga tushadi */
export interface WebShot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  tx: number;
  ty: number;
}

/** Har dushman turining joni */
export const ENEMY_HP: Record<EnemyKind, number> = {
  blob: 3,
  wisp: 2,
  rammer: 4,
  archer: 3,
  shield: 5,
  frost: 3,
  golem: 7,
  iceblob: 2,
  wolf: 3,
  spider: 2,
  shroom: 3,
  treant: 8,
  owl: 2,
  imp: 2,
  ninja: 3,
  tengu: 3,
  kitsune: 3,
};

/** Dushman turi -> sprite turi */
const SPRITE: Record<EnemyKind, SpriteKind> = {
  blob: "slime",
  wisp: "bat",
  rammer: "skeleton",
  archer: "archer",
  shield: "shield",
  frost: "frost",
  golem: "golem",
  iceblob: "iceblob",
  wolf: "wolf",
  spider: "spider",
  shroom: "shroom",
  treant: "treant",
  owl: "owl",
  imp: "imp",
  ninja: "ninja",
  tengu: "tengu",
  kitsune: "kitsune",
};

export interface Arrow {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/**
 * blob   – sekin, sakrab-sakrab o'yinchini quvadi
 * wisp   – tez, to'lqinsimon (sinus) uchib aylanadi
 * rammer – to'xtab nishon oladi, so'ng tez yugurib uriladi
 * archer – masofani saqlaydi va har 1.5s da o'q otadi
 * shield – sekin yuradi, qalqon bilan oldidan zarbani to'sadi, yaqinda qalqon bilan itaradi
 * iceblob – muz slime: sakrab quvadi, tegsa sekinlashtiradi
 * wolf   – qor bo'risi: aylanib yuradi, cho'kib sakraydi, sakrashdan keyin charchaydi
 * spider – o'rmon o'rgimchagi: devor bo'ylab yuradi, o'yinchi yo'liga to'r otadi
 * shroom – zaharli qo'ziqorin: harakatsiz, yaqinlashsa zaharli bulut chiqaradi
 * treant – daraxt odam: sekin, uzoqdan yerdan ildiz chiqarib ushlaydi
 * owl    – tungi boyo'g'li: tepadan sho'ng'iydi, soyasi oldindan ko'rinadi
 * imp    – olov imp (Iblis chaqiradi): aylanib uchadi, yaltirab (ogohlantirish) olov shari otadi
 * ninja  – ninja-soya: tutunga aylanib o'yinchi orqasida paydo bo'ladi, ogohlantirib kesadi
 * tengu  – tengu-qush: tepada aylanadi, soyasi tushgan joyga ikki marta sho'ng'iydi
 * kitsune – kitsune-olov: uzoqdan yelpig'ich qilib uchta ko'k olov shari otadi
 */
export class Enemy implements Body {
  vx = 0;
  vy = 0;
  flash = 0;
  hp: number;
  maxHp: number;
  size: number;
  t = Math.random() * 3;
  aiTimer = 1;
  dashX = 0;
  dashY = 0;
  dashing = false;
  removed = false;
  /** Paydo bo'lish vaqti: bu paytda zarar bermaydi va olmaydi */
  spawn = 0;
  spawnMax = SPAWN_TIME;
  /** To'lqin oshgani sari biroz tezlashadi */
  speedMul = 1;
  /** Muz qalqoni: shuncha soniya yarim tezlikda yuradi */
  slow = 0;
  /** Ovchi tuzog'i: shuncha soniya qotib turadi (yurmaydi, hujum qilmaydi) */
  stun = 0;
  /** Zaharli uch: zahar qolgan vaqti va keyingi zarargacha hisob (Game boshqaradi) */
  poison = 0;
  poisonTick = 0;
  /** O'yin olib ketadigan o'qlar (kamonchi) */
  shots: Arrow[] = [];
  /** Sprite chapga aks ettiriladi (o'yinchiga qarab) */
  facingLeft = false;
  /** Kamonchi: qo'yib yuborish kadri qolgan vaqti */
  private releaseTimer = 0;
  /** Qalqonli skelet: qalqon qaragan burchak (rad) */
  shieldAngle = 0;
  /** Qalqon bilan itarish tayyorgarligi (0 — tayyorlanmayapti) */
  bashTimer = 0;
  bashCd = 0;
  /** Qalqon to'sganda qisqa yaltirash */
  blockFlash = 0;
  /** Muz ruhi: nafas tayyorgarligi, yo'nalishi va ko'rinish vaqti */
  breathWindup = 0;
  breathAngle = 0;
  breathShow = 0;
  /** Muz golemi: yerga urish tayyorgarligi va zarba to'lqini */
  stompWindup = 0;
  stompShock = 0;
  /** Shu kadrda golem yerga urdi (Game ovoz va silkinish beradi) */
  justStomped = false;
  heavy = false;
  ghost = false;
  /** Qor bo'risi: joriy bosqich va aylanish yo'nalishi (1 — soat mili bo'ylab, -1 — teskari) */
  wolfPhase: WolfPhase = "circle";
  orbit = Math.random() < 0.5 ? 1 : -1;
  /** O'rgimchak: devorga yetib oldimi va devor bo'yidagi joyi */
  onWall = false;
  trackS = 0;
  webWindup = 0;
  private webShow = 0;
  /** O'yin olib ketadigan to'rlar */
  webs: WebShot[] = [];
  /** Qo'ziqorin: bulut tayyorgarligi; Game shu kadrda bulut chiqarishi kerak */
  puffWindup = 0;
  private puffShow = 0;
  wantCloud = false;
  /** Daraxt odam: ildiz ogohlantirishi, nishon nuqtasi va ildizlar ko'rinish vaqti */
  rootWarn = 0;
  rootX = 0;
  rootY = 0;
  rootShow = 0;
  /** Shu kadrda ildiz yerdan chiqdi (ovoz uchun) */
  justRooted = false;
  /** Boyo'g'li: balandlik, bosqich va sho'ng'ish nishoni */
  alt = 0;
  owlPhase: OwlPhase = "soar";
  /** Olov imp: otish tayyorgarligi (0 — tayyorlanmayapti) */
  impWindup = 0;
  /** Ninja-soya va Tengu-qush bosqichlari; diveN — shu hujumdagi sho'ng'ishlar soni */
  ninjaPhase: NinjaPhase = "stalk";
  tenguPhase: TenguPhase = "soar";
  diveN = 0;
  /** Kitsune: olov yig'ish (0 — tayyorlanmayapti) */
  foxWindup = 0;
  /** Shu kadrdagi voqea — Game ovoz va uchqun beradi, so'ng tozalaydi */
  cue: EnemyCue | null = null;
  markX = 0;
  markY = 0;
  private diveFrom = { x: 0, y: 0 };
  anim = new Animator({
    idle: { frames: 2, frameTime: 0.4, loop: true },
    walk: { frames: 4, frameTime: 0.14, loop: true },
    attack: { frames: 3, frameTime: 0.55 / 3, loop: false },
    hurt: { frames: 1, frameTime: 0.2, loop: false },
    death: { frames: 3, frameTime: 0.16, loop: false },
  });

  constructor(
    public kind: EnemyKind,
    public x: number,
    public y: number,
  ) {
    this.hp = this.maxHp = ENEMY_HP[kind];
    this.size =
      kind === "golem"
        ? 20
        : kind === "treant"
          ? 18
          : kind === "wolf"
            ? 13
            : kind === "rammer" || kind === "archer" || kind === "shield" || kind === "ninja"
              ? 14
              : kind === "shroom" || kind === "kitsune"
                ? 12
                : 11;
    if (kind === "archer") this.aiTimer = ARCHER_RELOAD;
    if (kind === "golem") {
      this.heavy = true;
      this.aiTimer = STOMP_EVERY;
    }
    if (kind === "frost") {
      this.ghost = true;
      this.aiTimer = 0.6;
    }
    // juftlikdagi bo'rilar bir vaqtda sakramasligi uchun biroz farq
    if (kind === "wolf") this.aiTimer = WOLF_CIRCLE + Math.random() * 0.6;
    if (kind === "spider") this.aiTimer = 1.4 + Math.random() * 0.8;
    if (kind === "shroom") {
      this.heavy = true;
      this.aiTimer = 0.5;
    }
    if (kind === "treant") {
      this.heavy = true;
      this.aiTimer = 1.6 + Math.random();
    }
    if (kind === "owl") {
      this.alt = OWL_ALT;
      this.aiTimer = OWL_SOAR * 0.6 + Math.random();
    }
    if (kind === "imp") {
      this.size = 10;
      this.aiTimer = 1.2 + Math.random();
    }
    // bir nechta ninja bir vaqtda g'oyib bo'lmasligi uchun biroz farq
    if (kind === "ninja") this.aiTimer = NINJA_STALK * (0.5 + Math.random() * 0.6);
    if (kind === "tengu") {
      this.alt = TENGU_ALT;
      this.aiTimer = TENGU_SOAR * 0.6 + Math.random();
    }
    if (kind === "kitsune") this.aiTimer = 1.2 + Math.random() * 1.2;
  }

  get dead() {
    return this.anim.state === "death";
  }

  get active() {
    return !this.dead && this.spawn <= 0 && !this.airborne && !this.hidden;
  }

  /** Boyo'g'li va Tengu tepada: urib bo'lmaydi va tegmaydi */
  get airborne() {
    return (this.kind === "owl" || this.kind === "tengu") && this.alt > OWL_LOW;
  }

  /** Ninja tutunga aylangan: urib bo'lmaydi va tegmaydi */
  get hidden() {
    return this.kind === "ninja" && this.ninjaPhase === "vanish";
  }

  /** Rammer nishon olayotganini ko'rsatish uchun */
  get aiming() {
    return this.kind === "rammer" && !this.dashing && this.aiTimer < 0.35 && this.active;
  }

  /** Qalqon (fromX, fromY) tomondan kelgan zarbani to'sadimi. */
  blocks(fromX: number, fromY: number) {
    if (this.kind !== "shield" || this.dead) return false;
    const a = Math.atan2(fromY - this.y, fromX - this.x);
    return Math.abs(angleDiff(a, this.shieldAngle)) <= SHIELD_ARC;
  }

  update(dt: number, p: Target) {
    if (this.blockFlash > 0) this.blockFlash -= dt;
    if (this.spawn > 0) {
      // paydo bo'layotganda qalqon darhol o'yinchiga qaraydi
      if (this.kind === "shield") this.shieldAngle = Math.atan2(p.y - this.y, p.x - this.x);
      this.spawn -= dt;
      this.anim.update(dt);
      return;
    }
    this.anim.update(dt);
    updatePhysics(this, dt);
    if (this.slow > 0) this.slow -= dt;
    if (this.dead) {
      if (this.anim.done) this.removed = true;
      return;
    }
    if (this.stun > 0) {
      // tuzoqqa tushgan: qotib turadi
      this.stun -= dt;
      if (this.anim.state !== "hurt") this.anim.set("idle");
      return;
    }
    if (this.stompShock > 0) this.stompShock -= dt;
    if (this.breathShow > 0) this.breathShow -= dt;
    // sakrayotgan bo'ri zarba yesa — sakrash uziladi va charchab qoladi
    if (this.kind === "wolf" && this.anim.state === "hurt" && this.wolfPhase === "leap") {
      this.wolfPhase = "tired";
      this.aiTimer = WOLF_TIRED;
    }
    // urilgan o'rgimchak devordan itariladi — keyin devorga qayta chiqadi
    if (this.kind === "spider" && this.anim.state === "hurt") this.onWall = false;
    // golem va daraxt odam zarbadan to'xtamaydi: hujum tayyorgarligi davom etadi
    if (this.anim.state === "hurt" && this.kind !== "golem" && this.kind !== "treant") {
      if (this.anim.done) this.anim.set("walk");
      return;
    }
    this.t += dt;
    const dx = p.x - this.x,
      dy = p.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    if (dx !== 0) this.facingLeft = dx < 0;
    const m = this.speedMul * (this.slow > 0 ? 0.5 : 1);

    if (this.kind === "spider") this.updateSpider(dt, p, d, m);
    else if (this.kind === "shroom") this.updateShroom(dt, d);
    else if (this.kind === "treant") this.updateTreant(dt, p, dx, dy, d, m);
    else if (this.kind === "owl") this.updateOwl(dt, p, m);
    else if (this.kind === "imp") this.updateImp(dt, p, dx, dy, d, m);
    else if (this.kind === "ninja") this.updateNinja(dt, p, dx, dy, d, m);
    else if (this.kind === "tengu") this.updateTengu(dt, p, m);
    else if (this.kind === "kitsune") this.updateKitsune(dt, dx, dy, d, m);
    else if (this.kind === "frost") this.updateFrost(dt, p, dx, dy, d, m);
    else if (this.kind === "golem") this.updateGolem(dt, p, dx, dy, d, m);
    else if (this.kind === "wolf") this.updateWolf(dt, dx, dy, d, m);
    else if (this.kind === "blob" || this.kind === "iceblob") {
      // sakrash: harakat faqat sinus musbat bo'lganda
      // muz slime — muz ustida biroz tezroq, tez-tez sakraydi
      const hop = Math.max(0, Math.sin(this.t * (this.kind === "iceblob" ? 6 : 5)));
      const speed = this.kind === "iceblob" ? 50 : 45;
      this.x += (dx / d) * speed * m * hop * dt;
      this.y += (dy / d) * speed * m * hop * dt;
      this.anim.set(hop > 0 ? "walk" : "idle");
    } else if (this.kind === "wisp") {
      const px_ = -dy / d,
        py_ = dx / d; // perpendikulyar
      const wave = Math.sin(this.t * 4) * 70;
      this.x += ((dx / d) * 55 * m + px_ * wave) * dt;
      this.y += ((dy / d) * 55 * m + py_ * wave) * dt;
      this.anim.set("walk");
    } else if (this.kind === "shield") {
      // qalqon o'yinchiga qarab asta buriladi
      const turn = angleDiff(Math.atan2(dy, dx), this.shieldAngle);
      this.shieldAngle += Math.sign(turn) * Math.min(Math.abs(turn), SHIELD_TURN * dt);
      this.facingLeft = Math.cos(this.shieldAngle) < 0;
      if (this.bashCd > 0) this.bashCd -= dt;
      if (this.bashTimer > 0) {
        // tayyorgarlik: qalqon oldinga cho'ziladi (attack 0 -> 1), so'ng itarish (attack 2)
        this.bashTimer -= dt;
        if (this.bashTimer <= 0) {
          this.bashCd = BASH_CD;
          this.showAttackFrame(2);
          if (d < BASH_RANGE + p.size / 2 && this.blocks(p.x, p.y))
            p.takeHit(1, this.x, this.y, 200);
        } else this.showAttackFrame(this.bashTimer > BASH_WINDUP / 2 ? 0 : 1);
      } else if (this.bashCd > BASH_CD - 0.25) {
        this.showAttackFrame(2);
      } else if (d < BASH_RANGE && this.bashCd <= 0) {
        this.bashTimer = BASH_WINDUP;
        this.showAttackFrame(0);
      } else if (d > 16) {
        this.x += (dx / d) * SHIELD_SPEED * m * dt;
        this.y += (dy / d) * SHIELD_SPEED * m * dt;
        this.anim.set("walk");
      } else this.anim.set("idle");
    } else if (this.kind === "archer") {
      // 70..110 oralig'ida turadi: yaqinlashsa qochadi, uzoqlashsa yaqinlashadi, aks holda yonga yuradi
      const away = d < 70 ? -1 : d > 110 ? 1 : 0;
      const side = Math.sin(this.t * 0.9) > 0 ? 1 : -1;
      const sx = away ? (dx / d) * away : (-dy / d) * side * 0.5;
      const sy = away ? (dy / d) * away : (dx / d) * side * 0.5;
      this.aiTimer -= dt;
      if (this.releaseTimer > 0) this.releaseTimer -= dt;
      if (this.aiTimer <= 0) {
        // o'q kamondan chiqadi — aynan shu kadrda "qo'yib yuborish" ko'rinadi
        const bx = Math.max(
          ROOM.wall + 1,
          Math.min(ROOM.w - ROOM.wall - 1, this.x + (this.facingLeft ? -1 : 1) * BOW_OFFSET_X),
        );
        const by = this.y + BOW_OFFSET_Y;
        const ad = Math.hypot(p.x - bx, p.y - by) || 1;
        this.shots.push({
          x: bx,
          y: by,
          vx: ((p.x - bx) / ad) * ARROW_SPEED,
          vy: ((p.y - by) / ad) * ARROW_SPEED,
        });
        this.aiTimer += ARCHER_RELOAD;
        this.releaseTimer = ARCHER_RELEASE;
        this.showAttackFrame(2);
      } else if (this.releaseTimer > 0) {
        this.showAttackFrame(2);
      } else if (this.aiTimer <= ARCHER_DRAW) {
        // tortish paytida joyida turadi — o'yinchi uchun ogohlantirish
        this.showAttackFrame(this.aiTimer > ARCHER_DRAW - ARCHER_NOCK ? 0 : 1);
      } else {
        this.x += sx * 40 * m * dt;
        this.y += sy * 40 * m * dt;
        this.anim.set("walk");
      }
    } else {
      this.aiTimer -= dt;
      if (this.dashing) {
        this.x += this.dashX * 160 * m * dt;
        this.y += this.dashY * 160 * m * dt;
        this.anim.set("attack");
        if (this.aiTimer <= 0) {
          this.dashing = false;
          this.aiTimer = 1.2;
        }
      } else {
        this.anim.set("idle");
        if (this.aiTimer <= 0) {
          this.dashing = true;
          this.dashX = dx / d;
          this.dashY = dy / d;
          this.aiTimer = 0.55;
        }
      }
    }
    clampToRoom(this);
  }

  /** Muz ruhi: suzib yaqinlashadi, 1s tayyorlanadi, oldinga konus shaklida sovuq nafas chiqaradi. */
  private updateFrost(dt: number, p: Target, dx: number, dy: number, d: number, m: number) {
    this.aiTimer -= dt;
    if (this.breathWindup > 0) {
      this.breathWindup -= dt;
      if (this.breathWindup <= 0) {
        this.breathShow = BREATH_SHOW;
        this.aiTimer = FROST_CD;
        this.showAttackFrame(2);
        if (this.breathHits(p) && p.takeHit(1, this.x, this.y, 120)) p.chill = FROST_CHILL;
      } else this.showAttackFrame(this.breathWindup > FROST_WINDUP / 2 ? 0 : 1);
      return;
    }
    if (this.breathShow > 0) return this.showAttackFrame(2);
    if (d < FROST_NEAR && this.aiTimer <= 0) {
      // yo'nalish tayyorgarlik boshida qotadi — chetga chiqib qochish mumkin
      this.breathWindup = FROST_WINDUP;
      this.breathAngle = Math.atan2(dy, dx);
      this.showAttackFrame(0);
      return;
    }
    if (d > FROST_NEAR - 8) {
      const bob = Math.sin(this.t * 3) * 12;
      this.x += ((dx / d) * FROST_SPEED * m - (dy / d) * bob) * dt;
      this.y += ((dy / d) * FROST_SPEED * m + (dx / d) * bob) * dt;
    }
    this.anim.set("walk");
  }

  /**
   * Qor bo'risi: o'yinchini WOLF_RADIUS masofada aylanadi; vaqti kelganda 0.4s cho'kadi
   * (yo'nalish shu paytda qotadi), so'ng tez sakraydi va 1s charchab turadi.
   */
  private updateWolf(dt: number, dx: number, dy: number, d: number, m: number) {
    this.aiTimer -= dt;
    if (this.wolfPhase === "circle") {
      const radial = Math.max(-1, Math.min(1, (d - WOLF_RADIUS) / WOLF_RADIUS));
      let vx = (dx / d) * radial - (dy / d) * this.orbit,
        vy = (dy / d) * radial + (dx / d) * this.orbit;
      const l = Math.hypot(vx, vy) || 1;
      vx /= l;
      vy /= l;
      this.x += vx * WOLF_SPEED * m * dt;
      this.y += vy * WOLF_SPEED * m * dt;
      this.anim.set("walk");
      if (this.aiTimer <= 0) {
        this.wolfPhase = "crouch";
        this.aiTimer = WOLF_CROUCH;
        this.dashX = dx / d;
        this.dashY = dy / d;
        this.showAttackFrame(0);
      }
      return;
    }
    // cho'kish va sakrashda nishon tomonga qaraydi
    if (this.wolfPhase !== "tired" && this.dashX !== 0) this.facingLeft = this.dashX < 0;
    if (this.wolfPhase === "crouch") {
      this.showAttackFrame(0);
      if (this.aiTimer <= 0) {
        this.wolfPhase = "leap";
        this.aiTimer = WOLF_LEAP_TIME;
        this.showAttackFrame(1);
      }
    } else if (this.wolfPhase === "leap") {
      this.x += this.dashX * WOLF_LEAP_SPEED * m * dt;
      this.y += this.dashY * WOLF_LEAP_SPEED * m * dt;
      this.showAttackFrame(1);
      if (this.aiTimer <= 0) {
        this.wolfPhase = "tired";
        this.aiTimer = WOLF_TIRED;
        this.showAttackFrame(2);
      }
    } else {
      // charchagan: joyida hansirab turadi — urish uchun qulay payt
      this.showAttackFrame(2);
      if (this.aiTimer <= 0) {
        this.wolfPhase = "circle";
        this.aiTimer = WOLF_CIRCLE;
        this.anim.set("walk");
      }
    }
  }

  /**
   * O'rmon o'rgimchagi: avval eng yaqin devorga chiqadi, so'ng devor bo'ylab o'yinchiga eng
   * yaqin nuqtaga tez yuradi; vaqti kelganda to'xtab o'yinchi yo'liga to'r otadi.
   */
  private updateSpider(dt: number, p: Target, d: number, m: number) {
    this.aiTimer -= dt;
    if (this.webWindup > 0) {
      this.webWindup -= dt;
      if (this.webWindup <= 0) {
        // to'r o'yinchining oldiga — qarab turgan tomoniga tushadi
        const k = track();
        const tx = Math.max(k.l, Math.min(k.r, p.x + p.fx * WEB_LEAD)),
          ty = Math.max(k.t, Math.min(k.b, p.y + p.fy * WEB_LEAD));
        const l = Math.hypot(tx - this.x, ty - this.y) || 1;
        this.webs.push({
          x: this.x,
          y: this.y,
          vx: ((tx - this.x) / l) * WEB_SPEED,
          vy: ((ty - this.y) / l) * WEB_SPEED,
          tx,
          ty,
        });
        this.webShow = 0.25;
        this.aiTimer = SPIDER_WEB_CD;
        this.showAttackFrame(2);
      } else this.showAttackFrame(this.webWindup > SPIDER_WINDUP / 2 ? 0 : 1);
      return;
    }
    if (this.webShow > 0) {
      this.webShow -= dt;
      return this.showAttackFrame(2);
    }
    const speed = SPIDER_SPEED * m * dt;
    if (!this.onWall) {
      const [wx, wy] = trackPoint(trackParam(this.x, this.y));
      const l = Math.hypot(wx - this.x, wy - this.y);
      if (l <= speed) {
        this.onWall = true;
        this.trackS = trackParam(wx, wy);
      } else {
        this.x += ((wx - this.x) / l) * speed;
        this.y += ((wy - this.y) / l) * speed;
      }
      this.anim.set("walk");
      return;
    }
    const len = track().len;
    let diff = (trackParam(p.x, p.y) - this.trackS) % len;
    if (diff > len / 2) diff -= len;
    if (diff < -len / 2) diff += len;
    this.trackS += Math.sign(diff) * Math.min(Math.abs(diff), speed);
    [this.x, this.y] = trackPoint(this.trackS);
    this.anim.set(Math.abs(diff) > 1 ? "walk" : "idle");
    if (this.aiTimer <= 0 && d < SPIDER_RANGE) {
      this.webWindup = SPIDER_WINDUP;
      this.showAttackFrame(0);
    }
  }

  /** Zaharli qo'ziqorin: joyidan qimirlamaydi; o'yinchi yaqinlashsa shishib, zaharli bulut chiqaradi. */
  private updateShroom(dt: number, d: number) {
    this.aiTimer -= dt;
    if (this.puffWindup > 0) {
      this.puffWindup -= dt;
      if (this.puffWindup <= 0) {
        this.wantCloud = true;
        this.aiTimer = SHROOM_CD;
        this.puffShow = 0.4;
        this.showAttackFrame(2);
      } else this.showAttackFrame(this.puffWindup > SHROOM_WINDUP / 2 ? 0 : 1);
      return;
    }
    if (this.puffShow > 0) {
      this.puffShow -= dt;
      return this.showAttackFrame(2);
    }
    if (d < SHROOM_NEAR && this.aiTimer <= 0) {
      this.puffWindup = SHROOM_WINDUP;
      this.showAttackFrame(0);
      return;
    }
    this.anim.set("idle");
  }

  /** Daraxt odam: sekin yuradi; uzoqdan o'yinchi turgan joyga yoriq chizig'i, so'ng ildizlar. */
  private updateTreant(dt: number, p: Target, dx: number, dy: number, d: number, m: number) {
    if (this.rootShow > 0) this.rootShow -= dt;
    if (this.rootWarn > 0) {
      this.rootWarn -= dt;
      if (this.rootWarn <= 0) {
        this.justRooted = true;
        this.rootShow = ROOT_SHOW;
        this.aiTimer = TREANT_CD;
        this.showAttackFrame(2);
        if (
          Math.hypot(p.x - this.rootX, p.y - this.rootY) < ROOT_RADIUS + p.size / 2 &&
          p.takeHit(1, this.rootX, this.rootY, 40)
        )
          p.ensnare(ROOT_SNARE);
      } else this.showAttackFrame(this.rootWarn > ROOT_WARN / 2 ? 0 : 1);
      return;
    }
    if (this.rootShow > ROOT_SHOW - 0.3) return this.showAttackFrame(2);
    this.aiTimer -= dt;
    if (this.aiTimer <= 0 && d < TREANT_RANGE) {
      // nishon tayyorgarlik boshida qotadi — yoriq ko'rinsa joydan chiqib qochish mumkin
      this.rootWarn = ROOT_WARN;
      this.rootX = p.x;
      this.rootY = p.y;
      this.showAttackFrame(0);
      return;
    }
    if (d > 16) {
      this.x += (dx / d) * TREANT_SPEED * m * dt;
      this.y += (dy / d) * TREANT_SPEED * m * dt;
      this.anim.set("walk");
    } else this.anim.set("idle");
  }

  /**
   * Tungi boyo'g'li: tepada aylanadi (urib bo'lmaydi), so'ng o'yinchi joyida soya paydo bo'ladi
   * va 0.8s dan keyin shu joyga sho'ng'iydi; yerda 1.3s turadi — shu payt urish mumkin.
   */
  private updateOwl(dt: number, p: Target, m: number) {
    this.aiTimer -= dt;
    const fly = (tx: number, ty: number, speed: number) => {
      const l = Math.hypot(tx - this.x, ty - this.y);
      if (l < 1) return;
      const st = Math.min(l, speed * dt);
      this.x += ((tx - this.x) / l) * st;
      this.y += ((ty - this.y) / l) * st;
    };
    if (this.owlPhase === "soar") {
      this.alt = OWL_ALT;
      const a = this.t * 1.4 * this.orbit;
      fly(p.x + Math.cos(a) * 44, p.y + Math.sin(a) * 30, OWL_SPEED * m);
      this.anim.set("walk");
      if (this.aiTimer <= 0) {
        this.owlPhase = "mark";
        this.aiTimer = OWL_MARK;
        this.markX = p.x;
        this.markY = p.y;
      }
    } else if (this.owlPhase === "mark") {
      fly(this.markX, this.markY, OWL_SPEED * 1.5 * m);
      this.anim.set("walk");
      if (this.aiTimer <= 0) {
        this.owlPhase = "dive";
        this.aiTimer = OWL_DIVE;
        this.diveFrom = { x: this.x, y: this.y };
      }
    } else if (this.owlPhase === "dive") {
      const k = Math.min(1, 1 - this.aiTimer / OWL_DIVE);
      this.x = this.diveFrom.x + (this.markX - this.diveFrom.x) * k;
      this.y = this.diveFrom.y + (this.markY - this.diveFrom.y) * k;
      this.alt = OWL_ALT * (1 - k);
      this.showAttackFrame(k < 0.5 ? 0 : 1);
      if (this.aiTimer <= 0) {
        this.alt = 0;
        this.owlPhase = "rest";
        this.aiTimer = OWL_REST;
        this.showAttackFrame(2);
        if (Math.hypot(p.x - this.x, p.y - this.y) < OWL_HIT + p.size / 2)
          p.takeHit(1, this.x, this.y, 170);
      }
    } else if (this.owlPhase === "rest") {
      this.alt = 0;
      if (this.aiTimer > OWL_REST - 0.25) this.showAttackFrame(2);
      else this.anim.set("idle");
      if (this.aiTimer <= 0) {
        this.owlPhase = "rise";
        this.aiTimer = OWL_RISE;
      }
    } else {
      this.alt = OWL_ALT * Math.min(1, 1 - this.aiTimer / OWL_RISE);
      this.anim.set("walk");
      if (this.aiTimer <= 0) {
        this.owlPhase = "soar";
        this.aiTimer = OWL_SOAR;
      }
    }
  }

  /** Ninja-soya: yaqinlashish -> tutun -> o'yinchi orqasida paydo bo'lish -> ogohlantirish -> zarba. */
  private updateNinja(dt: number, p: Target, dx: number, dy: number, d: number, m: number) {
    this.aiTimer -= dt;
    if (this.ninjaPhase === "stalk") {
      if (d > 30) {
        // to'g'ri emas, yonlab aylanib yaqinlashadi
        const side = this.orbit * 0.6;
        this.x += (dx / d + (-dy / d) * side) * NINJA_SPEED * m * dt;
        this.y += (dy / d + (dx / d) * side) * NINJA_SPEED * m * dt;
        this.anim.set("walk");
      } else this.anim.set("idle");
      if (this.aiTimer <= 0) {
        this.ninjaPhase = "vanish";
        this.aiTimer = NINJA_VANISH;
        this.cue = "vanish";
        this.showAttackFrame(0);
      }
    } else if (this.ninjaPhase === "vanish") {
      this.showAttackFrame(0);
      if (this.aiTimer <= 0) {
        // o'yinchining orqasida (qaragan tomoniga teskari), xona ichida
        const fl = Math.hypot(p.fx, p.fy) || 1;
        const edge = ROOM.wall + this.size / 2 + 2;
        this.x = Math.max(edge, Math.min(ROOM.w - edge, p.x - (p.fx / fl) * NINJA_BEHIND));
        this.y = Math.max(edge, Math.min(ROOM.h - edge, p.y - (p.fy / fl) * NINJA_BEHIND));
        this.vx = this.vy = 0;
        if (p.x !== this.x) this.facingLeft = p.x < this.x;
        this.ninjaPhase = "warn";
        this.aiTimer = NINJA_WARN;
        this.cue = "appear";
        this.showAttackFrame(1);
      }
    } else if (this.ninjaPhase === "warn") {
      this.showAttackFrame(1);
      if (this.aiTimer <= 0) {
        this.ninjaPhase = "strike";
        this.aiTimer = NINJA_STRIKE;
        this.cue = "slash";
        this.showAttackFrame(2);
        if (d < NINJA_REACH + p.size / 2) p.takeHit(1, this.x, this.y, 170);
      }
    } else if (this.ninjaPhase === "strike") {
      this.showAttackFrame(2);
      if (this.aiTimer <= 0) {
        this.ninjaPhase = "rest";
        this.aiTimer = NINJA_REST;
      }
    } else {
      this.anim.set("idle");
      if (this.aiTimer <= 0) {
        this.ninjaPhase = "stalk";
        this.aiTimer = NINJA_STALK * (0.8 + Math.random() * 0.4);
      }
    }
  }

  /** Tengu-qush: aylanish -> soya (ogohlantirish) -> sho'ng'ish, TENGU_DIVES marta -> dam -> ko'tarilish. */
  private updateTengu(dt: number, p: Target, m: number) {
    this.aiTimer -= dt;
    const fly = (tx: number, ty: number, speed: number) => {
      const l = Math.hypot(tx - this.x, ty - this.y);
      if (l < 1) return;
      const st = Math.min(l, speed * dt);
      this.x += ((tx - this.x) / l) * st;
      this.y += ((ty - this.y) / l) * st;
    };
    const mark = (time: number) => {
      this.tenguPhase = "mark";
      this.aiTimer = time;
      this.markX = p.x;
      this.markY = p.y;
    };
    if (this.tenguPhase === "soar") {
      this.alt = TENGU_ALT;
      const a = this.t * 1.7 * this.orbit;
      fly(p.x + Math.cos(a) * 56, p.y + Math.sin(a) * 38, TENGU_SPEED * m);
      this.anim.set("walk");
      if (this.aiTimer <= 0) {
        this.diveN = 0;
        mark(TENGU_MARK);
      }
    } else if (this.tenguPhase === "mark") {
      this.alt = TENGU_ALT;
      fly(this.markX, this.markY, TENGU_SPEED * 1.6 * m);
      this.anim.set("walk");
      if (this.aiTimer <= 0) {
        this.tenguPhase = "dive";
        this.aiTimer = TENGU_DIVE;
        this.diveFrom = { x: this.x, y: this.y };
      }
    } else if (this.tenguPhase === "dive") {
      const k = Math.min(1, 1 - this.aiTimer / TENGU_DIVE);
      this.x = this.diveFrom.x + (this.markX - this.diveFrom.x) * k;
      this.y = this.diveFrom.y + (this.markY - this.diveFrom.y) * k;
      this.alt = TENGU_ALT * (1 - k);
      this.showAttackFrame(k < 0.5 ? 0 : 1);
      if (this.aiTimer <= 0) {
        this.alt = 0;
        this.diveN++;
        this.cue = "dive";
        this.showAttackFrame(2);
        if (Math.hypot(p.x - this.x, p.y - this.y) < TENGU_HIT + p.size / 2)
          p.takeHit(1, this.x, this.y, 170);
        if (this.diveN < TENGU_DIVES) {
          this.tenguPhase = "bounce";
          this.aiTimer = TENGU_BOUNCE;
        } else {
          this.tenguPhase = "rest";
          this.aiTimer = TENGU_REST;
        }
      }
    } else if (this.tenguPhase === "bounce") {
      // yerdan sapchib qayta ko'tariladi va darhol keyingi nishonni belgilaydi
      this.alt = TENGU_ALT * Math.min(1, 1 - this.aiTimer / TENGU_BOUNCE);
      this.anim.set("walk");
      if (this.aiTimer <= 0) mark(TENGU_MARK2);
    } else if (this.tenguPhase === "rest") {
      this.alt = 0;
      if (this.aiTimer > TENGU_REST - 0.25) this.showAttackFrame(2);
      else this.anim.set("idle");
      if (this.aiTimer <= 0) {
        this.tenguPhase = "rise";
        this.aiTimer = TENGU_RISE;
      }
    } else {
      this.alt = TENGU_ALT * Math.min(1, 1 - this.aiTimer / TENGU_RISE);
      this.anim.set("walk");
      if (this.aiTimer <= 0) {
        this.tenguPhase = "soar";
        this.aiTimer = TENGU_SOAR;
      }
    }
  }

  /** Kitsune-olov: masofani saqlab yonlab yuradi, olov yig'ib (ogohlantirish) uchta ko'k shar otadi. */
  private updateKitsune(dt: number, dx: number, dy: number, d: number, m: number) {
    if (this.foxWindup > 0) {
      this.foxWindup -= dt;
      this.showAttackFrame(this.foxWindup > KITSUNE_WINDUP / 2 ? 0 : 1);
      if (this.foxWindup <= 0) {
        const a = Math.atan2(dy, dx);
        const mid = (KITSUNE_SHOTS - 1) / 2;
        for (let i = 0; i < KITSUNE_SHOTS; i++) {
          const sa = a + (i - mid) * KITSUNE_SPREAD;
          this.shots.push({
            x: this.x,
            y: this.y - 2,
            vx: Math.cos(sa) * KITSUNE_SHOT_SPEED,
            vy: Math.sin(sa) * KITSUNE_SHOT_SPEED,
          });
        }
        this.aiTimer = KITSUNE_CD + Math.random() * 0.5;
        this.releaseTimer = KITSUNE_RELEASE;
        this.showAttackFrame(2);
      }
      return;
    }
    if (this.releaseTimer > 0) {
      this.releaseTimer -= dt;
      this.showAttackFrame(2);
      return;
    }
    this.aiTimer -= dt;
    if (this.aiTimer <= 0) {
      this.foxWindup = KITSUNE_WINDUP;
      this.cue = "foxfire";
      this.showAttackFrame(0);
      return;
    }
    // yaqinlashsa qochadi, uzoqlashsa yaqinlashadi, aks holda aylana bo'ylab yonlab yuradi
    const away = d < KITSUNE_NEAR ? -1 : d > KITSUNE_FAR ? 1 : 0;
    const sx = away ? (dx / d) * away : (-dy / d) * this.orbit;
    const sy = away ? (dy / d) * away : (dx / d) * this.orbit;
    const nx = this.x + sx * KITSUNE_SPEED * m * dt,
      ny = this.y + sy * KITSUNE_SPEED * m * dt;
    this.x = nx;
    this.y = ny;
    clampToRoom(this);
    // devorga taqalsa — teskari tomonga aylanadi (burchakda qolib ketmaydi)
    if (this.x !== nx || this.y !== ny) this.orbit *= -1;
    this.anim.set("walk");
  }

  /**
   * Poldagi ogohlantirishlar (boshqa jonzotlardan oldin chiziladi): ildiz yorig'i, boyo'g'li va
   * Tengu soyasi, Ninja zarbasi doirasi.
   */
  renderFloor(ctx: CanvasRenderingContext2D) {
    if (this.dead) return;
    if (this.kind === "tengu" && (this.tenguPhase === "mark" || this.tenguPhase === "dive")) {
      // sho'ng'ish nuqtasida qorayib boruvchi soya va qizil halqa
      const total = this.diveN ? TENGU_MARK2 : TENGU_MARK;
      const k = this.tenguPhase === "dive" ? 1 : 1 - Math.max(0, this.aiTimer) / total;
      ctx.fillStyle = `rgba(0,0,0,${0.25 + 0.35 * k})`;
      ctx.beginPath();
      ctx.ellipse(this.markX, this.markY + 6, 7 + 5 * k, 3.5 + 2 * k, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = withAlpha(DANGER.tenguMark, 0.45 + 0.4 * Math.sin(this.t * 25));
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    if (this.kind === "ninja" && this.ninjaPhase === "warn") {
      // zarba yetadigan doira: tez to'lib boradi
      const k = 1 - Math.max(0, this.aiTimer) / NINJA_WARN;
      ctx.strokeStyle = withAlpha(DANGER.ninjaSlash, 0.45 + 0.4 * Math.sin(this.t * 30));
      ctx.fillStyle = withAlpha(DANGER.ninjaSlash, 0.08 + 0.14 * k);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(this.x, this.y + 3, NINJA_REACH, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    if (this.kind === "treant" && this.rootWarn > 0) {
      // yerdan nishon tomonga o'sib boruvchi siniq yoriq
      const k = 1 - this.rootWarn / ROOT_WARN;
      const x0 = this.x,
        y0 = this.y + 8;
      const steps = 14;
      ctx.fillStyle = "#120a06";
      for (let i = 0; i <= steps * Math.min(1, k * 1.6); i++) {
        const t = i / steps;
        const jx = ((i * 37) % 5) - 2;
        ctx.fillRect(
          Math.round(x0 + (this.rootX - x0) * t + jx) - 1,
          Math.round(y0 + (this.rootY + 4 - y0) * t),
          3,
          2,
        );
      }
      ctx.fillStyle = `rgba(200,120,40,${0.5 + 0.4 * Math.sin(this.rootWarn * 30)})`;
      for (let i = 0; i <= steps * Math.min(1, k * 1.6); i += 2) {
        const t = i / steps;
        ctx.fillRect(
          Math.round(x0 + (this.rootX - x0) * t),
          Math.round(y0 + (this.rootY + 4 - y0) * t),
          1,
          1,
        );
      }
      ctx.strokeStyle = `rgba(220,110,30,${0.55 + 0.4 * Math.sin(this.rootWarn * 30)})`;
      ctx.fillStyle = `rgba(160,70,20,${0.12 + 0.25 * k})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(this.rootX, this.rootY + 4, ROOT_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    if (this.kind === "treant" && this.rootShow > 0)
      renderRoots(ctx, this.rootX, this.rootY, ROOT_SHOW - this.rootShow);
    if (this.kind === "owl" && (this.owlPhase === "mark" || this.owlPhase === "dive")) {
      // sho'ng'ish nuqtasida qorayib boruvchi soya
      const k = this.owlPhase === "dive" ? 1 : 1 - this.aiTimer / OWL_MARK;
      ctx.fillStyle = `rgba(0,0,0,${0.25 + 0.35 * k})`;
      ctx.beginPath();
      ctx.ellipse(this.markX, this.markY + 6, 6 + 5 * k, 3 + 2 * k, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = withAlpha(DANGER.owlMark, 0.4 + 0.4 * Math.sin(this.t * 25));
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  /** O'yinchi sovuq nafas konusi ichidami. */
  breathHits(p: { x: number; y: number; size: number }) {
    const d = Math.hypot(p.x - this.x, p.y - this.y);
    if (d > FROST_RANGE + p.size / 2) return false;
    return (
      Math.abs(angleDiff(Math.atan2(p.y - this.y, p.x - this.x), this.breathAngle)) <= FROST_ARC
    );
  }

  /** Muz golemi: sekin yuradi, har 3s da yerga uradi — atrofdagi kichik doirada 1 zarar. */
  private updateGolem(dt: number, p: Target, dx: number, dy: number, d: number, m: number) {
    if (this.stompWindup > 0) {
      this.stompWindup -= dt;
      if (this.stompWindup <= 0) {
        this.stompShock = 0.3;
        this.justStomped = true;
        this.aiTimer = STOMP_EVERY;
        this.showAttackFrame(2);
        if (d < STOMP_RADIUS + p.size / 2) p.takeHit(1, this.x, this.y, 200);
      } else this.showAttackFrame(this.stompWindup > STOMP_WINDUP / 2 ? 0 : 1);
      return;
    }
    if (this.stompShock > 0) return this.showAttackFrame(2);
    this.aiTimer -= dt;
    if (this.aiTimer <= 0) {
      this.stompWindup = STOMP_WINDUP;
      this.showAttackFrame(0);
      return;
    }
    if (d > 14) {
      this.x += (dx / d) * GOLEM_SPEED * m * dt;
      this.y += (dy / d) * GOLEM_SPEED * m * dt;
      this.anim.set("walk");
    } else this.anim.set("idle");
  }

  /** Muz ruhi nafasi: tayyorgarlikda konus chegarasi, nafasda oq-ko'k bulut. */
  private renderBreath(ctx: CanvasRenderingContext2D) {
    const a = this.breathAngle;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.arc(this.x, this.y, FROST_RANGE, a - FROST_ARC, a + FROST_ARC);
    ctx.closePath();
    if (this.breathWindup > 0) {
      // och muz polda ko'rinishi uchun to'q ko'k chegara
      const k = 1 - this.breathWindup / FROST_WINDUP;
      ctx.fillStyle = withAlpha(DANGER.breathFill, 0.1 + 0.2 * k);
      ctx.fill();
      ctx.strokeStyle = withAlpha(DANGER.breath, 0.5 + 0.4 * Math.sin(this.breathWindup * 28));
      ctx.lineWidth = 1;
      ctx.stroke();
    } else {
      const k = this.breathShow / BREATH_SHOW;
      ctx.fillStyle = `rgba(235,248,255,${0.75 * k})`;
      ctx.fill();
      ctx.strokeStyle = withAlpha(DANGER.breathFill, 0.7 * k);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  /** Kamonchi va qalqonli skelet kadri Animator taymeri emas, hujum vaqti bilan boshqariladi. */
  private showAttackFrame(frame: number) {
    this.anim.set("attack");
    this.anim.frame = frame;
    this.anim.t = 0;
  }

  /** Olov imp: o'yinchi atrofida aylanadi; to'xtab yaltiraydi, so'ng o'yinchiga olov shari otadi. */
  private updateImp(dt: number, p: Target, dx: number, dy: number, d: number, m: number) {
    if (this.impWindup > 0) {
      this.impWindup -= dt;
      this.anim.set("attack");
      if (this.impWindup <= 0) {
        this.shots.push({
          x: this.x,
          y: this.y,
          vx: (dx / d) * IMP_SHOT_SPEED,
          vy: (dy / d) * IMP_SHOT_SPEED,
        });
        this.aiTimer = IMP_CD + Math.random() * 0.6;
      }
      return;
    }
    this.aiTimer -= dt;
    if (this.aiTimer <= 0) {
      this.impWindup = IMP_WINDUP;
      return;
    }
    // aylana bo'ylab: radial (masofani saqlash) + tangensial harakat, ozgina tebranish
    const radial = (d - IMP_ORBIT) / IMP_ORBIT;
    const tx = -dy / d,
      ty = dx / d;
    const wob = Math.sin(this.t * 6) * 0.4;
    this.x += ((dx / d) * radial * 1.4 + tx * (0.8 + wob)) * IMP_SPEED * m * dt;
    this.y += ((dy / d) * radial * 1.4 + ty * (0.8 + wob)) * IMP_SPEED * m * dt;
    clampToRoom(this);
    this.anim.set("walk");
  }

  render(ctx: CanvasRenderingContext2D) {
    const { state, frame } = this.anim;
    if (this.kind === "imp" && this.impWindup > 0 && !this.dead) {
      // otishdan oldin olov yig'iladi: kattalashuvchi to'q sariq doira
      const k = 1 - this.impWindup / IMP_WINDUP;
      ctx.fillStyle = `rgba(255,140,40,${0.2 + 0.3 * k})`;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 6 + 6 * k, 0, Math.PI * 2);
      ctx.fill();
    }
    if (this.kind === "golem" && this.stompWindup > 0) {
      // yerga urish ogohlantirishi: qizil doira
      ctx.strokeStyle = withAlpha(DANGER.stomp, 0.6 + 0.35 * Math.sin(this.stompWindup * 30));
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(this.x, this.y + 4, STOMP_RADIUS, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = withAlpha(
        DANGER.stompFill,
        0.1 + 0.2 * (1 - this.stompWindup / STOMP_WINDUP),
      );
      ctx.fill();
    }
    if (this.stompShock > 0) {
      ctx.fillStyle = `rgba(200,235,255,${this.stompShock * 1.6})`;
      ctx.beginPath();
      ctx.arc(this.x, this.y + 4, STOMP_RADIUS * (1.3 - this.stompShock), 0, Math.PI * 2);
      ctx.fill();
    }
    if (this.kind === "frost" && (this.breathWindup > 0 || this.breathShow > 0))
      this.renderBreath(ctx);
    if (this.kind === "kitsune" && this.foxWindup > 0 && !this.dead) {
      // dumlarida ko'k olov yig'iladi: kattalashuvchi ko'k doira
      const k = 1 - this.foxWindup / KITSUNE_WINDUP;
      ctx.fillStyle = withAlpha(DANGER.foxFire, 0.18 + 0.3 * k);
      ctx.beginPath();
      ctx.arc(this.x + (this.facingLeft ? 7 : -7), this.y - 9, 5 + 5 * k, 0, Math.PI * 2);
      ctx.fill();
    }
    if (this.spawn > 0) {
      const k = 1 - this.spawn / this.spawnMax;
      const a = 0.35 + 0.35 * Math.sin(this.spawn * 20);
      ctx.strokeStyle = ICE_KINDS.has(this.kind)
        ? `rgba(140,215,255,${a})`
        : FOREST_KINDS.has(this.kind)
          ? `rgba(150,235,90,${a})`
          : SAKURA_KINDS.has(this.kind)
            ? `rgba(255,170,205,${a})`
            : this.kind === "imp"
              ? `rgba(255,120,40,${a})`
              : `rgba(200,120,255,${a})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(this.x, this.y + 4, 4 + 8 * k, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = k * 0.8;
    }
    if (this.aiming) {
      ctx.fillStyle = "#ff4d4d";
      ctx.fillRect(Math.round(this.x) - 1, Math.round(this.y) - 16, 2, 4);
      ctx.fillRect(Math.round(this.x) - 1, Math.round(this.y) - 11, 2, 2);
    }
    const tall =
      this.kind === "rammer" ||
      this.kind === "archer" ||
      this.kind === "shield" ||
      this.kind === "golem" ||
      this.kind === "treant" ||
      this.kind === "ninja";
    // ninja tutunga aylanayotganda asta so'nadi
    if (this.hidden) ctx.globalAlpha *= 0.35 + 0.65 * Math.max(0, this.aiTimer / NINJA_VANISH);
    // muz ruhi yarim shaffof, muz slime biroz shaffof
    if (this.kind === "frost") ctx.globalAlpha *= 0.78;
    else if (this.kind === "iceblob") ctx.globalAlpha *= 0.88;
    const sy = tall
      ? this.y - (this.kind === "golem" || this.kind === "treant" ? 6 : 0)
      : this.y - 3 - Math.round(this.alt);
    // vizual qatlam (mobAnim.ts): squash & stretch va paydo bo'lish — faqat ko'rinish
    const lively = !currentSettings().reduceFx;
    const flying = FLYING_KINDS.has(this.kind);
    const size = spriteSize(SPRITE[this.kind]);
    // sprayt oyog'i turgan chiziq (uchadiganlarda — markaz)
    const ground = flying ? sy : sy + size * 0.42;
    ctx.save();
    if (lively && this.spawn > 0) {
      const k = 1 - this.spawn / this.spawnMax;
      if (flying) {
        // tutundan paydo bo'ladi: bulutchalar tarqaladi, sprayt kattalashib tiniqlashadi
        renderSpawnSmoke(ctx, this.x, sy, k, "#b8b0c8");
        const sc = 0.55 + 0.45 * k;
        ctx.translate(this.x, sy);
        ctx.scale(sc, sc);
        ctx.translate(-this.x, -sy);
      } else {
        // yerdan ko'tarilib chiqadi: yer chizig'idan pasti kesiladi, ostida qora o'yiq
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.beginPath();
        ctx.ellipse(this.x, ground, size * 0.36, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.45 + 0.4 * k;
        ctx.beginPath();
        ctx.rect(this.x - size, ground - size * 1.4, size * 2, size * 1.4);
        ctx.clip();
        ctx.translate(0, Math.round((1 - riseShare(k)) * size * 0.95));
      }
    } else if (lively) {
      const [mx, my] = mobScale(this);
      if (mx !== 1 || my !== 1) {
        ctx.translate(this.x, ground);
        ctx.scale(mx, my);
        ctx.translate(-this.x, -ground);
      }
    }
    renderSprite(
      ctx,
      SPRITE[this.kind],
      state,
      frame,
      this.x,
      sy,
      isFlashing(this) || state === "hurt",
      this.facingLeft,
    );
    ctx.restore();
    if (this.kind === "shield" && !this.dead && this.spawn <= 0) {
      // qalqon qaragan tomon: temir yoy (to'sganda yaltiraydi)
      ctx.strokeStyle = this.blockFlash > 0 ? "rgba(255,240,170,0.95)" : "rgba(170,175,188,0.45)";
      ctx.lineWidth = this.blockFlash > 0 ? 2 : 1;
      ctx.beginPath();
      ctx.arc(this.x, this.y + 2, 12, this.shieldAngle - SHIELD_ARC, this.shieldAngle + SHIELD_ARC);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

/** 2-dunyo moblari: paydo bo'lishda ko'k doira */
const ICE_KINDS: ReadonlySet<EnemyKind> = new Set(["frost", "golem", "iceblob", "shield", "wolf"]);
/** 3-dunyo moblari: paydo bo'lishda yashil doira */
const FOREST_KINDS: ReadonlySet<EnemyKind> = new Set(["spider", "shroom", "treant", "owl"]);

/** 4-dunyo moblari: paydo bo'lishda pushti doira */
const SAKURA_KINDS: ReadonlySet<EnemyKind> = new Set(["ninja", "tengu", "kitsune"]);

/** Yerdan chiqqan ildizlar (daraxt odam va O'rmon Shohi): t — chiqqandan beri o'tgan vaqt. */
export function renderRoots(ctx: CanvasRenderingContext2D, x: number, y: number, t: number) {
  const h = Math.min(1, t * 10) * 11;
  const bx = Math.round(x),
    by = Math.round(y + 7);
  for (const [ox, k, lean] of [
    [-6, 0.6, -1],
    [-2, 1, 0],
    [3, 0.8, 1],
    [7, 0.5, 1],
  ] as const) {
    const hh = Math.round(h * k);
    for (let i = 0; i < hh; i++) {
      const sx = bx + ox + Math.round((lean * i) / 4);
      ctx.fillStyle = "#1a0f08";
      ctx.fillRect(sx - 1, by - i, 3, 1);
      ctx.fillStyle = i > hh - 3 ? "#7bd14f" : "#6b4a2a";
      ctx.fillRect(sx, by - i, 1, 1);
    }
  }
}

/** a - b burchak farqi, [-PI, PI] oralig'ida. */
export function angleDiff(a: number, b: number) {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
