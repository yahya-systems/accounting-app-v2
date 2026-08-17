import { Pool, QueryResultRow, types } from "pg";

// By default node-postgres parses the `date` OID (1082) into a JS Date,
// which then serializes to a full ISO timestamp (e.g. "...T00:00:00.000Z")
// via JSON.stringify. We want plain "YYYY-MM-DD" as stored, so return the
// raw string Postgres sends instead of letting pg parse it into a Date.
types.setTypeParser(1082, (value: string) => value);

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

// Scoped query function bound to a single checked-out client, so callers
// can run multiple statements against the same connection/transaction.
export type TransactionQuery = <T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
) => Promise<T[]>;

// Runs `fn` inside a BEGIN/COMMIT transaction on a single dedicated client.
// On any thrown error, the transaction is rolled back and the error rethrown.
// The client is always released back to the pool.
export async function withTransaction<T>(
  fn: (txQuery: TransactionQuery) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const txQuery: TransactionQuery = async (text, params) => {
      const result = await client.query(text, params);
      return result.rows;
    };
    const result = await fn(txQuery);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
