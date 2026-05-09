import pg from 'pg';
import { randomUUID } from 'crypto';
import { runMigrations } from './migrate.js';

const { Pool } = pg;

// ── Connection pool ──────────────────────────────────────────────────────────
// Reads DATABASE_URL from the environment (set via .env or Docker).
// Falls back to individual PG* vars (standard pg driver convention).
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Sane production defaults:
  max: 10,               // max concurrent connections
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
});

// Run migrations once on startup, then export the ready pool.
export async function initDb(): Promise<void> {
  // Prune expired sessions as part of startup housekeeping.
  await runMigrations(pool);
  await pool.query('DELETE FROM sessions WHERE expires_at < $1', [Date.now()]);
  console.log('[DB] Startup housekeeping done');
}

// ── Types ────────────────────────────────────────────────────────────────────
export interface DbUser {
  id: string;
  username: string;
  pass_hash: string;
  avatar_id: number;
  created_at: number;
}

export interface DbMessage {
  id: string;
  user_id: string | null;
  username: string | null;
  avatar_id: number | null;
  text: string;
  reply_to_user_id: string | null;
  reply_to_knight_name: string | null;
  timestamp: number;
  version: string;
}

// ── Helper ────────────────────────────────────────────────────────────────────
// pg returns BIGINT columns as strings by default. We store timestamps as
// millisecond-epoch integers (BIGINT), so we cast them back here.
function toUser(row: Record<string, unknown>): DbUser {
  return {
    id: row.id as string,
    username: row.username as string,
    pass_hash: row.pass_hash as string,
    avatar_id: row.avatar_id as number,
    created_at: Number(row.created_at),
  };
}

function toMessage(row: Record<string, unknown>): DbMessage {
  return {
    id: row.id as string,
    user_id: (row.user_id as string | null) ?? null,
    username: (row.username as string | null) ?? null,
    avatar_id: row.avatar_id != null ? (row.avatar_id as number) : null,
    text: row.text as string,
    reply_to_user_id: (row.reply_to_user_id as string | null) ?? null,
    reply_to_knight_name: (row.reply_to_knight_name as string | null) ?? null,
    timestamp: Number(row.timestamp),
    version: row.version as string,
  };
}

// ── Data-access layer ────────────────────────────────────────────────────────
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export const Winchester = {
  // ── users ──────────────────────────────────────────────────────────────────
  async createUser(username: string, passHash: string, avatarId: number): Promise<DbUser> {
    const id = randomUUID();
    const now = Date.now();
    await pool.query(
      `INSERT INTO users (id, username, pass_hash, avatar_id, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, username, passHash, avatarId, now],
    );
    return { id, username, pass_hash: passHash, avatar_id: avatarId, created_at: now };
  },

  async findUserByUsername(username: string): Promise<DbUser | null> {
    // CITEXT column makes this comparison case-insensitive automatically.
    const { rows } = await pool.query(
      `SELECT * FROM users WHERE username = $1`,
      [username],
    );
    return rows[0] ? toUser(rows[0]) : null;
  },

  async findUserById(id: string): Promise<DbUser | null> {
    const { rows } = await pool.query(
      `SELECT * FROM users WHERE id = $1`,
      [id],
    );
    return rows[0] ? toUser(rows[0]) : null;
  },

  // ── sessions ──────────────────────────────────────────────────────────────
  async createSession(userId: string): Promise<string> {
    const token = randomUUID();
    const now = Date.now();
    await pool.query(
      `INSERT INTO sessions (token, user_id, created_at, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [token, userId, now, now + SESSION_TTL_MS],
    );
    return token;
  },

  async validateSession(token: string): Promise<DbUser | null> {
    const { rows } = await pool.query<{ user_id: string }>(
      `SELECT user_id FROM sessions WHERE token = $1 AND expires_at > $2`,
      [token, Date.now()],
    );
    if (!rows[0]) return null;
    return this.findUserById(rows[0].user_id);
  },

  async deleteSession(token: string): Promise<void> {
    await pool.query(`DELETE FROM sessions WHERE token = $1`, [token]);
  },

  // ── messages ───────────────────────────────────────────────────────────────
  async saveMessage(msg: {
    id: string;
    userId: string | null;
    username: string | null;
    avatarId: number | null;
    text: string;
    replyToUserId?: string;
    replyToKnightName?: string;
    timestamp: number;
    version: string;
  }): Promise<void> {
    await pool.query(
      `INSERT INTO chat_messages
         (id, user_id, username, avatar_id, text,
          reply_to_user_id, reply_to_knight_name, timestamp, version)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (id) DO NOTHING`,
      [
        msg.id,
        msg.userId ?? null,
        msg.username ?? null,
        msg.avatarId ?? null,
        msg.text,
        msg.replyToUserId ?? null,
        msg.replyToKnightName ?? null,
        msg.timestamp,
        msg.version,
      ],
    );
  },

  async getMessages(version: string, limit = 100): Promise<DbMessage[]> {
    const { rows } = await pool.query(
      `SELECT * FROM chat_messages
       WHERE version = $1
       ORDER BY timestamp ASC
       LIMIT $2`,
      [version, limit],
    );
    return rows.map(toMessage);
  },
};

export default Winchester;
