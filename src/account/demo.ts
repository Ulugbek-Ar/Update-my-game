/**
 * Dev rejimi (faqat `bun run dev`): serversiz akkaunt — skrinshotlar (screenshots/v3.2.0.json) va
 * qo'lda ko'rish uchun. Haqiqiy serverga hech narsa yuborilmaydi: transport soxta javob beradi.
 *
 *   await window.__accountDemo()                 // kirgan o'yinchi, do'stlar, reyting
 *   await window.__accountDemo({ pending: true }) // "Tasdiq kutilmoqda" (bot havolasi va QR)
 *   await window.__accountDemo({ guild: false })  // gildiyasiz (qidirish, tuzish, gerb muharriri)
 */
import { account } from "./account";
import { setTransport, type Transport } from "./api";
import { cloud } from "./cloud";
import { friends } from "./friends";
import { nextWeekStart, weekKey } from "./scoring";
import type {
  BackupInfo,
  FriendInfo,
  GuildCard,
  GuildChatMsg,
  GuildInfo,
  GuildLogEntry,
  GuildMember,
  GuildQuest,
  GuildState,
  Me,
  ScoreRow,
} from "./protocol";
import type { GuildRole } from "./guildRules";
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

const PQ = { tag: "PQ", emblem: "0-0-3-1" };
/** O'tgan hafta g'olibi (vodiydagi bayroq) */
const CHAMP = {
  name: "Qal'a Qo'riqchilari",
  tag: "PQ",
  emblem: PQ.emblem,
  xp: 4200,
  week: "2026-10-26",
};

const FRIENDS = () => ({
  friends: [
    { ...friend(2, "Dilnoza", "mage", 14, "realm", "K7QW2M"), guild: PQ },
    friend(3, "Sardor_07", "gunner", 9, "world"),
    { ...friend(4, "Malika", "hunter", 22, "menu"), guild: PQ },
    friend(5, "Bekzod", "knight", 6, null, null, Date.now() - 2 * H),
    {
      ...friend(6, "Shahzoda", "paladin", 31, null, null, Date.now() - 26 * H),
      guild: { tag: "TB", emblem: "2-5-6-11" },
    },
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
  const tags = [
    PQ,
    null,
    { tag: "TB", emblem: "2-5-6-11" },
    PQ,
    null,
    { tag: "OQ", emblem: "1-1-6-3" },
  ];
  return names.map(([nick, avatar, level], i) => {
    const guild = nick === "Ulugbek" ? PQ : tags[i % tags.length];
    return {
      rank: i + 1,
      id: nick === "Ulugbek" ? 1 : 100 + i,
      nick,
      avatar,
      level,
      score: ash ? 1620 + i * 115 : board === "endless" ? 48_200 - i * 3100 : 4380 - i * 190,
      hero: heroBoard ?? avatar,
      ...(ash ? { team: [nick, names[(i + 3) % names.length]![0]] } : {}),
      ...(guild ? { guild } : {}),
    };
  });
}

// ---------------- gildiya (screenshots/v3.3.0.json) ----------------

const member = (
  id: number,
  nick: string,
  avatar: Hero,
  level: number,
  role: GuildRole,
  online: boolean,
  given: number,
  seenH = 0,
): GuildMember => ({
  id,
  nick,
  avatar,
  level,
  role,
  joined: Date.now() - (30 - id) * 24 * H,
  online,
  seen: Date.now() - seenH * H,
  given,
  muted: 0,
});

function demoGuild(): GuildInfo {
  return {
    id: 7,
    name: "Qal'a Qo'riqchilari",
    tag: "PQ",
    emblem: PQ.emblem,
    level: 6,
    members: 14,
    cap: 25,
    mode: "apply",
    lang: "uz",
    active: 11,
    online: 5,
    xp: 9800,
    treasury: 7420,
    created: Date.now() - 21 * 24 * H,
    leader: "Ulugbek",
  };
}

const MEMBERS = () => [
  member(1, "Ulugbek", "paladin", 20, "leader", true, 1650),
  member(2, "Dilnoza", "mage", 14, "officer", true, 1210),
  member(4, "Malika", "hunter", 22, "officer", true, 980),
  member(9, "Temur_99", "knight", 27, "officer", false, 760, 3),
  member(3, "Sardor_07", "gunner", 9, "member", true, 640),
  member(10, "Aziza", "gunner", 18, "member", true, 520),
  member(11, "Jamshid", "knight", 11, "member", false, 410, 5),
  member(12, "Nodira", "hunter", 16, "member", false, 380, 20),
  member(13, "Kamola", "mage", 13, "member", false, 300, 26),
  member(14, "Rustam", "paladin", 8, "member", false, 210, 30),
  member(5, "Bekzod", "knight", 6, "member", false, 150, 2),
  member(7, "Jasur_uz", "paladin", 5, "member", false, 90, 49),
  member(15, "Laziz", "mage", 4, "member", false, 70, 70),
  member(16, "Gulnora", "hunter", 7, "member", false, 50, 96),
];

function demoState(inGuild: boolean): GuildState {
  if (!inGuild)
    return {
      guild: null,
      cooldown: 0,
      invites: [{ guild: SEARCH()[1]!, by: "Shahzoda", at: Date.now() - 3 * H }],
      applications: [],
    };
  return {
    guild: demoGuild(),
    role: "leader",
    members: MEMBERS(),
    requests: [
      { id: 20, nick: "Laylo", avatar: "mage", level: 7, kind: "apply", at: Date.now() - H },
      {
        id: 21,
        nick: "Doniyor",
        avatar: "knight",
        level: 4,
        kind: "apply",
        at: Date.now() - 5 * H,
      },
      {
        id: 22,
        nick: "Farrux",
        avatar: "gunner",
        level: 12,
        kind: "invite",
        at: Date.now() - 9 * H,
        by: "Dilnoza",
      },
    ],
    quests: QUESTS(),
    week: weekKey(Date.now()),
    resets: nextWeekStart(Date.now()),
    given: 40,
    giveCap: 100,
    rewards: [],
    chat: CHAT().length,
    muted: 0,
  };
}

const contrib = (pairs: [number, string, number][]) =>
  pairs.map(([id, nick, amount]) => ({ id, nick, amount }));

const QUESTS = (): GuildQuest[] => [
  {
    slot: 0,
    kind: "kills",
    target: 3000,
    progress: 2140,
    done: 0,
    gold: 25,
    gxp: 400,
    top: contrib([
      [1, "Ulugbek", 620],
      [4, "Malika", 480],
      [2, "Dilnoza", 410],
      [10, "Aziza", 300],
      [3, "Sardor_07", 210],
      [11, "Jamshid", 120],
    ]),
  },
  {
    slot: 1,
    kind: "gold",
    target: 1200,
    progress: 1200,
    done: Date.now() - 20 * H,
    gold: 20,
    gxp: 300,
    top: contrib([
      [1, "Ulugbek", 400],
      [2, "Dilnoza", 300],
      [4, "Malika", 250],
      [9, "Temur_99", 150],
      [10, "Aziza", 100],
    ]),
  },
  {
    slot: 2,
    kind: "ashking",
    target: 5,
    progress: 3,
    done: 0,
    gold: 50,
    gxp: 800,
    top: contrib([
      [1, "Ulugbek", 3],
      [2, "Dilnoza", 2],
      [9, "Temur_99", 2],
      [4, "Malika", 1],
    ]),
  },
];

const CHAT = (): GuildChatMsg[] => {
  const t = Date.now();
  const m = (
    id: number,
    from: number,
    nick: string,
    role: GuildRole | null,
    text: string,
    phrase: number,
    ago: number,
  ): GuildChatMsg => ({ id, from, nick, role, text, phrase, at: t - ago * 60_000 });
  return [
    m(1, 2, "Dilnoza", "officer", "", 0, 95),
    m(2, 3, "Sardor_07", "member", "Bugun kechqurun Kul qiroliga boramizmi?", -1, 80),
    m(3, 1, "Ulugbek", "leader", "Ha, 21:00 da zalda yig'ilamiz. Tank — Temur", -1, 78),
    m(4, 9, "Temur_99", "officer", "", 2, 60),
    m(5, 4, "Malika", "officer", "Xazinaga 50 tashladim, oltin topshiriq bajarildi!", -1, 41),
    m(6, 10, "Aziza", "member", "", 8, 39),
    m(7, 11, "Jamshid", "member", "Kim menga Kul tog'idagi plitalarda yordam beradi?", -1, 12),
    m(8, 2, "Dilnoza", "officer", "Men boraman, olamda K7QW2M xonasidaman", -1, 9),
    m(9, 3, "Sardor_07", "member", "", 1, 2),
  ];
};

const LOG = (): GuildLogEntry[] => {
  const t = Date.now();
  const e = (
    id: number,
    kind: string,
    nick: string,
    amount: number,
    hours: number,
    other = "",
  ): GuildLogEntry => ({ id, kind, nick, other, amount, at: t - hours * H });
  return [
    e(20, "give", "Malika", 50, 0.7),
    e(19, "quest:gold", "", 300, 20, "1200"),
    e(18, "give", "Ulugbek", 100, 21),
    e(17, "give", "Dilnoza", 60, 23),
    e(16, "join", "Gulnora", 0, 26, "Dilnoza"),
    e(15, "promote", "Temur_99", 0, 30, "Ulugbek"),
    e(14, "give", "Aziza", 25, 31),
    e(13, "quest:kills", "", 400, 50, "3000"),
    e(12, "give", "Temur_99", 80, 52),
  ];
};

function card(
  id: number,
  name: string,
  tag: string,
  emblem: string,
  level: number,
  members: number,
  lang: GuildCard["lang"],
  mode: GuildCard["mode"],
  active: number,
  online: number,
): GuildCard {
  const cap = level >= 8 ? 30 : level >= 5 ? 25 : 20;
  return { id, name, tag, emblem, level, members, cap, lang, mode, active, online };
}

const SEARCH = (): GuildCard[] => [
  card(7, "Qal'a Qo'riqchilari", "PQ", PQ.emblem, 6, 14, "uz", "apply", 11, 5),
  card(3, "Tungi Bo'rilar", "TB", "2-5-6-11", 8, 27, "uz", "open", 19, 7),
  card(11, "Oq Yulduz", "OQ", "1-1-6-3", 4, 12, "uz", "open", 8, 2),
  card(15, "Kul Ovchilari", "KUL", "0-5-7-7", 5, 18, "ru", "apply", 10, 3),
  card(21, "Ajdar Qanoti", "AQ", "2-2-3-2", 3, 9, "uz", "invite", 6, 1),
  card(24, "Samarqand Sherlari", "SS", "1-7-5-1", 2, 6, "uz", "open", 4, 0),
];

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

/** Soxta server: kirish, saqlanish, profil, do'stlar, reyting, gildiya */
function transport(pending: boolean, inGuild: boolean): Transport {
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
        return {
          ok: true,
          messages: [],
          requests: 1,
          guild: inGuild
            ? {
                guild: { id: 7, name: "Qal'a Qo'riqchilari", ...PQ, level: 6, role: "leader" },
                pending: 2,
                champ: CHAMP,
              }
            : { guild: null, pending: 1, champ: CHAMP },
        };
      case "guild/get":
        return { ok: true, ...demoState(inGuild) };
      case "guild/search":
        return { ok: true, guilds: SEARCH() };
      case "guild/info":
        return { ok: true, guild: demoGuild(), members: MEMBERS() };
      case "guild/top": {
        const b = String(body["board"] ?? "xp");
        const week = body["period"] !== "all";
        const rows = SEARCH()
          .map((g, i) => ({
            rank: i + 1,
            id: g.id,
            name: g.name,
            tag: g.tag,
            emblem: g.emblem,
            level: g.level,
            members: g.members,
            score:
              b === "ashking"
                ? 1980 + i * 140
                : b === "quests"
                  ? Math.max(0, (week ? 3 : 14) - i * (week ? 0.5 : 2)) | 0
                  : (week ? 4200 : 31_000) - i * (week ? 520 : 3900),
          }))
          .filter((r) => r.score > 0)
          .sort((x, y) => (b === "ashking" ? x.score - y.score : y.score - x.score))
          .map((r, i) => ({ ...r, rank: i + 1 }));
        return {
          ok: true,
          rows,
          me: rows.find((r) => r.tag === "PQ") ?? null,
          week: weekKey(now),
          resets: nextWeekStart(now),
          champ: CHAMP,
          territories: [
            { id: "valley", name: "BOSHLANG'ICH VODIY", controlledBy: null, since: 0 },
            { id: "ashmount", name: "KUL TOG'I", controlledBy: null, since: 0 },
          ],
        };
      }
      case "guild/create":
        return { ok: true, guild: { ...demoGuild(), level: 1, members: 1, xp: 0 }, cost: 500 };
      case "guild/give":
        return { ok: true, given: 40 + Number(body["amount"] ?? 0), cap: 100, treasury: 7470 };
      case "guild/log":
        return { ok: true, entries: LOG() };
      case "guild/chat":
        return { ok: true, messages: CHAT(), rev: 0, full: true, muted: 0 };
      case "guild/say":
        return {
          ok: true,
          message: {
            id: 10,
            from: 1,
            nick: "Ulugbek",
            role: "leader",
            text: String(body["text"] ?? ""),
            phrase: typeof body["phrase"] === "number" ? body["phrase"] : -1,
            at: now,
          },
        };
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

export async function startAccountDemo(opts: { pending?: boolean; guild?: boolean } = {}) {
  setTransport(transport(!!opts.pending, opts.guild !== false), async () => ({
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
