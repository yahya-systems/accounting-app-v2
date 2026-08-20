import { AppError } from "@middleware/error/app-error";
import { query } from "@db/pool";
import type { Transaction, UpdateTransactionInput } from "@transactions/types";

export async function updateTransaction(
  id: number,
  input: UpdateTransactionInput
): Promise<Transaction> {
  const existing = await query<Transaction>(
    `SELECT id, journal_id, date, name, status, created_at, posted_at
     FROM transactions
     WHERE id = $1`,
    [id]
  );
  if (!existing[0]) {
    throw new AppError(404, `No transaction found with id ${id}`);
  }

  // input.<field> === undefined means "key omitted from body, leave
  // untouched". A key present with value null means "explicitly clear it"
  // (only valid pre-post; the DB CHECK constraint blocks nulling a field on
  // a posted transaction). A key present with a real value means "set it".
  // COALESCE alone can't express this (it can't distinguish omitted from
  // explicit-null), so each field uses its own touched-flag + CASE.
  const journalTouched = input.journal_id !== undefined;
  const dateTouched = input.date !== undefined;
  const nameTouched = input.name !== undefined;

  if (nameTouched && input.name !== null) {
    const nameCollision = await query<{ id: number }>(
      `SELECT id FROM transactions WHERE name = $1 AND id != $2`,
      [input.name, id]
    );
    if (nameCollision[0]) {
      throw new AppError(409, `A transaction named "${input.name}" already exists`);
    }
  }

  if (journalTouched && input.journal_id !== null) {
    const journal = await query<{ id: number; is_active: boolean }>(
      `SELECT id, is_active FROM journals WHERE id = $1`,
      [input.journal_id]
    );
    const found = journal[0];
    if (!found) {
      throw new AppError(404, `No journal found with id ${input.journal_id}`);
    }
    if (!found.is_active) {
      throw new AppError(409, `Journal ${input.journal_id} is not active`);
    }
  }

  const rows = await query<Transaction>(
    `UPDATE transactions
     SET journal_id = CASE WHEN $1::boolean THEN $2 ELSE journal_id END,
         date = CASE WHEN $3::boolean THEN $4 ELSE date END,
         name = CASE WHEN $5::boolean THEN $6 ELSE name END
     WHERE id = $7
     RETURNING id, journal_id, date, name, status, created_at, posted_at`,
    [
      journalTouched,
      input.journal_id ?? null,
      dateTouched,
      input.date ?? null,
      nameTouched,
      input.name ?? null,
      id,
    ]
  );

  return rows[0]!;
}
