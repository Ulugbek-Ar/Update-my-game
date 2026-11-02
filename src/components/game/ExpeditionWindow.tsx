/**
 * "EKSPEDITSIYADAN QAYTDI": qahramon, qancha vaqt, oltin, XP va (bo'lsa) sandiqdagi noyob buyum.
 * Shu yerda ekspeditsiya qoidasi ham: ko'pi bilan 8 soatlik mukofot, o'ynash doim foydaliroq.
 */
import { useEffect, useState } from "react";
import { expedition } from "@/account/expedition";
import { EXP_MAX_HOURS, expTime } from "@/account/expeditionRules";
import type { ExpeditionReward } from "@/account/protocol";
import { HERO_LIST, type Hero } from "@/game/hero";
import items from "@/realm/data/items.json";
import { CoinRain, HeroAvatar, Icon, PixelWindow } from "./pixel";
import { btn } from "./pixelUi";

const itemName = (id: string) =>
  (items as Record<string, { name?: string }>)[id]?.name ?? id.toUpperCase();

export function ExpeditionWindow({
  reward,
  onClose,
}: {
  reward: ExpeditionReward;
  onClose: () => void;
}) {
  const hero = HERO_LIST.find((h) => h.id === reward.hero) ?? HERO_LIST[0]!;
  const close = () => {
    expedition.dismiss();
    onClose();
  };
  return (
    <PixelWindow
      label="Ekspeditsiyadan qaytdi"
      accent
      title="EKSPEDITSIYADAN QAYTDI"
      onClose={close}
    >
      <div className="flex items-center gap-3">
        <span className="shrink-0 border-2 p-1" style={{ borderColor: hero.theme.accent }}>
          <HeroAvatar hero={hero.id} size={56} />
        </span>
        <p className="text-foreground">
          <span style={{ color: hero.theme.uiText }}>{hero.name}</span> {expTime(reward.minutes)}{" "}
          sarguzashtda bo'ldi va o'lja bilan qaytdi!
        </p>
      </div>
      <ul className="flex flex-wrap gap-2">
        <li className="gift-pop inline-flex items-center gap-1 border-2 border-primary px-2 py-1 text-primary">
          <Icon id="coin" color="#ffcc33" size={14} />+{reward.gold} oltin
        </li>
        <li className="gift-pop inline-flex items-center gap-1 border-2 border-[#9fd0ef] px-2 py-1 text-[#9fd0ef]">
          +{reward.xp} XP
        </li>
        {reward.chest && (
          <li className="gift-pop inline-flex items-center gap-1 border-2 border-[#c9a25a] px-2 py-1 text-[#ffd97a]">
            <Icon id="gift" color="#ffd97a" size={14} />
            Sandiq: {itemName(reward.chest)}
          </li>
        )}
      </ul>
      {reward.chest && (
        <p className="text-muted-foreground">
          Noyob buyum Abadiyat olamiga yuborildi — olamga kirganda inventarda bo'ladi.
        </p>
      )}
      <p className="text-muted-foreground">
        Ko'pi bilan {EXP_MAX_HOURS} soatlik mukofot to'planadi. O'zingiz o'ynasangiz — ancha ko'p
        oltin topasiz!
      </p>
      <button onClick={close} className={btn("pixel", "self-start")}>
        ZO'R!
      </button>
      {reward.gold > 0 && <CoinRain />}
    </PixelWindow>
  );
}

/** Qahramon kartasidagi "Ekspeditsiyada" belgisi va o'tgan vaqt (daqiqada yangilanadi) */
export function ExpeditionBadge({ hero }: { hero: Hero }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const min = Math.floor(expedition.elapsed() / 60_000);
  return (
    <span
      title={`${HERO_LIST.find((h) => h.id === hero)?.name ?? ""} ekspeditsiyada: ${expTime(min)}`}
      className="inline-flex flex-col items-center border border-[#c9a25a] bg-[#c9a25a]/15 px-1 text-[7px] leading-3 text-[#ffd97a] sm:text-[8px]"
    >
      EKSPEDITSIYADA
      <span>{expTime(min)}</span>
    </span>
  );
}
