/**
 * PROFIL: taxallus, avatar, daraja, do'st kodi, bulut holati va "Chiqish".
 */
import { useState } from "react";
import { account } from "@/account/account";
import { formatFriendCode } from "@/account/protocol";
import { useAccount, useCloud } from "@/account/useAccount";
import { CloudDot } from "./AccountCorner";
import { HeroAvatar, LevelBadge, PixelWindow } from "./pixel";
import { ago, btn, cloudText, when } from "./pixelUi";

export function ProfileWindow({ onClose }: { onClose: () => void }) {
  const a = useAccount();
  const c = useCloud();
  const [confirmOut, setConfirmOut] = useState(false);
  const me = a.me;
  if (!me) return null;
  return (
    <PixelWindow label="Profil" title="PROFIL" onClose={onClose}>
      <div className="flex items-center gap-3">
        <HeroAvatar hero={me.avatar} size={48} />
        <div className="flex min-w-0 flex-col gap-1">
          <span className="inline-flex items-center gap-2 text-foreground text-xs sm:text-sm">
            <span className="truncate">{me.nick}</span>
            <LevelBadge level={me.level} />
          </span>
          <span className="text-muted-foreground">
            Do'st kodi: <span className="text-primary">{formatFriendCode(me.code)}</span>
          </span>
          <span className="text-muted-foreground">Akkaunt: {when(me.created)}</span>
        </div>
      </div>
      <p className="inline-flex items-center gap-2 text-foreground">
        <CloudDot status={c.status} />
        {cloudText(c.status) || "Bulut: ulanmagan"}
        {c.syncedAt > 0 && <span className="text-muted-foreground">({ago(c.syncedAt)})</span>}
      </p>
      {confirmOut ? (
        <div className="flex flex-col gap-2 border-2 border-border p-3">
          <p className="text-foreground">
            Akkauntdan chiqasizmi? Progress bulutda saqlanadi va shu qurilmada ham qoladi — mehmon
            sifatida davom etasiz.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              disabled={a.busy}
              onClick={() => void account.logout().then(onClose)}
              className={btn("pixel")}
            >
              {a.busy ? "SAQLANMOQDA..." : "HA, CHIQISH"}
            </button>
            <button onClick={() => setConfirmOut(false)} className={btn("pixelOutline")}>
              YO'Q
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button onClick={onClose} className={btn("pixel")}>
            YOPISH
          </button>
          <button onClick={() => setConfirmOut(true)} className={btn("pixelOutline")}>
            CHIQISH
          </button>
        </div>
      )}
    </PixelWindow>
  );
}
