/**
 * Testlar uchun: Node'ning o'rnatilgan SQLite'i (node:sqlite) — Durable Object SQLite bilan bir xil
 * SQL. Faqat testlar va lokal skriptlar import qiladi (brauzer va Worker build'iga kirmaydi).
 */
import { DatabaseSync } from "node:sqlite";
import type { Db, Row, SqlValue } from "./db";

export function memoryDb(): Db & { rowsWritten: () => number } {
  const d = new DatabaseSync(":memory:");
  let written = 0;
  let depth = 0;
  return {
    exec<T extends Row = Row>(query: string, ...bindings: SqlValue[]) {
      const st = d.prepare(query);
      const reads = /^\s*(SELECT|WITH)\b/i.test(query) || /\bRETURNING\b/i.test(query);
      if (reads) {
        const rows = st.all(...bindings) as T[];
        return { toArray: () => rows };
      }
      const r = st.run(...bindings);
      written += Number(r.changes);
      return { toArray: () => [] as T[] };
    },
    tx<T>(fn: () => T): T {
      if (depth > 0) return fn();
      depth++;
      d.exec("BEGIN");
      try {
        const out = fn();
        d.exec("COMMIT");
        return out;
      } catch (e) {
        d.exec("ROLLBACK");
        throw e;
      } finally {
        depth--;
      }
    },
    rowsWritten: () => written,
  };
}
