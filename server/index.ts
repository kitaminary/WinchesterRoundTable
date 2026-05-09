import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { roomState } from './roomState.js';
import { initDb, Winchester } from './db.js';
import { authRouter } from './auth.js';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  ChatMessagePayload,
  MicStatusPayload,
  SpeakingStatusPayload,
  VoiceOfferPayload,
  VoiceAnswerPayload,
  VoiceIceCandidatePayload,
} from './types.js';

const CHAT_VERSION = process.env.CHAT_HISTORY_VERSION ?? '1';

// ── Bootstrap ────────────────────────────────────────────────────────────────
// Run DB migrations and housekeeping before accepting connections.
await initDb();

// ── Express + Socket.IO ───────────────────────────────────────────────────────
const app = express();
const httpServer = createServer(app);

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: true, methods: ['GET', 'POST'], credentials: true },
});

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// ── REST routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', users: roomState.getUserCount(), chatVersion: CHAT_VERSION });
});

const clientDistPath = path.resolve(process.cwd(), 'dist', 'client');
const indexHtmlPath = path.join(clientDistPath, 'index.html');
app.use(express.static(clientDistPath));
app.get('*', (_req, res) => {
  if (!fs.existsSync(indexHtmlPath)) {
    res.status(503).type('text/plain').send(
      'Client bundle not found. Run npm run build first.',
    );
    return;
  }
  res.sendFile(indexHtmlPath);
});

// ── Socket.IO auth middleware ─────────────────────────────────────────────────
io.use(async (socket, next) => {
  const token = (socket.handshake.auth as Record<string, unknown>)?.token;
  if (typeof token !== 'string' || !token.trim()) {
    socket.data.authenticated = false;
    return next();
  }
  try {
    const dbUser = await Winchester.validateSession(token.trim());
    if (!dbUser) {
      socket.data.authenticated = false;
    } else {
      socket.data.authenticated = true;
      socket.data.dbUser = dbUser;
    }
    next();
  } catch (err) {
    console.error('[Socket] Auth middleware error:', err);
    socket.data.authenticated = false;
    next();
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function isValidString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}
function isValidBoolean(v: unknown): v is boolean {
  return typeof v === 'boolean';
}

async function getPersistedHistory() {
  const dbRows = await Winchester.getMessages(CHAT_VERSION, 100);
  return dbRows.map((row) => ({
    id: row.id,
    type: 'user' as const,
    userId: row.user_id ?? undefined,
    knightName: row.username ?? undefined,
    avatarId: row.avatar_id ?? undefined,
    text: row.text,
    timestamp: row.timestamp,
    replyToUserId: row.reply_to_user_id ?? undefined,
    replyToKnightName: row.reply_to_knight_name ?? undefined,
  }));
}

// ── Socket.IO event handlers ──────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[Socket] Connected: ${socket.id} | auth: ${socket.data.authenticated ?? false}`);

  socket.on('join_room', async () => {
    if (!socket.data.authenticated || !socket.data.dbUser) {
      socket.emit('join_error', { message: 'auth_required' });
      return;
    }

    const alreadySeated = roomState.getUser(socket.id);
    if (alreadySeated) {
      try {
        const history = await getPersistedHistory();
        socket.emit('join_success', {
          currentUser: alreadySeated,
          roomState: { ...roomState.getState(), messages: history },
        });
      } catch (err) {
        console.error('[join_room] history fetch error:', err);
        socket.emit('join_error', { message: 'internal_error' });
      }
      return;
    }

    if (roomState.isFull()) {
      socket.emit('room_full');
      return;
    }

    const dbUser = socket.data.dbUser as { id: string; username: string; avatar_id: number };
    const joinResult = roomState.addUser(socket.id, dbUser.username, dbUser.avatar_id);
    if (!joinResult) {
      socket.emit('room_full');
      return;
    }

    const { user } = joinResult;

    try {
      const history = await getPersistedHistory();
      socket.emit('join_success', {
        currentUser: user,
        roomState: { ...roomState.getState(), messages: history },
      });
    } catch (err) {
      console.error('[join_room] history fetch error:', err);
      socket.emit('join_success', {
        currentUser: user,
        roomState: { ...roomState.getState(), messages: [] },
      });
    }

    socket.broadcast.emit('user_joined', user);
    socket.broadcast.emit('room_notice', { kind: 'user_joined', knightName: user.knightName });
    console.log(`[Room] ${user.knightName} joined (seat ${user.seatIndex}, avatar ${user.avatarId})`);
  });

  socket.on('chat_message', async (payload: ChatMessagePayload) => {
    if (!isValidString(payload?.text)) return;

    const replyId =
      typeof payload.replyToUserId === 'string' && payload.replyToUserId.trim()
        ? payload.replyToUserId.trim()
        : undefined;

    const message = roomState.addChatMessage(socket.id, payload.text, replyId);
    if (!message) return;

    // Broadcast immediately — don't wait for DB write.
    io.emit('chat_message', message);

    // Persist asynchronously; log but don't crash on failure.
    Winchester.saveMessage({
      id: message.id,
      userId: message.userId ?? null,
      username: message.knightName ?? null,
      avatarId: message.avatarId ?? null,
      text: message.text,
      replyToUserId: message.replyToUserId,
      replyToKnightName: message.replyToKnightName,
      timestamp: message.timestamp,
      version: CHAT_VERSION,
    }).catch((err) => console.error('[chat_message] persist error:', err));
  });

  socket.on('mic_status', (payload: MicStatusPayload) => {
    if (!isValidBoolean(payload?.enabled)) return;
    const ok = roomState.updateMicStatus(socket.id, payload.enabled);
    if (ok) io.emit('mic_status', { userId: socket.id, enabled: payload.enabled });
  });

  socket.on('speaking_status', (payload: SpeakingStatusPayload) => {
    if (!isValidBoolean(payload?.isSpeaking)) return;
    const ok = roomState.updateSpeakingStatus(socket.id, payload.isSpeaking);
    if (ok) io.emit('speaking_status', { userId: socket.id, isSpeaking: payload.isSpeaking });
  });

  socket.on('voice_offer', (payload: VoiceOfferPayload) => {
    if (!payload?.targetUserId || !payload?.offer) return;
    io.sockets.sockets.get(payload.targetUserId)?.emit('voice_offer', {
      fromUserId: socket.id,
      offer: payload.offer,
    });
  });

  socket.on('voice_answer', (payload: VoiceAnswerPayload) => {
    if (!payload?.targetUserId || !payload?.answer) return;
    io.sockets.sockets.get(payload.targetUserId)?.emit('voice_answer', {
      fromUserId: socket.id,
      answer: payload.answer,
    });
  });

  socket.on('voice_ice_candidate', (payload: VoiceIceCandidatePayload) => {
    if (!payload?.targetUserId || !payload?.candidate) return;
    io.sockets.sockets.get(payload.targetUserId)?.emit('voice_ice_candidate', {
      fromUserId: socket.id,
      candidate: payload.candidate,
    });
  });

  socket.on('voice_leave', () => {
    socket.broadcast.emit('voice_leave', { userId: socket.id });
  });

  socket.on('leave_room', () => {
    const leaveResult = roomState.removeUser(socket.id);
    if (!leaveResult) return;
    const { user } = leaveResult;
    io.emit('user_left', socket.id);
    io.emit('room_notice', { kind: 'user_left', knightName: user.knightName });
    io.emit('room_state', roomState.getState());
    console.log(`[Room] ${user.knightName} left (leave_room)`);
  });

  socket.on('disconnect', () => {
    const leaveResult = roomState.removeUser(socket.id);
    if (leaveResult) {
      const { user } = leaveResult;
      io.emit('user_left', socket.id);
      io.emit('room_notice', { kind: 'user_left', knightName: user.knightName });
      io.emit('room_state', roomState.getState());
      console.log(`[Room] ${user.knightName} left`);
    }
    console.log(`[Socket] Disconnected: ${socket.id}`);
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT ?? 3000);
const HOST = '0.0.0.0';

httpServer.listen(PORT, HOST, () => {
  console.log('');
  console.log('Winchester Round Table — server');
  console.log(`  Local:        http://localhost:${PORT}`);
  console.log(`  Chat version: ${CHAT_VERSION}`);
  console.log(`  Database:     PostgreSQL (${process.env.DATABASE_URL ? 'via DATABASE_URL' : 'via PG* env vars'})`);
  console.log(`  Bundle:       ${fs.existsSync(indexHtmlPath) ? 'ok' : 'missing (run npm run build)'}`);
  console.log('');
});
