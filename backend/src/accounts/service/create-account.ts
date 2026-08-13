import { AppError } from "@middleware/error/app-error";
import { query } from "@db/pool";
import type { Account } from "@accounts/types";

function padAccountId(rawCode: string): string {
  return rawCode.padEnd(10, "0");
}

async function findAvailableId(baseCode: string): Promise<string> {
  const paddedBase = padAccountId(baseCode);

  const existing = await query<{ id: string }>(
    `SELECT id FROM accounts WHERE id LIKE $1 ORDER BY id`,
    [`${baseCode}%`]
  );

  if (existing.length === 0) {
    return paddedBase;
  }

  const existingIds = new Set(existing.map((row) => row.id));

  if (!existingIds.has(paddedBase)) {
    return paddedBase;
  }

  // baseCode's own "slot width" — how many digits are free to increment
  // e.g. baseCode "342" -> padded "3420000000" -> 7 free trailing digits
  const suffixLength = 10 - baseCode.length;
  const maxSuffix = 10 ** suffixLength - 1;

  for (let n = 1; n <= maxSuffix; n++) {
    const candidate = baseCode + n.toString().padStart(suffixLength, "0");
    if (!existingIds.has(candidate)) {
      return candidate;
    }
  }

  throw new AppError(
    409,
    `No available sub-account id under prefix "${baseCode}" — all ${maxSuffix + 1} slots are taken`
  );
}

type CreateAccountInput = {
  pcg_code: string;
  name: string;
  description: string | null;
  metadata: Record<string, unknown>;
};

export async function createAccount(
  input: CreateAccountInput
): Promise<Account> {
  const id = await findAvailableId(input.pcg_code);

  const existingByName = await query<{ id: string }>(
    `SELECT id FROM accounts WHERE name = $1`,
    [input.name]
  );
  if (existingByName.length > 0) {
    throw new AppError(409, `An account named "${input.name}" already exists`);
  }

  const rows = await query<Account>(
    `INSERT INTO accounts (id, name, description, metadata)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, description, is_active, created_at, metadata`,
    [id, input.name, input.description, JSON.stringify(input.metadata)]
  );

  const created = rows[0];
  if (!created) {
    throw new AppError(500, "Account creation failed unexpectedly");
  }

  return created;
}
