/**
 * Reyting (klient): tugagan o'yin natijasi serverga (faqat kirgan o'yinchi), internet bo'lmasa —
 * navbatda kutadi (qurilmada, ko'pi bilan 10 ta) va keyin yuboriladi. Top-50 va o'z o'rni.
 */
import type { RunResult } from "@/game/game";
import { account } from "./account";
import { call } from "./api";
import { SCORE_QUEUE_KEY } from "./keys";
import type { ScoreTop } from "./protocol";
import type { BoardId } from "./scoring";

const QUEUE_MAX = 10;

function loadQueue(): RunResult[] {
  try {
    const q = JSON.parse(localStorage.getItem(SCORE_QUEUE_KEY) ?? "[]") as unknown;
    return Array.isArray(q) ? (q as RunResult[]).slice(-QUEUE_MAX) : [];
  } catch {
    return [];
  }
}

function saveQueue(q: RunResult[]) {
  try {
    if (q.length) localStorage.setItem(SCORE_QUEUE_KEY, JSON.stringify(q.slice(-QUEUE_MAX)));
    else localStorage.removeItem(SCORE_QUEUE_KEY);
  } catch {
    /* saqlash imkonsiz */
  }
}

async function send(r: RunResult) {
  const token = account.sessionToken;
  if (!token) return null;
  return call("scores/submit", {
    token,
    mode: r.mode,
    hero: r.hero,
    score: Math.max(0, Math.floor(r.score)),
    wave: Math.max(0, Math.floor(r.wave)),
    time: Math.max(0, Math.round(r.time * 10) / 10),
    won: r.won,
    ...(r.date ? { date: r.date } : {}),
  });
}

/** O'yin tugadi: natija reytingga (mehmon — hech narsa). Internet yo'q — navbatga. */
export async function submitRun(r: RunResult) {
  if (!account.sessionToken || r.score <= 0) return null;
  const res = await send(r);
  if (res && !res.ok && res.error === "net") saveQueue([...loadQueue(), r]);
  return res;
}

/** Navbatdagi natijalar (ilova ochilganda, kirganda, internet qaytganda) */
export async function flushScores() {
  const q = loadQueue();
  if (!q.length || !account.sessionToken) return;
  const left: RunResult[] = [];
  for (const r of q) {
    const res = await send(r);
    if (res && !res.ok && res.error === "net") left.push(r);
  }
  saveQueue(left);
}

/** Top-50 va o'z o'rni (kirmagan bo'lsa — faqat ro'yxat) */
export async function topScores(board: BoardId, period: "week" | "all"): Promise<ScoreTop | null> {
  const token = account.sessionToken;
  const r = await call("scores/top", { board, period, ...(token ? { token } : {}) });
  if (!r.ok) return null;
  const { ok: _ok, ...top } = r;
  return top;
}

account.onLogin(() => {
  void flushScores();
});
