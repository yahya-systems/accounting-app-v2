import { AppError } from "@middleware/error/app-error";
import { query } from "@db/pool";
import type { Journal } from "@journals/types";

type CreateJournalInput = {
  name: string;
  description: string | null;
};

export async function createJournal(
  input: CreateJournalInput
): Promise<Journal> {
  const existing = await query<{ id: number }>(
    `SELECT id FROM journals WHERE name = $1`,
    [input.name]
  );
  if (existing.length > 0) {
    throw new AppError(409, `A journal named "${input.name}" already exists`);
  }

  const rows = await query<Journal>(
    `INSERT INTO journals (name, description)
     VALUES ($1, $2)
     RETURNING id, name, description, is_active, created_at`,
    [input.name, input.description]
  );

  const created = rows[0];
  if (!created) {
    throw new AppError(500, "Journal creation failed unexpectedly");
  }

  return created;
}
