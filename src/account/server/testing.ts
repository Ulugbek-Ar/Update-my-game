/**
 * Testlar uchun: xotiradagi server (node:sqlite) va klient transporti — klient kodi (account.ts,
 * cloud.ts) haqiqiy server mantig'i (handleApi) bilan tarmoqsiz ishlaydi.
 */
import type { Transport } from "../api";
import { LOGIN_KEY } from "../keys";
import { Limiters, handleApi } from "./api";
import { memoryDb } from "./memory-db";
import { AccountStore } from "./store";
import { parseAdminIds } from "./admin";

/** Node muhitidagi testlar uchun localStorage (jsdom'siz: node:sqlite faqat Node'da yuklanadi) */
export class MemoryStorage implements Storage {
  private m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  clear() {
    this.m.clear();
  }
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
}

export function installStorage() {
  const g = globalThis as { localStorage?: Storage };
  if (!g.localStorage || !(g.localStorage instanceof MemoryStorage))
    g.localStorage = new MemoryStorage();
  return g.localStorage;
}

export const TEST_BOT_TOKEN = "123456789:AAFakeBotTokenForTests_abcdefghijk";

/** admins — ADMIN_TELEGRAM_IDS kabi ("777,778") */
export function testServer(opts: { admins?: string } = {}) {
  const store = new AccountStore(memoryDb());
  const admins = parseAdminIds(opts.admins);
  const lim = new Limiters();
  const clock = { now: () => Date.now() };
  /** IP har so'rovda boshqa (sinovda kirish tezligi cheklanmasin) */
  let n = 0;
  const transport: Transport = async (op, body) =>
    handleApi(
      store,
      op,
      JSON.parse(JSON.stringify(body)) as unknown,
      {
        now: clock.now(),
        ip: `10.0.0.${n++ % 250}`,
        botToken: TEST_BOT_TOKEN,
        bot: "PikselQalaBot",
        admins,
      },
      lim,
    );
  /** Botdagi "Tasdiqlash": shu qurilmada kutilayotgan kod Telegram foydalanuvchisi bilan */
  const confirmPending = (tg: number, username?: string) => {
    const p = JSON.parse(localStorage.getItem(LOGIN_KEY) ?? "null") as { code: string } | null;
    if (!p) throw new Error("kutilayotgan kod yo'q");
    return store.botConfirm(
      p.code,
      username ? { id: tg, username } : { id: tg },
      true,
      clock.now(),
    );
  };
  return { store, transport, clock, confirmPending };
}
