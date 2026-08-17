import { AppError } from "@middleware/error/app-error";
import { query } from "@db/pool";
import type { Journal } from "@journals/types";

export async function getJournal(id: number): Promise<Journal> {
  const rows = await query<Journal>(
    `SELECT id, name, description, type, is_active, created_at FROM journals WHERE id = $1`,
    [id]
  );

  const journal = rows[0];
  if (!journal) {
    throw new AppError(404, `No journal found with id "${id}"`);
  }

  return journal;
}
