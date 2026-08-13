import { AppError } from "@middleware/error/app-error";
import { query } from "@db/pool";

export type AccountJournalLine = {
  id: number;
  date: string;
  description: string | null;
  debit_amount: string | null;
  credit_amount: string | null;
  journal: {
    id: number;
    name: string;
  };
};

export type GetAccountJournalLinesFilters = {
  from?: string | undefined;
  to?: string | undefined;
  journal_id?: number | undefined;
  type?: "debit" | "credit" | undefined;
  description?: string | undefined;
};

export async function getAccountJournalLines(
  accountId: string,
  filters: GetAccountJournalLinesFilters
): Promise<AccountJournalLine[]> {
  const accountExists = await query<{ id: string }>(
    `SELECT id FROM accounts WHERE id = $1`,
    [accountId]
  );
  if (accountExists.length === 0) {
    throw new AppError(404, `No account found with id "${accountId}"`);
  }

  const conditions: string[] = ["jl.account_id = $1"];
  const params: unknown[] = [accountId];

  if (filters.from !== undefined) {
    params.push(filters.from);
    conditions.push(`jl.date >= $${params.length}`);
  }

  if (filters.to !== undefined) {
    params.push(filters.to);
    conditions.push(`jl.date <= $${params.length}`);
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

  const whereClause = `WHERE ${conditions.join(" AND ")}`;

  const rows = await query<{
    id: number;
    date: string;
    description: string | null;
    debit_amount: string | null;
    credit_amount: string | null;
    journal_id: number;
    journal_name: string;
  }>(
    `SELECT
       jl.id,
       jl.date,
       jl.description,
       jl.debit_amount,
       jl.credit_amount,
       j.id AS journal_id,
       j.name AS journal_name
     FROM journal_lines jl
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
    journal: { id: row.journal_id, name: row.journal_name },
  }));
}
