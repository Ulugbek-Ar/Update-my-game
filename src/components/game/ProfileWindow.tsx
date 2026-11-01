/**
 * PROFIL: taxallus, avatar, daraja, do'st kodi; BULUT bo'limi — sinxron holati, "HOZIR SAQLASH"
 * va serverdagi oxirgi 5 ta zaxira (tiklash bilan); "CHIQISH".
 */
import { useEffect, useState } from "react";
import { account } from "@/account/account";
import { cloud, preview } from "@/account/cloud";
import { DEVICE_NAME, formatFriendCode, type BackupInfo } from "@/account/protocol";
import { useAccount, useCloud } from "@/account/useAccount";
import { CloudDot } from "./AccountCorner";
import { HeroAvatar, Icon, LevelBadge, PixelWindow } from "./pixel";
import { ago, btn, cloudText, tabBtn, when } from "./pixelUi";

type Tab = "profile" | "cloud";

const REASON: Record<string, string> = {
  force: "tanlovdan oldin",
  conflict: "boshqa qurilma saqlashidan oldin",
  device: "boshqa qurilmaga o'tishdan oldin",
  time: "davriy nusxa",
  stale: "rad etilgan (eskiroq) nusxa",
  restore: "tiklashdan oldin",
};

function CloudTab({ onRestored }: { onRestored: () => void }) {
  const c = useCloud();
  const [list, setList] = useState<BackupInfo[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [ask, setAsk] = useState<BackupInfo | null>(null);
  const [done, setDone] = useState(false);
  useEffect(() => {
    let alive = true;
    void cloud.backups().then((b) => {
      if (!alive) return;
      setList(b);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);
  return (
    <>
      <p className="inline-flex flex-wrap items-center gap-2 text-foreground">
        <CloudDot status={c.status} />
        {cloudText(c.status) || "Bulut: ulanmagan"}
        {c.syncedAt > 0 && <span className="text-muted-foreground">({ago(c.syncedAt)})</span>}
      </p>
      {c.error && (
        <p role="alert" className="text-[#ff4d6d]">
          {c.error}
        </p>
      )}
      <p className="text-muted-foreground">
        Progress o'zgarsa 10 soniyada, o'yin yopilganda darhol bulutga yoziladi. Internet bo'lmasa —
        qurilmada qoladi va ulanganda yuboriladi. Boshqaruv sozlamalari har qurilmada o'zi.
      </p>
      <button
        disabled={c.status === "syncing"}
        onClick={() => void cloud.syncNow()}
        className={btn("pixel", "self-start")}
      >
        HOZIR SAQLASH
      </button>
      <h3 className="text-primary">ZAXIRALAR (OXIRGI 5 TA)</h3>
      {done && (
        <p role="status" className="text-[#a6f08e]">
          Zaxiradan tiklandi. Oldingi holat ham zaxiraga olindi.
        </p>
      )}
      {loading ? (
        <p className="text-muted-foreground">Yuklanmoqda...</p>
      ) : !list ? (
        <p className="text-muted-foreground">Zaxiralarni olib bo'lmadi (internet?).</p>
      ) : !list.length ? (
        <p className="text-muted-foreground">
          Hali zaxira yo'q. Boshqa qurilmadan saqlanganda va har 30 daqiqada nusxa olinadi.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {list.map((b) => {
            const p = preview(b.data);
            return (
              <li
                key={b.slot}
                className="flex flex-wrap items-center gap-2 border-2 border-border p-2"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-foreground">
                    {when(b.time)} · {DEVICE_NAME[b.device]}
                  </span>
                  <span className="text-muted-foreground">{REASON[b.reason] ?? b.reason}</span>
                  <span className="inline-flex flex-wrap items-center gap-2 text-foreground">
                    <LevelBadge level={p.level} />
                    <Icon id="coin" color="#ffcc33" />
                    {p.gold}
                    <Icon id="trophy" color="#ffcc33" />
                    {p.achievements} · Rekord: {p.best}
                  </span>
                </span>
                {ask?.slot === b.slot ? (
                  <span className="flex flex-wrap gap-2">
                    <button
                      onClick={() =>
                        void cloud.restore(b.slot).then((ok) => {
                          setAsk(null);
                          if (!ok) return;
                          setDone(true);
                          onRestored();
                          void cloud.backups().then(setList);
                        })
                      }
                      className={btn("pixel")}
                    >
                      HA, TIKLASH
                    </button>
                    <button onClick={() => setAsk(null)} className={btn("pixelOutline")}>
                      YO'Q
                    </button>
                  </span>
                ) : (
                  <button onClick={() => setAsk(b)} className={btn("pixelOutline")}>
                    TIKLASH
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

export function ProfileWindow({
  onClose,
  onRestored = () => {},
}: {
  onClose: () => void;
  /** zaxiradan tiklandi — menyu holati qayta o'qilsin */
  onRestored?: () => void;
}) {
  const a = useAccount();
  const [tab, setTab] = useState<Tab>("profile");
  const [confirmOut, setConfirmOut] = useState(false);
  const me = a.me;
  if (!me) return null;
  return (
    <PixelWindow
      label="Profil"
      title="PROFIL"
      onClose={onClose}
      head={
        <div role="tablist" aria-label="Profil bo'limlari" className="flex gap-2">
          <button
            role="tab"
            aria-selected={tab === "profile"}
            onClick={() => setTab("profile")}
            className={tabBtn(tab === "profile")}
          >
            PROFIL
          </button>
          <button
            role="tab"
            aria-selected={tab === "cloud"}
            onClick={() => setTab("cloud")}
            className={tabBtn(tab === "cloud")}
          >
            BULUT
          </button>
        </div>
      }
    >
      {tab === "cloud" ? (
        <CloudTab onRestored={onRestored} />
      ) : (
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
      )}
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
