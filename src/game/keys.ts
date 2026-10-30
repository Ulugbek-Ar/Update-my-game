/**
 * Klaviatura tugmalarini qayta belgilash: amallar, asl tugmalar, tugma nomlari va ziddiyatlar.
 * Har amalga 2 tagacha tugma (asosiy va qo'shimcha). Tugmalar `KeyboardEvent.code` bo'yicha
 * saqlanadi; chap/o'ng Shift (Ctrl, Alt) bitta tugma hisoblanadi.
 */

export type Action =
  | "up"
  | "down"
  | "left"
  | "right"
  | "attack"
  | "dash"
  | "reload"
  | "pause"
  | "mute"
  | "interact"
  | "journal"
  | "map";

export type KeyBinds = Record<Action, string[]>;

/** Ikkala rejimda (asosiy o'yin va olam) ishlaydigan amallar */
export const SHARED_ACTIONS: readonly Action[] = [
  "up",
  "down",
  "left",
  "right",
  "attack",
  "dash",
  "reload",
  "pause",
];
/** Faqat asosiy o'yinda */
export const GAME_ACTIONS: readonly Action[] = ["mute"];
/** Faqat Abadiyat olamida (olamda bular umumiy amallardan ustun) */
export const REALM_ACTIONS: readonly Action[] = ["interact", "journal", "map"];
export const ACTIONS: readonly Action[] = [...SHARED_ACTIONS, ...GAME_ACTIONS, ...REALM_ACTIONS];

/** Asl tugmalar — v2.4 gacha bo'lgan boshqaruv bilan bir xil */
export const DEFAULT_KEYS: KeyBinds = {
  up: ["KeyW", "ArrowUp"],
  down: ["KeyS", "ArrowDown"],
  left: ["KeyA", "ArrowLeft"],
  right: ["KeyD", "ArrowRight"],
  attack: ["Space", "KeyJ"],
  dash: ["Shift", "KeyK"],
  reload: ["KeyR"],
  pause: ["Escape", "KeyP"],
  mute: ["KeyM"],
  interact: ["KeyE", "Enter"],
  journal: ["KeyJ"],
  map: ["KeyM"],
};

export const ACTION_LABELS: Record<Action, string> = {
  up: "Yuqoriga",
  down: "Pastga",
  left: "Chapga",
  right: "O'ngga",
  attack: "Hujum",
  dash: "Dash / teleport / sakrash",
  reload: "Qayta o'qlash (Mergan)",
  pause: "Pauza",
  mute: "Ovoz",
  interact: "Gaplashish (olam)",
  journal: "Jurnal (olam)",
  map: "Xarita (olam)",
};

export function copyKeys(k: KeyBinds): KeyBinds {
  const out = {} as KeyBinds;
  for (const a of ACTIONS) out[a] = [...k[a]];
  return out;
}

/** Chap/o'ng modifikatorlar bitta tugma: ShiftLeft -> Shift, NumpadEnter -> Enter. */
export function normKey(code: string) {
  const m = /^(Shift|Control|Alt|Meta)(Left|Right)$/.exec(code);
  if (m) return m[1]!;
  return code === "NumpadEnter" ? "Enter" : code;
}

const NAMES: Record<string, string> = {
  Space: "Space",
  Shift: "Shift",
  Control: "Ctrl",
  Alt: "Alt",
  Meta: "Win",
  Escape: "Esc",
  Enter: "Enter",
  Tab: "Tab",
  Backspace: "Backspace",
  CapsLock: "Caps",
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  Comma: ",",
  Period: ".",
  Slash: "/",
  Semicolon: ";",
  Quote: "'",
  BracketLeft: "[",
  BracketRight: "]",
  Minus: "-",
  Equal: "=",
  Backquote: "`",
  Backslash: "\\",
};

/** Ekranda ko'rsatiladigan nom: KeyW -> W, Digit1 -> 1, Escape -> Esc. */
export function keyLabel(code: string | undefined) {
  if (!code) return "—";
  const named = NAMES[code];
  if (named) return named;
  const m = /^(?:Key|Digit)(.)$/.exec(code);
  if (m) return m[1]!;
  const num = /^Numpad(.+)$/.exec(code);
  if (num) return `Num${num[1]}`;
  return code;
}

/** Amalning asosiy tugmasi nomi (ko'rsatmalar uchun). */
export function actionKey(k: KeyBinds, a: Action) {
  return keyLabel(k[a][0]);
}

/** Yurish tugmalari: "WASD", "Strelkalar" yoki "I/J/K/L". */
export function moveLabel(k: KeyBinds) {
  const keys = (["up", "left", "down", "right"] as const).map((a) => k[a][0] ?? "");
  if (keys.join() === "KeyW,KeyA,KeyS,KeyD") return "WASD";
  if (keys.join() === "ArrowUp,ArrowLeft,ArrowDown,ArrowRight") return "Strelkalar";
  return keys.map(keyLabel).join("/");
}

const VALID = /^[A-Za-z0-9]{1,24}$/;

/** Saqlangan tugmalarni tekshiradi: noto'g'ri yoki bo'sh amal — asl tugmalar. */
export function sanitizeKeys(raw: unknown): KeyBinds {
  const out = copyKeys(DEFAULT_KEYS);
  if (!raw || typeof raw !== "object") return out;
  const r = raw as Record<string, unknown>;
  for (const a of ACTIONS) {
    const list = r[a];
    if (!Array.isArray(list)) continue;
    const keys = [
      ...new Set(list.filter((x): x is string => typeof x === "string" && VALID.test(x))),
    ]
      .map(normKey)
      .slice(0, 2);
    if (keys.length) out[a] = keys;
  }
  return out;
}

/**
 * Amalga tugma beradi (slot 0 — asosiy, 1 — qo'shimcha). Shu amalning boshqa slotida xuddi shu
 * tugma bo'lsa — takrorlanmaydi. Boshqa amallardan olib tashlanmaydi: ziddiyat ogohlantirish
 * bilan ko'rsatiladi.
 */
export function bindKey(k: KeyBinds, action: Action, slot: 0 | 1, code: string): KeyBinds {
  const next = copyKeys(k);
  const key = normKey(code);
  let [main, alt] = next[action];
  if (slot === 0) {
    main = key;
    if (alt === key) alt = undefined;
  } else if (main === key || !main) {
    main = key;
    alt = undefined;
  } else alt = key;
  next[action] = alt ? [main, alt] : [main];
  return next;
}

/** Qo'shimcha tugmani olib tashlash (asosiy tugma doim qoladi). */
export function clearAltKey(k: KeyBinds, action: Action): KeyBinds {
  const next = copyKeys(k);
  next[action] = next[action].slice(0, 1);
  return next;
}

export type KeyContext = "game" | "realm";

/**
 * Rejimda amalda ishlaydigan tugmalar. Olamda gaplashish/jurnal/xarita tugmalari umumiy
 * amallardan ustun (masalan, asl J — olamda jurnal, asosiy o'yinda hujum).
 */
export function effectiveKeys(k: KeyBinds, ctx: KeyContext): KeyBinds {
  const out = copyKeys(k);
  if (ctx === "game") {
    for (const a of REALM_ACTIONS) out[a] = [];
    return out;
  }
  for (const a of GAME_ACTIONS) out[a] = [];
  const taken = new Set(REALM_ACTIONS.flatMap((a) => k[a]));
  for (const a of SHARED_ACTIONS) out[a] = k[a].filter((c) => !taken.has(c));
  return out;
}

export interface KeyConflict {
  key: string;
  actions: [Action, Action];
}

/**
 * Bir tugma bir rejimning ikki amaliga berilgan bo'lsa — ziddiyat. Olamda umumiy amalning tugmasi
 * olam amaliga ham berilgan bo'lsa, umumiy amalda boshqa ishlaydigan tugma qolsagina ziddiyat emas.
 */
export function keyConflicts(k: KeyBinds): KeyConflict[] {
  const found = new Map<string, KeyConflict>();
  const add = (key: string, a: Action, b: Action) => {
    const pair = ACTIONS.indexOf(a) < ACTIONS.indexOf(b) ? [a, b] : [b, a];
    const id = `${key}:${pair.join()}`;
    if (!found.has(id)) found.set(id, { key, actions: pair as [Action, Action] });
  };
  for (const ctx of ["game", "realm"] as const) {
    const eff = effectiveKeys(k, ctx);
    const owner = new Map<string, Action>();
    const acts = ctx === "game" ? [...SHARED_ACTIONS, ...GAME_ACTIONS] : ACTIONS;
    for (const a of acts)
      for (const key of eff[a]) {
        const prev = owner.get(key);
        if (prev && prev !== a) add(key, prev, a);
        else owner.set(key, a);
      }
    if (ctx === "realm")
      // olamda tugmasi qolmagan umumiy amal: hamma tugmasi olam amallariga berilgan
      for (const a of SHARED_ACTIONS)
        if (k[a].length && !eff[a].length) {
          const key = k[a][0]!;
          const r = REALM_ACTIONS.find((x) => k[x].includes(key))!;
          add(key, a, r);
        }
  }
  return [...found.values()];
}
