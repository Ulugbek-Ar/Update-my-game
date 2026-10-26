import { describe, expect, it } from "vitest";
import { Enemy } from "./enemy";
import { Player } from "./player";

/** Faol (paydo bo'lib bo'lgan) dushmanni dt qadamlari bilan yuritadi. */
function run(e: Enemy, p: Player, seconds: number, dt = 0.02) {
  for (let t = 0; t < seconds; t += dt) e.update(dt, p);
}

function archerAt(dist: number) {
  const p = new Player();
  p.x = 160;
  p.y = 120;
  const e = new Enemy("archer", 160 - dist, 120);
  return { e, p };
}

describe("Kamonchi skelet", () => {
  it("has skeleton-sized collision and 3 HP", () => {
    const { e } = archerAt(90);
    expect(e.size).toBe(14);
    expect(e.hp).toBe(3);
  });

  it("fires one arrow every 1.5s, aimed at the player", () => {
    const { e, p } = archerAt(90);
    run(e, p, 1.4);
    expect(e.shots.length).toBe(0);
    run(e, p, 0.2);
    expect(e.shots.length).toBe(1);
    const a = e.shots[0]!;
    expect(Math.hypot(a.vx, a.vy)).toBeCloseTo(110, 0);
    // o'yinchi o'ng tomonda — o'q o'ngga uchadi
    expect(a.vx).toBeGreaterThan(100);
    run(e, p, 1.5);
    expect(e.shots.length).toBe(2);
  });

  it("stands still and plays the attack animation while drawing the bow", () => {
    const { e, p } = archerAt(90);
    run(e, p, 1.1);
    expect(e.anim.state).toBe("attack");
    const x = e.x;
    run(e, p, 0.3);
    expect(e.x).toBe(x);
  });

  it("backs away when the player is close and closes in when far", () => {
    const near = archerAt(40);
    run(near.e, near.p, 0.5);
    expect(near.p.x - near.e.x).toBeGreaterThan(40);

    const far = archerAt(140);
    run(far.e, far.p, 0.5);
    expect(far.p.x - far.e.x).toBeLessThan(140);
  });

  it("does not shoot while spawning", () => {
    const { e, p } = archerAt(90);
    e.spawn = 2;
    run(e, p, 1.9);
    expect(e.shots.length).toBe(0);
  });
});
