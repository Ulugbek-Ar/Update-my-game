import { describe, expect, it } from "vitest";
import { spriteFootOffset, spritePixels, spriteSize } from "@/game/sprites";
import { loadRealmData } from "./data";
import { RealmSim, tileCenter } from "./sim";

const data = loadRealmData();

describe("Xaroba Sardori yerda yuradi", () => {
  it("walk frames change while the boss walks and the legs alternate", () => {
    const s = new RealmSim(data);
    const rp = s.addPlayer("p1", "knight");
    rp.p.takeHit = () => false;
    const w = s.mobs.find((m) => m.kind === "warden")!;
    // uyg'otib, uzoqroqda turamiz — Sardor yurib keladi
    rp.p.x = w.x - 100;
    rp.p.y = w.y;
    const frames = new Set<number>();
    for (let i = 0; i < 200; i++) {
      s.step([]);
      if (w.anim.state === "walk") frames.add(w.anim.frame);
    }
    expect(frames.size).toBeGreaterThanOrEqual(4);
    const px = [0, 1, 2, 3].map((f) => spritePixels("warden", "walk", f).join(""));
    expect(new Set(px).size).toBe(4);
  });

  it("feet always rest on the ground line (no floating)", () => {
    // oyoq tagi har kadrda yer chizig'ida: walk kadrlarida bitta oyoq doim yerda
    const walk = [0, 1, 2, 3].map((f) => spriteFootOffset("warden", "walk", f));
    expect(new Set(walk).size).toBe(1);
    expect(walk[0]).toBe(((28 + 3 - 16) * spriteSize("warden")) / 32);
    // turganda ham oyoqlar yerda (faqat tana nafas oladi)
    expect(spriteFootOffset("warden", "idle", 0)).toBe(spriteFootOffset("warden", "idle", 1));
    for (const kind of ["boar", "rat", "sentinel"] as const)
      expect(spriteFootOffset(kind, "idle", 0)).toBeGreaterThan(0);
  });

  it("never has more than one warden at a time", () => {
    const s = new RealmSim(data);
    const rp = s.addPlayer("p1", "knight");
    rp.p.takeHit = () => false;
    rp.p.damage = 6;
    let kills = 0;
    for (let i = 0; i < 20000; i++) {
      const away = i % 3000 >= 2000;
      rp.p.x = tileCenter(away ? 47 : 160);
      rp.p.y = tileCenter(away ? 97 : 108);
      const w = s.mobs.find((m) => m.kind === "warden" && !m.dead);
      if (w) {
        rp.p.fx = Math.sign(w.x - rp.p.x) || 1;
        rp.p.fy = 0;
      }
      s.step([{ pid: "p1", cmd: { type: "attack", down: i % 4 === 0 } }]);
      kills += s.events.filter((e) => e.type === "kill" && e.kind === "warden").length;
      expect(s.mobs.filter((m) => m.kind === "warden").length).toBeLessThanOrEqual(1);
    }
    expect(kills).toBeGreaterThan(0);
  });
});
