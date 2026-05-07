import type { SeatSpeechBubbleState } from '../types';
import { getSeatOrbitTransform, ROUND_TABLE_SEAT_COUNT } from '../lib/tableOrbit';

interface SeatMessageBubbleProps {
  seatIndex: number;
  bubble: SeatSpeechBubbleState;
}

/** Пузырёк над маркером места — отдельный слой без наклона стола (позиционируется в той же плоской орбите). */
export function SeatMessageBubble({ seatIndex, bubble }: SeatMessageBubbleProps) {
  const orbit = getSeatOrbitTransform(seatIndex, ROUND_TABLE_SEAT_COUNT);
  const zBubble = orbit.zIndex + 450;

  return (
    <div
      className="seat-bubble-anchor"
      style={{
        left: orbit.left,
        top: orbit.top,
        transform: orbit.transform,
        zIndex: zBubble,
      }}
    >
      <div className="seat-message-bubble" role="status">
        {bubble.replyToKnightName ? (
          <span className="seat-message-bubble-reply-hint">
            ↪ @{bubble.replyToKnightName}
          </span>
        ) : null}
        <p className="seat-message-bubble-body">{bubble.text}</p>
      </div>
    </div>
  );
}
