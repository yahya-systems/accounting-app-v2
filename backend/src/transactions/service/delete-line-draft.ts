import { AppError } from "@middleware/error/app-error";
import { query } from "@db/pool";
import type { TransactionStatus } from "@transactions/types";

export async function deleteLineDraft(
  transactionId: number,
  lineId: number
): Promise<void> {
  const transaction = await query<{ id: number; status: TransactionStatus }>(
    `SELECT id, status FROM transactions WHERE id = $1`,
    [transactionId]
  );
  const foundTransaction = transaction[0];
  if (!foundTransaction) {
    throw new AppError(404, `No transaction found with id ${transactionId}`);
  }
  if (foundTransaction.status !== "draft") {
    throw new AppError(409, `Transaction ${transactionId} is posted; lines cannot be removed`);
  }

  const line = await query<{ id: number }>(
    `SELECT id FROM journal_line_drafts WHERE id = $1 AND transaction_id = $2`,
    [lineId, transactionId]
  );
  if (!line[0]) {
    throw new AppError(404, `No line found with id ${lineId} on transaction ${transactionId}`);
  }

  await query(`DELETE FROM journal_line_drafts WHERE id = $1`, [lineId]);
}
