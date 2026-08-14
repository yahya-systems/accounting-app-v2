import { query } from '@db/pool';
import { AppError } from '@middleware/error/app-error';
import type { Journal, UpdateJournalInput } from '../types';

export async function updateJournal(id: number, input: UpdateJournalInput): Promise<Journal> {
  // confirm it exists first, so we can 404 cleanly instead of a silent no-op update
  const existing = await query<Journal>(`SELECT * FROM journals WHERE id = $1`, [id]);
  if (!existing[0]) {
    throw new AppError(404, 'Journal not found');
  }

  if (input.name !== undefined) {
    const nameCollision = await query<{ id: number }>(
      `SELECT id FROM journals WHERE name = $1 AND id != $2`,
      [input.name, id]
    );
    if (nameCollision[0]) {
      throw new AppError(409, 'A journal with this name already exists');
    }
  }

  const rows = await query<Journal>(
    `UPDATE journals
     SET name = COALESCE($1, name),
         description = CASE WHEN $2::boolean THEN $3 ELSE description END,
         is_active = COALESCE($4, is_active)
     WHERE id = $5
     RETURNING id, name, description, is_active, created_at`,
    [input.name ?? null, input.description !== undefined, input.description ?? null, input.is_active ?? null, id]
  );

  return rows[0]!;
}
