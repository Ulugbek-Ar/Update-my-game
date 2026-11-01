/**
 * GILDIYA oynasi.
 *  - Gildiyasiz: QIDIRISH (nomi, darajasi, a'zolar, til, faollik), TUZISH (500 oltin: nom, teg,
 *    gerb muharriri, qo'shilish usuli, til), TAKLIFLAR (kelgan takliflar va yuborilgan arizalar).
 *  - Gildiyada: GILDIYA (daraja va foydalari), A'ZOLAR (rollar, chiqarish, rahbarlikni
 *    topshirish), ARIZALAR (rahbar/o'rinbosar: qabul, taklif), SOZLAMALAR.
 * Batafsil: docs/guilds.md
 */
import { useEffect, useState, type ReactNode } from "react";
import { guild, leftText, useGuild, type GuildResult } from "@/account/guild";
import {
  DEFAULT_EMBLEM,
  GUILD_COST,
  GUILD_LANGS,
  GUILD_MAX_LEVEL,
  GUILD_NAME_ERROR,
  GUILD_NAME_MAX,
  GUILD_TAG_ERROR,
  GUILD_TAG_MAX,
  JOIN_MODES,
  JOIN_MODE_NAME,
  JOIN_MODE_TEXT,
  LANG_NAME,
  ROLE_NAME,
  canKick,
  canManage,
  canSetRole,
  checkGuildName,
  checkGuildTag,
  guildCap,
  guildLevelProgress,
  levelPerks,
  type GuildLang,
  type GuildRole,
  type JoinMode,
} from "@/account/guildRules";
import type { GuildCard, GuildInfo, GuildMember, GuildMine, GuildNone } from "@/account/protocol";
import { useAccount } from "@/account/useAccount";
import { loadGold } from "@/game/shop";
import { pixelFocus } from "@/lib/pixel-ui";
import { EmblemEditor } from "./EmblemEditor";
import { EmblemIcon } from "./GuildBadge";
import { HeroAvatar, Icon, LevelBadge, PixelWindow } from "./pixel";
import { ago, btn, tabBtn, when } from "./pixelUi";

type InTab = "home" | "members" | "requests" | "settings";
type OutTab = "search" | "create" | "invites";

const ROLE_COLOR: Record<GuildRole, string> = {
  leader: "#ffcc33",
  officer: "#9fd0ef",
  member: "#c8c0d8",
};

export function RoleBadge({ role }: { role: GuildRole }) {
  return (
    <span
      className="inline-flex shrink-0 items-center border-2 px-1 text-[8px] leading-3"
      style={{ borderColor: ROLE_COLOR[role], color: ROLE_COLOR[role] }}
    >
      {ROLE_NAME[role]}
    </span>
  );
}

/** Amal natijasi (yashil — bajarildi, qizil — xato) */
function Status({ res }: { res: GuildResult | null }) {
  if (!res) return null;
  return (
    <p role="status" className={res.ok ? "text-[#a6f08e]" : "text-[#ff4d6d]"}>
      {res.text}
    </p>
  );
}

function Tabs<T extends string>({
  tabs,
  tab,
  onTab,
  label,
}: {
  tabs: [T, string][];
  tab: T;
  onTab: (t: T) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-2">
      {tabs.map(([id, text]) => (
        <button
          key={id}
          role="tab"
          aria-selected={tab === id}
          onClick={() => onTab(id)}
          className={tabBtn(tab === id)}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

/** Gildiya sarlavhasi: gerb, nom, teg, daraja va XP chizig'i */
function GuildHead({ g, role }: { g: GuildInfo; role?: GuildRole }) {
  const [have, need] = guildLevelProgress(g.xp);
  return (
    <div className="flex items-start gap-3">
      <EmblemIcon emblem={g.emblem} size={56} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="inline-flex flex-wrap items-center gap-2 text-xs text-foreground sm:text-sm">
          <span className="text-[#ffd97a]">[{g.tag}]</span>
          <span className="truncate">{g.name}</span>
          <LevelBadge level={g.level} />
          {role && <RoleBadge role={role} />}
        </span>
        <span
          role="progressbar"
          aria-label="Keyingi gildiya darajasigacha"
          aria-valuemin={0}
          aria-valuemax={need}
          aria-valuenow={have}
          className="block h-2 w-full max-w-[16rem] border border-black bg-[#3b2a3a]"
        >
          <span
            className="block h-full bg-primary"
            style={{ width: `${Math.round((100 * have) / need)}%` }}
          />
        </span>
        <span className="text-muted-foreground">
          {g.level >= GUILD_MAX_LEVEL
            ? `${g.xp} gildiya XP — eng yuqori daraja`
            : `${have} / ${need} gildiya XP`}
          {" · "}A'zolar: {g.members}/{g.cap} · {LANG_NAME[g.lang]} · {JOIN_MODE_NAME[g.mode]}
        </span>
      </div>
    </div>
  );
}

// ---------------- gildiyasiz ----------------

function GuildRow({
  g,
  children,
  onOpen,
}: {
  g: GuildCard;
  children?: ReactNode;
  onOpen?: () => void;
}) {
  return (
    <li className="flex flex-wrap items-center gap-2 border-2 border-border p-2">
      <button
        onClick={onOpen}
        disabled={!onOpen}
        aria-label={`${g.name}: batafsil`}
        className={`shrink-0 ${pixelFocus}`}
      >
        <EmblemIcon emblem={g.emblem} size={28} />
      </button>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="inline-flex flex-wrap items-center gap-2 text-foreground">
          <span className="text-[#ffd97a]">[{g.tag}]</span>
          <span className="truncate">{g.name}</span>
          <LevelBadge level={g.level} />
        </span>
        <span className="text-muted-foreground">
          A'zolar: {g.members}/{g.cap} · {LANG_NAME[g.lang]} · Faol: {g.active}
          {g.online > 0 && <span className="text-[#a6f08e]"> · Onlayn: {g.online}</span>} ·{" "}
          {JOIN_MODE_NAME[g.mode]}
        </span>
      </span>
      {children}
    </li>
  );
}

function MemberLine({ m, children }: { m: GuildMember; children?: ReactNode }) {
  return (
    <li className="flex flex-wrap items-center gap-2 border-2 border-border p-2">
      <HeroAvatar hero={m.avatar} size={24} />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="inline-flex flex-wrap items-center gap-2 text-foreground">
          <span className="truncate">{m.nick}</span>
          <LevelBadge level={m.level} />
          <RoleBadge role={m.role} />
          {m.muted > Date.now() && (
            <span className="text-[#ff9a3c]">jim: {leftText(m.muted - Date.now())}</span>
          )}
        </span>
        <span className={m.online ? "text-[#a6f08e]" : "text-muted-foreground"}>
          {m.online ? "● Onlayn" : `○ ${m.seen ? ago(m.seen) : "hali ko'rilmagan"}`}
          {m.given > 0 && (
            <span className="text-muted-foreground">
              {" "}
              · xazinaga: <span className="text-primary">{m.given}</span>
            </span>
          )}
        </span>
      </span>
      {children}
    </li>
  );
}

function SearchTab({ canJoin, onDone }: { canJoin: boolean; onDone: (r: GuildResult) => void }) {
  const [q, setQ] = useState("");
  const [lang, setLang] = useState<GuildLang | null>(null);
  const [list, setList] = useState<GuildCard[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<{ id: number; members: GuildMember[] } | null>(null);
  const run = async (query = q, l = lang) => {
    setBusy(true);
    setList(await guild.search(query, l ?? undefined));
    setBusy(false);
  };
  useEffect(() => {
    void run("", null);
    // birinchi ochilishda — eng faollari
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const join = async (g: GuildCard) => onDone(await guild.join(g.id));
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          maxLength={32}
          autoComplete="off"
          spellCheck={false}
          aria-label="Gildiya nomi yoki tegi"
          placeholder="Nomi yoki tegi"
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void run();
          }}
          className={`w-48 border-2 border-border bg-background px-2 py-1 text-primary ${pixelFocus}`}
        />
        <button onClick={() => void run()} disabled={busy} className={btn("pixel", "px-2 py-1")}>
          QIDIRISH
        </button>
        {[null, ...GUILD_LANGS].map((l) => (
          <button
            key={l ?? "all"}
            aria-pressed={lang === l}
            onClick={() => {
              setLang(l);
              void run(q, l);
            }}
            className={tabBtn(lang === l)}
          >
            {l ? LANG_NAME[l] : "HAMMASI"}
          </button>
        ))}
      </div>
      {!list ? (
        <p className="text-muted-foreground">{busy ? "Yuklanmoqda..." : "Internet yo'q"}</p>
      ) : !list.length ? (
        <p className="text-muted-foreground">
          Hech narsa topilmadi. O'zingiz gildiya tuzing — TUZISH bo'limi.
        </p>
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Gildiyalar">
          {list.map((g) => (
            <GuildRow
              key={g.id}
              g={g}
              onOpen={() =>
                open?.id === g.id
                  ? setOpen(null)
                  : void guild
                      .info(g.id)
                      .then((r) => r && setOpen({ id: g.id, members: r.members }))
              }
            >
              {g.members >= g.cap ? (
                <span className="text-muted-foreground">TO'LA</span>
              ) : g.mode === "invite" ? (
                <span className="text-muted-foreground">FAQAT TAKLIF</span>
              ) : (
                <button
                  disabled={!canJoin}
                  onClick={() => void join(g)}
                  className={btn("pixel", "px-2 py-1")}
                >
                  {g.mode === "open" ? "QO'SHILISH" : "ARIZA YUBORISH"}
                </button>
              )}
              {open?.id === g.id && (
                <ul className="flex w-full flex-wrap gap-x-3 gap-y-1 text-foreground">
                  {open.members.map((m) => (
                    <li key={m.id} className="inline-flex items-center gap-1">
                      <HeroAvatar hero={m.avatar} size={14} />
                      {m.nick}
                      {m.role !== "member" && (
                        <span style={{ color: ROLE_COLOR[m.role] }}>· {ROLE_NAME[m.role]}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </GuildRow>
          ))}
        </ul>
      )}
    </>
  );
}

function CreateTab({ blocked, onDone }: { blocked: boolean; onDone: (r: GuildResult) => void }) {
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [emblem, setEmblem] = useState(DEFAULT_EMBLEM);
  const [mode, setMode] = useState<JoinMode>("open");
  const [lang, setLang] = useState<GuildLang>("uz");
  const [busy, setBusy] = useState(false);
  const gold = loadGold();
  const n = checkGuildName(name);
  const t = checkGuildTag(tag);
  const nameErr = name && !n.ok ? GUILD_NAME_ERROR[n.error] : null;
  const tagErr = tag && !t.ok ? GUILD_TAG_ERROR[t.error] : null;
  const ready = n.ok && t.ok && gold >= GUILD_COST && !blocked && !busy;
  const submit = async () => {
    if (!ready) return;
    setBusy(true);
    const r = await guild.create({ name, tag, emblem, mode, lang });
    setBusy(false);
    onDone(r);
  };
  return (
    <>
      <p className="text-muted-foreground">
        O'z gildiyangizni tuzing: nomi, tegi va gerbini o'zingiz tanlaysiz. 20 tagacha a'zo, rahbar
        va 3 ta o'rinbosar.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-muted-foreground">
          NOMI ({GUILD_NAME_MAX} belgigacha)
          <input
            value={name}
            maxLength={GUILD_NAME_MAX + 4}
            autoComplete="off"
            spellCheck={false}
            aria-label="Gildiya nomi"
            placeholder="Qal'a Qo'riqchilari"
            onChange={(e) => setName(e.target.value)}
            className={`border-2 border-border bg-background px-2 py-1 text-primary ${pixelFocus}`}
          />
          {nameErr && <span className="text-[#ff4d6d]">{nameErr}</span>}
        </label>
        <label className="flex flex-col gap-1 text-muted-foreground">
          TEG (2–{GUILD_TAG_MAX} harf)
          <input
            value={tag}
            maxLength={GUILD_TAG_MAX + 2}
            autoComplete="off"
            spellCheck={false}
            autoCapitalize="characters"
            aria-label="Gildiya tegi"
            placeholder="PQ"
            onChange={(e) => setTag(e.target.value.toUpperCase())}
            className={`border-2 border-border bg-background px-2 py-1 tracking-widest text-primary ${pixelFocus}`}
          />
          {tagErr && <span className="text-[#ff4d6d]">{tagErr}</span>}
        </label>
      </div>
      <EmblemEditor value={emblem} level={1} onChange={setEmblem} />
      <div className="flex flex-wrap items-center gap-2" aria-label="Qo'shilish usuli">
        <span className="text-muted-foreground">QO'SHILISH:</span>
        {JOIN_MODES.map((m) => (
          <button
            key={m}
            aria-pressed={mode === m}
            title={JOIN_MODE_TEXT[m]}
            onClick={() => setMode(m)}
            className={tabBtn(mode === m)}
          >
            {JOIN_MODE_NAME[m]}
          </button>
        ))}
      </div>
      <p className="text-muted-foreground">{JOIN_MODE_TEXT[mode]}.</p>
      <div className="flex flex-wrap items-center gap-2" aria-label="Til">
        <span className="text-muted-foreground">TIL:</span>
        {GUILD_LANGS.map((l) => (
          <button
            key={l}
            aria-pressed={lang === l}
            onClick={() => setLang(l)}
            className={tabBtn(lang === l)}
          >
            {LANG_NAME[l]}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button disabled={!ready} onClick={() => void submit()} className={btn("pixel", "gap-1")}>
          {busy ? "TUZILMOQDA..." : "GILDIYA TUZISH"}
          <Icon id="coin" color="#ffcc33" size={10} />
          {GUILD_COST}
        </button>
        <span className={gold >= GUILD_COST ? "text-muted-foreground" : "text-[#ff4d6d]"}>
          Sizda: {gold} oltin
          {gold < GUILD_COST ? ` — yana ${GUILD_COST - gold} kerak` : ""}
        </span>
      </div>
    </>
  );
}

function InvitesTab({ st, onDone }: { st: GuildNone; onDone: (r: GuildResult) => void }) {
  return (
    <>
      <h3 className="text-primary">KELGAN TAKLIFLAR</h3>
      {st.invites.length ? (
        <ul className="flex flex-col gap-2">
          {st.invites.map((i) => (
            <GuildRow key={i.guild.id} g={i.guild}>
              <span className="w-full text-muted-foreground">
                {i.by ? `${i.by} taklif qildi` : "Taklif"} · {ago(i.at)}
              </span>
              <span className="flex gap-2">
                <button
                  onClick={() => void guild.reply(i.guild.id, true).then(onDone)}
                  className={btn("pixel", "px-2 py-1")}
                >
                  QABUL
                </button>
                <button
                  onClick={() => void guild.reply(i.guild.id, false).then(onDone)}
                  className={btn("pixelOutline", "px-2 py-1")}
                >
                  RAD
                </button>
              </span>
            </GuildRow>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">Taklif yo'q.</p>
      )}
      <h3 className="text-primary">YUBORGAN ARIZALARIM</h3>
      {st.applications.length ? (
        <ul className="flex flex-col gap-2">
          {st.applications.map((a) => (
            <GuildRow key={a.guild.id} g={a.guild}>
              <span className="text-muted-foreground">kutilmoqda · {ago(a.at)}</span>
              <button
                onClick={() => void guild.cancel(a.guild.id).then(onDone)}
                className={btn("pixelOutline", "px-2 py-1")}
              >
                BEKOR
              </button>
            </GuildRow>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">Ariza yo'q.</p>
      )}
    </>
  );
}

function NoGuild({ st }: { st: GuildNone }) {
  const [tab, setTab] = useState<OutTab>(st.invites.length ? "invites" : "search");
  const [res, setRes] = useState<GuildResult | null>(null);
  const cooling = st.cooldown > Date.now();
  const tabs: [OutTab, string][] = [
    ["search", "QIDIRISH"],
    ["create", "TUZISH"],
    ["invites", `TAKLIFLAR${st.invites.length ? ` (${st.invites.length})` : ""}`],
  ];
  return (
    <>
      <Tabs label="Gildiya bo'limlari" tabs={tabs} tab={tab} onTab={setTab} />
      {cooling && (
        <p className="border-2 border-[#ff9a3c] p-2 text-[#ff9a3c]">
          Gildiyadan chiqqaningizga 24 soat to'lmadi: yangi gildiyaga yana{" "}
          {leftText(st.cooldown - Date.now())} dan keyin qo'shila olasiz.
        </p>
      )}
      <Status res={res} />
      {tab === "search" ? (
        <SearchTab canJoin={!cooling} onDone={setRes} />
      ) : tab === "create" ? (
        <CreateTab blocked={cooling} onDone={setRes} />
      ) : (
        <InvitesTab st={st} onDone={setRes} />
      )}
    </>
  );
}

// ---------------- gildiyada ----------------

function HomeTab({ st }: { st: GuildMine }) {
  const g = st.guild;
  return (
    <>
      <GuildHead g={g} role={st.role} />
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-foreground">
        <li>
          Rahbar: <span className="text-primary">{g.leader}</span>
        </li>
        <li>
          Tuzilgan: <span className="text-primary">{when(g.created).slice(0, 10)}</span>
        </li>
        <li>
          Xazina: <span className="text-primary">{g.treasury} oltin</span>
        </li>
        <li>
          Onlayn: <span className="text-[#a6f08e]">{g.online}</span> · faol: {g.active}
        </li>
      </ul>
      <h3 className="text-primary">DARAJA FOYDALARI</h3>
      <ol className="flex flex-col gap-1" aria-label="Daraja foydalari">
        {Array.from({ length: GUILD_MAX_LEVEL }, (_, i) => i + 1).map((l) => (
          <li
            key={l}
            className={`flex gap-2 border-2 px-2 py-1 ${
              l === g.level
                ? "border-primary bg-primary/15 text-foreground"
                : l < g.level
                  ? "border-border text-foreground"
                  : "border-border text-muted-foreground opacity-70"
            }`}
          >
            <LevelBadge level={l} />
            <span>{levelPerks(l).join(" · ")}</span>
          </li>
        ))}
      </ol>
      <p className="text-muted-foreground">
        Gildiya XP xazinaga hissa va haftalik gildiya topshiriqlari bilan o'sadi. A'zolar sig'imi:{" "}
        {guildCap(g.level)}.
      </p>
    </>
  );
}

function MemberActions({
  m,
  role,
  onDone,
}: {
  m: GuildMember;
  role: GuildRole;
  onDone: (r: GuildResult) => void;
}) {
  const [ask, setAsk] = useState<"kick" | "lead" | null>(null);
  const up = canSetRole(role, m.role, "officer");
  const down = canSetRole(role, m.role, "member");
  const kick = canKick(role, m.role);
  const lead = role === "leader" && m.role !== "leader";
  if (!up && !down && !kick && !lead) return null;
  if (ask)
    return (
      <span className="flex w-full flex-col gap-2">
        <span className="text-foreground">
          {ask === "kick"
            ? `${m.nick} gildiyadan chiqarilsinmi?`
            : `Rahbarlik ${m.nick} ga topshirilsinmi? Siz o'rinbosar bo'lasiz.`}
        </span>
        <span className="flex gap-2">
          <button
            onClick={() =>
              void (ask === "kick" ? guild.kick(m.id) : guild.transfer(m.id)).then((r) => {
                setAsk(null);
                onDone(r);
              })
            }
            className={btn("pixel", "px-2 py-1")}
          >
            HA
          </button>
          <button onClick={() => setAsk(null)} className={btn("pixelOutline", "px-2 py-1")}>
            YO'Q
          </button>
        </span>
      </span>
    );
  return (
    <span className="flex flex-wrap gap-2">
      {up && (
        <button
          onClick={() => void guild.setRole(m.id, "officer").then(onDone)}
          className={btn("pixelOutline", "px-2 py-1")}
        >
          O'RINBOSAR QILISH
        </button>
      )}
      {down && (
        <button
          onClick={() => void guild.setRole(m.id, "member").then(onDone)}
          className={btn("pixelOutline", "px-2 py-1")}
        >
          A'ZO QILISH
        </button>
      )}
      {lead && (
        <button onClick={() => setAsk("lead")} className={btn("pixelOutline", "px-2 py-1")}>
          RAHBARLIKNI TOPSHIRISH
        </button>
      )}
      {kick && (
        <button onClick={() => setAsk("kick")} className={btn("pixelOutline", "px-2 py-1")}>
          CHIQARISH
        </button>
      )}
    </span>
  );
}

function MembersTab({
  st,
  me,
  onDone,
}: {
  st: GuildMine;
  me: number;
  onDone: (r: GuildResult) => void;
}) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <ul className="flex flex-col gap-2" aria-label="A'zolar">
      {st.members.map((m) => (
        <MemberLine key={m.id} m={m}>
          {m.id !== me &&
            (canKick(st.role, m.role) ||
              canSetRole(st.role, m.role, "officer") ||
              st.role === "leader") && (
              <button
                aria-label={`${m.nick}: amallar`}
                aria-expanded={open === m.id}
                onClick={() => setOpen(open === m.id ? null : m.id)}
                className={btn("pixelOutline", "px-2 py-1")}
              >
                ...
              </button>
            )}
          {open === m.id && <MemberActions m={m} role={st.role} onDone={onDone} />}
        </MemberLine>
      ))}
    </ul>
  );
}

function RequestsTab({ st, onDone }: { st: GuildMine; onDone: (r: GuildResult) => void }) {
  const [q, setQ] = useState("");
  const apps = st.requests.filter((r) => r.kind === "apply");
  const sent = st.requests.filter((r) => r.kind === "invite");
  return (
    <>
      <p className="text-foreground">O'yinchini taklif qilish — taxallus yoki do'st kodi:</p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          maxLength={32}
          autoComplete="off"
          spellCheck={false}
          aria-label="Taklif: taxallus yoki do'st kodi"
          placeholder="Taxallus yoki K7QW-2MXA"
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void guild.invite(q).then(onDone);
          }}
          className={`w-56 border-2 border-border bg-background px-2 py-1 text-primary ${pixelFocus}`}
        />
        <button
          disabled={!q.trim()}
          onClick={() => void guild.invite(q).then(onDone)}
          className={btn("pixel")}
        >
          TAKLIF QILISH
        </button>
      </div>
      <h3 className="text-primary">ARIZALAR</h3>
      {apps.length ? (
        <ul className="flex flex-col gap-2">
          {apps.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2 border-2 border-border p-2">
              <HeroAvatar hero={r.avatar} size={24} />
              <span className="flex min-w-0 flex-1 items-center gap-2 text-foreground">
                <span className="truncate">{r.nick}</span>
                <LevelBadge level={r.level} />
                <span className="text-muted-foreground">{ago(r.at)}</span>
              </span>
              <span className="flex gap-2">
                <button
                  onClick={() => void guild.answer(r.id, true).then(onDone)}
                  className={btn("pixel", "px-2 py-1")}
                >
                  QABUL
                </button>
                <button
                  onClick={() => void guild.answer(r.id, false).then(onDone)}
                  className={btn("pixelOutline", "px-2 py-1")}
                >
                  RAD
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">Yangi ariza yo'q.</p>
      )}
      <h3 className="text-primary">YUBORILGAN TAKLIFLAR</h3>
      {sent.length ? (
        <ul className="flex flex-col gap-2">
          {sent.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2 border-2 border-border p-2">
              <HeroAvatar hero={r.avatar} size={24} />
              <span className="flex min-w-0 flex-1 items-center gap-2 text-foreground">
                <span className="truncate">{r.nick}</span>
                <span className="text-muted-foreground">
                  {r.by ? `${r.by} taklif qildi · ` : ""}
                  {ago(r.at)}
                </span>
              </span>
              <button
                onClick={() => void guild.answer(r.id, false).then(onDone)}
                className={btn("pixelOutline", "px-2 py-1")}
              >
                BEKOR
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">Yo'q.</p>
      )}
    </>
  );
}

function SettingsTab({ st, onDone }: { st: GuildMine; onDone: (r: GuildResult) => void }) {
  const g = st.guild;
  const leader = st.role === "leader";
  const [mode, setMode] = useState<JoinMode>(g.mode);
  const [lang, setLang] = useState<GuildLang>(g.lang);
  const [emblem, setEmblem] = useState(g.emblem);
  const [ask, setAsk] = useState<"leave" | "disband" | null>(null);
  const alone = st.members.length <= 1;
  const changed = mode !== g.mode || lang !== g.lang || emblem !== g.emblem;
  return (
    <>
      {leader ? (
        <>
          <div className="flex flex-wrap items-center gap-2" aria-label="Qo'shilish usuli">
            <span className="text-muted-foreground">QO'SHILISH:</span>
            {JOIN_MODES.map((m) => (
              <button
                key={m}
                aria-pressed={mode === m}
                title={JOIN_MODE_TEXT[m]}
                onClick={() => setMode(m)}
                className={tabBtn(mode === m)}
              >
                {JOIN_MODE_NAME[m]}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2" aria-label="Til">
            <span className="text-muted-foreground">TIL:</span>
            {GUILD_LANGS.map((l) => (
              <button
                key={l}
                aria-pressed={lang === l}
                onClick={() => setLang(l)}
                className={tabBtn(lang === l)}
              >
                {LANG_NAME[l]}
              </button>
            ))}
          </div>
          <EmblemEditor value={emblem} level={g.level} onChange={setEmblem} />
          <button
            disabled={!changed}
            onClick={() => void guild.settings({ mode, lang, emblem }).then(onDone)}
            className={btn("pixel", "self-start")}
          >
            SAQLASH
          </button>
        </>
      ) : (
        <p className="text-muted-foreground">
          Qo'shilish usuli, til va gerbni rahbar o'zgartiradi.
        </p>
      )}
      <h3 className="text-primary">GILDIYADAN CHIQISH</h3>
      {ask ? (
        <div role="alertdialog" className="flex flex-col gap-2 border-2 border-[#ff4d6d] p-2">
          <span className="text-foreground">
            {ask === "disband"
              ? `"${g.name}" tarqatilsinmi? Hamma a'zolar gildiyasiz qoladi, qaytarib bo'lmaydi.`
              : "Gildiyadan chiqasizmi? Boshqa gildiyaga 24 soatdan keyin qo'shila olasiz."}
          </span>
          <span className="flex gap-2">
            <button
              onClick={() =>
                void (ask === "disband" ? guild.disband() : guild.leave()).then((r) => {
                  setAsk(null);
                  onDone(r);
                })
              }
              className={btn("pixel", "border-[#ff4d6d] bg-[#ff4d6d]")}
            >
              {ask === "disband" ? "HA, TARQATISH" : "HA, CHIQISH"}
            </button>
            <button onClick={() => setAsk(null)} className={btn("pixelOutline")}>
              BEKOR
            </button>
          </span>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button
            disabled={leader && !alone}
            onClick={() => setAsk("leave")}
            className={btn("pixelOutline")}
          >
            CHIQISH
          </button>
          {leader && (
            <button onClick={() => setAsk("disband")} className={btn("pixelOutline")}>
              GILDIYANI TARQATISH
            </button>
          )}
          {leader && !alone && (
            <span className="text-muted-foreground">
              Rahbar chiqishdan oldin rahbarlikni topshiradi (A'ZOLAR bo'limi).
            </span>
          )}
        </div>
      )}
    </>
  );
}

function InGuild({ st, me }: { st: GuildMine; me: number }) {
  const [tab, setTab] = useState<InTab>("home");
  const [res, setRes] = useState<GuildResult | null>(null);
  const apps = st.requests.filter((r) => r.kind === "apply").length;
  const tabs: [InTab, string][] = [
    ["home", "GILDIYA"],
    ["members", `A'ZOLAR ${st.members.length}/${st.guild.cap}`],
    ...(canManage(st.role)
      ? [["requests", `ARIZALAR${apps ? ` (${apps})` : ""}`] as [InTab, string]]
      : []),
    ["settings", "SOZLAMALAR"],
  ];
  return (
    <>
      <Tabs label="Gildiya bo'limlari" tabs={tabs} tab={tab} onTab={setTab} />
      <Status res={res} />
      {tab === "home" ? (
        <HomeTab st={st} />
      ) : tab === "members" ? (
        <MembersTab st={st} me={me} onDone={setRes} />
      ) : tab === "requests" && canManage(st.role) ? (
        <RequestsTab st={st} onDone={setRes} />
      ) : (
        <SettingsTab st={st} onDone={setRes} />
      )}
    </>
  );
}

export function GuildWindow({ onClose }: { onClose: () => void }) {
  const a = useAccount();
  const v = useGuild();
  useEffect(() => {
    void guild.refresh();
    // oyna ochiq turganda (a'zolar onlayn holati, arizalar) yangilanib turadi
    const id = window.setInterval(() => void guild.refresh(), 30_000);
    return () => window.clearInterval(id);
  }, []);
  if (!a.me) return null;
  const st = v.state;
  return (
    <PixelWindow
      label="Gildiya"
      title={st?.guild ? `GILDIYA [${st.guild.tag}]` : "GILDIYA"}
      onClose={onClose}
      wide
    >
      {v.error && !st && (
        <p role="alert" className="text-[#ff4d6d]">
          {v.error}
        </p>
      )}
      {!st ? (
        <p className="text-muted-foreground">{v.loading ? "Yuklanmoqda..." : "Ma'lumot yo'q"}</p>
      ) : st.guild ? (
        <InGuild key={st.guild.id} st={st} me={a.me.id} />
      ) : (
        <NoGuild st={st} />
      )}
    </PixelWindow>
  );
}
