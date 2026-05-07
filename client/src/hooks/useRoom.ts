import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { socket, getSocketId } from '../socket';
import type {
  User,
  ChatMessage,
  ConnectionStatus,
  RoomNoticePayload,
  SendChatOptions,
  ChatMessagePayload,
  SeatSpeechBubbleState,
  JoinRoomPayload,
} from '../types';
import {
  clearSavedKnightName,
  getSavedKnightNameTrimmed,
  setSavedKnightName,
  shouldClearSessionOnJoinError,
  getSavedAvatarId,
  setSavedAvatarId,
  clearSavedAvatarId,
} from '../lib/knightSession';

interface UseRoomReturn {
  status: ConnectionStatus;
  users: User[];
  messages: ChatMessage[];
  currentUser: User | null;
  error: string | null;
  socketConnected: boolean;
  joinPending: boolean;
  activityNotice: string | null;
  defaultEntryName: string;
  joinRoom: (knightName: string) => void;
  sendMessage: (text: string, options?: SendChatOptions) => void;
  updateMicStatus: (enabled: boolean) => void;
  updateSpeakingStatus: (isSpeaking: boolean) => void;
  cancelSessionRestore: () => void;
  retryRestoreConnection: () => void;
  leaveTable: () => void;
  retryAfterRoomFull: () => void;
  seatSpeechBubbles: Record<string, SeatSpeechBubbleState>;
}

function filterUserFeedMessages(list: ChatMessage[]): ChatMessage[] {
  return list.filter((m) => m.type === 'user');
}

function appendMessageUnique(prev: ChatMessage[], message: ChatMessage): ChatMessage[] {
  if (message.type !== 'user') {
    return prev;
  }
  if (prev.some((m) => m.id === message.id)) {
    return prev;
  }
  return [...prev.slice(-99), message];
}

function clearSeatSpeechBubbleTimers(ref: {
  current: Map<string, ReturnType<typeof setTimeout>>;
}) {
  ref.current.forEach((t) => clearTimeout(t));
  ref.current.clear();
}

function initialSavedKnightRef(): string | null {
  if (typeof window === 'undefined') return null;
  return getSavedKnightNameTrimmed();
}

export function useRoom(): UseRoomReturn {
  const initialSaved = initialSavedKnightRef();

  const [status, setStatus] = useState<ConnectionStatus>(() => {
    if (typeof window === 'undefined') return 'connecting';
    if (initialSaved) return 'restoring';
    return socket.connected ? 'connected' : 'connecting';
  });
  const [users, setUsers] = useState<User[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [joinedSelf, setJoinedSelf] = useState<User | null>(null);
  const [joinPending, setJoinPending] = useState(() => Boolean(initialSaved));
  const [socketConnected, setSocketConnected] = useState(socket.connected);
  const [activityNotice, setActivityNotice] = useState<string | null>(null);
  const [defaultEntryName, setDefaultEntryName] = useState(
    () => getSavedKnightNameTrimmed() ?? ''
  );
  const [seatSpeechBubbles, setSeatSpeechBubbles] = useState<
    Record<string, SeatSpeechBubbleState>
  >({});

  const pendingNameRef = useRef<string | null>(initialSaved);
  const joinPendingRef = useRef(Boolean(initialSaved));
  const statusRef = useRef(status);
  const selfIdRef = useRef<string | null>(null);
  const activityNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seatSpeechBubbleTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    joinPendingRef.current = joinPending;
  }, [joinPending]);

  useEffect(() => {
    selfIdRef.current = joinedSelf?.id ?? null;
  }, [joinedSelf?.id]);

  const currentUser = useMemo(() => {
    const id = joinedSelf?.id ?? getSocketId() ?? null;
    if (!id) return null;
    return users.find((u) => u.id === id) ?? joinedSelf ?? null;
  }, [joinedSelf, users]);

  const pushActivityNotice = useCallback((payload: RoomNoticePayload) => {
    const line =
      payload.kind === 'user_joined'
        ? `${payload.knightName} entered the chamber`
        : `${payload.knightName} departed`;
    if (activityNoticeTimerRef.current) {
      clearTimeout(activityNoticeTimerRef.current);
    }
    setActivityNotice(line);
    activityNoticeTimerRef.current = setTimeout(() => {
      setActivityNotice(null);
      activityNoticeTimerRef.current = null;
    }, 5200);
  }, []);

  useEffect(() => {
    const handleSocketConnect = () => {
      setSocketConnected(true);
      const resume = pendingNameRef.current;
      if (
        resume &&
        joinPendingRef.current &&
        statusRef.current !== 'in_room' &&
        statusRef.current !== 'room_full'
      ) {
        setError(null);
        const preferredAvatarId = getSavedAvatarId();
        const payload: JoinRoomPayload = { knightName: resume };
        if (preferredAvatarId !== null) {
          payload.preferredAvatarId = preferredAvatarId;
        }
        socket.emit('join_room', payload);
      } else if (statusRef.current === 'disconnected') {
        setStatus('connected');
      } else if (statusRef.current === 'connecting' && resume === null) {
        setStatus('connected');
      }
    };

    const handleSocketDisconnect = (reason: string) => {
      void reason;
      setSocketConnected(false);
      setJoinedSelf(null);
      selfIdRef.current = null;
      pendingNameRef.current = null;
      joinPendingRef.current = false;
      setJoinPending(false);
      setUsers([]);
      setMessages([]);
      clearSeatSpeechBubbleTimers(seatSpeechBubbleTimersRef);
      setSeatSpeechBubbles({});
      setDefaultEntryName(getSavedKnightNameTrimmed() ?? '');
      if (statusRef.current !== 'room_full') {
        setStatus('disconnected');
        setError('Lost connection to the server.');
      }
      setActivityNotice(null);
      if (activityNoticeTimerRef.current) {
        clearTimeout(activityNoticeTimerRef.current);
        activityNoticeTimerRef.current = null;
      }
    };

    const handleConnectError = () => {
      setSocketConnected(false);
      setError('Could not connect to the server. Check that it is running (port 3000).');
      pendingNameRef.current = null;
      joinPendingRef.current = false;
      setJoinPending(false);
      setDefaultEntryName(getSavedKnightNameTrimmed() ?? '');

      if (statusRef.current === 'restoring') {
        return;
      }

      setJoinedSelf(null);
      selfIdRef.current = null;
      setStatus('disconnected');
    };

    const handleRoomFull = () => {
      setStatus('room_full');
      setDefaultEntryName(getSavedKnightNameTrimmed() ?? '');
      pendingNameRef.current = null;
      joinPendingRef.current = false;
      setJoinPending(false);
    };

    const handleJoinSuccess = (payload: {
      currentUser: User;
      roomState: { users: User[]; messages: ChatMessage[] };
    }) => {
      clearSeatSpeechBubbleTimers(seatSpeechBubbleTimersRef);
      setSeatSpeechBubbles({});
      setSavedKnightName(payload.currentUser.knightName);
      setSavedAvatarId(payload.currentUser.avatarId);
      setDefaultEntryName(payload.currentUser.knightName);
      selfIdRef.current = payload.currentUser.id;
      setJoinedSelf(payload.currentUser);
      setUsers(payload.roomState.users);
      setMessages(filterUserFeedMessages(payload.roomState.messages));
      setStatus('in_room');
      pendingNameRef.current = null;
      joinPendingRef.current = false;
      setJoinPending(false);
      setError(null);
    };

    const handleJoinError = (payload: { message: string }) => {
      pendingNameRef.current = null;
      joinPendingRef.current = false;
      setJoinPending(false);
      setError(payload.message);
      if (shouldClearSessionOnJoinError(payload.message)) {
        clearSavedKnightName();
        clearSavedAvatarId();
        setDefaultEntryName('');
      } else {
        setDefaultEntryName(getSavedKnightNameTrimmed() ?? '');
      }
      if (statusRef.current !== 'in_room') {
        setStatus('connected');
      }
    };

    const handleRoomState = (state: { users: User[]; messages: ChatMessage[] }) => {
      if (statusRef.current !== 'in_room') {
        return;
      }
      setUsers(state.users);
      setMessages(filterUserFeedMessages(state.messages));
      const id = socket.id ?? selfIdRef.current;
      if (!id) return;
      const me = state.users.find((u) => u.id === id);
      if (me) {
        setJoinedSelf(me);
      }
    };

    const handleUserJoined = (user: User) => {
      setUsers((prev) => [...prev.filter((u) => u.id !== user.id), user]);
    };

    const handleUserLeft = (userId: string) => {
      const existing = seatSpeechBubbleTimersRef.current.get(userId);
      if (existing) {
        clearTimeout(existing);
      }
      seatSpeechBubbleTimersRef.current.delete(userId);
      setSeatSpeechBubbles((prev) => {
        if (!(userId in prev)) return prev;
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      const wasSelf = selfIdRef.current === userId;
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      if (wasSelf) {
        selfIdRef.current = null;
        setJoinedSelf(null);
        setStatus('connected');
        setMessages([]);
        clearSeatSpeechBubbleTimers(seatSpeechBubbleTimersRef);
        setSeatSpeechBubbles({});
      }
    };

    const handleChatMessage = (message: ChatMessage) => {
      setMessages((prev) => appendMessageUnique(prev, message));

      if (message.type !== 'user' || !message.userId) {
        return;
      }

      const uid = message.userId;
      const prevTimer = seatSpeechBubbleTimersRef.current.get(uid);
      if (prevTimer) clearTimeout(prevTimer);

      setSeatSpeechBubbles((prev) => ({
        ...prev,
        [uid]: {
          text: message.text,
          replyToKnightName: message.replyToKnightName,
          sourceMessageId: message.id,
        },
      }));

      const delayMs = 5200 + Math.floor(Math.random() * 2600);
      seatSpeechBubbleTimersRef.current.set(
        uid,
        setTimeout(() => {
          seatSpeechBubbleTimersRef.current.delete(uid);
          setSeatSpeechBubbles((past) => {
            if (!(uid in past)) return past;
            const next = { ...past };
            delete next[uid];
            return next;
          });
        }, delayMs)
      );
    };

    const handleRoomNotice = (payload: RoomNoticePayload) => {
      pushActivityNotice(payload);
    };

    const handleMicStatus = (data: { userId: string; enabled: boolean }) => {
      setUsers((prev) =>
        prev.map((u) => (u.id === data.userId ? { ...u, micEnabled: data.enabled } : u))
      );
    };

    const handleSpeakingStatus = (data: { userId: string; isSpeaking: boolean }) => {
      setUsers((prev) =>
        prev.map((u) => (u.id === data.userId ? { ...u, isSpeaking: data.isSpeaking } : u))
      );
    };

    socket.on('connect', handleSocketConnect);
    socket.on('disconnect', handleSocketDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on('room_full', handleRoomFull);
    socket.on('join_success', handleJoinSuccess);
    socket.on('join_error', handleJoinError);
    socket.on('room_state', handleRoomState);
    socket.on('user_joined', handleUserJoined);
    socket.on('user_left', handleUserLeft);
    socket.on('chat_message', handleChatMessage);
    socket.on('room_notice', handleRoomNotice);
    socket.on('mic_status', handleMicStatus);
    socket.on('speaking_status', handleSpeakingStatus);

    setSocketConnected(socket.connected);

    const bootstrapName = pendingNameRef.current?.trim();
    if (bootstrapName && joinPendingRef.current) {
      const preferredAvatarId = getSavedAvatarId();
      const payload: JoinRoomPayload = { knightName: bootstrapName };
      if (preferredAvatarId !== null) {
        payload.preferredAvatarId = preferredAvatarId;
      }

      if (socket.connected) {
        socket.emit('join_room', payload);
      } else {
        socket.connect();
      }
    }

    return () => {
      socket.off('connect', handleSocketConnect);
      socket.off('disconnect', handleSocketDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.off('room_full', handleRoomFull);
      socket.off('join_success', handleJoinSuccess);
      socket.off('join_error', handleJoinError);
      socket.off('room_state', handleRoomState);
      socket.off('user_joined', handleUserJoined);
      socket.off('user_left', handleUserLeft);
      socket.off('chat_message', handleChatMessage);
      socket.off('room_notice', handleRoomNotice);
      socket.off('mic_status', handleMicStatus);
      socket.off('speaking_status', handleSpeakingStatus);
      if (activityNoticeTimerRef.current) {
        clearTimeout(activityNoticeTimerRef.current);
      }
      clearSeatSpeechBubbleTimers(seatSpeechBubbleTimersRef);
    };
  }, [pushActivityNotice]);

  const joinRoom = useCallback((knightName: string) => {
    const trimmed = knightName.trim();
    if (!trimmed) return;

    setError(null);
    pendingNameRef.current = trimmed;
    joinPendingRef.current = true;
    setJoinPending(true);

    setStatus((prev) => {
      if (prev === 'in_room') return prev;
      return socket.connected ? 'connected' : 'connecting';
    });

    const preferredAvatarId = getSavedAvatarId();
    const payload: JoinRoomPayload = { knightName: trimmed };
    if (preferredAvatarId !== null) {
      payload.preferredAvatarId = preferredAvatarId;
    }

    if (socket.connected) {
      socket.emit('join_room', payload);
    } else {
      socket.connect();
    }
  }, []);

  const sendMessage = useCallback((text: string, options?: SendChatOptions) => {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > 500) return;
    const replyToUserId = options?.replyToUserId?.trim();
    const payload: ChatMessagePayload =
      replyToUserId && replyToUserId.length > 0
        ? { text: trimmed, replyToUserId }
        : { text: trimmed };
    socket.emit('chat_message', payload);
  }, []);

  const updateMicStatus = useCallback((enabled: boolean) => {
    socket.emit('mic_status', { enabled });
  }, []);

  const updateSpeakingStatus = useCallback((isSpeaking: boolean) => {
    socket.emit('speaking_status', { isSpeaking });
  }, []);

  const cancelSessionRestore = useCallback(() => {
    clearSavedKnightName();
    pendingNameRef.current = null;
    joinPendingRef.current = false;
    setJoinPending(false);
    setError(null);
    setDefaultEntryName('');
    setStatus(socket.connected ? 'connected' : 'connecting');
  }, []);

  const retryRestoreConnection = useCallback(() => {
    setError(null);
    const n = getSavedKnightNameTrimmed();
    if (!n) {
      cancelSessionRestore();
      return;
    }
    pendingNameRef.current = n;
    joinPendingRef.current = true;
    setJoinPending(true);
    setStatus('restoring');
    setDefaultEntryName(n);
    if (socket.connected) {
      socket.emit('join_room', { knightName: n });
    } else {
      socket.connect();
    }
  }, [cancelSessionRestore]);

  const leaveTable = useCallback(() => {
    clearSavedKnightName();
    clearSavedAvatarId();
    pendingNameRef.current = null;
    joinPendingRef.current = false;
    setJoinPending(false);
    setJoinedSelf(null);
    selfIdRef.current = null;
    setUsers([]);
    setMessages([]);
    clearSeatSpeechBubbleTimers(seatSpeechBubbleTimersRef);
    setSeatSpeechBubbles({});
    setError(null);
    setActivityNotice(null);
    setDefaultEntryName('');
    setStatus('connected');
    socket.emit('leave_room');
    if (activityNoticeTimerRef.current) {
      clearTimeout(activityNoticeTimerRef.current);
      activityNoticeTimerRef.current = null;
    }
  }, []);

  const retryAfterRoomFull = useCallback(() => {
    setError(null);
    const n = getSavedKnightNameTrimmed();
    if (n) {
      joinRoom(n);
    } else {
      setStatus('connected');
    }
  }, [joinRoom]);

  return {
    status,
    users,
    messages,
    currentUser,
    error,
    socketConnected,
    joinPending,
    activityNotice,
    defaultEntryName,
    joinRoom,
    sendMessage,
    updateMicStatus,
    updateSpeakingStatus,
    cancelSessionRestore,
    retryRestoreConnection,
    leaveTable,
    retryAfterRoomFull,
    seatSpeechBubbles,
  };
}
