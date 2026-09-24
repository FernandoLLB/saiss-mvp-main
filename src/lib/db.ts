import { Pool, type QueryResultRow } from "pg";

// SAISS_DB permite usar otra base de datos del mismo servidor (la integración de Neon inyecta DATABASE_URL)
const base = process.env.DATABASE_URL ?? "postgres://localhost:5432/saiss";
const url = process.env.SAISS_DB ? base.replace(/\/([^/?]+)(\?|$)/, `/${process.env.SAISS_DB}$2`) : base;

const globalForPool = globalThis as unknown as { saissPool?: Pool };

export const pool =
  globalForPool.saissPool ??
  new Pool({
    connectionString: url,
    ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false },
    max: 5,
    query_timeout: 30_000,
  });

if (process.env.NODE_ENV !== "production") globalForPool.saissPool = pool;

export async function query<T extends QueryResultRow>(text: string, params: unknown[] = []) {
  const { rows } = await pool.query<T>(text, params);
  return rows;
}

export async function one<T extends QueryResultRow>(text: string, params: unknown[] = []) {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
