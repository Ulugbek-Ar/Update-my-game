/** Bosh menyu foni: qasr, oy va yulduzlar fonida qahramonlar va moblar (kod bilan chiziladi). */
import { px } from "./animation";
import { renderSprite, spriteSize, type SpriteKind } from "./sprites";
import { HERO_THEME, withAlpha } from "./hero";

/** Sahna o'lchami: 16:9 ekranni to'liq qoplaydi */
export const SCENE_W = 320;
export const SCENE_H = 180;
const GROUND = 150;

/** Sahnadagi qahramonlar (chapda, o'ngga qaragan) va moblar (o'ngda, chapga qaragan) */
const CAST: readonly { kind: SpriteKind; x: number; y: number; flip: boolean; phase: number }[] = [
  // 3.0: Paladin chetda — ulkan qilichi yelkasida orqaga qaraydi, menyu tugmalari ostiga tushmaydi
  { kind: "paladin", x: 24, y: GROUND - 14, flip: false, phase: 0.85 },
  { kind: "knight", x: 45, y: GROUND - 14, flip: false, phase: 0 },
  { kind: "mage", x: 64, y: GROUND - 12, flip: false, phase: 0.3 },
  { kind: "hunter", x: 83, y: GROUND - 14, flip: false, phase: 0.6 },
  { kind: "skeleton", x: 226, y: GROUND - 14, flip: true, phase: 0.2 },
  { kind: "slime", x: 247, y: GROUND - 8, flip: true, phase: 0.5 },
  { kind: "wolf", x: 268, y: GROUND - 13, flip: true, phase: 0.1 },
  { kind: "treant", x: 294, y: GROUND - 19, flip: true, phase: 0.4 },
];

/**
 * Past ekran (telefon gorizontal): menyu tugmalari sahnaning o'rtasini egallaydi, shuning uchun
 * figuralar kichrayib, ekran chetlariga suriladi (tugmalar ustiga tushmaydi).
 */
const CAST_COMPACT: readonly { x: number; scale: number }[] = [
  { x: 15, scale: 0.62 },
  { x: 29, scale: 0.62 },
  { x: 43, scale: 0.62 },
  { x: 57, scale: 0.62 },
  { x: 271, scale: 0.62 },
  { x: 283, scale: 0.62 },
  { x: 295, scale: 0.62 },
  { x: 309, scale: 0.62 },
];

/**
 * Boyo'g'li o'ng chetdagi Daraxt odamning tojida o'tiradi: qasr minorasi menyu ko'rsatmalari ortida
 * qolib ketardi (telefonda matn ustiga tushardi). compact — past ekran (figuralar kichik, chetda).
 */
const TREANT = CAST.findIndex((a) => a.kind === "treant");
/** Boyo'g'li markazi Daraxt odam sprite qutisi tepasidan shuncha yuqorida (1x masshtabda) */
const OWL_ABOVE = 5.4;
export function owlPerch(compact: boolean) {
  const a = CAST[TREANT]!;
  const k = compact ? CAST_COMPACT[TREANT]! : { x: a.x, scale: 1 };
  const footY = GROUND + 4;
  const top = a.y - footY - spriteSize("treant") / 2 - OWL_ABOVE;
  return { x: k.x, y: Math.round(footY + top * k.scale), scale: k.scale };
}

/** Tasodifiy, lekin har safar bir xil yulduzlar */
const STARS = Array.from({ length: 60 }, (_, i) => ({
  x: (i * 97 + 13) % SCENE_W,
  y: (i * 53 + 7) % 92,
  big: i % 9 === 0,
  speed: 1 + (i % 5) * 0.4,
}));

let still: HTMLCanvasElement | null = null;

/** Qimirlamaydigan qism (osmon, oy, tepaliklar, qasr) bir marta chiziladi. */
export function background() {
  if (still) return still;
  const cv = document.createElement("canvas");
  cv.width = SCENE_W;
  cv.height = SCENE_H;
  const c = cv.getContext("2d")!;
  // osmon: pastga qarab yorishadigan qatlamlar
  const bands = ["#07061a", "#0b0a22", "#100e2c", "#161336", "#1d1840", "#251d48"];
  bands.forEach((col, i) => px(c, col, 0, i * 20, SCENE_W, 20));
  px(c, "#2c2250", 0, 120, SCENE_W, 60);
  // oy va uning gardishi
  const mx = 258,
    my = 36;
  for (const [r, col] of [
    [26, "#141230"],
    [22, "#1a1838"],
  ] as const)
    for (let y = -r; y <= r; y++) {
      const w = Math.round(Math.sqrt(r * r - y * y));
      px(c, col, mx - w, my + y, w * 2, 1);
    }
  for (let y = -15; y <= 15; y++) {
    const w = Math.round(Math.sqrt(225 - y * y));
    px(c, "#f2ecd0", mx - w, my + y, w * 2, 1);
    px(c, "#d8cfae", mx + w - 4, my + y, 4, 1);
  }
  px(c, "#d8cfae", mx - 7, my - 6, 5, 4);
  px(c, "#d8cfae", mx + 3, my + 4, 4, 3);
  px(c, "#d8cfae", mx - 3, my + 8, 3, 2);
  // uzoq tepaliklar
  for (let x = 0; x < SCENE_W; x++) {
    const h = 18 + Math.round(Math.sin(x / 23) * 6 + Math.sin(x / 9) * 2);
    px(c, "#1a1430", x, 132 - h, 1, h + 20);
  }
  // qasr: tepalik ustida, minoralar va tishli devorlar
  const base = 128;
  const tower = (x: number, w: number, h: number) => {
    px(c, "#120e22", x, base - h, w, h);
    for (let k = 0; k < w; k += 4) px(c, "#120e22", x + k, base - h - 3, 2, 3);
    px(c, "#1c1630", x + 1, base - h, 1, h);
  };
  px(c, "#120e22", 112, base - 22, 96, 24);
  for (let k = 112; k < 208; k += 5) px(c, "#120e22", k, base - 25, 3, 3);
  tower(104, 14, 44);
  tower(150, 20, 58);
  tower(198, 14, 40);
  // markaziy minora uchi (bayroq yo'q: u qahramon kartalari ortida qizil dog' bo'lib ko'rinardi)
  for (let k = 0; k < 10; k++) px(c, "#120e22", 160 - k, base - 58 - 10 + k, k * 2 + 1, 1);
  // darvoza
  px(c, "#07050e", 152, base - 12, 16, 14);
  px(c, "#07050e", 154, base - 15, 12, 3);
  // yaqin yer: to'q yashil o'tloq va yo'lak
  for (let x = 0; x < SCENE_W; x++) {
    const h = Math.round(Math.sin(x / 31) * 3);
    px(c, "#14261a", x, GROUND - 6 + h, 1, SCENE_H);
    px(c, "#1f3d22", x, GROUND - 6 + h, 1, 2);
  }
  px(c, "#2a1d12", 140, GROUND - 4, 40, SCENE_H);
  px(c, "#3a2817", 146, GROUND - 4, 28, SCENE_H);
  for (let i = 0; i < 40; i++) {
    const x = (i * 41) % SCENE_W,
      y = GROUND + ((i * 13) % 24);
    if (x > 136 && x < 184) continue;
    px(c, i % 3 ? "#2f5a2c" : "#3f6b3a", x, y, 1, 3);
    px(c, "#2f5a2c", x + 2, y + 1, 1, 2);
  }
  still = cv;
  return cv;
}

/** Ko'rshapalaklar oy oldidan sekin uchib o'tadi. */
function bats(c: CanvasRenderingContext2D, t: number) {
  for (let i = 0; i < 3; i++) {
    const k = ((t * 0.04 + i * 0.37) % 1.2) - 0.1;
    const x = k * (SCENE_W + 40) - 20;
    const y = 26 + i * 16 + Math.sin(t * 1.6 + i * 2) * 8;
    c.save();
    c.translate(Math.round(x), Math.round(y));
    c.scale(0.6, 0.6);
    renderSprite(c, "bat", "walk", Math.floor(t * 7 + i) % 4, 0, 0, false, i % 2 === 1);
    c.restore();
  }
}

/** Butun sahnani SCENE_W x SCENE_H koordinatalarda chizadi; t — soniya; compact — past ekran. */
export function renderMenuScene(c: CanvasRenderingContext2D, t: number, compact = false) {
  c.imageSmoothingEnabled = false;
  c.drawImage(background(), 0, 0);
  // miltillovchi yulduzlar
  for (const [i, s] of STARS.entries()) {
    const b = Math.sin(t * s.speed + i * 1.7);
    if (b < -0.55) continue;
    px(c, b > 0.7 ? "#ffffff" : i % 4 ? "#8a84a8" : "#e0d6ee", s.x, s.y, 1, 1);
    if (s.big && b > 0.5) {
      px(c, "#8a84a8", s.x - 1, s.y, 1, 1);
      px(c, "#8a84a8", s.x + 1, s.y, 1, 1);
      px(c, "#8a84a8", s.x, s.y - 1, 1, 1);
      px(c, "#8a84a8", s.x, s.y + 1, 1, 1);
    }
  }
  // qasr derazalarida yonib-o'chuvchi chiroq
  for (const [i, [wx, wy]] of (
    [
      [109, 96],
      [158, 82],
      [163, 96],
      [203, 100],
      [130, 112],
      [186, 112],
    ] as const
  ).entries()) {
    const fl = Math.sin(t * (3 + i) + i * 2) > -0.6;
    px(c, fl ? "#ffcc33" : "#a8741a", wx, wy, 2, 3);
  }
  bats(c, t);
  // qahramonlar va moblar: sekin "nafas oladi"
  CAST.forEach((a, i) => {
    const frame = Math.floor(t * 2 + a.phase * 2) % 2;
    const k = compact ? CAST_COMPACT[i]! : { x: a.x, scale: 1 };
    // oyoqlari yerda qoladi: kichraytirish yer chizig'iga nisbatan
    const footY = GROUND + 4;
    c.fillStyle = "rgba(0,0,0,0.35)";
    c.fillRect(k.x - 7 * k.scale, GROUND - 1, 14 * k.scale, 2);
    c.save();
    c.translate(k.x, footY);
    c.scale(k.scale, k.scale);
    renderSprite(c, a.kind, "idle", frame, 0, a.y - footY, false, a.flip);
    c.restore();
  });
  // boyo'g'li Daraxt odamning tojida; Daraxt odam nafas olganda (idle 1-kadr) toji
  // 1 sprite piksel pastga tushadi — boyo'g'li ham birga
  const owl = owlPerch(compact);
  const breath = Math.floor(t * 2 + CAST[TREANT]!.phase * 2) % 2;
  const bob = Math.round((breath * spriteSize("treant") * owl.scale) / 32);
  c.save();
  c.translate(owl.x, owl.y + bob);
  c.scale(owl.scale, owl.scale);
  renderSprite(c, "owl", "idle", Math.floor(t * 0.7) % 2, 0, 0, false, true);
  c.restore();
}

// ---------------- "Yangiliklar" oynasi uchun 2.0 rasmlari (160x120) ----------------

/** Zulmat o'rmoni: O'rmon Shohi, o'rgimchak, qo'ziqorin va boyo'g'li, svetlyachoklar. */
export function drawForestCard(c: CanvasRenderingContext2D, t = 0) {
  c.imageSmoothingEnabled = false;
  px(c, "#0f1a10", 0, 0, 160, 120);
  for (let y = 0; y < 120; y += 8) px(c, y % 16 ? "#16231a" : "#13201a", 0, y + 60, 160, 8);
  for (let x = 0; x < 160; x += 9) px(c, "#2a1d12", x, 0, 6, 18 + ((x * 7) % 9));
  px(c, "#14261a", 0, 0, 160, 4);
  const glow = c.createRadialGradient(80, 62, 6, 80, 62, 60);
  glow.addColorStop(0, "rgba(200,255,120,0.22)");
  glow.addColorStop(1, "rgba(200,255,120,0)");
  c.fillStyle = glow;
  c.fillRect(0, 0, 160, 120);
  renderSprite(c, "king", "attack", 2, 80, 60, false);
  renderSprite(c, "spider", "walk", 1, 28, 98, false);
  renderSprite(c, "shroom", "attack", 2, 134, 96, false, true);
  renderSprite(c, "owl", "walk", 0, 132, 30, false, true);
  for (let i = 0; i < 10; i++) {
    const on = Math.sin(t * 2 + i * 1.9) > -0.3;
    if (on) px(c, i % 2 ? "#e8ff8a" : "#a6f08e", (i * 37 + 11) % 160, 20 + ((i * 29) % 90), 1, 1);
  }
}

/** Ovchi: kamonni to'liq tortgan, oldida uchayotgan o'q va oyog'i ostida tuzoq. */
export function drawHunterCard(c: CanvasRenderingContext2D) {
  c.imageSmoothingEnabled = false;
  const bands = ["#10200f", "#142814", "#183018", "#1c381c"];
  bands.forEach((col, i) => px(c, col, 0, i * 30, 160, 30));
  px(c, "#2a1d12", 0, 100, 160, 20);
  px(c, "#3a2817", 0, 100, 160, 2);
  c.save();
  c.translate(62, 64);
  c.scale(2, 2);
  renderSprite(c, "hunter", "attack", 1, 0, 0, false);
  c.restore();
  // uchayotgan kuchli o'q
  c.fillStyle = "rgba(166,240,142,0.35)";
  c.fillRect(110, 57, 34, 7);
  px(c, "#c9a26b", 112, 60, 26, 1);
  px(c, "#d9d4e0", 138, 59, 3, 3);
  px(c, "#4f8a3a", 110, 58, 2, 1);
  px(c, "#4f8a3a", 110, 62, 2, 1);
  // tuzoq
  px(c, "#1a1a20", 104, 100, 22, 9);
  px(c, "#5a3e24", 105, 101, 20, 7);
  for (let k = 0; k < 20; k += 3) {
    px(c, "#e8e8f0", 106 + k, 101, 1, 2);
    px(c, "#e8e8f0", 106 + k, 106, 1, 2);
  }
}

/** 3.0 e'loni: Paladin SHANG zarbasi — ulkan qilich yerga tushgan, yo'lak bo'ylab nurli yoriq va uchqunlar. */
export function drawPaladinCard(c: CanvasRenderingContext2D) {
  c.imageSmoothingEnabled = false;
  const T = HERO_THEME.paladin;
  // ibodatxona qorong'iligi: sovuq binafsha-ko'k fonda oltin nur aniq ko'rinadi
  const bands = ["#120f1c", "#171324", "#1c172c", "#221b34"];
  bands.forEach((col, i) => px(c, col, 0, i * 30, 160, 30));
  px(c, "#1e1a26", 0, 100, 160, 20);
  px(c, "#3a3446", 0, 100, 160, 2);
  // yoriq: qilich uchidan oldinga — ichida oq yadro, oltin chekka
  for (let x = 92; x < 150; x++) {
    const y = 103 + Math.round(Math.sin(x * 0.7) * 1.2);
    px(c, "#1e1606", x, y, 2, 2);
    if (x % 2 === 0) px(c, x % 4 === 0 ? T.glow : T.accent, x, y, 1, 1);
  }
  for (let k = 0; k < 9; k++) px(c, k % 2 ? T.glow : T.accent, 96 + k * 6, 92 - (k % 3) * 4, 2, 2);
  c.save();
  c.translate(46, 70);
  c.scale(2, 2);
  renderSprite(c, "paladin", "attack", 2, 0, 0, false);
  c.restore();
  // "SHANG!" yozuvi o'rniga muqaddas nur chaqnashi
  c.fillStyle = withAlpha(T.glow, 0.3);
  c.fillRect(70, 84, 84, 18);
}

/** 3.0 e'loni: rollar — to'rt rol belgisi va qahramonlar. */
export function drawRolesCard(c: CanvasRenderingContext2D) {
  c.imageSmoothingEnabled = false;
  px(c, "#141022", 0, 0, 160, 120);
  px(c, "#1f1730", 0, 92, 160, 28);
  const heroes: [SpriteKind, string][] = [
    ["paladin", HERO_THEME.paladin.accent],
    ["knight", "#68cde4"],
    ["mage", "#ff4d4d"],
    ["hunter", "#a6f08e"],
  ];
  heroes.forEach(([kind, col], i) => {
    const x = 26 + i * 36;
    px(c, col, x - 12, 96, 24, 2);
    renderSprite(c, kind, "idle", 0, x, 76, false);
  });
}

/** 3.0 e'loni: tank bossni ushlab turadi — QASAM aurasi, Sardor tankka qaragan, do'stlar orqada. */
export function drawTankCard(c: CanvasRenderingContext2D) {
  c.imageSmoothingEnabled = false;
  px(c, "#1b2420", 0, 0, 160, 120);
  px(c, "#24302a", 0, 80, 160, 40);
  // aura: oltin halqa, oq yadro
  c.strokeStyle = withAlpha(HERO_THEME.paladin.accent, 0.8);
  c.lineWidth = 2;
  c.beginPath();
  c.ellipse(70, 92, 18, 9, 0, 0, Math.PI * 2);
  c.stroke();
  c.strokeStyle = "rgba(255,255,255,0.5)";
  c.lineWidth = 1;
  c.beginPath();
  c.ellipse(70, 92, 18, 9, 0, 0, Math.PI * 2);
  c.stroke();
  c.strokeStyle = withAlpha(HERO_THEME.paladin.glow, 0.35);
  c.setLineDash([3, 4]);
  c.beginPath();
  c.arc(70, 84, 44, 0, Math.PI * 2);
  c.stroke();
  c.setLineDash([]);
  renderSprite(c, "warden", "attack", 0, 118, 62, false, true);
  renderSprite(c, "paladin", "idle", 0, 70, 84, false);
  renderSprite(c, "hunter", "attack", 1, 22, 70, false);
  renderSprite(c, "mage", "attack", 1, 30, 100, false);
}
