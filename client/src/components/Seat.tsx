import type { KeyboardEvent } from 'react';
import type { ChatReplyTarget, User } from '../types';
import { KnightAvatar } from './KnightAvatar';
import { Mic, MicOff } from 'lucide-react';
import { getSeatOrbitTransform } from '../lib/tableOrbit';

interface SeatProps {
  seatIndex: number;
  user: User | undefined;
  isCurrentUser: boolean;
  totalSeats: number;
  onReplySeatPick?: (target: ChatReplyTarget | null) => void;
}

export function Seat({
  seatIndex,
  user,
  isCurrentUser,
  totalSeats,
  onReplySeatPick,
}: SeatProps) {
  const orbit = getSeatOrbitTransform(seatIndex, totalSeats);

  const markerStyle = {
    left: orbit.left,
    top: orbit.top,
    transform: orbit.transform,
    zIndex: orbit.zIndex,
    '--seat-depth': orbit.depth,
  } as React.CSSProperties;

  const markerShellClass =
    [
      'seat-marker-shell',
      user ? '' : 'vacant',
      user && seatIndex === 0 ? 'seat-marker-crown-slot' : '',
      user && isCurrentUser ? 'seat-marker-shell-current' : '',
      user?.isSpeaking ? 'seat-speaking' : '',
    ]
      .filter(Boolean)
      .join(' ');

  const canPickReply =
    Boolean(onReplySeatPick) && Boolean(user) && !isCurrentUser;

  const pickReplyTarget = (): void => {
    if (!onReplySeatPick || !user || isCurrentUser) return;
    onReplySeatPick({
      userId: user.id,
      knightName: user.knightName,
      avatarId: user.avatarId,
    });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!canPickReply) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      pickReplyTarget();
    }
  };

  if (!user) {
    return (
      <div className={markerShellClass} style={markerStyle}>
        <div className="seat-marker">
          <div className="seat-avatar-slot">
            <KnightAvatar avatarId={0} isEmpty={true} size="medium" />
          </div>
        </div>
      </div>
    );
  }

  const markerInner = (
    <>
      {user.isSpeaking ? (
        <span className="seat-speaking-ring seat-speaking-ring-live" aria-hidden />
      ) : null}
      <div className="seat-avatar-slot">
        <KnightAvatar avatarId={user.avatarId} isEmpty={false} size="medium" />
      </div>
      <span
        className={`seat-mic-indicator ${user.micEnabled ? 'seat-mic-on' : 'seat-mic-off'}`}
        aria-hidden
      >
        {user.micEnabled ? (
          <Mic className="seat-mic-indicator-icon" />
        ) : (
          <MicOff className="seat-mic-indicator-icon" />
        )}
      </span>
      {isCurrentUser ? (
        <span className="seat-you-badge" aria-live="polite">
          You
        </span>
      ) : null}
    </>
  );

  if (canPickReply) {
    return (
      <div className={markerShellClass} style={markerStyle}>
        <button
          type="button"
          className="seat-marker seat-marker-filled seat-marker-interactive"
          aria-label={`Reply to ${user.knightName}`}
          title={user.knightName}
          onClick={pickReplyTarget}
          onKeyDown={handleKeyDown}
        >
          {markerInner}
        </button>
      </div>
    );
  }

  const label = isCurrentUser ? `Your seat (${user.knightName})` : user.knightName;

  return (
    <div
      className={markerShellClass}
      style={markerStyle}
      role="group"
      aria-label={label}
      title={user.knightName}
    >
      <div className="seat-marker seat-marker-filled seat-marker-self">
        {markerInner}
      </div>
    </div>
  );
}
