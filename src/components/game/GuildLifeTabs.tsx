/**
 * Gildiya oynasining hayot bo'limlari: XAZINA (kunlik chegarali hissa, jurnal), TOPSHIRIQLAR
 * (haftalik umumiy maqsadlar va a'zolar hissasi) va CHAT (tayyor iboralar + erkin matn).
 */
import { useEffect, useRef, useState } from "react";
import { guild, leftText, useGuild, type GuildResult } from "@/account/guild";
import {
  CHAT_MAX,
  GIVE_MIN,
  GUILD_PHRASES,
  GUILD_XP_PER_GOLD,
  QUEST_DEFS,
  ROLE_NAME,
  canDeleteMsg,
  type GuildRole,
  type QuestKind,
} from "@/account/guildRules";
import type { GuildLogEntry, GuildMine, GuildQuest } from "@/account/protocol";
import { loadGold } from "@/game/shop";
import { pixelFocus } from "@/lib/pixel-ui";
import { Icon } from "./pixel";
import { ago, btn } from "./pixelUi";

const ROLE_COLOR: Record<GuildRole, string> = {
  leader: "#ffcc33",
  officer: "#9fd0ef",
  member: "#c8c0d8",
};

function Bar({ have, need, color = "#ffcc33" }: { have: number; need: number; color?: string }) {
  const pct = need > 0 ? Math.min(100, Math.round((100 * have) / need)) : 100;
  return (
    <span
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={need}
      aria-valuenow={Math.min(have, need)}
      className="block h-2 w-full border border-black bg-[#3b2a3a]"
    >
      <span className="block h-full" style={{ width: `${pct}%`, background: color }} />
    </span>
  );
}

/** Jurnal yozuvi matni */
function logText(e: GuildLogEntry) {
  if (e.kind.startsWith("quest:")) {
    const k = e.kind.slice(6) as QuestKind;
    const def = QUEST_DEFS[k];
    return `Topshiriq bajarildi: ${def ? def.text(Number(e.other) || 0) : k} (+${e.amount} gildiya XP)`;
  }
  switch (e.kind) {
    case "create":
      return `${e.nick} gildiyani tuzdi`;
    case "give":
      return `${e.nick} xazinaga ${e.amount} oltin qo'shdi`;
    case "join":
      return e.other ? `${e.nick} qo'shildi (qabul qildi: ${e.other})` : `${e.nick} qo'shildi`;
    case "leave":
      return `${e.nick} gildiyadan chiqdi`;
    case "kick":
      return `${e.nick} chiqarildi${e.other ? ` (${e.other})` : ""}`;
    case "promote":
      return `${e.nick} — o'rinbosar${e.other ? ` (${e.other})` : ""}`;
    case "demote":
      return `${e.nick} — oddiy a'zo${e.other ? ` (${e.other})` : ""}`;
    case "leader":
      return `${e.nick} — yangi rahbar`;
    case "mute":
      return e.amount > 0
        ? `${e.nick} chatda jim qilindi (${e.amount >= 60 ? `${e.amount / 60} soat` : `${e.amount} daqiqa`})`
        : `${e.nick} — jimlik olib tashlandi`;
    default:
      return e.kind;
  }
}

export function TreasuryTab({ st, onDone }: { st: GuildMine; onDone: (r: GuildResult) => void }) {
  const [log, setLog] = useState<GuildLogEntry[] | null>(null);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const left = Math.max(0, st.giveCap - st.given);
  const gold = loadGold();
  useEffect(() => {
    let alive = true;
    void guild.log().then((l) => alive && setLog(l));
    return () => {
      alive = false;
    };
  }, [st.guild.treasury]);
  const give = async (n: number) => {
    setBusy(true);
    const r = await guild.give(n);
    setBusy(false);
    if (r.ok) setAmount("");
    onDone(r);
  };
  const n = Math.floor(Number(amount));
  return (
    <>
      <p className="inline-flex flex-wrap items-center gap-2 text-xs text-foreground sm:text-sm">
        <Icon id="coin" color="#ffcc33" size={16} />
        XAZINA: <span className="text-primary">{st.guild.treasury}</span> oltin
      </p>
      <p className="text-muted-foreground">
        Har a'zo kuniga {st.giveCap} oltingacha qo'shadi. 1 oltin = {GUILD_XP_PER_GOLD} gildiya XP —
        gildiya darajasi o'sadi. Xazina gildiyaniki: undan oltin olinmaydi.
      </p>
      <div className="flex flex-col gap-1">
        <span className="text-foreground">
          Bugun qo'shdingiz: <span className="text-primary">{st.given}</span>/{st.giveCap} · Sizda:{" "}
          {gold} oltin
        </span>
        <Bar have={st.given} need={st.giveCap} />
      </div>
      {left >= GIVE_MIN ? (
        <div className="flex flex-wrap items-center gap-2">
          {[10, 25, 50]
            .filter((v) => v <= left)
            .map((v) => (
              <button
                key={v}
                disabled={busy || gold < v}
                onClick={() => void give(v)}
                className={btn("pixelOutline", "gap-1 px-2 py-1")}
              >
                <Icon id="coin" color="#ffcc33" size={10} />
                {v}
              </button>
            ))}
          <input
            value={amount}
            inputMode="numeric"
            aria-label="Hissa miqdori"
            placeholder={`${GIVE_MIN}–${left}`}
            onChange={(e) => setAmount(e.target.value.replace(/\D/g, "").slice(0, 4))}
            className={`w-20 border-2 border-border bg-background px-2 py-1 text-primary ${pixelFocus}`}
          />
          <button
            disabled={busy || !(n >= GIVE_MIN && n <= left && n <= gold)}
            onClick={() => void give(n)}
            className={btn("pixel")}
          >
            {busy ? "..." : "HISSA QO'SHISH"}
          </button>
        </div>
      ) : (
        <p className="text-[#a6f08e]">
          Bugungi hissangiz to'liq — rahmat! Ertaga yana qo'sha olasiz.
        </p>
      )}
      <h3 className="text-primary">JURNAL</h3>
      {!log ? (
        <p className="text-muted-foreground">Yuklanmoqda...</p>
      ) : !log.length ? (
        <p className="text-muted-foreground">Hali yozuv yo'q.</p>
      ) : (
        <ul className="flex flex-col gap-1" aria-label="Gildiya jurnali">
          {log.map((e) => (
            <li key={e.id} className="flex flex-wrap gap-2 border-b border-border/60 pb-1">
              <span className={e.kind === "give" ? "text-primary" : "text-foreground"}>
                {logText(e)}
              </span>
              <span className="text-muted-foreground">· {ago(e.at)}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function QuestCard({ q }: { q: GuildQuest }) {
  const def = QUEST_DEFS[q.kind];
  const done = q.done > 0;
  return (
    <li
      className={`flex flex-col gap-1 border-2 p-2 ${done ? "border-[#a6f08e]" : "border-border"}`}
    >
      <span className="inline-flex flex-wrap items-center gap-2 text-foreground">
        {done && <span className="text-[#a6f08e]">✓ BAJARILDI</span>}
        <span>{def.text(q.target)}</span>
      </span>
      <Bar have={q.progress} need={q.target} color={done ? "#a6f08e" : "#ffcc33"} />
      <span className="text-muted-foreground">
        {Math.min(q.progress, q.target)} / {q.target} {def.unit} · sovg'a: har a'zoga{" "}
        <span className="text-primary">+{q.gold} oltin</span>, gildiyaga +{q.gxp} XP
        {done ? ` · ${ago(q.done)}` : ""}
      </span>
      {q.top.length > 0 && (
        <ul className="flex flex-wrap gap-x-3 gap-y-1" aria-label="A'zolar hissasi">
          {q.top.slice(0, 10).map((t, i) => (
            <li key={t.id} className={i === 0 ? "text-primary" : "text-foreground"}>
              {t.nick}: {t.amount}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function QuestsTab({ st }: { st: GuildMine }) {
  return (
    <>
      <p className="text-muted-foreground">
        Haftalik gildiya topshiriqlari — hamma birga bajaradi. Har dushanba 00:00 (Toshkent vaqti)
        yangilanadi, {leftText(st.resets - Date.now())} qoldi. Hissa o'yindagi natijalardan o'zi
        hisoblanadi (bulutga saqlanganda): sarguzasht, cheksiz rejim, kunlik sinov va Abadiyat
        olami.
      </p>
      <ol className="flex flex-col gap-2" aria-label="Haftalik topshiriqlar">
        {st.quests.map((q) => (
          <QuestCard key={q.slot} q={q} />
        ))}
      </ol>
      <p className="text-muted-foreground">
        Bajarilgan topshiriq sovg'asi gildiya oynasini ochganda o'zi oltinga qo'shiladi.
      </p>
    </>
  );
}

export function ChatTab({ st, me }: { st: GuildMine; me: number }) {
  const v = useGuild();
  const [text, setText] = useState("");
  const [res, setRes] = useState<GuildResult | null>(null);
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLLIElement>(null);
  useEffect(() => {
    guild.openChat();
    return () => guild.closeChat();
  }, []);
  const last = v.chat[v.chat.length - 1]?.id ?? 0;
  useEffect(() => {
    end.current?.scrollIntoView?.({ block: "nearest" });
  }, [last]);
  const muted = v.muted > Date.now() ? v.muted : 0;
  const send = async (msg: string | number) => {
    setBusy(true);
    const r = await guild.say(msg);
    setBusy(false);
    if (r.ok) {
      if (typeof msg === "string") setText("");
      setRes(null);
    } else setRes(r);
  };
  return (
    <>
      <ul
        aria-label="Gildiya chati"
        className="flex max-h-56 min-h-24 flex-col gap-1 overflow-y-auto border-2 border-border p-2"
      >
        {!v.chat.length && (
          <li className="text-muted-foreground">Hali xabar yo'q — birinchi bo'lib yozing!</li>
        )}
        {v.chat.map((m) => {
          const own = m.from === me;
          const del = canDeleteMsg(st.role, m.role, own);
          return (
            <li key={m.id} className="flex items-start gap-2">
              <span className="min-w-0 flex-1 break-words text-foreground">
                <span
                  style={{ color: m.role ? ROLE_COLOR[m.role] : "#8a7a9a" }}
                  title={m.role ? ROLE_NAME[m.role] : "gildiyadan chiqqan"}
                >
                  {m.nick}:
                </span>{" "}
                {m.phrase >= 0 ? (
                  <span className="text-[#9fd0ef]">{GUILD_PHRASES[m.phrase] ?? ""}</span>
                ) : (
                  m.text
                )}{" "}
                <span className="text-muted-foreground">· {ago(m.at)}</span>
              </span>
              {del && (
                <button
                  aria-label={`${m.nick} xabarini o'chirish`}
                  title="O'chirish"
                  onClick={() => void guild.unsay(m.id).then((r) => !r.ok && setRes(r))}
                  className={`shrink-0 border border-border px-1 text-[8px] text-muted-foreground hover:text-[#ff4d6d] ${pixelFocus}`}
                >
                  X
                </button>
              )}
            </li>
          );
        })}
        <li ref={end} aria-hidden="true" />
      </ul>
      {res && !res.ok && (
        <p role="status" className="text-[#ff4d6d]">
          {res.text}
        </p>
      )}
      {muted ? (
        <p className="border-2 border-[#ff9a3c] p-2 text-[#ff9a3c]">
          Siz chatda jim qilingansiz — yana {leftText(muted - Date.now())}.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-1" aria-label="Tayyor iboralar">
            {GUILD_PHRASES.map((p, i) => (
              <button
                key={p}
                disabled={busy}
                onClick={() => void send(i)}
                className={`border-2 border-border px-2 py-1 text-foreground hover:border-foreground disabled:opacity-50 ${pixelFocus}`}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={text}
              maxLength={CHAT_MAX}
              autoComplete="off"
              aria-label="Xabar"
              placeholder="Xabar yozing (faqat gildiya a'zolari ko'radi)"
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && text.trim()) void send(text);
              }}
              className={`min-w-0 flex-1 border-2 border-border bg-background px-2 py-1 text-foreground ${pixelFocus}`}
            />
            <button
              disabled={busy || !text.trim()}
              onClick={() => void send(text)}
              className={btn("pixel")}
            >
              YUBORISH
            </button>
          </div>
        </>
      )}
      <p className="text-muted-foreground">
        Haqoratli so'zlar yulduzcha bilan yopiladi, havolalar yashiriladi. Serverda oxirgi 100 ta
        xabar saqlanadi. Rahbar va o'rinbosarlar xabarni o'chirishi va chatdan jim qilishi mumkin.
      </p>
    </>
  );
}
