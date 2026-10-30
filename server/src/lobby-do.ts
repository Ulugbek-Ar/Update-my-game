/**
 * Lobbi Durable Object (bitta nusxa, nomi "lobby"): xona tanlash, xonalar hisoboti va /health.
 * Mantiq — src/realm/net/lobby.ts (Node'da sinaladi), bu yerda faqat saqlash va RPC.
 */
import { DurableObject } from "cloudflare:workers";
import { Lobby, type LobbyState } from "../../src/realm/net/lobby";
import type { JoinReply } from "../../src/realm/net/protocol";
import type { Env } from "./index";

export class LobbyDO extends DurableObject<Env> {
  private lobby = new Lobby();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    void ctx.blockConcurrencyWhile(async () => {
      this.lobby.load(await ctx.storage.get<LobbyState>("state"));
    });
  }

  private persist() {
    void this.ctx.storage.put("state", this.lobby.save());
  }

  /** /join: kod bilan yoki avtomatik xona */
  join(code: string | null): JoinReply {
    const r = this.lobby.assign(Date.now(), code);
    this.persist();
    return r;
  }

  /** Xona hisoboti (o'yinchi kirdi/chiqdi va har daqiqada) */
  report(code: string, n: number, used: number, secs = 0): { busy: boolean } {
    const r = this.lobby.report(Date.now(), code, n, used, secs);
    this.persist();
    return r;
  }

  /** /health */
  health() {
    // Worker so'rovi + shu chaqiruv
    this.lobby.count(Date.now(), 2);
    return this.lobby.stats(Date.now());
  }
}
