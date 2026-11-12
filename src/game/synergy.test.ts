import { beforeEach, describe, expect, it } from "vitest";
import { UPGRADES, cardFor, type Upgrade } from "./waves";
import { Player } from "./player";
import { HEROES, type Hero } from "./hero";
import { Game } from "./game";
import { Enemy } from "./enemy";
import { unlockHero } from "./save";
import { heroDps } from "./bossPower";
import {
  ALL_TAGS,
  HERO_TAG,
  TAGS,
  TAG_ICONS,
  WARD_EVERY,
  addTag,
  synergies,
  tagProgress,
  type Tag,
} from "./synergy";
import { iconColorCount } from "./pixelIcon";
import { loadAchievements } from "./achievements";

beforeEach(() => localStorage.clear());

const GENERAL: Tag[] = ["zarar", "tezlik", "himoya", "hayot"];
type GI = { choose(i: number): void; damageTarget(t: unknown, d: number): void };

/** To'lqin tugamasligi uchun hali paydo bo'lmagan dushman */
function idle() {
  const e = new Enemy("blob", 300, 30);
  e.spawn = e.spawnMax = 999;
  return e;
}

function game(hero: Hero) {
  unlockHero(hero);
  const canvas = { getContext: () => ({ imageSmoothingEnabled: false }) };
  const g = new Game(canvas as unknown as HTMLCanvasElement, hero);
  return { g, gi: g as unknown as GI };
}

/** Shu qahramonga chiqadigan, shu tegli kartalar (qahramon varianti bilan) */
function cardsWith(p: Player, tag: Tag): Upgrade[] {
  return UPGRADES.filter((u) => !u.hero || u.hero === p.hero)
    .map((u) => cardFor(u, p))
    .filter((u) => u.tags.includes(tag));
}

describe("Kuch kartalari teglari", () => {
  it("every card and every hero variant has exactly one known tag", () => {
    for (const hero of HEROES) {
      const p = new Player(hero);
      for (const u of UPGRADES) {
        if (u.hero && u.hero !== hero) continue;
        const c = cardFor(u, p);
        expect(c.tags, `${hero}:${u.id}`).toHaveLength(1);
        expect(ALL_TAGS).toContain(c.tags[0]);
      }
      // variantning o'z tegi yozilgan (asl kartadan meros emas)
      for (const k of ["mage", "hunter", "gunner", "paladin", "samurai"] as const)
        for (const u of UPGRADES) if (u[k]) expect(u[k]!.tags, `${k}:${u.id}`).toHaveLength(1);
    }
  });

  it("hero-only cards and UZUN TIG' variants carry the hero's own tag", () => {
    for (const u of UPGRADES) if (u.hero) expect(u.tags).toEqual([HERO_TAG[u.hero]]);
    for (const hero of HEROES) {
      const c = cardFor(
        UPGRADES.find((u) => u.id === "reach")!,
        new Player(hero),
      );
      expect(c.tags).toEqual([HERO_TAG[hero]]);
    }
    // boshqa qahramon tegi hech qachon chiqmaydi
    for (const hero of HEROES) {
      const p = new Player(hero);
      const others = Object.values(HERO_TAG).filter((t) => t !== HERO_TAG[hero]);
      for (const t of others) expect(cardsWith(p, t)).toHaveLength(0);
    }
  });

  it("every hero can collect 3 of each general tag and of its own tag", () => {
    for (const hero of HEROES)
      for (const tag of [...GENERAL, HERO_TAG[hero]]) {
        const p = new Player(hero);
        let n = 0;
        for (let guard = 0; guard < 20 && n < 3; guard++) {
          p.hp = 1; // SHIFO kartasi ham foydali bo'lsin
          const c = cardsWith(p, tag).find((u) => u.ok(p));
          if (!c) break;
          c.apply(p);
          n++;
        }
        expect(n, `${hero}:${tag}`).toBe(3);
      }
  });

  it("tag icons are code-drawn 7x7 with few colours; the card label counts to 3", () => {
    for (const t of ALL_TAGS) {
      expect(TAG_ICONS[t]).toHaveLength(7);
      for (const row of TAG_ICONS[t]) expect(row).toHaveLength(7);
      expect(iconColorCount(TAG_ICONS[t])).toBeLessThanOrEqual(5);
      expect(TAGS[t].two.length).toBeGreaterThan(0);
      expect(TAGS[t].three.length).toBeGreaterThan(0);
    }
    expect(tagProgress({}, "zarar")).toBe("ZARAR 1/3");
    expect(tagProgress({ zarar: 2 }, "zarar")).toBe("ZARAR 3/3");
    expect(tagProgress({ zarar: 5 }, "zarar")).toBe("ZARAR 3/3");
  });
});

describe("Sinergiyalar", () => {
  it("2 tags — small bonus, 3 — synergy (pure rules)", () => {
    const p = new Player("knight");
    const counts = {};
    const spin = p.spinCd;
    expect(addTag(counts, "zarar", p)).toBeNull();
    expect(addTag(counts, "zarar", p)).toBe("two");
    expect(p.spinCd).toBeCloseTo(spin * 0.85);
    expect(addTag(counts, "zarar", p)).toBe("three");
    expect(synergies(counts)).toEqual(["zarar"]);
    expect(addTag(counts, "zarar", p)).toBeNull();
  });

  for (const hero of HEROES)
    it(`${hero}: 2 then 3 hero-tag cards unlock the bonus and the hero synergy`, () => {
      const { g, gi } = game(hero);
      const p = g.player;
      const charge = p.chargeTime;
      const tag = HERO_TAG[hero];
      const pick = () => {
        const c = cardsWith(p, tag).find((u) => u.ok(p))!;
        g.choices = [c];
        gi.choose(0);
      };
      pick();
      expect(g.tagCounts[tag]).toBe(1);
      pick();
      expect(p.chargeTime).toBeCloseTo(charge * 0.8);
      expect(g.syn(tag)).toBe(false);
      const dps = heroDps(p);
      pick();
      expect(g.syn(tag)).toBe(true);
      expect(g.fx.texts.some((t) => t.s === "SINERGIYA!")).toBe(true);
      expect(g.synNote?.tag).toBe(tag);
      // qahramonning eng zo'r qobiliyati kuchaydi
      if (hero === "knight" || hero === "hunter") expect(p.strongMul).toBe(3);
      if (hero === "paladin") expect(p.strongMul).toBe(4);
      if (hero === "gunner") expect(p.fanPierce).toBe(true);
      if (hero !== "mage" && hero !== "gunner") expect(heroDps(p)).toBeGreaterThan(dps);
    });

  it("ZARAR 3: a dying enemy blasts its neighbour", () => {
    const { g, gi } = game("knight");
    g.tagCounts.zarar = 3;
    const a = new Enemy("blob", 100, 100);
    const b = new Enemy("blob", 115, 100);
    a.spawn = b.spawn = 0;
    g.enemies = [a, b];
    const hp = b.hp;
    gi.damageTarget(a, 99);
    expect(a.dead).toBe(true);
    expect(b.hp).toBe(hp - 1);
  });

  it("HIMOYA 3: a shield every 20 s blocks one hit", () => {
    const { g } = game("knight");
    g.tagCounts.himoya = 3;
    const p = g.player;
    g.enemies = [idle()];
    g.stage = "fight";
    for (let t = 0; t < WARD_EVERY + 0.1; t += 0.05) g.update(0.05);
    expect(p.ward).toBe(1);
    const hp = p.hp;
    expect(p.takeHit(1, 0, 0, 0)).toBe(true);
    expect(p.hp).toBe(hp);
    expect(p.ward).toBe(0);
  });

  it("TEZLIK 3: after a dash the hero is faster for 1 s", () => {
    const { g } = game("knight");
    g.tagCounts.tezlik = 3;
    g.enemies = [idle()];
    const p = g.player;
    g.input.pressDash();
    for (let t = 0; t < 0.3; t += 0.02) g.update(0.02);
    expect(p.boost).toBeGreaterThan(0.8);
  });

  it("SINERGIYA USTASI: two synergies in one run", () => {
    const { g, gi } = game("knight");
    const take = (tag: Tag) => {
      const c = cardsWith(g.player, tag).find((u) => u.ok(g.player))!;
      g.choices = [c];
      gi.choose(0);
    };
    for (let i = 0; i < 3; i++) take("zarar");
    expect(loadAchievements().has("synergy2")).toBe(false);
    g.player.hp = 1;
    for (let i = 0; i < 3; i++) take("hayot");
    expect(synergies(g.tagCounts)).toEqual(["zarar", "hayot"]);
    expect(loadAchievements().has("synergy2")).toBe(true);
  });

  it("chapter retry restores the tags taken at the chapter start", () => {
    const { g } = game("knight");
    g.tagCounts = { zarar: 2 };
    g.startChapter(2);
    g.tagCounts.zarar = 3;
    g.retryChapter();
    expect(g.tagCounts).toEqual({ zarar: 2 });
    g.reset();
    expect(g.tagCounts).toEqual({});
  });
});
