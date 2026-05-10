import { useRef, useEffect, useMemo } from 'react';
import { Users, Mic, MicOff } from 'lucide-react';
import type { User } from '../types';
import { KnightAvatar } from './KnightAvatar';

const SEAT_COUNT = 24;

const TEST_USERS_ENABLED = false;
/** Synthetic roster entries for layout / UX testing; IDs are never real socket user ids. */
const TEST_KNIGHT_ID_PREFIX = '__roster_test_';

const DEMO_KNIGHT_NAMES: string[] = [
  'Sir Demo-a-lot',
  'Dame Placeholder',
  'Sir Mockingham',
  'Lady Emptyseat',
  'Sir Stubling',
  'Dame Fillwright',
  'Sir Preview',
  'Lady Scrolltest',
  'Sir Stubborn',
  'Dame Canvas',
  'Sir Layout',
  'Lady Phantasm fe fe fe fef e fef efsm fe fe fe fef e fef efsm fe fe fe fef e fef efsm fe fe fe fef e fef efsm fe fe fe fef e fef efsm fe fe fe fef e fef efsm fe fe fe fef e fef ef ',
  'Sir Wireframe',
];

function isPlaceholderKnight(id: string): boolean {
  return id.startsWith(TEST_KNIGHT_ID_PREFIX);
}

function placeholderKnightsForFreeSeats(users: User[]): User[] {
  const taken = new Set(users.map((u) => u.seatIndex));
  const out: User[] = [];
  for (let seat = 0; seat < SEAT_COUNT; seat++) {
    if (taken.has(seat)) continue;
    out.push({
      id: `${TEST_KNIGHT_ID_PREFIX}${seat}`,
      knightName: DEMO_KNIGHT_NAMES[seat] ?? `Seat ${seat + 1} (demo)`,
      seatIndex: seat,
      avatarId: seat % 13,
      micEnabled: false,
      isSpeaking: false,
      joinedAt: 0,
    });
  }
  return out;
}

interface KnightRosterProps {
  users: User[];
  currentUserId: string;
}

export function KnightRoster({ users, currentUserId }: KnightRosterProps) {
  const displayUsers = useMemo(() => {
    if (!TEST_USERS_ENABLED) return users;
    const extras = placeholderKnightsForFreeSeats(users);
    return [...users, ...extras].sort((a, b) => a.seatIndex - b.seatIndex);
  }, [users, TEST_USERS_ENABLED]);

  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Auto-scroll to speaking/active user within the roster-list container
  useEffect(() => {
    const speakingUser = displayUsers.find((u) => u.isSpeaking);
    if (!speakingUser) return;

    const container = listRef.current;
    const item = itemRefs.current.get(speakingUser.id);
    if (!container || !item) return;

    // Smooth scroll the item into view within the container
    const containerTop = container.scrollTop;
    const containerBottom = containerTop + container.clientHeight;
    const itemTop = item.offsetTop;
    const itemBottom = itemTop + item.offsetHeight;

    if (itemTop < containerTop || itemBottom > containerBottom) {
      container.scrollTo({
        top: itemTop - container.clientHeight / 2 + item.offsetHeight / 2,
        behavior: 'smooth',
      });
    }
  }, [displayUsers]);

  const rosterCountLabel =
    TEST_USERS_ENABLED && displayUsers.length !== users.length
      ? `${users.length} live · ${displayUsers.length} shown`
      : `${displayUsers.length}/${SEAT_COUNT}`;

  return (
    <div className="knight-roster">
      <div className="roster-header">
        <Users className="roster-icon" />
        <span>Knights Present</span>
        <div className="roster-header-actions">
          <span className="roster-count">{rosterCountLabel}</span>
        </div>
      </div>

      <div className="roster-list" ref={listRef}>
        {displayUsers.map((user) => {
          const isDemo = isPlaceholderKnight(user.id);
          return (
            <div
              key={user.id}
              ref={(el) => {
                if (el) itemRefs.current.set(user.id, el);
                else itemRefs.current.delete(user.id);
              }}
              className={[
                'roster-item',
                isDemo ? 'test-knight' : '',
                user.id === currentUserId ? 'current' : '',
                user.isSpeaking ? 'speaking' : '',
                user.micEnabled ? 'mic-active' : '',
              ].filter(Boolean).join(' ')}
              title={
                isDemo
                  ? `Seat ${user.seatIndex + 1} (placeholder)`
                  : `Seat ${user.seatIndex + 1}`
              }
            >
              <div className="roster-avatar">
                <KnightAvatar avatarId={user.avatarId} size="small" />
                {user.isSpeaking && <div className="roster-speaking-dot" />}
              </div>
              <div className="roster-info">
                <span className="roster-name">
                  {user.knightName}
                  {isDemo && <span className="roster-demo-tag"> (demo)</span>}
                  {user.id === currentUserId && <span className="roster-you"> (You)</span>}
                </span>
              </div>
              <div className={`roster-mic ${user.micEnabled ? 'active' : ''}`} aria-hidden>
                {user.micEnabled ? (
                  <Mic className="roster-mic-icon" />
                ) : (
                  <MicOff className="roster-mic-icon" />
                )}
              </div>
            </div>
          );
        })}

        {displayUsers.length === 0 && (
          <div className="roster-empty">
            <p>No knights have arrived yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
