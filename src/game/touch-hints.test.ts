import { beforeEach, describe, expect, it } from "vitest";
import { Game, TUTORIAL_KEY } from "./game";
import { DEFAULT_KEYS, bindKey } from "./keys";
import { mapKeysHint } from "./map";
import { UNLOCKED_HEROES_KEY } from "./save";
import { HEROES, type Hero } from "./hero";
import { RealmRenderer, keysIntro, touchIntro, type RealmView } from "@/realm/render";

/** Klaviatura ko'rsatmasi belgilari: telefonda bular chiqmasligi kerak */
const KEYBOARD =
  /\b(Shift|Space|Esc|Enter|WASD|Strelka)\b|\(M\)|A\/D|1 \/ 2 \/ 3|\[[A-Z]\]|: [QRE]\b/;

/** Chizilgan matnlarni yozib boradigan soxta canvas */
function textCanvas() {
  const texts: string[] = [];
  const ctx = new Proxy(
    {},
    {
      get: (_, k) =>
        k === "measureText"
          ? (s: string) => ({ width: s.length * 5 })
          : k === "fillText"
            ? (s: string) => texts.push(s)
            : k === "canvas"
              ? { width: 960, height: 540 }
              : () => {},
      set: () => true,
    },
  );
  return { canvas: { getContext: () => ctx, width: 960, height: 540 }, ctx, texts };
}

type Internals = {
  renderHud(): void;
  renderHints(): void;
  renderOverlays(): void;
  stage: string;
  phase: string;
  hints: string[];
};

/** O'yinning ko'rsatma chiqadigan barcha holatlarida chizilgan matnlar */
function allTexts(hero: Hero, touch: boolean, tutorialDone: boolean) {
  localStorage.clear();
  localStorage.setItem(UNLOCKED_HEROES_KEY, JSON.stringify(HEROES));
  if (tutorialDone) localStorage.setItem(TUTORIAL_KEY, "1");
  const { canvas, texts } = textCanvas();
  const g = new Game(canvas as unknown as HTMLCanvasElement, hero);
  // o'yin telefonda ochilganda touch o'yin yaratilgandan keyin beriladi (index.tsx kabi)
  g.touch = touch;
  const gi = g as unknown as Internals;
  gi.renderHud();
  if (!tutorialDone) gi.renderHints();
  g.setPaused(true);
  gi.renderOverlays();
  g.setPaused(false);
  gi.stage = "upgrade";
  gi.renderOverlays();
  gi.stage = "fight";
  gi.phase = "attempt";
  gi.renderOverlays();
  gi.phase = "victory";
  gi.renderOverlays();
  return texts;
}

beforeEach(() => localStorage.clear());

describe("Telefonda klaviatura ko'rsatmasi yo'q", () => {
  it("banner, first-play hints, pause, card pick and end screens use button names", () => {
    for (const hero of HEROES)
      for (const tutorialDone of [true, false]) {
        const texts = allTexts(hero, true, tutorialDone);
        expect(texts.length).toBeGreaterThan(5);
        for (const t of texts) expect(t, `${hero}: "${t}"`).not.toMatch(KEYBOARD);
      }
    // tekshiruv bo'sh emas: kompyuterda xuddi shu holatlarda klaviatura ko'rsatmasi bor
    expect(allTexts("mage", false, false).filter((t) => KEYBOARD.test(t)).length).toBeGreaterThan(
      3,
    );
  });

  it("world banner says the ability button name: TELEPORT tugmasi — sakrash", () => {
    const banner = (hero: Hero) => allTexts(hero, true, true).find((t) => t.includes("tugmasi"));
    expect(banner("mage")).toBe("TELEPORT tugmasi — sakrash");
    expect(banner("knight")).toBe("DASH tugmasi — sirpanish");
    expect(banner("hunter")).toBe("SAKRASH tugmasi — orqaga sakrash");
    expect(banner("gunner")).toBe("SIRPANISH tugmasi — +2 o'q");
  });

  it("on a computer the texts show the rebound keys", () => {
    const k = bindKey(bindKey(DEFAULT_KEYS, "attack", 0, "KeyL"), "dash", 0, "KeyO");
    localStorage.setItem("pixel-rpg-settings", JSON.stringify({ keys: k }));
    const { canvas, texts } = textCanvas();
    localStorage.setItem(TUTORIAL_KEY, "1");
    const g = new Game(canvas as unknown as HTMLCanvasElement, "knight");
    g.input.setKeys(k);
    const gi = g as unknown as Internals;
    gi.renderHud();
    expect(texts).toContain("O — dash");
    g.setPaused(true);
    gi.renderOverlays();
    expect(texts).toContain("WASD yurish · L zarba · O dash");
    gi.hints = ["attack", "spin", "dash"];
    gi.renderHints();
    expect(texts).toContain("L — zarba");
    expect(texts).toContain("L ni bosib turing — aylana zarba");
    expect(mapKeysHint(k)).toBe("A/D — tanlash · Enter — kirish · Esc — orqaga");
    expect(mapKeysHint({ ...k, left: ["KeyJ"], right: ["KeyL"] })).toMatch(/^J\/L — tanlash/);
  });
});

describe("Olamda ko'rsatmalar", () => {
  it("the realm intro on a phone names the buttons, on a computer the rebound keys", () => {
    for (const hero of HEROES) {
      const t = touchIntro(hero);
      expect(t).not.toMatch(KEYBOARD);
      expect(t).toMatch(/GAPLASH .* JURNAL .* XARITA/);
    }
    expect(touchIntro("mage")).toContain("SHAR — hujum, TELEPORT — qobiliyat");
    expect(keysIntro(DEFAULT_KEYS)).toBe(
      "WASD — yurish, Space — hujum, Shift — qobiliyat, E — gaplashish, J — jurnal, M — xarita, 1-8 — buyum.",
    );
    expect(keysIntro(bindKey(DEFAULT_KEYS, "journal", 0, "KeyT"))).toContain("T — jurnal");
  });

  it("the realm pause panel has a SOZLAMALAR button", () => {
    const { ctx, texts } = textCanvas();
    let opened = 0;
    const view = {
      buttons: [] as { act(): void }[],
      act: { settings: () => opened++, panel: () => {}, exit: () => {} },
      net: { mode: "offline", n: 1, ping: 0, code: null },
    } as unknown as RealmView;
    (new RealmRenderer() as unknown as { pause(c: unknown, v: RealmView): void }).pause(ctx, view);
    expect(texts).toContain("SOZLAMALAR");
    view.buttons[1]!.act();
    expect(opened).toBe(1);
  });
});
