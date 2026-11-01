/**
 * Bosh menyuning chap yuqori burchagi: mehmon — "KIRISH", kirgan o'yinchi — avatar, taxallus,
 * daraja va bulut holati (bosilsa — profil). Progress tanlovi kutilayotgan bo'lsa — "TANLANG!".
 */
import { useAccount, useCloud } from "@/account/useAccount";
import { account } from "@/account/account";
import type { CloudStatus } from "@/account/cloud";
import { cn } from "@/lib/utils";
import { pixelFocus, pixelPress } from "@/lib/pixel-ui";
import { HeroAvatar, LevelBadge, TelegramIcon } from "./pixel";
import { btn, cloudText } from "./pixelUi";

/** Bulut belgisi: yashil — saqlangan, sariq — kutilmoqda, qizil — xato */
export function CloudDot({ status }: { status: CloudStatus }) {
  if (status === "off") return null;
  const color =
    status === "saved"
      ? "#a6f08e"
      : status === "error"
        ? "#ff4d6d"
        : status === "offline"
          ? "#8a7a9a"
          : "#ffcc33";
  return (
    <svg
      role="img"
      aria-label={cloudText(status)}
      viewBox="0 0 9 6"
      width={14}
      height={10}
      shapeRendering="crispEdges"
      className={cn("shrink-0", status === "syncing" && "gift-blink")}
    >
      <title>{cloudText(status)}</title>
      <path d="M3 0h3v1H3zM2 1h5v1H2zM1 2h7v1H1zM0 3h9v2H0zM1 5h7v1H1z" fill={color} />
    </svg>
  );
}

export function AccountCorner({
  onLogin,
  onProfile,
  onDecision,
}: {
  onLogin: () => void;
  onProfile: () => void;
  onDecision: () => void;
}) {
  const a = useAccount();
  const c = useCloud();
  if (!account.enabled) return null;
  if (!a.me)
    return (
      <button
        onClick={onLogin}
        title="Telegram bilan kirish: progress bulutda, do'stlar va reyting"
        className={btn("pixelOutline", "inline-flex items-center gap-1 px-2 py-0.5")}
      >
        <TelegramIcon />
        <span className={a.pending ? "gift-blink text-primary" : undefined}>
          {a.pending ? "KUTILMOQDA..." : "KIRISH"}
        </span>
      </button>
    );
  return (
    <div className="flex flex-col items-start gap-1">
      <button
        onClick={onProfile}
        aria-label={`Profil: ${a.me.nick}, ${a.me.level}-daraja`}
        className={`inline-flex max-w-full items-center gap-1 border-2 border-border bg-card px-1 py-0.5 text-foreground hover:border-foreground ${pixelPress} ${pixelFocus}`}
      >
        <HeroAvatar hero={a.me.avatar} size={16} />
        <span className="truncate">{a.me.nick}</span>
        <LevelBadge level={a.me.level} />
        <CloudDot status={c.status} />
      </button>
      {c.decision && (
        <button onClick={onDecision} className={btn("pixel", "gift-blink px-2 py-1")}>
          PROGRESSNI TANLANG!
        </button>
      )}
    </div>
  );
}
