/**
 * DO'STLAR: ro'yxat (onlayn/oflayn, qayerda), "YONIGA KIRISH" (do'st olamda bo'lsa), tayyor
 * iboralar bilan xabar, so'rovlar (qabul/rad), taxallus yoki do'st kodi bilan qo'shish, bloklash,
 * "Do'st chaqirish" (taklif havolasi, Telegram'da ulashish, hisob — docs/referrals.md).
 */
import { useEffect, useState, type ReactNode } from "react";
import { friends, placeText, useFriends } from "@/account/friends";
import {
  FRIEND_PHRASES,
  REF_DAILY_CAP,
  REF_GOLD,
  REF_SKIN_GOAL,
  formatFriendCode,
  type FriendInfo,
  type RefInfo,
} from "@/account/protocol";
import { account } from "@/account/account";
import { ERROR_TEXT, call } from "@/account/api";
import { refBotLink, refShareLink, refSiteLink, REF_SHARE_TEXT } from "@/account/referral";
import { openExternal } from "@/lib/desktop";
import { telegramShare } from "@/lib/telegram";
import { useAccount } from "@/account/useAccount";
import { pixelFocus } from "@/lib/pixel-ui";
import { AuthorBadge, HeroAvatar, LevelBadge, PixelWindow } from "./pixel";
import { GuildTagBadge } from "./GuildBadge";
import { ago, btn, tabBtn } from "./pixelUi";

type Tab = "list" | "requests" | "add" | "invite" | "inbox" | "blocked";

function Row({ f, children }: { f: FriendInfo; children?: ReactNode }) {
  return (
    <li className="flex flex-wrap items-center gap-2 border-2 border-border p-2">
      <HeroAvatar hero={f.avatar} size={24} />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="inline-flex items-center gap-2 text-foreground">
          <GuildTagBadge guild={f.guild} />
          <span className="truncate">{f.nick}</span>
          <LevelBadge level={f.level} />
          {f.author && <AuthorBadge />}
        </span>
        <span className={f.online ? "text-[#a6f08e]" : "text-muted-foreground"}>
          {f.online ? "● " : "○ "}
          {placeText(f)}
          {!f.online && f.seen > 0 ? ` · ${ago(f.seen)}` : ""}
        </span>
      </span>
      {children}
    </li>
  );
}

function FriendRow({ f, onJoin }: { f: FriendInfo; onJoin: (f: FriendInfo) => void }) {
  const [open, setOpen] = useState<"msg" | "more" | "remove" | "block" | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  return (
    <Row f={f}>
      <span className="flex flex-wrap gap-2">
        {f.room && (
          <button onClick={() => onJoin(f)} className={btn("pixel", "px-2 py-1")}>
            YONIGA KIRISH
          </button>
        )}
        <button
          aria-expanded={open === "msg"}
          onClick={() => setOpen(open === "msg" ? null : "msg")}
          className={btn("pixelOutline", "px-2 py-1")}
        >
          XABAR
        </button>
        <button
          aria-label={`${f.nick}: boshqa amallar`}
          aria-expanded={open === "more"}
          onClick={() => setOpen(open === "more" ? null : "more")}
          className={btn("pixelOutline", "px-2 py-1")}
        >
          ...
        </button>
      </span>
      {open === "msg" && (
        <div className="flex w-full flex-wrap gap-1" aria-label="Tayyor iboralar">
          {FRIEND_PHRASES.map((p, i) => (
            <button
              key={p}
              onClick={() =>
                void friends.send(f.id, i).then((ok) => {
                  if (!ok) return;
                  setSent(p);
                  setOpen(null);
                })
              }
              className={`border-2 border-border px-2 py-1 text-foreground hover:border-foreground ${pixelFocus}`}
            >
              {p}
            </button>
          ))}
        </div>
      )}
      {sent && open !== "msg" && (
        <span role="status" className="w-full text-[#a6f08e]">
          Yuborildi: {sent}
        </span>
      )}
      {open === "more" && (
        <div className="flex w-full flex-wrap gap-2">
          <button onClick={() => setOpen("remove")} className={btn("pixelOutline", "px-2 py-1")}>
            O'CHIRISH
          </button>
          <button onClick={() => setOpen("block")} className={btn("pixelOutline", "px-2 py-1")}>
            BLOKLASH
          </button>
        </div>
      )}
      {(open === "remove" || open === "block") && (
        <div className="flex w-full flex-col gap-2">
          <span className="text-foreground">
            {open === "remove"
              ? `${f.nick} do'stlar ro'yxatidan o'chirilsinmi?`
              : `${f.nick} bloklansinmi? U sizga so'rov va xabar yubora olmaydi.`}
          </span>
          <span className="flex flex-wrap gap-2">
            <button
              onClick={() => void (open === "remove" ? friends.remove(f.id) : friends.block(f.id))}
              className={btn("pixel", "px-2 py-1")}
            >
              HA
            </button>
            <button onClick={() => setOpen(null)} className={btn("pixelOutline", "px-2 py-1")}>
              YO'Q
            </button>
          </span>
        </div>
      )}
    </Row>
  );
}

function AddTab({ code }: { code: string }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const submit = async () => {
    setBusy(true);
    setRes(await friends.add(q));
    setBusy(false);
  };
  return (
    <>
      <p className="text-foreground">Do'stingizning taxallusi yoki do'st kodini yozing:</p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          autoFocus
          value={q}
          maxLength={32}
          autoComplete="off"
          spellCheck={false}
          aria-label="Taxallus yoki do'st kodi"
          placeholder="Taxallus yoki K7QW-2MXA"
          onChange={(e) => {
            setRes(null);
            setQ(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit();
          }}
          className={`w-56 border-2 border-border bg-background px-2 py-1 text-primary ${pixelFocus}`}
        />
        <button disabled={busy || !q.trim()} onClick={() => void submit()} className={btn("pixel")}>
          SO'ROV YUBORISH
        </button>
      </div>
      {res && (
        <p role="status" className={res.ok ? "text-[#a6f08e]" : "text-[#ff4d6d]"}>
          {res.text}
        </p>
      )}
      <p className="inline-flex flex-wrap items-center gap-2 text-foreground">
        Sizning do'st kodingiz:{" "}
        <span className="text-primary text-xs sm:text-sm">{formatFriendCode(code)}</span>
        <button
          onClick={() => {
            void navigator.clipboard?.writeText(formatFriendCode(code)).then(
              () => setCopied(true),
              () => {},
            );
          }}
          className={btn("pixelOutline", "px-2 py-1")}
        >
          {copied ? "NUSXALANDI" : "NUSXALASH"}
        </button>
      </p>
    </>
  );
}

/** Nusxalash tugmasi bilan havola */
function LinkRow({ label, link }: { label: string; link: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      <span className="text-foreground">{label}</span>
      <div className="flex flex-wrap items-center gap-2">
        <input
          readOnly
          value={link}
          aria-label={label}
          onFocus={(e) => e.currentTarget.select()}
          className={`min-w-0 flex-1 border-2 border-border bg-background px-2 py-1 text-primary ${pixelFocus}`}
        />
        <button
          onClick={() => {
            void navigator.clipboard?.writeText(link).then(
              () => setCopied(true),
              () => {},
            );
          }}
          className={btn("pixelOutline", "px-2 py-1")}
        >
          {copied ? "NUSXALANDI" : "NUSXALASH"}
        </button>
      </div>
    </div>
  );
}

/** Do'st chaqirish: shaxsiy havola, Telegram'da ulashish, nechta do'st chaqirilgani */
function InviteTab() {
  const [info, setInfo] = useState<RefInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const token = account.sessionToken;
    if (!token) return;
    let live = true;
    void call("ref/info", { token }).then((r) => {
      if (!live) return;
      if (r.ok) setInfo(r);
      else setError(ERROR_TEXT[r.error]);
    });
    return () => {
      live = false;
    };
  }, []);
  if (error)
    return (
      <p role="alert" className="text-[#ff4d6d]">
        {error}
      </p>
    );
  if (!info) return <p className="text-muted-foreground">Yuklanmoqda...</p>;
  const site = refSiteLink(info.code);
  const bot = refBotLink(info.code, info.bot);
  const share = bot ?? site;
  const toSkin = Math.max(0, REF_SKIN_GOAL - info.rewarded);
  return (
    <>
      <p className="text-foreground">
        Do'stingiz shu havola orqali <span className="text-primary">birinchi marta</span> akkaunt
        ochib, 1-to'lqinni tugatsa — ikkalangiz {REF_GOLD} oltin olasiz (sovg'a qutisiga).{" "}
        {REF_SKIN_GOAL} ta do'st — Ritsar uchun «CHAQIRUVCHI» skini.
      </p>
      {bot && <LinkRow label="Telegram bot havolasi:" link={bot} />}
      <LinkRow label="Sayt havolasi:" link={site} />
      <button
        onClick={() => {
          if (!telegramShare(share, REF_SHARE_TEXT)) openExternal(refShareLink(share));
        }}
        className={btn("pixel", "self-start")}
      >
        TELEGRAM'DA ULASHISH
      </button>
      <ul aria-label="Chaqirilgan do'stlar" className="flex flex-col gap-1 text-foreground">
        <li>
          Havola orqali kelganlar: <span className="text-primary">{info.joined}</span>
        </li>
        <li>
          1-to'lqinni tugatganlar (mukofot): <span className="text-primary">{info.rewarded}</span>
        </li>
        {info.queued > 0 && (
          <li className="text-muted-foreground">
            Navbatda: {info.queued} (kuniga ko'pi bilan {REF_DAILY_CAP} ta mukofot)
          </li>
        )}
        <li>
          «CHAQIRUVCHI» skini:{" "}
          {info.skin ? (
            <span className="text-[#a6f08e]">OLINDI</span>
          ) : (
            <span className="text-primary">
              {info.rewarded}/{REF_SKIN_GOAL} (yana {toSkin} ta)
            </span>
          )}
        </li>
      </ul>
    </>
  );
}

export function FriendsWindow({
  onClose,
  onJoin,
}: {
  onClose: () => void;
  /** do'st olamda: uning xonasiga, yoniga */
  onJoin: (f: FriendInfo) => void;
}) {
  const a = useAccount();
  const st = useFriends();
  const [tab, setTab] = useState<Tab>("list");
  useEffect(() => {
    void friends.refresh();
    // ro'yxat ochiq turganda holatlar yangilanib turadi
    const id = window.setInterval(() => void friends.refresh(), 30_000);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    if (tab === "inbox") friends.markRead();
  }, [tab, st.unread]);
  const me = a.me;
  if (!me) return null;
  const l = st.lists;
  const online = l?.friends.filter((f) => f.online).length ?? 0;
  const tabs: [Tab, string][] = [
    ["list", `DO'STLAR${l ? ` ${online}/${l.friends.length}` : ""}`],
    ["requests", `SO'ROVLAR${st.requests ? ` (${st.requests})` : ""}`],
    ["add", "QO'SHISH"],
    ["invite", "CHAQIRISH"],
    ["inbox", `XABARLAR${st.unread ? ` (${st.unread})` : ""}`],
    ["blocked", "BLOK"],
  ];
  return (
    <PixelWindow label="Do'stlar" title="DO'STLAR" onClose={onClose} wide>
      <div role="tablist" aria-label="Do'stlar bo'limlari" className="flex flex-wrap gap-2">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={tabBtn(tab === id)}
          >
            {label}
          </button>
        ))}
      </div>
      {st.error && (
        <p role="alert" className="text-[#ff4d6d]">
          {st.error}
        </p>
      )}
      {tab === "add" ? (
        <AddTab code={me.code} />
      ) : tab === "invite" ? (
        <InviteTab />
      ) : tab === "inbox" ? (
        st.inbox.length ? (
          <>
            <ul className="flex flex-col gap-1">
              {[...st.inbox].reverse().map((m) => (
                <li key={m.id} className="border-2 border-border p-2 text-foreground">
                  <span className="text-primary">{m.nick}:</span> {FRIEND_PHRASES[m.phrase]}{" "}
                  <span className="text-muted-foreground">· {ago(m.at)}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={() => friends.clearInbox()}
              className={btn("pixelOutline", "self-start")}
            >
              TOZALASH
            </button>
          </>
        ) : (
          <p className="text-muted-foreground">
            Xabar yo'q. Do'stlaringiz tayyor iboralar yuboradi.
          </p>
        )
      ) : !l ? (
        <p className="text-muted-foreground">{st.loading ? "Yuklanmoqda..." : "Ro'yxat yo'q"}</p>
      ) : tab === "list" ? (
        l.friends.length ? (
          <ul className="flex flex-col gap-2">
            {l.friends.map((f) => (
              <FriendRow key={f.id} f={f} onJoin={onJoin} />
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">
            Hali do'st yo'q. QO'SHISH bo'limida taxallus yoki do'st kodini yozing.
          </p>
        )
      ) : tab === "requests" ? (
        <>
          <h3 className="text-primary">KELGAN SO'ROVLAR</h3>
          {l.incoming.length ? (
            <ul className="flex flex-col gap-2">
              {l.incoming.map((f) => (
                <Row key={f.id} f={f}>
                  <span className="flex gap-2">
                    <button
                      onClick={() => void friends.answer(f.id, true)}
                      className={btn("pixel", "px-2 py-1")}
                    >
                      QABUL
                    </button>
                    <button
                      onClick={() => void friends.answer(f.id, false)}
                      className={btn("pixelOutline", "px-2 py-1")}
                    >
                      RAD
                    </button>
                  </span>
                </Row>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">Yangi so'rov yo'q.</p>
          )}
          <h3 className="text-primary">YUBORILGAN (JAVOB KUTILMOQDA)</h3>
          {l.outgoing.length ? (
            <ul className="flex flex-col gap-2">
              {l.outgoing.map((f) => (
                <Row key={f.id} f={f}>
                  <button
                    onClick={() => void friends.remove(f.id)}
                    className={btn("pixelOutline", "px-2 py-1")}
                  >
                    BEKOR
                  </button>
                </Row>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">Yo'q.</p>
          )}
        </>
      ) : l.blocked.length ? (
        <ul className="flex flex-col gap-2">
          {l.blocked.map((f) => (
            <Row key={f.id} f={f}>
              <button
                onClick={() => void friends.unblock(f.id)}
                className={btn("pixelOutline", "px-2 py-1")}
              >
                BLOKDAN CHIQARISH
              </button>
            </Row>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">Bloklangan o'yinchi yo'q.</p>
      )}
    </PixelWindow>
  );
}
