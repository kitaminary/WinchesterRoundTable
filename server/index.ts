import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { roomState } from './roomState.js';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  JoinRoomPayload,
  ChatMessagePayload,
  MicStatusPayload,
  SpeakingStatusPayload,
  VoiceOfferPayload,
  VoiceAnswerPayload,
  VoiceIceCandidatePayload,
} from './types.js';

const app = express();
const httpServer = createServer(app);

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: true,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

const clientDistPath = path.resolve(process.cwd(), 'dist', 'client');
const indexHtmlPath = path.join(clientDistPath, 'index.html');

app.use(express.static(clientDistPath));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', users: roomState.getUserCount() });
});

app.get('*', (_req, res) => {
  if (!fs.existsSync(indexHtmlPath)) {
    res
      .status(503)
      .type('text/plain')
      .send(
        'Client bundle not found. Expected dist/client/index.html. Run npm run clean && npm run build from the project root, then npm start.'
      );
    return;
  }
  res.sendFile(indexHtmlPath);
});

function isValidString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

io.on('connection', (socket) => {
  console.log(`[Socket] Connected: ${socket.id}`);

  socket.on('join_room', (payload: JoinRoomPayload) => {
    if (!payload || !isValidString(payload.knightName)) {
      socket.emit('join_error', { message: 'Enter your name before taking a seat.' });
      return;
    }

    const alreadySeated = roomState.getUser(socket.id);
    if (alreadySeated) {
      socket.emit('join_success', {
        currentUser: alreadySeated,
        roomState: roomState.getState(),
      });
      return;
    }

    if (roomState.isFull()) {
      socket.emit('room_full');
      return;
    }

    const preferredAvatarId =
      typeof payload.preferredAvatarId === 'number' &&
      payload.preferredAvatarId >= 0 &&
      payload.preferredAvatarId <= 12
        ? payload.preferredAvatarId
        : undefined;

    const joinResult = roomState.addUser(socket.id, payload.knightName, preferredAvatarId);
    if (!joinResult) {
      socket.emit('room_full');
      return;
    }

    const { user } = joinResult;
    const roomSnapshot = roomState.getState();

    socket.emit('join_success', {
      currentUser: user,
      roomState: roomSnapshot,
    });
    socket.broadcast.emit('user_joined', user);
    socket.broadcast.emit('room_notice', {
      kind: 'user_joined',
      knightName: user.knightName,
    });

    console.log(`[Room] ${user.knightName} joined (seat ${user.seatIndex}, avatar ${user.avatarId})`);
  });

  socket.on('chat_message', (payload: ChatMessagePayload) => {
    if (!payload || !isValidString(payload.text)) {
      return;
    }

    const replyId =
      typeof payload.replyToUserId === 'string' && payload.replyToUserId.trim() !== ''
        ? payload.replyToUserId.trim()
        : undefined;

    const message = roomState.addChatMessage(socket.id, payload.text, replyId);
    if (message) {
      io.emit('chat_message', message);
    }
  });

  socket.on('mic_status', (payload: MicStatusPayload) => {
    if (!payload || !isValidBoolean(payload.enabled)) {
      return;
    }

    const ok = roomState.updateMicStatus(socket.id, payload.enabled);
    if (ok) {
      io.emit('mic_status', { userId: socket.id, enabled: payload.enabled });
    }
  });

  socket.on('speaking_status', (payload: SpeakingStatusPayload) => {
    if (!payload || !isValidBoolean(payload.isSpeaking)) {
      return;
    }

    const success = roomState.updateSpeakingStatus(socket.id, payload.isSpeaking);
    if (success) {
      io.emit('speaking_status', { userId: socket.id, isSpeaking: payload.isSpeaking });
    }
  });

  socket.on('voice_offer', (payload: VoiceOfferPayload) => {
    if (!payload?.targetUserId || !payload?.offer) {
      return;
    }

    const targetSocket = io.sockets.sockets.get(payload.targetUserId);
    if (targetSocket) {
      targetSocket.emit('voice_offer', {
        fromUserId: socket.id,
        offer: payload.offer,
      });
    }
  });

  socket.on('voice_answer', (payload: VoiceAnswerPayload) => {
    if (!payload?.targetUserId || !payload?.answer) {
      return;
    }

    const targetSocket = io.sockets.sockets.get(payload.targetUserId);
    if (targetSocket) {
      targetSocket.emit('voice_answer', {
        fromUserId: socket.id,
        answer: payload.answer,
      });
    }
  });

  socket.on('voice_ice_candidate', (payload: VoiceIceCandidatePayload) => {
    if (!payload?.targetUserId || !payload?.candidate) {
      return;
    }

    const targetSocket = io.sockets.sockets.get(payload.targetUserId);
    if (targetSocket) {
      targetSocket.emit('voice_ice_candidate', {
        fromUserId: socket.id,
        candidate: payload.candidate,
      });
    }
  });

  socket.on('voice_leave', () => {
    socket.broadcast.emit('voice_leave', { userId: socket.id });
  });

  socket.on('leave_room', () => {
    const leaveResult = roomState.removeUser(socket.id);
    if (!leaveResult) {
      return;
    }
    const { user } = leaveResult;
    io.emit('user_left', socket.id);
    io.emit('room_notice', {
      kind: 'user_left',
      knightName: user.knightName,
    });
    io.emit('room_state', roomState.getState());
    console.log(`[Room] ${user.knightName} left (leave_room)`);
  });

  socket.on('disconnect', () => {
    const leaveResult = roomState.removeUser(socket.id);
    if (leaveResult) {
      const { user } = leaveResult;
      io.emit('user_left', socket.id);
      io.emit('room_notice', {
        kind: 'user_left',
        knightName: user.knightName,
      });
      io.emit('room_state', roomState.getState());
      console.log(`[Room] ${user.knightName} left`);
    }
    console.log(`[Socket] Disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

httpServer.listen(Number(PORT), HOST, () => {
  console.log('');
  console.log(`Winchester Round Table — server`);
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Static:  ${clientDistPath}`);
  console.log(`  Bundle:  ${fs.existsSync(indexHtmlPath) ? 'ok' : 'missing (run npm run build)'}`);
  console.log('');
});
