/**
 * REYTING: haftalik (dushanba 00:00, Toshkent vaqti bilan yangilanadi) va umumiy.
 * Jadvallar: har qahramon bo'yicha 1-dunyo ochkosi, cheksiz rejim, kunlik sinov va Kul qirolini
 * eng tez yenggan jamoalar. Top-50 va o'yinchining o'z o'rni. Faqat kirgan o'yinchilar qatnashadi.
 */
import { useEffect, useState } from "react";
import { topScores } from "@/account/scores";
import { boardName, mmss, type BoardId } from "@/account/scoring";
import type { ScoreRow, ScoreTop } from "@/account/protocol";
import { useAccount } from "@/account/useAccount";
import { HERO_LIST, HERO_THEME, type Hero } from "@/game/hero";
import { pixelFocus } from "@/lib/pixel-ui";
import { HeroAvatar, LevelBadge, PixelWindow, TelegramIcon } from "./pixel";
import { btn, tabBtn } from "./pixelUi";

type Kind = "w1" | "endless" | "daily" | "ashking";

function left(ms: number) {
  const m = Math.max(0, Math.floor(ms / 60_000));
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  return d > 0 ? `${d} kun ${h} soat` : h > 0 ? `${h} soat ${m % 60} daqiqa` : `${m} daqiqa`;
}

function ScoreLine({ r, me, ash }: { r: ScoreRow; me: boolean; ash: boolean }) {
  return (
    <li
      className={`flex items-center gap-2 border-2 px-2 py-1 ${me ? "border-primary bg-primary/15" : "border-border"}`}
    >
      <span
        className={`w-7 shrink-0 text-right ${r.rank <= 3 ? "text-primary" : "text-muted-foreground"}`}
      >
        {r.rank > 0 ? `#${r.rank}` : "—"}
      </span>
      <HeroAvatar hero={r.avatar} size={20} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="inline-flex items-center gap-2 text-foreground">
          <span className="truncate">{r.nick}</span>
          <LevelBadge level={r.level} />
        </span>
        {ash && r.team && r.team.length > 1 && (
          <span className="truncate text-muted-foreground">Jamoa: {r.team.join(", ")}</span>
        )}
      </span>
      {!ash && r.hero && <HeroAvatar hero={r.hero} size={16} />}
      <span className="shrink-0 text-primary">{ash ? mmss(r.score / 10) : r.score}</span>
    </li>
  );
}

export function LeaderboardWindow({
  onClose,
  onLogin,
  hero,
}: {
  onClose: () => void;
  onLogin: () => void;
  /** dastlab tanlangan qahramon (1-dunyo jadvali) */
  hero: Hero;
}) {
  const a = useAccount();
  const [kind, setKind] = useState<Kind>("w1");
  const [h, setH] = useState<Hero>(hero);
  const [period, setPeriod] = useState<"week" | "all">("week");
  const [data, setData] = useState<ScoreTop | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const board: BoardId = kind === "w1" ? `w1:${h}` : kind;
  const meId = a.me?.id ?? 0;

  useEffect(() => {
    let alive = true;
    setState("loading");
    void topScores(board, period).then((t) => {
      if (!alive) return;
      setData(t);
      setState(t ? "ok" : "error");
    });
    return () => {
      alive = false;
    };
  }, [board, period, meId]);

  const ash = kind === "ashking";
  const mine = data?.me;
  const inTop = !!mine && data.rows.some((r) => r.id === mine.id);
  const kinds: [Kind, string][] = [
    ["w1", "1-DUNYO"],
    ["endless", "CHEKSIZ"],
    ["daily", "KUNLIK"],
    ["ashking", "KUL QIROLI"],
  ];
  return (
    <PixelWindow label="Reyting" title="REYTING" onClose={onClose} wide>
      <div role="tablist" aria-label="Reyting jadvallari" className="flex flex-wrap gap-2">
        {kinds.map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={kind === id}
            onClick={() => setKind(id)}
            className={tabBtn(kind === id)}
          >
            {label}
          </button>
        ))}
        <span className="mx-1 hidden w-px bg-border sm:block" />
        {(["week", "all"] as const).map((p) => (
          <button
            key={p}
            aria-pressed={period === p}
            onClick={() => setPeriod(p)}
            className={tabBtn(period === p)}
          >
            {p === "week" ? "HAFTALIK" : "UMUMIY"}
          </button>
        ))}
      </div>
      {kind === "w1" && (
        <div className="flex flex-wrap gap-2" aria-label="Qahramon">
          {HERO_LIST.map((x) => (
            <button
              key={x.id}
              aria-pressed={h === x.id}
              aria-label={x.name}
              onClick={() => setH(x.id)}
              className={`inline-flex items-center gap-1 border-2 px-2 py-1 ${pixelFocus}`}
              style={{
                borderColor: h === x.id ? HERO_THEME[x.id].accent : "#5c4a6e",
                color: HERO_THEME[x.id].uiText,
              }}
            >
              <HeroAvatar hero={x.id} size={16} />
              {x.name}
            </button>
          ))}
        </div>
      )}
      <p className="text-muted-foreground">
        {boardName(board)}
        {kind === "w1" ? " — eng yuqori ochko" : ash ? " — jamoa bo'lib, onlayn olamda" : ""}
        {period === "week" && data
          ? ` · yangilanadi: dushanba 00:00 (Toshkent), ${left(data.resets - Date.now())} qoldi`
          : ""}
      </p>
      {state === "loading" ? (
        <p className="text-muted-foreground">Yuklanmoqda...</p>
      ) : state === "error" || !data ? (
        <p className="text-[#ff4d6d]">Reytingni olib bo'lmadi — internetni tekshiring.</p>
      ) : !data.rows.length ? (
        <p className="text-muted-foreground">
          Hali natija yo'q — birinchi bo'ling!
          {ash ? " Kul qirolini do'stlar bilan onlayn olamda yenging." : ""}
        </p>
      ) : (
        <ol className="flex flex-col gap-1" aria-label="Top-50">
          {data.rows.map((r) => (
            <ScoreLine key={r.id} r={r} me={r.id === meId} ash={ash} />
          ))}
        </ol>
      )}
      {a.me ? (
        mine ? (
          !inTop && (
            <div className="flex flex-col gap-1">
              <span className="text-primary">SIZNING O'RNINGIZ</span>
              <ScoreLine r={mine} me ash={ash} />
              {mine.hidden && (
                <span className="text-muted-foreground">
                  Natijangiz tekshiruvda — hozircha reytingda ko'rinmaydi.
                </span>
              )}
            </div>
          )
        ) : (
          state === "ok" && (
            <p className="text-muted-foreground">
              Sizda bu jadvalda natija yo'q —{" "}
              {ash ? "Kul qirolini onlayn olamda yenging" : "o'ynang va reytingga kiring"}.
            </p>
          )
        )
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground">
            Reytingda faqat kirgan o'yinchilar qatnashadi.
          </span>
          <button onClick={onLogin} className={btn("pixel", "inline-flex items-center gap-2")}>
            <TelegramIcon />
            KIRISH
          </button>
        </div>
      )}
    </PixelWindow>
  );
}
