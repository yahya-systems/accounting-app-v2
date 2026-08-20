import { AppError } from "@middleware/error/app-error";
import { query } from "@db/pool";
import type { Transaction } from "@transactions/types";

type CreateTransactionInput = {
  journal_id?: number | undefined;
  date?: string | undefined;
  name?: string | undefined;
};

export async function createTransaction(
  input: CreateTransactionInput
): Promise<Transaction> {
  if (input.journal_id !== undefined) {
    const journal = await query<{ id: number }>(
      `SELECT id FROM journals WHERE id = $1`,
      [input.journal_id]
    );
    if (journal.length === 0) {
      throw new AppError(404, `No journal found with id ${input.journal_id}`);
    }
  }

  if (input.name !== undefined) {
    const existing = await query<{ id: number }>(
      `SELECT id FROM transactions WHERE name = $1`,
      [input.name]
    );
    if (existing.length > 0) {
      throw new AppError(409, `A transaction named "${input.name}" already exists`);
    }
  }

  const rows = await query<Transaction>(
    `INSERT INTO transactions (journal_id, date, name)
     VALUES ($1, $2, $3)
     RETURNING id, journal_id, date, name, status, created_at, posted_at`,
    [input.journal_id ?? null, input.date ?? null, input.name ?? null]
  );

  const created = rows[0];
  if (!created) {
    throw new AppError(500, "Transaction creation failed unexpectedly");
  }

  return created;
}
