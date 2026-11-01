/**
 * Akkauntlar Durable Object'i (bitta nusxa, nomi "accounts") — SQLite saqlashli (bepul tarif).
 * Mantiq — src/account/server/*.ts (Node'da sinaladi), bu yerda faqat SQLite ulash, Telegram
 * Bot API chaqiruvlari va lobbiga so'rovlar hisobi.
 *
 * Taymer (setInterval/alarm) yo'q: DO faqat so'rovni bajarayotganda ishlaydi, qolgan vaqt uxlaydi —
 * bepul tarifdagi DO vaqti (GB-s) deyarli sarflanmaydi. Batafsil: docs/server.md, docs/accounts.md
 */
import { DurableObject } from "cloudflare:workers";
import { AccountStore } from "../../src/account/server/store";
import { Limiters, handleApi } from "../../src/account/server/api";
import { botUpdate } from "../../src/account/server/bot";
import { botIdOf } from "../../src/account/server/telegram";
import type { Db, Row, SqlCursor, SqlValue } from "../../src/account/server/db";
import type { AccConfig } from "../../src/account/protocol";
import type { Env } from "./index";

/** O'yin sayti (bot salomlashuvida) */
const SITE = "https://ulugbek-ar.github.io/Update-my-game/";
/** Lobbiga so'rovlar hisobi shu oraliqda yoki shuncha birlik yig'ilganda yuboriladi */
const REPORT_MS = 60_000;
const REPORT_UNITS = 40;

export class AccountDO extends DurableObject<Env> {
  private store: AccountStore;
  private lim = new Limiters();
  private bot: { username: string; id: number } | null = null;
  private used = 0;
  private reportAt = 0;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    const sql = ctx.storage.sql;
    const db: Db = {
      exec: <T extends Row>(q: string, ...b: SqlValue[]) =>
        sql.exec(q, ...b) as unknown as SqlCursor<T>,
      tx: (fn) => ctx.storage.transactionSync(fn),
    };
    this.store = new AccountStore(db);
  }

  private get token() {
    return this.env.TELEGRAM_BOT_TOKEN?.trim() || null;
  }

  /** /acc/<op> */
  async api(op: string, body: unknown, ip: string) {
    this.count();
    const bot = op === "auth/bot" ? await this.botInfo() : null;
    return handleApi(
      this.store,
      op,
      body,
      { now: Date.now(), ip, botToken: this.token, bot: bot?.username ?? null },
      this.lim,
    );
  }

  /** GET /acc/config — saytdagi Login Widget va bot havolasi uchun */
  async config(): Promise<AccConfig> {
    this.count();
    const bot = await this.botInfo();
    return { ok: true, bot: bot?.username ?? null, botId: bot?.id ?? null };
  }

  /** Bot webhook'i (Worker yashirin yo'lni tekshirgan) */
  async telegram(update: unknown) {
    this.count();
    const token = this.token;
    if (!token) return;
    for (const c of botUpdate(this.store, update, Date.now(), SITE))
      await this.call(c.method, c.body);
  }

  /** Olam xonasi (RoomDO) so'raydi: token kimniki — taxallus va daraja ism yonida ko'rinadi */
  async identify(token: string) {
    this.count();
    const p = await this.store.authenticate(token, Date.now());
    if (!p) return null;
    const me = this.store.me(p);
    return { id: me.id, nick: me.nick, level: me.level };
  }

  /** Olam xonasi (RoomDO): Kul qiroli yengildi — jamoadagi kirgan o'yinchilar reytingga */
  async raidWin(team: number[], secs: number) {
    this.count();
    return this.store.scores.raid(team, secs, Date.now());
  }

  /** Bot username va raqami: getMe (bir marta, keyin SQLite meta'da) */
  private async botInfo() {
    const token = this.token;
    if (!token) return null;
    if (this.bot) return this.bot;
    // lokal sinov (.dev.vars) yoki qo'lda: getMe'siz
    const name = this.env.TELEGRAM_BOT_NAME?.trim().replace(/^@/, "");
    if (name) return (this.bot = { username: name, id: botIdOf(token) ?? 0 });
    const row = this.store.db
      .exec<{ v: string }>("SELECT v FROM meta WHERE k = 'bot'")
      .toArray()[0];
    try {
      const saved = row ? (JSON.parse(row.v) as { username: string; id: number; t: string }) : null;
      // token almashtirilgan bo'lsa (BotFather -> revoke) — qayta so'raladi
      if (saved && saved.t === token.slice(-6)) return (this.bot = saved);
    } catch {
      /* buzuq yozuv */
    }
    try {
      const r = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      const j = (await r.json()) as { ok?: boolean; result?: { username?: string; id?: number } };
      const username = j.result?.username;
      if (!j.ok || !username) return null;
      this.bot = { username, id: j.result?.id ?? botIdOf(token) ?? 0 };
      this.store.db.exec(
        "INSERT INTO meta (k, v) VALUES ('bot', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v",
        JSON.stringify({ ...this.bot, t: token.slice(-6) }),
      );
      return this.bot;
    } catch (e) {
      console.error("getMe", e);
      return null;
    }
  }

  private async call(method: string, body: Record<string, unknown>) {
    try {
      const r = await fetch(`https://api.telegram.org/bot${this.token}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) console.error("telegram", method, r.status, await r.text());
    } catch (e) {
      console.error("telegram", method, e);
    }
  }

  /** Worker + DO so'rovi; lobbiga vaqti-vaqti bilan (kunlik limit hisobi bitta joyda) */
  private count() {
    this.used += 2;
    const now = Date.now();
    if (this.used < REPORT_UNITS && now - this.reportAt < REPORT_MS) return;
    const used = this.used;
    this.used = 0;
    this.reportAt = now;
    const lobby = this.env.LOBBY.get(this.env.LOBBY.idFromName("lobby"));
    this.ctx.waitUntil(
      lobby.extra(used).catch((e: unknown) => {
        console.error("lobbi hisoboti", e);
      }),
    );
  }
}
