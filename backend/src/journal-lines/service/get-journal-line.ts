import { AppError } from "@middleware/error/app-error";
import { query } from "@db/pool";

async function findPcgReferenceLabel(accountId: string): Promise<string | null> {
  for (let len = 5; len >= 1; len--) {
    const prefix = accountId.slice(0, len);
    const rows = await query<{ name: string }>(
      `SELECT name FROM pcg_reference WHERE id = $1`,
      [prefix]
    );
    if (rows[0]) {
      return rows[0].name;
    }
  }
  return null;
}

export type JournalLineDetail = {
  id: number;
  date: string;
  description: string | null;
  debit_amount: string | null;
  credit_amount: string | null;
  account: {
    id: string;
    name: string;
    pcg_reference_name: string | null;
  };
  journal: {
    id: number;
    name: string;
  };
};

export async function getJournalLine(id: number): Promise<JournalLineDetail> {
  const rows = await query<{
    id: number;
    date: string;
    description: string | null;
    debit_amount: string | null;
    credit_amount: string | null;
    account_id: string;
    account_name: string;
    journal_id: number;
    journal_name: string;
  }>(
    `SELECT
       jl.id,
       jl.date,
       jl.description,
       jl.debit_amount,
       jl.credit_amount,
       a.id AS account_id,
       a.name AS account_name,
       j.id AS journal_id,
       j.name AS journal_name
     FROM journal_lines jl
     JOIN accounts a ON a.id = jl.account_id
     JOIN journals j ON j.id = jl.journal_id
     WHERE jl.id = $1`,
    [id]
  );

  const row = rows[0];
  if (!row) {
    throw new AppError(404, `No journal line found with id "${id}"`);
  }

  const pcgReferenceName = await findPcgReferenceLabel(row.account_id);

  return {
    id: row.id,
    date: row.date,
    description: row.description,
    debit_amount: row.debit_amount,
    credit_amount: row.credit_amount,
    account: {
      id: row.account_id,
      name: row.account_name,
      pcg_reference_name: pcgReferenceName,
    },
    journal: { id: row.journal_id, name: row.journal_name },
  };
}
