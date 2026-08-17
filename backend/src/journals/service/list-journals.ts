import { query } from "@db/pool";
import type { Journal, ListJournalsFilters } from "@journals/types";

export async function listJournals(
  filters: ListJournalsFilters
): Promise<Journal[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.name !== undefined) {
    params.push(`%${filters.name}%`);
    conditions.push(`name ILIKE $${params.length}`);
  }

  if (filters.description !== undefined) {
    params.push(`%${filters.description}%`);
    conditions.push(`description ILIKE $${params.length}`);
  }

  if (filters.type !== undefined) {
    params.push(filters.type);
    conditions.push(`type = $${params.length}`);
  }

  if (filters.is_active !== undefined) {
    params.push(filters.is_active);
    conditions.push(`is_active = $${params.length}`);
  }

  if (filters.created_after !== undefined) {
    params.push(filters.created_after);
    conditions.push(`created_at >= $${params.length}`);
  }

  if (filters.created_before !== undefined) {
    params.push(filters.created_before);
    conditions.push(`created_at <= $${params.length}`);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  return query<Journal>(
    `SELECT id, name, description, type, is_active, created_at
     FROM journals
     ${whereClause}
     ORDER BY id`,
    params
  );
}
