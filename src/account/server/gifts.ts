/**
 * Sovg'alar: faqat muallif (admin) yuboradi, faqat server orqali. Sovg'a serverda turadi va
 * olinganda server o'zi bulutdagi progressga yozadi (oltin, XP, qahramon) — bir marta, qurilma
 * almashsa ham yo'qolmaydi. Mehmon (akkauntsiz) o'yinchi serverda yo'q — unga yuborib bo'lmaydi.
 */
import { applyGift, heroesIn } from "../grants";
import { GIFT_NOTE_MAX, HERO_IDS, type CloudSave, type GiftInfo, type SentGift } from "../protocol";
import type { Hero } from "@/game/hero";
import { first, num, str, type Row } from "./db";
import type { AccountStore, PlayerRow } from "./store";

/** Bitta o'yinchida ko'pi bilan shuncha olinmagan sovg'a */
export const MAX_PENDING_GIFTS = 50;
const SENT_N = 50;

interface GiftRow extends Row {
  id: number;
  sender: number;
  receiver: number;
  gold: number;
  xp: number;
  hero: string;
  note: string;
  at: number;
  claimed: number;
}

export type GiftFail = {
  ok: false;
  error: "none" | "bad" | "limit" | "conflict";
  save?: CloudSave;
};

const heroOf = (s: string): Hero | null => HERO_IDS.find((h) => h === s) ?? null;

/** Xat: bo'shliqlar qisqaradi, boshqaruv belgilari olib tashlanadi, 120 belgi */
export function cleanNote(s: string | undefined) {
  return (
    (s ?? "")
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, GIFT_NOTE_MAX)
  );
}

export class Gifts {
  constructor(private store: AccountStore) {}

  private get db() {
    return this.store.db;
  }

  private info(r: GiftRow): GiftInfo {
    const s = this.store.player(num(r.sender));
    return {
      id: num(r.id),
      from: {
        nick: s ? str(s.nick) : "Muallif",
        avatar: heroOf(str(s?.avatar)) ?? "knight",
        author: true,
      },
      gold: num(r.gold),
      xp: num(r.xp),
      hero: heroOf(str(r.hero)),
      note: str(r.note),
      at: num(r.at),
    };
  }

  private sentInfo(r: GiftRow): SentGift {
    const to = this.store.player(num(r.receiver));
    return {
      id: num(r.id),
      to: { id: num(r.receiver), nick: to ? str(to.nick) : "—" },
      gold: num(r.gold),
      xp: num(r.xp),
      hero: heroOf(str(r.hero)),
      note: str(r.note),
      at: num(r.at),
      claimed: num(r.claimed),
    };
  }

  /** Muallif yuboradi (huquq adminApi.ts da tekshirilgan) */
  send(
    admin: PlayerRow,
    b: { to: number; gold: number; xp: number; hero?: Hero | undefined; note?: string | undefined },
    now: number,
  ): { ok: true; gift: SentGift } | GiftFail {
    return this.db.tx(() => {
      // akkauntsiz (mehmon) o'yinchi serverda yo'q
      const to = this.store.player(b.to);
      if (!to) return { ok: false as const, error: "none" as const };
      const gold = Math.max(0, Math.floor(b.gold));
      const xp = Math.max(0, Math.floor(b.xp));
      let hero: Hero | null = b.hero ?? null;
      // qahramon — faqat hali ochmaganlaridan (ochgan bo'lsa — rad, adashib yuborilmasin)
      if (hero && heroesIn(this.store.getSave(to.id)?.data ?? {}).includes(hero))
        return { ok: false as const, error: "bad" as const };
      if (!gold && !xp && !hero) return { ok: false as const, error: "bad" as const };
      if (this.pending(to.id) >= MAX_PENDING_GIFTS)
        return { ok: false as const, error: "limit" as const };
      hero ??= null;
      const note = cleanNote(b.note);
      this.db.exec(
        "INSERT INTO gifts (sender, receiver, gold, xp, hero, note, at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        admin.id,
        to.id,
        gold,
        xp,
        hero ?? "",
        note,
        now,
      );
      const row = first<GiftRow>(
        this.db,
        "SELECT * FROM gifts WHERE receiver = ? ORDER BY id DESC LIMIT 1",
        to.id,
      )!;
      const what = [
        gold ? `${gold} oltin` : "",
        xp ? `${xp} XP` : "",
        hero ? `qahramon ${hero}` : "",
      ]
        .filter(Boolean)
        .join(" + ");
      this.store.admin.log(
        num(admin.id),
        "gift",
        now,
        num(to.id),
        `${what}${note ? " + xat" : ""}`,
      );
      return { ok: true as const, gift: this.sentInfo(row) };
    });
  }

  /** Muallif panelidagi "Yuborilgan sovg'alar" (oxirgi 50 ta) */
  sent(): SentGift[] {
    return this.db
      .exec<GiftRow>("SELECT * FROM gifts ORDER BY id DESC LIMIT ?", SENT_N)
      .toArray()
      .map((r) => this.sentInfo(r));
  }

  /** Olinmagan sovg'alar soni (menyudagi belgi) */
  pending(player: number) {
    return num(
      first(
        this.db,
        "SELECT COUNT(*) AS n FROM gifts WHERE receiver = ? AND claimed = 0",
        player,
      )?.["n"],
    );
  }

  /** Sovg'a qutisi */
  list(player: number): GiftInfo[] {
    return this.db
      .exec<GiftRow>(
        "SELECT * FROM gifts WHERE receiver = ? AND claimed = 0 ORDER BY id LIMIT ?",
        player,
        MAX_PENDING_GIFTS,
      )
      .toArray()
      .map((r) => this.info(r));
  }

  /**
   * Sovg'ani olish: bulutdagi progressga yoziladi (versiya +1) va belgilanadi — ikkinchi marta
   * olinmaydi. base — klient progressi shu versiyadan davom etadi (avval saqlangan bo'lishi
   * kerak); mos kelmasa — ziddiyat, bulutdagi nusxa qaytadi.
   */
  claim(
    p: PlayerRow,
    id: number,
    base: number,
    now: number,
  ): { ok: true; save: CloudSave; gift: GiftInfo } | GiftFail {
    return this.db.tx(() => {
      const r = first<GiftRow>(
        this.db,
        "SELECT * FROM gifts WHERE id = ? AND receiver = ? AND claimed = 0",
        id,
        p.id,
      );
      if (!r) return { ok: false as const, error: "none" as const };
      const cur = this.store.getSave(p.id);
      if ((cur?.version ?? 0) !== base)
        return { ok: false as const, error: "conflict" as const, ...(cur ? { save: cur } : {}) };
      const data = applyGift(cur?.data ?? {}, {
        gold: num(r.gold),
        xp: num(r.xp),
        hero: heroOf(str(r.hero)),
      });
      const save = this.store.writeSave(p.id, data, now, "gift");
      this.db.exec("UPDATE gifts SET claimed = ? WHERE id = ?", now, id);
      return { ok: true as const, save, gift: this.info(r) };
    });
  }
}
