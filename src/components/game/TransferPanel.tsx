/**
 * SOZLAMALAR -> UMUMIY -> PROGRESSNI KO'CHIRISH: kodni olish (nusxalash), kodni kiritish,
 * ko'rib chiqish va o'yin ichidagi tasdiqlash, kod qo'llanishidan oldingi holatga qaytarish.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { pixelFocus, pixelPress } from "@/lib/pixel-ui";
import { sfx } from "@/game/audio";
import { ACHIEVEMENTS } from "@/game/achievements";
import { HERO_LIST } from "@/game/hero";
import {
  applyTransfer,
  currentSummary,
  exportCode,
  loadBackup,
  readCode,
  restoreBackup,
  splitCode,
  summarize,
  type Backup,
  type ProgressSummary,
  type TransferData,
} from "@/game/transfer";

type View =
  | { kind: "export"; parts: string[] | null }
  | { kind: "import" }
  | { kind: "preview"; data: TransferData }
  | { kind: "done" }
  | { kind: "restore"; backup: Backup }
  | { kind: "restored" };

const TITLES: Record<View["kind"], string> = {
  export: "KODNI OLISH",
  import: "KODNI KIRITISH",
  preview: "KODNI QO'LLASH",
  done: "PROGRESS KO'CHIRILDI",
  restore: "OLDINGI HOLATGA QAYTARISH",
  restored: "OLDINGI HOLAT TIKLANDI",
};

const btn = (variant: "pixel" | "pixelOutline", extra = "") =>
  cn(buttonVariants({ variant, size: "none" }), "whitespace-normal px-3 py-2", extra);

function when(t: number) {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Bufer API ishlamasa (Telegram/eski WebView) — eski usul, u ham bo'lmasa matn belgilanadi. */
async function copyText(text: string, el: HTMLTextAreaElement | null) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    /* ruxsat yo'q */
  }
  if (!el) return false;
  el.focus();
  el.select();
  el.setSelectionRange(0, text.length);
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  }
}

/** UMUMIY bo'limidagi qism: tugmalar va ochiladigan oyna. canImport — faqat bosh menyuda. */
export function TransferPanel({
  canImport,
  onChanged,
}: {
  canImport: boolean;
  /** Progress almashtirildi — menyu holatini qayta o'qish */
  onChanged: () => void;
}) {
  const [view, setView] = useState<View | null>(null);
  const [backup, setBackup] = useState<Backup | null>(loadBackup);
  const openExport = () => {
    sfx.unlock();
    setView({ kind: "export", parts: null });
    void exportCode().then((code) =>
      setView((v) => (v?.kind === "export" ? { kind: "export", parts: splitCode(code) } : v)),
    );
  };
  const changed = () => {
    setBackup(loadBackup());
    onChanged();
  };
  return (
    <section
      aria-label="Progressni ko'chirish"
      className="flex flex-col gap-2 border-t-2 border-border pt-3"
    >
      <h3 className="text-primary">PROGRESSNI KO'CHIRISH</h3>
      <p className="text-muted-foreground text-[9px] sm:text-[10px] leading-4">
        Kodni nusxalang, o'zingizga Telegram'da yuboring va boshqa qurilmada kiriting.
      </p>
      <div className="flex flex-wrap gap-2">
        <button onClick={openExport} className={btn("pixelOutline")}>
          KODNI OLISH
        </button>
        <button
          onClick={() => setView({ kind: "import" })}
          disabled={!canImport}
          className={btn("pixelOutline")}
        >
          KODNI KIRITISH
        </button>
      </div>
      {!canImport && (
        <p className="text-muted-foreground text-[9px] sm:text-[10px] leading-4">
          Kodni kiritish — bosh menyuda.
        </p>
      )}
      {backup && canImport && (
        <button
          onClick={() => setView({ kind: "restore", backup })}
          className={btn("pixelOutline", "self-start")}
        >
          OLDINGI HOLATGA QAYTARISH
        </button>
      )}
      {view && (
        <TransferWindow
          view={view}
          setView={setView}
          onChanged={changed}
          onClose={() => setView(null)}
        />
      )}
    </section>
  );
}

function TransferWindow({
  view,
  setView,
  onChanged,
  onClose,
}: {
  view: View;
  setView: (v: View) => void;
  onChanged: () => void;
  onClose: () => void;
}) {
  // Esc — faqat shu oyna yopiladi (sozlamalar ochiq qoladi)
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Escape") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      closeRef.current();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);
  // body'ga: sozlamalar oynasining aylanadigan qutisi ichida qolmaydi
  return createPortal(
    <div
      className="font-pixel fixed inset-0 z-[55] flex items-center justify-center bg-black/70 p-2 sm:p-4"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={TITLES[view.kind]}
        className="fit-screen flex w-[min(94vw,520px)] flex-col overflow-hidden border-4 border-primary bg-card text-[10px] sm:text-xs leading-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 border-b-2 border-border px-3 py-2">
          <h2 className="text-primary">{TITLES[view.kind]}</h2>
          <button
            onClick={onClose}
            aria-label="Yopish"
            className={`shrink-0 border-2 border-border px-2 py-1 text-muted-foreground hover:border-foreground hover:text-foreground ${pixelPress} ${pixelFocus}`}
          >
            X
          </button>
        </div>
        {/* key: har bosqich tepadan boshlab ko'rinadi */}
        <div
          key={view.kind}
          className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain p-3"
        >
          {view.kind === "export" && <ExportView parts={view.parts} />}
          {view.kind === "import" && (
            <ImportView onRead={(data) => setView({ kind: "preview", data })} />
          )}
          {view.kind === "preview" && (
            <Confirm
              code={view.data.summary}
              codeLabel="KODDA"
              warning="Hozirgi progress shu kod bilan almashtiriladi."
              note="Hozirgi holat zaxiraga saqlanadi — keyin qaytarish mumkin."
              yes="ALMASHTIRISH"
              onYes={() => {
                if (!applyTransfer(view.data)) return false;
                sfx.upgrade();
                onChanged();
                setView({ kind: "done" });
                return true;
              }}
              onNo={() => setView({ kind: "import" })}
            />
          )}
          {view.kind === "done" && (
            <>
              <p className="text-foreground">Oltin, qahramonlar va yutuqlar shu qurilmaga o'tdi.</p>
              <SummaryTable rows={[["HOZIR", currentSummary()]]} />
              <p className="text-muted-foreground">
                Oldingi holat zaxirada. Adashgan bo'lsangiz — qaytaring.
              </p>
              <div className="flex flex-wrap gap-2">
                <button onClick={onClose} className={btn("pixel")}>
                  YOPISH
                </button>
                <BackupButton setView={setView} />
              </div>
            </>
          )}
          {view.kind === "restore" && (
            <Confirm
              code={summarize((k) => view.backup.keys[k] ?? null)}
              codeLabel="ZAXIRA"
              warning="Hozirgi progress kod qo'llanishidan oldingi holat bilan almashtiriladi."
              note={`Zaxira vaqti: ${when(view.backup.time)}.`}
              yes="QAYTARISH"
              onYes={() => {
                if (!restoreBackup()) return false;
                onChanged();
                setView({ kind: "restored" });
                return true;
              }}
              onNo={onClose}
            />
          )}
          {view.kind === "restored" && (
            <>
              <SummaryTable rows={[["HOZIR", currentSummary()]]} />
              <button onClick={onClose} className={btn("pixel", "self-start")}>
                YOPISH
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function BackupButton({ setView }: { setView: (v: View) => void }) {
  const b = loadBackup();
  if (!b) return null;
  return (
    <button onClick={() => setView({ kind: "restore", backup: b })} className={btn("pixelOutline")}>
      OLDINGI HOLATGA QAYTARISH
    </button>
  );
}

function ExportView({ parts }: { parts: string[] | null }) {
  if (!parts) return <p className="text-muted-foreground">Kod tayyorlanmoqda...</p>;
  const total = parts.reduce((n, p) => n + p.length, 0);
  return (
    <>
      <p className="text-foreground">
        {parts.length > 1
          ? `Kod uzun — ${parts.length} qismga bo'lindi. Har qismini alohida xabar qilib yuboring, kiritishda hammasini ketma-ket qo'ying.`
          : "Kodni nusxalang va o'zingizga Telegram'da yuboring (masalan, «Saqlangan xabarlar»ga)."}
      </p>
      {parts.map((p, i) => (
        <CodeBox key={i} code={p} label={parts.length > 1 ? `${i + 1}-QISM` : null} />
      ))}
      <p className="text-muted-foreground text-[9px] sm:text-[10px] leading-4">
        Kod uzunligi: {total} belgi. Sozlamalar (boshqaruv, ovoz) har qurilmada o'zi — kodga
        kirmaydi.
      </p>
    </>
  );
}

function CodeBox({ code, label }: { code: string; label: string | null }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [status, setStatus] = useState<"" | "ok" | "fail">("");
  return (
    <div className="flex flex-col gap-2">
      {label && <span className="text-primary">{label}</span>}
      <textarea
        ref={ref}
        readOnly
        value={code}
        rows={5}
        aria-label={label ? `Kod, ${label}` : "Ko'chirish kodi"}
        onFocus={(e) => e.currentTarget.select()}
        className="w-full resize-none break-all border-2 border-border bg-background p-2 font-mono text-[10px] leading-4 text-foreground"
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={async () => {
            sfx.unlock();
            setStatus((await copyText(code, ref.current)) ? "ok" : "fail");
          }}
          className={btn("pixel")}
        >
          NUSXALASH
        </button>
        {status && (
          <span role="status" className={status === "ok" ? "text-primary" : "text-foreground"}>
            {status === "ok"
              ? "Nusxalandi!"
              : "Nusxalab bo'lmadi — matn belgilandi, uni o'zingiz nusxalang."}
          </span>
        )}
      </div>
    </div>
  );
}

function ImportView({ onRead }: { onRead: (d: TransferData) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const check = async (value: string) => {
    setBusy(true);
    const r = await readCode(value);
    setBusy(false);
    if (r.ok) onRead(r.data);
    else setError(r.error);
  };
  return (
    <>
      <p className="text-foreground">
        Boshqa qurilmadan olingan kodni joylashtiring. Kod 2 qismga bo'lingan bo'lsa — ikkalasini
        ketma-ket qo'ying.
      </p>
      <textarea
        ref={ref}
        value={text}
        rows={5}
        aria-label="Ko'chirish kodini kiriting"
        placeholder="PQ1-..."
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        onChange={(e) => {
          setText(e.target.value);
          setError("");
        }}
        className="w-full resize-none break-all border-2 border-border bg-background p-2 font-mono text-[10px] leading-4 text-foreground"
      />
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={async () => {
            sfx.unlock();
            try {
              const t = await navigator.clipboard.readText();
              setText(t);
              setError("");
              if (t.trim()) void check(t);
            } catch {
              ref.current?.focus();
              setError("Buferni ochib bo'lmadi — kodni maydonga bosib turib joylashtiring.");
            }
          }}
          className={btn("pixelOutline")}
        >
          JOYLASHTIRISH
        </button>
        <button onClick={() => void check(text)} disabled={busy} className={btn("pixel")}>
          {busy ? "TEKSHIRILMOQDA..." : "DAVOM ETISH"}
        </button>
      </div>
    </>
  );
}

/** Ko'rib chiqish va tasdiqlash: brauzer confirm() o'rniga o'yin uslubidagi tugmalar. */
function Confirm({
  code,
  codeLabel,
  warning,
  note,
  yes,
  onYes,
  onNo,
}: {
  code: ProgressSummary;
  codeLabel: string;
  warning: string;
  note: string;
  yes: string;
  onYes: () => boolean;
  onNo: () => void;
}) {
  const [failed, setFailed] = useState(false);
  // xavfsiz tanlov fokusda, lekin past ekranda jadval tepasi (oltin) aylanib ketmaydi
  const noRef = useRef<HTMLButtonElement>(null);
  useEffect(() => noRef.current?.focus({ preventScroll: true }), []);
  return (
    <>
      <SummaryTable
        rows={[
          [codeLabel, code],
          ["HOZIR", currentSummary()],
        ]}
      />
      <p className="border-2 border-primary px-2 py-1 text-primary">{warning}</p>
      <p className="text-muted-foreground">{note}</p>
      {failed && (
        <p role="alert" className="text-destructive">
          Saqlab bo'lmadi: qurilmada joy yetarli emas. Progress o'zgarmadi.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setFailed(!onYes())} className={btn("pixel")}>
          {yes}
        </button>
        <button ref={noRef} onClick={onNo} className={btn("pixelOutline")}>
          BEKOR QILISH
        </button>
      </div>
    </>
  );
}

function SummaryTable({ rows }: { rows: [string, ProgressSummary][] }) {
  const line = (label: string, cell: (s: ProgressSummary) => ReactNode) => (
    <tr className="border-t border-border align-top">
      <th scope="row" className="py-1 pr-2 text-left font-normal text-muted-foreground">
        {label}
      </th>
      {rows.map(([name, s]) => (
        <td key={name} className="py-1 pr-2 text-foreground">
          {cell(s)}
        </td>
      ))}
    </tr>
  );
  return (
    <table className="w-full border-collapse text-[9px] sm:text-[10px] leading-4">
      {rows.length > 1 && (
        <thead>
          <tr>
            <th />
            {rows.map(([name]) => (
              <th key={name} scope="col" className="pb-1 pr-2 text-left font-normal text-primary">
                {name}
              </th>
            ))}
          </tr>
        </thead>
      )}
      <tbody>
        {line("Oltin", (s) => s.gold)}
        {line("Qahramonlar", (s) =>
          s.heroes.map((h) => HERO_LIST.find((x) => x.id === h)?.name ?? h).join(", "),
        )}
        {line("Yutuqlar", (s) => `${s.achievements}/${ACHIEVEMENTS.length}`)}
        {line("Eng yaxshi rekord", (s) => s.best)}
      </tbody>
    </table>
  );
}
