import { describe, expect, it } from "vitest";
import { loadRealmData } from "./data";
import {
  DAY_START,
  DAY_TICKS,
  RealmSim,
  SUBMERGED_R,
  tileCenter,
  type PlayerCommand,
  type RealmPlayer,
} from "./sim";
import { Rng } from "./rng";
import { TILE, TILE_IDS } from "./tiles";
import type { Hero } from "@/game/hero";

const data = loadRealmData();

function sim(hero: Hero = "knight") {
  const s = new RealmSim(data);
  const rp = s.addPlayer("p1", hero);
  return { s, rp };
}

/** O'yinchini plitkaga qo'yadi va yuzini burади. */
function place(rp: RealmPlayer, tx: number, ty: number, fx = 0, fy = 1) {
  rp.p.x = tileCenter(tx);
  rp.p.y = tileCenter(ty);
  rp.p.fx = fx;
  rp.p.fy = fy;
}

function run(s: RealmSim, ticks: number, cmds: (t: number) => PlayerCommand[] = () => []) {
  for (let i = 0; i < ticks; i++) s.step(cmds(i));
}

const cmd = (c: PlayerCommand["cmd"]): PlayerCommand[] => [{ pid: "p1", cmd: c }];

/** Tunga o'tkazish (tick'ni sozlash). */
function setNight(s: RealmSim) {
  s.tick = Math.ceil((0.75 - DAY_START) * DAY_TICKS);
  expect(s.night).toBe(true);
}

describe("RealmSim determinizmi", () => {
  it("same commands produce the same state", () => {
    const script = (seed: number) => {
      const r = new Rng(seed);
      const list: PlayerCommand[][] = [];
      for (let i = 0; i < 1200; i++) {
        const c: PlayerCommand[] = [];
        if (i % 15 === 0)
          c.push({ pid: "p1", cmd: { type: "move", x: r.int(3) - 1, y: r.int(3) - 1 } });
        if (r.next() < 0.1) c.push({ pid: "p1", cmd: { type: "attack", down: true } });
        if (r.next() < 0.1) c.push({ pid: "p1", cmd: { type: "attack", down: false } });
        if (r.next() < 0.03) c.push({ pid: "p1", cmd: { type: "ability", down: true } });
        if (r.next() < 0.03) c.push({ pid: "p1", cmd: { type: "ability", down: false } });
        list.push(c);
      }
      return list;
    };
    for (const hero of ["knight", "mage", "hunter"] as Hero[]) {
      const a = sim(hero),
        b = sim(hero);
      // to'ng'izlar o'tlog'ida — jang ham determinizmga kiradi
      place(a.rp, 112, 64);
      place(b.rp, 112, 64);
      const cmds = script(7);
      run(a.s, cmds.length, (t) => cmds[t]!);
      run(b.s, cmds.length, (t) => cmds[t]!);
      expect(a.s.digest()).toBe(b.s.digest());
      expect(a.s.tick).toBe(1200);
    }
  });

  it("different commands diverge", () => {
    const a = sim(),
      b = sim();
    run(a.s, 40, () => cmd({ type: "move", x: 1, y: 0 }));
    run(b.s, 40, () => cmd({ type: "move", x: -1, y: 0 }));
    expect(a.s.digest()).not.toBe(b.s.digest());
  });

  it("runs at a fixed 20 Hz tick without DOM time", () => {
    const { s, rp } = sim();
    const x0 = rp.p.x;
    run(s, 20, () => cmd({ type: "move", x: 1, y: 0 }));
    // 1 soniya, Ritsar 90 px/s
    expect(rp.p.x - x0).toBeCloseTo(90, 0);
  });
});

describe("Xarita va to'qnashuv", () => {
  it("spawn is walkable and the map is 6x6 chunks", () => {
    const { s, rp } = sim();
    expect(s.map.w).toBe(192);
    expect(s.map.h).toBe(192);
    expect(s.boxBlocked(rp.p.x, rp.p.y, rp.p.size)).toBe(false);
  });

  it("water, walls and trees block the player", () => {
    const { s, rp } = sim();
    // daryo qirg'og'idan sharqqa yurish — suvga kirolmaydi
    place(rp, 94, 134);
    run(s, 40, () => cmd({ type: "move", x: 1, y: 0 }));
    expect(s.tileAt(Math.floor(rp.p.x / TILE), Math.floor(rp.p.y / TILE))).not.toBe(TILE_IDS.water);
    expect(rp.p.x).toBeLessThan(tileCenter(96));
  });

  it("mage teleport cannot pass through a wall", () => {
    const { s, rp } = sim("mage");
    // yoriq devor oldida (xaroba janubi), pastga qarab teleport
    place(rp, 140, 129);
    run(s, 2, () => cmd({ type: "ability", down: true }));
    run(s, 10, () => cmd({ type: "ability", down: false }));
    expect(rp.p.y).toBeLessThan(130 * TILE);
  });
});

describe("Topshiriqlar", () => {
  function talk(s: RealmSim, rp: RealmPlayer, npc: string) {
    const n = s.region.npcs.find((n) => n.id === npc)!;
    place(rp, n.x, n.y + 1, 0, -1);
    run(s, 1, () => cmd({ type: "interact" }));
    expect(rp.ui?.kind).toBe("dialog");
  }
  function pick(s: RealmSim, rp: RealmPlayer, text: string) {
    const i = s.visibleChoices(rp).findIndex((c) => c.text.startsWith(text));
    expect(i).toBeGreaterThanOrEqual(0);
    run(s, 1, () => cmd({ type: "choose", index: i }));
  }

  it("kill quest: elder -> 4 boars -> reward", () => {
    const { s, rp } = sim();
    talk(s, rp, "elder");
    pick(s, rp, "Senga qanday");
    pick(s, rp, "Mayli");
    expect(s.questStatus(rp, "boars")).toBe("active");
    // o'tloqda to'ng'izlarni o'ldirish (o'yinchi jon yo'qotmaydi)
    rp.p.takeHit = () => false;
    for (let t = 0; t < 20 * 120 && s.questStatus(rp, "boars") === "active"; t++) {
      const boar = s.mobs.find((m) => m.kind === "boar" && !m.dead && m.zone === "boars");
      const c: PlayerCommand[] = [];
      if (boar) {
        rp.p.x = boar.x - 14;
        rp.p.y = boar.y;
        c.push({ pid: "p1", cmd: { type: "aim", x: 1, y: 0 } });
        if (t % 9 === 0) c.push({ pid: "p1", cmd: { type: "attack", down: true } });
        if (t % 9 === 1) c.push({ pid: "p1", cmd: { type: "attack", down: false } });
      }
      s.step(c);
    }
    expect(s.questStatus(rp, "boars")).toBe("ready");
    const gold = rp.gold;
    talk(s, rp, "elder");
    pick(s, rp, "To'ng'izlarni");
    expect(s.questStatus(rp, "boars")).toBe("done");
    expect(rp.gold).toBe(gold + 25);
    expect(s.countItem(rp, "bread")).toBe(2);
  });

  it("talk + find + deliver quest gives the amulet (+1 heart)", () => {
    const { s, rp } = sim();
    rp.quests["boars"] = { status: "done", step: 1, progress: 0 };
    talk(s, rp, "elder");
    pick(s, rp, "Yana ish");
    pick(s, rp, "Boraman");
    expect(rp.quests["ruins"]).toMatchObject({ status: "active", step: 0 });
    talk(s, rp, "merchant");
    expect(rp.quests["ruins"]!.step).toBe(1);
    run(s, 1, () => cmd({ type: "close" }));
    place(rp, 140, 108);
    run(s, 6);
    expect(rp.quests["ruins"]!.step).toBe(2);
    s.addItem(rp, "core", 2);
    const maxHp = rp.p.maxHp;
    talk(s, rp, "elder");
    expect(s.countItem(rp, "core")).toBe(0);
    expect(s.questStatus(rp, "ruins")).toBe("ready");
    pick(s, rp, "Tosh yurak");
    expect(s.questStatus(rp, "ruins")).toBe("done");
    expect(s.countItem(rp, "amulet")).toBe(1);
    expect(rp.p.maxHp).toBe(maxHp + 1);
  });

  it("merchant sells bread for gold", () => {
    const { s, rp } = sim();
    rp.gold = 10;
    talk(s, rp, "merchant");
    pick(s, rp, "Nimalar");
    expect(rp.ui?.kind).toBe("shop");
    run(s, 1, () => cmd({ type: "buy", item: "bread" }));
    expect(rp.gold).toBe(4);
    expect(s.countItem(rp, "bread")).toBe(1);
    run(s, 1, () => cmd({ type: "buy", item: "potion" }));
    expect(s.countItem(rp, "potion")).toBe(0);
    const slot = rp.inv.findIndex((x) => x?.item === "bread");
    run(s, 1, () => cmd({ type: "sell", slot }));
    expect(rp.gold).toBe(6);
  });
});

describe("Sirlar", () => {
  it("breakable wall opens after 3 hits", () => {
    const { s, rp } = sim();
    place(rp, 140, 129, 0, 1);
    for (let i = 0; i < 3; i++) {
      run(s, 1, () => cmd({ type: "attack", down: true }));
      run(s, 12, () => cmd({ type: "attack", down: false }));
    }
    expect(s.tileAt(140, 130)).toBe(TILE_IDS.rubble);
    expect(rp.secrets).toContain("s-wall");
    // yo'lak ochildi — ichkariga yurib kiradi
    run(s, 20, () => cmd({ type: "move", x: 0, y: 1 }));
    expect(rp.p.y).toBeGreaterThan(131 * TILE);
  });

  it("night door opens only at night", () => {
    const { s, rp } = sim();
    place(rp, 136, 94, 0, -1);
    run(s, 1, () => cmd({ type: "interact" }));
    expect(s.doorOpen("door-night")).toBe(false);
    expect(rp.secrets).not.toContain("s-door");
    setNight(s);
    run(s, 1, () => cmd({ type: "interact" }));
    expect(s.doorOpen("door-night")).toBe(true);
    expect(rp.secrets).toContain("s-door");
    expect(s.solidAt(136, 93)).toBe(false);
  });

  it("three tablet fragments reveal the lore", () => {
    const { s, rp } = sim();
    for (const id of ["frag-cave", "frag-stones", "frag-niche"]) {
      const o = s.object(id)!;
      place(rp, o.x, o.y + 1, 0, -1);
      run(s, 1, () => cmd({ type: "interact" }));
    }
    expect(rp.fragments).toHaveLength(3);
    expect(rp.secrets).toContain("s-tablet");
    expect(rp.ui).toEqual({ kind: "lore", secret: "s-tablet" });
  });

  it("the river chest is found by searching from the bank", () => {
    const { s, rp } = sim();
    const o = s.object("chest-river")!;
    expect(s.tileAt(o.x, o.y)).toBe(TILE_IDS.water);
    // UI uni ko'rsatmaydi
    expect(s.visible(rp, o)).toBe(false);
    place(rp, o.x - 2, o.y, 1, 0);
    expect(s.boxBlocked(rp.p.x, rp.p.y, rp.p.size)).toBe(false);
    expect(Math.hypot(rp.p.x - tileCenter(o.x), 0)).toBeLessThan(SUBMERGED_R);
    expect(s.interactTarget(rp)).toBeNull();
    run(s, 1, () => cmd({ type: "interact" }));
    expect(rp.secrets).toContain("s-river");
    expect(s.countItem(rp, "coin")).toBe(1);
  });

  it("torches must be lit in the right order", () => {
    const { s, rp } = sim();
    const light = (id: string) => {
      const o = s.object(id)!;
      place(rp, o.x, o.y + 1, 0, -1);
      run(s, 1, () => cmd({ type: "interact" }));
    };
    light("torch-moon");
    light("torch-star");
    expect(rp.torchStep).toBe(0);
    expect(rp.secrets).not.toContain("s-torches");
    const chest = s.object("chest-torches")!;
    expect(s.visible(rp, chest)).toBe(false);
    light("torch-moon");
    light("torch-sun");
    light("torch-star");
    expect(rp.secrets).toContain("s-torches");
    expect(s.visible(rp, chest)).toBe(true);
    expect(s.tileAt(147, 86)).toBe(TILE_IDS.stairs);
  });

  it("all five secrets count as discoveries", () => {
    expect(data.region.secrets.map((x) => x.type).sort()).toEqual(
      ["breakwall", "nightdoor", "riverchest", "tablet", "torches"].sort(),
    );
  });
});

describe("Moblar", () => {
  it("a mob leashes back home and heals when the player runs away", () => {
    const { s, rp } = sim();
    rp.p.takeHit = () => false;
    const boar = s.mobs.find((m) => m.kind === "boar" && m.zone === "boars")!;
    place(rp, Math.floor(boar.x / TILE) - 3, Math.floor(boar.y / TILE));
    run(s, 4);
    expect(boar.target).toBe("p1");
    boar.hp = 2;
    // uzoqqa qochish (g'arbga, o'yinchi devordan o'tmasin — to'g'ridan-to'g'ri ko'chiramiz)
    for (let i = 0; i < 400 && boar.state !== "return"; i++) {
      rp.p.x = boar.x - 60;
      rp.p.y = boar.y;
      s.step();
    }
    expect(boar.state).toBe("return");
    place(rp, 47, 97);
    run(s, 20 * 20);
    expect(boar.state === "idle" || boar.state === "wander").toBe(true);
    expect(boar.hp).toBe(boar.maxHp);
    expect(Math.hypot(boar.x - boar.homeX, boar.y - boar.homeY)).toBeLessThan(70);
  });

  it("night spawns wisps, day removes them", () => {
    const { s } = sim();
    expect(s.mobs.some((m) => m.kind === "wisp")).toBe(false);
    setNight(s);
    run(s, 40);
    expect(s.mobs.some((m) => m.kind === "wisp")).toBe(true);
    s.tick = Math.ceil((1.2 - DAY_START) * DAY_TICKS);
    expect(s.night).toBe(false);
    run(s, 60);
    expect(s.mobs.some((m) => m.kind === "wisp" && !m.dead)).toBe(false);
  });

  it("Xaroba Sardori telegraphs attacks and enrages at half health", () => {
    const { s, rp } = sim();
    rp.p.takeHit = () => false;
    const w = s.mobs.find((m) => m.kind === "warden")!;
    expect(w.state).toBe("dormant");
    rp.p.x = w.x - 40;
    rp.p.y = w.y;
    let marked = false;
    for (let i = 0; i < 80; i++) {
      s.step();
      if (s.marks.some((k) => k.owner === w.id)) marked = true;
    }
    expect(marked).toBe(true);
    w.hp = w.maxHp / 2 + 1;
    run(s, 1, () => cmd({ type: "aim", x: 1, y: 0 }));
    rp.p.x = w.x - 20;
    rp.p.y = w.y;
    for (let i = 0; i < 40 && w.phase === 1; i++) {
      s.step(
        i % 10 === 0 ? cmd({ type: "attack", down: true }) : cmd({ type: "attack", down: false }),
      );
      rp.p.x = w.x - 20;
      rp.p.y = w.y;
    }
    expect(w.phase).toBe(2);
    expect(s.events.length + 1).toBeGreaterThan(0);
  });

  it("killing the warden drops the legendary blade", () => {
    const { s, rp } = sim();
    const w = s.mobs.find((m) => m.kind === "warden")!;
    rp.p.takeHit = () => false;
    run(s, 12);
    w.hp = 1;
    w.state = "chase";
    w.target = "p1";
    rp.p.x = w.x - 20;
    rp.p.y = w.y;
    run(s, 1, () => cmd({ type: "aim", x: 1, y: 0 }));
    run(s, 1, () => cmd({ type: "attack", down: true }));
    run(s, 3, () => cmd({ type: "attack", down: false }));
    expect(w.dead).toBe(true);
    expect(s.items.some((i) => i.item === "wardblade")).toBe(true);
  });
});

describe("Saqlash", () => {
  it("player and world round-trip through the realm save", () => {
    const { s, rp } = sim();
    rp.gold = 33;
    s.addItem(rp, "potion", 2);
    rp.secrets.push("s-wall");
    s.setTile(140, 130, TILE_IDS.rubble);
    place(rp, 60, 95);
    s.explore(rp);
    const save = JSON.parse(JSON.stringify(s.savePlayer("p1")));
    const world = JSON.parse(JSON.stringify(s.saveWorld()));
    const s2 = new RealmSim(data);
    s2.loadWorld(world);
    const rp2 = s2.addPlayer("p1", "knight", save);
    expect(rp2.gold).toBe(33);
    expect(s2.countItem(rp2, "potion")).toBe(2);
    expect(rp2.secrets).toEqual(["s-wall"]);
    expect(s2.tileAt(140, 130)).toBe(TILE_IDS.rubble);
    expect(s2.isExplored(rp2, 60, 95)).toBe(true);
    expect(s2.isExplored(rp2, 180, 180)).toBe(false);
    expect(rp2.p.x).toBe(tileCenter(60));
  });
});
