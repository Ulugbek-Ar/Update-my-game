import { describe, expect, it } from "vitest";
import { Player, DASH_GUARD, DASH_GUARD_MAX } from "./player";
import { Input } from "./input";
import type { Hero } from "./hero";

const DT = 1 / 60;

function step(p: Player, input: Input, seconds: number) {
  for (let t = 0; t < seconds - 1e-9; t += DT) {
    p.update(DT, input);
    input.endFrame();
  }
}

/**
 * Dash/teleport/sakrash/sirpanishni boshlaydi (Ovchi va Merganda qisqa bosish — qo'yib
 * yuborilganda sakraydi/sirpanadi).
 */
function dash(p: Player, input: Input) {
  input.pressDash();
  if (p.hunter || p.gunner) {
    input.setTouchDash(true);
    p.update(DT, input);
    input.endFrame();
    input.setTouchDash(false);
  }
  p.update(DT, input);
  input.endFrame();
}

/** Dash tugaguncha yuradi; dash tugagan kadrda to'xtaydi. */
function untilDashEnds(p: Player, input: Input) {
  for (let i = 0; i < 100 && p.dashing; i++) {
    p.update(DT, input);
    input.endFrame();
  }
}

const HEROES: Hero[] = ["knight", "mage", "hunter", "gunner"];

describe("Dash himoya dumi", () => {
  for (const hero of HEROES) {
    describe(hero, () => {
      it("protects from the very frame the dash starts", () => {
        const p = new Player(hero);
        const input = new Input();
        dash(p, input);
        expect(p.dashing).toBe(true);
        expect(p.takeHit(1, p.x + 4, p.y, 100)).toBe(false);
        expect(p.hp).toBe(p.maxHp);
      });

      it("keeps a 0.2s guard after the dash ends, then takes hits again", () => {
        const p = new Player(hero);
        const input = new Input();
        dash(p, input);
        untilDashEnds(p, input);
        // dash tugagan kadrda — eski xato: zarar o'tardi
        expect(p.dashing).toBe(false);
        expect(p.guarded).toBe(true);
        expect(p.takeHit(1, p.x + 4, p.y, 100)).toBe(false);
        step(p, input, DASH_GUARD - 0.05);
        expect(p.takeHit(1, p.x + 4, p.y, 100)).toBe(false);
        step(p, input, 0.08);
        expect(p.guarded).toBe(false);
        expect(p.takeHit(1, p.x + 4, p.y, 100)).toBe(true);
        expect(p.hp).toBe(p.maxHp - 1);
      });

      it("extends the guard while inside an enemy, but never past 0.35s", () => {
        const p = new Player(hero);
        const input = new Input();
        dash(p, input);
        untilDashEnds(p, input);
        p.inFoe = true;
        step(p, input, DASH_GUARD + 0.08);
        expect(p.guarded).toBe(true);
        expect(p.takeHit(1, p.x + 4, p.y, 100)).toBe(false);
        step(p, input, DASH_GUARD_MAX - DASH_GUARD);
        expect(p.guarded).toBe(false);
        expect(p.takeHit(1, p.x + 4, p.y, 100)).toBe(true);
      });

      it("leaving the enemy ends the extended guard", () => {
        const p = new Player(hero);
        const input = new Input();
        dash(p, input);
        untilDashEnds(p, input);
        p.inFoe = true;
        step(p, input, DASH_GUARD + 0.05);
        p.inFoe = false;
        step(p, input, DT);
        expect(p.guarded).toBe(false);
        expect(p.takeHit(1, p.x + 4, p.y, 100)).toBe(true);
      });

      it("webs and roots cannot snare during the dash", () => {
        const p = new Player(hero);
        const input = new Input();
        dash(p, input);
        expect(p.ensnare(2)).toBe(false);
        expect(p.snare).toBe(0);
        untilDashEnds(p, input);
        step(p, input, DASH_GUARD_MAX);
        expect(p.ensnare(2)).toBe(true);
        expect(p.snare).toBe(2);
      });

      it("does not change dash cooldowns", () => {
        const p = new Player(hero);
        const input = new Input();
        const cd = p.dashCd;
        dash(p, input);
        expect(p.dashCooldown).toBeCloseTo(cd, 1);
        expect(cd).toBe(hero === "knight" ? 0.8 : 0.9);
      });
    });
  }
});
