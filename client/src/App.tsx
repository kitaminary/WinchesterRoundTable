import { useState, useEffect, useCallback } from 'react';
import { useRoom } from './hooks/useRoom';
import { useVoiceChat } from './hooks/useVoiceChat';
import { useKeyboardShortcut } from './hooks/useKeyboardShortcut';
import { LoginScreen } from './components/LoginScreen';
import { EnterChamberScreen } from './components/EnterChamberScreen';
import { RoomScreen } from './components/RoomScreen';
import { FullRoomScreen } from './components/FullRoomScreen';
import { Loader2 } from 'lucide-react';
import {
  getStoredToken,
  storeToken,
  clearToken,
  fetchMe,
  apiLogout,
  type AuthUser,
} from './lib/authSession';
import { socket, reconnectSocket } from './socket';

type AuthState = 'checking' | 'unauthenticated' | 'authenticated';

export default function App() {
  const [authState, setAuthState] = useState<AuthState>('checking');
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [chamberReady, setChamberReady] = useState(false);

  // On mount: validate stored token
  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setAuthState('unauthenticated');
      return;
    }
    fetchMe(token).then((user) => {
      if (user) {
        setAuthUser(user);
        setAuthState('authenticated');
      } else {
        clearToken();
        setAuthState('unauthenticated');
      }
    });
  }, []);

  const {
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
  } = useRoom();

  const { micEnabled, isSpeaking, micError, audioBlocked, toggleMic, disableMic, retryAudio } =
    useVoiceChat(users, updateMicStatus, updateSpeakingStatus);

  useKeyboardShortcut('v', toggleMic, {
    enabled: status === 'in_room',
    ignoreInputs: true,
    physicalCodes: ['KeyV'],
  });

  // Connect socket and join room once chamber is entered
  useEffect(() => {
    if (authState !== 'authenticated' || !chamberReady) return;
    reconnectSocket();
    const onConnect = () => joinRoom();
    if (socket.connected) {
      joinRoom();
    } else {
      socket.once('connect', onConnect);
    }
    return () => { socket.off('connect', onConnect); };
  }, [authState, chamberReady]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAuthenticated = useCallback((user: AuthUser, token: string) => {
    storeToken(token);
    setAuthUser(user);
    setAuthState('authenticated');
    // Login form submit is a user gesture — unlockAudio already called in LoginScreen.
    // Go straight to room, no interstitial needed.
    setChamberReady(true);
  }, []);

  const handleEnterChamber = useCallback(() => {
    setChamberReady(true);
  }, []);

  const handleLogout = useCallback(async () => {
    if (micEnabled) disableMic();
    leaveTable();
    socket.disconnect();
    const token = getStoredToken();
    if (token) await apiLogout(token);
    clearToken();
    setAuthUser(null);
    setAuthState('unauthenticated');
    setChamberReady(false);
  }, [micEnabled, disableMic, leaveTable]);

  // --- Render ---
  if (authState === 'checking') {
    return (
      <div className="entry-screen">
        <div style={{ textAlign: 'center', color: 'var(--gold)' }}>
          <Loader2 style={{ width: 40, height: 40, animation: 'spin 1s linear infinite' }} />
          <p style={{ marginTop: '0.75rem', fontFamily: 'var(--font-display)' }}>
            Verifying your seal…
          </p>
        </div>
      </div>
    );
  }

  if (authState === 'unauthenticated') {
    return <LoginScreen onAuthenticated={handleAuthenticated} />;
  }

  // Authenticated but hasn't clicked "Enter the Chamber" yet (returning user, no gesture)
  if (!chamberReady && authUser) {
    return (
      <EnterChamberScreen
        authUser={authUser}
        onEnter={handleEnterChamber}
        onLogout={handleLogout}
      />
    );
  }

  if (status === 'room_full') {
    return <FullRoomScreen onRetry={retryAfterRoomFull} />;
  }

  if (status === 'in_room' && currentUser) {
    return (
      <RoomScreen
        users={users}
        messages={messages}
        currentUser={currentUser}
        micEnabled={micEnabled}
        isSpeaking={isSpeaking}
        micError={micError}
        audioBlocked={audioBlocked}
        activityNotice={activityNotice}
        seatSpeechBubbles={seatSpeechBubbles}
        sendMessage={sendMessage}
        onToggleMic={toggleMic}
        onRetryAudio={retryAudio}
        onLogout={handleLogout}
        authUser={authUser}
        error={error}
      />
    );
  }

  // Joining / connecting state
  return (
    <div className="entry-screen">
      <div style={{ textAlign: 'center', color: 'var(--gold)' }}>
        <Loader2 style={{ width: 40, height: 40, animation: 'spin 1s linear infinite' }} />
        <p style={{ marginTop: '0.75rem', fontFamily: 'var(--font-display)', fontSize: '1.1rem' }}>
          {joinPending
            ? 'Taking your seat…'
            : socketConnected
              ? 'Connected. Entering chamber…'
              : 'Connecting to the Round Table…'}
        </p>
        {error && error !== 'auth_required' && (
          <p style={{ color: 'var(--accent-red)', marginTop: '0.5rem' }}>{error}</p>
        )}
      </div>
    </div>
  );
}
