import type { SeatSpeechBubbleState } from '../types';
import {
  getSeatOrbitTransform,
  seatPerspectivePosition,
  ROUND_TABLE_SEAT_COUNT,
} from '../lib/tableOrbit';

interface SeatMessageBubbleProps {
  seatIndex: number;
  bubble: SeatSpeechBubbleState;
}

export function SeatMessageBubble({ seatIndex, bubble }: SeatMessageBubbleProps) {
  const orbit = getSeatOrbitTransform(seatIndex, ROUND_TABLE_SEAT_COUNT);
  const pos = seatPerspectivePosition(seatIndex, ROUND_TABLE_SEAT_COUNT);
  const zBubble = orbit.zIndex + 450;

  return (
    <div
      className="seat-bubble-anchor"
      style={{
        left: orbit.left,
        top: orbit.top,
        transform: orbit.transform,
        zIndex: zBubble,
        '--bubble-y-offset': `${pos.bubbleYOffset}px`,
      } as React.CSSProperties}
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
