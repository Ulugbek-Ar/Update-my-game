import { describe, expect, it } from "vitest";
import {
  Enemy,
  ARCHER_DRAW,
  ARCHER_NOCK,
  ARCHER_RELEASE,
  ARCHER_RELOAD,
  BOW_OFFSET_X,
  BOW_OFFSET_Y,
} from "./enemy";
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

  it("nocks, holds the full draw until the shot, and releases on the same update as the arrow", () => {
    const { e, p } = archerAt(90);
    const dt = 0.01;
    const frames: string[] = [];
    let shotAt = -1;
    for (let i = 0; i < 200 && shotAt < 0; i++) {
      e.update(dt, p);
      frames.push(e.anim.state === "attack" ? `a${e.anim.frame}` : e.anim.state);
      if (e.shots.length) shotAt = i;
    }
    // o'q aynan 1.5s da chiqadi
    expect((shotAt + 1) * dt).toBeCloseTo(ARCHER_RELOAD, 1);
    // o'q chiqqan update'da — qo'yib yuborish kadri, undan oldin — to'liq tortish
    expect(frames[shotAt]).toBe("a2");
    expect(frames[shotAt - 1]).toBe("a1");
    expect(frames.slice(0, shotAt).includes("a2")).toBe(false);
    // tortish oynasi: avval qo'yish (a0), so'ng to'liq tortish (a1)
    const drawStart = frames.indexOf("a0");
    expect((shotAt - drawStart) * dt).toBeCloseTo(ARCHER_DRAW, 1);
    const fullDraw = frames.indexOf("a1");
    expect((fullDraw - drawStart) * dt).toBeCloseTo(ARCHER_NOCK, 1);
    expect(frames.slice(fullDraw, shotAt).every((f) => f === "a1")).toBe(true);
    // qo'yib yuborish kadri biroz ko'rinib turadi, keyin yana yuradi
    run(e, p, ARCHER_RELEASE - 0.05, dt);
    expect(e.anim.state === "attack" && e.anim.frame === 2).toBe(true);
    run(e, p, 0.1, dt);
    expect(e.anim.state).toBe("walk");
  });

  it("keeps the 1.5s reload cadence with the new frames", () => {
    const { e, p } = archerAt(90);
    const times: number[] = [];
    for (let i = 1; i <= 500; i++) {
      const before = e.shots.length;
      e.update(0.01, p);
      if (e.shots.length > before) times.push(i * 0.01);
    }
    expect(times.length).toBe(3);
    expect(times[1]! - times[0]!).toBeCloseTo(ARCHER_RELOAD, 1);
    expect(times[2]! - times[1]!).toBeCloseTo(ARCHER_RELOAD, 1);
  });

  it("faces the player and shoots from the bow on that side", () => {
    // o'yinchi o'ngda
    const r = archerAt(90);
    run(r.e, r.p, 1.52);
    expect(r.e.facingLeft).toBe(false);
    const ar = r.e.shots[0]!;
    expect(ar.x).toBeCloseTo(r.e.x + BOW_OFFSET_X, 0);
    expect(ar.y).toBeCloseTo(r.e.y + BOW_OFFSET_Y, 0);

    // o'yinchi chapda
    const p = new Player();
    p.x = 60;
    p.y = 120;
    const e = new Enemy("archer", 150, 120);
    run(e, p, 1.52);
    expect(e.facingLeft).toBe(true);
    const al = e.shots[0]!;
    expect(al.x).toBeCloseTo(e.x - BOW_OFFSET_X, 0);
    expect(al.vx).toBeLessThan(0);
  });

  it("does not shoot while spawning", () => {
    const { e, p } = archerAt(90);
    e.spawn = 2;
    run(e, p, 1.9);
    expect(e.shots.length).toBe(0);
  });
});
