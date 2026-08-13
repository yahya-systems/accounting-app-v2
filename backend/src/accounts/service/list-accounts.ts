import { query } from "@db/pool";
import type { Account, ListAccountsFilters } from "@accounts/types";

export async function listAccounts(
  filters: ListAccountsFilters
): Promise<Account[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.id !== undefined) {
    params.push(`${filters.id}%`);
    conditions.push(`id LIKE $${params.length}`);
  }

  if (filters.name !== undefined) {
    params.push(`%${filters.name}%`);
    conditions.push(`name ILIKE $${params.length}`);
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

  return query<Account>(
    `SELECT id, name, description, is_active, created_at, metadata
     FROM accounts
     ${whereClause}
     ORDER BY id`,
    params
  );
}
