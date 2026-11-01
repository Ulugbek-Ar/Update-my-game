/**
 * Bot webhook'i (Telegram -> server): ilova va kompyuterda "Telegram bilan kirish".
 *
 *   o'yin: /acc/auth/bot -> kod -> t.me/<bot>?start=login_<kod> ochiladi
 *   bot:   /start login_<kod> -> "Tasdiqlash" tugmasi -> callback ok:<kod> -> kod tasdiqlanadi
 *   o'yin: /acc/auth/poll (kod + secret) -> sessiya
 *
 * Bu modul tarmoqqa chiqmaydi: Telegram'ga yuboriladigan chaqiruvlar ro'yxatini qaytaradi
 * (AccountDO ularni bajaradi) — Node'da sinaladi.
 */
import { DEVICE_NAME, LOGIN_CODE_RE } from "../protocol";
import type { AccountStore } from "./store";

export interface TgCall {
  method: "sendMessage" | "answerCallbackQuery" | "editMessageText";
  body: Record<string, unknown>;
}

interface TgFrom {
  id: number;
  username?: string;
  is_bot?: boolean;
}

const obj = (v: unknown) =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : ({} as Record<string, unknown>);

function from(v: unknown): TgFrom | null {
  const f = obj(v);
  const id = Number(f["id"]);
  if (!Number.isSafeInteger(id) || id <= 0 || f["is_bot"] === true) return null;
  return typeof f["username"] === "string" ? { id, username: f["username"] } : { id };
}

export const BOT_TEXT = {
  welcome: (site: string) =>
    `🏰 Piksel Qal'a — retro piksel RPG.\n\nO'ynash: ${site}\n\nIlova yoki kompyuterda «Telegram bilan kirish» bosilsa, shu yerda tasdiqlash tugmasi chiqadi.`,
  ask: (device: string) =>
    `🏰 Piksel Qal'a — kirish so'rovi\n\nQurilma: ${device}\n\nTasdiqlasangiz, o'yin shu Telegram akkauntingiz bilan kiradi. Progressingiz bulutda saqlanadi.\n\n⚠️ So'rovni o'zingiz yubormagan bo'lsangiz — tugmani bosmang.`,
  expired:
    "⌛ Bu kirish havolasi eskirgan yoki ishlatilgan. O'yinda «Telegram bilan kirish» ni qayta bosing.",
  done: "✅ Tasdiqlandi! O'yinga qayting — u o'zi kiradi.",
  cancelled: "Bekor qilindi. Kirish so'rovi rad etildi.",
  stale: "Havola eskirgan",
};

/** Bitta Telegram update. now — ms, site — o'yin sayti (salomlashuv xabari uchun). */
export function botUpdate(store: AccountStore, update: unknown, now: number, site: string) {
  const calls: TgCall[] = [];
  const u = obj(update);
  const msg = obj(u["message"]);
  const cb = obj(u["callback_query"]);

  if (u["message"]) {
    const chat = obj(msg["chat"]);
    const user = from(msg["from"]);
    const text = typeof msg["text"] === "string" ? msg["text"].trim() : "";
    // faqat shaxsiy chat (guruh va kanallarda bot jim)
    if (chat["type"] !== "private" || !user || !text.startsWith("/start")) return calls;
    const chatId = Number(chat["id"]);
    const m = /^\/start(?:@\w+)?\s+login_([A-Za-z0-9]+)$/.exec(text);
    if (!m) {
      calls.push({
        method: "sendMessage",
        body: { chat_id: chatId, text: BOT_TEXT.welcome(site) },
      });
      return calls;
    }
    const code = m[1]!;
    const info = LOGIN_CODE_RE.test(code) ? store.botLoginInfo(code, now) : null;
    if (!info) {
      calls.push({ method: "sendMessage", body: { chat_id: chatId, text: BOT_TEXT.expired } });
      return calls;
    }
    calls.push({
      method: "sendMessage",
      body: {
        chat_id: chatId,
        text: BOT_TEXT.ask(DEVICE_NAME[info.device]),
        reply_markup: {
          inline_keyboard: [
            [{ text: "✅ Tasdiqlash", callback_data: `ok:${code}` }],
            [{ text: "Bekor qilish", callback_data: `no:${code}` }],
          ],
        },
      },
    });
    return calls;
  }

  if (u["callback_query"]) {
    const user = from(cb["from"]);
    const id = cb["id"];
    const data = typeof cb["data"] === "string" ? cb["data"] : "";
    const m = /^(ok|no):([A-Za-z0-9]{12})$/.exec(data);
    if (!user || typeof id !== "string" || !m) return calls;
    const accept = m[1] === "ok";
    const done = store.botConfirm(m[2]!, user, accept, now);
    const message = obj(cb["message"]);
    const chatId = Number(obj(message["chat"])["id"]);
    const messageId = Number(message["message_id"]);
    calls.push({
      method: "answerCallbackQuery",
      body: {
        callback_query_id: id,
        text: done ? (accept ? "Tasdiqlandi" : "Bekor qilindi") : BOT_TEXT.stale,
      },
    });
    if (Number.isFinite(chatId) && Number.isFinite(messageId))
      calls.push({
        method: "editMessageText",
        body: {
          chat_id: chatId,
          message_id: messageId,
          text: done ? (accept ? BOT_TEXT.done : BOT_TEXT.cancelled) : BOT_TEXT.expired,
        },
      });
  }
  return calls;
}
