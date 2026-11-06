import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_SKIN,
  SKINS,
  SKINS_KEY,
  SKIN_PRICES,
  buySkin,
  isSkinId,
  loadSkins,
  ownsSkin,
  paidSkinIds,
  parseSkins,
  selectSkin,
  selectedSkin,
  skinPalette,
} from "./skins";
import { HERO_LIST, HEROES } from "./hero";
import { PALETTES, renderSprite, spriteCacheKeys } from "./sprites";
import { Game } from "./game";
import { unlockHero } from "./save";
import { applyGift, unlockAll, defaultLists } from "@/account/grants";
import { collectProgress } from "./transfer";
import { RealmRoom, netPlayer, type RoomConn } from "@/realm/net/room";
import { NET_VERSION, parseClientMsg, type ServerMsg } from "@/realm/net/protocol";
import { RealmPlayer } from "@/realm/sim";
import { Rng } from "@/realm/rng";

beforeEach(() => localStorage.clear());

/** Rang yorqinligi 0..255 */
const lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
};

function wallet(start: number) {
  let g = start;
  return { get: () => g, set: (n: number) => (g = n), now: () => g };
}

describe("Skinlar ro'yxati", () => {
  it("every hero: free default (current palette) + 3 skins at 80 / 150 / 250 gold", () => {
    // doimiy qoida: har (yangi) qahramon 3 ta skin bilan
    for (const h of HERO_LIST) {
      const list = SKINS[h.id];
      expect(list, h.id).toHaveLength(4);
      expect(list[0]!.id).toBe(DEFAULT_SKIN);
      expect(list[0]!.price).toBe(0);
      expect(list[0]!.colors).toEqual(PALETTES[h.id]);
      expect(list.slice(1).map((s) => s.price)).toEqual([...SKIN_PRICES]);
      expect(SKIN_PRICES).toEqual([80, 150, 250]);
    }
    expect(new Set(paidSkinIds()).size).toBe(HEROES.length * 3);
  });

  it("each skin has exactly 5 valid colours, a dark outline and an Uzbek name", () => {
    for (const h of HEROES)
      for (const s of SKINS[h]) {
        expect(s.colors, s.id).toHaveLength(5);
        for (const c of s.colors) expect(c).toMatch(/^#[0-9a-f]{6}$/);
        expect(new Set(s.colors).size).toBe(5);
        // kontur doim to'q
        expect(lum(s.colors[0]!), s.id).toBeLessThan(30);
        expect(s.name).toBe(s.name.toUpperCase());
        expect(s.hero).toBe(h);
        if (s.price > 0) expect(s.id.startsWith(`${h}-`)).toBe(true);
      }
    expect(SKINS.knight.map((s) => s.name)).toEqual([
      "ODDIY RITSAR",
      "QORA RITSAR",
      "OLTIN RITSAR",
      "MUZ RITSAR",
    ]);
  });
});

describe("Skinlar saqlanishi", () => {
  it("default is always owned; buy takes gold, opens and selects; select needs ownership", () => {
    const s = SKINS.knight;
    expect(ownsSkin(s[0]!)).toBe(true);
    expect(ownsSkin(s[1]!)).toBe(false);
    expect(selectedSkin("knight").id).toBe(DEFAULT_SKIN);
    expect(selectSkin("knight", s[2]!.id)).toBe(false);
    const w = wallet(100);
    expect(buySkin("knight", s[2]!.id, w)).toBe(false); // 150 oltin kerak
    expect(w.now()).toBe(100);
    expect(buySkin("knight", s[1]!.id, w)).toBe(true);
    expect(w.now()).toBe(20);
    expect(buySkin("knight", s[1]!.id, w)).toBe(false); // ikki marta sotilmaydi
    expect(selectedSkin("knight").id).toBe(s[1]!.id);
    expect(selectSkin("knight", DEFAULT_SKIN)).toBe(true);
    expect(selectedSkin("knight").id).toBe(DEFAULT_SKIN);
    expect(selectedSkin("mage").id).toBe(DEFAULT_SKIN);
  });

  it("tampered saves fall back to the default; unknown ids are dropped", () => {
    localStorage.setItem(
      SKINS_KEY,
      JSON.stringify({ owned: ["knight-gold", "dragon-x", 5], sel: { knight: "mage-sun" } }),
    );
    expect(loadSkins()).toEqual({ owned: ["knight-gold"], sel: {} });
    localStorage.setItem(SKINS_KEY, JSON.stringify({ owned: [], sel: { knight: "knight-ice" } }));
    // tanlangan, lekin sotib olinmagan — default
    expect(selectedSkin("knight").id).toBe(DEFAULT_SKIN);
    localStorage.setItem(SKINS_KEY, "{buzuq");
    expect(parseSkins(localStorage.getItem(SKINS_KEY))).toEqual({ owned: [], sel: {} });
  });

  it("goes into the transfer code / cloud keys; author unlock and gifts include skins", () => {
    buySkin("mage", "mage-sun", wallet(999));
    expect(collectProgress()[SKINS_KEY]).toBeDefined();
    const all = unlockAll({}, defaultLists());
    expect(parseSkins(all[SKINS_KEY]).owned.sort()).toEqual(paidSkinIds().sort());
    const g = applyGift({}, { gold: 0, xp: 0, hero: null, skin: "paladin-flame" });
    expect(parseSkins(g[SKINS_KEY]).owned).toEqual(["paladin-flame"]);
    // noma'lum skin sovg'a qilinmaydi
    expect(
      parseSkins(applyGift({}, { gold: 0, xp: 0, hero: null, skin: "x" })[SKINS_KEY]).owned,
    ).toEqual([]);
  });
});

describe("Skin chizish", () => {
  let fills: string[] = [];
  beforeEach(() => {
    fills = [];
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function () {
      return {
        set fillStyle(v: string) {
          fills.push(v);
        },
        fillRect() {},
        save() {},
        restore() {},
        translate() {},
        scale() {},
        drawImage() {},
        imageSmoothingEnabled: false,
        globalAlpha: 1,
      } as unknown as CanvasRenderingContext2D;
    } as never);
  });
  afterEach(() => vi.restoreAllMocks());

  it("the sprite cache keeps skins apart and paints with the skin palette", () => {
    const c = document.createElement("canvas").getContext("2d")!;
    renderSprite(c, "knight", "idle", 0, 0, 0, false);
    const plain = new Set(fills);
    fills = [];
    renderSprite(
      c,
      "knight",
      "idle",
      0,
      0,
      0,
      false,
      false,
      false,
      skinPalette("knight", "knight-gold"),
    );
    const gold = new Set(fills);
    const keys = spriteCacheKeys().filter((k) => k.startsWith("knight:idle:0:false:false"));
    expect(keys).toContain("knight:idle:0:false:false:");
    expect(keys).toContain("knight:idle:0:false:false:knight-gold");
    expect([...gold].some((c) => SKINS.knight[2]!.colors.includes(c))).toBe(true);
    expect([...gold].some((c) => PALETTES.knight.slice(1).includes(c))).toBe(false);
    expect([...plain].some((c) => PALETTES.knight.includes(c))).toBe(true);
    // default — asl palitra va asl kesh
    expect(skinPalette("knight", DEFAULT_SKIN)).toBeUndefined();
  });

  it("the game puts the chosen skin on the hero; enemies keep their colours", () => {
    unlockHero("gunner");
    buySkin("gunner", "gunner-red", wallet(999));
    const canvas = { getContext: () => ({ imageSmoothingEnabled: false }) };
    const g = new Game(canvas as unknown as HTMLCanvasElement, "gunner");
    expect(g.player.skin?.id).toBe("gunner-red");
    g.reset();
    expect(g.player.skin?.colors).toEqual(SKINS.gunner[2]!.colors);
  });
});

class FakeConn implements RoomConn {
  out: ServerMsg[] = [];
  send(s: string) {
    this.out.push(JSON.parse(s) as ServerMsg);
  }
  close() {}
}

describe("Onlayn: skin maydoni", () => {
  const hello = (extra: Record<string, unknown> = {}) =>
    JSON.stringify({
      t: "hello",
      v: NET_VERSION,
      tag: "1234",
      hero: "mage",
      save: null,
      keys: [],
      ...extra,
    });

  it("old clients without the field still join; the server accepts only an existing id", () => {
    expect(parseClientMsg(hello())?.t).toBe("hello");
    expect(parseClientMsg(hello({ skin: "mage-sun" }))?.t).toBe("hello");
    expect(parseClientMsg(hello({ skin: "<b>" }))).toBeNull();
    const r = new Rng(3);
    const rm = new RealmRoom("ABCDEF", { rand: () => r.next() });
    for (const [skin, want] of [
      [undefined, ""],
      ["mage-sun", "mage-sun"],
      ["knight-gold", ""], // boshqa qahramonniki
      ["mage-nope", ""],
    ] as const) {
      const id = rm.newId();
      rm.receive(id, new FakeConn(), hello(skin ? { skin } : {}), 0);
      expect(rm.sim.players.get(id)!.skin).toBe(want);
      expect(isSkinId("mage", skin)).toBe(!!skin && want !== "");
    }
  });

  it("the player tuple carries the skin only when set (old shape otherwise)", () => {
    const rp = new RealmPlayer("p1", "mage", 100, 100, 16);
    expect(netPlayer(rp, "A", 1, "")).toHaveLength(16);
    const t = netPlayer(rp, "A", 1, "", "mage-frost");
    expect(t).toHaveLength(17);
    expect(t[16]).toBe("mage-frost");
  });
});
