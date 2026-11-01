/**
 * Telegram Login Widget (saytda): telegram-widget.js skripti talab qilinganda yuklanadi,
 * Telegram.Login.auth — Telegram'ning o'z popup oynasi. Javob serverda bot tokeni bilan tekshiriladi.
 * Widget faqat BotFather'da /setdomain qilingan domenda ishlaydi (ulugbek-ar.github.io).
 */
const SRC = "https://telegram.org/js/telegram-widget.js?22";
/** BotFather'dagi bot domeni */
export const WIDGET_HOSTS: readonly string[] = ["ulugbek-ar.github.io"];

type WidgetUser = Record<string, string | number>;

interface TgLogin {
  auth(
    opts: { bot_id: number; request_access?: string; lang?: string },
    cb: (user: WidgetUser | false) => void,
  ): void;
}

function tgLogin(): TgLogin | undefined {
  return (window as unknown as { Telegram?: { Login?: TgLogin } }).Telegram?.Login;
}

/** Widget shu sahifada ishlaydimi (to'g'ri domen, https) */
export function widgetAvailable() {
  return (
    typeof location !== "undefined" &&
    location.protocol === "https:" &&
    WIDGET_HOSTS.includes(location.hostname)
  );
}

let loading: Promise<boolean> | null = null;

export function loadWidget(): Promise<boolean> {
  if (tgLogin()) return Promise.resolve(true);
  if (!loading)
    loading = new Promise((resolve) => {
      const s = document.createElement("script");
      s.src = SRC;
      s.async = true;
      s.onload = () => resolve(!!tgLogin());
      s.onerror = () => {
        loading = null;
        resolve(false);
      };
      document.head.appendChild(s);
    });
  return loading;
}

/** Popup (tugma bosilganda sinxron chaqirilsin — brauzer bloklamasin). Bekor qilinsa — null. */
export function widgetAuth(botId: number): Promise<WidgetUser | null> {
  const login = tgLogin();
  if (!login) return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      login.auth({ bot_id: botId, request_access: "write", lang: "uz" }, (u) => resolve(u || null));
    } catch {
      resolve(null);
    }
  });
}
