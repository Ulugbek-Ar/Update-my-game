/**
 * Dev rejimi (`bun run dev`): serversiz onlayn sinov — sahifa ichidagi xona (Loopback) va botlar.
 * Lokal sinov va Telegram post skrinshotlari uchun (screenshots/v2.7.0.json):
 *   await window.__realmDemo([{ hero: "mage", tag: "1357", say: 0 }])
 *   await window.__realmDemo([{ hero: "mage", tag: "1", nick: "Dilnoza", level: 14,
 *     guild: { tag: "PQ", emblem: "0-0-3-1" } }])   // taxallus, daraja va gildiya tegi
 * Prod build'ga kirmaydi (index.tsx uni faqat import.meta.env.DEV da yuklaydi).
 */
import type { Hero } from "@/game/hero";
import type { RealmClient } from "../client";
import { TICK_DT } from "../sim";
import { Loopback } from "./loopback";
import { NetSession } from "./session";
import { NET_VERSION, type NetIdent } from "./protocol";
import { account } from "@/account/account";
import { cachedGuild } from "@/account/guild";

export interface DemoBot {
  hero: Hero;
  /** mehmon raqami (4 xona) */
  tag: string;
  /** shu ibora bilan salomlashadi (PHRASES indeksi) */
  say?: number;
  /** atrofda yurib turadi */
  walk?: boolean;
  /** kirgan o'yinchi: taxallus, daraja va gildiya (teg, gerb) — ism yonida ko'rinadi */
  nick?: string;
  level?: number;
  guild?: { tag: string; emblem: string };
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function startDemo(
  client: RealmClient,
  bots: DemoBot[] = [
    { hero: "mage", tag: "1357", say: 0 },
    { hero: "hunter", tag: "2468", walk: true },
  ],
) {
  const lb = new Loopback();
  // akkaunt: o'zi (demo akkaunt — __accountDemo) va taxallusli botlar
  const idents = new Map<string, NetIdent>();
  const me = account.state.me;
  const token = account.sessionToken;
  const g = cachedGuild();
  if (me && token)
    idents.set(token, {
      id: me.id,
      nick: me.nick,
      level: me.level,
      ...(g ? { guild: { id: g.id, tag: g.tag, emblem: g.emblem } } : {}),
    });
  bots.forEach((b, i) => {
    if (b.nick)
      idents.set(`demo-bot-token-${i}-`.padEnd(32, "x"), {
        id: 100 + i,
        nick: b.nick,
        level: b.level ?? 1,
        ...(b.guild ? { guild: { id: 7, ...b.guild } } : {}),
      });
  });
  lb.identify = (t) => idents.get(t) ?? null;
  setInterval(() => lb.step(), TICK_DT * 1000);
  client.connect(lb.deps(), null);
  for (let i = 0; i < 50 && !client.online; i++) await wait(50);
  for (const [i, bot] of bots.entries()) {
    const net = new NetSession(lb.deps(), {
      code: client.net?.code ?? null,
      hello: (near) => ({
        t: "hello",
        v: NET_VERSION,
        tag: bot.tag,
        hero: bot.hero,
        save: null,
        keys: [],
        near,
        ...(bot.nick ? { acct: `demo-bot-token-${i}-`.padEnd(32, "x") } : {}),
      }),
    });
    net.start();
    for (let i = 0; i < 50 && net.status !== "online"; i++) await wait(20);
    let s = 0;
    if (bot.say !== undefined) setTimeout(() => net.chat(bot.say!), 400);
    if (bot.walk) {
      const dirs = [
        [1, 0],
        [0, 0],
        [-1, 0],
        [0, 0],
      ] as const;
      setInterval(() => {
        const [x, y] = dirs[++s % dirs.length]!;
        net.sendCmds(s * 10, [{ type: "move", x, y }]);
      }, 700);
    }
  }
  return lb;
}
