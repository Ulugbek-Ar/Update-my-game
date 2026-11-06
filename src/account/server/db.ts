/**
 * Akkaunt ombori uchun SQL qatlami. Serverda — Durable Object SQLite (`ctx.storage.sql`,
 * server/src/account-do.ts), testlarda — Node'ning `node:sqlite` (memory-db.ts). Ikkalasi ham
 * sinxron: o'qish-tekshirish-yozish orasida `await` bo'lmasa, boshqa so'rov aralasha olmaydi.
 */

export type SqlValue = string | number | null;
export type Row = Record<string, SqlValue>;

export interface SqlCursor<T> {
  toArray(): T[];
}

export interface Db {
  /** Bitta SQL buyrug'i (? — parametrlar) */
  exec<T extends Row = Row>(query: string, ...bindings: SqlValue[]): SqlCursor<T>;
  /** Bir nechta buyruq birdaniga atomik (hammasi yoki hech biri) */
  tx<T>(fn: () => T): T;
}

/** Birinchi qator yoki null */
export function first<T extends Row>(db: Db, query: string, ...b: SqlValue[]): T | null {
  return db.exec<T>(query, ...b).toArray()[0] ?? null;
}

export function num(v: SqlValue | undefined): number {
  return typeof v === "number" ? v : Number(v ?? 0) || 0;
}

export function str(v: SqlValue | undefined): string {
  return typeof v === "string" ? v : v === null || v === undefined ? "" : String(v);
}

/**
 * Jadvallar. Yangi jadval qo'shilsa — shu ro'yxat oxiriga (IF NOT EXISTS: eski ma'lumot saqlanadi).
 * Har o'zgarish yozilgan qatorlar sifatida hisoblanadi (bepul tarif: kuniga 100 000) —
 * shuning uchun indekslar faqat kerakli joyda.
 */
export const SCHEMA: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL) WITHOUT ROWID`,
  // o'yinchi: Telegram ID, taxallus, avatar-qahramon, do'st kodi, XP (bulutli saqlanishdan)
  `CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY,
    tg INTEGER NOT NULL UNIQUE,
    nick TEXT NOT NULL,
    nick_key TEXT NOT NULL UNIQUE,
    avatar TEXT NOT NULL DEFAULT 'knight',
    code TEXT NOT NULL UNIQUE,
    created INTEGER NOT NULL,
    xp INTEGER NOT NULL DEFAULT 0
  )`,
  // sessiya: tokenning SHA-256 xeshi (token o'zi saqlanmaydi)
  `CREATE TABLE IF NOT EXISTS sessions (
    hash TEXT PRIMARY KEY,
    player INTEGER NOT NULL,
    created INTEGER NOT NULL,
    expires INTEGER NOT NULL,
    device TEXT NOT NULL
  ) WITHOUT ROWID`,
  `CREATE INDEX IF NOT EXISTS sessions_player ON sessions (player)`,
  // bot orqali kirish: bir martalik kod, 5 daqiqa
  `CREATE TABLE IF NOT EXISTS logins (
    code TEXT PRIMARY KEY,
    secret TEXT NOT NULL,
    created INTEGER NOT NULL,
    expires INTEGER NOT NULL,
    device TEXT NOT NULL,
    status TEXT NOT NULL,
    tg INTEGER,
    hint TEXT
  ) WITHOUT ROWID`,
  // bulutli saqlanish: har o'yinchiga bitta joriy nusxa
  `CREATE TABLE IF NOT EXISTS saves (
    player INTEGER PRIMARY KEY,
    version INTEGER NOT NULL,
    time INTEGER NOT NULL,
    at INTEGER NOT NULL,
    device TEXT NOT NULL,
    dev TEXT NOT NULL DEFAULT '',
    data TEXT NOT NULL
  )`,
  // zaxira: o'yinchi bo'yicha 5 ta joy (halqa)
  `CREATE TABLE IF NOT EXISTS backups (
    player INTEGER NOT NULL,
    slot INTEGER NOT NULL,
    version INTEGER NOT NULL,
    time INTEGER NOT NULL,
    at INTEGER NOT NULL,
    device TEXT NOT NULL,
    reason TEXT NOT NULL,
    data TEXT NOT NULL,
    PRIMARY KEY (player, slot)
  ) WITHOUT ROWID`,
  // do'stlar: (a -> b) req — so'rov, ok — do'st (ikki tomonga ikki qator), block — a b ni bloklagan
  `CREATE TABLE IF NOT EXISTS friends (
    a INTEGER NOT NULL,
    b INTEGER NOT NULL,
    status TEXT NOT NULL,
    since INTEGER NOT NULL,
    PRIMARY KEY (a, b)
  ) WITHOUT ROWID`,
  `CREATE INDEX IF NOT EXISTS friends_b ON friends (b, status)`,
  // onlayn holat: qayerda (menu / world / realm), olam xonasi (faqat do'stlarga ko'rinadi)
  `CREATE TABLE IF NOT EXISTS presence (
    player INTEGER PRIMARY KEY,
    at INTEGER NOT NULL,
    place TEXT NOT NULL,
    room TEXT NOT NULL DEFAULT ''
  )`,
  // do'stlar o'rtasidagi tayyor iboralar (erkin matn yo'q); yetkazilgach o'chadi
  `CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY,
    sender INTEGER NOT NULL,
    receiver INTEGER NOT NULL,
    phrase INTEGER NOT NULL,
    at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS messages_to ON messages (receiver, id)`,
  // reyting: jadval (w1:<qahramon>, endless, daily, ashking), davr (all, w:<dushanba>, d:<sana>),
  // har o'yinchiga eng yaxshisi; hidden — shubhali (ommaviy ro'yxatda ko'rinmaydi)
  `CREATE TABLE IF NOT EXISTS scores (
    board TEXT NOT NULL,
    period TEXT NOT NULL,
    player INTEGER NOT NULL,
    score INTEGER NOT NULL,
    at INTEGER NOT NULL,
    hidden INTEGER NOT NULL DEFAULT 0,
    meta TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (board, period, player)
  ) WITHOUT ROWID`,
  `CREATE INDEX IF NOT EXISTS scores_rank ON scores (board, period, hidden, score)`,
  // ---------------- gildiyalar (v3.3, docs/guilds.md) ----------------
  // gildiya: nomi va tegi takrorlanmas (kalit — katta-kichik harf farqsiz), gerb, qo'shilish usuli,
  // til, gildiya XP (daraja shundan), xazina, trofeylar (yengilgan bosslar, vergul bilan)
  `CREATE TABLE IF NOT EXISTS guilds (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    name_key TEXT NOT NULL UNIQUE,
    tag TEXT NOT NULL,
    tag_key TEXT NOT NULL UNIQUE,
    emblem TEXT NOT NULL,
    mode TEXT NOT NULL DEFAULT 'open',
    lang TEXT NOT NULL DEFAULT 'uz',
    created INTEGER NOT NULL,
    xp INTEGER NOT NULL DEFAULT 0,
    treasury INTEGER NOT NULL DEFAULT 0,
    trophies TEXT NOT NULL DEFAULT ''
  )`,
  // a'zolik: o'yinchi faqat bitta gildiyada; rol — leader | officer | member; muted — chatda jim
  // (shu vaqtgacha), given — xazinaga jami hissasi
  `CREATE TABLE IF NOT EXISTS guild_members (
    player INTEGER PRIMARY KEY,
    guild INTEGER NOT NULL,
    role TEXT NOT NULL,
    joined INTEGER NOT NULL,
    muted INTEGER NOT NULL DEFAULT 0,
    given INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS guild_members_guild ON guild_members (guild, role)`,
  // ariza (apply — o'yinchi so'radi) va taklif (invite — gildiya chaqirdi, by — kim)
  `CREATE TABLE IF NOT EXISTS guild_requests (
    guild INTEGER NOT NULL,
    player INTEGER NOT NULL,
    kind TEXT NOT NULL,
    by INTEGER NOT NULL DEFAULT 0,
    at INTEGER NOT NULL,
    PRIMARY KEY (guild, player)
  ) WITHOUT ROWID`,
  `CREATE INDEX IF NOT EXISTS guild_requests_player ON guild_requests (player)`,
  // gildiyadan chiqqandan keyin 24 soat boshqasiga qo'shilmaydi (sakrashga qarshi)
  `CREATE TABLE IF NOT EXISTS guild_cooldown (player INTEGER PRIMARY KEY, until INTEGER NOT NULL)`,
  // oltin yechiladigan so'rovlar (tuzish, xazinaga hissa): takror kelsa — bir marta hisoblanadi
  `CREATE TABLE IF NOT EXISTS guild_rids (
    player INTEGER NOT NULL,
    rid TEXT NOT NULL,
    at INTEGER NOT NULL,
    PRIMARY KEY (player, rid)
  ) WITHOUT ROWID`,
  // gildiya jurnali: tuzildi, qo'shildi, chiqdi, chiqarildi, rol, topshirildi, hissa...
  `CREATE TABLE IF NOT EXISTS guild_log (
    id INTEGER PRIMARY KEY,
    guild INTEGER NOT NULL,
    player INTEGER NOT NULL,
    kind TEXT NOT NULL,
    amount INTEGER NOT NULL DEFAULT 0,
    other INTEGER NOT NULL DEFAULT 0,
    at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS guild_log_guild ON guild_log (guild, id)`,
  // xazinaga kunlik hissa (o'yinchi bo'yicha — gildiya almashtirsa ham chegara bir xil)
  `CREATE TABLE IF NOT EXISTS guild_gifts (
    player INTEGER NOT NULL,
    day TEXT NOT NULL,
    amount INTEGER NOT NULL,
    PRIMARY KEY (player, day)
  ) WITHOUT ROWID`,
  // gildiya haftasi (dushanba, Toshkent): olingan gildiya XP, bajarilgan topshiriqlar, Kul qiroli
  // g'alabalari va eng tez vaqti (soniyaning o'ndan biri) — topshiriqlar va reyting shundan
  `CREATE TABLE IF NOT EXISTS guild_week (
    guild INTEGER NOT NULL,
    week TEXT NOT NULL,
    gxp INTEGER NOT NULL DEFAULT 0,
    quests INTEGER NOT NULL DEFAULT 0,
    ashking INTEGER NOT NULL DEFAULT 0,
    ashbest INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (guild, week)
  ) WITHOUT ROWID`,
  // haftalik topshiriqlar (3 ta): turi, maqsadi va bajarilgan vaqti (0 — hali)
  `CREATE TABLE IF NOT EXISTS guild_quests (
    guild INTEGER NOT NULL,
    week TEXT NOT NULL,
    slot INTEGER NOT NULL,
    kind TEXT NOT NULL,
    target INTEGER NOT NULL,
    done INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (guild, week, slot)
  ) WITHOUT ROWID`,
  // har a'zoning haftalik hissasi (bitta qator — yozuvlar tejaladi)
  `CREATE TABLE IF NOT EXISTS guild_qc (
    guild INTEGER NOT NULL,
    week TEXT NOT NULL,
    player INTEGER NOT NULL,
    kills INTEGER NOT NULL DEFAULT 0,
    bosses INTEGER NOT NULL DEFAULT 0,
    waves INTEGER NOT NULL DEFAULT 0,
    runs INTEGER NOT NULL DEFAULT 0,
    secrets INTEGER NOT NULL DEFAULT 0,
    ashking INTEGER NOT NULL DEFAULT 0,
    gold INTEGER NOT NULL DEFAULT 0,
    xp INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (guild, week, player)
  ) WITHOUT ROWID`,
  // topshiriq sovg'asi (oltin): klient oladi va olingan oxirgi raqamni progressida saqlaydi
  `CREATE TABLE IF NOT EXISTS guild_rewards (
    id INTEGER PRIMARY KEY,
    player INTEGER NOT NULL,
    guild INTEGER NOT NULL,
    gold INTEGER NOT NULL,
    kind TEXT NOT NULL,
    week TEXT NOT NULL,
    at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS guild_rewards_player ON guild_rewards (player, id)`,
  // gildiya chati: oxirgi 100 ta xabar; phrase — tayyor ibora raqami (-1 — erkin matn)
  `CREATE TABLE IF NOT EXISTS guild_chat (
    id INTEGER PRIMARY KEY,
    guild INTEGER NOT NULL,
    player INTEGER NOT NULL,
    text TEXT NOT NULL DEFAULT '',
    phrase INTEGER NOT NULL DEFAULT -1,
    at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS guild_chat_guild ON guild_chat (guild, id)`,
  // chat o'zgarishi (xabar o'chirildi): klient to'liq ro'yxatni qayta oladi
  `CREATE TABLE IF NOT EXISTS guild_chatrev (guild INTEGER PRIMARY KEY, rev INTEGER NOT NULL)`,
  // kelajakdagi "hududlar urushi" poydevori: olam hududlari ustidan gildiya nazorati
  // (controlled_by — gildiya raqami, hozircha hech kim; o'yin mantig'i hali yoqilmagan)
  `CREATE TABLE IF NOT EXISTS territories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    controlled_by INTEGER,
    since INTEGER NOT NULL DEFAULT 0
  ) WITHOUT ROWID`,
  // ---------------- muallif paneli, sovg'alar, ekspeditsiya (v3.4, docs/admin.md) ----------------
  // admin amallari jurnali: kim (admin), nima, kimga va tafsilot; denied — admin bo'lmagan urinish
  `CREATE TABLE IF NOT EXISTS admin_log (
    id INTEGER PRIMARY KEY,
    at INTEGER NOT NULL,
    admin INTEGER NOT NULL,
    action TEXT NOT NULL,
    target INTEGER NOT NULL DEFAULT 0,
    detail TEXT NOT NULL DEFAULT ''
  )`,
  // sovg'alar: muallifdan o'yinchiga (oltin, XP, qahramon, xat); claimed — olingan vaqt (0 — hali)
  `CREATE TABLE IF NOT EXISTS gifts (
    id INTEGER PRIMARY KEY,
    sender INTEGER NOT NULL,
    receiver INTEGER NOT NULL,
    gold INTEGER NOT NULL DEFAULT 0,
    xp INTEGER NOT NULL DEFAULT 0,
    hero TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    at INTEGER NOT NULL,
    claimed INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS gifts_receiver ON gifts (receiver, claimed)`,
  // sovg'adagi skin (v3.6): alohida jadval — gifts jadvaliga ustun qo'shilmaydi
  `CREATE TABLE IF NOT EXISTS gift_skins (
    gift INTEGER PRIMARY KEY,
    skin TEXT NOT NULL
  )`,
  // ekspeditsiya: o'yinchiga bitta (qahramon va boshlangan vaqt — server soati)
  `CREATE TABLE IF NOT EXISTS expeditions (
    player INTEGER PRIMARY KEY,
    hero TEXT NOT NULL,
    start INTEGER NOT NULL
  )`,
];

export function initSchema(db: Db) {
  for (const q of SCHEMA) db.exec(q);
}
