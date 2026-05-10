import { useState, useCallback } from 'react';
import { LogOut } from 'lucide-react';
import type {
  User,
  ChatMessage,
  ChatReplyTarget,
  SendChatOptions,
  SeatSpeechBubbleState,
} from '../types';
import type { AuthUser } from '../lib/authSession';
import { RoundTable } from './RoundTable';
import { ChatPanel } from './ChatPanel';
import { KnightRoster } from './KnightRoster';

interface RoomScreenProps {
  users: User[];
  messages: ChatMessage[];
  currentUser: User;
  micEnabled: boolean;
  isSpeaking: boolean;
  micError: string | null;
  activityNotice: string | null;
  seatSpeechBubbles: Record<string, SeatSpeechBubbleState>;
  authUser: AuthUser | null;
  error: string | null;
  sendMessage: (text: string, options?: SendChatOptions) => void;
  onToggleMic: () => void;
  onLogout: () => void;
  voicePlaybackBlocked: boolean;
  onResumeVoicePlayback: () => void;
}

export function RoomScreen({
  users,
  messages,
  currentUser,
  micEnabled,
  isSpeaking,
  micError,
  activityNotice,
  seatSpeechBubbles,
  authUser,
  error,
  voicePlaybackBlocked,
  onResumeVoicePlayback,
  sendMessage,
  onToggleMic,
  onLogout,
}: RoomScreenProps) {
  const [replyTarget, setReplyTarget] = useState<ChatReplyTarget | null>(null);

  const handleSend = useCallback(
    (text: string, options?: SendChatOptions) => {
      sendMessage(text, options);
      setReplyTarget(null);
    },
    [sendMessage]
  );

  return (
    <div className="room-screen">
      <div className="table-section">
        <RoundTable
          users={users}
          currentUserId={currentUser.id}
          seatSpeechBubbles={seatSpeechBubbles}
          onReplySeatPick={setReplyTarget}
        />
      </div>
      <header className="room-toolbar">
        {voicePlaybackBlocked && (
          <button
            type="button"
            className="voice-autoplay-banner"
            onClick={() => onResumeVoicePlayback()}
          >
            Click anywhere to hear voice audio
          </button>
        )}
        <div className="room-toolbar-inner">
          <span className="room-toolbar-seat" aria-hidden>
            Winchester round table
            {authUser && (
              <span style={{ opacity: 0.65, marginLeft: '0.5rem', fontSize: '0.85em' }}>
                — {authUser.username}
              </span>
            )}
          </span>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              type="button"
              className="leave-table-button logout-button"
              onClick={onLogout}
              title="Log out and clear session"
            >
              <LogOut className="leave-table-icon" aria-hidden />
              Log out
            </button>
          </div>
        </div>
        {error && (
          <p style={{ color: 'var(--accent-red)', textAlign: 'center', margin: '0.25rem 0 0', fontSize: '0.9rem' }}>
            {error}
          </p>
        )}
      </header>
      <div className="room-main">
        <div className="sidebar sidebar-left">
          <KnightRoster users={users} currentUserId={currentUser.id} />
        </div>
        <div className="sidebar">
          <ChatPanel
            micEnabled={micEnabled}
            isSpeaking={isSpeaking}
            micError={micError}
            onToggleMic={onToggleMic}
            messages={messages}
            currentUserId={currentUser.id}
            replyTarget={replyTarget}
            activityNotice={activityNotice}
            onClearReply={() => setReplyTarget(null)}
            onSendMessage={handleSend}
          />
        </div>
      </div>
    </div>
  );
}
