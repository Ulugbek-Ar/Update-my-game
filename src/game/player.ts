import { Animator, Body, updatePhysics, isFlashing, clampToRoom } from "./animation";
import type { Input } from "./input";
import { renderSprite } from "./sprites";
import { sfx } from "./audio";
import type { Hero } from "./hero";

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
/** Muz qamoq: tugmalarni shuncha marta bosmasa ham shuncha soniyadan keyin o'zi eriydi */
export const ENCASE_MAX = 3.5;
/** Dash/teleport/sakrash tugagach shuncha himoya dumi (o'yinchi biroz shaffof) */
export const DASH_GUARD = 0.2;
/** Dash oxirida dushman ichida qolsa — chiqquncha himoya, lekin shundan oshmaydi */
export const DASH_GUARD_MAX = 0.35;

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
    if (hero === "gunner") {
      this.hp = this.maxHp = GUNNER_MAX_HP;
      this.speed = GUNNER_SPEED;
      this.attackCd = GUN_CD;
      this.dashCd = 0.9;
      this.spinCd = FAN_CD;
      this.boltSpeed = GUN_SPEED;
      this.boltSize = 4;
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

  /** Mergan qayta o'qlamoqda */
  get reloading() {
    return this.reloadT > 0;
  }

  /** Mergan tutun ichida yashiringan: dushmanlar uni ko'rmaydi */
  get hidden() {
    return this.hideT > 0;
  }

  /** Masofadan uradigan qahramon (Sehrgar shari yoki Ovchi o'qi) */
  get ranged() {
    return this.hero !== "knight";
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
    return this.charge >= CHARGE_TIME;
  }

  /** Joriy zarba zarari: aylana zarba 2x. */
  get hitDamage() {
    return this.spinning ? this.damage * 2 : this.damage;
  }

  /** Zarba tegsa true qaytaradi. Dash paytida va himoya dumida daxlsiz. */
  takeHit(dmg: number, fromX: number, fromY: number, force: number) {
    if (this.invuln > 0 || this.dead || this.evading) return false;
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
    this.attackTimer = 0;
    this.charge = 0;
    if (this.hp <= 0) this.anim.set("death", true);
    else {
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
    // aylana zarba — o'yinchi atrofidagi katta maydon (Ovchida kuchli o'q, Merganda o'qlar uchadi)
    if (this.spinning && !this.hunter && !this.gunner)
      return { x: this.x, y: this.y, size: this.reach * 2.4 } as Body;
    // Sehrgar va Ovchining oddiy zarbasi — shar/o'q, u alohida uchadi
    if (this.attackTimer <= 0 || this.ranged) return null;
    const off = this.reach * 0.75;
    return { x: this.x + this.fx * off, y: this.y + this.fy * off, size: this.reach } as Body;
  }

  update(dt: number, input: PlayerInput) {
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
    if (this.hideT > 0) this.hideT -= dt;
    if (this.gunner) this.updateGun(dt, input);
    if (this.chill > 0) this.chill -= dt;
    if (this.snare > 0) this.snare -= dt;
    if (this.dashCooldown <= 0) this.dashCharges = this.dashMax;
    if (this.attackTimer > 0) this.attackTimer -= dt;
    if (this.spinTimer > 0) this.spinTimer -= dt;

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
      this.dashTimer -= dt;
      // dash tugagan kadrdayoq himoya dumi boshlanadi — quvib kelgan mob darhol ura olmaydi
      if (this.dashTimer <= 0) this.guardAge = 0;
      // Mergan sirpanish oxirida barabanga o'q soladi
      if (this.dashTimer <= 0 && this.gunner) this.slideReload();
      if (this.mage) return;
      const sp = this.hunter ? JUMP_SPEED : this.gunner ? SLIDE_SPEED : DASH_SPEED;
      this.x += this.dashX * sp * dt;
      this.y += this.dashY * sp * dt;
      this.clamp(this);
      return;
    }

    // Ovchi: Shift'ni qisqa bosish — orqaga sakrash, bosib turish — tuzoq;
    // Mergan: qisqa bosish — sirpanish, bosib turish — tutun bombasi
    if ((this.hunter || this.gunner) && this.updateShift(dt, wantDash, input, x, y)) return;

    if (
      wantDash &&
      !this.hunter &&
      !this.gunner &&
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
      sfx.dash();
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
      if (this.spinCooldown <= 0 && this.hurtTimer <= 0 && !this.spinning && loaded)
        this.charge += dt;
    } else {
      if (this.charged && this.spinCooldown <= 0) {
        this.spinTimer = this.gunner ? FAN_TIME : SPIN_TIME;
        this.spinCooldown = this.spinCd;
        this.attackTimer = 0;
        this.hitSet.clear();
        if (this.gunner) sfx.cylinder();
        else sfx.spin();
        this.anim.set("attack", true);
        // Ovchi: kuchaytirilgan o'q — hamma dushmanni teshib o'tadi, 2x zarar
        if (this.hunter) this.shoot(true);
        // Mergan: barabanni bo'shatish — qolgan hamma o'q 0.4s ichida yelpig'ich bo'lib uchadi
        if (this.gunner) this.startFan();
      }
      this.charge = 0;
    }

    if (wantAttack && this.cooldown <= 0 && this.hurtTimer <= 0 && !this.spinning && loaded) {
      this.attackTimer = ATTACK_TIME;
      this.cooldown = this.attackCd;
      this.hitSet.clear();
      if (this.gunner) sfx.gunshot();
      else sfx.attack();
      this.anim.set("attack", true);
      if (this.ranged) this.shoot(false);
    }
    // bo'sh barabanda tepki bosilsa — qayta o'qlash
    if (wantAttack && this.gunner && this.ammo <= 0 && !this.reloading) this.startReload();

    // Ovchi kuchli o'qdan keyin joyida turmaydi — o'q uchib ketadi
    const busy = this.attackTimer > 0 || this.hurtTimer > 0 || (this.spinning && !this.hunter);
    if (!busy) {
      if ((x || y) && this.snare <= 0) {
        const l = Math.max(1, Math.hypot(x, y));
        const speed = this.speed * (this.chill > 0 ? CHILL_SPEED : 1);
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
        ...(this.hunter ? { arrow: true, power: power ? 2 : 1, poison: this.poisonTip } : {}),
      });
    }
  }

  /** Mergan o'qi: qarab turgan tomonga (yelpig'ichda — a burchakka) tez uchadi; barabandan 1 o'q. */
  private fire(a: number) {
    this.bolts.push({
      x: this.x + Math.cos(a) * 9,
      y: this.y + Math.sin(a) * 9 - 2,
      vx: Math.cos(a) * this.boltSpeed,
      vy: Math.sin(a) * this.boltSpeed,
      size: this.boltSize,
      left: 1 + this.pierce,
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
      this.fire(Math.atan2(this.fy, this.fx) + spread);
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
    return this.gunner ? this.slide(ax, ay) : this.backJump();
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

  render(ctx: CanvasRenderingContext2D) {
    // teleport paytida sehrgar ko'rinmaydi
    if (this.dashing && this.mage) return;
    if (this.dashing) ctx.globalAlpha = 0.7;
    // himoya dumi: biroz shaffof
    else if (this.guarded) ctx.globalAlpha = 0.6;
    // tutunda yashiringan Mergan: zo'rg'a ko'rinadi
    else if (this.hidden) ctx.globalAlpha = 0.35;
    renderSprite(
      ctx,
      this.hero,
      this.anim.state,
      this.anim.frame,
      this.x,
      this.y,
      isFlashing(this) || this.anim.state === "hurt",
      this.fx < 0,
      this.fy < 0,
    );
    ctx.globalAlpha = 1;
  }
}
