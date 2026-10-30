/**
 * Kompyuter: tugmalarni qayta belgilash. Slot bosilsa "Tugmani bosing..." — keyingi bosilgan
 * tugma shu amalga beriladi. Bir tugma ikki amalga berilsa — ogohlantirish.
 */
import { useEffect, useState } from "react";
import { pixelFocus, pixelPress } from "@/lib/pixel-ui";
import {
  ACTION_LABELS,
  DEFAULT_KEYS,
  bindKey,
  clearAltKey,
  copyKeys,
  keyConflicts,
  keyLabel,
  type Action,
  type KeyBinds,
} from "@/game/keys";
import { loadSettings, saveSettings } from "@/game/settings";
import { useSettings } from "./useSettings";

const GROUPS: [title: string, actions: Action[]][] = [
  ["YURISH", ["up", "down", "left", "right"]],
  ["JANG", ["attack", "dash", "reload"]],
  ["O'YIN", ["pause", "mute"]],
  ["ABADIYAT OLAMI", ["interact", "journal", "map"]],
];

function setKeys(keys: KeyBinds) {
  saveSettings({ ...loadSettings(), keys });
}

export function KeyBindsPanel() {
  const { keys } = useSettings();
  /** Kutilayotgan slot: shu amalning 0 (asosiy) yoki 1 (qo'shimcha) tugmasi */
  const [wait, setWait] = useState<{ action: Action; slot: 0 | 1 } | null>(null);
  const conflicts = keyConflicts(keys);
  const clash = new Set(conflicts.flatMap((c) => c.actions.map((a) => `${a}:${c.key}`)));

  useEffect(() => {
    if (!wait) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.repeat) return;
      setKeys(bindKey(loadSettings().keys, wait.action, wait.slot, e.code));
      setWait(null);
    };
    // capture: sozlamalar oynasining Esc (yopish) ishlovchisidan oldin
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [wait]);

  const slot = (action: Action, i: 0 | 1) => {
    const code = keys[action][i];
    const waiting = wait?.action === action && wait.slot === i;
    const bad = code !== undefined && clash.has(`${action}:${code}`);
    return (
      <button
        {...(waiting && { "data-key-capture": "" })}
        aria-label={`${ACTION_LABELS[action]}: ${i === 0 ? "asosiy" : "qo'shimcha"} tugma ${keyLabel(code)}`}
        onClick={() => setWait(waiting ? null : { action, slot: i })}
        onBlur={() => waiting && setWait(null)}
        className={`min-w-0 flex-1 truncate border-2 px-2 py-1 ${pixelPress} ${pixelFocus} ${
          waiting
            ? "animate-pulse border-primary text-primary"
            : bad
              ? "border-[#ff9a3c] text-[#ff9a3c]"
              : code
                ? "border-border text-foreground hover:border-foreground"
                : "border-border/60 text-muted-foreground hover:border-foreground"
        }`}
      >
        {waiting ? "Tugmani bosing..." : keyLabel(code)}
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground">
        Tugmani bosing, so'ng klaviaturada yangi tugmani bosing. Har amalga 2 tagacha tugma.
      </p>
      {GROUPS.map(([title, actions]) => (
        <div key={title} className="flex flex-col gap-1">
          <span className="text-primary">{title}</span>
          {actions.map((a) => (
            <div
              key={a}
              className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2"
            >
              <span className="truncate text-foreground">{ACTION_LABELS[a]}</span>
              {slot(a, 0)}
              {slot(a, 1)}
              <button
                aria-label={`${ACTION_LABELS[a]}: qo'shimcha tugmani olib tashlash`}
                disabled={keys[a].length < 2}
                onClick={() => setKeys(clearAltKey(keys, a))}
                className={`w-6 border-2 border-border py-1 text-muted-foreground hover:border-foreground hover:text-foreground disabled:opacity-30 ${pixelFocus}`}
              >
                X
              </button>
            </div>
          ))}
        </div>
      ))}
      {conflicts.length > 0 && (
        <div
          role="alert"
          className="flex flex-col gap-1 border-2 border-[#ff9a3c] p-2 text-[#ff9a3c]"
        >
          {conflicts.map((c) => (
            <span key={`${c.key}:${c.actions.join()}`}>
              Diqqat: {keyLabel(c.key)} tugmasi ikki amalga berilgan — {ACTION_LABELS[c.actions[0]]}{" "}
              va {ACTION_LABELS[c.actions[1]]}
            </span>
          ))}
        </div>
      )}
      <p className="text-muted-foreground">
        Enter — menyularda tasdiqlash, 1–8 — olamda buyum ishlatish (o'zgarmaydi).
      </p>
      <button
        onClick={() => setKeys(copyKeys(DEFAULT_KEYS))}
        className={`self-start border-2 border-border px-3 py-1 text-muted-foreground hover:border-foreground hover:text-foreground ${pixelPress} ${pixelFocus}`}
      >
        ASL HOLIGA QAYTARISH
      </button>
    </div>
  );
}
