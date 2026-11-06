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
  skinPalette,
  type Skin,
} from "@/game/skins";
import { sfx } from "@/game/audio";
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
  const info = HERO_LIST.find((h) => h.id === hero)!;
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
        Skin — qahramonning yangi ranglari. Kuchi o'zgarmaydi; menyuda, o'yinda va onlayn olamda
        ko'rinadi.
      </p>
      <div role="tablist" aria-label="Skin qahramoni" className="flex flex-wrap gap-2">
        {HERO_LIST.map((h) => (
          <button
            key={h.id}
            role="tab"
            aria-selected={hero === h.id}
            onClick={() => setHero(h.id)}
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
      <ul aria-label={`${info.name} skinlari`} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {SKINS[hero].map((s) => {
          const owned = ownsSkin(s, save);
          const chosen = cur.id === s.id;
          const canBuy = open && !owned && gold >= s.price;
          return (
            <li
              key={s.id}
              className="flex p-[2px]"
              style={{ background: chosen ? info.theme.accent : owned ? "#7a6a8a" : "#5c4a6e" }}
            >
              <div className="flex w-full flex-col items-center gap-2 bg-[#1f1730] p-2 text-center">
                <SkinPreview hero={hero} skin={s.id} dim={!open} />
                <span style={{ color: brightest(s.colors) }}>{s.name}</span>
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
