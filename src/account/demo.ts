/**
 * Dev rejimi (faqat `bun run dev`): serversiz akkaunt — skrinshotlar (screenshots/v3.2.0.json) va
 * qo'lda ko'rish uchun. Haqiqiy serverga hech narsa yuborilmaydi: transport soxta javob beradi.
 *
 *   await window.__accountDemo()                 // kirgan o'yinchi, do'stlar, reyting
 *   await window.__accountDemo({ pending: true }) // "Tasdiq kutilmoqda" (bot havolasi va QR)
 */
import { account } from "./account";
import { setTransport, type Transport } from "./api";
import { cloud } from "./cloud";
import { friends } from "./friends";
import { nextWeekStart, weekKey } from "./scoring";
import type { BackupInfo, FriendInfo, Me, ScoreRow } from "./protocol";
import { XP_KEY, levelOf, xpFromRaw } from "./xp";
import type { Hero } from "@/game/hero";

const H = 3600_000;

function me(): Me {
  let xp = 0;
  try {
    xp = xpFromRaw(localStorage.getItem(XP_KEY));
  } catch {
    /* yo'q */
  }
  return {
    id: 1,
    nick: "Ulugbek",
    avatar: "paladin",
    xp,
    level: levelOf(xp),
    code: "K7QW2MXA",
    created: Date.now() - 40 * 24 * H,
    tg: 1,
  };
}

const friend = (
  id: number,
  nick: string,
  avatar: Hero,
  level: number,
  place: FriendInfo["place"],
  room: string | null = null,
  seen = Date.now(),
): FriendInfo => ({ id, nick, avatar, level, online: !!place, place, room, seen });

const FRIENDS = () => ({
  friends: [
    friend(2, "Dilnoza", "mage", 14, "realm", "K7QW2M"),
    friend(3, "Sardor_07", "gunner", 9, "world"),
    friend(4, "Malika", "hunter", 22, "menu"),
    friend(5, "Bekzod", "knight", 6, null, null, Date.now() - 2 * H),
    friend(6, "Shahzoda", "paladin", 31, null, null, Date.now() - 26 * H),
  ],
  incoming: [friend(7, "Jasur_uz", "paladin", 5, "menu")],
  outgoing: [friend(8, "Otabek", "mage", 12, null)],
  blocked: [],
});

function top(board: string): ScoreRow[] {
  const names: [string, Hero, number][] = [
    ["Shahzoda", "paladin", 31],
    ["Malika", "hunter", 22],
    ["Temur_99", "knight", 27],
    ["Dilnoza", "mage", 14],
    ["Aziza", "gunner", 18],
    ["Jamshid", "knight", 11],
    ["Ulugbek", "paladin", 20],
    ["Sardor_07", "gunner", 9],
    ["Nodira", "hunter", 16],
    ["Bekzod", "knight", 6],
    ["Kamola", "mage", 13],
    ["Rustam", "paladin", 8],
  ];
  const ash = board === "ashking";
  const heroBoard = board.startsWith("w1:") ? (board.slice(3) as Hero) : null;
  return names.map(([nick, avatar, level], i) => ({
    rank: i + 1,
    id: nick === "Ulugbek" ? 1 : 100 + i,
    nick,
    avatar,
    level,
    score: ash ? 1620 + i * 115 : board === "endless" ? 48_200 - i * 3100 : 4380 - i * 190,
    hero: heroBoard ?? avatar,
    ...(ash ? { team: [nick, names[(i + 3) % names.length]![0]] } : {}),
  }));
}

function backups(): BackupInfo[] {
  const now = Date.now();
  return [
    {
      slot: 0,
      version: 41,
      time: now - 2 * H,
      at: now - 2 * H,
      device: "android",
      reason: "device",
      data: { "pixel-rpg-gold": "512" },
    },
    {
      slot: 1,
      version: 37,
      time: now - 9 * H,
      at: now - 9 * H,
      device: "web",
      reason: "time",
      data: { "pixel-rpg-gold": "430" },
    },
  ];
}

/** Soxta server: kirish, saqlanish, profil, do'stlar, reyting */
function transport(pending: boolean): Transport {
  return async (op, raw) => {
    const body = (raw ?? {}) as Record<string, unknown>;
    const now = Date.now();
    switch (op) {
      case "auth/bot":
        return {
          ok: true,
          code: "Dem0Kod12345",
          secret: "d".repeat(32),
          link: "https://t.me/PikselQalaBot?start=login_Dem0Kod12345",
          expires: now + 5 * 60_000,
        };
      case "auth/poll":
        return pending
          ? { ok: true, status: "wait" }
          : { ok: true, status: "done", token: "demo".repeat(10), me: me(), created: false };
      case "me":
        return { ok: true, me: me() };
      case "profile":
        return { ok: true, me: { ...me(), ...body, token: undefined } };
      case "save/get":
        return { ok: true, save: null };
      case "save/put":
        return { ok: true, version: 42 };
      case "save/backups":
        return { ok: true, backups: backups() };
      case "friends/list":
        return { ok: true, ...FRIENDS() };
      case "presence":
        return { ok: true, messages: [], requests: 1 };
      case "scores/top": {
        const board = String(body["board"] ?? "w1:knight");
        const rows = top(board);
        const mine = rows.find((r) => r.nick === "Ulugbek")!;
        return {
          ok: true,
          rows,
          me: { ...mine, hidden: false },
          week: weekKey(now),
          resets: nextWeekStart(now),
        };
      }
      default:
        return { ok: true };
    }
  };
}

export async function startAccountDemo(opts: { pending?: boolean } = {}) {
  setTransport(transport(!!opts.pending), async () => ({
    ok: true,
    bot: "PikselQalaBot",
    botId: 1,
  }));
  if (account.loggedIn) return;
  await account.startBotLogin(false);
  if (opts.pending) return;
  await account.pollNow();
  if (cloud.view.decision) await cloud.resolve("local");
  account.takeNotice();
  await friends.beat();
}
