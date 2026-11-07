import { useEffect, useRef, useState } from "react";
import { HERO_LIST, type Hero } from "@/game/hero";
import { loadUnlockedHeroes } from "@/game/save";
import { loadGold, saveGold } from "@/game/shop";
import { renderSprite } from "@/game/sprites";
import type { AnimState } from "@/game/animation";
import {
  SKINS,
  buySkin,
  loadSkins,
  ownsSkin,
  selectSkin,
  selectedSkin,
  skinById,
  skinPalette,
  type Skin,
} from "@/game/skins";
import { sfx } from "@/game/audio";
import { TIER_COLOR, TIER_NAME, type SkinTier } from "@/game/skinFx";
import { DEMO_H, DEMO_W, SkinDemo, demoPhase } from "@/game/skinDemo";
import { currentSettings } from "@/game/settings";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { pixelFocus, pixelPress } from "@/lib/pixel-ui";
import { Icon } from "./pixel";

function Lock() {
  return (
    <svg aria-hidden="true" viewBox="0 0 8 9" width={9} height={10} shapeRendering="crispEdges">
      <path d="M2 0h4v1H2zM1 1h1v3H1zM6 1h1v3H6z" fill="currentColor" />
      <path d="M0 4h8v5H0z" fill="currentColor" />
      <path d="M3 5h2v2H3z" fill="#000" />
    </svg>
  );
}

/** Jonli ko'rinish: turish, yurish va hujum kadrlari navbat bilan (skin palitrasida) */
const SHOW: readonly (readonly [AnimState, number])[] = [
  ["idle", 0],
  ["idle", 1],
  ...[0, 1, 2, 3, 0, 1, 2, 3].map((f) => ["walk", f] as const),
  ["attack", 0],
  ["attack", 1],
  ["attack", 2],
  ["attack", 2],
];

export function SkinPreview({
  hero,
  skin,
  size = 64,
  dim = false,
}: {
  hero: Hero;
  skin: string;
  size?: number;
  dim?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [frame, setFrame] = useState(0);
  const view = hero === "paladin" ? 48 : 32;
  useEffect(() => {
    const id = window.setInterval(() => setFrame((f) => f + 1), 170);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    const c = ref.current?.getContext("2d");
    if (!c) return;
    c.clearRect(0, 0, view, view);
    const [state, f] = SHOW[frame % SHOW.length]!;
    renderSprite(
      c,
      hero,
      state,
      f,
      view / 2,
      view / 2,
      false,
      false,
      false,
      skinPalette(hero, skin),
    );
  }, [hero, skin, frame, view]);
  return (
    <canvas
      ref={ref}
      width={view}
      height={view}
      aria-hidden="true"
      data-skin={skin}
      style={{
        width: size,
        height: size,
        imageRendering: "pixelated",
        opacity: dim ? 0.45 : 1,
        filter: dim ? "grayscale(0.6)" : undefined,
      }}
    />
  );
}

/**
 * Jonli preview: tanlangan skin bilan qahramon o'zi hujum, kuchli hujum va dashni ko'rsatadi —
 * o'yindagi skin effektlari bilan (skinDemo.ts).
 */
export function SkinShowcase({
  hero,
  skin,
  scale = 3,
}: {
  hero: Hero;
  skin: string;
  scale?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState("idle");
  useEffect(() => {
    const c = ref.current?.getContext("2d");
    if (!c) return;
    c.imageSmoothingEnabled = false;
    const s = skinById(hero, skin) ?? SKINS[hero][0]!;
    const demo = new SkinDemo(hero, s, skinPalette(hero, skin));
    let raf = 0,
      last = performance.now(),
      shown = "";
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      demo.update(dt);
      demo.render(c);
      const ph = demoPhase(demo.t);
      if (ph !== shown) setPhase((shown = ph));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [hero, skin]);
  const label =
    phase === "attack"
      ? "HUJUM"
      : phase === "charge" || phase === "strong"
        ? "KUCHLI HUJUM"
        : phase === "dash"
          ? hero === "mage"
            ? "TELEPORT"
            : "DASH"
          : "TURISH";
  return (
    <figure className="flex flex-col items-center gap-1" aria-label="Skin jonli ko'rinishi">
      <canvas
        ref={ref}
        width={DEMO_W}
        height={DEMO_H}
        data-skin={skin}
        data-testid="skin-showcase"
        className="max-w-full border-2 border-[#5c4a6e] bg-[#1a1328]"
        style={{ width: DEMO_W * scale, imageRendering: "pixelated" }}
      />
      <figcaption className="text-[8px] text-muted-foreground">{label}</figcaption>
    </figure>
  );
}

/** Daraja belgisi: ODDIY / NOYOB / AFSONAVIY */
export function TierBadge({ tier }: { tier: SkinTier }) {
  if (tier === "default") return <span className="text-[8px] text-muted-foreground">BEPUL</span>;
  return (
    <span
      className="border px-1 text-[8px]"
      style={{ borderColor: TIER_COLOR[tier], color: TIER_COLOR[tier] }}
    >
      {TIER_NAME[tier]}
    </span>
  );
}

/** Nom rangi: skinning eng yorqin rangi (to'q fonda o'qilsin) */
function brightest(colors: readonly string[]) {
  const lum = (h: string) => {
    const n = parseInt(h.slice(1), 16);
    return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  };
  return [...colors].sort((a, b) => lum(b) - lum(a))[0]!;
}

/** Rang namunalari (5 ta) */
function Swatches({ colors }: { colors: readonly string[] }) {
  return (
    <span className="flex gap-[2px]" aria-hidden="true">
      {colors.map((c, i) => (
        <span key={i} className="h-2 w-2 border border-black" style={{ background: c }} />
      ))}
    </span>
  );
}

/**
 * Do'kondagi SKINLAR bo'limi: qahramon tanlanadi, har skin jonli ko'rinishda; holat — SOTIB OL,
 * TANLASH yoki TANLANGAN. Sotib olinmagan qahramonning skinlari qulfli.
 */
export function SkinsShop({
  gold,
  onGold,
  startHero,
}: {
  gold: number;
  onGold: (n: number) => void;
  startHero: Hero;
}) {
  const [hero, setHero] = useState<Hero>(startHero);
  const [save, setSave] = useState(loadSkins);
  const unlocked = loadUnlockedHeroes();
  const open = unlocked.has(hero);
  const cur = selectedSkin(hero, save);
  // jonli previewdagi skin: kartani bosib ko'rish mumkin (sotib olinmagan bo'lsa ham)
  const [focus, setFocus] = useState<string | null>(null);
  const shown = focus && skinById(hero, focus) ? focus : cur.id;
  const info = HERO_LIST.find((h) => h.id === hero)!;
  const still = currentSettings().reduceFx;
  const buy = (s: Skin) => {
    sfx.unlock();
    if (!buySkin(hero, s.id, { get: loadGold, set: saveGold })) return;
    sfx.upgrade();
    onGold(loadGold());
    setSave(loadSkins());
  };
  const pick = (s: Skin) => {
    if (!selectSkin(hero, s.id)) return;
    sfx.pickup();
    setSave(loadSkins());
  };
  return (
    <>
      <p className="text-muted-foreground">
        Skin qahramonning ranglari bilan birga qobiliyat effektlari, izlari va zarbalarini ham
        o'zgartiradi. NOYOB — o'z zarrachalari va izi, AFSONAVIY — o'z animatsiyasi, zarba shakli va
        ovozi. Kuchi o'zgarmaydi; menyuda, o'yinda va onlayn olamda ko'rinadi.
      </p>
      <div role="tablist" aria-label="Skin qahramoni" className="flex flex-wrap gap-2">
        {HERO_LIST.map((h) => (
          <button
            key={h.id}
            role="tab"
            aria-selected={hero === h.id}
            onClick={() => {
              setHero(h.id);
              setFocus(null);
            }}
            className={`inline-flex items-center gap-1 border-2 px-2 py-1 ${pixelPress} ${pixelFocus}`}
            style={{
              borderColor: hero === h.id ? h.theme.accent : "#5c4a6e",
              color: hero === h.id ? h.theme.uiText : undefined,
            }}
          >
            {!unlocked.has(h.id) && <Lock />}
            {h.name}
          </button>
        ))}
      </div>
      {!open && (
        <p role="status" className="text-primary">
          {info.name} hali sotib olinmagan — skinlari qulfli (QAHRAMONLAR bo'limida oching).
        </p>
      )}
      <SkinShowcase hero={hero} skin={shown} />
      <ul aria-label={`${info.name} skinlari`} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {SKINS[hero].map((s) => {
          const owned = ownsSkin(s, save);
          const chosen = cur.id === s.id;
          const canBuy = open && !owned && gold >= s.price;
          return (
            <li
              key={s.id}
              data-tier={s.tier}
              className={`flex p-[2px] ${s.tier === "legendary" ? `skin-legend ${still ? "still" : ""}` : ""}`}
              style={{ background: chosen ? info.theme.accent : owned ? "#7a6a8a" : "#5c4a6e" }}
            >
              <div className="flex w-full flex-col items-center gap-2 bg-[#1f1730] p-2 text-center">
                <button
                  onClick={() => setFocus(s.id)}
                  aria-label={`${s.name} — jonli ko'rish`}
                  aria-pressed={shown === s.id}
                  className={`${pixelFocus} border-2 ${shown === s.id ? "border-[#ffcc33]" : "border-transparent"}`}
                >
                  <SkinPreview hero={hero} skin={s.id} dim={!open} />
                </button>
                <span style={{ color: brightest(s.colors) }}>{s.name}</span>
                <TierBadge tier={s.tier} />
                <Swatches colors={s.colors} />
                {chosen ? (
                  <span
                    className="w-full border-2 px-2 py-1"
                    style={{ borderColor: info.theme.accent, color: info.theme.uiText }}
                  >
                    TANLANGAN
                  </span>
                ) : owned ? (
                  <button
                    onClick={() => pick(s)}
                    disabled={!open}
                    className={cn(
                      buttonVariants({ variant: "pixel", size: "none" }),
                      "w-full px-2 py-1 disabled:border-border disabled:bg-transparent disabled:text-muted-foreground disabled:opacity-100",
                    )}
                  >
                    TANLASH
                  </button>
                ) : (
                  <button
                    onClick={() => buy(s)}
                    disabled={!canBuy}
                    aria-label={`${s.name} — sotib ol, ${s.price} oltin`}
                    className={cn(
                      buttonVariants({ variant: "pixel", size: "none" }),
                      "w-full gap-1 whitespace-normal px-2 py-1 disabled:border-border disabled:bg-transparent disabled:text-muted-foreground disabled:opacity-100",
                    )}
                  >
                    <span className="flex flex-col items-center gap-1">
                      <span className="whitespace-nowrap">{open ? "SOTIB OL" : <Lock />}</span>
                      <span className="inline-flex items-center gap-1">
                        <Icon id="coin" color="#ffcc33" size={10} />
                        {s.price}
                      </span>
                    </span>
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
