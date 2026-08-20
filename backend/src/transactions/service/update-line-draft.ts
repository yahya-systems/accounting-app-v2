import { AppError } from "@middleware/error/app-error";
import { query } from "@db/pool";
import type { TransactionLine, TransactionStatus, UpdateLineDraftInput } from "@transactions/types";

export async function updateLineDraft(
  transactionId: number,
  lineId: number,
  input: UpdateLineDraftInput
): Promise<TransactionLine> {
  const transaction = await query<{ id: number; status: TransactionStatus }>(
    `SELECT id, status FROM transactions WHERE id = $1`,
    [transactionId]
  );
  const foundTransaction = transaction[0];
  if (!foundTransaction) {
    throw new AppError(404, `No transaction found with id ${transactionId}`);
  }
  if (foundTransaction.status !== "draft") {
    throw new AppError(409, `Transaction ${transactionId} is posted; lines cannot be modified`);
  }

  const line = await query<{ id: number }>(
    `SELECT id FROM journal_line_drafts WHERE id = $1 AND transaction_id = $2`,
    [lineId, transactionId]
  );
  if (!line[0]) {
    throw new AppError(404, `No line found with id ${lineId} on transaction ${transactionId}`);
  }

  if (input.account_id !== undefined) {
    const account = await query<{ id: string }>(
      `SELECT id FROM accounts WHERE id = $1`,
      [input.account_id]
    );
    if (!account[0]) {
      throw new AppError(404, `No account found with id "${input.account_id}"`);
    }
  }

  const rows = await query<{
    id: number;
    account_id: string;
    description: string | null;
    debit_amount: string | null;
    credit_amount: string | null;
  }>(
    `UPDATE journal_line_drafts
     SET account_id = COALESCE($1, account_id),
         description = CASE WHEN $2::boolean THEN $3 ELSE description END,
         debit_amount = CASE WHEN $4::boolean THEN $5 ELSE debit_amount END,
         credit_amount = CASE WHEN $4::boolean THEN $6 ELSE credit_amount END
     WHERE id = $7
     RETURNING id, account_id, description, debit_amount, credit_amount`,
    [
      input.account_id ?? null,
      input.description !== undefined,
      input.description ?? null,
      input.amountsTouched,
      input.debit_amount,
      input.credit_amount,
      lineId,
    ]
  );

  const updated = rows[0]!;

  const account = await query<{ id: string; name: string }>(
    `SELECT id, name FROM accounts WHERE id = $1`,
    [updated.account_id]
  );
  const accountInfo = account[0]!;

  return {
    id: updated.id,
    account: { id: accountInfo.id, name: accountInfo.name },
    description: updated.description,
    debit_amount: updated.debit_amount,
    credit_amount: updated.credit_amount,
  };
}
