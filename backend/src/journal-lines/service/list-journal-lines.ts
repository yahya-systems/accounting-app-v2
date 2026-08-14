import { query } from "@db/pool";
import type { JournalLine, ListJournalLinesFilters } from "@journal-lines/types";

export async function listJournalLines(
  filters: ListJournalLinesFilters
): Promise<JournalLine[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.from !== undefined) {
    params.push(filters.from);
    conditions.push(`jl.date >= $${params.length}`);
  }

  if (filters.to !== undefined) {
    params.push(filters.to);
    conditions.push(`jl.date <= $${params.length}`);
  }

  if (filters.account_id !== undefined) {
    params.push(`${filters.account_id}%`);
    conditions.push(`jl.account_id LIKE $${params.length}`);
  }

  if (filters.journal_id !== undefined) {
    params.push(filters.journal_id);
    conditions.push(`jl.journal_id = $${params.length}`);
  }

  if (filters.type === "debit") {
    conditions.push(`jl.debit_amount IS NOT NULL`);
  } else if (filters.type === "credit") {
    conditions.push(`jl.credit_amount IS NOT NULL`);
  }

  if (filters.description !== undefined) {
    params.push(`%${filters.description}%`);
    conditions.push(`jl.description ILIKE $${params.length}`);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const rows = await query<{
    id: number;
    date: string;
    description: string | null;
    debit_amount: string | null;
    credit_amount: string | null;
    account_id: string;
    account_name: string;
    journal_id: number;
    journal_name: string;
  }>(
    `SELECT
       jl.id,
       jl.date,
       jl.description,
       jl.debit_amount,
       jl.credit_amount,
       a.id AS account_id,
       a.name AS account_name,
       j.id AS journal_id,
       j.name AS journal_name
     FROM journal_lines jl
     JOIN accounts a ON a.id = jl.account_id
     JOIN journals j ON j.id = jl.journal_id
     ${whereClause}
     ORDER BY jl.date, jl.id`,
    params
  );

  return rows.map((row) => ({
    id: row.id,
    date: row.date,
    description: row.description,
    debit_amount: row.debit_amount,
    credit_amount: row.credit_amount,
    account: { id: row.account_id, name: row.account_name },
    journal: { id: row.journal_id, name: row.journal_name },
  }));
}
