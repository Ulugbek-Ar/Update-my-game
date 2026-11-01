/**
 * PROFIL: taxallus, avatar, daraja, do'st kodi; BULUT bo'limi — sinxron holati, "HOZIR SAQLASH"
 * va serverdagi oxirgi 5 ta zaxira (tiklash bilan); "CHIQISH".
 */
import { useEffect, useState } from "react";
import { account } from "@/account/account";
import { ERROR_TEXT } from "@/account/api";
import { cloud, preview } from "@/account/cloud";
import { NICK_ERROR_TEXT, NICK_MAX, checkNick } from "@/account/nick";
import { useLevel } from "@/account/progression";
import { DEVICE_NAME, formatFriendCode, type BackupInfo, type Me } from "@/account/protocol";
import { loadStats, playTime } from "@/account/stats";
import { useAccount, useCloud } from "@/account/useAccount";
import { MAX_LEVEL, TITLES, levelProgress, titleOf } from "@/account/xp";
import { HERO_LIST, HERO_THEME, bestKeys, type Hero } from "@/game/hero";
import { loadUnlockedHeroes } from "@/game/save";
import { pixelFocus } from "@/lib/pixel-ui";
import { CloudDot } from "./AccountCorner";
import { EmblemIcon } from "./GuildBadge";
import { useGuild } from "@/account/guild";
import { ROLE_NAME } from "@/account/guildRules";
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

function readNum(key: string) {
  try {
    return Number(localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
}

/** Taxallus tahriri: 3–16 belgi, harf/raqam/_; haqoratli so'zlar filtri; bandligini server tekshiradi */
function NickEditor({ nick, onDone }: { nick: string; onDone: () => void }) {
  const [v, setV] = useState(nick);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const c = checkNick(v);
    if (!c.ok) return setErr(NICK_ERROR_TEXT[c.error]);
    if (c.nick === nick) return onDone();
    setBusy(true);
    const r = await account.updateProfile({ nick: c.nick });
    setBusy(false);
    if (r.ok) return onDone();
    setErr(
      r.error === "taken"
        ? "Bu taxallus band — boshqasini tanlang"
        : r.error === "nick"
          ? NICK_ERROR_TEXT.chars
          : ERROR_TEXT[r.error],
    );
  };
  return (
    <div className="flex flex-col gap-2 border-2 border-primary p-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          autoFocus
          value={v}
          maxLength={NICK_MAX}
          autoComplete="off"
          spellCheck={false}
          aria-label="Yangi taxallus"
          onChange={(e) => {
            setErr(null);
            setV(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") void save();
            if (e.key === "Escape") e.stopPropagation();
          }}
          className={`w-44 border-2 border-border bg-background px-2 py-1 text-primary ${pixelFocus}`}
        />
        <button disabled={busy} onClick={() => void save()} className={btn("pixel")}>
          {busy ? "..." : "SAQLASH"}
        </button>
        <button onClick={onDone} className={btn("pixelOutline")}>
          BEKOR
        </button>
      </div>
      <span className="text-muted-foreground">3–16 belgi: harf, raqam va _ (bo'shliqsiz).</span>
      {err && (
        <span role="alert" className="text-[#ff4d6d]">
          {err}
        </span>
      )}
    </div>
  );
}

/** Avatar: faqat ochilgan qahramonlardan */
function AvatarPicker({ me, onDone }: { me: Me; onDone: () => void }) {
  const owned = loadUnlockedHeroes();
  const [err, setErr] = useState<string | null>(null);
  const pick = async (h: Hero) => {
    // yangi sotib olingan qahramon bulutda ham bo'lsin (server shuni tekshiradi)
    if (cloud.isDirty()) await cloud.syncNow();
    const r = await account.updateProfile({ avatar: h });
    if (r.ok) return onDone();
    setErr(r.error === "none" ? "Bu qahramon hali ochilmagan" : ERROR_TEXT[r.error]);
  };
  return (
    <div className="flex flex-col gap-2 border-2 border-primary p-2">
      <span className="text-foreground">Avatar — ochilgan qahramonlardan biri:</span>
      <div className="flex flex-wrap gap-2">
        {HERO_LIST.filter((h) => owned.has(h.id)).map((h) => (
          <button
            key={h.id}
            aria-pressed={me.avatar === h.id}
            aria-label={h.name}
            onClick={() => void pick(h.id)}
            className={`flex flex-col items-center gap-1 border-2 p-1 ${pixelFocus}`}
            style={{ borderColor: me.avatar === h.id ? HERO_THEME[h.id].accent : "#5c4a6e" }}
          >
            <HeroAvatar hero={h.id} size={32} />
            <span style={{ color: HERO_THEME[h.id].uiText }}>{h.name}</span>
          </button>
        ))}
      </div>
      {err && (
        <span role="alert" className="text-[#ff4d6d]">
          {err}
        </span>
      )}
      <button onClick={onDone} className={btn("pixelOutline", "self-start")}>
        YOPISH
      </button>
    </div>
  );
}

function ProfileTab({ me, rev }: { me: Me; rev: number }) {
  const { xp, level } = useLevel(rev);
  // gildiya: qurilmadagi qisqacha (daqiqada bir yangilanadi)
  const g = useGuild().brief;
  const [edit, setEdit] = useState<"nick" | "avatar" | null>(null);
  const [have, need] = levelProgress(xp);
  const st = loadStats();
  const records = HERO_LIST.map((h) => {
    const k = bestKeys(h.id);
    return {
      hero: h,
      best: readNum(k.best),
      ch2: readNum(k.ch2),
      ch3: readNum(k.ch3),
      endless: readNum(k.endless),
    };
  }).filter((r) => r.best || r.ch2 || r.ch3 || r.endless);
  return (
    <>
      <div className="flex items-start gap-3">
        <button
          onClick={() => setEdit("avatar")}
          title="Avatarni o'zgartirish"
          aria-label="Avatarni o'zgartirish"
          className={`shrink-0 border-2 border-border p-1 hover:border-foreground ${pixelFocus}`}
        >
          <HeroAvatar hero={me.avatar} size={48} />
        </button>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="inline-flex flex-wrap items-center gap-2 text-foreground text-xs sm:text-sm">
            <span className="truncate">{me.nick}</span>
            <LevelBadge level={level} />
            <button
              onClick={() => setEdit("nick")}
              aria-label="Taxallusni o'zgartirish"
              className="text-[9px] text-[#9fd0ef] underline sm:text-[10px]"
            >
              o'zgartirish
            </button>
          </span>
          <span className="text-primary">{titleOf(level)}</span>
          {/* XP chizig'i: joriy darajada yig'ilgani */}
          <span
            role="progressbar"
            aria-label="Keyingi darajagacha"
            aria-valuemin={0}
            aria-valuemax={need}
            aria-valuenow={have}
            className="block h-2 w-full max-w-[16rem] border border-black bg-[#3b2a3a]"
          >
            <span
              className="block h-full bg-[#9fd0ef]"
              style={{ width: `${Math.round((100 * have) / need)}%` }}
            />
          </span>
          <span className="text-muted-foreground">
            {level >= MAX_LEVEL ? `${xp} XP — eng yuqori daraja` : `${have} / ${need} XP`}
          </span>
          <span className="text-muted-foreground">
            Do'st kodi: <span className="text-primary">{formatFriendCode(me.code)}</span>
          </span>
          {g ? (
            <span className="inline-flex flex-wrap items-center gap-2 text-foreground">
              Gildiya: <EmblemIcon emblem={g.emblem} size={14} />
              <span className="text-[#ffd97a]">[{g.tag}]</span>
              <span>{g.name}</span>
              <LevelBadge level={g.level} />
              <span className="text-muted-foreground">· {ROLE_NAME[g.role]}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">Gildiya: yo'q — menyuda GILDIYA</span>
          )}
        </div>
      </div>
      {edit === "nick" && <NickEditor nick={me.nick} onDone={() => setEdit(null)} />}
      {edit === "avatar" && <AvatarPicker me={me} onDone={() => setEdit(null)} />}
      <h3 className="text-primary">STATISTIKA</h3>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-foreground">
        <li>
          O'ynalgan vaqt: <span className="text-primary">{playTime(st.time)}</span>
        </li>
        <li>
          Dushmanlar: <span className="text-primary">{st.kills}</span>
        </li>
        <li>
          Bosslar: <span className="text-primary">{st.bosses}</span>
        </li>
        <li>
          O'yinlar: <span className="text-primary">{st.runs}</span>
        </li>
      </ul>
      <h3 className="text-primary">ENG YAXSHI REKORDLAR</h3>
      {records.length ? (
        <ul className="flex flex-col gap-1">
          {records.map((r) => (
            <li key={r.hero.id} className="flex flex-wrap items-center gap-2 text-foreground">
              <HeroAvatar hero={r.hero.id} size={18} />
              <span style={{ color: HERO_THEME[r.hero.id].uiText }}>{r.hero.name}</span>
              {r.best > 0 && <span>Rekord: {r.best}</span>}
              {r.ch2 > 0 && <span>· 2-dunyo: {r.ch2}</span>}
              {r.ch3 > 0 && <span>· 3-dunyo: {r.ch3}</span>}
              {r.endless > 0 && <span>· Cheksiz: {r.endless}</span>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">Hali rekord yo'q — birinchi o'yinni boshlang!</p>
      )}
      <h3 className="text-primary">UNVONLAR</h3>
      <ul className="flex flex-wrap gap-2">
        {TITLES.map((t) => {
          const on = level >= t.level;
          return (
            <li
              key={t.level}
              className={`border-2 px-2 py-1 ${on ? "border-primary text-primary" : "border-border text-muted-foreground opacity-60"}`}
            >
              {t.level}: {t.name}
            </li>
          );
        })}
      </ul>
    </>
  );
}

export function ProfileWindow({
  onClose,
  onRestored = () => {},
  rev = 0,
}: {
  onClose: () => void;
  /** zaxiradan tiklandi — menyu holati qayta o'qilsin */
  onRestored?: () => void;
  /** progress almashtirilganda oshadi */
  rev?: number;
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
      {tab === "cloud" ? <CloudTab onRestored={onRestored} /> : <ProfileTab me={me} rev={rev} />}
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
      {tab === "profile" && <DeleteAccount nick={me.nick} onDone={onClose} />}
    </PixelWindow>
  );
}

/** Akkauntni o'chirish: taxallusni yozib tasdiqlanadi; serverdagi hamma narsa o'chadi */
function DeleteAccount({ nick, onDone }: { nick: string; onDone: () => void }) {
  const a = useAccount();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState("");
  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        className="self-start text-[9px] text-[#ff4d6d] underline sm:text-[10px]"
      >
        Akkauntni o'chirish
      </button>
    );
  const ok = v.trim().toLowerCase() === nick.toLowerCase();
  return (
    <div role="alertdialog" className="flex flex-col gap-2 border-2 border-[#ff4d6d] p-3">
      <p className="text-foreground">
        Akkaunt va serverdagi <span className="text-[#ff4d6d]">barcha ma'lumot</span> butunlay
        o'chadi: Telegram ID, taxallus, bulutdagi progress va zaxiralar, do'stlar, xabarlar,
        reyting. Qaytarib bo'lmaydi. Shu qurilmadagi progress qoladi.
      </p>
      <label className="flex flex-col gap-1 text-muted-foreground">
        Tasdiqlash uchun taxallusingizni yozing: {nick}
        <input
          value={v}
          autoComplete="off"
          spellCheck={false}
          aria-label="Taxallus (tasdiqlash)"
          onChange={(e) => setV(e.target.value)}
          className={`w-48 border-2 border-border bg-background px-2 py-1 text-foreground ${pixelFocus}`}
        />
      </label>
      {a.error && (
        <p role="alert" className="text-[#ff4d6d]">
          {a.error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          disabled={!ok || a.busy}
          onClick={() =>
            void account.deleteAccount().then((done) => {
              if (done) onDone();
            })
          }
          className={btn("pixel", "border-[#ff4d6d] bg-[#ff4d6d]")}
        >
          {a.busy ? "O'CHIRILMOQDA..." : "AKKAUNTNI O'CHIRISH"}
        </button>
        <button onClick={() => setOpen(false)} className={btn("pixelOutline")}>
          BEKOR
        </button>
      </div>
    </div>
  );
}
