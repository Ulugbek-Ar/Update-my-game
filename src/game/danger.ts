/**
 * XAVF RANGLARI — faqat dushmanniki. Boss va moblarning ogohlantirish zonalari (qizil doira, olov
 * yo'lagi, muz doirasi va h.k.) shu ranglarda chiziladi; o'yinchi skin effektlari (skinFx.ts) bu
 * ranglarga o'xshamasligi kerak — o'yinchi "qayerga bosmaslik kerak"ni effektlardan ajrata olsin.
 *
 * Yangi ogohlantirish zonasi qo'shilsa — rangi shu ro'yxatga qo'shiladi (skinFx.test.ts barcha skin
 * effekt ranglarini ro'yxatdan yetarlicha uzoqligini tekshiradi). Ranglar yarim shaffof ishlatiladi:
 * withAlpha(DANGER.slam, a).
 */
export const DANGER = {
  /** Iblis: olov yo'lagi va yerdagi olov izi */
  fireLane: "#ff5a1e",
  /** Iblis: yonuvchi arena cheti */
  fireEdge: "#ff4614",
  /** Iblis: arena qayerga qadar yonishi (uzuq chiziq) */
  edgeWarn: "#ff8c28",
  /** Boss paydo bo'layotgan joy */
  spawn: "#b23238",
  /** Boss yerga urishi — qizil doira */
  slam: "#ff3c3c",
  /** Boyo'g'li sho'ng'ish nuqtasi */
  owlMark: "#ff4646",
  /** Muz golemi yerga urishi — qizil doira va to'ldirish */
  stomp: "#dc1e28",
  stompFill: "#e62832",
  /** Qor Malikasi: muz pol, nur va nayza ogohlantirishi */
  iceWarn: "#143caa",
  iceFill: "#1e5ad2",
  /** Ayozli ruh: sovuq nafas */
  breath: "#1e5ac8",
  breathFill: "#3c8ce6",
  /** Onlayn: Sardorning yer yorig'i halqalari */
  quakeRing: "#ff7a2a",
} as const;

export type DangerId = keyof typeof DANGER;

export const DANGER_COLORS: readonly string[] = Object.values(DANGER);

const rgb = (c: string) => {
  const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])] as const;
  const n = parseInt(c.slice(1, 7), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
};

/**
 * Ikki rang orasidagi ko'rinadigan farq ("redmean" — inson ko'zi yashil va qizilga sezgirroq).
 * 0 — bir xil, ~765 — oq va qora. "#rrggbb" yoki "rgba(r,g,b,a)".
 */
export function colorDistance(a: string, b: string) {
  const [r1, g1, b1] = rgb(a),
    [r2, g2, b2] = rgb(b);
  const rm = (r1 + r2) / 2;
  const dr = r1 - r2,
    dg = g1 - g2,
    db = b1 - b2;
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db);
}

/** Rangning eng yaqin xavf rangigacha masofasi */
export function dangerDistance(color: string) {
  return Math.min(...DANGER_COLORS.map((d) => colorDistance(color, d)));
}
