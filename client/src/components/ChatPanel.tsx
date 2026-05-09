import { useState, useRef, useEffect, FormEvent, KeyboardEvent } from 'react';
import { Send, MessageSquare, X } from 'lucide-react';
import type { ChatMessage, ChatReplyTarget } from '../types';
import { KnightAvatar } from './KnightAvatar';
import { Mic, MicOff, AlertCircle } from 'lucide-react';

interface ChatPanelProps {
  messages: ChatMessage[];
  currentUserId: string;
  replyTarget: ChatReplyTarget | null;
  activityNotice: string | null;
  onClearReply: () => void;
  onSendMessage: (text: string, options?: { replyToUserId?: string }) => void;
  onToggleMic: () => void;
  micEnabled: boolean;
  isSpeaking: boolean;
  micError: string | null;
}

export function ChatPanel({
  messages,
  currentUserId,
  replyTarget,
  activityNotice,
  onClearReply,
  onSendMessage,
  onToggleMic,
  micEnabled,
  isSpeaking,
  micError,
}: ChatPanelProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const submitInternal = (): void => {
    const trimmed = input.trim();
    if (!trimmed || trimmed.length > 500) return;
    onSendMessage(trimmed, {
      replyToUserId: replyTarget?.userId,
    });
    setInput('');
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    submitInternal();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitInternal();
    }
  };

  const formatTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const next = Math.min(el.scrollHeight, 120);
    el.style.height = `${next}px`;
  }, [input]);

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <div className="chat-header-titles-left">
          <MessageSquare className="chat-header-icon" />
          <span className="chat-header-title">Council Chamber</span>
          <button
            onClick={onToggleMic}
            className={`voice-button ${micEnabled ? 'active' : ''} ${isSpeaking ? 'speaking' : ''}`}
            aria-label={micEnabled ? 'Disable microphone' : 'Enable microphone'}
          >
            <div className="voice-button-inner">
              {micEnabled ? (
                <Mic className="voice-icon" />
              ) : (
                <MicOff className="voice-icon" />
              )}
            </div>
            {isSpeaking && <div className="voice-speaking-ring" />}
          </button>
        </div>
        <span className="chat-header-sub">
          Messages • arrivals and departures in the banner above
        </span>
      </div>

      {activityNotice && (
        <div className="chat-activity-strip" role="status" aria-live="polite">
          {activityNotice}
        </div>
      )}

      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <p>The council awaits your wisdom…</p>
          </div>
        ) : (
          <>
            {messages
              .filter((m) => m.type === 'user')
              .map((msg) => {
                const isOwn = msg.userId === currentUserId;
                return (
                  <article
                    key={msg.id}
                    className={`chat-message user ${isOwn ? 'own' : ''}`}
                  >
                    <div className="user-message">
                      <div className="message-avatar">
                        <KnightAvatar avatarId={msg.avatarId ?? 0} size="small" />
                      </div>
                      <div className="message-content">
                        <div className="message-header">
                          <span className="message-author">{msg.knightName}</span>
                          <time
                            className="message-time"
                            dateTime={new Date(msg.timestamp).toISOString()}
                          >
                            {formatTime(msg.timestamp)}
                          </time>
                        </div>
                        {msg.replyToKnightName && (
                          <div className="message-reply-context">
                            Replying to{' '}
                            <span className="message-reply-name">{msg.replyToKnightName}</span>
                          </div>
                        )}
                        <p className="message-text">{msg.text}</p>
                      </div>
                    </div>
                  </article>
                );
              })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <div className="chat-input-section">
        {replyTarget && (
          <div className="chat-reply-bar">
            <span className="chat-reply-label">
              Replying to <strong>{replyTarget.knightName}</strong>
            </span>
            <button
              type="button"
              className="chat-reply-dismiss"
              onClick={onClearReply}
              aria-label="Cancel reply"
            >
              <X className="chat-reply-dismiss-icon" />
            </button>
          </div>
        )}
        <form onSubmit={handleSubmit} className="chat-input-form">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={replyTarget ? `Message ${replyTarget.knightName}…` : 'Speak to the council…'}
            className="chat-input chat-textarea"
            maxLength={500}
            rows={1}
            autoComplete="off"
            aria-label="Chat message"
          />
          <button
            type="submit"
            className="chat-send-button"
            disabled={!input.trim()}
            aria-label="Send message"
          >
            <Send className="send-icon" />
          </button>
        </form>
      </div>
      {micError && (
        <div className="voice-error">
          <AlertCircle className="error-icon" />
          <span>{micError}</span>
        </div>
      )}
    </div>
  );
}
