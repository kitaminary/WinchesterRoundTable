import { knightPortraitPath } from '../lib/knightAssets';

interface KnightAvatarProps {
  avatarId: number;
  isEmpty?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export function KnightAvatar({ avatarId, isEmpty = false, size = 'medium' }: KnightAvatarProps) {
  if (isEmpty) {
    return (
      <svg viewBox="0 0 100 100" className={`knight-avatar knight-avatar-empty ${size}`} aria-hidden>
        <defs>
          <linearGradient id="emptyShield" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#4a4540" />
            <stop offset="100%" stopColor="#282420" />
          </linearGradient>
        </defs>
        <ellipse cx="50" cy="90" rx="22" ry="7" fill="rgba(0,0,0,0.22)" />
        <path
          d="M50 12 L82 26 L82 56 Q82 76 50 91 Q18 76 18 56 L18 26 Z"
          fill="url(#emptyShield)"
          stroke="#5c564d"
          strokeWidth="2"
        />
      </svg>
    );
  }

  const safeId = Number.isFinite(avatarId)
    ? Math.min(12, Math.max(0, Math.floor(avatarId)))
    : 0;
  const src = knightPortraitPath(safeId);

  return (
    <div className={`knight-portrait-frame ${size}`}>
      <img
        src={src}
        alt=""
        draggable={false}
        className="knight-portrait-img"
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}
