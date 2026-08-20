import { query } from "@db/pool";
import type { ListTransactionsFilters, TransactionListItem } from "@transactions/types";

export async function listTransactions(
  filters: ListTransactionsFilters
): Promise<TransactionListItem[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.journal_id !== undefined) {
    params.push(filters.journal_id);
    conditions.push(`t.journal_id = $${params.length}`);
  }

  if (filters.status !== undefined) {
    params.push(filters.status);
    conditions.push(`t.status = $${params.length}`);
  }

  if (filters.name !== undefined) {
    params.push(`%${filters.name}%`);
    conditions.push(`t.name ILIKE $${params.length}`);
  }

  if (filters.from !== undefined) {
    params.push(filters.from);
    conditions.push(`t.date >= $${params.length}`);
  }

  if (filters.to !== undefined) {
    params.push(filters.to);
    conditions.push(`t.date <= $${params.length}`);
  }

  if (filters.created_after !== undefined) {
    params.push(filters.created_after);
    conditions.push(`t.created_at >= $${params.length}`);
  }

  if (filters.created_before !== undefined) {
    params.push(filters.created_before);
    conditions.push(`t.created_at <= $${params.length}`);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const rows = await query<{
    id: number;
    date: string | null;
    name: string | null;
    status: TransactionListItem["status"];
    created_at: string;
    posted_at: string | null;
    journal_id: number | null;
    journal_name: string | null;
  }>(
    // LEFT JOIN, not JOIN: a draft can have a null journal_id, and an
    // inner join would silently drop those rows from the whole list.
    `SELECT
       t.id,
       t.date,
       t.name,
       t.status,
       t.created_at,
       t.posted_at,
       j.id AS journal_id,
       j.name AS journal_name
     FROM transactions t
     LEFT JOIN journals j ON j.id = t.journal_id
     ${whereClause}
     ORDER BY t.date, t.id`,
    params
  );

  return rows.map((row) => ({
    id: row.id,
    date: row.date,
    name: row.name,
    status: row.status,
    created_at: row.created_at,
    posted_at: row.posted_at,
    journal: row.journal_id !== null ? { id: row.journal_id, name: row.journal_name! } : null,
  }));
}
