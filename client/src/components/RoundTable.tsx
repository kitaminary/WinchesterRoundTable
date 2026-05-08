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

/**
 * Реальный функционал остаётся на 13 местах.
 * Визуальная столешница рисуется 26 секторами:
 * 13 зелёных + 13 белых.
 */
const VISUAL_TABLE_SECTOR_COUNT = ROUND_TABLE_SEAT_COUNT * 2;

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

function polarPoint(cx: number, cy: number, r: number, angleRad: number) {
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy + r * Math.sin(angleRad),
  };
}

function ringSectorPath(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startRad: number,
  endRad: number
): string {
  const outerStart = polarPoint(cx, cy, outerR, startRad);
  const outerEnd = polarPoint(cx, cy, outerR, endRad);
  const innerEnd = polarPoint(cx, cy, innerR, endRad);
  const innerStart = polarPoint(cx, cy, innerR, startRad);

  const largeArc = endRad - startRad > Math.PI ? 1 : 0;

  return [
    `M ${outerStart.x.toFixed(3)} ${outerStart.y.toFixed(3)}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${outerEnd.x.toFixed(3)} ${outerEnd.y.toFixed(3)}`,
    `L ${innerEnd.x.toFixed(3)} ${innerEnd.y.toFixed(3)}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerStart.x.toFixed(3)} ${innerStart.y.toFixed(3)}`,
    'Z',
  ].join(' ');
}

function rimLabelReadableRotation(lx: number, ly: number): number {
  const bearingDeg = (Math.atan2(ly - 50, lx - 50) * 180) / Math.PI;
  let rot = bearingDeg + 90;

  // Нижнюю половину переворачиваем, чтобы текст не был вверх ногами.
  if (ly > 50) rot += 180;

  return rot;
}

function WinchesterCentreRose() {
  const outerPetals = useMemo(
    () =>
      Array.from({ length: 8 }, (_, k) => (
        <ellipse
          key={`rose-outer-${k}`}
          cx="0"
          cy="-6.7"
          rx="3.2"
          ry="6.9"
          fill="url(#rosePetalIvory)"
          stroke="rgba(55, 35, 25, 0.45)"
          strokeWidth="0.22"
          transform={`rotate(${k * 45})`}
        />
      )),
    []
  );

  const innerPetals = useMemo(
    () =>
      Array.from({ length: 8 }, (_, k) => (
        <ellipse
          key={`rose-inner-${k}`}
          cx="0"
          cy="-4.8"
          rx="2.25"
          ry="4.8"
          fill="url(#rosePetalRed)"
          stroke="rgba(36, 10, 12, 0.58)"
          strokeWidth="0.2"
          transform={`rotate(${22.5 + k * 45})`}
        />
      )),
    []
  );

  return (
    <g aria-hidden transform="translate(50 50)">
      <circle cx="0" cy="0" r="10.35" fill="url(#centreRedRing)" />
      <circle cx="0" cy="0" r="9.15" fill="none" stroke="rgba(248, 222, 148, 0.55)" strokeWidth="0.38" />
      <circle cx="0" cy="0" r="7.95" fill="rgba(33, 18, 11, 0.52)" />

      {outerPetals}
      {innerPetals}

      <circle cx="0" cy="0" r="3.95" fill="url(#roseHeartGold)" />
      <circle cx="0" cy="0" r="2.45" fill="rgba(34, 19, 12, 0.92)" />
      <circle cx="0" cy="0" r="1.1" fill="rgba(246, 226, 164, 0.9)" />
    </g>
  );
}

function TablePaintedSurface() {
  const visualSectorIds = useMemo(
    () => Array.from({ length: VISUAL_TABLE_SECTOR_COUNT }, (_, i) => i),
    []
  );

  const seatIds = useMemo(
    () => Array.from({ length: ROUND_TABLE_SEAT_COUNT }, (_, i) => i),
    []
  );

  const dividerAnglesDeg = useMemo(
    () =>
      Array.from(
        { length: VISUAL_TABLE_SECTOR_COUNT },
        (_, i) => -90 + (i / VISUAL_TABLE_SECTOR_COUNT) * 360
      ),
    []
  );

  return (
    <svg
      className="table-winchester-paint"
      viewBox="0 0 100 100"
      aria-hidden
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <radialGradient id="tableBaseWood" cx="50%" cy="45%" r="58%">
          <stop offset="0%" stopColor="#8b5b34" stopOpacity="0.9" />
          <stop offset="45%" stopColor="#4a2916" stopOpacity="0.96" />
          <stop offset="100%" stopColor="#170a04" stopOpacity="1" />
        </radialGradient>

        <radialGradient id="tableAgedGlow" cx="48%" cy="40%" r="62%">
          <stop offset="0%" stopColor="#fff4d7" stopOpacity="0.24" />
          <stop offset="48%" stopColor="#d7b36a" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </radialGradient>

        <linearGradient id="sectorGreen" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#e7efdc" />
          <stop offset="33%" stopColor="#b7c89b" />
          <stop offset="68%" stopColor="#617e4d" />
          <stop offset="100%" stopColor="#24432f" />
        </linearGradient>

        <linearGradient id="sectorIvory" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fff8e7" />
          <stop offset="42%" stopColor="#e7d9c1" />
          <stop offset="76%" stopColor="#b9a489" />
          <stop offset="100%" stopColor="#715d48" />
        </linearGradient>

        <linearGradient id="outerGoldBand" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#744c18" />
          <stop offset="22%" stopColor="#f3d184" />
          <stop offset="45%" stopColor="#8f641f" />
          <stop offset="68%" stopColor="#fff0bd" />
          <stop offset="100%" stopColor="#5b3910" />
        </linearGradient>

        <linearGradient id="outerParchmentBand" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#d8c095" />
          <stop offset="45%" stopColor="#f1dfb8" />
          <stop offset="100%" stopColor="#9b7b50" />
        </linearGradient>

        <radialGradient id="centreRedRing" cx="45%" cy="38%" r="65%">
          <stop offset="0%" stopColor="#d6753d" />
          <stop offset="42%" stopColor="#8f2c18" />
          <stop offset="100%" stopColor="#2a0905" />
        </radialGradient>

        <linearGradient id="rosePetalIvory" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fffaf0" />
          <stop offset="55%" stopColor="#eadcc0" />
          <stop offset="100%" stopColor="#b99b73" />
        </linearGradient>

        <linearGradient id="rosePetalRed" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#d65257" />
          <stop offset="55%" stopColor="#84202a" />
          <stop offset="100%" stopColor="#3d0d13" />
        </linearGradient>

        <radialGradient id="roseHeartGold" cx="45%" cy="38%" r="62%">
          <stop offset="0%" stopColor="#fff4c4" />
          <stop offset="70%" stopColor="#c79b3e" />
          <stop offset="100%" stopColor="#5a3510" />
        </radialGradient>

        <filter id="agedPaintNoise" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.72"
            numOctaves="2"
            stitchTiles="stitch"
          />
          <feColorMatrix
            type="matrix"
            values="
              0 0 0 0 0.95
              0 0 0 0 0.86
              0 0 0 0 0.68
              0 0 0 0.065 0
            "
          />
          <feComposite in2="SourceGraphic" operator="in" />
        </filter>

        <filter id="softInnerShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0.7" stdDeviation="0.65" floodColor="#130703" floodOpacity="0.55" />
        </filter>
      </defs>

      {/* деревянная база */}
      <circle cx="50" cy="50" r="49.2" fill="url(#tableBaseWood)" />
      <circle cx="50" cy="50" r="49.2" fill="url(#tableAgedGlow)" />

      {/* внешний толстый обод как на референсе */}
      <circle cx="50" cy="50" r="49.05" fill="none" stroke="url(#outerGoldBand)" strokeWidth="1.7" />
      <circle cx="50" cy="50" r="47.65" fill="none" stroke="rgba(35, 21, 10, 0.58)" strokeWidth="0.5" />

      <circle cx="50" cy="50" r="45.9" fill="none" stroke="url(#outerParchmentBand)" strokeWidth="3.15" />
      <circle cx="50" cy="50" r="45.9" fill="none" stroke="rgba(73, 43, 20, 0.48)" strokeWidth="0.32" />

      {/* кольцо с 13 подписями */}
      {seatIds.map((seatIndex) => {
        const startRad = ((seatIndex / ROUND_TABLE_SEAT_COUNT) * 360 - 90) * (Math.PI / 180);
        const endRad = (((seatIndex + 1) / ROUND_TABLE_SEAT_COUNT) * 360 - 90) * (Math.PI / 180);

        return (
          <path
            key={`name-cell-${seatIndex}`}
            d={ringSectorPath(50, 50, 42.7, 46.95, startRad, endRad)}
            fill="rgba(237, 214, 170, 0.42)"
            stroke="rgba(64, 39, 18, 0.48)"
            strokeWidth="0.16"
          />
        );
      })}

      {/* 26 клиньев: 13 зелёных + 13 белых */}
      <g filter="url(#softInnerShadow)">
        {visualSectorIds.map((sectorIndex) => {
          const startRad = ((sectorIndex / VISUAL_TABLE_SECTOR_COUNT) * 360 - 90) * (Math.PI / 180);
          const endRad = (((sectorIndex + 1) / VISUAL_TABLE_SECTOR_COUNT) * 360 - 90) * (Math.PI / 180);

          const isGreen = sectorIndex % 2 === 0;

          return (
            <path
              key={`visual-sector-${sectorIndex}`}
              className={`table-sector-wedge visual-sector-${sectorIndex}`}
              d={ringSectorPath(50, 50, 12.65, 41.75, startRad, endRad)}
              fill={isGreen ? 'url(#sectorGreen)' : 'url(#sectorIvory)'}
              stroke="rgba(49, 32, 20, 0.34)"
              strokeWidth="0.16"
            />
          );
        })}
      </g>

      {/* грязь/старение поверх покраски */}
      <circle
        cx="50"
        cy="50"
        r="41.75"
        fill="rgba(255, 244, 206, 0.12)"
        filter="url(#agedPaintNoise)"
      />

      {/* радиальные разделители 26 секций */}
      <g aria-hidden>
        {dividerAnglesDeg.map((deg, i) => {
          const rad = (deg * Math.PI) / 180;
          const inner = polarPoint(50, 50, 12.55, rad);
          const outer = polarPoint(50, 50, 41.9, rad);

          return (
            <line
              key={`visual-divider-${i}`}
              x1={inner.x.toFixed(3)}
              y1={inner.y.toFixed(3)}
              x2={outer.x.toFixed(3)}
              y2={outer.y.toFixed(3)}
              stroke="rgba(49, 32, 20, 0.46)"
              strokeWidth="0.2"
              strokeLinecap="round"
            />
          );
        })}
      </g>

      {/* внутренние и внешние окружности */}
      <circle cx="50" cy="50" r="41.85" fill="none" stroke="rgba(34, 20, 10, 0.62)" strokeWidth="0.8" />
      <circle cx="50" cy="50" r="42.65" fill="none" stroke="rgba(246, 226, 174, 0.32)" strokeWidth="0.28" />

      <circle cx="50" cy="50" r="12.95" fill="none" stroke="rgba(38, 20, 10, 0.72)" strokeWidth="1.05" />
      <circle cx="50" cy="50" r="11.85" fill="none" stroke="rgba(241, 211, 136, 0.48)" strokeWidth="0.45" />

      {/* центр без короля */}
      <WinchesterCentreRose />

      {/* подписи на внешнем кольце */}
      <g
        aria-hidden
        className="rim-inscription-glyphs"
        style={{ pointerEvents: 'none' }}
        fontFamily="var(--font-display, Cinzel), Georgia, 'Times New Roman', serif"
        fontSize={1.68}
        fontWeight={700}
        letterSpacing={0.1}
        fill="rgba(47, 32, 18, 0.8)"
        stroke="rgba(255, 246, 218, 0.22)"
        strokeWidth={0.035}
      >
        {RIM_AROUND_NAMES.map((name, seatIndex) => {
          const midRad = wedgeMidAngleRadians(seatIndex, ROUND_TABLE_SEAT_COUNT);
          const rText = 44.95;
          const lx = 50 + rText * Math.cos(midRad);
          const ly = 50 + rText * Math.sin(midRad);
          const rot = rimLabelReadableRotation(lx, ly);

          return (
            <text
              key={`rim-name-${name}`}
              x={lx.toFixed(3)}
              y={ly.toFixed(3)}
              textAnchor="middle"
              dominantBaseline="central"
              transform={`rotate(${rot.toFixed(2)}, ${lx.toFixed(3)}, ${ly.toFixed(3)})`}
            >
              {name}
            </text>
          );
        })}
      </g>

      {/* тонкие декоративные насечки по ободу */}
      <g aria-hidden>
        {dividerAnglesDeg.map((deg, i) => {
          const rad = (deg * Math.PI) / 180;
          const inner = polarPoint(50, 50, 46.08, rad);
          const outer = polarPoint(50, 50, 48.2, rad);

          return (
            <line
              key={`rim-tick-${i}`}
              x1={inner.x.toFixed(3)}
              y1={inner.y.toFixed(3)}
              x2={outer.x.toFixed(3)}
              y2={outer.y.toFixed(3)}
              stroke="rgba(48, 31, 15, 0.52)"
              strokeWidth="0.22"
              strokeLinecap="round"
            />
          );
        })}
      </g>

      <circle cx="50" cy="50" r="49.25" fill="none" stroke="rgba(255, 245, 210, 0.26)" strokeWidth="0.42" />
      <circle cx="50" cy="50" r="47.9" fill="none" stroke="rgba(23, 11, 5, 0.5)" strokeWidth="0.32" />
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
        <div className="table-ground-shadow table-shadow-layer" aria-hidden />

        <div className="table-art-layer table-tilt-shell">
          <div className="table-edge-volume" aria-hidden />

          <div className="table-surface">
            <div className="table-surface-underlay" />
            <TablePaintedSurface />
            <div className="table-inner" />
          </div>
        </div>

        <div className="seat-overlay-layer seats-ring seats-orbit seats-orbit-flat">
          {Array.from({ length: ROUND_TABLE_SEAT_COUNT }, (_, seatIndex) => {
            const seated = seatLookup.get(seatIndex);

            return (
              <Seat
                key={seatIndex}
                seatIndex={seatIndex}
                user={seated}
                isCurrentUser={seated?.id === currentUserId}
                totalSeats={ROUND_TABLE_SEAT_COUNT}
                onReplySeatPick={onReplySeatPick}
              />
            );
          })}
        </div>

        <div className="seat-speech-bubble-layer seats-ring seats-orbit seats-orbit-flat">
          {Array.from({ length: ROUND_TABLE_SEAT_COUNT }, (_, seatIndex) => {
            const seated = seatLookup.get(seatIndex);
            const bubble =
              seated && seated.id in seatSpeechBubbles
                ? seatSpeechBubbles[seated.id]
                : undefined;

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
      </div>
    </div>
  );
}