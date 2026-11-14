import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  BUBBLE_IN,
  BUBBLE_OUT,
  BUBBLE_TIME,
  PORTAL_SPARKS,
  bubbleLook,
  drawWaving,
  flagWave,
  portalSpark,
} from "./realmFx";
import { NET_VERSION, type NetPlayer, type SnapshotMsg } from "./net/protocol";
import { RealmMirror } from "./net/mirror";
import { loadRealmData } from "./data";
import { TURN_TIME } from "@/game/heroAnim";

describe("Onlayn olam: vizual qatlam (faqat klient)", () => {
  it("chat bubbles appear softly (rise and grow), stay, then fade out", () => {
    const start = bubbleLook(BUBBLE_TIME);
    expect(start.alpha).toBe(0);
    expect(start.rise).toBeGreaterThan(0);
    expect(start.scale).toBeLessThan(1);
    const mid = bubbleLook(BUBBLE_TIME - BUBBLE_IN - 0.01);
    expect(mid).toEqual({ alpha: 1, rise: 0, scale: 1 });
    expect(bubbleLook(BUBBLE_TIME / 2)).toEqual({ alpha: 1, rise: 0, scale: 1 });
    const end = bubbleLook(BUBBLE_OUT / 2);
    expect(end.alpha).toBeCloseTo(0.5, 5);
    expect(bubbleLook(0).alpha).toBe(0);
    // effektlar kamaytirilganda — darhol, harakatsiz
    expect(bubbleLook(BUBBLE_TIME, true)).toEqual({ alpha: 1, rise: 0, scale: 1 });
  });

  it("portal sparks orbit inside the arch in two opposite rings", () => {
    for (let i = 0; i < PORTAL_SPARKS; i++) {
      const a = portalSpark(i, 0),
        b = portalSpark(i, 0.3);
      expect(a).not.toEqual(b);
      for (const t of [0, 0.7, 1.9, 4.2]) {
        const [dx, dy] = portalSpark(i, t);
        // darvoza ichi: eni 12, bo'yi 21 px
        expect(Math.abs(dx)).toBeLessThanOrEqual(6);
        expect(Math.abs(dy)).toBeLessThanOrEqual(10.5);
      }
    }
    // qo'shni uchqunlar qarama-qarshi tomonga aylanadi
    const turn = (i: number) => {
      const [x0, y0] = portalSpark(i, 0),
        [x1, y1] = portalSpark(i, 0.05);
      return Math.sign(x0 * y1 - y0 * x1);
    };
    expect(turn(0)).toBe(-turn(1));
  });

  it("the guild flag waves: still at the pole, strongest at the free end", () => {
    for (const t of [0, 0.4, 1.1, 2.7]) expect(flagWave(0, t, 26)).toBe(0);
    let max = 0;
    for (let t = 0; t < 4; t += 0.05) max = Math.max(max, Math.abs(flagWave(24, t, 26)));
    expect(max).toBeGreaterThanOrEqual(2);
    expect(max).toBeLessThanOrEqual(3);
    // bayroq tik bo'laklarga bo'linib chiziladi
    let draws = 0;
    const ctx = new Proxy({}, { get: () => () => {}, set: () => true });
    drawWaving(ctx as unknown as CanvasRenderingContext2D, 0, 0, 26, 20, 1, () => draws++);
    expect(draws).toBe(13);
  });

  it("remote heroes get the turn frame too — computed on the client from the same snapshots", () => {
    const mirror = new RealmMirror(loadRealmData(), "me", "knight", null, 1);
    let tick = 1;
    const send = (fx: number) => {
      const t: NetPlayer = ["p2", "knight", "Ali", 100, 100, 5, 5, fx, 0, 1, -1, 0, 0, "", 0];
      tick++;
      mirror.apply({ t: "s", tick, ack: 0, at: 0, n: 2, p: [t] } as SnapshotMsg, tick);
      mirror.update(tick + 5, 1 / 60);
      return mirror.sim.players.get("p2")!.p;
    };
    send(1);
    const p = send(-1);
    expect(p.vis.turnT).toBeCloseTo(TURN_TIME, 5);
  });

  it("server logic, protocol and traffic are untouched by the visual layer", () => {
    expect(NET_VERSION).toBe(4);
    const root = path.resolve(__dirname, "../..");
    for (const f of [
      "src/realm/sim.ts",
      "src/realm/net/room.ts",
      "src/realm/net/protocol.ts",
      "src/realm/net/lobby.ts",
      "server/src/index.ts",
      "server/src/room-do.ts",
    ])
      expect(readFileSync(path.join(root, f), "utf8"), f).not.toMatch(/realmFx|heroAnim|hudFx/);
  });
});
