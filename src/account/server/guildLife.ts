/**
 * Gildiya hayoti (serverda): xazina (kunlik chegarali hissa, jurnal), gildiya XP va darajasi,
 * haftalik topshiriqlar (dushanba 00:00, Toshkent), sovg'alar va gildiya chati.
 *
 * Topshiriqlarga hissa klient yubormaydi: a'zoning bulutli saqlanishi qabul qilinganda
 * (oldingisidan davom etgan bo'lsa) statistika, XP va olam sirlaridagi o'sish hisoblanadi
 * (onSave) — saqlanishdagi cheklovlar (limits.ts) shu yerda ham amal qiladi. Kul qiroli
 * g'alabalarini olam serveri xabar qiladi (raid). Yozuvlar tejamli: a'zoning haftalik hissasi —
 * bitta qator, faqat shu haftaning topshiriqlari turlari yoziladi. Batafsil: docs/guilds.md
 */
import {
  CHAT_GAP_MS,
  CHAT_KEEP,
  GIVE_DAILY,
  GIVE_MIN,
  GUILD_XP_PER_GOLD,
  QUEST_DEFS,
  QUEST_KINDS,
  canDeleteMsg,
  canKick,
  cleanChat,
  questTier,
  weeklyQuests,
  type GuildRole,
  type QuestKind,
} from "../guildRules";
import { TASHKENT_OFFSET, nextWeekStart, tashkentDay, weekKey } from "../scoring";
import type { GuildChatMsg, GuildLogEntry, GuildQuest, GuildReward } from "../protocol";
import { XP_KEY, xpFromRaw } from "../xp";
import { first, num, str, type Row } from "./db";
import type { GuildFail, Guilds } from "./guilds";
import type { AccountStore, PlayerRow } from "./store";

const DAY = 86_400_000;
/** Saqlanishdagi kalitlar (src/account/stats.ts, src/game/realmLink.ts) */
const STATS_KEY = "pixel-rpg-stats";
const REALM_KEY = "pixel-rpg-realm";
/** Bitta saqlanishdagi o'sish shundan oshsa — shu bilan cheklanadi (imkonsiz sakrash) */
const DELTA_CAP = { kills: 3000, bosses: 30, waves: 300, runs: 30, secrets: 30, xp: 5000 };
type Counter = keyof typeof DELTA_CAP;
/** Sovg'alar shuncha saqlanadi; eski haftalar (topshiriqlar, hissalar) — 5 hafta */
const REWARD_KEEP = 30 * DAY;
const WEEKS_KEEP = 35 * DAY;
const PRUNE_EVERY = 3600_000;
/** Jurnal oynasida */
const LOG_SHOW = 60;

interface QuestRow extends Row {
  slot: number;
  kind: string;
  target: number;
  done: number;
}

const no = (error: GuildFail["error"], extra: Omit<GuildFail, "ok" | "error"> = {}): GuildFail => ({
  ok: false,
  error,
  ...extra,
});

const roleOf = (s: unknown): GuildRole | null =>
  s === "leader" || s === "officer" || s === "member" ? s : null;
const kindOf = (s: unknown): QuestKind =>
  (QUEST_KINDS as readonly string[]).includes(str(s as string)) ? (s as QuestKind) : "kills";

/** Saqlanishdagi hisoblagichlar: statistika, XP va olam sirlari */
export function counters(data: Record<string, string> | null): Record<Counter, number> {
  const out: Record<Counter, number> = {
    kills: 0,
    bosses: 0,
    waves: 0,
    runs: 0,
    secrets: 0,
    xp: 0,
  };
  if (!data) return out;
  try {
    const s = JSON.parse(data[STATS_KEY] ?? "null") as Record<string, unknown> | null;
    for (const k of ["kills", "bosses", "waves", "runs"] as const) {
      const n = Math.floor(Number(s?.[k]));
      out[k] = Number.isFinite(n) && n > 0 ? n : 0;
    }
  } catch {
    /* buzuq yozuv */
  }
  out.xp = xpFromRaw(data[XP_KEY]);
  try {
    const r = JSON.parse(data[REALM_KEY] ?? "null") as { player?: { secrets?: unknown } } | null;
    const sec = r?.player?.secrets;
    out.secrets = Array.isArray(sec) ? sec.length : 0;
  } catch {
    /* buzuq yozuv */
  }
  return out;
}

/** Gildiya zali trofeylari: yengilgan bosslar */
export const TROPHIES = ["devil", "queen", "king", "warden", "ashking"] as const;

/**
 * Saqlanishdagi yengilgan bosslar: asosiy o'yin bosslari (darvoza kalitlari, yutuqlar, yutilgan
 * dunyolar), olamda — Xaroba Sardori (Xaroba siri topshirig'i yoki Sardor qilichi) va Kul qiroli
 * (unvon). A'zo saqlanganda gildiyaning trofeylariga qo'shiladi.
 */
export function trophiesIn(data: Record<string, string>): string[] {
  const list = (k: string) => {
    try {
      const v = JSON.parse(data[k] ?? "[]") as unknown;
      return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
    } catch {
      return [];
    }
  };
  const keys = list("pixel-rpg-realm-keys");
  const ach = list("pixel-rpg-achievements");
  const out = new Set<string>();
  if (keys.includes("devil") || ach.includes("boss") || data["pixel-rpg-world1-won"])
    out.add("devil");
  if (keys.includes("queen") || ach.includes("queen") || data["pixel-rpg-world2-won"])
    out.add("queen");
  if (keys.includes("king") || data["pixel-rpg-world3-won"]) out.add("king");
  try {
    const p = (
      JSON.parse(data[REALM_KEY] ?? "null") as {
        player?: {
          titles?: unknown;
          quests?: Record<string, { status?: unknown }>;
          inv?: ({ item?: unknown } | null)[];
        };
      } | null
    )?.player;
    if (Array.isArray(p?.titles) && p.titles.includes("ashking")) out.add("ashking");
    if (p?.quests?.["ruins"]?.status === "done" || p?.inv?.some((s) => s?.item === "wardblade"))
      out.add("warden");
  } catch {
    /* buzuq olam saqlanishi */
  }
  return TROPHIES.filter((t) => out.has(t));
}

/** Keyingi Toshkent yarim tuni (kunlik hissa chegarasi yangilanadi) */
export function nextTashkentDay(now: number) {
  return Date.parse(`${tashkentDay(now)}T00:00:00Z`) - TASHKENT_OFFSET + DAY;
}

export class GuildLife {
  private prunedAt = 0;
  /** chatga oxirgi yozgan vaqti (xotirada) */
  private chatAt = new Map<number, number>();

  constructor(
    private store: AccountStore,
    private guilds: Guilds,
  ) {}

  private get db() {
    return this.store.db;
  }

  // ---------------- gildiya XP va hafta ----------------

  private addWeek(guild: number, week: string, col: "gxp" | "quests" | "ashking", n: number) {
    this.db.exec(
      `INSERT INTO guild_week (guild, week, ${col}) VALUES (?, ?, ?)
       ON CONFLICT (guild, week) DO UPDATE SET ${col} = ${col} + excluded.${col}`,
      guild,
      week,
      n,
    );
  }

  /** Gildiya XP (xazina, topshiriqlar, Kul qiroli): umumiy va haftalik */
  addXp(guild: number, n: number, now: number) {
    if (n <= 0) return;
    this.db.exec("UPDATE guilds SET xp = xp + ? WHERE id = ?", n, guild);
    this.addWeek(guild, weekKey(now), "gxp", n);
  }

  // ---------------- haftalik topshiriqlar ----------------

  /** Shu haftaning topshiriqlari: birinchi murojaatda yaratiladi (maqsad — a'zolar soniga qarab) */
  ensureQuests(guild: number, week: string): QuestRow[] {
    const rows = this.db
      .exec<QuestRow>(
        "SELECT slot, kind, target, done FROM guild_quests WHERE guild = ? AND week = ? ORDER BY slot",
        guild,
        week,
      )
      .toArray();
    if (rows.length) return rows;
    const tier = questTier(this.guilds.count(guild));
    const made = weeklyQuests(guild, week).map((kind, slot) => ({
      slot,
      kind,
      target: QUEST_DEFS[kind].targets[tier],
      done: 0,
    }));
    for (const q of made)
      this.db.exec(
        "INSERT OR IGNORE INTO guild_quests (guild, week, slot, kind, target, done) VALUES (?, ?, ?, ?, ?, 0)",
        guild,
        week,
        q.slot,
        q.kind,
        q.target,
      );
    return made;
  }

  /** A'zoning haftalik hissasi (bitta qator); faqat musbat qiymatlar */
  private contribute(
    guild: number,
    week: string,
    player: number,
    d: Partial<Record<QuestKind, number>>,
  ) {
    const cols = Object.entries(d).filter(
      (e): e is [QuestKind, number] =>
        (QUEST_KINDS as readonly string[]).includes(e[0]) && (e[1] ?? 0) > 0,
    );
    if (!cols.length) return false;
    const names = cols.map(([k]) => k);
    this.db.exec(
      `INSERT INTO guild_qc (guild, week, player, ${names.join(", ")})
       VALUES (?, ?, ?, ${names.map(() => "?").join(", ")})
       ON CONFLICT (guild, week, player) DO UPDATE SET
         ${names.map((k) => `${k} = ${k} + excluded.${k}`).join(", ")}`,
      guild,
      week,
      player,
      ...cols.map(([, v]) => Math.floor(v)),
    );
    return true;
  }

  private progress(guild: number, week: string): Record<QuestKind, number> {
    const s = first(
      this.db,
      `SELECT ${QUEST_KINDS.map((k) => `COALESCE(SUM(${k}), 0) AS ${k}`).join(", ")}
         FROM guild_qc WHERE guild = ? AND week = ?`,
      guild,
      week,
    );
    const w = first<{ ashking: number }>(
      this.db,
      "SELECT ashking FROM guild_week WHERE guild = ? AND week = ?",
      guild,
      week,
    );
    const out = {} as Record<QuestKind, number>;
    for (const k of QUEST_KINDS) out[k] = num(s?.[k]);
    // Kul qiroli: gildiya g'alabalari (bir jangda 3 a'zo — bitta g'alaba)
    out.ashking = num(w?.ashking);
    return out;
  }

  /** Bajarilgan topshiriqlar: har a'zoga oltin sovg'asi, gildiyaga XP */
  private check(guild: number, week: string, now: number) {
    const qs = this.ensureQuests(guild, week);
    if (qs.every((q) => num(q.done) > 0)) return;
    const prog = this.progress(guild, week);
    for (const q of qs) {
      const kind = kindOf(q.kind);
      if (num(q.done) > 0 || prog[kind] < num(q.target)) continue;
      this.db.exec(
        "UPDATE guild_quests SET done = ? WHERE guild = ? AND week = ? AND slot = ?",
        now,
        guild,
        week,
        q.slot,
      );
      const def = QUEST_DEFS[kind];
      const members = this.db
        .exec<{ player: number }>("SELECT player FROM guild_members WHERE guild = ?", guild)
        .toArray();
      for (const m of members)
        this.db.exec(
          "INSERT INTO guild_rewards (player, guild, gold, kind, week, at) VALUES (?, ?, ?, ?, ?, ?)",
          m.player,
          guild,
          def.gold,
          kind,
          week,
          now,
        );
      this.addXp(guild, def.gxp, now);
      this.addWeek(guild, week, "quests", 1);
      this.guilds.addLog(guild, 0, `quest:${kind}`, now, def.gxp, num(q.target));
    }
  }

  /** Shu hafta topshiriqlari: holati va a'zolar hissasi */
  quests(guild: number, now: number): GuildQuest[] {
    const week = weekKey(now);
    this.check(guild, week, now);
    const qs = this.ensureQuests(guild, week);
    const prog = this.progress(guild, week);
    const rows = this.db
      .exec<Row & { player: number; nick: string }>(
        `SELECT q.*, p.nick FROM guild_qc q JOIN players p ON p.id = q.player
          WHERE q.guild = ? AND q.week = ?`,
        guild,
        week,
      )
      .toArray();
    return qs.map((q) => {
      const kind = kindOf(q.kind);
      const def = QUEST_DEFS[kind];
      return {
        slot: num(q.slot),
        kind,
        target: num(q.target),
        progress: prog[kind],
        done: num(q.done),
        gold: def.gold,
        gxp: def.gxp,
        top: rows
          .map((r) => ({ id: num(r.player), nick: str(r.nick), amount: num(r[kind]) }))
          .filter((r) => r.amount > 0)
          .sort((a, b) => b.amount - a.amount || a.nick.localeCompare(b.nick)),
      };
    });
  }

  /**
   * Bulutli saqlanish qabul qilindi (oldingisidan davom etgan): hisoblagichlardagi o'sish
   * a'zoning haftalik hissasiga (faqat shu haftaning topshiriq turlari), keyin tekshiruv.
   */
  onSave(player: number, prev: Record<string, string>, next: Record<string, string>, now: number) {
    const m = this.guilds.member(player);
    if (!m) return;
    const guild = num(m.guild);
    const week = weekKey(now);
    const active = new Set(this.ensureQuests(guild, week).map((q) => kindOf(q.kind)));
    const a = counters(prev),
      b = counters(next);
    const d: Partial<Record<QuestKind, number>> = {};
    for (const k of Object.keys(DELTA_CAP) as Counter[])
      if (active.has(k)) d[k] = Math.max(0, Math.min(DELTA_CAP[k], b[k] - a[k]));
    if (this.contribute(guild, week, player, d)) this.check(guild, week, now);
    // zal devoridagi trofeylar: a'zo yenggan bosslar
    this.guilds.addTrophies(guild, trophiesIn(next));
    this.prune(now);
  }

  /**
   * Olam serveri: Kul qiroli yengildi. Jamoadagi har gildiyaga bitta g'alaba (bir jangda bir
   * gildiyadan bir nechta a'zo — baribir bitta), har a'zoga ishtirok hissasi.
   */
  raid(team: number[], now: number) {
    const week = weekKey(now);
    const byGuild = new Map<number, number[]>();
    for (const id of new Set(team)) {
      const m = this.guilds.member(id);
      if (!m) continue;
      const g = num(m.guild);
      byGuild.set(g, [...(byGuild.get(g) ?? []), id]);
    }
    for (const [guild, ids] of byGuild) {
      this.addWeek(guild, week, "ashking", 1);
      this.guilds.addTrophies(guild, ["ashking"]);
      const qs = this.ensureQuests(guild, week);
      if (qs.some((q) => kindOf(q.kind) === "ashking"))
        for (const id of ids) this.contribute(guild, week, id, { ashking: 1 });
      this.check(guild, week, now);
    }
    return byGuild;
  }

  // ---------------- xazina ----------------

  /** Bugun xazinaga qo'shgani (Toshkent kuni) */
  givenToday(player: number, now: number) {
    return num(
      first(
        this.db,
        "SELECT amount FROM guild_gifts WHERE player = ? AND day = ?",
        player,
        tashkentDay(now),
      )?.["amount"],
    );
  }

  /** Xazinaga hissa: kuniga ko'pi bilan GIVE_DAILY; 1 oltin = 1 gildiya XP */
  give(
    p: PlayerRow,
    amount: number,
    gold: number,
    rid: string,
    now: number,
  ): { ok: true; given: number; cap: number; treasury: number; dup?: boolean } | GuildFail {
    return this.db.tx(() => {
      const m = this.guilds.member(p.id);
      if (!m) return no("guild");
      const guild = num(m.guild);
      const g = this.guilds.row(guild);
      if (!g) return no("none");
      const today = this.givenToday(p.id, now);
      if (this.guilds.seen(p.id, rid))
        return {
          ok: true as const,
          given: today,
          cap: GIVE_DAILY,
          treasury: num(g.treasury),
          dup: true,
        };
      if (amount < GIVE_MIN) return no("bad", { field: "amount" });
      if (today + amount > GIVE_DAILY) return no("limit", { until: nextTashkentDay(now) });
      if (gold < amount) return no("gold");
      if (!this.guilds.goldPlausible(p.id, gold, now)) return no("invalid", { field: "gold" });
      this.db.exec(
        `INSERT INTO guild_gifts (player, day, amount) VALUES (?, ?, ?)
         ON CONFLICT (player, day) DO UPDATE SET amount = amount + excluded.amount`,
        p.id,
        tashkentDay(now),
        amount,
      );
      this.db.exec("UPDATE guilds SET treasury = treasury + ? WHERE id = ?", amount, guild);
      this.db.exec("UPDATE guild_members SET given = given + ? WHERE player = ?", amount, p.id);
      this.addXp(guild, amount * GUILD_XP_PER_GOLD, now);
      this.guilds.addLog(guild, p.id, "give", now, amount);
      const week = weekKey(now);
      if (this.ensureQuests(guild, week).some((q) => kindOf(q.kind) === "gold")) {
        this.contribute(guild, week, p.id, { gold: amount });
        this.check(guild, week, now);
      }
      this.guilds.remember(p.id, rid, now);
      return {
        ok: true as const,
        given: today + amount,
        cap: GIVE_DAILY,
        treasury: num(g.treasury) + amount,
      };
    });
  }

  /** Gildiya jurnali (oxirgi yozuvlar) */
  log(p: PlayerRow): { ok: true; entries: GuildLogEntry[] } | GuildFail {
    const m = this.guilds.member(p.id);
    if (!m) return no("guild");
    const entries = this.db
      .exec<
        Row & {
          id: number;
          kind: string;
          amount: number;
          at: number;
          anick: string | null;
          bnick: string | null;
          other: number;
        }
      >(
        `SELECT l.id, l.kind, l.amount, l.at, l.other, a.nick AS anick, b.nick AS bnick
           FROM guild_log l
           LEFT JOIN players a ON a.id = l.player
           LEFT JOIN players b ON b.id = l.other
          WHERE l.guild = ? ORDER BY l.id DESC LIMIT ?`,
        m.guild,
        LOG_SHOW,
      )
      .toArray()
      .map((r) => {
        const quest = str(r.kind).startsWith("quest:");
        return {
          id: num(r.id),
          kind: str(r.kind),
          nick: str(r.anick),
          // topshiriq yozuvida other — maqsad (son), boshqalarida — kim tomonidan
          other: quest ? String(num(r.other)) : str(r.bnick),
          amount: num(r.amount),
          at: num(r.at),
        };
      });
    return { ok: true, entries };
  }

  // ---------------- sovg'alar ----------------

  /** So'nggi 30 kundagi topshiriq sovg'alari (klient olinmaganlarini oladi) */
  rewards(player: number, now: number): GuildReward[] {
    return this.db
      .exec<Row & { id: number; gold: number; kind: string; week: string; at: number }>(
        "SELECT id, gold, kind, week, at FROM guild_rewards WHERE player = ? AND at > ? ORDER BY id",
        player,
        now - REWARD_KEEP,
      )
      .toArray()
      .map((r) => ({
        id: num(r.id),
        gold: num(r.gold),
        kind: kindOf(r.kind),
        week: str(r.week),
        at: num(r.at),
      }));
  }

  lastReward(player: number) {
    return num(
      first(this.db, "SELECT MAX(id) AS id FROM guild_rewards WHERE player = ?", player)?.["id"],
    );
  }

  // ---------------- chat ----------------

  lastChat(guild: number) {
    return num(
      first(this.db, "SELECT MAX(id) AS id FROM guild_chat WHERE guild = ?", guild)?.["id"],
    );
  }

  private chatRev(guild: number) {
    return num(first(this.db, "SELECT rev FROM guild_chatrev WHERE guild = ?", guild)?.["rev"]);
  }

  private chatRows(guild: number, since: number): GuildChatMsg[] {
    return this.db
      .exec<
        Row & {
          id: number;
          player: number;
          text: string;
          phrase: number;
          at: number;
          nick: string | null;
          role: string | null;
        }
      >(
        `SELECT * FROM (
           SELECT c.id, c.player, c.text, c.phrase, c.at, p.nick, gm.role
             FROM guild_chat c
             LEFT JOIN players p ON p.id = c.player
             LEFT JOIN guild_members gm ON gm.player = c.player AND gm.guild = c.guild
            WHERE c.guild = ? AND c.id > ?
            ORDER BY c.id DESC LIMIT ?)
         ORDER BY id ASC`,
        guild,
        since,
        CHAT_KEEP,
      )
      .toArray()
      .map((r) => ({
        id: num(r.id),
        from: num(r.player),
        nick: str(r.nick),
        role: roleOf(r.role),
        text: str(r.text),
        phrase: num(r.phrase),
        at: num(r.at),
      }));
  }

  /** Chat: yangi xabarlar (since dan keyin) yoki — xabar o'chirilgan bo'lsa — to'liq ro'yxat */
  chat(
    p: PlayerRow,
    since: number,
    rev: number,
    now: number,
  ): { ok: true; messages: GuildChatMsg[]; rev: number; full: boolean; muted: number } | GuildFail {
    const m = this.guilds.member(p.id);
    if (!m) return no("guild");
    const guild = num(m.guild);
    const cur = this.chatRev(guild);
    const full = since === 0 || rev !== cur;
    return {
      ok: true,
      messages: this.chatRows(guild, full ? 0 : since),
      rev: cur,
      full,
      muted: num(m.muted) > now ? num(m.muted) : 0,
    };
  }

  /** Chatga yozish: erkin matn (filtr bilan) yoki tayyor ibora; jim qilingan — yozolmaydi */
  say(
    p: PlayerRow,
    body: { text?: string | undefined; phrase?: number | undefined },
    now: number,
  ): { ok: true; message: GuildChatMsg } | GuildFail {
    const m = this.guilds.member(p.id);
    if (!m) return no("guild");
    if (num(m.muted) > now) return no("muted", { until: num(m.muted) });
    if (now - (this.chatAt.get(p.id) ?? 0) < CHAT_GAP_MS) return no("limit");
    const text = body.text !== undefined ? cleanChat(body.text) : "";
    if (body.text !== undefined && !text) return no("bad");
    const guild = num(m.guild);
    this.chatAt.set(p.id, now);
    if (this.chatAt.size > 5000) this.chatAt.clear();
    this.db.exec(
      "INSERT INTO guild_chat (guild, player, text, phrase, at) VALUES (?, ?, ?, ?, ?)",
      guild,
      p.id,
      text,
      body.phrase ?? -1,
      now,
    );
    const id = this.lastChat(guild);
    // serverda oxirgi 100 tasi qoladi
    this.db.exec(
      `DELETE FROM guild_chat WHERE guild = ? AND id <= (
         SELECT id FROM guild_chat WHERE guild = ? ORDER BY id DESC LIMIT 1 OFFSET ?)`,
      guild,
      guild,
      CHAT_KEEP,
    );
    return {
      ok: true,
      message: {
        id,
        from: p.id,
        nick: str(p.nick),
        role: roleOf(m.role),
        text,
        phrase: body.phrase ?? -1,
        at: now,
      },
    };
  }

  /** Xabarni o'chirish: o'zinikini — har kim, boshqanikini — rahbar va o'rinbosar (o'zidan pastni) */
  unsay(p: PlayerRow, id: number): { ok: true } | GuildFail {
    const m = this.guilds.member(p.id);
    if (!m) return no("guild");
    const guild = num(m.guild);
    const row = first<{ player: number; role: string | null }>(
      this.db,
      `SELECT c.player, gm.role FROM guild_chat c
         LEFT JOIN guild_members gm ON gm.player = c.player AND gm.guild = c.guild
        WHERE c.id = ? AND c.guild = ?`,
      id,
      guild,
    );
    if (!row) return no("none");
    const mine = roleOf(m.role) ?? "member";
    if (!canDeleteMsg(mine, roleOf(row.role), num(row.player) === p.id)) return no("perm");
    this.db.tx(() => {
      this.db.exec("DELETE FROM guild_chat WHERE id = ?", id);
      this.db.exec(
        `INSERT INTO guild_chatrev (guild, rev) VALUES (?, 1)
         ON CONFLICT (guild) DO UPDATE SET rev = rev + 1`,
        guild,
      );
    });
    return { ok: true };
  }

  /** Chatdan vaqtincha jim qilish (0 — jimlikni olish): rahbar — hammani, o'rinbosar — a'zoni */
  mute(p: PlayerRow, target: number, minutes: number, now: number): { ok: true } | GuildFail {
    const me = this.guilds.member(p.id);
    if (!me) return no("guild");
    const t = this.guilds.member(target);
    if (!t || num(t.guild) !== num(me.guild) || target === p.id) return no("none");
    if (!canKick(roleOf(me.role) ?? "member", roleOf(t.role) ?? "member")) return no("perm");
    this.db.exec(
      "UPDATE guild_members SET muted = ? WHERE player = ?",
      minutes > 0 ? now + minutes * 60_000 : 0,
      target,
    );
    this.guilds.addLog(num(me.guild), target, "mute", now, minutes, p.id);
    return { ok: true };
  }

  // ---------------- tozalash ----------------

  private prune(now: number) {
    if (now - this.prunedAt < PRUNE_EVERY) return;
    this.prunedAt = now;
    this.db.exec("DELETE FROM guild_rewards WHERE at < ?", now - REWARD_KEEP);
    this.db.exec("DELETE FROM guild_gifts WHERE day < ?", tashkentDay(now - 3 * DAY));
    const old = weekKey(now - WEEKS_KEEP);
    this.db.exec("DELETE FROM guild_qc WHERE week < ?", old);
    this.db.exec("DELETE FROM guild_quests WHERE week < ?", old);
  }

  /** Gildiya tarqatildi */
  wipe(guild: number) {
    for (const q of [
      "DELETE FROM guild_quests WHERE guild = ?",
      "DELETE FROM guild_qc WHERE guild = ?",
      "DELETE FROM guild_week WHERE guild = ?",
      "DELETE FROM guild_chat WHERE guild = ?",
      "DELETE FROM guild_chatrev WHERE guild = ?",
    ])
      this.db.exec(q, guild);
  }

  /** Akkaunt o'chirildi: hissalar, sovg'alar va chatdagi xabarlari */
  forget(player: number) {
    for (const q of [
      "DELETE FROM guild_gifts WHERE player = ?",
      "DELETE FROM guild_qc WHERE player = ?",
      "DELETE FROM guild_rewards WHERE player = ?",
      "DELETE FROM guild_chat WHERE player = ?",
    ])
      this.db.exec(q, player);
  }

  /** Keyingi haftalik yangilanish (dushanba 00:00, Toshkent) */
  static resets(now: number) {
    return nextWeekStart(now);
  }
}
