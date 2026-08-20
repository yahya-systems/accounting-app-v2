import { AppError } from "@middleware/error/app-error";
import { query } from "@db/pool";
import type { TransactionStatus } from "@transactions/types";

export async function deleteTransaction(id: number): Promise<void> {
  const existing = await query<{ id: number; status: TransactionStatus }>(
    `SELECT id, status FROM transactions WHERE id = $1`,
    [id]
  );
  const transaction = existing[0];
  if (!transaction) {
    throw new AppError(404, `No transaction found with id ${id}`);
  }

  if (transaction.status === "posted") {
    throw new AppError(409, `Transaction ${id} is posted and cannot be deleted`);
  }

  await query(`DELETE FROM transactions WHERE id = $1`, [id]);
}
