/**
 * Gildiyalar (serverda): tuzish (500 oltin), a'zolik va rollar (rahbar, 3 tagacha o'rinbosar,
 * a'zo), qo'shilish usullari (ochiq, ariza, faqat taklif), qidirish ro'yxati va 24 soatlik
 * cheklov (sakrashga qarshi). Batafsil: docs/guilds.md
 *
 * Oltin klientda (asosiy o'yindagidek): tuzishda klient o'z oltinini aytadi, server uni bulutdagi
 * saqlanish bilan solishtiradi (limits.ts dagi o'sish chegarasi) va muvaffaqiyatdan keyin klient
 * oltinni yechadi. rid — takroriy so'rov ikki marta hisoblanmasin.
 */
import {
  GUILD_COST,
  MAX_APPLICATIONS,
  MAX_GUILD_REQUESTS,
  MAX_OFFICERS,
  REJOIN_MS,
  canKick,
  canManage,
  canSetRole,
  checkGuildName,
  checkGuildTag,
  emblemAllowed,
  guildCap,
  guildLevel,
  guildNameKey,
  guildTagKey,
  parseEmblem,
  type GuildLang,
  type GuildRole,
  type JoinMode,
} from "../guildRules";
import {
  HERO_IDS,
  ONLINE_MS,
  type ErrCode,
  type GuildCard,
  type GuildInfo,
  type GuildMember,
  type GuildNone,
  type GuildPing,
  type GuildRequestInfo,
  type GuildState,
  type GuildTag,
} from "../protocol";
import { GOLD_BURST, GOLD_PER_HOUR } from "../limits";
import { levelOf } from "../xp";
import { GIVE_DAILY } from "../guildRules";
import { weekKey } from "../scoring";
import { first, num, str, type Row } from "./db";
import { GuildLife } from "./guildLife";
import type { AccountStore, PlayerRow } from "./store";

const DAY = 86_400_000;
/** Faollik: shu oraliqda o'ynagan a'zolar */
const ACTIVE_MS = 3 * DAY;
/** Qidirish ro'yxatida ko'pi bilan */
export const SEARCH_N = 30;
/** Jurnalda gildiyaga shuncha yozuv qoladi */
const LOG_KEEP = 200;
/** Takroriy so'rov raqamlari shuncha saqlanadi */
const RID_KEEP = 7 * DAY;
/** Oltin (bulutdagi) — limits.ts bilan bir xil kalit */
const GOLD_KEY = "pixel-rpg-gold";

export interface GuildRow extends Row {
  id: number;
  name: string;
  name_key: string;
  tag: string;
  tag_key: string;
  emblem: string;
  mode: string;
  lang: string;
  created: number;
  xp: number;
  treasury: number;
  trophies: string;
}

export interface MemberRow extends Row {
  player: number;
  guild: number;
  role: string;
  joined: number;
  muted: number;
  given: number;
}

interface CardRow extends GuildRow {
  n: number;
  active: number;
  online: number;
}

export type GuildFail = {
  ok: false;
  error: ErrCode;
  field?: string;
  why?: string;
  until?: number;
};

const no = (error: ErrCode, extra: Omit<GuildFail, "ok" | "error"> = {}): GuildFail => ({
  ok: false,
  error,
  ...extra,
});

const roleOf = (s: unknown): GuildRole =>
  s === "leader" || s === "officer" ? s : ("member" as const);
const modeOf = (s: unknown): JoinMode => (s === "apply" || s === "invite" ? s : "open");
const langOf = (s: unknown): GuildLang => (s === "ru" || s === "en" ? s : "uz");
const heroOf = (s: unknown) => HERO_IDS.find((h) => h === s) ?? "knight";
const RANK: Record<GuildRole, number> = { leader: 0, officer: 1, member: 2 };

export interface CreateInput {
  name: string;
  tag: string;
  emblem: string;
  mode: JoinMode;
  lang: GuildLang;
  gold: number;
  rid: string;
}

export class Guilds {
  private ridsPrunedAt = 0;
  /** xazina, topshiriqlar, sovg'alar va chat */
  readonly life: GuildLife;

  constructor(private store: AccountStore) {
    this.life = new GuildLife(store, this);
  }

  private get db() {
    return this.store.db;
  }

  // ---------------- o'qish ----------------

  row(id: number) {
    return first<GuildRow>(this.db, "SELECT * FROM guilds WHERE id = ?", id);
  }

  member(player: number) {
    return first<MemberRow>(this.db, "SELECT * FROM guild_members WHERE player = ?", player);
  }

  count(guild: number, role?: GuildRole) {
    return num(
      first(
        this.db,
        role
          ? "SELECT COUNT(*) AS n FROM guild_members WHERE guild = ? AND role = ?"
          : "SELECT COUNT(*) AS n FROM guild_members WHERE guild = ?",
        ...(role ? [guild, role] : [guild]),
      )?.["n"],
    );
  }

  /** O'yinchining gildiya tegi va gerbi (onlayn ism yonida, reytingda, do'stlar ro'yxatida) */
  tagOf(player: number): GuildTag | null {
    const r = first<{ tag: string; emblem: string }>(
      this.db,
      "SELECT g.tag, g.emblem FROM guild_members m JOIN guilds g ON g.id = m.guild WHERE m.player = ?",
      player,
    );
    return r ? { tag: str(r.tag), emblem: str(r.emblem) } : null;
  }

  /** Olam xonasi uchun: gildiya raqami, tegi va gerbi */
  badgeOf(player: number): (GuildTag & { id: number }) | null {
    const r = first<{ id: number; tag: string; emblem: string }>(
      this.db,
      "SELECT g.id, g.tag, g.emblem FROM guild_members m JOIN guilds g ON g.id = m.guild WHERE m.player = ?",
      player,
    );
    return r ? { id: num(r.id), tag: str(r.tag), emblem: str(r.emblem) } : null;
  }

  /** Onlayn holat javobi uchun qisqacha: gildiya, roli va kutilayotgan arizalar/takliflar soni */
  ping(player: number, _now: number): GuildPing {
    const r = first<GuildRow & { role: string }>(
      this.db,
      "SELECT g.*, m.role FROM guild_members m JOIN guilds g ON g.id = m.guild WHERE m.player = ?",
      player,
    );
    if (!r) {
      const pending = num(
        first(
          this.db,
          "SELECT COUNT(*) AS n FROM guild_requests WHERE player = ? AND kind = 'invite'",
          player,
        )?.["n"],
      );
      return { guild: null, pending, reward: this.life.lastReward(player) };
    }
    const role = roleOf(r.role);
    const pending = canManage(role)
      ? num(
          first(
            this.db,
            "SELECT COUNT(*) AS n FROM guild_requests WHERE guild = ? AND kind = 'apply'",
            r.id,
          )?.["n"],
        )
      : 0;
    return {
      guild: {
        id: num(r.id),
        name: str(r.name),
        tag: str(r.tag),
        emblem: str(r.emblem),
        level: guildLevel(num(r.xp)),
        role,
      },
      pending,
      reward: this.life.lastReward(player),
      chat: this.life.lastChat(num(r.id)),
    };
  }

  /** Qachongacha qo'shila olmaydi (ms; 0 — hozir mumkin) */
  cooldown(player: number, now: number) {
    const until = num(
      first(this.db, "SELECT until FROM guild_cooldown WHERE player = ?", player)?.["until"],
    );
    return until > now ? until : 0;
  }

  /** Bir nechta gildiya kartasi (a'zolar soni, faollik, onlayn) bitta so'rov bilan */
  private cards(where: string, binds: (string | number)[], now: number, limit = 200) {
    return this.db
      .exec<CardRow>(
        `SELECT g.*, COUNT(m.player) AS n,
                COALESCE(SUM(pr.at > ?), 0) AS active,
                COALESCE(SUM(pr.place != 'off' AND pr.at > ?), 0) AS online
           FROM guilds g
           LEFT JOIN guild_members m ON m.guild = g.id
           LEFT JOIN presence pr ON pr.player = m.player
          WHERE ${where}
          GROUP BY g.id
          ORDER BY active DESC, g.xp DESC, n DESC, g.id ASC
          LIMIT ?`,
        now - ACTIVE_MS,
        now - ONLINE_MS,
        ...binds,
        limit,
      )
      .toArray()
      .map((r) => this.card(r));
  }

  private card(r: CardRow): GuildCard {
    const level = guildLevel(num(r.xp));
    return {
      id: num(r.id),
      name: str(r.name),
      tag: str(r.tag),
      emblem: str(r.emblem),
      level,
      members: num(r.n),
      cap: guildCap(level),
      mode: modeOf(r.mode),
      lang: langOf(r.lang),
      active: num(r.active),
      online: num(r.online),
    };
  }

  cardOf(id: number, now: number): GuildCard | null {
    return this.cards("g.id = ?", [id], now, 1)[0] ?? null;
  }

  info(id: number, now: number): GuildInfo | null {
    const g = this.row(id);
    const c = g && this.cardOf(id, now);
    if (!g || !c) return null;
    const leader = first<{ nick: string }>(
      this.db,
      "SELECT p.nick FROM guild_members m JOIN players p ON p.id = m.player WHERE m.guild = ? AND m.role = 'leader'",
      id,
    );
    return {
      ...c,
      xp: num(g.xp),
      treasury: num(g.treasury),
      created: num(g.created),
      leader: str(leader?.nick),
    };
  }

  members(guild: number, now: number): GuildMember[] {
    return this.db
      .exec<
        MemberRow & { nick: string; avatar: string; xp: number; pat: number | null; place: string }
      >(
        `SELECT m.*, p.nick, p.avatar, p.xp, pr.at AS pat, pr.place
           FROM guild_members m
           JOIN players p ON p.id = m.player
           LEFT JOIN presence pr ON pr.player = m.player
          WHERE m.guild = ?`,
        guild,
      )
      .toArray()
      .map((r) => {
        const at = num(r.pat);
        const role = roleOf(r.role);
        return {
          id: num(r.player),
          nick: str(r.nick),
          avatar: heroOf(r.avatar),
          level: levelOf(num(r.xp)),
          role,
          joined: num(r.joined),
          online: at > 0 && str(r.place) !== "off" && now - at < ONLINE_MS,
          seen: at,
          given: num(r.given),
          muted: num(r.muted) > now ? num(r.muted) : 0,
        };
      })
      .sort(
        (a, b) =>
          RANK[a.role] - RANK[b.role] ||
          Number(b.online) - Number(a.online) ||
          b.given - a.given ||
          a.nick.localeCompare(b.nick),
      );
  }

  private requests(guild: number): GuildRequestInfo[] {
    return this.db
      .exec<{
        player: number;
        kind: string;
        at: number;
        nick: string;
        avatar: string;
        xp: number;
        bynick: string | null;
      }>(
        `SELECT r.player, r.kind, r.at, p.nick, p.avatar, p.xp, b.nick AS bynick
           FROM guild_requests r
           JOIN players p ON p.id = r.player
           LEFT JOIN players b ON b.id = r.by
          WHERE r.guild = ?
          ORDER BY r.at DESC`,
        guild,
      )
      .toArray()
      .map((r) => {
        const out: GuildRequestInfo = {
          id: num(r.player),
          nick: str(r.nick),
          avatar: heroOf(r.avatar),
          level: levelOf(num(r.xp)),
          kind: str(r.kind) === "invite" ? "invite" : "apply",
          at: num(r.at),
        };
        if (out.kind === "invite" && r.bynick) out.by = str(r.bynick);
        return out;
      });
  }

  /** guild/get: gildiyadagi o'yinchiga — gildiya, a'zolar, arizalar; gildiyasizga — takliflar */
  state(p: PlayerRow, now: number): GuildState {
    const m = this.member(p.id);
    const g = m ? this.info(num(m.guild), now) : null;
    if (m && g) {
      const role = roleOf(m.role);
      const quests = this.life.quests(g.id, now);
      // topshiriq bajarilgan bo'lsa gildiya XP o'zgargan — qayta o'qiladi
      const fresh = quests.some((q) => q.done) ? (this.info(g.id, now) ?? g) : g;
      return {
        guild: fresh,
        role,
        members: this.members(g.id, now),
        requests: canManage(role) ? this.requests(g.id) : [],
        quests,
        week: weekKey(now),
        resets: GuildLife.resets(now),
        given: this.life.givenToday(p.id, now),
        giveCap: GIVE_DAILY,
        rewards: this.life.rewards(p.id, now),
        chat: this.life.lastChat(g.id),
        muted: num(m.muted) > now ? num(m.muted) : 0,
      };
    }
    return this.none(p.id, now);
  }

  private none(player: number, now: number): GuildNone {
    const rows = this.db
      .exec<{ guild: number; kind: string; at: number; bynick: string | null }>(
        `SELECT r.guild, r.kind, r.at, b.nick AS bynick FROM guild_requests r
           LEFT JOIN players b ON b.id = r.by WHERE r.player = ? ORDER BY r.at DESC`,
        player,
      )
      .toArray();
    const out: GuildNone = {
      guild: null,
      cooldown: this.cooldown(player, now),
      invites: [],
      applications: [],
    };
    for (const r of rows) {
      const card = this.cardOf(num(r.guild), now);
      if (!card) continue;
      if (str(r.kind) === "invite")
        out.invites.push({ guild: card, by: str(r.bynick), at: num(r.at) });
      else out.applications.push({ guild: card, at: num(r.at) });
    }
    return out;
  }

  /** Qidirish: nomi (qismi) yoki tegi bo'yicha; bo'sh so'rov — eng faol gildiyalar */
  search(query: string, lang: GuildLang | undefined, now: number): GuildCard[] {
    const q = query.trim();
    const where: string[] = [];
    const binds: (string | number)[] = [];
    if (q) {
      const like = `%${guildNameKey(q).replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      where.push("(g.name_key LIKE ? ESCAPE '\\' OR g.tag_key = ?)");
      binds.push(like, guildTagKey(q.replace(/[[\]]/g, "")));
    }
    if (lang) {
      where.push("g.lang = ?");
      binds.push(lang);
    }
    return this.cards(where.length ? where.join(" AND ") : "1", binds, now, SEARCH_N);
  }

  // ---------------- yozish ----------------

  /** Gildiya jurnaliga yozuv (gildiyaga oxirgi 200 tasi qoladi) */
  addLog(guild: number, player: number, kind: string, now: number, amount = 0, other = 0) {
    this.db.exec(
      "INSERT INTO guild_log (guild, player, kind, amount, other, at) VALUES (?, ?, ?, ?, ?, ?)",
      guild,
      player,
      kind,
      amount,
      other,
      now,
    );
    this.db.exec(
      `DELETE FROM guild_log WHERE guild = ? AND id < (
         SELECT MIN(id) FROM (SELECT id FROM guild_log WHERE guild = ? ORDER BY id DESC LIMIT ?))`,
      guild,
      guild,
      LOG_KEEP,
    );
  }

  /** Takroriy so'rov (rid) avval bajarilganmi */
  seen(player: number, rid: string) {
    return !!first(
      this.db,
      "SELECT 1 AS x FROM guild_rids WHERE player = ? AND rid = ?",
      player,
      rid,
    );
  }

  remember(player: number, rid: string, now: number) {
    this.db.exec(
      "INSERT OR IGNORE INTO guild_rids (player, rid, at) VALUES (?, ?, ?)",
      player,
      rid,
      now,
    );
    if (now - this.ridsPrunedAt > 3600_000) {
      this.ridsPrunedAt = now;
      this.db.exec("DELETE FROM guild_rids WHERE at < ?", now - RID_KEEP);
    }
  }

  /**
   * Klient aytgan oltin bulutdagi saqlanishga nisbatan mumkinmi (limits.ts dagi o'sish chegarasi:
   * oxirgi saqlanishdan beri 3 000 + soatiga 2 000). Bulut bo'sh bo'lsa — faqat 3 000 gacha.
   */
  goldPlausible(player: number, gold: number, now: number) {
    const r = first<{ data: string; at: number }>(
      this.db,
      "SELECT data, at FROM saves WHERE player = ?",
      player,
    );
    let cloud = 0;
    if (r) {
      try {
        const v = (JSON.parse(str(r.data)) as Record<string, unknown>)[GOLD_KEY];
        cloud = Math.max(0, Number(v) || 0);
      } catch {
        /* buzuq saqlanish */
      }
    }
    const hours = r ? Math.min(24 * 14, Math.max(0, (now - num(r.at)) / 3_600_000)) : 0;
    return gold <= cloud + GOLD_BURST + GOLD_PER_HOUR * hours;
  }

  /** Yangi a'zo: qolgan ariza va takliflari o'chadi */
  private addMember(guild: number, player: number, role: GuildRole, now: number, by = 0) {
    this.db.exec("DELETE FROM guild_requests WHERE player = ?", player);
    this.db.exec(
      "INSERT INTO guild_members (player, guild, role, joined) VALUES (?, ?, ?, ?)",
      player,
      guild,
      role,
      now,
    );
    this.addLog(guild, player, role === "leader" ? "create" : "join", now, 0, by);
  }

  private full(guild: number) {
    const g = this.row(guild);
    return !g || this.count(guild) >= guildCap(guildLevel(num(g.xp)));
  }

  /** Gildiya tuzish: oltin, nom va teg (takrorlanmas, filtr), gerb (1-daraja ranglari va belgilari) */
  create(
    p: PlayerRow,
    req: CreateInput,
    now: number,
  ): { ok: true; guild: GuildInfo; cost: number; dup?: boolean } | GuildFail {
    return this.db.tx(() => {
      const mine = this.member(p.id);
      if (this.seen(p.id, req.rid)) {
        const g = mine ? this.info(num(mine.guild), now) : null;
        return g ? { ok: true as const, guild: g, cost: GUILD_COST, dup: true } : no("bad");
      }
      if (mine) return no("guild");
      const until = this.cooldown(p.id, now);
      if (until) return no("cooldown", { until });
      const name = checkGuildName(req.name);
      if (!name.ok) return no("name", { field: "name", why: name.error });
      const tag = checkGuildTag(req.tag);
      if (!tag.ok) return no("name", { field: "tag", why: tag.error });
      const e = parseEmblem(req.emblem);
      if (!e || !emblemAllowed(e, 1)) return no("bad", { field: "emblem" });
      if (req.gold < GUILD_COST) return no("gold");
      if (!this.goldPlausible(p.id, req.gold, now)) return no("invalid", { field: "gold" });
      if (first(this.db, "SELECT 1 AS x FROM guilds WHERE name_key = ?", guildNameKey(name.name)))
        return no("taken", { field: "name" });
      if (first(this.db, "SELECT 1 AS x FROM guilds WHERE tag_key = ?", guildTagKey(tag.name)))
        return no("taken", { field: "tag" });
      this.db.exec(
        `INSERT INTO guilds (name, name_key, tag, tag_key, emblem, mode, lang, created)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        name.name,
        guildNameKey(name.name),
        tag.name,
        guildTagKey(tag.name),
        req.emblem,
        req.mode,
        req.lang,
        now,
      );
      const id = num(
        first(this.db, "SELECT id FROM guilds WHERE name_key = ?", guildNameKey(name.name))?.["id"],
      );
      this.addMember(id, p.id, "leader", now);
      this.remember(p.id, req.rid, now);
      return { ok: true as const, guild: this.info(id, now)!, cost: GUILD_COST };
    });
  }

  /** Qo'shilish: ochiq — darhol, ariza bilan — ariza (taklif bo'lsa — darhol), faqat taklif bilan */
  join(
    p: PlayerRow,
    id: number,
    now: number,
  ): { ok: true; joined: boolean; applied: boolean } | GuildFail {
    return this.db.tx(() => {
      if (this.member(p.id)) return no("guild");
      const g = this.row(id);
      if (!g) return no("none");
      const until = this.cooldown(p.id, now);
      if (until) return no("cooldown", { until });
      const req = first<{ kind: string; by: number }>(
        this.db,
        "SELECT kind, by FROM guild_requests WHERE guild = ? AND player = ?",
        id,
        p.id,
      );
      const invited = str(req?.kind) === "invite";
      const mode = modeOf(g.mode);
      if (mode === "open" || invited) {
        if (this.full(id)) return no("full");
        this.addMember(id, p.id, "member", now, invited ? num(req?.by) : 0);
        return { ok: true as const, joined: true, applied: false };
      }
      if (mode === "invite") return no("invite");
      if (req) return { ok: true as const, joined: false, applied: true };
      const mineN = num(
        first(
          this.db,
          "SELECT COUNT(*) AS n FROM guild_requests WHERE player = ? AND kind = 'apply'",
          p.id,
        )?.["n"],
      );
      const theirs = num(
        first(this.db, "SELECT COUNT(*) AS n FROM guild_requests WHERE guild = ?", id)?.["n"],
      );
      if (mineN >= MAX_APPLICATIONS || theirs >= MAX_GUILD_REQUESTS) return no("limit");
      this.db.exec(
        "INSERT INTO guild_requests (guild, player, kind, by, at) VALUES (?, ?, 'apply', 0, ?)",
        id,
        p.id,
        now,
      );
      return { ok: true as const, joined: false, applied: true };
    });
  }

  /** O'z arizasini bekor qilish */
  cancel(p: PlayerRow, id: number) {
    this.db.exec(
      "DELETE FROM guild_requests WHERE guild = ? AND player = ? AND kind = 'apply'",
      id,
      p.id,
    );
    return { ok: true as const };
  }

  /** Rahbar/o'rinbosar va uning gildiyasi (huquq tekshiruvi bilan) */
  private manager(p: PlayerRow): { m: MemberRow; role: GuildRole } | GuildFail {
    const m = this.member(p.id);
    if (!m) return no("guild");
    const role = roleOf(m.role);
    if (!canManage(role)) return no("perm");
    return { m, role };
  }

  /** Arizaga javob (qabul — a'zo bo'ladi); rad — ariza yoki yuborilgan taklif o'chadi */
  answer(p: PlayerRow, player: number, accept: boolean, now: number): { ok: true } | GuildFail {
    return this.db.tx(() => {
      const me = this.manager(p);
      if ("ok" in me) return me;
      const guild = num(me.m.guild);
      const req = first<{ kind: string }>(
        this.db,
        "SELECT kind FROM guild_requests WHERE guild = ? AND player = ?",
        guild,
        player,
      );
      if (!req) return no("none");
      if (!accept) {
        this.db.exec("DELETE FROM guild_requests WHERE guild = ? AND player = ?", guild, player);
        return { ok: true as const };
      }
      if (str(req.kind) !== "apply") return no("bad");
      if (this.member(player)) {
        this.db.exec("DELETE FROM guild_requests WHERE player = ?", player);
        return no("guild");
      }
      const until = this.cooldown(player, now);
      if (until) return no("cooldown", { until });
      if (this.full(guild)) return no("full");
      this.addMember(guild, player, "member", now, p.id);
      return { ok: true as const };
    });
  }

  /** Taklif: taxallus yoki do'st kodi bo'yicha. U ariza yuborgan bo'lsa — darhol qabul. */
  invite(
    p: PlayerRow,
    query: string,
    now: number,
  ): { ok: true; joined: boolean; nick: string } | GuildFail {
    return this.db.tx(() => {
      const me = this.manager(p);
      if ("ok" in me) return me;
      const guild = num(me.m.guild);
      const t = this.store.friends.find(query);
      // bloklagan o'yinchiga taklif ketmaydi ("topilmadi" — bloklanganini bildirmaymiz)
      const blocked =
        t &&
        first(
          this.db,
          "SELECT 1 AS x FROM friends WHERE a = ? AND b = ? AND status = 'block'",
          t.id,
          p.id,
        );
      if (!t || t.id === p.id || blocked) return no("none");
      if (this.member(t.id)) return no("guild");
      const req = first<{ kind: string }>(
        this.db,
        "SELECT kind FROM guild_requests WHERE guild = ? AND player = ?",
        guild,
        t.id,
      );
      if (str(req?.kind) === "apply") {
        const until = this.cooldown(t.id, now);
        if (until) return no("cooldown", { until });
        if (this.full(guild)) return no("full");
        this.addMember(guild, t.id, "member", now, p.id);
        return { ok: true as const, joined: true, nick: str(t.nick) };
      }
      if (req) return { ok: true as const, joined: false, nick: str(t.nick) };
      const n = num(
        first(this.db, "SELECT COUNT(*) AS n FROM guild_requests WHERE guild = ?", guild)?.["n"],
      );
      if (n >= MAX_GUILD_REQUESTS) return no("limit");
      this.db.exec(
        "INSERT INTO guild_requests (guild, player, kind, by, at) VALUES (?, ?, 'invite', ?, ?)",
        guild,
        t.id,
        p.id,
        now,
      );
      return { ok: true as const, joined: false, nick: str(t.nick) };
    });
  }

  /** Kelgan taklifga javob */
  reply(
    p: PlayerRow,
    id: number,
    accept: boolean,
    now: number,
  ): { ok: true; joined: boolean } | GuildFail {
    return this.db.tx(() => {
      const req = first<{ by: number }>(
        this.db,
        "SELECT by FROM guild_requests WHERE guild = ? AND player = ? AND kind = 'invite'",
        id,
        p.id,
      );
      if (!req) return no("none");
      if (!accept) {
        this.db.exec("DELETE FROM guild_requests WHERE guild = ? AND player = ?", id, p.id);
        return { ok: true as const, joined: false };
      }
      if (this.member(p.id)) return no("guild");
      const until = this.cooldown(p.id, now);
      if (until) return no("cooldown", { until });
      if (this.full(id)) return no("full");
      this.addMember(id, p.id, "member", now, num(req.by));
      return { ok: true as const, joined: true };
    });
  }

  /**
   * Chiqish: 24 soat boshqa gildiyaga qo'shilmaydi. Rahbar — avval rahbarlikni topshiradi;
   * yolg'iz qolgan rahbar chiqsa — gildiya tarqaladi.
   */
  leave(p: PlayerRow, now: number): { ok: true } | GuildFail {
    const m = this.member(p.id);
    if (!m) return no("guild");
    const guild = num(m.guild);
    if (roleOf(m.role) === "leader") {
      if (this.count(guild) > 1) return no("perm");
      return this.disband(p, now);
    }
    this.db.tx(() => {
      this.db.exec("DELETE FROM guild_members WHERE player = ?", p.id);
      this.setCooldown(p.id, now);
      this.addLog(guild, p.id, "leave", now);
    });
    return { ok: true };
  }

  private setCooldown(player: number, now: number) {
    this.db.exec(
      `INSERT INTO guild_cooldown (player, until) VALUES (?, ?)
       ON CONFLICT (player) DO UPDATE SET until = excluded.until`,
      player,
      now + REJOIN_MS,
    );
  }

  /** Bir gildiyadagi ikki o'yinchi: amal qiluvchi va nishon */
  private pair(p: PlayerRow, target: number) {
    const me = this.member(p.id);
    if (!me) return no("guild");
    const t = this.member(target);
    if (!t || num(t.guild) !== num(me.guild) || target === p.id) return no("none");
    return { me, t, guild: num(me.guild), mine: roleOf(me.role), theirs: roleOf(t.role) };
  }

  /** Chiqarish: rahbar — hammani, o'rinbosar — faqat a'zolarni (chiqarilganga 24 soat cheklov yo'q) */
  kick(p: PlayerRow, target: number, now: number): { ok: true } | GuildFail {
    return this.db.tx(() => {
      const r = this.pair(p, target);
      if ("ok" in r) return r;
      if (!canKick(r.mine, r.theirs)) return no("perm");
      this.db.exec("DELETE FROM guild_members WHERE player = ?", target);
      this.addLog(r.guild, target, "kick", now, 0, p.id);
      return { ok: true as const };
    });
  }

  /** Rol berish (o'rinbosarlar — ko'pi bilan 3 ta) */
  setRole(
    p: PlayerRow,
    target: number,
    to: "officer" | "member",
    now: number,
  ): { ok: true } | GuildFail {
    return this.db.tx(() => {
      const r = this.pair(p, target);
      if ("ok" in r) return r;
      if (!canSetRole(r.mine, r.theirs, to)) return no("perm");
      if (to === "officer" && this.count(r.guild, "officer") >= MAX_OFFICERS) return no("limit");
      this.db.exec("UPDATE guild_members SET role = ? WHERE player = ?", to, target);
      this.addLog(r.guild, target, to === "officer" ? "promote" : "demote", now, 0, p.id);
      return { ok: true as const };
    });
  }

  /** Rahbarlikni topshirish: eski rahbar — o'rinbosar (joy bo'lsa) yoki a'zo */
  transfer(p: PlayerRow, target: number, now: number): { ok: true } | GuildFail {
    return this.db.tx(() => {
      const r = this.pair(p, target);
      if ("ok" in r) return r;
      if (r.mine !== "leader") return no("perm");
      this.db.exec("UPDATE guild_members SET role = 'leader' WHERE player = ?", target);
      const officers = num(
        first(
          this.db,
          "SELECT COUNT(*) AS n FROM guild_members WHERE guild = ? AND role = 'officer' AND player != ?",
          r.guild,
          target,
        )?.["n"],
      );
      this.db.exec(
        "UPDATE guild_members SET role = ? WHERE player = ?",
        officers < MAX_OFFICERS ? "officer" : "member",
        p.id,
      );
      this.addLog(r.guild, target, "leader", now, 0, p.id);
      return { ok: true as const };
    });
  }

  /** Gildiyani butunlay o'chirish (ichki: rahbar tarqatdi, oxirgi a'zo akkauntini o'chirdi) */
  private wipe(guild: number) {
    this.life.wipe(guild);
    for (const q of [
      "DELETE FROM guild_members WHERE guild = ?",
      "DELETE FROM guild_requests WHERE guild = ?",
      "DELETE FROM guild_log WHERE guild = ?",
      "DELETE FROM guilds WHERE id = ?",
    ])
      this.db.exec(q, guild);
  }

  /** Tarqatish (faqat rahbar): hamma a'zolar gildiyasiz qoladi; rahbarga 24 soat cheklov */
  disband(p: PlayerRow, now: number): { ok: true } | GuildFail {
    const m = this.member(p.id);
    if (!m) return no("guild");
    if (roleOf(m.role) !== "leader") return no("perm");
    this.db.tx(() => {
      this.wipe(num(m.guild));
      this.setCooldown(p.id, now);
    });
    return { ok: true };
  }

  /** Rahbar: qo'shilish usuli, til va gerb (gerb — gildiya darajasida ochilgan ranglar va belgilar) */
  settings(
    p: PlayerRow,
    patch: {
      mode?: JoinMode | undefined;
      lang?: GuildLang | undefined;
      emblem?: string | undefined;
    },
  ): { ok: true } | GuildFail {
    const m = this.member(p.id);
    if (!m) return no("guild");
    if (roleOf(m.role) !== "leader") return no("perm");
    const g = this.row(num(m.guild));
    if (!g) return no("none");
    if (patch.emblem !== undefined) {
      const e = parseEmblem(patch.emblem);
      if (!e || !emblemAllowed(e, guildLevel(num(g.xp)))) return no("bad", { field: "emblem" });
    }
    this.db.exec(
      "UPDATE guilds SET mode = ?, lang = ?, emblem = ? WHERE id = ?",
      patch.mode ?? str(g.mode),
      patch.lang ?? str(g.lang),
      patch.emblem ?? str(g.emblem),
      g.id,
    );
    return { ok: true };
  }

  /**
   * Akkaunt o'chirildi: a'zolik, arizalar va jurnal yozuvlari o'chadi. Rahbar bo'lsa — rahbarlik
   * eng eski o'rinbosarga (yo'q bo'lsa — eng eski a'zoga) o'tadi, yolg'iz bo'lsa — gildiya tarqaladi.
   */
  forget(player: number) {
    const m = this.member(player);
    if (m && roleOf(m.role) === "leader") {
      const next = first<{ player: number }>(
        this.db,
        `SELECT player FROM guild_members WHERE guild = ? AND player != ?
          ORDER BY CASE role WHEN 'officer' THEN 0 ELSE 1 END, joined ASC LIMIT 1`,
        m.guild,
        player,
      );
      if (next)
        this.db.exec("UPDATE guild_members SET role = 'leader' WHERE player = ?", next.player);
      else this.wipe(num(m.guild));
    }
    this.life.forget(player);
    for (const q of [
      "DELETE FROM guild_members WHERE player = ?",
      "DELETE FROM guild_requests WHERE player = ?",
      "DELETE FROM guild_cooldown WHERE player = ?",
      "DELETE FROM guild_rids WHERE player = ?",
      "DELETE FROM guild_log WHERE player = ?",
    ])
      this.db.exec(q, player);
    this.db.exec("UPDATE guild_log SET other = 0 WHERE other = ?", player);
    this.db.exec("UPDATE guild_requests SET by = 0 WHERE by = ?", player);
  }
}
