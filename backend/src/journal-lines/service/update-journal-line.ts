import { AppError } from "@middleware/error/app-error";
import { query } from "@db/pool";
import type { z } from "zod";
import type { updateJournalLineBodySchema } from "@journal-lines/schema";
import type { JournalLine } from "@journal-lines/types";

type UpdateJournalLineInput = z.infer<typeof updateJournalLineBodySchema>;

export async function updateJournalLine(
  id: number,
  input: UpdateJournalLineInput
): Promise<JournalLine> {
  const existingRows = await query<{
    id: number;
    journal_id: number;
    account_id: string;
    date: string;
    description: string | null;
    debit_amount: string | null;
    credit_amount: string | null;
  }>(`SELECT * FROM journal_lines WHERE id = $1`, [id]);

  const existing = existingRows[0];
  if (!existing) {
    throw new AppError(404, `No journal line found with id "${id}"`);
  }

  if (input.account_id !== undefined) {
    const accountExists = await query<{ id: string }>(
      `SELECT id FROM accounts WHERE id = $1`,
      [input.account_id]
    );
    if (accountExists.length === 0) {
      throw new AppError(404, `No account found with id "${input.account_id}"`);
    }
  }

  if (input.journal_id !== undefined) {
    const journalExists = await query<{ id: number }>(
      `SELECT id FROM journals WHERE id = $1`,
      [input.journal_id]
    );
    if (journalExists.length === 0) {
      throw new AppError(404, `No journal found with id "${input.journal_id}"`);
    }
  }

  const amountsProvided = input.debit_amount !== undefined || input.credit_amount !== undefined;

  const rows = await query<JournalLine>(
    `UPDATE journal_lines
     SET journal_id = $1,
         account_id = $2,
         date = $3,
         description = $4,
         debit_amount = $5,
         credit_amount = $6
     WHERE id = $7
     RETURNING id, date, description, debit_amount, credit_amount, account_id, journal_id`,
    [
      input.journal_id ?? existing.journal_id,
      input.account_id ?? existing.account_id,
      input.date ?? existing.date,
      input.description ?? existing.description,
      amountsProvided ? (input.debit_amount ?? null) : existing.debit_amount,
      amountsProvided ? (input.credit_amount ?? null) : existing.credit_amount,
      id,
    ]
  );

  const updated = rows[0];
  if (!updated) {
    throw new AppError(500, "Journal line update failed unexpectedly");
  }

  return updated;
}
