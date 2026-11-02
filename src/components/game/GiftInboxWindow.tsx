/**
 * SOVG'A QUTISI — "Sovg'a keldi!" oynasi: kimdan (MUALLIF belgisi bilan), nima, xat va "OLISH".
 * Olinganda: oltin — tanga yomg'iri, qahramon — nur ichida paydo bo'ladi. Bir nechta sovg'a
 * bo'lsa — navbatma-navbat.
 */
import { useEffect, useState } from "react";
import { adminErrorText } from "@/account/admin";
import { giftBox, useGiftBox } from "@/account/giftbox";
import type { GiftInfo } from "@/account/protocol";
import { HERO_LIST, HERO_THEME } from "@/game/hero";
import { sfx } from "@/game/audio";
import { AuthorBadge, CoinRain, HeroAvatar, Icon, PixelWindow } from "./pixel";
import { btn, when } from "./pixelUi";

function GiftCard({ g }: { g: GiftInfo }) {
  const hero = g.hero ? HERO_LIST.find((h) => h.id === g.hero) : null;
  return (
    <div className="flex flex-col gap-2">
      <p className="inline-flex flex-wrap items-center gap-2 text-foreground">
        Kimdan: <HeroAvatar hero={g.from.avatar} size={24} />
        <span className="text-primary">{g.from.nick}</span>
        {g.from.author && <AuthorBadge />}
        <span className="text-muted-foreground">· {when(g.at)}</span>
      </p>
      <ul className="flex flex-wrap gap-2">
        {g.gold > 0 && (
          <li className="inline-flex items-center gap-1 border-2 border-primary px-2 py-1 text-primary">
            <Icon id="coin" color="#ffcc33" size={14} />
            {g.gold} oltin
          </li>
        )}
        {g.xp > 0 && (
          <li className="inline-flex items-center gap-1 border-2 border-[#9fd0ef] px-2 py-1 text-[#9fd0ef]">
            +{g.xp} XP
          </li>
        )}
        {hero && (
          <li
            className="inline-flex items-center gap-1 border-2 px-2 py-1"
            style={{ borderColor: hero.theme.accent, color: hero.theme.uiText }}
          >
            <HeroAvatar hero={hero.id} size={20} />
            Qahramon: {hero.name}
          </li>
        )}
      </ul>
      {g.note && (
        <blockquote className="border-l-4 border-primary bg-background/60 px-3 py-2 text-foreground">
          "{g.note}"
        </blockquote>
      )}
    </div>
  );
}

export function GiftInboxWindow({
  onClose,
  onClaimed,
}: {
  onClose: () => void;
  /** progress o'zgardi (oltin, XP, qahramon) — menyu qayta o'qisin */
  onClaimed: (g: GiftInfo) => void;
}) {
  const box = useGiftBox();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [got, setGot] = useState<GiftInfo | null>(null);
  useEffect(() => {
    void giftBox.load();
  }, []);
  const list = box.gifts;
  const g = list?.[0] ?? null;
  const take = async (gift: GiftInfo) => {
    sfx.unlock();
    setBusy(true);
    setErr(null);
    const r = await giftBox.claim(gift.id);
    setBusy(false);
    if (!r.ok)
      return setErr(
        r.error === "none" ? "Bu sovg'a allaqachon olingan" : adminErrorText({ error: r.error }),
      );
    sfx.upgrade();
    setGot(r.gift);
    onClaimed(r.gift);
  };
  const hero = got?.hero ? HERO_LIST.find((h) => h.id === got.hero) : null;
  return (
    <PixelWindow
      label="Sovg'a qutisi"
      accent
      title={
        <span className="inline-flex items-center gap-2">
          <Icon id="gift" color="#ffcc33" size={16} />
          {got ? "SOVG'A OLINDI!" : g ? "SOVG'A KELDI!" : "SOVG'A QUTISI"}
        </span>
      }
      onClose={onClose}
    >
      {got ? (
        <div role="status" className="flex flex-col gap-3">
          {hero && (
            <div className="relative mx-auto flex h-36 w-36 items-center justify-center">
              <span className="hero-rays absolute inset-0" aria-hidden="true" />
              <span className="hero-appear relative">
                <HeroAvatar hero={hero.id} size={96} />
              </span>
            </div>
          )}
          {hero && (
            <p
              className="gift-pop text-center text-xs sm:text-sm"
              style={{ color: hero.theme.uiText }}
            >
              YANGI QAHRAMON: {hero.name}!
            </p>
          )}
          {got.gold > 0 && (
            <p className="gift-pop inline-flex items-center gap-2 self-start text-primary text-xs sm:text-sm">
              <Icon id="coin" color="#ffcc33" size={16} />+{got.gold} OLTIN!
            </p>
          )}
          {got.xp > 0 && <p className="gift-pop self-start text-[#9fd0ef]">+{got.xp} XP</p>}
          {hero && (
            <p className="text-muted-foreground">
              <span style={{ color: HERO_THEME[hero.id].uiText }}>{hero.name}</span> endi menyudagi
              qahramonlar qatorida — tanlab o'ynang.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {(list?.length ?? 0) > 0 ? (
              <button onClick={() => setGot(null)} className={btn()}>
                KEYINGI SOVG'A ({list!.length})
              </button>
            ) : (
              <button onClick={onClose} className={btn()}>
                ZO'R!
              </button>
            )}
          </div>
          {got.gold > 0 && <CoinRain />}
        </div>
      ) : !list ? (
        <p className="text-muted-foreground">Yuklanmoqda...</p>
      ) : !g ? (
        <>
          <p className="text-muted-foreground">
            Hozircha sovg'a yo'q. O'yin muallifi sovg'a yuborsa — shu yerda paydo bo'ladi.
          </p>
          <button onClick={onClose} className={btn("pixel", "self-start")}>
            YOPISH
          </button>
        </>
      ) : (
        <>
          <GiftCard g={g} />
          {err && (
            <p role="alert" className="text-[#ff4d6d]">
              {err}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button disabled={busy} onClick={() => void take(g)} className={btn()}>
              {busy ? "..." : "OLISH"}
            </button>
            <button onClick={onClose} className={btn("pixelOutline")}>
              KEYINROQ
            </button>
            {list.length > 1 && (
              <span className="text-muted-foreground">Yana {list.length - 1} ta sovg'a</span>
            )}
          </div>
        </>
      )}
    </PixelWindow>
  );
}
