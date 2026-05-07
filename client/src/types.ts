export interface User {

  id: string;

  knightName: string;

  seatIndex: number;

  avatarId: number;

  micEnabled: boolean;

  isSpeaking: boolean;

  joinedAt: number;

}



export interface ChatReplyTarget {

  userId: string;

  knightName: string;

  avatarId?: number;

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

/** Краткий текст над иконкой места из последнего chat-сообщения пользователя. */
export interface SeatSpeechBubbleState {
  text: string;
  replyToKnightName?: string;
  sourceMessageId: string;
}

export interface RoomState {

  users: User[];

  messages: ChatMessage[];

}



export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'restoring'
  | 'in_room'
  | 'room_full';



export interface JoinSuccessPayload {

  currentUser: User;

  roomState: RoomState;

}



export interface JoinErrorPayload {

  message: string;

}



export interface JoinRoomPayload {

  knightName: string;

  preferredAvatarId?: number;

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



export interface SendChatOptions {

  replyToUserId?: string;

}


