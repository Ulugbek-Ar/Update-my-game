/**
 * Do'stlar (serverda): so'rov -> qabul/rad, ro'yxat (onlayn/oflayn, qayerda), bloklash va o'chirish,
 * tayyor iboralar bilan tez xabar. Onlayn holat — presence jadvali (yozuvlarni tejash uchun
 * faqat o'zgarganda yoki 3 daqiqada bir yoziladi).
 */
import {
  FRIEND_PHRASES,
  HERO_IDS,
  MAX_FRIENDS,
  MAX_OUTGOING,
  ONLINE_MS,
  PLACES,
  normalizeFriendCode,
  type FriendInfo,
  type FriendLists,
  type FriendMessage,
  type Place,
} from "../protocol";
import { checkNick } from "../nick";
import { levelOf } from "../xp";
import { first, num, str, type Row } from "./db";
import type { AccountStore, PlayerRow } from "./store";

/** Holat shundan eski bo'lsa — qayta yoziladi (o'zgarmagan bo'lsa ham) */
const PRESENCE_REWRITE = 3 * 60_000;
/** Bitta o'yinchiga ko'pi bilan shuncha o'qilmagan xabar */
const MAX_INBOX = 20;
/** Bir o'yinchidan xabarlar orasidagi eng qisqa vaqt */
const MSG_GAP = 2000;

interface FriendRow extends Row {
  a: number;
  b: number;
  status: string;
}

type FriendErr = { ok: false; error: "none" | "limit" | "bad" };

export class Friends {
  /** oxirgi xabar vaqti (xotirada — DO uxlasa nollanadi) */
  private lastMsg = new Map<number, number>();

  constructor(private store: AccountStore) {}

  private get db() {
    return this.store.db;
  }

  private rel(a: number, b: number) {
    return first<FriendRow>(this.db, "SELECT * FROM friends WHERE a = ? AND b = ?", a, b);
  }

  /** a ni b bloklaganmi */
  private blockedBy(a: number, b: number) {
    return this.rel(b, a)?.status === "block";
  }

  private count(a: number, status: string) {
    return num(
      first(this.db, "SELECT COUNT(*) AS n FROM friends WHERE a = ? AND status = ?", a, status)?.[
        "n"
      ],
    );
  }

  private info(p: PlayerRow, now: number, withRoom: boolean): FriendInfo {
    const pr = first<{ at: number; place: string; room: string }>(
      this.db,
      "SELECT at, place, room FROM presence WHERE player = ?",
      p.id,
    );
    const at = pr ? num(pr.at) : 0;
    const place = pr && PLACES.includes(str(pr.place) as Place) ? (str(pr.place) as Place) : null;
    const online = !!pr && place !== "off" && now - at < ONLINE_MS;
    const out: FriendInfo = {
      id: num(p.id),
      nick: str(p.nick),
      avatar: HERO_IDS.find((h) => h === p.avatar) ?? "knight",
      level: levelOf(num(p.xp)),
      online,
      place: online ? place : null,
      room: online && withRoom && place === "realm" && pr?.room ? str(pr.room) : null,
      seen: at,
    };
    const guild = this.store.guilds.tagOf(num(p.id));
    if (guild) out.guild = guild;
    if (this.store.admin.is(p)) out.author = true;
    return out;
  }

  private others(sql: string, id: number, now: number, withRoom: boolean) {
    return this.db
      .exec<{ id: number }>(sql, id)
      .toArray()
      .map((r) => this.store.player(num(r.id)))
      .filter((p): p is PlayerRow => !!p)
      .map((p) => this.info(p, now, withRoom));
  }

  list(id: number, now: number): FriendLists {
    const byName = (a: FriendInfo, b: FriendInfo) =>
      Number(b.online) - Number(a.online) || a.nick.localeCompare(b.nick);
    return {
      friends: this.others(
        "SELECT b AS id FROM friends WHERE a = ? AND status = 'ok'",
        id,
        now,
        true,
      ).sort(byName),
      incoming: this.others(
        "SELECT a AS id FROM friends WHERE b = ? AND status = 'req'",
        id,
        now,
        false,
      ),
      outgoing: this.others(
        "SELECT b AS id FROM friends WHERE a = ? AND status = 'req'",
        id,
        now,
        false,
      ),
      blocked: this.others(
        "SELECT b AS id FROM friends WHERE a = ? AND status = 'block'",
        id,
        now,
        false,
      ),
    };
  }

  /** Taxallus yoki do'st kodi bo'yicha o'yinchi */
  find(query: string) {
    const code = normalizeFriendCode(query);
    if (code) {
      const p = this.store.playerByCode(code);
      if (p) return p;
    }
    const c = checkNick(query.replace(/^@/, ""));
    return c.ok ? this.store.playerByNick(c.nick) : this.store.playerByNick(query.trim());
  }

  /**
   * Do'stlik so'rovi. U ham menga so'rov yuborgan bo'lsa — darhol do'st. Bloklagan o'yinchiga
   * so'rov ketmaydi ("topilmadi" — bloklanganini bildirmaymiz).
   */
  add(
    me: PlayerRow,
    query: string,
    now: number,
  ): { ok: true; friend: FriendInfo; accepted: boolean } | FriendErr {
    const p = this.find(query);
    if (!p || p.id === me.id || this.blockedBy(me.id, p.id)) return { ok: false, error: "none" };
    const mine = this.rel(me.id, p.id);
    if (mine?.status === "block") return { ok: false, error: "bad" };
    if (mine?.status === "ok") return { ok: true, friend: this.info(p, now, true), accepted: true };
    if (this.rel(p.id, me.id)?.status === "req") {
      if (this.count(me.id, "ok") >= MAX_FRIENDS) return { ok: false, error: "limit" };
      this.accept(me.id, p.id, now);
      return { ok: true, friend: this.info(p, now, true), accepted: true };
    }
    if (!mine) {
      if (this.count(me.id, "req") >= MAX_OUTGOING || this.count(me.id, "ok") >= MAX_FRIENDS)
        return { ok: false, error: "limit" };
      this.db.exec(
        "INSERT INTO friends (a, b, status, since) VALUES (?, ?, 'req', ?)",
        me.id,
        p.id,
        now,
      );
    }
    return { ok: true, friend: this.info(p, now, false), accepted: false };
  }

  private accept(me: number, other: number, now: number) {
    this.db.tx(() => {
      this.db.exec("DELETE FROM friends WHERE a = ? AND b = ?", other, me);
      this.db.exec("DELETE FROM friends WHERE a = ? AND b = ?", me, other);
      this.db.exec(
        "INSERT INTO friends (a, b, status, since) VALUES (?, ?, 'ok', ?), (?, ?, 'ok', ?)",
        me,
        other,
        now,
        other,
        me,
        now,
      );
    });
  }

  /** Kelgan so'rovga javob: qabul — ikkalasi do'st; rad — so'rov o'chadi */
  answer(me: PlayerRow, other: number, yes: boolean, now: number): { ok: true } | FriendErr {
    if (this.rel(other, me.id)?.status !== "req") return { ok: false, error: "none" };
    if (!yes) {
      this.db.exec("DELETE FROM friends WHERE a = ? AND b = ? AND status = 'req'", other, me.id);
      return { ok: true };
    }
    if (this.count(me.id, "ok") >= MAX_FRIENDS) return { ok: false, error: "limit" };
    this.accept(me.id, other, now);
    return { ok: true };
  }

  /** Do'stlikdan chiqarish (yoki yuborgan so'rovni bekor qilish) */
  remove(me: PlayerRow, other: number) {
    this.db.tx(() => {
      this.db.exec(
        "DELETE FROM friends WHERE a = ? AND b = ? AND status IN ('ok', 'req')",
        me.id,
        other,
      );
      this.db.exec("DELETE FROM friends WHERE a = ? AND b = ? AND status = 'ok'", other, me.id);
    });
    return { ok: true as const };
  }

  /** Bloklash: do'stlik va so'rovlar o'chadi, u endi so'rov va xabar yubora olmaydi */
  block(me: PlayerRow, other: number, now: number): { ok: true } | FriendErr {
    if (other === me.id || !this.store.player(other)) return { ok: false, error: "none" };
    this.db.tx(() => {
      this.db.exec("DELETE FROM friends WHERE a = ? AND b = ?", me.id, other);
      this.db.exec("DELETE FROM friends WHERE a = ? AND b = ? AND status != 'block'", other, me.id);
      this.db.exec(
        "INSERT INTO friends (a, b, status, since) VALUES (?, ?, 'block', ?)",
        me.id,
        other,
        now,
      );
      this.db.exec("DELETE FROM messages WHERE sender = ? AND receiver = ?", other, me.id);
    });
    return { ok: true };
  }

  unblock(me: PlayerRow, other: number) {
    this.db.exec("DELETE FROM friends WHERE a = ? AND b = ? AND status = 'block'", me.id, other);
    return { ok: true as const };
  }

  /** Tayyor ibora — faqat do'stga */
  message(me: PlayerRow, to: number, phrase: number, now: number): { ok: true } | FriendErr {
    if (this.rel(me.id, to)?.status !== "ok" || phrase < 0 || phrase >= FRIEND_PHRASES.length)
      return { ok: false, error: "none" };
    if (now - (this.lastMsg.get(me.id) ?? 0) < MSG_GAP) return { ok: false, error: "limit" };
    this.lastMsg.set(me.id, now);
    if (this.lastMsg.size > 5000) this.lastMsg.clear();
    this.db.tx(() => {
      this.db.exec(
        "INSERT INTO messages (sender, receiver, phrase, at) VALUES (?, ?, ?, ?)",
        me.id,
        to,
        phrase,
        now,
      );
      // juda ko'p o'qilmagan — eskilari o'chadi
      this.db.exec(
        "DELETE FROM messages WHERE receiver = ? AND id NOT IN (SELECT id FROM messages WHERE receiver = ? ORDER BY id DESC LIMIT ?)",
        to,
        to,
        MAX_INBOX,
      );
    });
    return { ok: true };
  }

  /**
   * Onlayn holat (har daqiqada va o'zgarganda). Yozuv faqat o'zgarganda yoki 3 daqiqada bir.
   * Javob: yangi xabarlar (yetkazilgach o'chadi) va kelgan so'rovlar soni.
   */
  presence(me: PlayerRow, place: Place, room: string | null, now: number) {
    const cur = first<{ at: number; place: string; room: string }>(
      this.db,
      "SELECT at, place, room FROM presence WHERE player = ?",
      me.id,
    );
    const r = place === "realm" ? (room ?? "") : "";
    if (
      !cur ||
      str(cur.place) !== place ||
      str(cur.room) !== r ||
      now - num(cur.at) > PRESENCE_REWRITE
    )
      this.db.exec(
        `INSERT INTO presence (player, at, place, room) VALUES (?, ?, ?, ?)
         ON CONFLICT (player) DO UPDATE SET at = excluded.at, place = excluded.place, room = excluded.room`,
        me.id,
        now,
        place,
        r,
      );
    const rows = this.db
      .exec<{ id: number; sender: number; phrase: number; at: number }>(
        "SELECT id, sender, phrase, at FROM messages WHERE receiver = ? ORDER BY id",
        me.id,
      )
      .toArray();
    const messages: FriendMessage[] = [];
    for (const m of rows) {
      const p = this.store.player(num(m.sender));
      if (p)
        messages.push({
          id: num(m.id),
          from: num(m.sender),
          nick: str(p.nick),
          phrase: num(m.phrase),
          at: num(m.at),
        });
    }
    if (rows.length) this.db.exec("DELETE FROM messages WHERE receiver = ?", me.id);
    const requests = num(
      first(this.db, "SELECT COUNT(*) AS n FROM friends WHERE b = ? AND status = 'req'", me.id)?.[
        "n"
      ],
    );
    const gifts = this.store.gifts.pending(me.id);
    return {
      ok: true as const,
      messages,
      requests,
      guild: this.store.guilds.ping(me.id, now),
      // sovg'a qutisi: kutayotgan sovg'alar (bo'lmasa — maydon yo'q)
      ...(gifts ? { gifts } : {}),
    };
  }
}
