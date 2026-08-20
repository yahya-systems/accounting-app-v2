import { AppError } from "@middleware/error/app-error";
import { query } from "@db/pool";
import type { TransactionStatus } from "@transactions/types";

export type TransactionBalance = {
  total_debit: string;
  total_credit: string;
  sold: string;
};

export async function getTransactionBalance(
  transactionId: number
): Promise<TransactionBalance> {
  const transaction = await query<{ id: number; status: TransactionStatus }>(
    `SELECT id, status FROM transactions WHERE id = $1`,
    [transactionId]
  );
  const found = transaction[0];
  if (!found) {
    throw new AppError(404, `No transaction found with id ${transactionId}`);
  }

  const rows = await query<{ total_debit: string; total_credit: string }>(
    found.status === "posted"
      ? `SELECT
           COALESCE(SUM(debit_amount), 0) AS total_debit,
           COALESCE(SUM(credit_amount), 0) AS total_credit
         FROM journal_lines
         WHERE transaction_id = $1`
      : `SELECT
           COALESCE(SUM(debit_amount), 0) AS total_debit,
           COALESCE(SUM(credit_amount), 0) AS total_credit
         FROM journal_line_drafts
         WHERE transaction_id = $1`,
    [transactionId]
  );

  const totals = rows[0]!;
  const totalDebit = Number(totals.total_debit);
  const totalCredit = Number(totals.total_credit);

  return {
    total_debit: totals.total_debit,
    total_credit: totals.total_credit,
    sold: (totalDebit - totalCredit).toString(),
  };
}
