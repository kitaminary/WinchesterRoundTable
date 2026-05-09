/**
 * Delete a knight from PostgreSQL by name (case-insensitive).
 * Sessions are removed automatically via ON DELETE CASCADE.
 *
 * Usage:
 *   npm run db:delete-user -- <knight_name>
 *
 * Requires DATABASE_URL (or PG* env vars) in .env or environment.
 */
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env manually
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

const usernameArg = process.argv[2]?.trim();

if (!usernameArg) {
  console.error('Usage: npm run db:delete-user -- <knight_name>');
  process.exit(1);
}

const require = createRequire(import.meta.url);
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

let exitCode = 0;
try {
  // CITEXT column makes this case-insensitive
  const find = await pool.query(
    `SELECT id FROM users WHERE username = $1`,
    [usernameArg],
  );

  if (find.rows.length === 0) {
    console.error(`No user named "${usernameArg}".`);
    exitCode = 1;
  } else {
    const userId = find.rows[0].id;
    const del = await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
    console.log(
      `Deleted user "${usernameArg}" (${userId}). Sessions removed by FK cascade. Rows: ${del.rowCount}.`,
    );
    console.log('You can register again with the same name in the app.');
  }
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  exitCode = 1;
} finally {
  await pool.end();
}

process.exit(exitCode);
