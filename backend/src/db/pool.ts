import { Pool, QueryResultRow } from "pg";

const connectionString = process.env['DATABASE_URL'];

if (!connectionString) {
  throw new Error("DATABASE_URL is not set in the environment");
}

const pool = new Pool({ connectionString });

pool.on("error", (err) => {
  // Errors on idle clients in the pool (e.g. connection dropped) — log,
  // don't crash the whole process over a single bad connection.
  console.error("Unexpected error on idle Postgres client", err);
});

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await pool.query<T>(text, params);
  return result.rows;
}
