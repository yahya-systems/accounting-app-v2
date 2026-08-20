import { AppError } from "@middleware/error/app-error";
import { query } from "@db/pool";
import type { Transaction, TransactionDetail, TransactionLine } from "@transactions/types";

export async function getTransaction(id: number): Promise<TransactionDetail> {
  const rows = await query<Transaction>(
    `SELECT id, journal_id, date, name, status, created_at, posted_at
     FROM transactions
     WHERE id = $1`,
    [id]
  );

  const transaction = rows[0];
  if (!transaction) {
    throw new AppError(404, `No transaction found with id ${id}`);
  }

  const lineRows = await query<{
    id: number;
    account_id: string;
    account_name: string;
    description: string | null;
    debit_amount: string | null;
    credit_amount: string | null;
  }>(
    transaction.status === "posted"
      ? `SELECT jl.id, a.id AS account_id, a.name AS account_name, jl.description, jl.debit_amount, jl.credit_amount
         FROM journal_lines jl
         JOIN accounts a ON a.id = jl.account_id
         WHERE jl.transaction_id = $1
         ORDER BY jl.id`
      : `SELECT jld.id, a.id AS account_id, a.name AS account_name, jld.description, jld.debit_amount, jld.credit_amount
         FROM journal_line_drafts jld
         JOIN accounts a ON a.id = jld.account_id
         WHERE jld.transaction_id = $1
         ORDER BY jld.id`,
    [id]
  );

  const lines: TransactionLine[] = lineRows.map((row) => ({
    id: row.id,
    account: { id: row.account_id, name: row.account_name },
    description: row.description,
    debit_amount: row.debit_amount,
    credit_amount: row.credit_amount,
  }));

  return { ...transaction, lines };
}
