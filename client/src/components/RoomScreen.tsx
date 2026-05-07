import { useState, useCallback } from 'react';
import { LogOut } from 'lucide-react';
import type {
  User,
  ChatMessage,
  ChatReplyTarget,
  SendChatOptions,
  SeatSpeechBubbleState,
} from '../types';
import { RoundTable } from './RoundTable';
import { ChatPanel } from './ChatPanel';
import { VoiceControls } from './VoiceControls';
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
  sendMessage: (text: string, options?: SendChatOptions) => void;
  onToggleMic: () => void;
  onLeaveTable: () => void;
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
  sendMessage,
  onToggleMic,
  onLeaveTable,
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
      <header className="room-toolbar">
        <div className="room-toolbar-inner">
          <span className="room-toolbar-seat" aria-hidden>
            Winchester chamber
          </span>
          <button
            type="button"
            className="leave-table-button"
            onClick={onLeaveTable}
            aria-label="Leave table and clear saved name"
          >
            <LogOut className="leave-table-icon" aria-hidden />
            Leave table
          </button>
        </div>
      </header>
      <div className="room-main">
        <div className="sidebar sidebar-left">
          <KnightRoster users={users} currentUserId={currentUser.id} />
          <VoiceControls
            micEnabled={micEnabled}
            isSpeaking={isSpeaking}
            micError={micError}
            onToggle={onToggleMic}
          />
        </div>
        <div className="table-section">
          <RoundTable
            users={users}
            currentUserId={currentUser.id}
            seatSpeechBubbles={seatSpeechBubbles}
            onReplySeatPick={setReplyTarget}
          />
        </div>
        <div className="sidebar">
          <ChatPanel
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
