/**
 * List all registered knights from PostgreSQL.
 *
 * Usage:
 *   npm run db:list-users
 *
 * Requires DATABASE_URL (or PG* env vars) in .env or environment.
 */
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env manually (dotenv not available as ESM in scripts easily)
try {
  const envPath = resolve(process.cwd(), '.env');
  const lines = readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  // .env not present — rely on environment variables
}

const require = createRequire(import.meta.url);
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  const { rows } = await pool.query(
    `SELECT id, username, avatar_id, created_at
     FROM users
     ORDER BY username`,
  );

  if (rows.length === 0) {
    console.log('No users in database.');
    process.exit(0);
  }

  const display = rows.map((r) => ({
    username: r.username,
    avatar_id: r.avatar_id,
    created: new Date(Number(r.created_at)).toISOString(),
    id: r.id,
  }));

  console.table(display);
  console.log(`Total: ${rows.length}`);
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
} finally {
  await pool.end();
}
