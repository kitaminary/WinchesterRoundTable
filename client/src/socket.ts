import { io, Socket } from 'socket.io-client';
import { getStoredToken } from './lib/authSession';
import type {
  User,
  RoomState,
  ChatMessage,
  ChatMessagePayload,
  MicStatusPayload,
  SpeakingStatusPayload,
  VoiceOfferPayload,
  VoiceAnswerPayload,
  VoiceIceCandidatePayload,
  VoiceJoinPayload,
  JoinSuccessPayload,
  JoinErrorPayload,
  RoomNoticePayload,
} from './types';

interface ServerToClientEvents {
  room_full: () => void;
  join_success: (payload: JoinSuccessPayload) => void;
  join_error: (payload: JoinErrorPayload) => void;
  room_state: (state: RoomState) => void;
  user_joined: (user: User) => void;
  user_left: (userId: string) => void;
  chat_message: (message: ChatMessage) => void;
  room_notice: (payload: RoomNoticePayload) => void;
  mic_status: (data: { userId: string; enabled: boolean }) => void;
  speaking_status: (data: { userId: string; isSpeaking: boolean }) => void;
  voice_offer: (data: { fromUserId: string; offer: RTCSessionDescriptionInit }) => void;
  voice_answer: (data: { fromUserId: string; answer: RTCSessionDescriptionInit }) => void;
  voice_ice_candidate: (data: { fromUserId: string; candidate: RTCIceCandidateInit }) => void;
  voice_leave: (data: { userId: string }) => void;
  voice_peer_ready: (data: { userId: string; passive: boolean }) => void;
}

interface ClientToServerEvents {
  join_room: () => void;
  chat_message: (payload: ChatMessagePayload) => void;
  mic_status: (payload: MicStatusPayload) => void;
  speaking_status: (payload: SpeakingStatusPayload) => void;
  voice_offer: (payload: VoiceOfferPayload) => void;
  voice_answer: (payload: VoiceAnswerPayload) => void;
  voice_ice_candidate: (payload: VoiceIceCandidatePayload) => void;
  voice_join: (payload: VoiceJoinPayload) => void;
  voice_leave: () => void;
  leave_room: () => void;
}

const SOCKET_URL =
  typeof import.meta.env.VITE_SOCKET_URL === 'string' &&
  import.meta.env.VITE_SOCKET_URL.trim() !== ''
    ? import.meta.env.VITE_SOCKET_URL.trim()
    : import.meta.env.DEV
      ? 'http://localhost:3000'
      : window.location.origin;

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(SOCKET_URL, {
  autoConnect: false,        // we connect manually after auth
  transports: ['websocket'], // skip HTTP polling upgrade; reduces ngrok request count
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  timeout: 10000,
  auth: (cb: (data: Record<string, unknown>) => void) => {
    cb({ token: getStoredToken() ?? '' });
  },
});

export function reconnectSocket(): void {
  if (socket.connected) {
    socket.disconnect();
  }
  socket.connect();
}

export function getSocketId(): string | undefined {
  return socket.id;
}
