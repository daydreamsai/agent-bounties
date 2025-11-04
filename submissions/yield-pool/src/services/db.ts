import postgres, { Sql } from "postgres";

let sqlClient: Sql | null = null;

export function getDb(): Sql {
  if (sqlClient) {
    return sqlClient;
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Provide a Postgres connection string to enable persistent watcher storage."
    );
  }

  sqlClient = postgres(url, {
    max: Number(process.env.DB_POOL_MAX ?? 5),
    idle_timeout: Number(process.env.DB_IDLE_TIMEOUT ?? 30),
    max_lifetime: Number(process.env.DB_MAX_LIFETIME ?? 60 * 30),
  });

  return sqlClient;
}

export async function closeDb(): Promise<void> {
  if (!sqlClient) return;
  await sqlClient.end();
  sqlClient = null;
}
