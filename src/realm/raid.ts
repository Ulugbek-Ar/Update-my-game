/**
 * Birinchi reyd boss: KUL QIROLI — Kul tog'idagi Iblis ibodatxonasining ichki zalida.
 *
 * Jamoa uchun (2–4 o'yinchi): joni jangdagi o'yinchilar soniga moslashadi (bir kishi ham yengishi
 * mumkin, lekin juda qiyin). Xavf (threat) bo'yicha eng xavfli o'yinchini quvadi — tank (Paladin
 * QASAM) uni ushlab turadi. Uch faza:
 *  1) tankka og'ir zarba va oldinga olov konusi — tank uni boshqalardan uzoqqa burishi kerak;
 *  2) zalning yarmi lavaga to'ladi, osmondan meteorlar (yerda ogohlantirish doiralari), 2 ta kul ruhi
 *     — ularni uzoqdan otuvchilar yo'q qiladi;
 *  3) KUL BO'RONI — hamma bitta doiraga yig'ilib zararni bo'lishadi (yig'ilmagan og'ir zarar oladi,
 *     yolg'iz o'yinchi — kamroq).
 * Har zarba oldidan yerda belgi. G'azab taymeri — 6 daqiqa. O'lgan o'yinchi 10 s dan keyin zal
 * kirishida tug'iladi (jang davom etadi); hamma o'lsa — boss to'liq tiklanadi. Lut har o'yinchiga
 * alohida, birinchi g'alabada "Kul qirolini yenggan" unvoni.
 *
 * DOM'siz, tasodif faqat sim.rng orqali — server (RealmRoom) va oflayn klient aynan bir xil ishlaydi.
 */
import { BIG_HIT, phaseFor } from "@/game/bossPower";
import { AGGRO_THREAT } from "@/game/threat";
import { RealmMob, type Mark } from "./mobs";
import type { RealmPlayer, RealmSim } from "./sim";

/** 1 o'yinchi uchun jon; har qo'shimcha o'yinchi +80% */
export const KING_HP = 360;
export const KING_PARTY_HP = 0.8;
/** G'azab taymeri: 6 daqiqa */
export const KING_ENRAGE = 360;
/** O'lgan o'yinchi shuncha soniyadan keyin zal kirishida tug'iladi */
export const KING_RESPAWN = 10;
/** Kirish sahnasi (nom kartochkasi) davomiyligi */
export const KING_INTRO = 2.6;
/** Yengilgach boss shuncha soniyadan keyin qayta paydo bo'ladi (boshqa jamoalar uchun) */
export const KING_REBORN = 120;
/** Hamma zaldan chiqib ketsa — shuncha soniyadan keyin boss tiklanadi */
export const KING_LEASH = 6;
export const KING_SPEED = 34;
/** 1-faza: og'ir zarba (tank) va olov konusi */
export const KING_SLAM_WINDUP = 1;
export const KING_SLAM_R = 30;
export const KING_CONE_WINDUP = 1.3;
export const KING_CONE_RANGE = 130;
export const KING_CONE_HALF = 0.5;
export const KING_CONE_DMG = 2;
/** 2-faza: lava yarmi, meteorlar va kul ruhlari */
export const LAVA_WARN = 3;
export const LAVA_HOLD = 12;
export const METEOR_EVERY = 2.4;
export const METEOR_WARN = 1.4;
export const METEOR_R = 18;
export const METEOR_DMG = 2;
export const KING_SPIRITS = 2;
export const SPIRIT_RESUMMON = 40;
/** 3-faza: kul bo'roni — doiraga yig'ilib zararni bo'lishish */
export const STORM_EVERY = 15;
export const STORM_WARN = 4;
export const STORM_R = 40;
export const STORM_TOTAL = 6;
export const STORM_OUT = 5;
export const STORM_SOLO = 2;
export const STORM_SOLO_OUT = 4;
/** G'azabda har zarba shuncha og'irroq, meteorlar tez-tez */
export const ENRAGE_DMG = 2;
/** Faza nomlari (HUD) */
export const PHASE_TEXT: Record<number, string> = {
  1: "OLOV",
  2: "LAVA TOSHQINI",
  3: "KUL BO'RONI",
};
/** Birinchi g'alaba unvoni (id) va ko'rinadigan matni */
export const KING_TITLE = "ashking";
export const TITLE_TEXT: Record<string, string> = { [KING_TITLE]: "Kul qirolini yenggan" };

/** n o'yinchiga Kul qiroli joni: asosiy × (1 + 0.8 × (n − 1)). */
export function kingHp(n: number) {
  return Math.round(KING_HP * (1 + KING_PARTY_HP * (Math.max(1, n) - 1)));
}

/**
 * Kul bo'roni zarari: n — jangdagi tirik o'yinchilar, inside — doira ichidagilar.
 * Qaytaradi: [doira ichidagi har biriga, tashqaridagiga]. Ichidagilar umumiy zararni bo'lishadi.
 */
export function stormShare(n: number, inside: number): [number, number] {
  if (n <= 1) return [STORM_SOLO, STORM_SOLO_OUT];
  return [Math.max(1, Math.ceil(STORM_TOTAL / Math.max(1, inside))), STORM_OUT];
}

export interface ArenaDef {
  id: string;
  /** zal (plitkalarda, global) */
  x: number;
  y: number;
  w: number;
  h: number;
  /** zal kirishi (qayta tug'ilish joyi), plitka */
  entry: readonly [number, number];
}

/** Tarmoq uchun ixcham holat: [faol, o'tgan s, lava (-1/0/1), ogohlantirish, g'azab, o'yinchilar] */
export type RaidNet = [number, number, number, number, number, number];

const T = 16;
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

/** Hujum kadrlari (sprites.ts: Kul qiroli): nafas, olov purkash, mushtlar bosh uzra, yerga zarba */
export const KING_POSE = { inhale: 0, breath: 1, raise: 2, smash: 3 } as const;

/** Bossning hujum pozasini qo'lda qo'yish (raid boshqaradi; tarmoqqa kadr bilan ketadi) */
function pose(boss: RealmMob, frame: number) {
  boss.anim.state = "attack";
  boss.anim.frame = frame;
  boss.anim.done = false;
}

export class AshKingRaid {
  /** jang ketmoqda */
  active = false;
  /** jang boshlanganidan beri (s) — g'azab taymeri */
  elapsed = 0;
  /** jangga kirgan o'yinchilar */
  engaged = new Set<string>();
  /** bir vaqtda jangda bo'lgan eng ko'p o'yinchi (jon shunga moslashgan) */
  party = 1;
  /** lava yarmi: -1 yo'q, 0 chap, 1 o'ng; warn — hali ogohlantirish (kuydirmaydi) */
  lava = -1;
  lavaWarn = false;
  lavaT = 0;
  nextSide = 0;
  meteorT = 0;
  stormT = 0;
  spiritT = 0;
  enraged = false;
  /** jangchilar zaldan tashqarida qolgan vaqt */
  awayT = 0;
  bossId = -1;
  /** boss qayta paydo bo'lguncha (yengilgandan keyin) */
  rebornT = 0;
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
  readonly entry: { x: number; y: number };
  readonly home: { x: number; y: number };

  constructor(readonly def: ArenaDef) {
    this.x0 = def.x * T;
    this.y0 = def.y * T;
    this.x1 = (def.x + def.w) * T;
    this.y1 = (def.y + def.h) * T;
    this.entry = { x: def.entry[0] * T + T / 2, y: def.entry[1] * T + T / 2 };
    // taxt: zalning to'rida, o'rtada
    this.home = { x: (this.x0 + this.x1) / 2, y: this.y0 + 4 * T };
  }

  inArena(x: number, y: number) {
    return x >= this.x0 && x < this.x1 && y >= this.y0 && y < this.y1;
  }

  /** Lava (faol, ogohlantirish emas) shu nuqtani qoplaydimi */
  lavaAt(x: number, y: number) {
    if (this.lava < 0 || this.lavaWarn || !this.inArena(x, y)) return false;
    const mid = (this.x0 + this.x1) / 2;
    return this.lava === 0 ? x < mid : x >= mid;
  }

  boss(sim: RealmSim) {
    return sim.mobs.find((m) => m.id === this.bossId);
  }

  net(): RaidNet {
    return [
      this.active ? 1 : 0,
      Math.floor(this.elapsed),
      this.lava,
      this.lavaWarn ? 1 : 0,
      this.enraged ? 1 : 0,
      this.party,
    ];
  }

  /** Klient ko'zgusi: server holatini qabul qilish */
  applyNet(n: RaidNet) {
    this.active = n[0] === 1;
    if (Math.abs(this.elapsed - n[1]) > 1.5) this.elapsed = n[1];
    this.lava = n[2];
    this.lavaWarn = n[3] === 1;
    this.enraged = n[4] === 1;
    this.party = n[5];
  }

  /** Boss taxtida (uxlab) paydo bo'ladi */
  spawnBoss(sim: RealmSim) {
    const m = sim.addMob("ashking", this.home.x, this.home.y);
    m.state = "dormant";
    m.maxHp = m.hp = KING_HP;
    m.dirX = 0;
    m.dirY = 1;
    m.spawnT = 0;
    this.bossId = m.id;
    return m;
  }

  /** Bitta tick (RealmSim.step ichida, moblardan keyin). */
  update(sim: RealmSim, dt: number) {
    let boss = this.boss(sim);
    if (!boss) {
      if (this.rebornT > 0) this.rebornT -= dt;
      if (this.rebornT <= 0) boss = this.spawnBoss(sim);
      else return;
    }
    if (boss.dead) {
      boss.anim.update(dt);
      boss.deathT += dt;
      return;
    }
    const inside = [...sim.players.values()].filter(
      (rp) => !rp.p.dead && this.inArena(rp.p.x, rp.p.y),
    );
    if (!this.active) {
      boss.anim.update(dt);
      boss.anim.set("idle");
      if (inside.length) this.start(sim, boss, inside);
      return;
    }
    this.elapsed += dt;
    for (const rp of inside) this.join(boss, rp);
    // jangda o'lganlar zal kirishida tug'iladi
    for (const id of this.engaged) {
      const rp = sim.players.get(id);
      if (rp?.p.dead) rp.raidRespawn = true;
    }
    const alive = [...this.engaged]
      .map((id) => sim.players.get(id))
      .filter((rp): rp is RealmPlayer => !!rp && !rp.p.dead);
    if (!alive.length) return this.reset(sim, boss, true);
    if (!inside.length) {
      this.awayT += dt;
      if (this.awayT > KING_LEASH) return this.reset(sim, boss, false);
    } else this.awayT = 0;
    if (!this.enraged && this.elapsed >= KING_ENRAGE) {
      this.enraged = true;
      sim.event({ type: "raid", what: "enrage", x: boss.x, y: boss.y });
    }
    const ph = phaseFor(boss.hp, boss.maxHp);
    if (ph > boss.phase) {
      boss.phase = ph;
      this.onPhase(sim, boss, ph);
    }
    this.updateLava(sim, boss, dt);
    this.updateMeteors(sim, boss, dt, inside);
    this.updateSpirits(sim, boss, dt);
    this.updateStorm(sim, boss, dt, inside);
    this.updateBoss(sim, boss, dt, inside);
  }

  private start(sim: RealmSim, boss: RealmMob, inside: RealmPlayer[]) {
    this.active = true;
    this.elapsed = 0;
    this.engaged = new Set(inside.map((rp) => rp.id));
    this.party = inside.length;
    boss.maxHp = boss.hp = kingHp(this.party);
    boss.phase = 1;
    boss.atk = 0;
    boss.cd = 1.2;
    boss.state = "wake";
    boss.t = KING_INTRO;
    boss.threat.clear();
    boss.hitters.clear();
    for (const rp of inside) boss.threat.add(rp.id, AGGRO_THREAT, rp.hero);
    this.lava = -1;
    this.lavaWarn = false;
    this.nextSide = 0;
    this.meteorT = 2;
    this.stormT = 3;
    this.spiritT = 0;
    this.enraged = false;
    this.awayT = 0;
    sim.event({ type: "raid", what: "start", x: boss.x, y: boss.y });
  }

  /** Zalga kirgan yangi o'yinchi: jangga qo'shiladi, boss joni ulushini saqlab oshadi */
  private join(boss: RealmMob, rp: RealmPlayer) {
    if (this.engaged.has(rp.id)) return;
    this.engaged.add(rp.id);
    boss.threat.add(rp.id, AGGRO_THREAT, rp.hero);
    if (this.engaged.size <= this.party) return;
    const k = boss.hp / boss.maxHp;
    this.party = this.engaged.size;
    boss.maxHp = kingHp(this.party);
    boss.hp = Math.max(1, Math.round(boss.maxHp * k));
  }

  /** O'yinchi xonadan chiqdi */
  leave(id: string) {
    this.engaged.delete(id);
  }

  private clearArena(sim: RealmSim, boss: RealmMob) {
    sim.mobs = sim.mobs.filter((m) => m.kind !== "ashspirit");
    sim.marks = sim.marks.filter((k) => k.owner !== boss.id);
    this.lava = -1;
    this.lavaWarn = false;
  }

  /** Hamma halok bo'ldi (yoki zalni tashlab ketdi) — boss to'liq tiklanadi */
  reset(sim: RealmSim, boss: RealmMob, wipe: boolean) {
    this.clearArena(sim, boss);
    this.active = false;
    this.elapsed = 0;
    this.enraged = false;
    this.party = 1;
    this.awayT = 0;
    this.engaged.clear();
    boss.maxHp = boss.hp = KING_HP;
    boss.phase = 1;
    boss.state = "dormant";
    boss.target = null;
    boss.threat.clear();
    boss.hitters.clear();
    boss.x = boss.px = this.home.x;
    boss.y = boss.py = this.home.y;
    boss.vx = boss.vy = 0;
    boss.anim.set("idle", true);
    sim.event({ type: "raid", what: wipe ? "wipe" : "reset", x: boss.x, y: boss.y });
  }

  /** Boss yengildi: lut har o'yinchiga alohida, birinchi g'alabada unvon */
  victory(sim: RealmSim, boss: RealmMob, killer: RealmPlayer) {
    this.clearArena(sim, boss);
    const ids = new Set([...this.engaged, ...boss.hitters, killer.id]);
    for (const id of ids) {
      const rp = sim.players.get(id);
      if (!rp) continue;
      rp.kills++;
      sim.event({ type: "kill", x: boss.x, y: boss.y, kind: "ashking", pid: rp.id });
      const gold = 80 + sim.rng.int(41);
      rp.gold += gold;
      sim.event({ type: "gold", pid: rp.id, n: gold, x: boss.x, y: boss.y });
      sim.giveItem(rp, sim.rng.next() < 0.5 ? "ashcrown" : "kingblade", 1, boss.x, boss.y);
      sim.giveItem(rp, "magma", 2, boss.x, boss.y);
      if (!rp.titles.includes(KING_TITLE)) {
        rp.titles.push(KING_TITLE);
        sim.event({ type: "title", pid: rp.id, title: KING_TITLE });
      }
    }
    boss.hitters.clear();
    this.active = false;
    this.engaged.clear();
    this.enraged = false;
    this.rebornT = KING_REBORN;
    sim.event({ type: "raid", what: "win", x: boss.x, y: boss.y });
  }

  private onPhase(sim: RealmSim, boss: RealmMob, ph: number) {
    sim.event({ type: "raid", what: "phase", x: boss.x, y: boss.y, phase: ph });
    if (ph === 2) {
      // lava toshqini yaqinda, kul ruhlari darhol
      this.lavaT = 1.5;
      this.lava = -1;
      this.spiritT = 0;
      this.meteorT = 1.5;
    } else if (ph === 3) {
      // bo'ron fazasi: lava tushadi, birinchi bo'ron tez orada
      this.lava = -1;
      this.lavaWarn = false;
      this.stormT = 2;
    }
  }

  /** 2-faza: zal yarmi navbat bilan lavaga to'ladi (oldin ogohlantirish), boshqa yarmi xavfsiz */
  private updateLava(sim: RealmSim, boss: RealmMob, dt: number) {
    if (boss.phase !== 2) {
      this.lava = -1;
      this.lavaWarn = false;
      return;
    }
    this.lavaT -= dt;
    if (this.lavaT > 0) return;
    if (this.lava < 0) {
      this.lava = this.nextSide;
      this.lavaWarn = true;
      this.lavaT = LAVA_WARN;
      sim.event({ type: "raid", what: "lava", x: boss.x, y: boss.y, side: this.lava });
    } else if (this.lavaWarn) {
      this.lavaWarn = false;
      this.lavaT = LAVA_HOLD;
      sim.event({ type: "raid", what: "flood", x: boss.x, y: boss.y, side: this.lava });
    } else {
      this.lava = -1;
      this.nextSide = 1 - this.nextSide;
      this.lavaT = 0.6;
    }
  }

  /** 2–3-faza: osmondan meteorlar — o'yinchilar oyog'i ostida (atrofida) ogohlantirish doiralari */
  private updateMeteors(sim: RealmSim, boss: RealmMob, dt: number, inside: RealmPlayer[]) {
    if (boss.phase < 2 && !this.enraged) return;
    if (boss.state === "wake") return;
    this.meteorT -= dt;
    if (this.meteorT > 0 || !inside.length) return;
    this.meteorT = this.enraged ? 0.8 : boss.phase === 2 ? METEOR_EVERY : METEOR_EVERY * 1.4;
    const n = this.enraged ? inside.length : Math.min(2, inside.length);
    const pool = [...inside];
    for (let i = 0; i < n && pool.length; i++) {
      const rp = pool.splice(sim.rng.int(pool.length), 1)[0]!;
      const x = Math.max(this.x0 + 12, Math.min(this.x1 - 12, rp.p.x + sim.rng.range(-24, 24))),
        y = Math.max(this.y0 + 12, Math.min(this.y1 - 12, rp.p.y + sim.rng.range(-24, 24)));
      sim.marks.push({
        kind: "meteor",
        x,
        y,
        r: METEOR_R,
        dx: 0,
        dy: 0,
        len: 0,
        t: METEOR_WARN,
        total: METEOR_WARN,
        owner: boss.id,
        dmg: METEOR_DMG + (this.enraged ? ENRAGE_DMG : 0),
      });
    }
  }

  /** 2-faza: 2 ta kul ruhi zal burchaklarida (uzoqdan otadi) — o'lsa, birozdan keyin qaytadan */
  private updateSpirits(sim: RealmSim, boss: RealmMob, dt: number) {
    if (boss.phase < 2) return;
    if (sim.mobs.some((m) => m.kind === "ashspirit" && !m.dead)) {
      this.spiritT = SPIRIT_RESUMMON;
      return;
    }
    this.spiritT -= dt;
    if (this.spiritT > 0) return;
    this.spiritT = SPIRIT_RESUMMON;
    const left = boss.x > (this.x0 + this.x1) / 2;
    const xs = left ? [this.x0 + 40, this.x0 + 70] : [this.x1 - 40, this.x1 - 70];
    const ys = [this.y0 + 40, this.y1 - 40];
    for (let i = 0; i < KING_SPIRITS; i++) {
      const m = sim.addMob("ashspirit", xs[i % 2]!, ys[i % 2]!);
      m.state = "chase";
      m.spawnT = 0.5;
      sim.event({ type: "wake", x: m.x, y: m.y, kind: "ashspirit" });
    }
    sim.event({ type: "raid", what: "spirits", x: boss.x, y: boss.y });
  }

  /** 3-faza: Kul bo'roni — doira belgisi tasodifiy o'yinchi oyog'i ostida; hamma yig'ilishi kerak */
  private updateStorm(sim: RealmSim, boss: RealmMob, dt: number, inside: RealmPlayer[]) {
    if (boss.phase < 3 || !inside.length) return;
    if (sim.marks.some((k) => k.kind === "stack" && k.owner === boss.id)) return;
    this.stormT -= dt;
    if (this.stormT > 0) return;
    this.stormT = STORM_EVERY;
    const rp = inside[sim.rng.int(inside.length)]!;
    const x = Math.max(this.x0 + STORM_R, Math.min(this.x1 - STORM_R, rp.p.x)),
      y = Math.max(this.y0 + STORM_R, Math.min(this.y1 - STORM_R, rp.p.y));
    sim.marks.push({
      kind: "stack",
      x,
      y,
      r: STORM_R,
      dx: 0,
      dy: 0,
      len: 0,
      t: STORM_WARN,
      total: STORM_WARN,
      owner: boss.id,
    });
    sim.event({ type: "raid", what: "storm", x, y });
  }

  /** Bo'ron tushdi: doira ichidagilar zararni bo'lishadi, tashqaridagilar og'ir zarar oladi */
  resolveStorm(sim: RealmSim, k: Mark) {
    const fighters = [...this.engaged]
      .map((id) => sim.players.get(id))
      .filter((rp): rp is RealmPlayer => !!rp && !rp.p.dead && this.inArena(rp.p.x, rp.p.y));
    const ins = fighters.filter((rp) => dist(rp.p, k) < k.r + rp.p.size / 2);
    const [inDmg, outDmg] = stormShare(fighters.length, ins.length);
    const extra = this.enraged ? ENRAGE_DMG : 0;
    for (const rp of fighters)
      sim.hurtPlayer(rp, (ins.includes(rp) ? inDmg : outDmg) + extra, k.x, k.y, 120);
    sim.event({ type: "raid", what: "stormhit", x: k.x, y: k.y, n: ins.length });
  }

  // ---------- boss xatti-harakati ----------

  private updateBoss(sim: RealmSim, boss: RealmMob, dt: number, inside: RealmPlayer[]) {
    boss.anim.update(dt);
    if (boss.flash > 0) boss.flash -= dt;
    if (boss.cd > 0) boss.cd -= dt;
    boss.threat.update(dt);
    boss.stun = 0;
    const extra = this.enraged ? ENRAGE_DMG : 0;
    if (boss.state === "wake") {
      // kirish sahnasi: o'rnidan turib, mushtlarini ko'tarib bo'kiradi — hali urmaydi
      boss.t -= dt;
      pose(boss, KING_POSE.raise);
      if (boss.t <= 0) {
        boss.state = "chase";
        boss.t = 0;
      }
      return;
    }
    const busy = boss.state === "windup" || boss.state === "recover";
    const cands = inside.filter((rp) => !rp.p.hidden);
    if (!busy) {
      const best = boss.threat.pick(cands, boss.target);
      boss.target = best?.id ?? null;
    }
    const t = boss.target ? sim.players.get(boss.target) : undefined;
    if (!t || t.p.dead) {
      boss.anim.set("idle");
      if (!busy) boss.state = "chase";
      return;
    }
    // tegib ketsa kuydiradi
    if (!busy)
      for (const rp of inside)
        if (
          Math.abs(rp.p.x - boss.x) < (boss.size + rp.p.size) / 2 - 4 &&
          Math.abs(rp.p.y - boss.y) < (boss.size + rp.p.size) / 2 - 4
        )
          sim.hurtPlayer(rp, 1 + extra, boss.x, boss.y, 220);
    switch (boss.state) {
      case "windup":
        boss.t -= dt;
        pose(boss, boss.move === "slam" ? KING_POSE.raise : KING_POSE.inhale);
        if (boss.t <= 0) this.release(sim, boss, inside, extra);
        return;
      case "recover":
        boss.t -= dt;
        // zarbadan keyin bir zum shu pozada qoladi (musht yerda / olov oqimi)
        if (boss.t > 0.45) pose(boss, boss.move === "slam" ? KING_POSE.smash : KING_POSE.breath);
        else boss.anim.set("idle");
        if (boss.t <= 0) {
          boss.state = "chase";
          boss.cd = this.enraged ? 0.4 : boss.phase === 3 ? 0.7 : 0.9;
        }
        return;
      default: {
        boss.state = "chase";
        const d = dist(boss, t.p);
        if (boss.cd <= 0 && d < KING_CONE_RANGE * 0.8) {
          boss.atk++;
          const dx = t.p.x - boss.x,
            dy = t.p.y - boss.y,
            l = Math.hypot(dx, dy) || 1;
          boss.dirX = dx / l;
          boss.dirY = dy / l;
          if (Math.abs(dx) > 2) boss.face = Math.sign(dx);
          // har uchinchi hujum — olov konusi, aks holda yaqin bo'lsa og'ir zarba
          if (boss.atk % 3 === 0 || d > 52) {
            boss.move = "charge";
            this.windup(sim, boss, KING_CONE_WINDUP, {
              kind: "cone",
              x: boss.x,
              y: boss.y,
              r: KING_CONE_RANGE,
              dx: boss.dirX,
              dy: boss.dirY,
              len: KING_CONE_HALF,
            });
          } else {
            boss.move = "slam";
            this.windup(sim, boss, KING_SLAM_WINDUP, {
              kind: "circle",
              x: boss.x + boss.dirX * 26,
              y: boss.y + boss.dirY * 26,
              r: KING_SLAM_R,
              dx: 0,
              dy: 0,
              len: 0,
            });
          }
          return;
        }
        if (d > 34) {
          const k = (KING_SPEED * (this.enraged ? 1.4 : 1) * dt) / d;
          boss.dirX = (t.p.x - boss.x) / d;
          boss.dirY = (t.p.y - boss.y) / d;
          if (Math.abs(t.p.x - boss.x) > 2) boss.face = Math.sign(t.p.x - boss.x);
          sim.moveBody(boss, (t.p.x - boss.x) * k, (t.p.y - boss.y) * k);
          boss.anim.set("walk");
        } else boss.anim.set("idle");
      }
    }
  }

  private windup(
    sim: RealmSim,
    boss: RealmMob,
    time: number,
    mark: Pick<Mark, "kind" | "x" | "y" | "r" | "dx" | "dy" | "len">,
  ) {
    const w = this.enraged ? time * 0.75 : time;
    boss.state = "windup";
    boss.t = w;
    boss.struck.clear();
    sim.marks.push({ ...mark, t: w, total: w, owner: boss.id });
  }

  /** Tayyorlangan zarba tushadi */
  private release(sim: RealmSim, boss: RealmMob, inside: RealmPlayer[], extra: number) {
    if (boss.move === "slam") {
      const cx = boss.x + boss.dirX * 26,
        cy = boss.y + boss.dirY * 26;
      sim.event({ type: "slam", x: cx, y: cy, r: KING_SLAM_R });
      for (const rp of inside)
        if (dist(rp.p, { x: cx, y: cy }) < KING_SLAM_R + rp.p.size / 2)
          sim.hurtPlayer(rp, BIG_HIT + extra, boss.x, boss.y, 260);
    } else {
      // olov konusi: boss yo'nalishida, shu burchak va masofadagi hamma kuyadi
      sim.event({ type: "raid", what: "cone", x: boss.x, y: boss.y, dx: boss.dirX, dy: boss.dirY });
      for (const rp of inside) {
        const dx = rp.p.x - boss.x,
          dy = rp.p.y - boss.y;
        const d = Math.hypot(dx, dy);
        if (d > KING_CONE_RANGE + rp.p.size / 2) continue;
        const cos = d < 1 ? 1 : (dx * boss.dirX + dy * boss.dirY) / d;
        if (cos >= Math.cos(KING_CONE_HALF))
          sim.hurtPlayer(rp, KING_CONE_DMG + extra, boss.x, boss.y, 200);
      }
    }
    boss.state = "recover";
    boss.t = boss.move === "slam" ? 0.85 : 1.05;
    pose(boss, boss.move === "slam" ? KING_POSE.smash : KING_POSE.breath);
  }
}
