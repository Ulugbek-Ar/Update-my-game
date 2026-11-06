/**
 * MUALLIF PANELI — faqat o'yin muallifi (ADMIN_TELEGRAM_IDS). Oyna ochilganda server so'raladi
 * (admin/info): admin bo'lmasa — hech narsa ko'rsatilmaydi. Har tugma serverda qayta tekshiriladi
 * va jurnalga yoziladi. Bo'limlar: OCHISH (progress), SOVG'A, GILDIYA, JURNAL.
 */
import { useEffect, useState, type ReactNode } from "react";
import { adminApi, adminErrorText, type AdminStart } from "@/account/admin";
import { useAccount } from "@/account/useAccount";
import { DEFAULT_EMBLEM, GUILD_MAX_LEVEL } from "@/account/guildRules";
import type { AdminInfo, AdminLogEntry, SentGift } from "@/account/protocol";
import { MAX_LEVEL } from "@/account/xp";
import { HERO_LIST, HERO_THEME } from "@/game/hero";
import { loadUnlockedHeroes } from "@/game/save";
import { pixelFocus } from "@/lib/pixel-ui";
import { GiftSender, SentGiftList } from "./AdminGifts";
import { AuthorBadge, HeroAvatar, PixelWindow } from "./pixel";
import { btn, tabBtn, when } from "./pixelUi";

type Tab = "unlock" | "gift" | "guild" | "log";

const input = `w-24 border-2 border-border bg-background px-2 py-1 text-primary ${pixelFocus}`;

const ACTION_NAME: Record<string, string> = {
  unlock: "Hammasini ochish",
  grant: "Progress",
  reset: "Nolga qaytarish",
  guild: "Test gildiyasi",
  guildlevel: "Gildiya darajasi",
  gift: "Sovg'a",
  denied: "RAD ETILDI (admin emas)",
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-2 border-border p-2">
      <h3 className="text-primary">{title}</h3>
      {children}
    </section>
  );
}

/** Natija yoki xato (bitta qatorda) */
function useStatus() {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (
    fn: () => Promise<{ ok: true } | ({ ok: false } & Parameters<typeof adminErrorText>[0])>,
    okText: string,
  ) => {
    setBusy(true);
    setMsg(null);
    const r = await fn();
    setBusy(false);
    setMsg(r.ok ? { ok: true, text: okText } : { ok: false, text: adminErrorText(r) });
    return r.ok;
  };
  return { msg, busy, run };
}

function StatusLine({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg) return null;
  return (
    <p role="status" className={msg.ok ? "text-[#a6f08e]" : "text-[#ff4d6d]"}>
      {msg.text}
    </p>
  );
}

function UnlockTab({
  onChanged,
  onStart,
}: {
  onChanged: () => void;
  onStart: (s: AdminStart) => void;
}) {
  const { msg, busy, run } = useStatus();
  const [gold, setGold] = useState("1000");
  const [xp, setXp] = useState("500");
  const [level, setLevel] = useState("50");
  const [world, setWorld] = useState<1 | 2 | 3>(1);
  const [wave, setWave] = useState(0);
  const [reset, setReset] = useState<0 | 1 | 2>(0);
  const [resetText, setResetText] = useState("");
  const [owned, setOwned] = useState(loadUnlockedHeroes);
  const done = (ok: boolean) => {
    if (!ok) return;
    setOwned(loadUnlockedHeroes());
    onChanged();
  };
  const n = (s: string) => Math.floor(Number(s) || 0);
  return (
    <>
      <StatusLine msg={msg} />
      <Section title="HAMMASINI OCHISH">
        <p className="text-muted-foreground">
          Barcha qahramonlar, do'kon kuchaytirishlari maksimal, dunyolar va bosslar yengilgan, olam
          kalitlari va hududlar, sirlar (olamga bir marta kirilgan bo'lsa), yutuqlar, barcha
          skinlar, 50-daraja va 99 999 oltin. Yangi versiyadan keyin qayta bosing — yangi
          qo'shilganlar ham ochiladi.
        </p>
        <button
          disabled={busy}
          onClick={() => void run(adminApi.unlock, "Hammasi ochildi").then(done)}
          className={btn("pixel", "self-start")}
        >
          HAMMASINI OCHISH
        </button>
      </Section>
      <Section title="OLTIN, DARAJA VA XP">
        <div className="flex flex-wrap items-center gap-2">
          <input
            aria-label="Oltin miqdori"
            inputMode="numeric"
            value={gold}
            onChange={(e) => setGold(e.target.value.replace(/[^\d-]/g, ""))}
            className={input}
          />
          <button
            disabled={busy || !n(gold)}
            onClick={() =>
              void run(() => adminApi.grant({ gold: n(gold) }), `Oltin: ${n(gold)}`).then(done)
            }
            className={btn("pixelOutline")}
          >
            OLTIN QO'SHISH
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            aria-label="Daraja"
            inputMode="numeric"
            value={level}
            onChange={(e) => setLevel(e.target.value.replace(/\D/g, ""))}
            className={input}
          />
          <button
            disabled={busy || n(level) < 1 || n(level) > MAX_LEVEL}
            onClick={() =>
              void run(() => adminApi.grant({ level: n(level) }), `Daraja: ${n(level)}`).then(done)
            }
            className={btn("pixelOutline")}
          >
            DARAJANI O'RNATISH
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            aria-label="XP miqdori"
            inputMode="numeric"
            value={xp}
            onChange={(e) => setXp(e.target.value.replace(/\D/g, ""))}
            className={input}
          />
          <button
            disabled={busy || n(xp) <= 0}
            onClick={() => void run(() => adminApi.grant({ xp: n(xp) }), `+${n(xp)} XP`).then(done)}
            className={btn("pixelOutline")}
          >
            XP BERISH
          </button>
        </div>
        <button
          disabled={busy}
          onClick={() =>
            void run(() => adminApi.grant({ daily: true }), "Kunlik sovg'a tiklandi").then(done)
          }
          className={btn("pixelOutline", "self-start")}
        >
          KUNLIK SOVG'ANI TIKLASH
        </button>
      </Section>
      <Section title="QAHRAMONLAR">
        <ul className="flex flex-col gap-1">
          {HERO_LIST.filter((h) => h.price > 0).map((h) => {
            const on = owned.has(h.id);
            return (
              <li key={h.id} className="flex flex-wrap items-center gap-2">
                <HeroAvatar hero={h.id} size={20} dim={!on} />
                <span style={{ color: HERO_THEME[h.id].uiText }}>{h.name}</span>
                <span className="text-muted-foreground">{on ? "ochiq" : "yopiq"}</span>
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(
                      () => adminApi.grant(on ? { lock: h.id } : { hero: h.id }),
                      `${h.name} ${on ? "yopildi" : "ochildi"}`,
                    ).then(done)
                  }
                  className={btn("pixelOutline", "ml-auto")}
                >
                  {on ? "YOPISH" : "OCHISH"}
                </button>
              </li>
            );
          })}
        </ul>
        <p className="text-muted-foreground">Bepul qahramonlar doim ochiq.</p>
      </Section>
      <Section title="ISTALGAN JOYDAN BOSHLASH">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Dunyo">
          {([1, 2, 3] as const).map((w) => (
            <button
              key={w}
              aria-pressed={world === w}
              onClick={() => setWorld(w)}
              className={tabBtn(world === w)}
            >
              {w}-DUNYO
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="To'lqin">
          {[0, 1, 2, 3, 4].map((w) => (
            <button
              key={w}
              aria-pressed={wave === w}
              onClick={() => setWave(w)}
              className={tabBtn(wave === w)}
            >
              {w === 4 ? "BOSS" : `${w + 1}-TO'LQIN`}
            </button>
          ))}
        </div>
        <button onClick={() => onStart({ world, wave })} className={btn("pixel", "self-start")}>
          BOSHLASH
        </button>
        <p className="text-muted-foreground">Muallif natijalari reytingga yozilmaydi.</p>
      </Section>
      <Section title="PROGRESSNI NOLGA QAYTARISH">
        <p className="text-muted-foreground">
          Yangi o'yinchi tajribasini sinash uchun: bulutdagi va shu qurilmadagi progress o'chiriladi
          (oldingisi bulut zaxirasida qoladi — Profil → BULUT).
        </p>
        {reset === 0 && (
          <button
            onClick={() => setReset(1)}
            className={btn("pixelOutline", "self-start border-[#ff4d6d] text-[#ff4d6d]")}
          >
            PROGRESSNI NOLGA QAYTARISH
          </button>
        )}
        {reset === 1 && (
          <div role="alertdialog" className="flex flex-col gap-2">
            <p className="text-[#ff4d6d]">1/2: Ishonchingiz komilmi? Barcha progress o'chadi.</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setReset(2)} className={btn("pixel")}>
                HA, DAVOM
              </button>
              <button onClick={() => setReset(0)} className={btn("pixelOutline")}>
                BEKOR
              </button>
            </div>
          </div>
        )}
        {reset === 2 && (
          <div role="alertdialog" className="flex flex-col gap-2">
            <label className="flex flex-col gap-1 text-[#ff4d6d]">
              2/2: Tasdiqlash uchun NOL deb yozing
              <input
                value={resetText}
                aria-label="Tasdiqlash: NOL"
                onChange={(e) => setResetText(e.target.value)}
                className={input}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                disabled={busy || resetText.trim().toUpperCase() !== "NOL"}
                onClick={() =>
                  void run(adminApi.reset, "Progress nolga qaytarildi").then((ok) => {
                    setReset(0);
                    setResetText("");
                    done(ok);
                  })
                }
                className={btn("pixel", "border-[#ff4d6d] bg-[#ff4d6d]")}
              >
                NOLGA QAYTARISH
              </button>
              <button
                onClick={() => {
                  setReset(0);
                  setResetText("");
                }}
                className={btn("pixelOutline")}
              >
                BEKOR
              </button>
            </div>
          </div>
        )}
      </Section>
    </>
  );
}

function GuildTab() {
  const { msg, busy, run } = useStatus();
  const [name, setName] = useState("Sinov Gildiyasi");
  const [tag, setTag] = useState("TEST");
  const [level, setLevel] = useState(5);
  return (
    <>
      <StatusLine msg={msg} />
      <Section title="TEST GILDIYASI (OLTINSIZ)">
        <label className="flex flex-col gap-1 text-muted-foreground">
          Nomi
          <input
            value={name}
            aria-label="Test gildiyasi nomi"
            onChange={(e) => setName(e.target.value)}
            className={`${input} w-56`}
          />
        </label>
        <label className="flex flex-col gap-1 text-muted-foreground">
          Tegi
          <input
            value={tag}
            aria-label="Test gildiyasi tegi"
            onChange={(e) => setTag(e.target.value)}
            className={input}
          />
        </label>
        <button
          disabled={busy}
          onClick={() =>
            void run(
              () => adminApi.guild({ name, tag, emblem: DEFAULT_EMBLEM }),
              "Test gildiyasi tuzildi (oltin yechilmadi)",
            )
          }
          className={btn("pixel", "self-start")}
        >
          GILDIYA TUZISH
        </button>
      </Section>
      <Section title="GILDIYA DARAJASI">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Gildiya darajasi">
          {Array.from({ length: GUILD_MAX_LEVEL }, (_, i) => i + 1).map((l) => (
            <button
              key={l}
              aria-pressed={level === l}
              onClick={() => setLevel(l)}
              className={tabBtn(level === l)}
            >
              {l}
            </button>
          ))}
        </div>
        <button
          disabled={busy}
          onClick={() => void run(() => adminApi.guildLevel(level), `Gildiya darajasi: ${level}`)}
          className={btn("pixelOutline", "self-start")}
        >
          DARAJANI O'RNATISH
        </button>
        <p className="text-muted-foreground">O'zingiz a'zo bo'lgan gildiya uchun.</p>
      </Section>
    </>
  );
}

function LogTab({ log }: { log: AdminLogEntry[] }) {
  if (!log.length) return <p className="text-muted-foreground">Jurnal bo'sh.</p>;
  return (
    <ul className="flex flex-col gap-1">
      {log.map((e) => (
        <li key={e.id} className="border-b border-border pb-1 text-foreground">
          <span className="text-muted-foreground">{when(e.at)}</span> ·{" "}
          <span className={e.action === "denied" ? "text-[#ff4d6d]" : "text-primary"}>
            {ACTION_NAME[e.action] ?? e.action}
          </span>
          {e.target && <> · {e.target}</>}
          {e.detail && <span className="text-muted-foreground"> — {e.detail}</span>}
        </li>
      ))}
    </ul>
  );
}

export function AdminWindow({
  onClose,
  onChanged,
  onStart,
}: {
  onClose: () => void;
  /** progress server tomonidan o'zgardi — menyu qayta o'qisin */
  onChanged: () => void;
  /** tanlangan dunyo/to'lqindan o'yin */
  onStart: (s: AdminStart) => void;
}) {
  const a = useAccount();
  const [tab, setTab] = useState<Tab>("unlock");
  const [info, setInfo] = useState<AdminInfo | null>(null);
  const [denied, setDenied] = useState<string | null>(null);
  const reload = () =>
    void adminApi.info().then((r) => {
      if (r.ok) setInfo({ gifts: r.gifts, log: r.log });
      else setDenied(adminErrorText(r));
    });
  // panel faqat server tasdiqlagandan keyin ko'rinadi
  useEffect(reload, []);
  const tabs: [Tab, string][] = [
    ["unlock", "OCHISH"],
    ["gift", "SOVG'A"],
    ["guild", "GILDIYA"],
    ["log", "JURNAL"],
  ];
  return (
    <PixelWindow
      label="Muallif paneli"
      title={
        <span className="inline-flex items-center gap-2">
          MUALLIF PANELI <AuthorBadge />
        </span>
      }
      wide
      onClose={onClose}
      head={
        info ? (
          <div role="tablist" aria-label="Panel bo'limlari" className="flex flex-wrap gap-2">
            {tabs.map(([id, name]) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                onClick={() => {
                  setTab(id);
                  if (id === "log" || id === "gift") reload();
                }}
                className={tabBtn(tab === id)}
              >
                {name}
              </button>
            ))}
          </div>
        ) : undefined
      }
    >
      {!info ? (
        <p className={denied ? "text-[#ff4d6d]" : "text-muted-foreground"}>
          {denied ?? "Server tekshirmoqda..."}
        </p>
      ) : tab === "unlock" ? (
        <UnlockTab onChanged={onChanged} onStart={onStart} />
      ) : tab === "gift" ? (
        <>
          <GiftSender
            from={a.me?.nick ?? "Muallif"}
            onSent={(g: SentGift) => setInfo({ ...info, gifts: [g, ...info.gifts] })}
          />
          <SentGiftList gifts={info.gifts} />
        </>
      ) : tab === "guild" ? (
        <GuildTab />
      ) : (
        <LogTab log={info.log} />
      )}
    </PixelWindow>
  );
}
