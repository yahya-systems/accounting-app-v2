import { AppError } from "@middleware/error/app-error";
import { query } from "@db/pool";

export type JournalJournalLine = {
  id: number;
  date: string;
  description: string | null;
  debit_amount: string | null;
  credit_amount: string | null;
  account: {
    id: string;
    name: string;
  };
};

export type GetJournalJournalLinesFilters = {
  from?: string | undefined;
  to?: string | undefined;
  account_id?: string | undefined;
  type?: "debit" | "credit" | undefined;
  description?: string | undefined;
};

export async function getJournalJournalLines(
  journalId: number,
  filters: GetJournalJournalLinesFilters
): Promise<JournalJournalLine[]> {
  const journalExists = await query<{ id: number }>(
    `SELECT id FROM journals WHERE id = $1`,
    [journalId]
  );
  if (journalExists.length === 0) {
    throw new AppError(404, `No journal found with id "${journalId}"`);
  }

  const conditions: string[] = ["jl.journal_id = $1"];
  const params: unknown[] = [journalId];

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

  if (filters.type === "debit") {
    conditions.push(`jl.debit_amount IS NOT NULL`);
  } else if (filters.type === "credit") {
    conditions.push(`jl.credit_amount IS NOT NULL`);
  }

  if (filters.description !== undefined) {
    params.push(`%${filters.description}%`);
    conditions.push(`jl.description ILIKE $${params.length}`);
  }

  const whereClause = `WHERE ${conditions.join(" AND ")}`;

  const rows = await query<{
    id: number;
    date: string;
    description: string | null;
    debit_amount: string | null;
    credit_amount: string | null;
    account_id: string;
    account_name: string;
  }>(
    `SELECT
       jl.id,
       jl.date,
       jl.description,
       jl.debit_amount,
       jl.credit_amount,
       a.id AS account_id,
       a.name AS account_name
     FROM journal_lines jl
     JOIN accounts a ON a.id = jl.account_id
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
  }));
}
