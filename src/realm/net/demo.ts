/**
 * Dev rejimi (`bun run dev`): serversiz onlayn sinov — sahifa ichidagi xona (Loopback) va botlar.
 * Lokal sinov va Telegram post skrinshotlari uchun (screenshots/v2.7.0.json):
 *   await window.__realmDemo([{ hero: "mage", tag: "1357", say: 0 }])
 * Prod build'ga kirmaydi (index.tsx uni faqat import.meta.env.DEV da yuklaydi).
 */
import type { Hero } from "@/game/hero";
import type { RealmClient } from "../client";
import { TICK_DT } from "../sim";
import { Loopback } from "./loopback";
import { NetSession } from "./session";
import { NET_VERSION } from "./protocol";

export interface DemoBot {
  hero: Hero;
  /** mehmon raqami (4 xona) */
  tag: string;
  /** shu ibora bilan salomlashadi (PHRASES indeksi) */
  say?: number;
  /** atrofda yurib turadi */
  walk?: boolean;
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
  setInterval(() => lb.step(), TICK_DT * 1000);
  client.connect(lb.deps(), null);
  for (let i = 0; i < 50 && !client.online; i++) await wait(50);
  for (const bot of bots) {
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
