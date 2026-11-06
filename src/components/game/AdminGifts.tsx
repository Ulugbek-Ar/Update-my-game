/**
 * Muallif paneli -> SOVG'A YUBORISH: o'yinchini taxallus yoki do'st kodi bo'yicha topish (ismi,
 * darajasi, avatari — adashmaslik uchun), sovg'a (oltin, XP, hali ochmagan qahramon) va 120
 * belgigacha xat; yuborishdan oldin tasdiqlash. Pastda — "Yuborilgan sovg'alar".
 */
import { useState } from "react";
import { adminApi, adminErrorText } from "@/account/admin";
import {
  GIFT_NOTE_MAX,
  formatFriendCode,
  type PlayerCard,
  type SentGift,
} from "@/account/protocol";
import { HERO_LIST, HERO_THEME, type Hero } from "@/game/hero";
import { SKINS, skinName } from "@/game/skins";
import { pixelFocus } from "@/lib/pixel-ui";
import { AuthorBadge, HeroAvatar, Icon, LevelBadge } from "./pixel";
import { btn, tabBtn, when } from "./pixelUi";

const input = `border-2 border-border bg-background px-2 py-1 text-primary ${pixelFocus}`;

export const GUEST_GIFT_TEXT =
  "Bunday o'yinchi topilmadi. Mehmon (akkauntsiz) o'yinchiga sovg'a yuborib bo'lmaydi — u avval menyudagi \"KIRISH\" orqali Telegram bilan akkaunt ochishi kerak. Taxallus yoki do'st kodini (profilida) tekshiring.";

/** "500 oltin + 100 XP + PALADIN + xat" */
export function giftText(g: {
  gold: number;
  xp: number;
  hero: Hero | null;
  skin?: string | null | undefined;
  note: string;
}) {
  const parts: string[] = [];
  if (g.gold > 0) parts.push(`${g.gold} oltin`);
  if (g.xp > 0) parts.push(`${g.xp} XP`);
  if (g.hero) parts.push(`qahramon ${HERO_LIST.find((h) => h.id === g.hero)?.name ?? g.hero}`);
  if (g.skin) parts.push(`skin ${skinName(g.skin)}`);
  if (g.note) parts.push("xat");
  return parts.join(" + ");
}

function PlayerLine({ p }: { p: PlayerCard }) {
  return (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-2 text-foreground">
      <HeroAvatar hero={p.avatar} size={28} />
      <span className="truncate">{p.nick}</span>
      <LevelBadge level={p.level} />
      {p.author && <AuthorBadge />}
      <span className="text-muted-foreground">{formatFriendCode(p.code)}</span>
    </span>
  );
}

export function GiftSender({ from, onSent }: { from: string; onSent: (g: SentGift) => void }) {
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<PlayerCard[] | null>(null);
  const [to, setTo] = useState<PlayerCard | null>(null);
  const [gold, setGold] = useState("500");
  const [xp, setXp] = useState("0");
  const [hero, setHero] = useState<Hero | null>(null);
  const [skin, setSkin] = useState("");
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const n = (s: string) => Math.max(0, Math.floor(Number(s) || 0));
  const gift = { gold: n(gold), xp: n(xp), hero, skin: skin || null, note: note.trim() };
  const empty = !gift.gold && !gift.xp && !gift.hero && !gift.skin;

  const search = async () => {
    const q = query.trim();
    if (!q) return;
    setBusy(true);
    setMsg(null);
    setTo(null);
    const r = await adminApi.find(q);
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: adminErrorText(r) });
    setFound(r.players);
    if (!r.players.length) setMsg({ ok: false, text: GUEST_GIFT_TEXT });
  };

  const send = async () => {
    if (!to) return;
    setBusy(true);
    const r = await adminApi.gift({
      to: to.id,
      gold: gift.gold,
      xp: gift.xp,
      ...(hero ? { hero } : {}),
      ...(skin ? { skin } : {}),
      ...(gift.note ? { note: gift.note } : {}),
    });
    setBusy(false);
    setConfirm(false);
    if (!r.ok)
      return setMsg({
        ok: false,
        text:
          r.error === "none"
            ? GUEST_GIFT_TEXT
            : r.error === "bad"
              ? "Bu qahramon yoki skin o'yinchida allaqachon ochiq"
              : r.error === "limit"
                ? "O'yinchida olinmagan sovg'alar juda ko'p"
                : adminErrorText(r),
      });
    setMsg({ ok: true, text: `Yuborildi: ${to.nick} — ${giftText(gift)}` });
    onSent(r.gift);
    setHero(null);
    setSkin("");
    setNote("");
  };

  return (
    <section className="flex flex-col gap-2 border-2 border-border p-2">
      <h3 className="text-primary">SOVG'A YUBORISH</h3>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          maxLength={32}
          aria-label="Taxallus yoki do'st kodi"
          placeholder="Taxallus yoki do'st kodi"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void search();
          }}
          className={`${input} w-52`}
        />
        <button disabled={busy || !query.trim()} onClick={() => void search()} className={btn()}>
          QIDIRISH
        </button>
      </div>
      {msg && (
        <p role="status" className={msg.ok ? "text-[#a6f08e]" : "text-[#ff4d6d]"}>
          {msg.text}
        </p>
      )}
      {found && found.length > 0 && !to && (
        <ul className="flex flex-col gap-1">
          {found.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-2 border-2 border-border p-1">
              <PlayerLine p={p} />
              <button
                onClick={() => {
                  setTo(p);
                  setHero(null);
                  setMsg(null);
                }}
                className={btn("pixelOutline", "ml-auto")}
              >
                TANLASH
              </button>
            </li>
          ))}
        </ul>
      )}
      {to && (
        <div className="flex flex-col gap-2 border-2 border-primary p-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">Kimga:</span>
            <PlayerLine p={to} />
            <button onClick={() => setTo(null)} className={btn("pixelOutline", "ml-auto")}>
              BOSHQA
            </button>
          </div>
          <label className="flex flex-wrap items-center gap-2 text-foreground">
            <Icon id="coin" color="#ffcc33" /> Oltin
            <input
              value={gold}
              inputMode="numeric"
              aria-label="Sovg'a: oltin"
              onChange={(e) => setGold(e.target.value.replace(/\D/g, ""))}
              className={`${input} w-24`}
            />
          </label>
          <label className="flex flex-wrap items-center gap-2 text-foreground">
            XP
            <input
              value={xp}
              inputMode="numeric"
              aria-label="Sovg'a: XP"
              onChange={(e) => setXp(e.target.value.replace(/\D/g, ""))}
              className={`${input} w-24`}
            />
          </label>
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Qahramon">
            <span className="text-foreground">Qahramon:</span>
            <button aria-pressed={!hero} onClick={() => setHero(null)} className={tabBtn(!hero)}>
              YO'Q
            </button>
            {HERO_LIST.filter((h) => !to.heroes.includes(h.id)).map((h) => (
              <button
                key={h.id}
                aria-pressed={hero === h.id}
                onClick={() => setHero(h.id)}
                className={tabBtn(hero === h.id)}
                style={hero === h.id ? undefined : { color: HERO_THEME[h.id].uiText }}
              >
                {h.name}
              </button>
            ))}
            {HERO_LIST.every((h) => to.heroes.includes(h.id)) && (
              <span className="text-muted-foreground">hammasi ochiq</span>
            )}
          </div>
          <label className="flex flex-wrap items-center gap-2 text-foreground">
            Skin:
            <select
              value={skin}
              aria-label="Sovg'a: skin"
              onChange={(e) => setSkin(e.target.value)}
              className={`${input} max-w-full`}
            >
              <option value="">YO'Q</option>
              {HERO_LIST.map((h) => (
                <optgroup key={h.id} label={h.name}>
                  {SKINS[h.id]
                    .filter((s) => s.price > 0)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-foreground">
            Xat (ixtiyoriy, {note.length}/{GIFT_NOTE_MAX})
            <textarea
              value={note}
              maxLength={GIFT_NOTE_MAX}
              rows={2}
              aria-label="Sovg'a xati"
              onChange={(e) => setNote(e.target.value.slice(0, GIFT_NOTE_MAX))}
              className={`${input} w-full resize-none`}
            />
          </label>
          {confirm ? (
            <div role="alertdialog" className="flex flex-col gap-2 border-2 border-primary p-2">
              <p className="text-primary">
                {from} → {to.nick}: {giftText(gift)}
              </p>
              {gift.note && <p className="text-foreground">"{gift.note}"</p>}
              <div className="flex flex-wrap gap-2">
                <button disabled={busy} onClick={() => void send()} className={btn()}>
                  {busy ? "..." : "HA, YUBORISH"}
                </button>
                <button onClick={() => setConfirm(false)} className={btn("pixelOutline")}>
                  BEKOR
                </button>
              </div>
            </div>
          ) : (
            <button
              disabled={empty}
              onClick={() => setConfirm(true)}
              className={btn("pixel", "self-start")}
            >
              YUBORISH
            </button>
          )}
        </div>
      )}
    </section>
  );
}

export function SentGiftList({ gifts }: { gifts: SentGift[] }) {
  return (
    <section className="flex flex-col gap-2 border-2 border-border p-2">
      <h3 className="text-primary">YUBORILGAN SOVG'ALAR</h3>
      {!gifts.length ? (
        <p className="text-muted-foreground">Hali sovg'a yuborilmagan.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {gifts.map((g) => (
            <li key={g.id} className="border-b border-border pb-1 text-foreground">
              <span className="text-muted-foreground">{when(g.at)}</span> ·{" "}
              <span className="text-primary">{g.to.nick}</span> · {giftText(g)} ·{" "}
              {g.claimed ? (
                <span className="text-[#a6f08e]">olindi ({when(g.claimed)})</span>
              ) : (
                <span className="text-muted-foreground">hali olinmadi</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
