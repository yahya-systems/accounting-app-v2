import { AppError } from "@middleware/error/app-error";
import { withTransaction } from "@db/pool";
import type { Transaction, TransactionStatus } from "@transactions/types";

export async function postTransaction(id: number): Promise<Transaction> {
  return withTransaction(async (txQuery) => {
    // Lock the transaction row so no concurrent post/edit/delete can race
    // with this flush while we recompute the balance and act on it.
    const rows = await txQuery<{
      id: number;
      journal_id: number | null;
      date: string | null;
      name: string | null;
      status: TransactionStatus;
      created_at: string;
      posted_at: string | null;
    }>(
      `SELECT id, journal_id, date, name, status, created_at, posted_at
       FROM transactions
       WHERE id = $1
       FOR UPDATE`,
      [id]
    );
    const transaction = rows[0];
    if (!transaction) {
      throw new AppError(404, `No transaction found with id ${id}`);
    }
    if (transaction.status === "posted") {
      throw new AppError(409, `Transaction ${id} is already posted`);
    }
    if (transaction.journal_id === null || transaction.date === null || transaction.name === null) {
      throw new AppError(
        409,
        `Transaction ${id} is missing required fields (journal_id, date, and name must all be set before posting)`
      );
    }

    const lines = await txQuery<{
      id: number;
      account_id: string;
      description: string | null;
      debit_amount: string | null;
      credit_amount: string | null;
    }>(
      `SELECT id, account_id, description, debit_amount, credit_amount
       FROM journal_line_drafts
       WHERE transaction_id = $1
       ORDER BY id`,
      [id]
    );

    if (lines.length === 0) {
      throw new AppError(409, `Transaction ${id} has no lines to post`);
    }

    // Balance re-check inside the locked DB transaction — this is the
    // authoritative check; any earlier check at the API layer is a fast
    // fail, not a substitute, since it can't see concurrent writes.
    const totalDebit = lines.reduce((sum, l) => sum + Number(l.debit_amount ?? 0), 0);
    const totalCredit = lines.reduce((sum, l) => sum + Number(l.credit_amount ?? 0), 0);
    if (totalDebit !== totalCredit) {
      throw new AppError(
        409,
        `Transaction ${id} is not balanced (debit ${totalDebit} != credit ${totalCredit})`
      );
    }

    for (const line of lines) {
      const description = line.description
        ? `${transaction.name} : ${line.description}`
        : transaction.name;

      await txQuery(
        `INSERT INTO journal_lines (transaction_id, account_id, description, debit_amount, credit_amount)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, line.account_id, description, line.debit_amount, line.credit_amount]
      );
    }

    await txQuery(`DELETE FROM journal_line_drafts WHERE transaction_id = $1`, [id]);

    const updated = await txQuery<{
      id: number;
      journal_id: number | null;
      date: string | null;
      name: string | null;
      status: TransactionStatus;
      created_at: string;
      posted_at: string | null;
    }>(
      `UPDATE transactions
       SET status = 'posted', posted_at = now()
       WHERE id = $1
       RETURNING id, journal_id, date, name, status, created_at, posted_at`,
      [id]
    );

    return updated[0]!;
  });
}
