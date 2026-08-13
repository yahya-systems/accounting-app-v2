import { AppError } from "@middleware/error/app-error";
import { query } from "@db/pool";
import type { Account } from "@accounts/types";

type UpdateAccountInput = {
  name?: string | undefined;
  description?: string | null | undefined;
  metadata?: Record<string, unknown> | undefined;
};

export async function updateAccount(
  id: string,
  input: UpdateAccountInput
): Promise<Account> {
  const existingRows = await query<Account>(
    `SELECT id, name, description, is_active, created_at, metadata FROM accounts WHERE id = $1`,
    [id]
  );
  const existing = existingRows[0];

  if (!existing) {
    throw new AppError(404, `No account found with id "${id}"`);
  }

  if (input.name !== undefined && input.name !== existing.name) {
    const nameConflict = await query<{ id: string }>(
      `SELECT id FROM accounts WHERE name = $1 AND id != $2`,
      [input.name, id]
    );
    if (nameConflict.length > 0) {
      throw new AppError(409, `An account named "${input.name}" already exists`);
    }
  }

  let mergedMetadata = existing.metadata;

  if (input.metadata !== undefined) {
    mergedMetadata = { ...existing.metadata };
    for (const [key, value] of Object.entries(input.metadata)) {
      if (value === null) {
        delete mergedMetadata[key];
      } else {
        mergedMetadata[key] = value;
      }
    }
  }

  const rows = await query<Account>(
    `UPDATE accounts
     SET name = $1,
         description = $2,
         metadata = $3
     WHERE id = $4
     RETURNING id, name, description, is_active, created_at, metadata`,
    [
      input.name ?? existing.name,
      input.description !== undefined ? input.description : existing.description,
      JSON.stringify(mergedMetadata),
      id,
    ]
  );

  const updated = rows[0];
  if (!updated) {
    throw new AppError(500, "Account update failed unexpectedly");
  }

  return updated;
}
