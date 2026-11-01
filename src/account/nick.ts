/**
 * Taxallus qoidalari (klient va server bir xil tekshiradi): 3–16 belgi, faqat harf, raqam va "_".
 * Harflar bitta yozuvda — lotin yoki kirill (aralash "Ulugbеk" kabi aldov taxalluslar bo'lmasin).
 * Haqoratli so'zlar va xizmat nomlari uchun oddiy filtr.
 */

export const NICK_MIN = 3;
export const NICK_MAX = 16;

export type NickError = "length" | "chars" | "script" | "letter" | "bad" | "reserved";

export const NICK_ERROR_TEXT: Record<NickError, string> = {
  length: `Taxallus ${NICK_MIN}–${NICK_MAX} belgidan iborat bo'lsin`,
  chars: "Faqat harf, raqam va _ ishlatiladi (bo'shliq va belgilar yo'q)",
  script: "Lotin va kirill harflarini aralashtirmang",
  letter: "Taxallusda kamida bitta harf bo'lsin",
  bad: "Bu taxallus odobsiz — boshqasini tanlang",
  reserved: "Bu nom band (xizmat nomi) — boshqasini tanlang",
};

const LATIN = /[A-Za-z]/;
const CYRILLIC = /[Ѐ-ӿ]/;
const ALLOWED = /^[A-Za-zЀ-ӿ0-9_]+$/u;

/**
 * Haqoratli so'z ildizlari (kichik harfda, "_" siz, raqamlar harfga almashtirilgan holda qidiriladi).
 * Ism bo'lishi mumkin bo'lgan qisqa ildizlar (masalan "nazi" — Nazira, "sika" — Sikandar) yo'q.
 */
const BAD_LATIN = [
  // inglizcha
  "fuck",
  "fuk",
  "fck",
  "shit",
  "bitch",
  "cunt",
  "dick",
  "cock",
  "pussy",
  "whore",
  "slut",
  "nigger",
  "nigga",
  "faggot",
  "porn",
  "rapist",
  "hitler",
  // ruscha (lotincha yozilgan)
  "huy",
  "xuy",
  "xuev",
  "huev",
  "pizd",
  "pzdc",
  "ebal",
  "ebat",
  "eban",
  "yeban",
  "blya",
  "blyat",
  "suka",
  "mudak",
  "mudil",
  "pidor",
  "pidar",
  "gandon",
  "zalup",
  "shluh",
  "shlyuh",
  "dolbaeb",
  "dolboeb",
  "nahuy",
  "naxuy",
  "debil",
  "tupoy",
  // o'zbekcha
  "qotaq",
  "kotak",
  "qotag",
  "jalab",
  "sikay",
  "sikaman",
  "sikish",
  "sikib",
  "sikdim",
  "skaman",
  "dalbayob",
  "dolbayob",
  "dalbayop",
  "onangni",
  "onangn",
  "itvachcha",
  "haromi",
  "xaromi",
  "haromzoda",
  "xaromzoda",
  "xunasa",
  "qanjiq",
  "ahmoq",
  "axmoq",
];

const BAD_CYRILLIC = [
  "хуй",
  "хуе",
  "хуё",
  "пизд",
  "ебат",
  "ебал",
  "ебан",
  "бля",
  "сука",
  "мудак",
  "пидор",
  "пидар",
  "гандон",
  "залуп",
  "шлюх",
  "долбоеб",
  "долбоёб",
  "далбаёб",
  "далбаеб",
  "дебил",
  "қотақ",
  "котак",
  "жалаб",
  "сикай",
  "сикаман",
  "онангни",
  "аҳмоқ",
  "ахмоқ",
  "ахмок",
  "қанжиқ",
  "хунаса",
];

/** Xizmat nomlari: shu bilan boshlanadigan taxallus olinmaydi */
const RESERVED_PREFIX = ["mehmon", "admin", "moderator", "pikselqala", "telegram", "support"];
/** Aynan shu nomlar */
const RESERVED_EXACT = ["guest", "bot", "server", "system", "official", "rasmiy", "root", "null"];

/** Qidirish uchun: kichik harf, "_" siz, raqamlar o'xshash harfga (f0ck, 5uka) */
function normalize(s: string) {
  return s
    .toLowerCase()
    .replace(/_/g, "")
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/7/g, "t")
    .replace(/8/g, "b");
}

/** Matnda haqoratli so'z bormi (taxallus va boshqa joylar uchun) */
export function isRude(s: string) {
  const n = normalize(s);
  // takroriy harflar ham ("fuuuck") — bir harfga qisqartirilgan ko'rinishi ham tekshiriladi
  const squeezed = n.replace(/(.)\1+/g, "$1");
  const has = (w: string) => n.includes(w) || squeezed.includes(w);
  return BAD_LATIN.some(has) || BAD_CYRILLIC.some(has);
}

export type NickCheck = { ok: true; nick: string } | { ok: false; error: NickError };

/** Taxallusni tekshiradi (boshi va oxiridagi bo'shliqlar olib tashlanadi). */
export function checkNick(raw: string): NickCheck {
  const nick = raw.trim();
  const len = [...nick].length;
  if (len < NICK_MIN || len > NICK_MAX) return { ok: false, error: "length" };
  if (!ALLOWED.test(nick)) return { ok: false, error: "chars" };
  const latin = LATIN.test(nick);
  const cyr = CYRILLIC.test(nick);
  if (latin && cyr) return { ok: false, error: "script" };
  if (!latin && !cyr) return { ok: false, error: "letter" };
  const low = nick.toLowerCase();
  if (RESERVED_EXACT.includes(low) || RESERVED_PREFIX.some((p) => low.startsWith(p)))
    return { ok: false, error: "reserved" };
  if (isRude(nick)) return { ok: false, error: "bad" };
  return { ok: true, nick };
}

/** Takrorlanmaslik kaliti: katta-kichik harf farqsiz ("Ali" va "ali" — bitta) */
export const nickKey = (nick: string) => nick.trim().toLowerCase();

/** Telegram username taxallusga mos kelsa — o'zi, aks holda null */
export function nickFromTelegram(username: string | undefined | null): string | null {
  if (!username) return null;
  const c = checkNick(username.slice(0, NICK_MAX));
  return c.ok ? c.nick : null;
}
