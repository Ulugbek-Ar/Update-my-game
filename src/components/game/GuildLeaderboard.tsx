/**
 * GILDIYALAR reytingi (REYTING oynasidagi bo'lim): haftalik va umumiy — gildiya XP, bajarilgan
 * topshiriqlar, Kul qirolini eng tez yengan gildiya jamoasi. O'tgan hafta g'olibi (bayrog'i
 * vodiyda) va olam hududlari (hududlar urushi — tez orada).
 */
import { useEffect, useState } from "react";
import { guildTop, useGuild } from "@/account/guild";
import { GUILD_BOARDS, GUILD_BOARD_NAME, type GuildBoard } from "@/account/guildRules";
import type { GuildTop, GuildTopRow } from "@/account/protocol";
import { mmss } from "@/account/scoring";
import { EmblemIcon } from "./GuildBadge";
import { LevelBadge } from "./pixel";
import { tabBtn } from "./pixelUi";

function left(ms: number) {
  const m = Math.max(0, Math.floor(ms / 60_000));
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  return d > 0 ? `${d} kun ${h} soat` : h > 0 ? `${h} soat ${m % 60} daqiqa` : `${m} daqiqa`;
}

function Line({ r, mine, board }: { r: GuildTopRow; mine: boolean; board: GuildBoard }) {
  return (
    <li
      className={`flex items-center gap-2 border-2 px-2 py-1 ${mine ? "border-primary bg-primary/15" : "border-border"}`}
    >
      <span
        className={`w-7 shrink-0 text-right ${r.rank <= 3 ? "text-primary" : "text-muted-foreground"}`}
      >
        #{r.rank}
      </span>
      <EmblemIcon emblem={r.emblem} size={18} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="inline-flex items-center gap-2 text-foreground">
          <span className="text-[#ffd97a]">[{r.tag}]</span>
          <span className="truncate">{r.name}</span>
          <LevelBadge level={r.level} />
        </span>
        <span className="text-muted-foreground">{r.members} a'zo</span>
      </span>
      <span className="shrink-0 text-primary">
        {board === "ashking" ? mmss(r.score / 10) : r.score}
        {board === "xp" ? " XP" : board === "quests" ? " ta" : ""}
      </span>
    </li>
  );
}

export function GuildLeaderboard({ period }: { period: "week" | "all" }) {
  const [board, setBoard] = useState<GuildBoard>("xp");
  const [data, setData] = useState<GuildTop | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const mineId = useGuild().brief?.id ?? 0;
  useEffect(() => {
    let alive = true;
    setState("loading");
    void guildTop(board, period).then((t) => {
      if (!alive) return;
      setData(t);
      setState(t ? "ok" : "error");
    });
    return () => {
      alive = false;
    };
  }, [board, period]);
  const champ = data?.champ;
  const inTop = !!data?.me && data.rows.some((r) => r.id === data.me!.id);
  return (
    <>
      <div className="flex flex-wrap gap-2" aria-label="Gildiyalar jadvali">
        {GUILD_BOARDS.map((b) => (
          <button
            key={b}
            aria-pressed={board === b}
            onClick={() => setBoard(b)}
            className={tabBtn(board === b)}
          >
            {GUILD_BOARD_NAME[b]}
          </button>
        ))}
      </div>
      <p className="text-muted-foreground">
        {board === "xp"
          ? "Gildiya XP: xazina, haftalik topshiriqlar va Kul qiroli g'alabalari"
          : board === "quests"
            ? "Bajarilgan haftalik gildiya topshiriqlari"
            : "Kul qirolini eng tez yengan jamoa — hamma a'zolari bitta gildiyadan (kamida 2)"}
        {period === "week" && data
          ? ` · yangilanadi: dushanba 00:00 (Toshkent), ${left(data.resets - Date.now())} qoldi`
          : ""}
      </p>
      {champ && (
        <p className="inline-flex flex-wrap items-center gap-2 border-2 border-primary px-2 py-1 text-foreground">
          <EmblemIcon emblem={champ.emblem} size={16} />
          O'tgan hafta g'olibi: <span className="text-[#ffd97a]">[{champ.tag}]</span> {champ.name} (
          {champ.xp} XP) — bayrog'i vodiy maydonida hilpiraydi
        </p>
      )}
      {state === "loading" ? (
        <p className="text-muted-foreground">Yuklanmoqda...</p>
      ) : state === "error" || !data ? (
        <p className="text-[#ff4d6d]">Reytingni olib bo'lmadi — internetni tekshiring.</p>
      ) : !data.rows.length ? (
        <p className="text-muted-foreground">
          Hali natija yo'q — gildiyangiz bilan birinchi bo'ling!
        </p>
      ) : (
        <ol className="flex flex-col gap-1" aria-label="Gildiyalar top-50">
          {data.rows.map((r) => (
            <Line key={r.id} r={r} mine={r.id === mineId} board={board} />
          ))}
        </ol>
      )}
      {data?.me && !inTop && (
        <div className="flex flex-col gap-1">
          <span className="text-primary">SIZNING GILDIYANGIZ</span>
          <Line r={data.me} mine board={board} />
        </div>
      )}
      {data && (
        <>
          <h3 className="text-primary">HUDUDLAR</h3>
          <ul className="flex flex-col gap-1" aria-label="Hududlar">
            {data.territories.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-2 text-foreground">
                {t.name}:{" "}
                {t.controlledBy ? (
                  <span className="inline-flex items-center gap-1 text-[#ffd97a]">
                    <EmblemIcon emblem={t.controlledBy.emblem} size={12} />[{t.controlledBy.tag}]{" "}
                    {t.controlledBy.name}
                  </span>
                ) : (
                  <span className="text-muted-foreground">nazorat — hech kim</span>
                )}
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground">
            Hududlar urushi tez orada: gildiyalar olam hududlari uchun kurashadi.
          </p>
        </>
      )}
    </>
  );
}
