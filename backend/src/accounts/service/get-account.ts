import { AppError } from "@middleware/error/app-error";
import { query } from "@db/pool";
import type { Account } from "@accounts/types";

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

export async function getAccount(
  id: string
): Promise<Account & { pcg_reference_name: string | null }> {
  const rows = await query<Account>(
    `SELECT id, name, description, is_active, created_at, metadata FROM accounts WHERE id = $1`,
    [id]
  );
  const account = rows[0];

  if (!account) {
    throw new AppError(404, `No account found with id "${id}"`);
  }

  const pcgReferenceName = await findPcgReferenceLabel(account.id);

  return { ...account, pcg_reference_name: pcgReferenceName };
}
