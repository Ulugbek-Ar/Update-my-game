/**
 * Gildiya gerbi va tegi (React): kod bilan chizilgan piksel gerb (src/game/emblem.ts) —
 * gildiya oynasi, profil, reyting va do'stlar ro'yxatida.
 */
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { EMBLEM_H, EMBLEM_W, drawEmblem } from "@/game/emblem";
import type { GuildTag } from "@/account/protocol";

/** Gerb rasmi: size — kenglik (px), balandlik nisbat bilan */
export function EmblemIcon({
  emblem,
  size = 32,
  dim = false,
  className,
}: {
  emblem: string;
  size?: number;
  dim?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current?.getContext("2d");
    if (!c) return;
    c.clearRect(0, 0, EMBLEM_W, EMBLEM_H);
    drawEmblem(c, emblem, 0, 0, 1);
  }, [emblem]);
  return (
    <canvas
      ref={ref}
      width={EMBLEM_W}
      height={EMBLEM_H}
      aria-hidden="true"
      className={cn("shrink-0", className)}
      style={{
        width: size,
        height: Math.round((size * EMBLEM_H) / EMBLEM_W),
        imageRendering: "pixelated",
        opacity: dim ? 0.35 : 1,
        filter: dim ? "grayscale(0.8)" : undefined,
      }}
    />
  );
}

/** Ism yonidagi belgi: kichik gerb va [TEG] */
export function GuildTagBadge({
  guild,
  size = 12,
  className,
}: {
  guild: GuildTag | null | undefined;
  size?: number;
  className?: string;
}) {
  if (!guild) return null;
  return (
    <span
      title={`Gildiya: [${guild.tag}]`}
      className={cn("inline-flex shrink-0 items-center gap-1 text-[#ffd97a]", className)}
    >
      <EmblemIcon emblem={guild.emblem} size={size} />[{guild.tag}]
    </span>
  );
}
