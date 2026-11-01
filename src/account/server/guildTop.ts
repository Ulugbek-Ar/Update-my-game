/**
 * Gildiyalar reytingi (serverda): haftalik (dushanba 00:00, Toshkent) va umumiy —
 *  - GILDIYA XP: hafta — shu hafta to'plangan (xazina, topshiriqlar, Kul qiroli), umumiy — jami;
 *  - TOPSHIRIQLAR: bajarilgan haftalik topshiriqlar soni;
 *  - KUL QIROLI: eng tez yengan jamoa — jamoadagi kirgan o'yinchilar (kamida 2) hammasi bitta
 *    gildiyadan bo'lsa, gildiyaga vaqt va XP (vaqtni olam serveri yuboradi, klient emas).
 * Hafta g'olibi — o'tgan haftada eng ko'p gildiya XP to'plagan gildiya (bayrog'i vodiy maydonida).
 * Hududlar (controlled_by) — kelajakdagi "hududlar urushi" poydevori: hozircha hech kim nazorat
 * qilmaydi, o'yin mantig'i yoqilmagan. Batafsil: docs/guilds.md
 */
import {
  GUILD_RAID_MIN,
  GUILD_RAID_XP,
  TERRITORIES,
  guildCap,
  guildLevel,
  type GuildBoard,
} from "../guildRules";
import { judgeRaid, nextWeekStart, weekKey } from "../scoring";
import type { GuildTop, GuildTopRow, Territory } from "../protocol";
import type { ChampInfo } from "@/realm/net/protocol";
import { first, num, str, type Row } from "./db";
import type { Guilds } from "./guilds";
import type { AccountStore, PlayerRow } from "./store";

/** Top shuncha qator */
export const GUILD_TOP_N = 50;
const DAY = 86_400_000;
/** Hafta g'olibi xotirada shuncha vaqt saqlanadi (hafta almashsa — darhol yangidan) */
const CHAMP_TTL = 3600_000;

interface TopDbRow extends Row {
  id: number;
  name: string;
  tag: string;
  emblem: string;
  xp: number;
  n: number;
  score: number;
}

export class GuildRanks {
  private champCache: { week: string; at: number; champ: ChampInfo | null } | null = null;

  constructor(
    private store: AccountStore,
    private guilds: Guilds,
  ) {
    // hududlar ro'yxati (bor bo'lsa o'zgarmaydi)
    for (const t of TERRITORIES)
      this.db.exec("INSERT OR IGNORE INTO territories (id, name) VALUES (?, ?)", t.id, t.name);
  }

  private get db() {
    return this.store.db;
  }

  /** Jadval so'rovi: (ball ifodasi, qayerdan, saralash) — hafta yoki umumiy */
  private query(board: GuildBoard, period: "week" | "all", week: string) {
    const members = "(SELECT COUNT(*) FROM guild_members m WHERE m.guild = g.id)";
    if (board === "xp")
      return period === "all"
        ? {
            sql: `SELECT g.*, g.xp AS score, ${members} AS n FROM guilds g WHERE g.xp > 0`,
            binds: [],
            asc: false,
          }
        : {
            sql: `SELECT g.*, w.gxp AS score, ${members} AS n FROM guild_week w JOIN guilds g ON g.id = w.guild
                   WHERE w.week = ? AND w.gxp > 0`,
            binds: [week],
            asc: false,
          };
    if (board === "quests")
      return period === "all"
        ? {
            sql: `SELECT g.*, SUM(w.quests) AS score, ${members} AS n FROM guild_week w JOIN guilds g ON g.id = w.guild
                   GROUP BY g.id HAVING SUM(w.quests) > 0`,
            binds: [],
            asc: false,
          }
        : {
            sql: `SELECT g.*, w.quests AS score, ${members} AS n FROM guild_week w JOIN guilds g ON g.id = w.guild
                   WHERE w.week = ? AND w.quests > 0`,
            binds: [week],
            asc: false,
          };
    return period === "all"
      ? {
          sql: `SELECT g.*, MIN(w.ashbest) AS score, ${members} AS n FROM guild_week w JOIN guilds g ON g.id = w.guild
                 WHERE w.ashbest > 0 GROUP BY g.id`,
          binds: [],
          asc: true,
        }
      : {
          sql: `SELECT g.*, w.ashbest AS score, ${members} AS n FROM guild_week w JOIN guilds g ON g.id = w.guild
                 WHERE w.week = ? AND w.ashbest > 0`,
          binds: [week],
          asc: true,
        };
  }

  private row(r: TopDbRow, rank: number): GuildTopRow {
    const level = guildLevel(num(r.xp));
    return {
      rank,
      id: num(r.id),
      name: str(r.name),
      tag: str(r.tag),
      emblem: str(r.emblem),
      level,
      members: Math.min(num(r.n), guildCap(level)),
      score: num(r.score),
    };
  }

  /** Top-50 va o'z gildiyasining o'rni */
  top(board: GuildBoard, period: "week" | "all", me: PlayerRow | null, now: number): GuildTop {
    const week = weekKey(now);
    const q = this.query(board, period, week);
    const order = `ORDER BY score ${q.asc ? "ASC" : "DESC"}, g.id ASC`;
    const all = this.db.exec<TopDbRow>(`${q.sql} ${order}`, ...q.binds).toArray();
    const rows = all.slice(0, GUILD_TOP_N).map((r, i) => this.row(r, i + 1));
    let mine: GuildTopRow | null = null;
    const m = me ? this.guilds.member(me.id) : null;
    if (m) {
      const i = all.findIndex((r) => num(r.id) === num(m.guild));
      if (i >= 0) mine = this.row(all[i]!, i + 1);
    }
    return {
      rows,
      me: mine,
      week,
      resets: nextWeekStart(now),
      champ: this.champion(now),
      territories: this.territories(),
    };
  }

  /** O'tgan hafta eng ko'p gildiya XP to'plagan gildiya (bayrog'i vodiy maydonida) */
  champion(now: number): ChampInfo | null {
    const week = weekKey(now);
    const c = this.champCache;
    if (c && c.week === week && now - c.at < CHAMP_TTL) return c.champ;
    const last = weekKey(now - 7 * DAY);
    const r = first<{ name: string; tag: string; emblem: string; gxp: number }>(
      this.db,
      `SELECT g.name, g.tag, g.emblem, w.gxp FROM guild_week w JOIN guilds g ON g.id = w.guild
        WHERE w.week = ? AND w.gxp > 0 ORDER BY w.gxp DESC, g.id ASC LIMIT 1`,
      last,
    );
    const champ = r
      ? { name: str(r.name), tag: str(r.tag), emblem: str(r.emblem), xp: num(r.gxp), week: last }
      : null;
    this.champCache = { week, at: now, champ };
    return champ;
  }

  /** Olam hududlari va ularni nazorat qiluvchi gildiya (hozircha — hech kim) */
  territories(): Territory[] {
    return (
      this.db
        .exec<
          Row & {
            id: string;
            name: string;
            since: number;
            gid: number | null;
            gname: string | null;
            tag: string | null;
            emblem: string | null;
          }
        >(
          `SELECT t.id, t.name, t.since, g.id AS gid, g.name AS gname, g.tag, g.emblem
           FROM territories t LEFT JOIN guilds g ON g.id = t.controlled_by`,
        )
        .toArray()
        .map((t) => ({
          id: str(t.id),
          name: str(t.name),
          controlledBy:
            t.gid !== null && t.gid !== undefined
              ? { id: num(t.gid), name: str(t.gname), tag: str(t.tag), emblem: str(t.emblem) }
              : null,
          since: num(t.since),
        }))
        // olamdagi tartibda (vodiy, Kul tog'i...)
        .sort(
          (a, b) =>
            TERRITORIES.findIndex((t) => t.id === a.id) -
            TERRITORIES.findIndex((t) => t.id === b.id),
        )
    );
  }

  /**
   * Hududni gildiya nazoratiga o'tkazish — "hududlar urushi" uchun poydevor (hozir o'yinda
   * chaqirilmaydi; faqat ma'lumotlar modeli va testlar).
   */
  setController(territory: string, guild: number | null, now: number) {
    this.db.exec(
      "UPDATE territories SET controlled_by = ?, since = ? WHERE id = ?",
      guild,
      guild ? now : 0,
      territory,
    );
  }

  /**
   * Kul qiroli yengildi: jamoadagi kirgan o'yinchilar (kamida 2) hammasi bitta gildiyadan bo'lsa —
   * gildiyaga haftalik eng tez vaqt va gildiya XP. Shubhali (juda tez) va imkonsiz vaqt — yo'q.
   */
  raid(team: number[], secs: number, now: number) {
    const ids = [...new Set(team)];
    if (ids.length < GUILD_RAID_MIN || judgeRaid(secs) !== "ok") return null;
    const gs = new Set(ids.map((id) => num(this.guilds.member(id)?.guild)));
    if (gs.size !== 1 || gs.has(0)) return null;
    const guild = [...gs][0]!;
    const week = weekKey(now);
    const t = Math.round(secs * 10);
    this.db.exec(
      `INSERT INTO guild_week (guild, week, ashbest) VALUES (?, ?, ?)
       ON CONFLICT (guild, week) DO UPDATE SET ashbest = CASE
         WHEN guild_week.ashbest = 0 OR excluded.ashbest < guild_week.ashbest THEN excluded.ashbest
         ELSE guild_week.ashbest END`,
      guild,
      week,
      t,
    );
    this.guilds.life.addXp(guild, GUILD_RAID_XP, now);
    this.guilds.addLog(guild, 0, "raid", now, GUILD_RAID_XP, t);
    return guild;
  }

  /** Gildiya tarqatilsa — nazorat qilgan hududlari bo'shaydi */
  wipe(guild: number) {
    this.db.exec(
      "UPDATE territories SET controlled_by = NULL, since = 0 WHERE controlled_by = ?",
      guild,
    );
  }
}
