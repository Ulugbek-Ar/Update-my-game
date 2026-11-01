/**
 * "TELEGRAM BILAN KIRISH" oynasi. Parol yo'q:
 *  - Telegram Mini App ichida — avtomatik (bu oyna faqat xato bo'lsa kerak);
 *  - saytda (ulugbek-ar.github.io) — Telegram Login Widget popup'i;
 *  - ilova, Windows va portativ — bot havolasi (yoki QR) -> botda "Tasdiqlash" -> o'yin o'zi kiradi.
 */
import { useEffect, useState } from "react";
import { account } from "@/account/account";
import { useAccount } from "@/account/useAccount";
import { widgetAvailable } from "@/account/widget";
import { openExternal } from "@/lib/desktop";
import { IS_APP, IS_DESKTOP } from "@/lib/platform";
import { telegramApp } from "@/lib/telegram";
import { SITE_URL } from "@/realm/net/config";
import { PixelWindow, QrCode, TelegramIcon } from "./pixel";
import { btn } from "./pixelUi";

function mmss(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function LoginWindow({ onClose }: { onClose: () => void }) {
  const a = useAccount();
  const widget = widgetAvailable();
  const inTelegram = !!telegramApp();
  const [botId, setBotId] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    account.clearError();
    if (widget) void account.prepareWidget().then(setBotId);
  }, [widget]);

  // kirildi — oyna yopiladi (kerak bo'lsa progress tanlov oynasi ochiladi)
  const me = a.me;
  useEffect(() => {
    if (me) onClose();
  }, [me, onClose]);

  useEffect(() => {
    if (!a.pending) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [a.pending]);

  const startBot = () => void account.startBotLogin(IS_APP || IS_DESKTOP);

  return (
    <PixelWindow
      label="Telegram bilan kirish"
      title={
        <span className="inline-flex items-center gap-2">
          <TelegramIcon size={14} />
          TELEGRAM BILAN KIRISH
        </span>
      }
      onClose={onClose}
    >
      {!a.pending && (
        <>
          <p className="text-foreground">
            Parol kerak emas — Telegram tasdiqlaydi. Progressingiz bulutda saqlanadi: sayt,
            Telegram, telefon va kompyuterda bir xil. Do'stlar va reyting ham shu yerda.
          </p>
          <p className="text-muted-foreground">Kirmasdan ham avvalgidek o'ynash mumkin.</p>
        </>
      )}

      {a.pending ? (
        <div className="flex flex-wrap items-start gap-3 border-2 border-primary p-3" role="status">
          {/* kompyuterda: telefon kamerasi bilan skanerlab, botni telefonda ochish */}
          <QrCode text={a.pending.link} size={104} />
          <div className="flex min-w-[12rem] flex-1 flex-col gap-2">
            <ol className="flex list-decimal flex-col gap-1 pl-4 text-foreground">
              <li>Telegram'da botni oching (tugma yoki QR).</li>
              <li>
                Botda <span className="text-primary">START</span>, so'ng{" "}
                <span className="text-primary">«Tasdiqlash»</span>.
              </li>
              <li>O'yinga qayting — u o'zi kiradi.</li>
            </ol>
            <div className="flex flex-wrap items-center gap-2">
              <button
                autoFocus
                onClick={() => openExternal(a.pending!.link)}
                className={btn("pixel", "inline-flex items-center gap-2")}
              >
                <TelegramIcon />
                TELEGRAM'NI OCHISH
              </button>
              <button onClick={() => account.cancelBotLogin()} className={btn("pixelOutline")}>
                BEKOR
              </button>
            </div>
            <span>
              <span className="gift-blink text-primary">Tasdiq kutilmoqda...</span>{" "}
              <span className="text-muted-foreground">
                Kod {mmss(a.pending.expires - now)} amal qiladi, bir martalik.
              </span>
            </span>
          </div>
        </div>
      ) : inTelegram ? (
        <div className="flex flex-col gap-2">
          <p className="text-foreground">
            {a.busy ? "Telegram orqali kirilmoqda..." : "Telegram ichida avtomatik kiriladi."}
          </p>
          {!a.busy && (
            <button onClick={() => account.checkTelegram()} className={btn("pixel", "self-start")}>
              QAYTA URINISH
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          {widget ? (
            <>
              <button
                autoFocus
                disabled={!botId || a.busy}
                onClick={() => botId && void account.loginWidget(botId)}
                className={btn("pixel", "inline-flex items-center gap-2")}
              >
                <TelegramIcon />
                {a.busy ? "KIRILMOQDA..." : "TELEGRAM BILAN KIRISH"}
              </button>
              <button disabled={a.busy} onClick={startBot} className={btn("pixelOutline")}>
                BOT ORQALI (KOD)
              </button>
            </>
          ) : (
            <button
              autoFocus
              disabled={a.busy}
              onClick={startBot}
              className={btn("pixel", "inline-flex items-center gap-2")}
            >
              <TelegramIcon />
              {a.busy ? "KUTING..." : "TELEGRAM BILAN KIRISH"}
            </button>
          )}
        </div>
      )}

      {a.error && (
        <p role="alert" className="text-[#ff4d6d]">
          {a.error}
        </p>
      )}
      <p className="text-muted-foreground">
        Serverda saqlanadi: Telegram ID, taxallus va o'yin progressi.{" "}
        <button
          onClick={() => openExternal(`${SITE_URL}privacy.html`)}
          className="text-[#9fd0ef] underline"
        >
          Maxfiylik siyosati
        </button>
      </p>
    </PixelWindow>
  );
}
