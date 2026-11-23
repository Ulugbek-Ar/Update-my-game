// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { setTransport } from "./api";
import { AccountManager } from "./account";
import { REF_KEY } from "./keys";
import { captureRef, clearRef, refBotLink, refField, refShareLink, refSiteLink } from "./referral";
import { MemoryStorage, testServer } from "./server/testing";
import { SITE_URL } from "@/realm/net/config";
import { isProgressKey } from "@/game/transfer";

const g = globalThis as { localStorage?: Storage };

describe("do'st chaqirish (klient)", () => {
  afterEach(() => setTransport(null));

  it("havoladagi kod saqlanadi (birinchisi qoladi), noto'g'risi e'tiborsiz", () => {
    g.localStorage = new MemoryStorage();
    expect(captureRef("?ref=k7qw-2mxa")).toBe("K7QW2MXA");
    expect(refField()).toEqual({ ref: "K7QW2MXA" });
    captureRef("?ref=ABCDEFGH");
    expect(refField()).toEqual({ ref: "K7QW2MXA" });
    clearRef();
    expect(captureRef("?ref=0O1I")).toBeNull();
    expect(refField()).toEqual({});
  });

  it("havolalar: sayt ?ref=KOD, bot start=ref_KOD, Telegram ulashish", () => {
    expect(refSiteLink("K7QW2MXA")).toBe(`${SITE_URL}?ref=K7QW2MXA`);
    expect(refBotLink("K7QW2MXA", "PikselQalaBot")).toBe(
      "https://t.me/PikselQalaBot?start=ref_K7QW2MXA",
    );
    expect(refBotLink("K7QW2MXA", null)).toBeNull();
    const share = new URL(refShareLink("https://t.me/B?start=ref_K7QW2MXA"));
    expect(share.origin + share.pathname).toBe("https://t.me/share/url");
    expect(share.searchParams.get("url")).toBe("https://t.me/B?start=ref_K7QW2MXA");
  });

  it("taklif kodi qurilmaga xos: bulut va ko'chirish kodiga kirmaydi", () => {
    expect(isProgressKey(REF_KEY)).toBe(false);
  });

  it("yangi akkaunt ochilganda kod serverga boradi va o'chiriladi", async () => {
    const srv = testServer();
    setTransport(srv.transport);
    const a = srv.store.ensurePlayer({ id: 1 }, Date.now()).player;
    g.localStorage = new MemoryStorage();
    captureRef(`?ref=${a.code}`);
    const acc = new AccountManager();
    await acc.startBotLogin(false);
    srv.confirmPending(2, "Yangi");
    await acc.pollNow();
    expect(acc.state.me?.nick).toBe("Yangi");
    expect(localStorage.getItem(REF_KEY)).toBeNull();
    expect(srv.store.referrals.info(a, null, Date.now()).joined).toBe(1);
  });
});
