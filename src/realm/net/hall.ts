/**
 * Gildiya zali xonasi (server mantig'i): har gildiyaning o'z xonasi — Cloudflare'da alohida
 * Durable Object (server/src/hall-do.ts), bo'sh bo'lsa uxlaydi. Oddiy olam xonasidan farqi:
 *  - kirish faqat shu gildiya a'zolariga (akkauntlar DO'si tasdiqlagan gildiya raqami);
 *  - hamma eshik oldida paydo bo'ladi (olamdagi joyi o'zgarmaydi — u zalda saqlanmaydi);
 *  - buyum ishlatish va savdo yo'q; mashq qo'g'irchog'i bor (zarar sinash);
 *  - welcome'da zal bezagi: gildiya nomi, gerb, daraja va trofeylar.
 * Platformadan mustaqil — testlar Node'da.
 */
import { loadHallData } from "../data";
import { tileCenter, type RealmCommand, type RealmPlayerSave } from "../sim";
import { RealmRoom, type RoomOptions } from "./room";
import {
  hallCode,
  type ErrReason,
  type HallInfo,
  type HelloMsg,
  type NetIdent,
  type ServerMsg,
} from "./protocol";

/** Zal sig'imi: gildiyaning eng ko'p a'zolari (10-darajada 30) */
export const HALL_CAP = 30;

export class HallRoom extends RealmRoom {
  /** zal bezagi (server akkauntlar DO'sidan oladi) */
  info: HallInfo | null = null;
  override cap = HALL_CAP;

  constructor(
    readonly guild: number,
    opts: RoomOptions = {},
  ) {
    super(hallCode(guild), { ...opts, data: opts.data ?? loadHallData() });
  }

  /** Bezak o'zgardi (daraja, gerb, trofey): zaldagilarga darhol */
  setInfo(info: HallInfo | null) {
    const changed = JSON.stringify(info) !== JSON.stringify(this.info);
    this.info = info;
    if (changed && info && this.size) this.broadcastMsg({ t: "hall", hall: info });
  }

  protected override admit(_hello: HelloMsg, ident: NetIdent | null): ErrReason | null {
    return ident?.guild?.id === this.guild ? null : "member";
  }

  protected override entry(save: RealmPlayerSave | null): RealmPlayerSave | null {
    if (!save) return null;
    const [sx, sy] = this.sim.region.spawn;
    return { ...save, x: tileCenter(sx), y: tileCenter(sy) };
  }

  protected override welcomeExtra(): Partial<Extract<ServerMsg, { t: "welcome" }>> {
    return this.info ? { hall: this.info } : {};
  }

  protected override allowCmd(c: RealmCommand): boolean {
    return c.type !== "use" && c.type !== "buy" && c.type !== "sell";
  }
}
