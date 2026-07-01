import { Pool } from 'pg';

// Singleton pool — reused across Next.js hot-reloads in development
const g = global as typeof globalThis & { _pgPool?: Pool };
if (!g._pgPool) {
  g._pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30_000,
  });
}

export const pool = g._pgPool;
export const query = <T extends Record<string, unknown>>(sql: string, params?: unknown[]) =>
  pool.query<T>(sql, params);
