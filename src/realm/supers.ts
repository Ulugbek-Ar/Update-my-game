/**
 * ONLAYN OLAMDA SUPERLAR (v3.14) — faqat PvE: super faqat moblarga zarar beradi, o'yinchilarga hech
 * qachon. Mantiq RealmSim ichida ishlaydi (server va oflayn klient — bir xil kod):
 *
 *  - zaryad serverda: o'yinchi mobga bergan zarar (super zarbasidan tashqari) va yegan zarba;
 *  - "super" buyrug'i: shar to'lmagan, super davom etayotgan, o'lgan yoki oyna ochiq bo'lsa — RAD;
 *  - bitta qisqa voqea xabari (`{ type: "super", pid, id, x, y, ax, ay, sx?, sy? }`) — atrofdagi
 *    hamma o'yinchi super sahnasini o'zida chizadi (zarar natijasi odatdagi holat bilan keladi);
 *  - zarar bir lahzada (har superning o'z lahzasi: nur, "chik", meteorit urilishi, o'qlar tegishi)
 *    o'yinchi ekranidagi (320x240) moblarga: oddiy mob o'ladi, boss (Sardor, Kul qiroli) — asosiy
 *    o'yindagidek bossDamage chegarasi bilan (8% / jami 10%);
 *  - CHEKSIZ O'Q: tez otish o'yinchining Player.frenzy bayrog'i bilan (o'qlar odatdagi snaryad).
 *
 * Asosiy o'yindan farqi: dunyo sekinlashmaydi (umumiy dunyo), karta faqat egasining ekranida.
 */
import { ROOM } from "@/game/animation";
import {
  SuperCast,
  bossDamage,
  frenzyTime,
  impactPoint,
  impactZone,
  pathsHit,
  superPaths,
  volleyTargets,
  type SuperDef,
  type SuperPath,
} from "@/game/super";
import type { RealmMob } from "./mobs";
import type { RealmPlayer, RealmSim } from "./sim";

/** O'yinchida davom etayotgan super (server holati) */
export interface RealmCast {
  cast: SuperCast;
  /** Yo'nalish (birlik vektor) va meteorit nuqtasi (dunyo koordinatasi) */
  aim: { x: number; y: number };
  spot: { x: number; y: number } | null;
  /** UFQ KESIMI to'lqinlari (ekran koordinatasida — o'yinchi markazda) */
  paths: SuperPath[];
  /** Zarar qo'llandi */
  hit: boolean;
  /**
   * `release` superlari (MING KESIM, UFQ KESIMI): zarba bosqichida kesim tekkan moblar — "chik"
   * lahzasigacha qotib turadi va o'sha lahzada kesiladi (dunyo sekinlashmaydi — umumiy olam).
   */
  marked: Set<RealmMob>;
}

/** Super voqeasi (tarmoqda bitta qisqa xabar) */
export interface SuperEvent {
  type: "super";
  pid: string;
  id: string;
  x: number;
  y: number;
  ax: number;
  ay: number;
  sx?: number;
  sy?: number;
}

/** Olamdagi bosslar: super ularni o'ldirmaydi, chegaralangan ulush beradi */
export const realmBoss = (m: RealmMob) => m.kind === "warden" || m.kind === "ashking";

const r1 = (v: number) => Math.round(v * 10) / 10;

/** Dunyo nuqtasi → o'yinchi markazdagi ekran (xona) koordinatasi va aksincha */
export const toLocal = (c: { x: number; y: number }, o: { x: number; y: number }) => ({
  x: o.x - c.x + ROOM.w / 2,
  y: o.y - c.y + ROOM.h / 2,
});
export const toWorld = (c: { x: number; y: number }, o: { x: number; y: number }) => ({
  x: o.x + c.x - ROOM.w / 2,
  y: o.y + c.y - ROOM.h / 2,
});

/** O'yinchi ekranidagi (super yetadigan) tirik moblar; mashq qo'g'irchog'i — yo'q */
export function superTargets(sim: RealmSim, at: { x: number; y: number }) {
  return sim.mobs.filter(
    (m) =>
      !m.dead &&
      !m.under &&
      m.spawnT <= 0.3 &&
      m.kind !== "dummy" &&
      Math.abs(m.x - at.x) <= ROOM.w / 2 + m.size / 2 &&
      Math.abs(m.y - at.y) <= ROOM.h / 2 + m.size / 2,
  );
}

/** Qarash yo'nalishi (birlik vektor) */
export function faceOf(p: { fx: number; fy: number }) {
  const x = p.fx || (p.fy ? 0 : 1),
    y = p.fy;
  const m = Math.hypot(x, y) || 1;
  return { x: x / m, y: y / m };
}

/**
 * Superni boshlash. Rad etiladi (null): qahramonda super yo'q, shar to'lmagan, super davom etmoqda,
 * o'lgan yoki oyna (dialog, do'kon) ochiq.
 */
export function startRealmSuper(sim: RealmSim, rp: RealmPlayer): SuperEvent | null {
  const def = rp.meter.def;
  const p = rp.p;
  if (!def || !rp.meter.ready || rp.cast || p.dead || rp.ui) return null;
  if (!p.beginCast()) return null;
  rp.meter.use();
  const aim = faceOf(p);
  let spot: { x: number; y: number } | null = null;
  if (def.impact) {
    const list = superTargets(sim, p).map((m) => ({ ...toLocal(p, m), boss: realmBoss(m) }));
    spot = toWorld(p, impactPoint(def, toLocal(p, p), aim, list, ROOM, null));
  }
  rp.cast = { cast: new SuperCast(def, 0), aim, spot, paths: [], hit: false, marked: new Set() };
  if (def.volley) {
    // o'qlar nishonlari super boshida belgilanadi — o'q nishonni qayerda bo'lsa ham topadi
    const list = superTargets(sim, p);
    for (const m of volleyTargets(
      p,
      list.filter((m) => !realmBoss(m)),
      list.filter(realmBoss),
      def.volley.n,
    ))
      if (m) rp.cast.marked.add(m);
  }
  if (!def.frenzy) {
    // asosiy o'yinda vaqt sekinlashadi; umumiy olamda esa ekrandagi dushmanlar zarba lahzasigacha
    // qotib turadi (gangish) — super ulardan "qochib qutulmaydi"
    const hold = dueTime(def) + 0.1;
    for (const m of superTargets(sim, p)) m.stun = Math.max(m.stun, hold);
  }
  const ev: SuperEvent = {
    type: "super",
    pid: rp.id,
    id: def.id,
    x: r1(p.x),
    y: r1(p.y),
    ax: r1(aim.x),
    ay: r1(aim.y),
    ...(spot ? { sx: r1(spot.x), sy: r1(spot.y) } : {}),
  };
  sim.event(ev);
  return ev;
}

/** Zarar lahzasi: super boshidan (s) */
export function dueTime(def: SuperDef) {
  const S = def.stages;
  if (def.release !== undefined) return S.prep + S.strike + def.release;
  if (def.impact) return S.prep + def.impact.at;
  if (def.volley) return S.prep + Math.min(S.strike * 0.5, 0.6);
  return S.prep + def.strike.mark;
}

/** Zarar lahzasi keldimi (har superning o'z lahzasi) */
export function superDue(def: SuperDef, c: SuperCast) {
  if (def.frenzy) return false;
  if (c.stage === "after" && def.release === undefined) return true;
  if (def.release !== undefined) return c.stage === "after" && c.t >= def.release;
  if (c.stage !== "strike") return false;
  if (def.impact) return c.t >= def.impact.at;
  if (def.volley) return c.t >= Math.min(c.strikeTime * 0.5, 0.6);
  return c.t >= def.strike.mark;
}

/** Super vaqt chizig'i (har tick): bosqichlar, zarar lahzasi, tez otish va yakun */
export function updateRealmSuper(sim: RealmSim, rp: RealmPlayer, dt: number) {
  const rc = rp.cast;
  if (!rc) return;
  const c = rc.cast;
  const def = c.def;
  const p = rp.p;
  const ev = c.update(dt);
  for (const s of ev.entered) {
    if (s === "strike" && def.path) rc.paths = superPaths(def, toLocal(p, p), rc.aim, ROOM);
    if (s === "strike" && def.frenzy) {
      // CHEKSIZ O'Q: boshqaruv qaytadi (daxlsizlik tugaydi), baraban tugamaydi
      p.endCast();
      p.frenzy = true;
      p.frenzyRate = def.frenzy.rate;
      p.reloadT = 0;
      c.strikeTime = frenzyTime(def);
    }
    if (s === "after" && def.frenzy) {
      p.frenzy = false;
      p.frenzyRate = 1;
      p.ammo = p.ammoMax;
      p.reloadT = 0;
    }
  }
  if (!rc.hit && def.release !== undefined && c.stage !== "prep") markRelease(sim, rp, rc);
  if (!rc.hit && superDue(def, c)) {
    rc.hit = true;
    applyRealmSuper(sim, rp, rc);
  }
  if (ev.done || p.dead) endRealmSuper(rp);
}

/** Kesim tekkan moblarni belgilash va "chik" gacha qotirish */
function markRelease(sim: RealmSim, rp: RealmPlayer, rc: RealmCast) {
  const c = rc.cast;
  const def = c.def;
  const p = rp.p;
  const hold = c.strikeTime - (c.stage === "strike" ? c.t : 0) + (def.release ?? 0) + 0.1;
  for (const m of superTargets(sim, p)) {
    if (rc.marked.has(m)) continue;
    if (def.path) {
      const at = pathsHit(rc.paths, { ...toLocal(p, m), size: m.size });
      if (at === null || (c.stage === "strike" && at > c.t)) continue;
    }
    rc.marked.add(m);
    m.stun = Math.max(m.stun, hold);
  }
}

/** Super tugadi: daxlsizlik shu tickda tugaydi, tez otish o'chadi */
export function endRealmSuper(rp: RealmPlayer) {
  rp.cast = null;
  rp.p.endCast();
}

/** Superning zarari: ekrandagi moblarga (faqat moblarga — PvE) */
export function applyRealmSuper(sim: RealmSim, rp: RealmPlayer, rc: RealmCast) {
  const c = rc.cast;
  const def = c.def;
  const p = rp.p;
  const list = superTargets(sim, p);
  const kill = (m: RealmMob) => {
    if (!m.dead && sim.hit(rp, m, Math.max(m.hp, 1), 0, true)) c.kills++;
  };
  const boss = (m: RealmMob, power: number) => {
    if (m.dead) return;
    const dealt = c.bossDealt.get(m) ?? 0;
    const d = bossDamage(def, m.maxHp, dealt, power);
    if (d > 0 && sim.hit(rp, m, d, 0, true)) c.bossDealt.set(m, dealt + d);
  };
  const strike = (m: RealmMob, power = 1) => (realmBoss(m) ? boss(m, power) : kill(m));
  if (def.release !== undefined) {
    // "chik": belgilangan (kesim tekkan) hamma mob birdan
    markRelease(sim, rp, rc);
    for (const m of rc.marked) strike(m);
  } else if (def.impact && rc.spot) {
    const spot = toLocal(p, rc.spot);
    for (const m of list) {
      const zone = impactZone(def, spot, { ...toLocal(p, m), size: m.size });
      if (zone === "core") strike(m);
      else if (zone === "ring" && !realmBoss(m))
        sim.hit(rp, m, p.damage * def.impact.ringPower, def.impact.knock * 0.3, true);
    }
  } else if (def.volley) {
    const V = def.volley;
    // belgilanganlardan tiriklari (hammasi o'lgan bo'lsa — ekrandagilar)
    const pool = [...rc.marked].filter((m) => !m.dead);
    const from = pool.length ? pool : list;
    const aim = volleyTargets(
      p,
      from.filter((m) => !realmBoss(m)),
      from.filter(realmBoss),
      V.n,
    );
    for (const m of aim) if (m) strike(m, realmBoss(m) ? V.bossPower : 1);
  } else for (const m of list) strike(m);
  if (def.heal > 0 && p.heal(def.heal)) sim.event({ type: "heal", pid: rp.id, x: p.x, y: p.y });
}
