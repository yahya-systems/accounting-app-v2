import { AppError } from "@middleware/error/app-error";
import { query } from "@db/pool";
import type { CreateLineDraftInput, TransactionLine, TransactionStatus } from "@transactions/types";

export async function createLineDraft(
  transactionId: number,
  input: CreateLineDraftInput
): Promise<TransactionLine> {
  const transaction = await query<{ id: number; status: TransactionStatus }>(
    `SELECT id, status FROM transactions WHERE id = $1`,
    [transactionId]
  );
  const found = transaction[0];
  if (!found) {
    throw new AppError(404, `No transaction found with id ${transactionId}`);
  }
  if (found.status !== "draft") {
    throw new AppError(409, `Transaction ${transactionId} is posted; lines cannot be added`);
  }

  const account = await query<{ id: string; name: string }>(
    `SELECT id, name FROM accounts WHERE id = $1`,
    [input.account_id]
  );
  const foundAccount = account[0];
  if (!foundAccount) {
    throw new AppError(404, `No account found with id "${input.account_id}"`);
  }

  const rows = await query<{
    id: number;
    description: string | null;
    debit_amount: string | null;
    credit_amount: string | null;
  }>(
    `INSERT INTO journal_line_drafts (transaction_id, account_id, description, debit_amount, credit_amount)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, description, debit_amount, credit_amount`,
    [transactionId, input.account_id, input.description, input.debit_amount, input.credit_amount]
  );

  const created = rows[0];
  if (!created) {
    throw new AppError(500, "Journal line draft creation failed unexpectedly");
  }

  return {
    id: created.id,
    account: { id: foundAccount.id, name: foundAccount.name },
    description: created.description,
    debit_amount: created.debit_amount,
    credit_amount: created.credit_amount,
  };
}
