import { AppError } from "@middleware/error/app-error";
import { withTransaction } from "@db/pool";
import type { TransactionQuery } from "@db/pool";
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

async function insertJournalLine(
  txQuery: TransactionQuery,
  input: CreateJournalLineInput
): Promise<JournalLine> {
  const accountExists = await txQuery<{ id: string }>(
    `SELECT id FROM accounts WHERE id = $1`,
    [input.account_id]
  );
  if (accountExists.length === 0) {
    throw new AppError(404, `No account found with id "${input.account_id}"`);
  }

  const journalExists = await txQuery<{ id: number }>(
    `SELECT id FROM journals WHERE id = $1`,
    [input.journal_id]
  );
  if (journalExists.length === 0) {
    throw new AppError(404, `No journal found with id "${input.journal_id}"`);
  }

  const rows = await txQuery<JournalLine>(
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

// Creates multiple journal lines atomically: all lines are inserted within
// a single transaction, and if any line fails validation (e.g. unknown
// account/journal), the entire batch is rolled back and none are inserted.
// Each line is otherwise independent — no shared state between lines.
export async function createJournalLines(
  inputs: CreateJournalLineInput[]
): Promise<JournalLine[]> {
  return withTransaction(async (txQuery) => {
    const created: JournalLine[] = [];
    for (const input of inputs) {
      created.push(await insertJournalLine(txQuery, input));
    }
    return created;
  });
}
