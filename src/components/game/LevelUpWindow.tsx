/** "YANGI DARAJA!" — daraja oshganda menyuda: oltin sovg'asi va (har 10 darajada) yangi unvon. */
import type { LevelUp } from "@/account/xp";
import { titleOf } from "@/account/xp";
import { Icon, LevelBadge, PixelWindow } from "./pixel";
import { btn } from "./pixelUi";

export function LevelUpWindow({ up, onClose }: { up: LevelUp; onClose: () => void }) {
  const level = up.levels[up.levels.length - 1] ?? 1;
  return (
    <PixelWindow label="Yangi daraja" title="YANGI DARAJA!" onClose={onClose} accent>
      <div role="status" className="flex flex-col items-center gap-3 text-center">
        <span className="gift-pop inline-flex items-center gap-3 text-primary text-sm sm:text-base">
          <LevelBadge level={level} className="px-2 py-1 text-xs sm:text-sm" />
          {level}-DARAJA
        </span>
        {up.levels.length > 1 && (
          <span className="text-muted-foreground">
            Darajalar: {up.levels[0]}–{level}
          </span>
        )}
        <span className="inline-flex items-center gap-2 text-primary text-xs sm:text-sm">
          <Icon id="coin" color="#ffcc33" size={16} />+{up.gold} OLTIN
        </span>
        {up.titles.length > 0 ? (
          <span className="inline-flex items-center gap-2 border-2 border-primary px-2 py-1 text-primary">
            <Icon id="trophy" color="#ffcc33" />
            YANGI UNVON: {up.titles[up.titles.length - 1]}
          </span>
        ) : (
          <span className="text-muted-foreground">Unvon: {titleOf(level)}</span>
        )}
        <button autoFocus onClick={onClose} className={btn("pixel")}>
          ZO'R!
        </button>
      </div>
    </PixelWindow>
  );
}
