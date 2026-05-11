import { Shield, LogOut } from 'lucide-react';
import { unlockAudio } from '../lib/audioUnlock';
import type { AuthUser } from '../lib/authSession';

interface EnterChamberScreenProps {
  authUser: AuthUser;
  onEnter: () => void;
  onLogout: () => void;
}

export function EnterChamberScreen({ authUser, onEnter, onLogout }: EnterChamberScreenProps) {
  const handleEnter = () => {
    unlockAudio();
    onEnter();
  };

  return (
    <div className="entry-screen">
      <div className="entry-card">
        <div className="entry-header">
          <img src="/public/logo.webp" className="entry-logo" alt="Winchester Round Table" />
          <h1 className="entry-title">Winchester Round Table</h1>
          <p className="entry-subtitle">
            Welcome back, <strong>{authUser.username}</strong>
          </p>
        </div>

        <button type="button" className="entry-button" onClick={handleEnter}>
          <Shield className="button-icon" />
          Enter the Chamber
        </button>

        <div className="entry-footer">
          <button
            type="button"
            onClick={onLogout}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--gold)',
              cursor: 'pointer',
              fontFamily: 'var(--font-display)',
              fontSize: '0.9rem',
              opacity: 0.7,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <LogOut style={{ width: 14, height: 14 }} />
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}
