import { AppError } from "@middleware/error/app-error";
import { query } from "@db/pool";

export type GetJournalBalanceFilters = {
  from?: string | undefined;
  to?: string | undefined;
};

export async function getJournalBalance(
  journalId: number,
  filters: GetJournalBalanceFilters
): Promise<{
  total_debit: number;
  total_credit: number;
  solde: number;
}> {
  const journalExists = await query<{ id: number }>(
    `SELECT id FROM journals WHERE id = $1`,
    [journalId]
  );
  if (journalExists.length === 0) {
    throw new AppError(404, `No journal found with id "${journalId}"`);
  }

  const conditions: string[] = ["t.journal_id = $1"];
  const params: unknown[] = [journalId];

  if (filters.from !== undefined) {
    params.push(filters.from);
    conditions.push(`t.date >= $${params.length}`);
  }

  if (filters.to !== undefined) {
    params.push(filters.to);
    conditions.push(`t.date <= $${params.length}`);
  }

  const whereClause = `WHERE ${conditions.join(" AND ")}`;

  const rows = await query<{
    total_debit: string;
    total_credit: string;
    solde: string;
  }>(
    `SELECT
       COALESCE(SUM(jl.debit_amount), 0) AS total_debit,
       COALESCE(SUM(jl.credit_amount), 0) AS total_credit,
       COALESCE(SUM(jl.debit_amount), 0) - COALESCE(SUM(jl.credit_amount), 0) AS solde
     FROM journal_lines jl
     JOIN transactions t ON t.id = jl.transaction_id
     ${whereClause}`,
    params
  );

  const row = rows[0];

  return {
    total_debit: Number(row?.total_debit ?? 0),
    total_credit: Number(row?.total_credit ?? 0),
    solde: Number(row?.solde ?? 0),
  };
}
