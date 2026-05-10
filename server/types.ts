export interface User {
  id: string;
  knightName: string;
  seatIndex: number;
  avatarId: number;
  micEnabled: boolean;
  isSpeaking: boolean;
  joinedAt: number;
}

export interface ChatMessage {
  id: string;
  type: 'user' | 'system';
  userId?: string;
  knightName?: string;
  avatarId?: number;
  text: string;
  timestamp: number;
  replyToUserId?: string;
  replyToKnightName?: string;
}

export interface RoomState {
  users: User[];
  messages: ChatMessage[];
}

/** join_room no longer needs a payload — identity comes from socket auth token. */
export interface JoinRoomPayload {
  _?: never;
}

export interface ChatMessagePayload {
  text: string;
  replyToUserId?: string;
}

export type RoomNoticeKind = 'user_joined' | 'user_left';

export interface RoomNoticePayload {
  kind: RoomNoticeKind;
  knightName: string;
}

export interface MicStatusPayload {
  enabled: boolean;
}

export interface SpeakingStatusPayload {
  isSpeaking: boolean;
}

export interface VoiceOfferPayload {
  targetUserId: string;
  offer: RTCSessionDescriptionInit;
}

export interface VoiceAnswerPayload {
  targetUserId: string;
  answer: RTCSessionDescriptionInit;
}

export interface VoiceIceCandidatePayload {
  targetUserId: string;
  candidate: RTCIceCandidateInit;
}

export interface VoiceJoinPayload {
  passive?: boolean;
}

export interface JoinSuccessPayload {
  currentUser: User;
  roomState: RoomState;
}

export interface JoinErrorPayload {
  message: string;
}

export interface ServerToClientEvents {
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

export interface ClientToServerEvents {
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
