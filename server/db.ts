import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';

const DATA_DIR = process.env.DATA_DIR ?? path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(path.join(DATA_DIR, 'winchester.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    username    TEXT UNIQUE NOT NULL COLLATE NOCASE,
    pass_hash   TEXT NOT NULL,
    avatar_id   INTEGER NOT NULL DEFAULT 0,
    created_at  INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token       TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  INTEGER NOT NULL,
    expires_at  INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id                   TEXT PRIMARY KEY,
    user_id              TEXT,
    username             TEXT,
    avatar_id            INTEGER,
    text                 TEXT NOT NULL,
    reply_to_user_id     TEXT,
    reply_to_knight_name TEXT,
    timestamp            INTEGER NOT NULL,
    version              TEXT NOT NULL DEFAULT '1'
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_messages_version_ts ON chat_messages(version, timestamp);
`);

// Prune expired sessions at boot
db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());

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

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export const Winchester = {
  // ---------- users ----------
  createUser(username: string, passHash: string, avatarId: number): DbUser {
    const id = randomUUID();
    const now = Date.now();
    db.prepare(
      'INSERT INTO users (id, username, pass_hash, avatar_id, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(id, username, passHash, avatarId, now);
    return { id, username, pass_hash: passHash, avatar_id: avatarId, created_at: now };
  },

  findUserByUsername(username: string): DbUser | undefined {
    return db
      .prepare<[string], DbUser>('SELECT * FROM users WHERE username = ? COLLATE NOCASE')
      .get(username) as DbUser | undefined;
  },

  findUserById(id: string): DbUser | undefined {
    return db.prepare<[string], DbUser>('SELECT * FROM users WHERE id = ?').get(id) as DbUser | undefined;
  },

  // ---------- sessions ----------
  createSession(userId: string): string {
    const token = randomUUID();
    const now = Date.now();
    db.prepare(
      'INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)'
    ).run(token, userId, now, now + SESSION_TTL_MS);
    return token;
  },

  validateSession(token: string): DbUser | null {
    const row = db
      .prepare<[string, number], { user_id: string }>(
        'SELECT user_id FROM sessions WHERE token = ? AND expires_at > ?'
      )
      .get(token, Date.now()) as { user_id: string } | undefined;
    if (!row) return null;
    return this.findUserById(row.user_id) ?? null;
  },

  deleteSession(token: string): void {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  },

  // ---------- messages ----------
  saveMessage(msg: {
    id: string;
    userId: string | null;
    username: string | null;
    avatarId: number | null;
    text: string;
    replyToUserId?: string;
    replyToKnightName?: string;
    timestamp: number;
    version: string;
  }): void {
    db.prepare(
      `INSERT OR IGNORE INTO chat_messages
         (id, user_id, username, avatar_id, text, reply_to_user_id, reply_to_knight_name, timestamp, version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      msg.id,
      msg.userId ?? null,
      msg.username ?? null,
      msg.avatarId ?? null,
      msg.text,
      msg.replyToUserId ?? null,
      msg.replyToKnightName ?? null,
      msg.timestamp,
      msg.version
    );
  },

  getMessages(version: string, limit = 100): DbMessage[] {
    return db
      .prepare<[string, number], DbMessage>(
        `SELECT * FROM chat_messages WHERE version = ?
         ORDER BY timestamp ASC LIMIT ?`
      )
      .all(version, limit) as DbMessage[];
  },
};

export default Winchester;
