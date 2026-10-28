import { beforeEach, describe, expect, it } from "vitest";
import { MAP_NODES, MAP_SEL_KEY, MapState } from "./map";
import {
  WORLD1_WON_KEY,
  WORLD2_WON_KEY,
  isWorldOpen,
  recordWorldWin,
  worldBest,
  worldWins,
} from "./progress";
import { ACHIEVEMENTS_KEY } from "./achievements";
import { bestKeys } from "./hero";

beforeEach(() => localStorage.clear());

describe("Sarguzasht xaritasi: qulflar", () => {
  it("a fresh player sees only world 1 open; worlds 2 and 3 are locked", () => {
    const s = new MapState([1, 2, 3]);
    expect(s.open).toEqual({ 1: true, 2: false, 3: false });
    expect(s.sel).toBe(1);
    expect(MAP_NODES.map((n) => n.name)).toEqual([
      "OLOVLI ZINDON",
      "MUZ SARDOBASI",
      "ZULMAT O'RMONI",
    ]);
  });

  it("can look at a locked world but not enter it", () => {
    const s = new MapState([1, 2, 3]);
    s.move(1);
    expect(s.sel).toBe(2);
    expect(s.enter()).toBeNull();
    expect(s.msg).toBe("QULFLANGAN");
    s.move(-1);
    expect(s.enter()).toBe(1);
  });

  it("A/D movement stops at the ends of the path", () => {
    const s = new MapState([1, 2, 3]);
    s.move(-1);
    expect(s.sel).toBe(1);
    s.move(1);
    s.move(1);
    s.move(1);
    expect(s.sel).toBe(3);
  });

  it("winning world 1 opens world 2, winning world 2 opens world 3", () => {
    recordWorldWin(1, "knight");
    expect(isWorldOpen(2)).toBe(true);
    expect(isWorldOpen(3)).toBe(false);
    recordWorldWin(2, "mage");
    expect(isWorldOpen(3)).toBe(true);
    const s = new MapState([1, 2, 3]);
    expect(s.open).toEqual({ 1: true, 2: true, 3: true });
    expect(s.wins[1]).toEqual(["knight"]);
    expect(s.wins[2]).toEqual(["mage"]);
    s.move(1);
    s.move(1);
    expect(s.enter()).toBe(3);
    expect(localStorage.getItem(MAP_SEL_KEY)).toBe("3");
    // keyingi safar xarita oxirgi kirilgan dunyoda ochiladi
    expect(new MapState([1, 2, 3]).sel).toBe(3);
  });

  it("an open world that is not playable yet says it is coming soon", () => {
    recordWorldWin(1, "knight");
    recordWorldWin(2, "knight");
    const s = new MapState([1, 2]);
    s.sel = 3;
    expect(s.enter()).toBeNull();
    expect(s.msg).toBe("TEZ KUNDA");
  });

  it("v1.9 progress unlocks the map: old flag, win achievements, Queen or a world 2 record", () => {
    localStorage.setItem(WORLD1_WON_KEY, "1");
    expect(isWorldOpen(2)).toBe(true);
    localStorage.clear();
    localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(["winMage"]));
    expect(isWorldOpen(2)).toBe(true);
    expect(worldWins()[1]).toEqual(["mage"]);
    localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(["winKnight", "queen"]));
    expect(isWorldOpen(3)).toBe(true);
    localStorage.clear();
    localStorage.setItem(bestKeys("knight").ch2, "900");
    expect(isWorldOpen(3)).toBe(true);
    expect(worldWins()[2]).toEqual(["knight"]);
    expect(localStorage.getItem(WORLD2_WON_KEY)).toBeNull();
  });

  it("shows the best score of each world across heroes", () => {
    localStorage.setItem(bestKeys("knight").best, "1200");
    localStorage.setItem(bestKeys("mage").best, "1500");
    localStorage.setItem(bestKeys("mage").ch2, "800");
    expect(worldBest(1)).toBe(1500);
    expect(worldBest(2)).toBe(800);
    expect(worldBest(3)).toBe(0);
    const s = new MapState();
    expect(s.best).toEqual({ 1: 1500, 2: 800, 3: 0 });
  });

  it("finds the clicked world node", () => {
    const s = new MapState();
    for (const n of MAP_NODES) expect(s.nodeAt(n.x + 3, n.y - 4)?.world).toBe(n.world);
    expect(s.nodeAt(160, 10)).toBeNull();
  });
});
