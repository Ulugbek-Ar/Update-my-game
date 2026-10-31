import { describe, expect, it } from "vitest";
import { SWITCH_RATIO, TANK_THREAT, ThreatTable, threatMul } from "./threat";
import { loadRealmData } from "@/realm/data";
import { RealmSim, type RealmPlayer } from "@/realm/sim";
import { TRAP_HOLD, VOW_TIME } from "./player";
import type { RealmMob } from "@/realm/mobs";

describe("Xavf jadvali", () => {
  it("tank threat counts double", () => {
    expect(threatMul("paladin")).toBe(TANK_THREAT);
    expect(threatMul("knight")).toBe(1);
    const t = new ThreatTable();
    t.add("tank", 3, "paladin");
    t.add("dps", 5, "hunter");
    expect(t.get("tank")).toBe(6);
    expect(t.pick([{ id: "dps" }, { id: "tank" }])?.id).toBe("tank");
  });

  it("does not flip-flop: a new target needs clearly more threat", () => {
    const t = new ThreatTable();
    t.add("a", 10, "knight");
    t.add("b", 10 * SWITCH_RATIO - 0.5, "knight");
    expect(t.pick([{ id: "a" }, { id: "b" }], "a")?.id).toBe("a");
    t.add("b", 2, "knight");
    expect(t.pick([{ id: "a" }, { id: "b" }], "a")?.id).toBe("b");
  });

  it("taunt forces the target while it lasts, then the tank stays on top", () => {
    const t = new ThreatTable();
    t.add("dps", 50, "mage");
    t.taunt("tank", 4);
    expect(t.pick([{ id: "dps" }, { id: "tank" }], "dps")?.id).toBe("tank");
    t.update(4.1);
    expect(t.forced).toBeNull();
    expect(t.pick([{ id: "dps" }, { id: "tank" }], "tank")?.id).toBe("tank");
  });

  it("single-player: the only candidate is always the target", () => {
    const t = new ThreatTable();
    expect(t.pick([{ id: "me" }])?.id).toBe("me");
    t.taunt("me", 1);
    expect(t.pick([{ id: "me" }])?.id).toBe("me");
    expect(t.pick([])).toBeNull();
  });
});

describe("Onlayn: tank Sardorni ushlab turadi", () => {
  const data = loadRealmData();

  /** Ikki o'yinchi (Ovchi va Paladin) uyg'ongan Sardor yonida; ikkalasi zarar olmaydi. */
  function raid() {
    const s = new RealmSim(data);
    const dps = s.addPlayer("dps", "hunter");
    const tank = s.addPlayer("tank", "paladin");
    for (const rp of [dps, tank]) rp.p.takeHit = () => false;
    const w = s.mobs.find((m) => m.kind === "warden")!;
    dps.p.x = w.x - 50;
    dps.p.y = w.y;
    tank.p.x = w.x + 50;
    tank.p.y = w.y;
    for (let i = 0; i < 40; i++) s.step();
    w.state = "chase";
    w.cd = 99;
    return { s, dps, tank, w };
  }

  const hit = (s: RealmSim, rp: RealmPlayer, m: RealmMob, d: number) =>
    (s as unknown as { hit(rp: RealmPlayer, m: RealmMob, d: number, k: number): boolean }).hit(
      rp,
      m,
      d,
      0,
    );

  it("the boss chases whoever generates the most threat", () => {
    const { s, dps, w } = raid();
    w.stun = 0;
    w.state = "recover";
    hit(s, dps, w, 6);
    w.state = "chase";
    s.step();
    expect(w.target).toBe("dps");
  });

  it("when the tank swears QASAM the boss switches to the tank and stays there", () => {
    const { s, dps, tank, w } = raid();
    w.state = "recover";
    hit(s, dps, w, 8);
    w.state = "chase";
    s.step();
    expect(w.target).toBe("dps");
    // Paladin Sardor yoniga keldi va Shift'ni bosib turadi — QASAM
    tank.p.x = w.x + 30;
    tank.p.y = w.y;
    s.command(tank, { type: "ability", down: true });
    for (let t = 0; t < TRAP_HOLD + 0.1; t += 0.05) s.step();
    expect(tank.p.vowing).toBe(true);
    expect(w.target).toBe("tank");
    // QASAM davomida Ovchi urib tursa ham boss tankda qoladi
    for (let i = 0; i < 20; i++) {
      w.cd = 99;
      if (i % 5 === 0) hit(s, dps, w, 1);
      s.step();
      expect(w.target).toBe("tank");
    }
    s.command(tank, { type: "ability", down: false });
    // QASAM tugagandan keyin ham tank xavf ro'yxatining tepasida
    for (let t = 0; t < VOW_TIME; t += 0.05) {
      w.cd = 99;
      s.step();
    }
    expect(tank.p.vowing).toBe(false);
    expect(w.target).toBe("tank");
  });
});
