import { useMemo } from 'react';
import type { ChatReplyTarget, SeatSpeechBubbleState, User } from '../types';
import { Seat } from './Seat';
import { SeatMessageBubble } from './SeatMessageBubble';
import {
  ROUND_TABLE_SEAT_COUNT,
  wedgeMidAngleRadians,
} from '../lib/tableOrbit';

export const TOTAL_SEATS = ROUND_TABLE_SEAT_COUNT;

/** Dev: `false` — только реальные юзеры; `true` — подмешиваем заглушек на пустые места + их пузыри (только когда `import.meta.env.DEV`). */
const SHOW_DEV_TABLE_FIXTURES = false;

/** Dev-only placeholders to preview a fuller table without extra browser tabs. Never override real occupants. */
const ROUND_TABLE_FIXTURE_USERS: readonly User[] = [
  {
    id: '__fixture:table:galahad',
    knightName: 'Galahad',
    seatIndex: 1,
    avatarId: 1,
    micEnabled: true,
    isSpeaking: false,
    joinedAt: 0,
    isTableFixture: true,
  },
  {
    id: '__fixture:table:lancelot',
    knightName: 'Lancelot',
    seatIndex: 2,
    avatarId: 3,
    micEnabled: true,
    isSpeaking: true,
    joinedAt: 0,
    isTableFixture: true,
  },
  {
    id: '__fixture:table:percival',
    knightName: 'Percival',
    seatIndex: 3,
    avatarId: 5,
    micEnabled: false,
    isSpeaking: false,
    joinedAt: 0,
    isTableFixture: true,
  },
  {
    id: '__fixture:table:bors',
    knightName: 'Bors',
    seatIndex: 4,
    avatarId: 7,
    micEnabled: true,
    isSpeaking: false,
    joinedAt: 0,
    isTableFixture: true,
  },
  {
    id: '__fixture:table:lamorak',
    knightName: 'Lamorak',
    seatIndex: 5,
    avatarId: 9,
    micEnabled: false,
    isSpeaking: false,
    joinedAt: 0,
    isTableFixture: true,
  },
  {
    id: '__fixture:table:pellyr',
    knightName: 'Pellyr',
    seatIndex: 6,
    avatarId: 11,
    micEnabled: false,
    isSpeaking: false,
    joinedAt: 0,
    isTableFixture: true,
  },
  {
    id: '__fixture:table:gerawnt',
    knightName: 'Gerawnt',
    seatIndex: 7,
    avatarId: 13,
    micEnabled: false,
    isSpeaking: false,
    joinedAt: 0,
    isTableFixture: true,
  },
  {
    id: '__fixture:table:bedivyr',
    knightName: 'Bedivyr',
    seatIndex: 8,
    avatarId: 15,
    micEnabled: false,
    isSpeaking: false,
    joinedAt: 0,
    isTableFixture: true,
  },
  {
    id: '__fixture:table:trysta',
    knightName: 'Trysta',
    seatIndex: 9,
    avatarId: 17,
    micEnabled: false,
    isSpeaking: false,
    joinedAt: 0,
    isTableFixture: true,
  },
  {
    id: '__fixture:table:kay',
    knightName: 'Kay',
    seatIndex: 10,
    avatarId: 19,
    micEnabled: false,
    isSpeaking: false,
    joinedAt: 0,
    isTableFixture: true,
  },
  {
    id: '__fixture:table:lyonyll',
    knightName: 'Lyonyll',
    seatIndex: 11,
    avatarId: 21,
    micEnabled: false,
    isSpeaking: false,
    joinedAt: 0,
    isTableFixture: true,
  },
  {
    id: '__fixture:table:lamaor',
    knightName: 'Lamaor',
    seatIndex: 12,
    avatarId: 23,
    micEnabled: false,
    isSpeaking: false,
    joinedAt: 0,
    isTableFixture: true,
  },
];

const FIXTURE_TABLE_SPEECH_BY_USER_ID: Readonly<
  Record<string, SeatSpeechBubbleState>
> = {
  '__fixture:table:galahad': {
    sourceMessageId: '__fixture:table:galahad:bubble',
    text: 'The Grail quests — we ride at dawn?',
  },
  '__fixture:table:lancelot': {
    sourceMessageId: '__fixture:table:lancelot:bubble',
    replyToKnightName: 'Galahad',
    text: 'Aye — if Camelot wills it.',
  },
  '__fixture:table:percival': {
    sourceMessageId: '__fixture:table:percival:bubble',
    text: '…I will guard the ford.',
  },
  '__fixture:table:bors': {
    sourceMessageId: '__fixture:table:bors:bubble',
    text: 'Wine first, swords second.',
  },
  '__fixture:table:lamorak': {
    sourceMessageId: '__fixture:table:lamorak:bubble',
    text: 'Quiet. Something stirs in the wood.',
  },
  '__fixture:table:pellyr': {
    sourceMessageId: '__fixture:table:pellyr:bubble',
    text: 'I will guard the ford.',
  },
  '__fixture:table:gerawnt': {
    sourceMessageId: '__fixture:table:gerawnt:bubble',
    text: 'I will guard the ford.',
  },
  '__fixture:table:bedivyr': {
    sourceMessageId: '__fixture:table:bedivyr:bubble',
    text: 'I will guard the ford.',
  },
  '__fixture:table:trysta': {
    sourceMessageId: '__fixture:table:trysta:bubble',
    text: 'I will guard the ford.',
  },
  '__fixture:table:kay': {
    sourceMessageId: '__fixture:table:kay:bubble',
    text: 'I will guard the ford.',
  },
  '__fixture:table:lyonyll': {
    sourceMessageId: '__fixture:table:lyonyll:bubble',
    text: 'I will guard the ford.',
  },
  '__fixture:table:lamaor': {
    sourceMessageId: '__fixture:table:lamaor:bubble',
    text: 'I will guard the ford.',
  }
};

function mergedUsersForDisplay(users: User[]): User[] {
  if (!import.meta.env.DEV || !SHOW_DEV_TABLE_FIXTURES) return users;

  const bySeat = new Map<number, User>();
  users.forEach((u) => {
    bySeat.set(u.seatIndex, u);
  });

  ROUND_TABLE_FIXTURE_USERS.forEach((fixture) => {
    if (!bySeat.has(fixture.seatIndex)) {
      bySeat.set(fixture.seatIndex, fixture);
    }
  });

  return users.length === bySeat.size
    ? users
    : Array.from(bySeat.values()).sort((a, b) => a.seatIndex - b.seatIndex);
}

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
const VISUAL_TABLE_SECTOR_COUNT = ROUND_TABLE_SEAT_COUNT;

const RIM_AROUND_NAMES = [
  'Sir Alynore',
  'Sir Bedwere',
  'Sir Blubrys',
  'Sir Bors ',
  'Sir Brumear',
  'Sir Dagonet',
  'Sir Degore',
  'Sir Ectorde',
  'Sir Galahallt',
  'Sir Garethe',
  'Sir Gauen',
  'Sir Kay',
  'Sir Lamorak',
  'Sir Launcelot',
  'Sir Lacotemale',
  'Sir Lucane',
  'Sir Lybyus',
  'Sir Lyonell',
  'Sir Mordrede',
  'Sir Plomyde',
  'Sir Pelleus',
  'Sir Percyvale',
  'Sir Safer',
  'Sir Trystram',
] as const;

const RIM_INNER_NAMES = [
    '୨',
    'This',
    'is',
    'the',
    'row',
    'nde',
    'tab',
    'le',
    'of',
    'kyng',
    'Ar',
    'thur',
    'w',
    'xx',
    'ii',
    'ii',
    'of',
    'his',
    'nam',
    'yde',
    'kny',
    'at',
    'tes',
    '୧',
  ] as const;
/** Внешнее пергаментное кольцо с именами у обода */
const OUTER_NAME_BAND = { inner: 12.7, outer: 16.95, textR: 43.75 } as const;

/** Пергаментное кольцо сразу вокруг розы (за окружностью ~11.85), не середина клиньев */
const INNER_NAME_BAND = { inner: 14.06, outer: 9.35 } as const;

const INNER_NAME_TEXT_R =
  (INNER_NAME_BAND.inner + INNER_NAME_BAND.outer) / 2;

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
  return rot;
}

function RimCurvedSeatLabel({
  seatIndex,
  text,
  textRadius,
  pathId,
  arcHeight = 3.63,
  fontSize = 4,
  arcCharsPerUnit = 1.65,
  /** <1 сжимает глифы по горизонтали в локальной системе после поворота */
  glyphCompressX = 1,
  /** false — весь текст одним цветом (без красной инициали) */
  accentFirstLetter = true,
}: {
  seatIndex: number;
  text: string;
  textRadius: number;
  pathId: string;
  arcHeight?: number;
  fontSize?: number;
  /** горизонтальный масштаб дуги textPath; на малом радиусе меньше, чтобы не наезжать на соседние сектора */
  arcCharsPerUnit?: number;
  glyphCompressX?: number;
  accentFirstLetter?: boolean;
}) {
  const midRad = wedgeMidAngleRadians(seatIndex, ROUND_TABLE_SEAT_COUNT);
  const lx = 50 + textRadius * Math.cos(midRad);
  const ly = 50 + textRadius * Math.sin(midRad);
  const rot = rimLabelReadableRotation(lx, ly);
  const arcWidth = Math.max(7.5, String(text).length * arcCharsPerUnit);
  const sx = Math.min(1, Math.max(0.55, glyphCompressX));

  return (
    <g
      transform={`translate(${lx.toFixed(3)} ${ly.toFixed(3)}) rotate(${rot.toFixed(2)}) scale(${sx.toFixed(3)} 1)`}
    >
      <defs>
        <path
          id={pathId}
          d={`
              M ${(-arcWidth / 2).toFixed(3)} 0
              Q 0 ${(-arcHeight).toFixed(3)}
              ${(arcWidth / 2).toFixed(3)} 0
            `}
        />
      </defs>
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="var(--font-cloister-black)"
        fontSize={fontSize}
        fontWeight={700}
        letterSpacing={-0.26}
        fill="rgba(47, 32, 18, 0.8)"
        stroke="rgba(255, 246, 218, 0.22)"
        strokeWidth={0.035}
      >
        <textPath href={`#${pathId}`} startOffset="55%" textAnchor="middle">
          {text.length > 0 ? (
            accentFirstLetter ? (
              <>
                <tspan fill="var(--accent-red)">{text[0]}</tspan>
                <tspan>{text.slice(1)}</tspan>
              </>
            ) : (
              <tspan>{text}</tspan>
            )
          ) : null}
        </textPath>
      </text>
    </g>
  );
}

function WinchesterCentreRose() {
  const outerPetals = useMemo(
    () =>
      Array.from({ length: 8 }, (_, k) => (
        <ellipse
          key={`rose-outer-${k}`}
          cx="0"
          cy="-5.2"
          rx="2.3"
          ry="4.8"
          fill="url(#rosePetalRed)"
          stroke="rgba(36, 10, 12, 0.95)"
          strokeWidth="0.2"
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
          cy="-3.8"
          rx="1.6"
          ry="3.5"
          fill="url(#rosePetalIvory)"
          stroke="rgba(55, 35, 25, 0.9)"
          strokeWidth="0.18"
          transform={`rotate(${22.5 + k * 45})`}
        />
      )),
    []
  );

  return (
    <g aria-hidden transform="translate(50 50)">
      <circle cx="0" cy="0" r="10.35" fill="url(#centreRedRing)" />
      <circle cx="0" cy="0" r="7.95" fill="rgba(33, 18, 11, 0.52)" />

      {outerPetals}
      {innerPetals}

      <circle cx="0" cy="0" r="3.95" fill="url(#roseHeartGold)" />
      <circle cx="0" cy="0" r="2.45" fill="#673218" />
      <circle cx="0" cy="0" r="1.1" fill="#532104" />
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
          <stop offset="0%" stopColor="#D8B9A4" stopOpacity="0.9" />
          <stop offset="45%" stopColor="#D8B9A4" stopOpacity="0.96" />
          <stop offset="100%" stopColor="#D8B9A4" stopOpacity="1" />
        </radialGradient>

        <radialGradient id="tableAgedGlow" cx="48%" cy="40%" r="62%">
          <stop offset="0%" stopColor="#fff4d7" stopOpacity="0.24" />
          <stop offset="48%" stopColor="#d7b36a" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </radialGradient>

        <linearGradient id="sectorGreen" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#18220B" />
          <stop offset="33%" stopColor="#334131" />
          <stop offset="68%" stopColor="#242E22" />
          <stop offset="100%" stopColor="#18220B" />
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
          <stop offset="100%" stopColor="#9b7b50" />
        </linearGradient>

        <radialGradient id="centreRedRing" cx="45%" cy="38%" r="65%">
          <stop offset="0%" stopColor="#2D3E32" />
          <stop offset="42%" stopColor="#2D3E32" />
          <stop offset="100%" stopColor="#2a0905" />
        </radialGradient>

        <linearGradient id="rosePetalIvory" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#A38770" />
          <stop offset="55%" stopColor="#DDC6B2" />
          <stop offset="100%" stopColor="#D2BCA3" />
        </linearGradient>

        <linearGradient id="rosePetalRed" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#5A0E00" />
          <stop offset="55%" stopColor="#992500" />
          <stop offset="100%" stopColor="#992500" />
        </linearGradient>

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
              1 0 0.9 0 0.95
              0 0 0.9 0 0.86
              1 1.9 0.9 0 0.68
              0.003 0.09 0 0.065 0
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
      <circle cx="50" cy="50" r="47.65" fill="none" stroke="rgba(35, 21, 10, 0.58)" strokeWidth="0.5" />

      <circle cx="50" cy="50" r="45.9" fill="none" stroke="url(#outerParchmentBand)" strokeWidth="3.15" />
      <circle cx="50" cy="50" r="45.9" fill="none" stroke="rgba(73, 43, 20, 0.48)" strokeWidth="0.32" />

      {/* кольцо с 24 подписями */}
      {seatIds.map((seatIndex) => {
        const startRad = ((seatIndex / ROUND_TABLE_SEAT_COUNT) * 360 - 90) * (Math.PI / 180);
        const endRad = (((seatIndex + 1) / ROUND_TABLE_SEAT_COUNT) * 360 - 90) * (Math.PI / 180);

        return (
          <path
            key={`name-cell-${seatIndex}`}
            d={ringSectorPath(
              50,
              50,
              OUTER_NAME_BAND.inner,
              OUTER_NAME_BAND.outer,
              startRad,
              endRad
            )}
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
              stroke="#A12301"
              strokeWidth="0.26"
            />
          );
        })}
      </g>

      {/* грязь/старение поверх покраски */}
      <circle
        cx="50"
        cy="50"
        r="41.75"
        fill="#B08B75"
        filter="url(#agedPaintNoise)"
      />

      {/* пергамент у центра — обводка розы (те же 13 имён, что у обода) */}
      {seatIds.map((seatIndex) => {
        const startRad =
          ((seatIndex / ROUND_TABLE_SEAT_COUNT) * 360 - 90) * (Math.PI / 180);
        const endRad =
          (((seatIndex + 1) / ROUND_TABLE_SEAT_COUNT) * 360 - 90) *
          (Math.PI / 180);

        return (
          <path
            key={`inner-name-cell-${seatIndex}`}
            d={ringSectorPath(
              50,
              50,
              INNER_NAME_BAND.inner,
              INNER_NAME_BAND.outer,
              startRad,
              endRad
            )}
            fill="rgba(237, 214, 170, 0.42)"
            stroke="rgba(64, 39, 18, 0.48)"
            strokeWidth="0.16"
          />
        );
      })}

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
      <circle cx="50" cy="50" r="11.85" fill="none" stroke="rgba(241, 211, 136, 0.48)" strokeWidth="0.45" />

      {/* центр без короля */}
      <WinchesterCentreRose />

      {/* подписи по кругу розы */}
      <g
        aria-hidden
        className="rim-inscription-glyphs rim-inscription-glyphs-inner"
        style={{ pointerEvents: 'none' }}
        fontFamily="var(--font-cloister-black)"
        fontSize={1.68}
        fontWeight={700}
        letterSpacing={0.02}
        fill="rgba(47, 32, 18, 0.8)"
        stroke="rgba(255, 246, 218, 0.22)"
        strokeWidth={0.035}
      >
        {RIM_INNER_NAMES.map((name, seatIndex) => (
          <RimCurvedSeatLabel
            key={`rim-inner-${seatIndex}-${name}`}
            seatIndex={seatIndex}
            text={name}
            textRadius={INNER_NAME_TEXT_R}
            pathId={`rim-inner-name-arc-${seatIndex}`}
            arcHeight={2.45}
            arcCharsPerUnit={0.36}
            glyphCompressX={0.7}
            accentFirstLetter={name === '୧' || name === '୨'}
          />
        ))}
      </g>

      {/* подписи на внешнем кольце */}
      <g
        aria-hidden
        className="rim-inscription-glyphs"
        style={{ pointerEvents: 'none' }}
        fontFamily="var(--font-cloister-black)"
        fontSize={1.68}
        fontWeight={700}
        letterSpacing={0.02}
        fill="rgba(47, 32, 18, 0.8)"
        stroke="rgba(255, 246, 218, 0.22)"
        strokeWidth={0.035}
      >
        {RIM_AROUND_NAMES.map((name, seatIndex) => (
          <RimCurvedSeatLabel
            key={`rim-outer-${seatIndex}-${name}`}
            seatIndex={seatIndex}
            text={name}
            textRadius={OUTER_NAME_BAND.textR}
            pathId={`rim-name-arc-${seatIndex}`}
            arcCharsPerUnit={2}
            glyphCompressX={0.67}
          />
        ))}
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
  const displayUsers = useMemo(() => mergedUsersForDisplay(users), [users]);

  const seatLookup = useMemo(() => {
    const bySeat = new Map<number, User>();

    displayUsers.forEach((u) => {
      bySeat.set(u.seatIndex, u);
    });

    return bySeat;
  }, [displayUsers]);

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
            let bubble =
              seated && seated.id in seatSpeechBubbles
                ? seatSpeechBubbles[seated.id]
                : undefined;

            if (
              bubble === undefined &&
              import.meta.env.DEV &&
              SHOW_DEV_TABLE_FIXTURES &&
              seated?.isTableFixture
            ) {
              bubble = FIXTURE_TABLE_SPEECH_BY_USER_ID[seated.id];
            }

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