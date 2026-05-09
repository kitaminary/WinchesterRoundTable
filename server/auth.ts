import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { Winchester } from './db.js';

export const authRouter = Router();

const BCRYPT_ROUNDS = 10;
const MAX_USERNAME_LEN = 32;
const MIN_PASSWORD_LEN = 4;

function validateUsername(u: unknown): string | null {
  if (typeof u !== 'string') return null;
  const t = u.trim();
  if (t.length < 2 || t.length > MAX_USERNAME_LEN) return null;
  // Allow letters, digits, spaces, underscores, hyphens
  if (!/^[\w\s-]+$/u.test(t)) return null;
  return t;
}

function validatePassword(p: unknown): string | null {
  if (typeof p !== 'string') return null;
  if (p.length < MIN_PASSWORD_LEN || p.length > 128) return null;
  return p;
}

function validateAvatarId(a: unknown): number {
  if (typeof a !== 'number' || !Number.isInteger(a)) return 0;
  return Math.min(12, Math.max(0, a));
}

// POST /api/auth/register
authRouter.post('/register', async (req, res) => {
  const username = validateUsername(req.body?.username);
  const password = validatePassword(req.body?.password);
  const avatarId = validateAvatarId(req.body?.avatarId);

  if (!username) {
    res.status(400).json({ error: 'Username must be 2–32 characters (letters, digits, spaces, _ or -).' });
    return;
  }
  if (!password) {
    res.status(400).json({ error: `Password must be ${MIN_PASSWORD_LEN}–128 characters.` });
    return;
  }

  const existing = Winchester.findUserByUsername(username);
  if (existing) {
    res.status(409).json({ error: 'That name is already taken at the Round Table.' });
    return;
  }

  const passHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = Winchester.createUser(username, passHash, avatarId);
  const token = Winchester.createSession(user.id);

  res.status(201).json({
    token,
    user: { id: user.id, username: user.username, avatarId: user.avatar_id },
  });
});

// POST /api/auth/login
authRouter.post('/login', async (req, res) => {
  const username = validateUsername(req.body?.username);
  const password = validatePassword(req.body?.password);

  if (!username || !password) {
    res.status(400).json({ error: 'Invalid credentials.' });
    return;
  }

  const dbUser = Winchester.findUserByUsername(username);
  if (!dbUser) {
    res.status(401).json({ error: 'Unknown knight. Check your name and password.' });
    return;
  }

  const match = await bcrypt.compare(password, dbUser.pass_hash);
  if (!match) {
    res.status(401).json({ error: 'Wrong password, Sir Knight.' });
    return;
  }

  const token = Winchester.createSession(dbUser.id);
  res.json({
    token,
    user: { id: dbUser.id, username: dbUser.username, avatarId: dbUser.avatar_id },
  });
});

// POST /api/auth/logout
authRouter.post('/logout', (req, res) => {
  const token = extractBearerToken(req);
  if (token) Winchester.deleteSession(token);
  res.json({ ok: true });
});

// GET /api/auth/me
authRouter.get('/me', (req, res) => {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'No session token.' });
    return;
  }
  const dbUser = Winchester.validateSession(token);
  if (!dbUser) {
    res.status(401).json({ error: 'Session expired or invalid.' });
    return;
  }
  res.json({ user: { id: dbUser.id, username: dbUser.username, avatarId: dbUser.avatar_id } });
});

function extractBearerToken(req: import('express').Request): string | null {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) return auth.slice(7).trim();
  return null;
}
