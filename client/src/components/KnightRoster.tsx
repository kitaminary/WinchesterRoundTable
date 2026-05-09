import { Users, Mic, MicOff } from 'lucide-react';
import type { User } from '../types';
import { KnightAvatar } from './KnightAvatar';

interface KnightRosterProps {
  users: User[];
  currentUserId: string;
}

export function KnightRoster({ users, currentUserId }: KnightRosterProps) {
  const sortedUsers = [...users].sort((a, b) => a.seatIndex - b.seatIndex);

  return (
    <div className="knight-roster">
      <div className="roster-header">
        <Users className="roster-icon" />
        <span>Knights Present</span>
        <span className="roster-count">{users.length}/13</span>
      </div>

      <div className="roster-list">
        {sortedUsers.map((user) => (
          <div
            key={user.id}
            className={`roster-item ${user.id === currentUserId ? 'current' : ''} ${user.isSpeaking ? 'speaking' : ''}`}
            title={`Seat ${user.seatIndex + 1}`}
          >
            <div className="roster-avatar">
              <KnightAvatar avatarId={user.avatarId} size="small" />
              {user.isSpeaking && <div className="roster-speaking-dot" />}
            </div>
            <div className="roster-info">
              <span className="roster-name">
                {user.knightName}
                {user.id === currentUserId && <span className="roster-you"> (You)</span>}
              </span>
              <span className="sr-only">Seat {user.seatIndex + 1}</span>
            </div>
            <div className={`roster-mic ${user.micEnabled ? 'active' : ''}`} aria-hidden>
              {user.micEnabled ? (
                <Mic className="roster-mic-icon" />
              ) : (
                <MicOff className="roster-mic-icon" />
              )}
            </div>
          </div>
        ))}

        {
          [...Array(13 - users.length)].map((_, index) => (
            <div
              key="empty"
              className="roster-item"
              title="Empty seat"
            >
              <div className="roster-avatar">
                <KnightAvatar avatarId={1} size="small" />
                <div className="roster-speaking-dot" />
              </div>
              <div className="roster-info">
                <span className="roster-name">
                  Empty seat
                </span>
                <span className="sr-only">Empty seat</span>
              </div>
              <div className="roster-mic" aria-hidden>
                <MicOff className="roster-mic-icon" />
              </div>
            </div>
          ))
        }

        {users.length === 0 && (
          <div className="roster-empty">
            <p>No knights have arrived yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
