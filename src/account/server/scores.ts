/**
 * Reyting (serverda): haftalik (dushanba 00:00 Toshkent) va umumiy; har qahramon bo'yicha 1-dunyo,
 * cheksiz rejim, kunlik sinov va Kul qirolini eng tez yengganlar (jamoa — olam serveri xabar
 * qiladi, klient emas). Har o'yinchiga jadval va davr bo'yicha bitta qator — eng yaxshisi.
 */
import {
  BOARDS,
  isBoard,
  judgeRaid,
  judgeRun,
  lowerIsBetter,
  nextWeekStart,
  tashkentDay,
  weekKey,
  type BoardId,
  type RunInput,
} from "../scoring";
import { HERO_IDS, type ScoreRow, type ScoreTop } from "../protocol";
import { levelOf } from "../xp";
import { first, num, str, type Row } from "./db";
import type { AccountStore, PlayerRow } from "./store";
import type { Hero } from "@/game/hero";

/** Top shuncha qator */
export const TOP_N = 50;
const DAY = 86_400_000;
/** Eski haftalik va kunlik qatorlar shu oraliqda bir tozalanadi */
const PRUNE_EVERY = 3600_000;

interface ScoreDbRow extends Row {
  player: number;
  score: number;
  at: number;
  hidden: number;
  meta: string;
}

export interface SubmitInput extends RunInput {
  hero: Hero;
  date?: string | undefined;
}

export type SubmitResult =
  | { ok: true; hidden: boolean; best: number; rank: number | null }
  | { ok: false; error: "invalid" | "limit" | "bad" };

const heroOf = (s: unknown) => HERO_IDS.find((h) => h === s);

export class Scores {
  private prunedAt = 0;

  constructor(private store: AccountStore) {}

  private get db() {
    return this.store.db;
  }

  /** Eng yaxshisini yozish (yomonroq natija — o'zgarmaydi) */
  private put(
    board: BoardId,
    period: string,
    player: number,
    score: number,
    now: number,
    hidden: boolean,
    meta: unknown,
  ) {
    const better = lowerIsBetter(board) ? "<" : ">";
    this.db.exec(
      `INSERT INTO scores (board, period, player, score, at, hidden, meta) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (board, period, player) DO UPDATE SET score = excluded.score, at = excluded.at,
         hidden = excluded.hidden, meta = excluded.meta
       WHERE excluded.score ${better} scores.score`,
      board,
      period,
      player,
      score,
      now,
      hidden ? 1 : 0,
      JSON.stringify(meta),
    );
  }

  private prune(now: number) {
    if (now - this.prunedAt < PRUNE_EVERY) return;
    this.prunedAt = now;
    this.db.exec(
      "DELETE FROM scores WHERE period LIKE 'w:%' AND period < ?",
      `w:${weekKey(now - 21 * DAY)}`,
    );
    this.db.exec(
      "DELETE FROM scores WHERE period LIKE 'd:%' AND period < ?",
      `d:${tashkentDay(now - 8 * DAY)}`,
    );
  }

  /** O'yin natijasi. Imkonsiz — rad; shubhali — yashirin saqlanadi. */
  submit(p: PlayerRow, r: SubmitInput, now: number): SubmitResult {
    const verdict = judgeRun(r);
    if (verdict === "reject") return { ok: false, error: "invalid" };
    const board: BoardId =
      r.mode === "world" ? `w1:${r.hero}` : r.mode === "endless" ? "endless" : "daily";
    if (!isBoard(board)) return { ok: false, error: "bad" };
    // 1-dunyo jadvaliga faqat to'liq yoki 1-dunyoda tugagan o'yin (cheksiz — alohida)
    const hidden = verdict === "hidden";
    const meta = { h: r.hero, w: r.wave, t: Math.round(r.time) };
    const week = `w:${weekKey(now)}`;
    const result = this.db.tx((): SubmitResult => {
      if (r.mode === "daily") {
        // kunlik sinov: bir kunda bitta urinish (sana — klientniki, Toshkent ±1 kun)
        const date = r.date ?? tashkentDay(now);
        const days = [tashkentDay(now - DAY), tashkentDay(now), tashkentDay(now + DAY)];
        if (!days.includes(date)) return { ok: false, error: "bad" };
        if (
          first(
            this.db,
            "SELECT 1 AS x FROM scores WHERE board = 'daily' AND period = ? AND player = ?",
            `d:${date}`,
            p.id,
          )
        )
          return { ok: false, error: "limit" };
        this.put("daily", `d:${date}`, p.id, r.score, now, hidden, meta);
      }
      this.put(board, week, p.id, r.score, now, hidden, meta);
      this.put(board, "all", p.id, r.score, now, hidden, meta);
      const mine = first<ScoreDbRow>(
        this.db,
        "SELECT * FROM scores WHERE board = ? AND period = ? AND player = ?",
        board,
        week,
        p.id,
      );
      const best = num(mine?.score);
      const isHidden = num(mine?.hidden) === 1;
      return {
        ok: true,
        hidden: isHidden,
        best,
        rank: mine && !isHidden ? this.rankOf(board, week, mine) : null,
      };
    });
    this.prune(now);
    return result;
  }

  /** Olam serveri: Kul qiroli yengildi (jamoadagi kirgan o'yinchilar, vaqt — soniya) */
  raid(team: number[], secs: number, now: number) {
    const verdict = judgeRaid(secs);
    if (verdict === "reject" || !team.length) return { ok: false as const };
    const score = Math.round(secs * 10);
    const week = `w:${weekKey(now)}`;
    this.db.tx(() => {
      for (const id of team) {
        if (!this.store.player(id)) continue;
        this.put("ashking", week, id, score, now, verdict === "hidden", { team });
        this.put("ashking", "all", id, score, now, verdict === "hidden", { team });
      }
    });
    return { ok: true as const, hidden: verdict === "hidden" };
  }

  private rankOf(board: BoardId, period: string, row: ScoreDbRow) {
    const lower = lowerIsBetter(board);
    const n = num(
      first(
        this.db,
        `SELECT COUNT(*) AS n FROM scores WHERE board = ? AND period = ? AND hidden = 0
           AND (score ${lower ? "<" : ">"} ? OR (score = ? AND at < ?))`,
        board,
        period,
        num(row.score),
        num(row.score),
        num(row.at),
      )?.["n"],
    );
    return n + 1;
  }

  private row(
    r: ScoreDbRow & { nick: string; avatar: string; xp: number },
    rank: number,
  ): ScoreRow {
    let meta: { h?: unknown; w?: unknown; team?: unknown } = {};
    try {
      meta = JSON.parse(str(r.meta) || "{}") as typeof meta;
    } catch {
      /* buzuq meta */
    }
    const out: ScoreRow = {
      rank,
      id: num(r.player),
      nick: str(r.nick),
      avatar: heroOf(r.avatar) ?? "knight",
      level: levelOf(num(r.xp)),
      score: num(r.score),
    };
    const hero = heroOf(meta.h);
    if (hero) out.hero = hero;
    if (typeof meta.w === "number") out.wave = meta.w;
    if (Array.isArray(meta.team))
      out.team = meta.team
        .map((id) => (typeof id === "number" ? this.store.player(id)?.nick : undefined))
        .filter((n): n is string => typeof n === "string");
    return out;
  }

  /** Top-50 (yashirinlarsiz) va o'z o'rni */
  top(boardId: string, period: "week" | "all", me: PlayerRow | null, now: number): ScoreTop | null {
    if (!isBoard(boardId)) return null;
    const board = boardId;
    const key = period === "week" ? `w:${weekKey(now)}` : "all";
    const order = lowerIsBetter(board) ? "ASC" : "DESC";
    const list = this.db
      .exec<ScoreDbRow & { nick: string; avatar: string; xp: number }>(
        `SELECT s.player, s.score, s.at, s.hidden, s.meta, p.nick, p.avatar, p.xp
           FROM scores s JOIN players p ON p.id = s.player
          WHERE s.board = ? AND s.period = ? AND s.hidden = 0
          ORDER BY s.score ${order}, s.at ASC LIMIT ?`,
        board,
        key,
        TOP_N,
      )
      .toArray();
    const rows = list.map((r, i) => this.row(r, i + 1));
    let mine: ScoreTop["me"] = null;
    if (me) {
      const r = first<ScoreDbRow>(
        this.db,
        "SELECT * FROM scores WHERE board = ? AND period = ? AND player = ?",
        board,
        key,
        me.id,
      );
      if (r) {
        const hidden = num(r.hidden) === 1;
        const rank = hidden ? 0 : this.rankOf(board, key, r);
        mine = {
          ...this.row({ ...r, nick: me.nick, avatar: me.avatar, xp: me.xp }, rank),
          hidden,
        };
      }
    }
    return { rows, me: mine, week: weekKey(now), resets: nextWeekStart(now) };
  }

  /** Akkaunt o'chirilganda */
  forget(player: number) {
    this.db.exec("DELETE FROM scores WHERE player = ?", player);
  }

  static boards() {
    return BOARDS;
  }
}
