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
  } as const;

  const markerShellClass =
    [
      'seat-marker-shell',
      user ? '' : 'empty-seat-marker-slot',
      user && seatIndex === 0 ? 'seat-marker-crown-slot' : '',
      user && isCurrentUser ? 'seat-marker-shell-current' : '',
    ]
      .filter(Boolean)
      .join(' ');

  /** Клик для reply только по чужой занятой иконке. Пустые места не интерактивны (см. требование). */
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
      <div className="seat-marker-shell empty-seat-marker-slot vacant" style={markerStyle}>
        <div className="empty-seat-marker" aria-hidden />
        <span className="sr-only">Vacant place {seatIndex + 1}</span>
      </div>
    );
  }

  const markerInner = (
    <>
      {user.isSpeaking ? <span className="seat-speaking-ring seat-speaking-ring-live" aria-hidden /> : null}
      <span className="seat-marker-highlight" aria-hidden />
      <div className="seat-avatar-slot">
        <KnightAvatar avatarId={user.avatarId} isEmpty={false} size="medium" />
      </div>
      <span className={`seat-mic-indicator ${user.micEnabled ? 'seat-mic-on' : 'seat-mic-off'}`} aria-hidden>
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
          className={`seat-marker seat-marker-filled seat-marker-interactive`}
          aria-label={`Reply to ${user.knightName}`}
          title={user.knightName}
          style={{ boxShadow: orbit.boxShadow }}
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
      <div
        className="seat-marker seat-marker-filled seat-marker-self"
        style={{ boxShadow: orbit.boxShadow }}
      >
        {markerInner}
      </div>
    </div>
  );
}
