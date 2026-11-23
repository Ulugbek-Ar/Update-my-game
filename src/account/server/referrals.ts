/**
 * Do'st chaqirish (docs/referrals.md). Har o'yinchining taklif kodi — do'st kodi (players.code):
 *   sayt:     <sayt>?ref=KOD           -> kirishda (auth/webapp | auth/widget | auth/poll) ref=KOD
 *   Telegram: t.me/<bot>?start=ref_KOD -> bot eslab qoladi (ref_pending), akkaunt ochilganda bog'lanadi
 *
 * ALDASHGA QARSHI (hammasi serverda):
 *  - faqat YANGI akkaunt (shu Telegram ID birinchi marta) hisoblanadi; Telegram ID bo'yicha bir marta
 *    (referrals.tg — kalit; akkaunt o'chirib qayta ochilsa ham — ref_seen);
 *  - o'zini o'zi chaqirib bo'lmaydi (bir xil o'yinchi yoki bir xil Telegram ID);
 *  - mukofot faqat yangi o'yinchi akkaunt bilan 1-to'lqinni tugatgach (bulutga yuborilgan saqlanishda
 *    to'lqinlar soni oldingisidan oshgan) — mehmon progressi bilan darhol emas;
 *  - bitta chaqiruvchiga kuniga ko'pi bilan REF_DAILY_CAP ta mukofot (Toshkent kuni); ortig'i
 *    navbatda qoladi va keyingi kunlarda beriladi.
 * Mukofot — sovg'a qutisiga (gifts, sender = 0): bulutdagi progressga server o'zi yozadi, bir marta.
 */
import { REF_DAILY_CAP, REF_GOLD, REF_SKIN_GOAL, type RefInfo } from "../protocol";
import { tashkentDay } from "../scoring";
import { SKINS_KEY, REFERRAL_SKIN, parseSkins, rewardSkinIds } from "@/game/skins";
import { first, num, str, type Row } from "./db";
import { counters } from "./guildLife";
import type { AccountStore, PlayerRow } from "./store";

const DAY = 86_400_000;
/** Botdagi taklif shuncha kun kutadi (akkaunt ochilmasa — unutiladi) */
const PENDING_TTL = 7 * DAY;
/** Kutilayotgan bot takliflari chegarasi (ko'payib ketmasin) */
const MAX_PENDING = 5000;
/** Tizim sovg'asi yuboruvchisi (o'yinchi emas) */
export const SYSTEM_SENDER = 0;

export const REF_NOTE = {
  joined: "Do'st taklifi bilan keldingiz — xush kelibsiz!",
  referrer: (nick: string) => `Do'stingiz ${nick} 1-to'lqinni tugatdi — rahmat!`,
  skin: `${REF_SKIN_GOAL} ta do'st chaqirdingiz — «Chaqiruvchi» Ritsar skini!`,
};

export type BotRef = "ok" | "old" | "self" | "bad";

interface RefRow extends Row {
  tg: number;
  player: number;
  referrer: number;
  done: number;
  paid: number;
}

export class Referrals {
  constructor(private store: AccountStore) {}

  private get db() {
    return this.store.db;
  }

  /** Telegram ID ilgari hisoblanganmi (taklif bilan kelgan yoki akkaunti o'chirilgan) */
  private seen(tg: number) {
    return (
      !!first(this.db, "SELECT tg FROM referrals WHERE tg = ?", tg) ||
      !!first(this.db, "SELECT tg FROM ref_seen WHERE tg = ?", tg)
    );
  }

  /** Botdagi /start ref_KOD: akkaunt hali yo'q bo'lsa — eslab qolinadi */
  botStart(tg: number, code: string, now: number): BotRef {
    const referrer = this.store.playerByCode(code);
    if (!referrer) return "bad";
    if (num(referrer.tg) === tg) return "self";
    if (this.store.playerByTg(tg) || this.seen(tg)) return "old";
    this.db.exec("DELETE FROM ref_pending WHERE at < ?", now - PENDING_TTL);
    const n = num(first(this.db, "SELECT COUNT(*) AS n FROM ref_pending")?.["n"]);
    if (n >= MAX_PENDING) return "ok";
    // birinchi taklif qoladi (keyingi havolalar almashtirmaydi)
    this.db.exec(
      "INSERT OR IGNORE INTO ref_pending (tg, referrer, at) VALUES (?, ?, ?)",
      tg,
      referrer.id,
      now,
    );
    return "ok";
  }

  /**
   * Akkaunt YANGI ochildi (ensurePlayer): taklif kodi (so'rovdan) yoki botda eslab qolingan taklif
   * bo'yicha bog'lanadi. Faqat shu yerdan — eski akkauntga kirish hech narsa qilmaydi.
   */
  attach(player: PlayerRow, code: string | null | undefined, now: number) {
    const tg = num(player.tg);
    const pend = first<Row & { referrer: number; at: number }>(
      this.db,
      "SELECT referrer, at FROM ref_pending WHERE tg = ?",
      tg,
    );
    if (pend) this.db.exec("DELETE FROM ref_pending WHERE tg = ?", tg);
    const fromBot =
      pend && num(pend.at) >= now - PENDING_TTL ? this.store.player(num(pend.referrer)) : null;
    const referrer = (code ? this.store.playerByCode(code) : null) ?? fromBot;
    if (!referrer) return false;
    if (num(referrer.id) === num(player.id) || num(referrer.tg) === tg) return false;
    if (this.seen(tg)) return false;
    this.db.exec(
      "INSERT INTO referrals (tg, player, referrer, at) VALUES (?, ?, ?, ?)",
      tg,
      player.id,
      referrer.id,
      now,
    );
    return true;
  }

  /**
   * Bulutga saqlanish qabul qilindi: yangi o'yinchi to'lqin tugatgan bo'lsa (oldingi saqlanishdan
   * oshgan) — u va chaqiruvchi mukofot oladi. prev — oldingi bulutdagi nusxa (yo'q — birinchi
   * yuklash: mehmon progressi hisoblanmaydi). Chaqiruvchi tranzaksiyada.
   */
  onSave(
    player: number,
    prev: () => Record<string, string> | null,
    next: Record<string, string>,
    now: number,
  ) {
    const r = first<RefRow>(
      this.db,
      "SELECT * FROM referrals WHERE player = ? AND done = 0",
      player,
    );
    if (!r) return false;
    const before = prev();
    if (!before) return false;
    if (counters(next).waves <= counters(before).waves) return false;
    this.db.exec("UPDATE referrals SET done = ? WHERE tg = ?", now, r.tg);
    this.gift(player, REF_GOLD, null, REF_NOTE.joined, now);
    this.flush(num(r.referrer), now);
    return true;
  }

  /**
   * Chaqiruvchiga navbatdagi mukofotlar (bugungi chegaragacha) va 5 tadan keyin skin.
   * onSave, "ref/info" va sovg'a qutisi ochilganda chaqiriladi.
   */
  flush(referrer: number, now: number) {
    const p = this.store.player(referrer);
    if (!p) return;
    const day = tashkentDay(now);
    const today = num(
      first(
        this.db,
        "SELECT COUNT(*) AS n FROM referrals WHERE referrer = ? AND paid > 0 AND day = ?",
        referrer,
        day,
      )?.["n"],
    );
    const left = REF_DAILY_CAP - today;
    if (left > 0) {
      const rows = this.db
        .exec<RefRow>(
          "SELECT * FROM referrals WHERE referrer = ? AND paid = 0 AND done > 0 ORDER BY done, tg LIMIT ?",
          referrer,
          left,
        )
        .toArray();
      for (const r of rows) {
        this.db.exec("UPDATE referrals SET paid = ?, day = ? WHERE tg = ?", now, day, r.tg);
        const friend = this.store.player(num(r.player));
        this.gift(
          referrer,
          REF_GOLD,
          null,
          REF_NOTE.referrer(friend ? str(friend.nick) : "—"),
          now,
        );
      }
    }
    if (this.rewarded(referrer) >= REF_SKIN_GOAL && !this.hasSkin(referrer)) {
      this.db.exec("INSERT INTO ref_skin (player, at) VALUES (?, ?)", referrer, now);
      this.gift(referrer, 0, REFERRAL_SKIN, REF_NOTE.skin, now);
    }
  }

  private rewarded(referrer: number) {
    return num(
      first(
        this.db,
        "SELECT COUNT(*) AS n FROM referrals WHERE referrer = ? AND paid > 0",
        referrer,
      )?.["n"],
    );
  }

  hasSkin(player: number) {
    return !!first(this.db, "SELECT player FROM ref_skin WHERE player = ?", player);
  }

  /**
   * Saqlanishdagi mukofot skinlari serverda berilganmi: aks holda (qo'lda yozilgan) — rad etiladi.
   * true — hammasi joyida.
   */
  skinsAllowed(player: number, data: Record<string, string>) {
    const owned = parseSkins(data[SKINS_KEY]).owned;
    const reward = rewardSkinIds();
    if (!owned.some((s) => reward.includes(s))) return true;
    return this.hasSkin(player);
  }

  /** Tizim sovg'asi (sovg'a qutisiga): oltin yoki skin */
  private gift(to: number, gold: number, skin: string | null, note: string, now: number) {
    this.db.exec(
      "INSERT INTO gifts (sender, receiver, gold, xp, hero, note, at) VALUES (?, ?, ?, 0, '', ?, ?)",
      SYSTEM_SENDER,
      to,
      gold,
      note,
      now,
    );
    if (skin) {
      const id = num(
        first(this.db, "SELECT id FROM gifts WHERE receiver = ? ORDER BY id DESC LIMIT 1", to)?.[
          "id"
        ],
      );
      this.db.exec("INSERT INTO gift_skins (gift, skin) VALUES (?, ?)", id, skin);
    }
  }

  /** "ref/info": navbatdagilar beriladi, keyin hisoblar */
  info(p: PlayerRow, bot: string | null, now: number): RefInfo {
    this.db.tx(() => this.flush(num(p.id), now));
    const n = (q: string) => num(first(this.db, q, p.id)?.["n"]);
    return {
      code: str(p.code),
      bot,
      joined: n("SELECT COUNT(*) AS n FROM referrals WHERE referrer = ?"),
      rewarded: n("SELECT COUNT(*) AS n FROM referrals WHERE referrer = ? AND paid > 0"),
      queued: n("SELECT COUNT(*) AS n FROM referrals WHERE referrer = ? AND paid = 0 AND done > 0"),
      skin: this.hasSkin(num(p.id)),
    };
  }

  /** Akkaunt o'chirilmoqda (store.deleteAccount tranzaksiyasida) */
  forget(p: PlayerRow) {
    const id = num(p.id);
    // shu Telegram ID qayta ochsa — yangi o'yinchi hisoblanmaydi
    this.db.exec("INSERT OR IGNORE INTO ref_seen (tg) VALUES (?)", num(p.tg));
    // chaqirilgan bo'lsa — qator qoladi (bir marta qoidasi), o'yinchi raqami esa tozalanadi
    // (1-to'lqingacha o'chirgan bo'lsa — done = 0 qoladi: chaqiruvchiga mukofot berilmaydi)
    this.db.exec("UPDATE referrals SET player = 0 WHERE player = ?", id);
    this.db.exec("DELETE FROM referrals WHERE referrer = ?", id);
    this.db.exec("DELETE FROM ref_pending WHERE referrer = ? OR tg = ?", id, num(p.tg));
    this.db.exec("DELETE FROM ref_skin WHERE player = ?", id);
  }
}
