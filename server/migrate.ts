import type { Pool } from 'pg';

/**
 * Runs idempotent schema migrations against the connected PostgreSQL database.
 * Called once at server startup before any requests are handled.
 *
 * Strategy: single-file "run-once" migrations guarded by IF NOT EXISTS / DO NOTHING.
 * Each numbered block is append-only — never edit an existing block, only add new ones.
 */
export async function runMigrations(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── 001: base schema ─────────────────────────────────────────────────────
    // CITEXT gives us free case-insensitive equality/uniqueness on username,
    // replacing SQLite's COLLATE NOCASE.
    await client.query(`CREATE EXTENSION IF NOT EXISTS citext`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id          TEXT        PRIMARY KEY,
        username    CITEXT      NOT NULL UNIQUE,
        pass_hash   TEXT        NOT NULL,
        avatar_id   INTEGER     NOT NULL DEFAULT 0,
        created_at  BIGINT      NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        token       TEXT    PRIMARY KEY,
        user_id     TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at  BIGINT  NOT NULL,
        expires_at  BIGINT  NOT NULL
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sessions_user
        ON sessions(user_id)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id                    TEXT    PRIMARY KEY,
        user_id               TEXT,
        username              TEXT,
        avatar_id             INTEGER,
        text                  TEXT    NOT NULL,
        reply_to_user_id      TEXT,
        reply_to_knight_name  TEXT,
        timestamp             BIGINT  NOT NULL,
        version               TEXT    NOT NULL DEFAULT '1'
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_version_ts
        ON chat_messages(version, timestamp)
    `);

    await client.query('COMMIT');
    console.log('[DB] Migrations applied successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
