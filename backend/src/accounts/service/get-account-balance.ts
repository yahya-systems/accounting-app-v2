import { AppError } from "@middleware/error/app-error";
import { query } from "@db/pool";

export type GetAccountBalanceFilters = {
  from?: string | undefined;
  to?: string | undefined;
};

export async function getAccountBalance(
  accountId: string,
  filters: GetAccountBalanceFilters
): Promise<{
  balance: number;
  total_debit: number;
  total_credit: number;
  line_count: number;
}> {
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
    conditions.push(`t.date >= $${params.length}`);
  }

  if (filters.to !== undefined) {
    params.push(filters.to);
    conditions.push(`t.date <= $${params.length}`);
  }

  const whereClause = `WHERE ${conditions.join(" AND ")}`;

  const rows = await query<{
    balance: string;
    total_debit: string;
    total_credit: string;
    line_count: string;
  }>(
    `SELECT
       COALESCE(SUM(jl.debit_amount), 0) - COALESCE(SUM(jl.credit_amount), 0) AS balance,
       COALESCE(SUM(jl.debit_amount), 0) AS total_debit,
       COALESCE(SUM(jl.credit_amount), 0) AS total_credit,
       COUNT(*) AS line_count
     FROM journal_lines jl
     JOIN transactions t ON t.id = jl.transaction_id
     ${whereClause}`,
    params
  );

  const row = rows[0];

  return {
    balance: Number(row?.balance ?? 0),
    total_debit: Number(row?.total_debit ?? 0),
    total_credit: Number(row?.total_credit ?? 0),
    line_count: Number(row?.line_count ?? 0),
  };
}
