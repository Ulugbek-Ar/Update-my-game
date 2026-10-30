import { describe, expect, it } from "vitest";
import { loadRealmData } from "./data";
import { RealmSim, tileCenter, type PlayerCommand, type RealmPlayer } from "./sim";
import { TILE } from "./tiles";
import type { RealmMob } from "./mobs";
import type { Hero } from "@/game/hero";
import { RELOAD_TIME, TRAP_HOLD } from "@/game/player";

const data = loadRealmData();

function sim(hero: Hero = "gunner") {
  const s = new RealmSim(data);
  const rp = s.addPlayer("p1", hero);
  return { s, rp };
}

const cmd = (c: PlayerCommand["cmd"]): PlayerCommand[] => [{ pid: "p1", cmd: c }];

function run(s: RealmSim, ticks: number, cmds: (t: number) => PlayerCommand[] = () => []) {
  for (let i = 0; i < ticks; i++) s.step(cmds(i));
}

function talk(s: RealmSim, rp: RealmPlayer, npc: string) {
  const n = s.region.npcs.find((n) => n.id === npc)!;
  rp.p.x = tileCenter(n.x);
  rp.p.y = tileCenter(n.y + 1);
  rp.p.fx = 0;
  rp.p.fy = -1;
  run(s, 1, () => cmd({ type: "interact" }));
  expect(rp.ui?.kind).toBe("dialog");
}

function pick(s: RealmSim, rp: RealmPlayer, text: string) {
  const i = s.visibleChoices(rp).findIndex((c) => c.text.startsWith(text));
  expect(i, text).toBeGreaterThanOrEqual(0);
  run(s, 1, () => cmd({ type: "choose", index: i }));
}

/** Shift'ni bosib turish: tutun bombasi. */
function smokeBomb(s: RealmSim) {
  const hold = Math.ceil(TRAP_HOLD * 20) + 2;
  run(s, hold, (t) => (t === 0 ? cmd({ type: "ability", down: true }) : []));
  run(s, 1, () => cmd({ type: "ability", down: false }));
}

describe("Mergan Abadiyat olamida", () => {
  it("shoots bullets, the cylinder empties and R reloads it", () => {
    const { s, rp } = sim();
    rp.p.fx = 1;
    rp.p.fy = 0;
    run(s, 1, () => cmd({ type: "attack", down: true }));
    run(s, 1, () => cmd({ type: "attack", down: false }));
    expect(s.projectiles.some((b) => b.bullet)).toBe(true);
    expect(rp.p.ammo).toBe(5);
    run(s, 1, () => cmd({ type: "reload" }));
    expect(rp.p.reloading).toBe(true);
    run(s, Math.ceil(RELOAD_TIME * 20) + 1);
    expect(rp.p.ammo).toBe(6);
  });

  it("a bullet fades after its range instead of flying across the map", () => {
    const { s, rp } = sim();
    rp.p.fx = 0;
    rp.p.fy = 1;
    run(s, 1, () => cmd({ type: "attack", down: true }));
    const b = s.projectiles.find((x) => x.bullet)!;
    expect(b.range).toBeGreaterThan(0);
    run(s, 20);
    expect(s.projectiles.includes(b)).toBe(false);
  });

  it("in the smoke mobs lose Mergan and go home; once seen again they notice him", () => {
    const { s, rp } = sim();
    rp.p.takeHit = () => false;
    const boar = s.mobs.find((m) => m.kind === "boar" && m.zone === "boars")!;
    rp.p.x = boar.x - 3 * TILE;
    rp.p.y = boar.y;
    run(s, 4);
    expect(boar.target).toBe("p1");
    smokeBomb(s);
    expect(s.smokes).toHaveLength(1);
    expect(rp.p.hidden).toBe(true);
    for (let i = 0; i < 30 && boar.target; i++) s.step();
    expect(boar.target).toBeNull();
    // nishonni yo'qotgan mob uyiga qaytadi (yoki allaqachon qaytib bo'lgan)
    expect(["return", "idle", "wander"]).toContain(boar.state);
    // tutun tarqab, Mergan yana ko'rinadi — yaqin turgan mob uni payqaydi
    run(s, 80);
    expect(rp.p.hidden).toBe(false);
    rp.p.x = boar.x - 3 * TILE;
    rp.p.y = boar.y;
    for (let i = 0; i < 20 && boar.target !== "p1"; i++) s.step();
    expect(boar.target).toBe("p1");
  });

  it("leaving the smoke reveals Mergan; mobs inside the smoke move at half speed", () => {
    const { s, rp } = sim();
    smokeBomb(s);
    expect(rp.p.hidden).toBe(true);
    rp.p.x += 80;
    s.step();
    expect(rp.p.hidden).toBe(false);
    const mob = s.mobs.find((m) => m.kind === "boar")!;
    const ctx = (s as unknown as { mobCtx: { move(b: RealmMob, dx: number, dy: number): boolean } })
      .mobCtx;
    const step = () => {
      const x0 = mob.x;
      ctx.move(mob, 4, 0);
      return mob.x - x0;
    };
    const free = step();
    s.smokes.push({ x: mob.x, y: mob.y, life: 3 });
    expect(step()).toBeCloseTo(free / 2, 5);
  });
});

describe("Qari Mergan", () => {
  it("stands in the village and greets his pupil differently", () => {
    const npc = data.region.npcs.find((n) => n.id === "oldgunner")!;
    expect(npc.name).toBe("QARI MERGAN");
    expect(npc.sprite).toBe("oldgunner");
    const knight = sim("knight");
    talk(knight.s, knight.rp, "oldgunner");
    expect(knight.rp.ui).toMatchObject({ node: "hello" });
    expect(data.dialogs["oldgunner"]!.nodes["hello"]!.text[0]).toContain("Qari Mergan");
    const pupil = sim("gunner");
    talk(pupil.s, pupil.rp, "oldgunner");
    expect(pupil.rp.ui).toMatchObject({ node: "pupil" });
    expect(data.dialogs["oldgunner"]!.nodes["pupil"]!.text[0]).toContain("shogirdim");
    expect(pupil.s.visibleChoices(pupil.rp).some((c) => c.text.startsWith("Ustoz"))).toBe(true);
  });

  it("his quest: hunt 3 swamp rats, come back for gold and the brass casing", () => {
    const { s, rp } = sim("knight");
    talk(s, rp, "oldgunner");
    pick(s, rp, "Yordam kerakmi");
    pick(s, rp, "Ovlab kelaman");
    expect(s.questStatus(rp, "powder")).toBe("active");
    const kill = (s as unknown as { killMob(m: RealmMob, rp: RealmPlayer): void }).killMob.bind(s);
    const rats = s.mobs.filter((m) => m.kind === "rat").slice(0, 3);
    expect(rats).toHaveLength(3);
    s.events = [];
    for (const m of rats) kill(m, rp);
    expect(s.questStatus(rp, "powder")).toBe("ready");
    expect(s.events.some((e) => e.type === "quest" && e.text.includes("Qari Merganga qayt"))).toBe(
      true,
    );
    const gold = rp.gold;
    const speed = rp.p.speed;
    talk(s, rp, "oldgunner");
    pick(s, rp, "Kalamushlarni ovladim");
    expect(s.questStatus(rp, "powder")).toBe("done");
    expect(rp.gold).toBe(gold + 30);
    expect(s.countItem(rp, "casing")).toBe(1);
    // mis gilza inventarda tez yurgizadi
    expect(rp.p.speed).toBe(speed + 6);
  });
});
