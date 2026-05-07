import { useRoom } from './hooks/useRoom';
import { useVoiceChat } from './hooks/useVoiceChat';
import { useKeyboardShortcut } from './hooks/useKeyboardShortcut';
import { EntryScreen } from './components/EntryScreen';
import { RoomScreen } from './components/RoomScreen';
import { FullRoomScreen } from './components/FullRoomScreen';
import { RestoringScreen } from './components/RestoringScreen';

export default function App() {
  const {
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
  } = useRoom();

  const {
    micEnabled,
    isSpeaking,
    micError,
    toggleMic,
    disableMic,
  } = useVoiceChat(users, updateMicStatus, updateSpeakingStatus);

  useKeyboardShortcut('v', toggleMic, {
    enabled: status === 'in_room',
    ignoreInputs: true,
    physicalCodes: ['KeyV'],
  });

  const handleLeaveTable = () => {
    if (micEnabled) {
      disableMic();
    }
    leaveTable();
  };

  if (status === 'restoring') {
    return (
      <RestoringScreen
        savedKnightName={defaultEntryName}
        socketConnected={socketConnected}
        joinPending={joinPending}
        error={error}
        onCancel={cancelSessionRestore}
        onRetry={retryRestoreConnection}
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
        activityNotice={activityNotice}
        seatSpeechBubbles={seatSpeechBubbles}
        sendMessage={sendMessage}
        onToggleMic={toggleMic}
        onLeaveTable={handleLeaveTable}
      />
    );
  }

  return (
    <EntryScreen
      onJoin={joinRoom}
      socketConnected={socketConnected}
      joinPending={joinPending}
      serverStatus={status}
      error={error}
      defaultKnightName={defaultEntryName}
    />
  );
}
