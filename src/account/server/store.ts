/**
 * Akkaunt ombori (serverda bitta nusxa — AccountDO): o'yinchilar, sessiyalar, bot orqali kirish
 * kodlari va bulutli saqlanish. Platformadan mustaqil — Node'da sinaladi (memory-db.ts).
 *
 * Muhim: tekshirish va yozish orasida `await` yo'q (xesh va imzolar oldindan hisoblanadi) —
 * shunda bir martalik kod ikki marta ishlatilmaydi, ikki so'rov bir-birini buzmaydi.
 */
import {
  CODE_ALPHABET,
  HERO_IDS,
  LOGIN_TTL,
  MAX_SAVE,
  SESSION_DAYS,
  type BackupInfo,
  type CloudSave,
  type Device,
  type Me,
} from "../protocol";
import { checkNick, nickFromTelegram, nickKey } from "../nick";
import { XP_KEY, levelOf, xpFromRaw } from "../xp";
import { checkSave, type LimitField } from "../limits";
/** Olam saqlanishi kaliti (src/game/realmLink.ts REALM_SAVE_KEY; u server build'iga kirmaydi) */
export const REALM_KEY = "pixel-rpg-realm";
import { first, initSchema, num, str, type Db, type Row } from "./db";
import { sha256Hex, type TgUser } from "./telegram";
import { Friends } from "./friends";
import { Guilds } from "./guilds";
import { Scores } from "./scores";
import { Admin } from "./admin";
import { Gifts } from "./gifts";

const DAY = 86_400_000;
/** Bir o'yinchida ko'pi bilan shuncha sessiya (eskisi o'chadi) */
const MAX_SESSIONS = 10;
/** Bir vaqtda kutilayotgan bot kodlari (ko'payib ketmasin) */
const MAX_PENDING_LOGINS = 500;
/** Klient soati shundan ko'p oldinda bo'lsa — server vaqti bilan cheklanadi */
const CLOCK_SKEW = 5 * 60_000;
/** Zaxira: o'yinchiga 5 ta joy; bir qurilmada o'ynalsa ham har 30 daqiqada bir nusxa */
export const BACKUP_SLOTS = 5;
const BACKUP_EVERY = 30 * 60_000;

/**
 * Zaxira sababi: force — tanlov oynasi, conflict — boshqa qurilma orada saqlagan, device —
 * boshqa qurilmadan, time — davriy, stale — rad etilgan (eski) nusxa, restore — tiklashdan oldingi
 */
export type BackupReason =
  | "force"
  | "conflict"
  | "device"
  | "time"
  | "stale"
  | "restore"
  /** muallif paneli o'zgartirishidan oldingi */
  | "admin"
  /** sovg'a olishdan oldingi */
  | "gift";

export interface PlayerRow extends Row {
  id: number;
  tg: number;
  nick: string;
  nick_key: string;
  avatar: string;
  code: string;
  created: number;
  xp: number;
}

interface LoginRow extends Row {
  code: string;
  secret: string;
  expires: number;
  device: string;
  status: string;
  tg: number | null;
  hint: string | null;
}

interface SaveRow extends Row {
  player: number;
  version: number;
  time: number;
  at: number;
  device: string;
  dev: string;
  data: string;
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const B62 = B64.slice(0, 62);

/** Tasodifiy satr (kriptografik), alifbodan teng ehtimol bilan */
export function randomString(n: number, alphabet = B64) {
  const out: string[] = [];
  const max = 256 - (256 % alphabet.length);
  while (out.length < n) {
    const bytes = crypto.getRandomValues(new Uint8Array(n * 2));
    for (const b of bytes) {
      if (b < max) out.push(alphabet[b % alphabet.length]!);
      if (out.length === n) break;
    }
  }
  return out.join("");
}

const isDevice = (s: string): s is Device =>
  ["web", "telegram", "android", "windows", "portable"].includes(s);

export type PutResult =
  | { ok: true; version: number }
  | { ok: false; error: "conflict"; save: CloudSave }
  | { ok: false; error: "big" }
  | { ok: false; error: "invalid"; field: LimitField };

export interface PutRequest {
  base: number;
  time: number;
  device: Device;
  dev?: string | undefined;
  data: Record<string, string>;
  force?: boolean | undefined;
}

export class AccountStore {
  /** do'stlar, onlayn holat va tez xabarlar */
  readonly friends: Friends;
  /** reyting (haftalik va umumiy) */
  readonly scores: Scores;
  /** gildiyalar (docs/guilds.md) */
  readonly guilds: Guilds;
  /** muallif paneli: admin huquqi (ADMIN_TELEGRAM_IDS), jurnal (docs/admin.md) */
  readonly admin: Admin;
  /** muallif sovg'alari (sovg'a qutisi) */
  readonly gifts: Gifts;

  constructor(readonly db: Db) {
    initSchema(db);
    this.friends = new Friends(this);
    this.scores = new Scores(this);
    this.guilds = new Guilds(this);
    this.admin = new Admin(this);
    this.gifts = new Gifts(this);
  }

  // ---------------- o'yinchilar ----------------

  player(id: number) {
    return first<PlayerRow>(this.db, "SELECT * FROM players WHERE id = ?", id);
  }

  playerByTg(tg: number) {
    return first<PlayerRow>(this.db, "SELECT * FROM players WHERE tg = ?", tg);
  }

  playerByNick(nick: string) {
    return first<PlayerRow>(this.db, "SELECT * FROM players WHERE nick_key = ?", nickKey(nick));
  }

  playerByCode(code: string) {
    return first<PlayerRow>(this.db, "SELECT * FROM players WHERE code = ?", code);
  }

  nickFree(nick: string, exceptId = 0) {
    const p = this.playerByNick(nick);
    return !p || p.id === exceptId;
  }

  /** Bo'sh taxallus: Telegram username (mos bo'lsa), aks holda "Qahramon1234" */
  private freeNick(hint: string | null | undefined) {
    const fromTg = nickFromTelegram(hint);
    if (fromTg && this.nickFree(fromTg)) return fromTg;
    for (let i = 0; i < 50; i++) {
      const n = `Qahramon${1000 + Math.floor(Math.random() * 9000)}`;
      if (this.nickFree(n)) return n;
    }
    return `Qahramon${randomString(6, "0123456789")}`;
  }

  private freeCode() {
    for (;;) {
      const c = randomString(8, CODE_ALPHABET);
      if (!this.playerByCode(c)) return c;
    }
  }

  /** Telegram foydalanuvchisi bo'yicha o'yinchi; birinchi kirishda yaratiladi */
  ensurePlayer(user: Pick<TgUser, "id" | "username">, now: number) {
    const old = this.playerByTg(user.id);
    if (old) return { player: old, created: false };
    const nick = this.freeNick(user.username);
    this.db.exec(
      "INSERT INTO players (tg, nick, nick_key, avatar, code, created, xp) VALUES (?, ?, ?, 'knight', ?, ?, 0)",
      user.id,
      nick,
      nickKey(nick),
      this.freeCode(),
      now,
    );
    return { player: this.playerByTg(user.id)!, created: true };
  }

  me(p: PlayerRow): Me {
    const avatar = HERO_IDS.find((h) => h === p.avatar) ?? "knight";
    return {
      id: num(p.id),
      nick: str(p.nick),
      avatar,
      xp: num(p.xp),
      level: levelOf(num(p.xp)),
      code: str(p.code),
      created: num(p.created),
      tg: num(p.tg),
      ...(this.admin.is(p) ? { admin: true } : {}),
    };
  }

  /** Taxallus va avatar. Taxallus tekshiriladi va band bo'lmasligi kerak. */
  setProfile(
    p: PlayerRow,
    patch: { nick?: string | undefined; avatar?: string | undefined },
    unlocked: (hero: string) => boolean,
  ): { ok: true; player: PlayerRow } | { ok: false; error: "nick" | "taken" | "none" } {
    let nick = p.nick;
    if (patch.nick !== undefined) {
      const c = checkNick(patch.nick);
      if (!c.ok) return { ok: false, error: "nick" };
      if (!this.nickFree(c.nick, p.id)) return { ok: false, error: "taken" };
      nick = c.nick;
    }
    let avatar = p.avatar;
    if (patch.avatar !== undefined) {
      if (!HERO_IDS.some((h) => h === patch.avatar) || !unlocked(patch.avatar))
        return { ok: false, error: "none" };
      avatar = patch.avatar;
    }
    if (nick !== p.nick || avatar !== p.avatar)
      this.db.exec(
        "UPDATE players SET nick = ?, nick_key = ?, avatar = ? WHERE id = ?",
        nick,
        nickKey(nick),
        avatar,
        p.id,
      );
    return { ok: true, player: this.player(p.id)! };
  }

  /**
   * Akkauntni o'chirish: serverdagi barcha ma'lumot — o'yinchi, sessiyalar, saqlanish va zaxiralar,
   * do'stlik, xabarlar, onlayn holat, reyting, gildiya a'zoligi va yozuvlari. Qaytarib bo'lmaydi.
   */
  deleteAccount(id: number) {
    this.db.tx(() => {
      const p = this.player(id);
      this.guilds.forget(id);
      for (const q of [
        "DELETE FROM sessions WHERE player = ?",
        "DELETE FROM saves WHERE player = ?",
        "DELETE FROM backups WHERE player = ?",
        "DELETE FROM friends WHERE a = ?",
        "DELETE FROM friends WHERE b = ?",
        "DELETE FROM messages WHERE sender = ?",
        "DELETE FROM messages WHERE receiver = ?",
        "DELETE FROM presence WHERE player = ?",
        "DELETE FROM scores WHERE player = ?",
        "DELETE FROM gifts WHERE receiver = ?",
        "DELETE FROM expeditions WHERE player = ?",
        "DELETE FROM players WHERE id = ?",
      ])
        this.db.exec(q, id);
      if (p) this.db.exec("DELETE FROM logins WHERE tg = ?", p.tg);
    });
  }

  /** XP bulutli saqlanishdan (daraja onlayn ism yonida va reytingda ko'rinadi) */
  setXp(id: number, xp: number) {
    this.db.exec("UPDATE players SET xp = ? WHERE id = ? AND xp != ?", xp, id, xp);
  }

  // ---------------- sessiyalar ----------------

  /** Yangi sessiya: tasodifiy token (o'yinchiga), serverda — faqat uning xeshi */
  async createSession(player: number, device: Device, now: number) {
    const token = randomString(43);
    const hash = await sha256Hex(token);
    this.db.tx(() => {
      this.db.exec(
        "INSERT INTO sessions (hash, player, created, expires, device) VALUES (?, ?, ?, ?, ?)",
        hash,
        player,
        now,
        now + SESSION_DAYS * DAY,
        device,
      );
      // eng eskilari (ko'p qurilmada kirgan bo'lsa)
      const extra = this.db
        .exec<{ hash: string }>(
          "SELECT hash FROM sessions WHERE player = ? ORDER BY created DESC LIMIT -1 OFFSET ?",
          player,
          MAX_SESSIONS,
        )
        .toArray();
      for (const r of extra) this.db.exec("DELETE FROM sessions WHERE hash = ?", r.hash);
    });
    return token;
  }

  /** Token bo'yicha o'yinchi; muddati o'tgan bo'lsa null. Kuniga bir marta muddat uzayadi. */
  async authenticate(token: string, now: number) {
    const hash = await sha256Hex(token);
    const s = first<{ player: number; expires: number }>(
      this.db,
      "SELECT player, expires FROM sessions WHERE hash = ?",
      hash,
    );
    if (!s) return null;
    if (num(s.expires) <= now) {
      this.db.exec("DELETE FROM sessions WHERE hash = ?", hash);
      return null;
    }
    const p = this.player(num(s.player));
    if (!p) return null;
    if (num(s.expires) - now < (SESSION_DAYS - 1) * DAY)
      this.db.exec(
        "UPDATE sessions SET expires = ? WHERE hash = ?",
        now + SESSION_DAYS * DAY,
        hash,
      );
    return p;
  }

  async logout(token: string) {
    const hash = await sha256Hex(token);
    this.db.exec("DELETE FROM sessions WHERE hash = ?", hash);
  }

  /** Telegram tasdiqlagan foydalanuvchi: o'yinchi (kerak bo'lsa yangi) va sessiya */
  async login(user: Pick<TgUser, "id" | "username">, device: Device, now: number) {
    const { player, created } = this.ensurePlayer(user, now);
    const token = await this.createSession(player.id, device, now);
    return { token, me: this.me(player), created };
  }

  // ---------------- bot orqali kirish (ilova va kompyuter) ----------------

  /** Yangi bir martalik kod. null — kutilayotganlar juda ko'p (keyinroq). */
  async startBotLogin(device: Device, now: number) {
    const code = randomString(12, B62);
    const secret = randomString(32);
    const hash = await sha256Hex(secret);
    return this.db.tx(() => {
      this.db.exec("DELETE FROM logins WHERE expires < ?", now);
      const n = num(first(this.db, "SELECT COUNT(*) AS n FROM logins")?.["n"]);
      if (n >= MAX_PENDING_LOGINS) return null;
      this.db.exec(
        "INSERT INTO logins (code, secret, created, expires, device, status) VALUES (?, ?, ?, ?, ?, 'wait')",
        code,
        hash,
        now,
        now + LOGIN_TTL,
        device,
      );
      return { code, secret, expires: now + LOGIN_TTL };
    });
  }

  /** Bot /start login_KOD ni oldi: kod haliyam kutilyaptimi va qaysi qurilmadan */
  botLoginInfo(code: string, now: number): { device: Device } | null {
    const r = first<LoginRow>(this.db, "SELECT * FROM logins WHERE code = ?", code);
    if (!r || r.status !== "wait" || num(r.expires) <= now) return null;
    return { device: isDevice(str(r.device)) ? (str(r.device) as Device) : "web" };
  }

  /** Botdagi "Tasdiqlash" / "Bekor qilish" tugmasi. false — kod eskirgan yoki ishlatilgan. */
  botConfirm(code: string, user: Pick<TgUser, "id" | "username">, accept: boolean, now: number) {
    const r = first<LoginRow>(this.db, "SELECT * FROM logins WHERE code = ?", code);
    if (!r || r.status !== "wait" || num(r.expires) <= now) return false;
    this.db.exec(
      "UPDATE logins SET status = ?, tg = ?, hint = ? WHERE code = ?",
      accept ? "ok" : "no",
      user.id,
      user.username ?? null,
      code,
    );
    return true;
  }

  /**
   * O'yin tasdiqni so'raydi (secret — faqat kodni boshlagan qurilmada). Tasdiqlangan bo'lsa kod
   * o'chiriladi va sessiya beriladi — ikkinchi marta ishlamaydi.
   */
  async pollBotLogin(code: string, secret: string, now: number) {
    const hash = await sha256Hex(secret);
    // token oldindan: tekshiruv va yozish bitta sinxron blokda
    const token = randomString(43);
    const tokenHash = await sha256Hex(token);
    return this.db.tx(() => {
      const r = first<LoginRow>(this.db, "SELECT * FROM logins WHERE code = ?", code);
      if (!r || r.secret !== hash) return { status: "expired" as const };
      if (num(r.expires) <= now || r.status === "no") {
        this.db.exec("DELETE FROM logins WHERE code = ?", code);
        return { status: r.status === "no" ? ("cancelled" as const) : ("expired" as const) };
      }
      if (r.status !== "ok" || r.tg === null) return { status: "wait" as const };
      this.db.exec("DELETE FROM logins WHERE code = ?", code);
      const { player, created } = this.ensurePlayer(
        { id: num(r.tg), ...(r.hint ? { username: str(r.hint) } : {}) },
        now,
      );
      const device = isDevice(str(r.device)) ? (str(r.device) as Device) : "web";
      this.db.exec(
        "INSERT INTO sessions (hash, player, created, expires, device) VALUES (?, ?, ?, ?, ?)",
        tokenHash,
        player.id,
        now,
        now + SESSION_DAYS * DAY,
        device,
      );
      return { status: "done" as const, token, me: this.me(player), created };
    });
  }

  // ---------------- bulutli saqlanish ----------------

  private saveRow(player: number) {
    return first<SaveRow>(this.db, "SELECT * FROM saves WHERE player = ?", player);
  }

  getSave(player: number): CloudSave | null {
    const r = this.saveRow(player);
    if (!r) return null;
    return {
      version: num(r.version),
      time: num(r.time),
      device: isDevice(str(r.device)) ? (str(r.device) as Device) : "web",
      data: parseData(str(r.data)),
    };
  }

  saveVersion(player: number) {
    return num(
      first(this.db, "SELECT version FROM saves WHERE player = ?", player)?.["version"] ?? 0,
    );
  }

  /**
   * Saqlanish. Ziddiyat qoidasi — versiya + vaqt:
   *  - klient oxirgi ko'rgan versiyadan davom etsa (base = joriy) — qabul;
   *  - boshqa qurilma orada saqlagan bo'lsa — progressi keyinroq o'zgargani qoladi (time);
   *    bulutdagisi yangiroq bo'lsa — rad, javobda bulutdagi nusxa (klient uni yuklaydi), rad
   *    etilgan nusxa esa zaxiraga tushadi (yo'qolmaydi);
   *  - force — tanlov oynasida "shu qurilmadagini saqlash" bosilgan.
   * Imkonsiz qiymatlar (limits.ts) — rad. Almashtirilgan nusxa kerak bo'lsa zaxiralanadi.
   */
  putSave(player: number, req: PutRequest, now: number): PutResult {
    const json = JSON.stringify(req.data);
    if (json.length > MAX_SAVE) return { ok: false, error: "big" };
    const time = Math.min(req.time, now + CLOCK_SKEW);
    return this.db.tx(() => {
      const cur = this.saveRow(player);
      const prev = cur && !req.force ? parseData(str(cur.data)) : null;
      const hours = cur ? (now - num(cur.at)) / 3_600_000 : 0;
      const bad = checkSave(req.data, prev, hours);
      if (bad) return { ok: false as const, error: "invalid" as const, field: bad };
      const dev = req.dev ?? "";
      if (!cur) {
        this.db.exec(
          "INSERT INTO saves (player, version, time, at, device, dev, data) VALUES (?, 1, ?, ?, ?, ?, ?)",
          player,
          time,
          now,
          req.device,
          dev,
          json,
        );
        this.setXp(player, xpFromRaw(req.data[XP_KEY]));
        return { ok: true as const, version: 1 };
      }
      const curVersion = num(cur.version);
      const follows = req.base === curVersion;
      if (!follows && !req.force && time <= num(cur.time)) {
        // bulutdagisi yangiroq: rad etilgan qurilma progressi ham zaxirada qoladi
        this.backup(
          player,
          { ...cur, version: req.base, time, device: req.device, data: json },
          "stale",
          now,
        );
        return { ok: false as const, error: "conflict" as const, save: this.getSave(player)! };
      }
      const reason = req.force
        ? "force"
        : !follows
          ? "conflict"
          : str(cur.dev) && dev && str(cur.dev) !== dev
            ? "device"
            : now - this.lastBackupAt(player) > BACKUP_EVERY
              ? "time"
              : null;
      if (reason) this.backup(player, cur, reason, now);
      const version = curVersion + 1;
      this.db.exec(
        "UPDATE saves SET version = ?, time = ?, at = ?, device = ?, dev = ?, data = ? WHERE player = ?",
        version,
        time,
        now,
        req.device,
        dev,
        json,
        player,
      );
      this.setXp(player, xpFromRaw(req.data[XP_KEY]));
      // gildiya topshiriqlari: oldingisidan davom etgan saqlanishdagi o'sish (dushmanlar, XP...).
      // Muallif hissasi hisoblanmaydi — boshqa gildiyalar uchun adolatli
      if (follows && prev && !this.admin.isId(player))
        try {
          this.guilds.life.onSave(player, prev, req.data, now);
        } catch (e) {
          console.error("guild onSave", e);
        }
      return { ok: true as const, version };
    });
  }

  /**
   * Server o'zi yozadigan saqlanish (muallif paneli, sovg'a): tekshiruvsiz, versiya +1, vaqt —
   * hozir (boshqa qurilmalar ham oladi); oldingisi zaxiraga tushadi. Chaqiruvchi tranzaksiyada.
   */
  writeSave(player: number, data: Record<string, string>, now: number, reason: BackupReason) {
    const cur = this.saveRow(player);
    if (cur) this.backup(player, cur, reason, now);
    const version = (cur ? num(cur.version) : 0) + 1;
    const json = JSON.stringify(data);
    this.db.exec(
      `INSERT INTO saves (player, version, time, at, device, dev, data) VALUES (?, ?, ?, ?, ?, '', ?)
       ON CONFLICT (player) DO UPDATE SET version = excluded.version, time = excluded.time,
         at = excluded.at, device = excluded.device, dev = '', data = excluded.data`,
      player,
      version,
      now,
      now,
      cur ? str(cur.device) : "web",
      json,
    );
    this.setXp(player, xpFromRaw(data[XP_KEY]));
    return this.getSave(player)!;
  }

  private lastBackupAt(player: number) {
    return num(first(this.db, "SELECT MAX(at) AS t FROM backups WHERE player = ?", player)?.["t"]);
  }

  /** Zaxira halqasi: bo'sh joy yoki eng eskisi ustiga (o'yinchiga BACKUP_SLOTS ta) */
  private backup(
    player: number,
    row: Pick<SaveRow, "version" | "time" | "device" | "data">,
    reason: BackupReason,
    now: number,
    slot?: number,
  ) {
    if (slot === undefined) {
      const rows = this.db
        .exec<{ slot: number; at: number }>("SELECT slot, at FROM backups WHERE player = ?", player)
        .toArray();
      const used = new Set(rows.map((r) => num(r.slot)));
      slot = 0;
      if (rows.length < BACKUP_SLOTS) while (used.has(slot)) slot++;
      else slot = num(rows.reduce((a, b) => (num(b.at) < num(a.at) ? b : a)).slot);
    }
    this.db.exec(
      `INSERT INTO backups (player, slot, version, time, at, device, reason, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (player, slot) DO UPDATE SET version = excluded.version, time = excluded.time,
         at = excluded.at, device = excluded.device, reason = excluded.reason, data = excluded.data`,
      player,
      slot,
      num(row.version),
      num(row.time),
      now,
      str(row.device),
      reason,
      str(row.data),
    );
  }

  /** Zaxiralar (yangisi birinchi). Olam saqlanishi ro'yxatda yuborilmaydi — faqat "bor" belgisi. */
  backups(player: number): BackupInfo[] {
    return this.db
      .exec<SaveRow & { slot: number; reason: string }>(
        "SELECT * FROM backups WHERE player = ? ORDER BY at DESC",
        player,
      )
      .toArray()
      .map((r) => {
        const data = parseData(str(r.data));
        if (data[REALM_KEY]) data[REALM_KEY] = "1";
        return {
          slot: num(r.slot),
          version: num(r.version),
          time: num(r.time),
          at: num(r.at),
          device: isDevice(str(r.device)) ? (str(r.device) as Device) : "web",
          reason: str(r.reason),
          data,
        };
      });
  }

  /**
   * Zaxiradan tiklash: zaxiradagi nusxa joriy bo'ladi (versiya +1, vaqt — hozir: boshqa
   * qurilmalar ham uni oladi), joriysi esa o'sha zaxira joyiga tushadi (almashinadi).
   */
  restore(player: number, slot: number, now: number): CloudSave | null {
    return this.db.tx(() => {
      const b = first<SaveRow & { slot: number }>(
        this.db,
        "SELECT * FROM backups WHERE player = ? AND slot = ?",
        player,
        slot,
      );
      if (!b) return null;
      const cur = this.saveRow(player);
      if (cur) this.backup(player, cur, "restore", now, slot);
      else this.db.exec("DELETE FROM backups WHERE player = ? AND slot = ?", player, slot);
      const version = (cur ? num(cur.version) : 0) + 1;
      this.db.exec(
        `INSERT INTO saves (player, version, time, at, device, dev, data) VALUES (?, ?, ?, ?, ?, '', ?)
         ON CONFLICT (player) DO UPDATE SET version = excluded.version, time = excluded.time,
           at = excluded.at, device = excluded.device, dev = '', data = excluded.data`,
        player,
        version,
        now,
        now,
        str(b.device),
        str(b.data),
      );
      const data = parseData(str(b.data));
      this.setXp(player, xpFromRaw(data[XP_KEY]));
      return this.getSave(player);
    });
  }
}

export function parseData(json: string): Record<string, string> {
  try {
    const v = JSON.parse(json) as unknown;
    if (!v || typeof v !== "object" || Array.isArray(v)) return {};
    const out: Record<string, string> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>))
      if (typeof x === "string") out[k] = x;
    return out;
  } catch {
    return {};
  }
}
