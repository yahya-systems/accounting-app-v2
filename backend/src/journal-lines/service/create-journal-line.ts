import { AppError } from "@middleware/error/app-error";
import { query } from "@db/pool";
import type { z } from "zod";
import type { createJournalLineBodySchema } from "@journal-lines/schema";

type CreateJournalLineInput = z.infer<typeof createJournalLineBodySchema>;

export type JournalLine = {
  id: number;
  journal_id: number;
  account_id: string;
  date: string;
  description: string | null;
  debit_amount: string | null;
  credit_amount: string | null;
};

export async function createJournalLine(
  input: CreateJournalLineInput
): Promise<JournalLine> {
  const accountExists = await query<{ id: string }>(
    `SELECT id FROM accounts WHERE id = $1`,
    [input.account_id]
  );
  if (accountExists.length === 0) {
    throw new AppError(404, `No account found with id "${input.account_id}"`);
  }

  const journalExists = await query<{ id: number }>(
    `SELECT id FROM journals WHERE id = $1`,
    [input.journal_id]
  );
  if (journalExists.length === 0) {
    throw new AppError(404, `No journal found with id "${input.journal_id}"`);
  }

  const rows = await query<JournalLine>(
    `INSERT INTO journal_lines (journal_id, account_id, date, description, debit_amount, credit_amount)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, journal_id, account_id, date, description, debit_amount, credit_amount`,
    [
      input.journal_id,
      input.account_id,
      input.date,
      input.description,
      input.debit_amount ?? null,
      input.credit_amount ?? null,
    ]
  );

  const created = rows[0];
  if (!created) {
    throw new AppError(500, "Journal line creation failed unexpectedly");
  }

  return created;
}
