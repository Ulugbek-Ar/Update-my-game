/**
 * Muallif (admin) paneli — server tomoni. Admin — Telegram ID'si ADMIN_TELEGRAM_IDS (wrangler
 * secret) ro'yxatida bo'lgan o'yinchi. Huquq FAQAT shu yerda, har so'rovda tekshiriladi:
 * klientdagi `me.admin` faqat tugmani ko'rsatish uchun. Ro'yxat bo'sh — hech kim admin emas.
 *
 * Har amal (va admin bo'lmagan urinish ham) `admin_log` jadvaliga yoziladi. Batafsil: docs/admin.md
 */
import { GUILD_LEVEL_XP } from "../guildRules";
import {
  grantGold,
  grantHero,
  grantXp,
  heroesIn,
  resetDailyGift,
  revokeHero,
  setLevel,
  unlockAll,
  type Keys,
  type UnlockLists,
} from "../grants";
import { HERO_IDS, type AdminLogEntry, type CloudSave, type PlayerCard } from "../protocol";
import { levelOf } from "../xp";
import { first, num, str, type Row } from "./db";
import type { AccountStore, PlayerRow } from "./store";

/** Jurnal va sovg'alar ro'yxatida shuncha oxirgisi */
const LOG_N = 50;
/** Jurnal shundan oshsa eskilari o'chadi */
const LOG_KEEP = 2000;

/** "123, 456" -> {123, 456}; noto'g'ri yozuvlar e'tiborsiz (bo'sh — hech kim admin emas) */
export function parseAdminIds(raw: string | null | undefined): ReadonlySet<number> {
  const out = new Set<number>();
  for (const part of (raw ?? "").split(/[\s,;]+/)) {
    if (!/^\d{1,16}$/.test(part)) continue;
    const n = Number(part);
    if (Number.isSafeInteger(n) && n > 0) out.add(n);
  }
  return out;
}

interface LogRow extends Row {
  id: number;
  at: number;
  action: string;
  target: number;
  detail: string;
}

export type AdminFail = {
  ok: false;
  error: "perm" | "none" | "conflict" | "bad";
  save?: CloudSave;
};

export class Admin {
  /** ADMIN_TELEGRAM_IDS (har so'rovda api.ts yangilaydi) */
  ids: ReadonlySet<number> = new Set();
  /** testlar uchun: "HAMMASINI OCHISH" ro'yxatlari (null — o'yin kodidagi haqiqiy ro'yxatlar) */
  lists: UnlockLists | null = null;

  constructor(private store: AccountStore) {}

  private get db() {
    return this.store.db;
  }

  is(p: { tg: number } | null | undefined) {
    return !!p && this.ids.size > 0 && this.ids.has(num(p.tg));
  }

  isId(id: number) {
    if (!this.ids.size) return false;
    const p = this.store.player(id);
    return !!p && this.is(p);
  }

  /** Admin o'yinchilar raqamlari (reytingdan chiqarish uchun) */
  playerIds(): number[] {
    if (!this.ids.size) return [];
    const tgs = [...this.ids].filter((n) => Number.isSafeInteger(n));
    return this.db
      .exec<{ id: number }>(
        `SELECT id FROM players WHERE tg IN (${tgs.map(() => "?").join(",")})`,
        ...tgs,
      )
      .toArray()
      .map((r) => num(r.id));
  }

  log(admin: number, action: string, now: number, target = 0, detail = "") {
    this.db.exec(
      "INSERT INTO admin_log (at, admin, action, target, detail) VALUES (?, ?, ?, ?, ?)",
      now,
      admin,
      action,
      target,
      detail.slice(0, 300),
    );
    const n = num(first(this.db, "SELECT COUNT(*) AS n FROM admin_log")?.["n"]);
    if (n > LOG_KEEP + 100)
      this.db.exec(
        "DELETE FROM admin_log WHERE id IN (SELECT id FROM admin_log ORDER BY id LIMIT ?)",
        n - LOG_KEEP,
      );
  }

  /** Admin bo'lmagan o'yinchi admin so'rovini yubordi: rad, jurnal va server logi */
  deny(p: PlayerRow, op: string, now: number) {
    console.warn("admin: rad etildi", { player: num(p.id), op });
    this.log(num(p.id), "denied", now, 0, op);
  }

  journal(): AdminLogEntry[] {
    return this.db
      .exec<LogRow>("SELECT * FROM admin_log ORDER BY id DESC LIMIT ?", LOG_N)
      .toArray()
      .map((r) => ({
        id: num(r.id),
        at: num(r.at),
        action: str(r.action),
        target: num(r.target) ? (this.store.player(num(r.target))?.nick ?? "—") : "",
        detail: str(r.detail),
      }));
  }

  /** Panel ochildi: admin natijalari reytingda qolmasin (oldin yozilgan bo'lsa ham) */
  onOpen(p: PlayerRow) {
    this.db.exec("DELETE FROM scores WHERE player = ?", p.id);
  }

  /**
   * O'z progressini o'zgartirish: klient avval saqlagan bo'lishi kerak (base — joriy versiya).
   * Aks holda — ziddiyat: bulutdagi nusxa qaytadi, klient uni yuklab qayta bosadi.
   */
  private mutate(
    p: PlayerRow,
    base: number,
    now: number,
    action: string,
    detail: string,
    fn: (d: Keys) => Keys,
  ): { ok: true; save: CloudSave } | AdminFail {
    return this.db.tx(() => {
      const cur = this.store.getSave(p.id);
      if ((cur?.version ?? 0) !== base)
        return { ok: false as const, error: "conflict" as const, ...(cur ? { save: cur } : {}) };
      const save = this.store.writeSave(p.id, fn(cur?.data ?? {}), now, "admin");
      this.log(num(p.id), action, now, num(p.id), detail);
      return { ok: true as const, save };
    });
  }

  unlock(p: PlayerRow, base: number, now: number) {
    return this.mutate(p, base, now, "unlock", "hammasi ochildi", (d) =>
      unlockAll(d, this.lists ?? undefined),
    );
  }

  grant(
    p: PlayerRow,
    b: {
      base: number;
      gold?: number | undefined;
      xp?: number | undefined;
      level?: number | undefined;
      hero?: string | undefined;
      lock?: string | undefined;
      daily?: boolean | undefined;
    },
    now: number,
  ) {
    const parts: string[] = [];
    if (b.gold) parts.push(`oltin ${b.gold > 0 ? "+" : ""}${b.gold}`);
    if (b.xp) parts.push(`XP +${b.xp}`);
    if (b.level) parts.push(`daraja ${b.level}`);
    if (b.hero) parts.push(`qahramon ochildi: ${b.hero}`);
    if (b.lock) parts.push(`qahramon yopildi: ${b.lock}`);
    if (b.daily) parts.push("kunlik sovg'a tiklandi");
    if (!parts.length) return { ok: false as const, error: "bad" as const };
    return this.mutate(p, b.base, now, "grant", parts.join(", "), (d) => {
      let out = d;
      if (b.gold) out = grantGold(out, b.gold);
      if (b.level) out = setLevel(out, b.level);
      if (b.xp) out = grantXp(out, b.xp);
      if (b.hero) out = grantHero(out, b.hero);
      if (b.lock) out = revokeHero(out, b.lock);
      if (b.daily) out = resetDailyGift(out);
      return out;
    });
  }

  /** Progressni nolga: yangi o'yinchi tajribasi (oldingisi zaxirada qoladi) */
  reset(p: PlayerRow, base: number, now: number) {
    return this.mutate(p, base, now, "reset", "progress nolga qaytarildi", () => ({}));
  }

  /** Test gildiyasi: oltin talab qilinmaydi */
  guild(p: PlayerRow, b: { name: string; tag: string; emblem: string }, now: number) {
    const r = this.store.guilds.create(
      p,
      {
        name: b.name,
        tag: b.tag,
        emblem: b.emblem,
        mode: "open",
        lang: "uz",
        gold: 0,
        rid: `admin${now.toString(36)}`,
      },
      now,
      { free: true },
    );
    if (r.ok) this.log(num(p.id), "guild", now, num(p.id), `test gildiyasi: [${r.guild.tag}]`);
    return r;
  }

  /** O'z gildiyasi darajasi (XP shu daraja boshiga) */
  guildLevel(p: PlayerRow, level: number, now: number) {
    const m = this.store.guilds.member(p.id);
    if (!m) return { ok: false as const, error: "guild" as const };
    const l = Math.max(1, Math.min(GUILD_LEVEL_XP.length, Math.floor(level)));
    const gid = num(m.guild);
    this.db.exec("UPDATE guilds SET xp = ? WHERE id = ?", GUILD_LEVEL_XP[l - 1]!, gid);
    this.log(num(p.id), "guildlevel", now, num(p.id), `gildiya darajasi ${l}`);
    return { ok: true as const, guild: this.store.guilds.info(gid, now)! };
  }

  /** O'yinchi kartasi: ism, daraja, avatar va ochilgan qahramonlar (sovg'a tanlash uchun) */
  card(p: PlayerRow): PlayerCard {
    const me = this.store.me(p);
    const owned = new Set(heroesIn(this.store.getSave(p.id)?.data ?? {}));
    return {
      id: me.id,
      nick: me.nick,
      avatar: me.avatar,
      level: levelOf(num(p.xp)),
      code: me.code,
      heroes: HERO_IDS.filter((h) => owned.has(h)),
      ...(this.is(p) ? { author: true } : {}),
    };
  }

  /** Taxallus (aniq yoki boshi) yoki do'st kodi bo'yicha — ko'pi bilan 10 ta */
  find(query: string): PlayerCard[] {
    const exact = this.store.friends.find(query);
    const out = exact ? [exact] : [];
    const q = query.trim().toLowerCase().replace(/[%_]/g, "");
    if (q.length >= 2)
      for (const r of this.db
        .exec<PlayerRow>(
          "SELECT * FROM players WHERE nick_key LIKE ? ORDER BY nick_key LIMIT 10",
          `${q}%`,
        )
        .toArray())
        if (!out.some((x) => num(x.id) === num(r.id))) out.push(r);
    return out.slice(0, 10).map((p) => this.card(p));
  }
}
