/**
 * Gerb muharriri: shakl (qalqon, bayroq, doira), 2 rang (fon va belgi) va belgi (qilich, toj,
 * ajdar...). Gildiya darajasida hali ochilmagan rang va belgilar qulf bilan ko'rinadi.
 */
import {
  EMBLEM_COLORS,
  EMBLEM_ICONS,
  EMBLEM_SHAPES,
  SHAPE_NAME,
  encodeEmblem,
  parseEmblem,
  DEFAULT_EMBLEM,
  type Emblem,
} from "@/account/guildRules";
import { pixelFocus } from "@/lib/pixel-ui";
import { EmblemIcon } from "./GuildBadge";

function Swatch({
  hex,
  name,
  on,
  locked,
  level,
  onPick,
}: {
  hex: string;
  name: string;
  on: boolean;
  locked: boolean;
  level: number;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={locked ? `${name} — ${level}-darajada ochiladi` : name}
      title={locked ? `${name}: ${level}-darajada ochiladi` : name}
      disabled={locked}
      onClick={onPick}
      className={`relative h-6 w-6 border-2 ${pixelFocus} ${on ? "border-foreground" : "border-black"} disabled:opacity-35`}
      style={{ background: hex }}
    >
      {locked && (
        <span className="absolute -bottom-1 -right-1 bg-black px-[2px] text-[7px] leading-3 text-primary">
          {level}
        </span>
      )}
    </button>
  );
}

export function EmblemEditor({
  value,
  level,
  onChange,
}: {
  value: string;
  /** gildiya darajasi (yangi gildiya — 1) */
  level: number;
  onChange: (emblem: string) => void;
}) {
  const e: Emblem = parseEmblem(value) ?? parseEmblem(DEFAULT_EMBLEM)!;
  const set = (patch: Partial<Emblem>) => {
    const next = { ...e, ...patch };
    // ikki rang bir xil bo'lmasin: belgi rangi fonga tushsa — almashtiriladi
    if (next.bg === next.fg) {
      if (patch.bg !== undefined) next.fg = e.bg;
      else next.bg = e.fg;
    }
    onChange(encodeEmblem(next));
  };
  return (
    <div className="flex flex-col gap-3 border-2 border-border p-2 sm:flex-row">
      <div className="flex shrink-0 flex-col items-center gap-1">
        <EmblemIcon emblem={value} size={72} />
        <span className="text-muted-foreground">GERB</span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2" aria-label="Shakl">
          <span className="w-16 text-muted-foreground">SHAKL</span>
          {EMBLEM_SHAPES.map((s, i) => (
            <button
              key={s}
              type="button"
              aria-pressed={e.shape === i}
              onClick={() => set({ shape: i })}
              className={`inline-flex items-center gap-1 border-2 px-1 py-0.5 ${pixelFocus} ${
                e.shape === i ? "border-primary text-primary" : "border-border text-foreground"
              }`}
            >
              <EmblemIcon emblem={encodeEmblem({ ...e, shape: i })} size={14} />
              {SHAPE_NAME[s]}
            </button>
          ))}
        </div>
        {(["bg", "fg"] as const).map((k) => (
          <div
            key={k}
            className="flex flex-wrap items-center gap-1"
            aria-label={k === "bg" ? "Fon rangi" : "Belgi rangi"}
          >
            <span className="w-16 text-muted-foreground">{k === "bg" ? "FON" : "BELGI RANGI"}</span>
            {EMBLEM_COLORS.map((c, i) => (
              <Swatch
                key={c.name}
                hex={c.hex}
                name={c.name}
                level={c.level}
                on={e[k] === i}
                locked={c.level > level}
                onPick={() => set({ [k]: i })}
              />
            ))}
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-1" aria-label="Belgi">
          <span className="w-16 text-muted-foreground">BELGI</span>
          {EMBLEM_ICONS.map((ic, i) => {
            const locked = ic.level > level;
            return (
              <button
                key={ic.id}
                type="button"
                aria-pressed={e.icon === i}
                aria-label={locked ? `${ic.name} — ${ic.level}-darajada ochiladi` : ic.name}
                title={locked ? `${ic.name}: ${ic.level}-darajada ochiladi` : ic.name}
                disabled={locked}
                onClick={() => set({ icon: i })}
                className={`relative border-2 p-0.5 ${pixelFocus} ${
                  e.icon === i ? "border-primary" : "border-border"
                }`}
              >
                <EmblemIcon emblem={encodeEmblem({ ...e, icon: i })} size={20} dim={locked} />
                {locked && (
                  <span className="absolute -bottom-1 -right-1 bg-black px-[2px] text-[7px] leading-3 text-primary">
                    {ic.level}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <span className="text-muted-foreground">
          Raqamli qulf — gildiya shu darajaga yetganda ochiladi.
        </span>
      </div>
    </div>
  );
}
