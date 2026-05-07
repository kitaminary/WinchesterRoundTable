import { useMemo } from 'react';
import type { ChatReplyTarget, SeatSpeechBubbleState, User } from '../types';
import { Seat } from './Seat';
import { SeatMessageBubble } from './SeatMessageBubble';
import {
  ROUND_TABLE_SEAT_COUNT,
  wedgeMidAngleRadians,
} from '../lib/tableOrbit';

export const TOTAL_SEATS = ROUND_TABLE_SEAT_COUNT;

interface RoundTableProps {
  users: User[];
  currentUserId: string;
  onReplySeatPick?: (target: ChatReplyTarget | null) => void;
  seatSpeechBubbles: Record<string, SeatSpeechBubbleState>;
}

/** По одному готическому написанию на сектор; совпадает с 13 клиньями столешницы. */
const RIM_AROUND_NAMES = [
  'ARTHVR',
  'GALAHAD',
  'LANCELOT',
  'GAWVAIN',
  'PERCYVALL',
  'BORS',
  'BEDIVYR',
  'TRYSTA',
  'KAY',
  'LYONYLL',
  'LAMORA',
  'PELLYR',
  'GERAWNT',
] as const;

function rimLabelReadableRotation(lx: number, ly: number): number {
  const bearingDeg = (Math.atan2(ly - 50, lx - 50) * 180) / Math.PI;
  let rot = bearingDeg + 90;
  if (ly > 49.92) rot += 180;
  return rot;
}

/** Двухцветная тюдоровская роза (геометрия без «случайных» пятен). */
function WinchesterCentreRose() {
  const outerCount = 8;
  const innerCount = 8;

  const outerPetals = useMemo(
    () =>
      Array.from({ length: outerCount }, (_, k) => (
        <ellipse
          key={`tudor-white-${k}`}
          cx="0"
          cy="-7"
          rx="3.6"
          ry="7.2"
          fill="url(#tudorPetalIvory)"
          stroke="rgba(72,54,42,0.42)"
          strokeWidth="0.24"
          transform={`rotate(${k * (360 / outerCount)})`}
        />
      )),
    []
  );

  const innerPetals = useMemo(
    () =>
      Array.from({ length: innerCount }, (_, k) => (
        <ellipse
          key={`tudor-red-${k}`}
          cx="0"
          cy="-5.15"
          rx="2.45"
          ry="5"
          fill="url(#tudorPetalGarnet)"
          stroke="rgba(32,14,22,0.55)"
          strokeWidth="0.2"
          transform={`rotate(${22.5 + k * (360 / innerCount)})`}
        />
      )),
    []
  );

  return (
    <g aria-hidden transform="translate(50 50)">
      <circle cx="0" cy="0" r="17.85" fill="none" stroke="rgba(236,218,154,0.35)" strokeWidth="0.32" />
      <circle cx="0" cy="0" r="15.92" fill="none" stroke="rgba(118,94,62,0.38)" strokeWidth="0.24" />
      <circle cx="0" cy="0" r="14.06" fill="none" stroke="rgba(242,229,171,0.22)" strokeWidth="0.2" />
      {outerPetals}
      {innerPetals}
      <circle cx="0" cy="0" r="6.92" fill="url(#roseHeartGlow)" />
      <circle cx="0" cy="0" r="5.92" fill="url(#roseDarkBoss)" />
      <circle cx="0" cy="0" r="5.35" fill="none" stroke="rgba(240,226,184,0.38)" strokeWidth="0.16" />
    </g>
  );
}

/** Силуэт у золотого суверенного сектора (между центром и поясом). */
function SovereignKingMark({ n }: { n: number }) {
  const mid = wedgeMidAngleRadians(0, n);
  const r = 33.92;
  const lx = 50 + r * Math.cos(mid);
  const ly = 50 + r * Math.sin(mid);
  return (
    <g aria-hidden transform={`translate(${lx.toFixed(3)} ${ly.toFixed(3)}) rotate(${(mid * 180) / Math.PI})`}>
      <path
        fill="rgba(44,38,26,0.78)"
        stroke="rgba(250,226,174,0.38)"
        strokeWidth="0.18"
        d="M -3.92,-13.92 L -4.92,-17.92 L -2,-19.92 L 0,-18.92 L 2,-19.92 L 4.92,-17.92 L 3.92,-13.92 L 3,-9.92 L -3,-9.92 Z"
      />
      <path
        fill="rgba(180,154,112,0.55)"
        d="M -4.92,-17.92 L -2,-19.92 L -1.92,-21.92 L -3.92,-22.92 L -5.92,-20.92 Z M 4.92,-17.92 L 2,-19.92 L 1.92,-21.92 L 3.92,-22.92 L 5.92,-20.92 Z"
      />
      <path
        fill="rgba(32,26,22,0.88)"
        d="M -5.92,-22.92 L -3.92,-22.92 L -2,-20.92 L -1,-26.92 L -3,-28.92 L -5,-26.92 Z M 5.92,-22.92 L 3.92,-22.92 L 2,-20.92 L 1,-26.92 L 3,-28.92 L 5,-26.92 Z"
      />
      <rect x="-3.92" y="-9.92" width="7.92" height="8.92" rx="1.92" fill="rgba(26,22,18,0.88)" stroke="rgba(122,94,62,0.55)" strokeWidth="0.2" />
    </g>
  );
}

function TablePaintedSurface() {
  const wedgeIds = useMemo(
    () => Array.from({ length: ROUND_TABLE_SEAT_COUNT }, (_, i) => i),
    []
  );
  const tickAnglesDeg = useMemo(
    () =>
      Array.from({ length: ROUND_TABLE_SEAT_COUNT }, (_, i) => -90 + (i / ROUND_TABLE_SEAT_COUNT) * 360),
    []
  );

  const n = ROUND_TABLE_SEAT_COUNT;

  return (
    <svg
      className="table-winchester-paint"
      viewBox="0 0 100 100"
      aria-hidden
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <radialGradient id="winchesterTableGlow" cx="50%" cy="44%" r="58%">
          <stop offset="0%" stopColor="#f8eed2" stopOpacity="0.32" />
          <stop offset="52%" stopColor="#d9cc9e" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#1a120b" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="winchesterWoodVein" cx="40%" cy="40%" r="74%">
          <stop offset="0%" stopColor="#4e381f" stopOpacity="0.2" />
          <stop offset="48%" stopColor="#2f2012" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#120a06" stopOpacity="0.02" />
        </radialGradient>
        <linearGradient id="winchesterRimBand" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#c09924" />
          <stop offset="28%" stopColor="#f8e6a8" />
          <stop offset="52%" stopColor="#8f6a14" />
          <stop offset="76%" stopColor="#eacb7a" />
          <stop offset="100%" stopColor="#684c0c" />
        </linearGradient>
        <linearGradient id="winchesterRimInner" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#3f2c17" />
          <stop offset="100%" stopColor="#0f0804" />
        </linearGradient>
        <linearGradient id="winchesterSeatWedge-even" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#e6eed7" />
          <stop offset="46%" stopColor="#b8ca9c" />
          <stop offset="100%" stopColor="#5f8448" />
        </linearGradient>
        <linearGradient id="winchesterSeatWedge-odd" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#f8f4e6" />
          <stop offset="48%" stopColor="#e8ddc8" />
          <stop offset="100%" stopColor="#a69178" />
        </linearGradient>
        <linearGradient id="winchesterSeatWedge-sovereign" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fff3d9" />
          <stop offset="38%" stopColor="#e8cf7a" />
          <stop offset="100%" stopColor="#986a16" />
        </linearGradient>
        <linearGradient id="tudorPetalIvory" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fffaf0" />
          <stop offset="50%" stopColor="#f0e4c8" />
          <stop offset="100%" stopColor="#c8b48a" />
        </linearGradient>
        <linearGradient id="tudorPetalGarnet" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#c84a5a" />
          <stop offset="55%" stopColor="#8c2232" />
          <stop offset="100%" stopColor="#4a1018" />
        </linearGradient>
        <radialGradient id="roseHeartGlow" cx="45%" cy="38%" r="62%">
          <stop offset="0%" stopColor="#fff6e4" stopOpacity="0.95" />
          <stop offset="70%" stopColor="#d4b87a" stopOpacity="0.88" />
          <stop offset="100%" stopColor="#5c4018" stopOpacity="0.92" />
        </radialGradient>
        <radialGradient id="roseDarkBoss" cx="50%" cy="55%" r="58%">
          <stop offset="0%" stopColor="#2a1810" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#0c0604" stopOpacity="1" />
        </radialGradient>
        <filter id="winchesterGrain" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="matrix" values="0 0 0 0 0.96  0 0 0 0 0.9  0 0 0 0 0.78  0 0 0 0.06 0" />
          <feComposite in2="SourceGraphic" operator="in" />
        </filter>
      </defs>

      <circle cx="50" cy="50" r="48.75" fill="url(#winchesterWoodVein)" opacity="0.45" />

      <g role="presentation" filter="url(#winchesterGrain)">
        <circle cx="50" cy="50" r="47.2" opacity="0.1" />
      </g>

      {wedgeIds.map((seatIndex) => {
        const startAngle = ((seatIndex / n) * 360 - 90) * (Math.PI / 180);
        const endAngle = (((seatIndex + 1) / n) * 360 - 90) * (Math.PI / 180);
        const cx = 50;
        const cy = 50;
        const radius = 45.85;
        const x1 = cx + radius * Math.cos(startAngle);
        const y1 = cy + radius * Math.sin(startAngle);
        const x2 = cx + radius * Math.cos(endAngle);
        const y2 = cy + radius * Math.sin(endAngle);
        const d = `
          M ${cx} ${cy}
          L ${x1.toFixed(3)} ${y1.toFixed(3)}
          A ${radius} ${radius} 0 0 1 ${x2.toFixed(3)} ${y2.toFixed(3)}
          Z
        `;
        const fillId =
          seatIndex === 0
            ? 'url(#winchesterSeatWedge-sovereign)'
            : seatIndex % 2 === 0
              ? 'url(#winchesterSeatWedge-even)'
              : 'url(#winchesterSeatWedge-odd)';
        return (
          <path
            key={`wedge-${seatIndex}`}
            className={`table-sector-wedge seat-${seatIndex}`}
            d={d}
            fill={fillId}
          />
        );
      })}

      <SovereignKingMark n={n} />

      <circle cx="50" cy="50" r="41.35" fill="none" stroke="rgba(212,178,106,0.26)" strokeWidth="0.2" />
      <circle cx="50" cy="50" r="45.55" fill="none" stroke="rgba(245,229,171,0.32)" strokeWidth="0.95" />
      <circle cx="50" cy="50" r="47.48" fill="none" stroke="rgba(245,229,171,0.48)" strokeWidth="2.35" />

      <circle cx="50" cy="50" r="48.88" fill="none" stroke="url(#winchesterRimBand)" strokeWidth="1.75" />
      <circle cx="50" cy="50" r="46.92" fill="none" stroke="rgba(124,98,58,0.38)" strokeWidth="1.35" />

      <g aria-hidden>
        {tickAnglesDeg.map((deg, i) => {
          const rad = (deg * Math.PI) / 180;
          const rOuter = 45.88;
          const rInner = 44.78;
          const xo = 50 + rOuter * Math.cos(rad);
          const yo = 50 + rOuter * Math.sin(rad);
          const xi = 50 + rInner * Math.cos(rad);
          const yi = 50 + rInner * Math.sin(rad);
          return (
            <line
              key={`tick-${i}`}
              x1={xi}
              y1={yi}
              x2={xo}
              y2={yo}
              stroke="rgba(48,38,26,0.42)"
              strokeWidth="0.34"
              strokeLinecap="round"
            />
          );
        })}
      </g>

      <circle cx="50" cy="50" r="41.88" fill="none" stroke="url(#winchesterRimInner)" strokeWidth="1.68" />
      <circle cx="50" cy="50" r="39.92" fill="none" stroke="rgba(236,218,154,0.18)" strokeWidth="0.16" />
      <circle cx="50" cy="50" r="41.92" fill="none" stroke="rgba(236,218,154,0.14)" strokeWidth="0.1" />
      <circle cx="50" cy="50" r="41.92" fill="none" stroke="rgba(120,94,62,0.22)" strokeWidth="0.12" />

      <circle cx="50" cy="50" r="48.94" fill="none" stroke="rgba(254,246,216,0.22)" strokeWidth="0.45" />
      <circle cx="50" cy="50" r="49.06" fill="url(#winchesterTableGlow)" opacity="0.28" />

      <WinchesterCentreRose />

      <g
        aria-hidden
        className="rim-inscription-glyphs"
        style={{ pointerEvents: 'none' }}
        fontFamily="var(--font-display, Cinzel), Georgia, 'Times New Roman', serif"
        fontSize={1.92}
        fontWeight={600}
        letterSpacing={0.12}
        fill="rgba(46,38,26,0.72)"
        stroke="rgba(248,238,216,0.18)"
        strokeWidth={0.04}
      >
        {RIM_AROUND_NAMES.map((name, seatIndex) => {
          const midRad = wedgeMidAngleRadians(seatIndex, ROUND_TABLE_SEAT_COUNT);
          const rText = 44.92;
          const lx = 50 + rText * Math.cos(midRad);
          const ly = 50 + rText * Math.sin(midRad);
          const rot = rimLabelReadableRotation(lx, ly);
          return (
            <text
              key={`rim-${name}`}
              x={lx}
              y={ly}
              textAnchor="middle"
              dominantBaseline="central"
              transform={`rotate(${rot.toFixed(2)}, ${lx.toFixed(3)}, ${ly.toFixed(3)})`}
            >
              {name}
            </text>
          );
        })}
      </g>
    </svg>
  );
}

export function RoundTable({
  users,
  currentUserId,
  onReplySeatPick,
  seatSpeechBubbles,
}: RoundTableProps) {
  const seatLookup = useMemo(() => {
    const bySeat = new Map<number, User>();
    users.forEach((u) => {
      bySeat.set(u.seatIndex, u);
    });
    return bySeat;
  }, [users]);

  return (
    <div className="round-table-container table-scene-root">
      <div className="round-table table-scene-board">
        <div className="table-art-layer table-tilt-shell">
          <div className="table-edge-volume" aria-hidden />
          <div className="table-surface">
            <div className="table-surface-underlay" />
            <TablePaintedSurface />
            <div className="table-inner" />
          </div>
        </div>
        <div className="seat-overlay-layer seats-ring seats-orbit seats-orbit-flat">
          {Array.from({ length: ROUND_TABLE_SEAT_COUNT }, (_, seatIndex) => (
            <Seat
              key={seatIndex}
              seatIndex={seatIndex}
              user={seatLookup.get(seatIndex)}
              isCurrentUser={seatLookup.get(seatIndex)?.id === currentUserId}
              totalSeats={ROUND_TABLE_SEAT_COUNT}
              onReplySeatPick={onReplySeatPick}
            />
          ))}
        </div>
        <div className="seat-speech-bubble-layer seats-ring seats-orbit seats-orbit-flat">
          {Array.from({ length: ROUND_TABLE_SEAT_COUNT }, (_, seatIndex) => {
            const seated = seatLookup.get(seatIndex);
            const bubble =
              seated && seated.id in seatSpeechBubbles ? seatSpeechBubbles[seated.id] : undefined;
            if (!bubble || !seated) return null;
            return (
              <SeatMessageBubble
                key={`bubble-${seatIndex}-${bubble.sourceMessageId}`}
                seatIndex={seatIndex}
                bubble={bubble}
              />
            );
          })}
        </div>
        <div className="table-ground-shadow table-shadow-layer" aria-hidden />
      </div>
    </div>
  );
}
