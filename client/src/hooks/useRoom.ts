import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { socket } from '../socket';
import type {
  User,
  ChatMessage,
  ConnectionStatus,
  RoomNoticePayload,
  SendChatOptions,
  ChatMessagePayload,
  SeatSpeechBubbleState,
} from '../types';

interface UseRoomReturn {
  status: ConnectionStatus;
  users: User[];
  messages: ChatMessage[];
  currentUser: User | null;
  error: string | null;
  socketConnected: boolean;
  joinPending: boolean;
  activityNotice: string | null;
  joinRoom: () => void;
  sendMessage: (text: string, options?: SendChatOptions) => void;
  updateMicStatus: (enabled: boolean) => void;
  updateSpeakingStatus: (isSpeaking: boolean) => void;
  leaveTable: () => void;
  retryAfterRoomFull: () => void;
  seatSpeechBubbles: Record<string, SeatSpeechBubbleState>;
}

const SPEECH_BUBBLE_TTL = 8000;

function appendUnique(prev: ChatMessage[], message: ChatMessage): ChatMessage[] {
  if (message.type !== 'user') return prev;
  if (prev.some((m) => m.id === message.id)) return prev;
  return [...prev.slice(-99), message];
}

export function useRoom(): UseRoomReturn {
  const [status, setStatus] = useState<ConnectionStatus>(
    socket.connected ? 'connected' : 'connecting'
  );
  const [users, setUsers] = useState<User[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [joinedSelf, setJoinedSelf] = useState<User | null>(null);
  const [joinPending, setJoinPending] = useState(false);
  const [socketConnected, setSocketConnected] = useState(socket.connected);
  const [activityNotice, setActivityNotice] = useState<string | null>(null);
  const [seatSpeechBubbles, setSeatSpeechBubbles] = useState<Record<string, SeatSpeechBubbleState>>({});

  const selfIdRef = useRef<string | null>(null);
  const activityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bubbleTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const joinPendingRef = useRef(false);

  useEffect(() => { selfIdRef.current = joinedSelf?.id ?? null; }, [joinedSelf?.id]);
  useEffect(() => { joinPendingRef.current = joinPending; }, [joinPending]);

  const currentUser = useMemo(() => {
    const id = joinedSelf?.id ?? null;
    if (!id) return null;
    return users.find((u) => u.id === id) ?? joinedSelf ?? null;
  }, [joinedSelf, users]);

  const pushActivityNotice = useCallback((payload: RoomNoticePayload) => {
    const line =
      payload.kind === 'user_joined'
        ? `${payload.knightName} entered the chamber`
        : `${payload.knightName} left the table`;
    setActivityNotice(line);
    if (activityTimerRef.current) clearTimeout(activityTimerRef.current);
    activityTimerRef.current = setTimeout(() => setActivityNotice(null), 4500);
  }, []);

  const pushSpeechBubble = useCallback((msg: ChatMessage) => {
    if (!msg.userId) return;
    const id = msg.userId;
    setSeatSpeechBubbles((prev) => ({
      ...prev,
      [id]: { text: msg.text, replyToKnightName: msg.replyToKnightName, sourceMessageId: msg.id },
    }));
    const existing = bubbleTimersRef.current.get(id);
    if (existing) clearTimeout(existing);
    const t = setTimeout(() => {
      setSeatSpeechBubbles((prev) => {
        const next = { ...prev };
        if (next[id]?.sourceMessageId === msg.id) delete next[id];
        return next;
      });
      bubbleTimersRef.current.delete(id);
    }, SPEECH_BUBBLE_TTL);
    bubbleTimersRef.current.set(id, t);
  }, []);

  useEffect(() => {
    const handleConnect = () => {
      setSocketConnected(true);
      setError(null);

      // Re-join automatically on reconnect if we were in the room,
      // or if a join was pending (initial connect).
      if (selfIdRef.current || joinPendingRef.current) {
        socket.emit('join_room');
      } else {
        setStatus('connected');
      }
    };

    const handleDisconnect = () => {
      setSocketConnected(false);
      if (status !== 'in_room') setStatus('disconnected');
    };

    const handleConnectError = () => {
      setSocketConnected(false);
      setStatus('disconnected');
      setError('Could not connect to the server.');
      setJoinPending(false);
      joinPendingRef.current = false;
    };

    const handleRoomFull = () => {
      setStatus('room_full');
      setJoinPending(false);
      joinPendingRef.current = false;
    };

    const handleJoinSuccess = (payload: { currentUser: User; roomState: { users: User[]; messages: ChatMessage[] } }) => {
      setJoinedSelf(payload.currentUser);
      selfIdRef.current = payload.currentUser.id;
      setUsers(payload.roomState.users);
      // Merge server history with local messages to avoid losing anything on reconnect
      const serverMsgs = payload.roomState.messages.filter((m) => m.type === 'user');
      setMessages((prev) => {
        const ids = new Set(serverMsgs.map((m) => m.id));
        const localOnly = prev.filter((m) => !ids.has(m.id));
        return [...serverMsgs, ...localOnly].sort((a, b) => a.timestamp - b.timestamp).slice(-100);
      });
      setStatus('in_room');
      setJoinPending(false);
      joinPendingRef.current = false;
      setError(null);
    };

    const handleJoinError = (payload: { message: string }) => {
      setJoinPending(false);
      joinPendingRef.current = false;
      if (payload.message === 'auth_required') {
        // This shouldn't happen if useAuth is working, but handle gracefully
        setStatus('connected');
        setError('Session expired. Please log in again.');
      } else {
        setError(payload.message);
        setStatus('connected');
      }
    };

    const handleRoomState = (state: { users: User[]; messages: ChatMessage[] }) => {
      setUsers(state.users);
      // Don't replace messages — room_state broadcasts carry in-memory
      // messages which may be staler than the DB history we loaded on join.
    };

    const handleUserJoined = (user: User) => {
      setUsers((prev) => (prev.some((u) => u.id === user.id) ? prev : [...prev, user]));
    };

    const handleUserLeft = (userId: string) => {
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setSeatSpeechBubbles((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    };

    const handleChatMessage = (msg: ChatMessage) => {
      setMessages((prev) => appendUnique(prev, msg));
      pushSpeechBubble(msg);
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

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
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

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
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
      if (activityTimerRef.current) clearTimeout(activityTimerRef.current);
      bubbleTimersRef.current.forEach((t) => clearTimeout(t));
    };
  }, [pushActivityNotice, pushSpeechBubble]); // eslint-disable-line react-hooks/exhaustive-deps

  const joinRoom = useCallback(() => {
    setError(null);
    setJoinPending(true);
    joinPendingRef.current = true;
    if (socket.connected) {
      socket.emit('join_room');
    } else {
      socket.connect();
    }
  }, []);

  const sendMessage = useCallback((text: string, options?: SendChatOptions) => {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > 500) return;
    const payload: ChatMessagePayload = { text: trimmed };
    if (options?.replyToUserId) payload.replyToUserId = options.replyToUserId;
    socket.emit('chat_message', payload);
  }, []);

  const updateMicStatus = useCallback((enabled: boolean) => {
    socket.emit('mic_status', { enabled });
  }, []);

  const updateSpeakingStatus = useCallback((isSpeaking: boolean) => {
    socket.emit('speaking_status', { isSpeaking });
  }, []);

  const leaveTable = useCallback(() => {
    setJoinedSelf(null);
    selfIdRef.current = null;
    setUsers([]);
    setMessages([]);
    setSeatSpeechBubbles({});
    bubbleTimersRef.current.forEach((t) => clearTimeout(t));
    bubbleTimersRef.current.clear();
    setError(null);
    setActivityNotice(null);
    setJoinPending(false);
    joinPendingRef.current = false;
    setStatus(socket.connected ? 'connected' : 'connecting');
    socket.emit('leave_room');
  }, []);

  const retryAfterRoomFull = useCallback(() => {
    setError(null);
    setStatus(socket.connected ? 'connected' : 'connecting');
    joinRoom();
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
    joinRoom,
    sendMessage,
    updateMicStatus,
    updateSpeakingStatus,
    leaveTable,
    retryAfterRoomFull,
    seatSpeechBubbles,
  };
}
