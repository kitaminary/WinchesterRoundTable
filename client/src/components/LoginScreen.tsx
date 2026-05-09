import { useState, FormEvent } from 'react';
import { Shield, LogIn, UserPlus, Loader2 } from 'lucide-react';
import type { AuthUser } from '../lib/authSession';

const AVATAR_COUNT = 13;
const AVATAR_LABELS = [
  'Iron Hawk', 'Silver Wolf', 'Bronze Bull', 'Gold Dragon',
  'Crimson Fox', 'Stone Bear', 'Sea Serpent', 'Forest Stag',
  'Shadow Raven', 'Thunder Horse', 'Sacred Owl', 'Flame Wyvern', 'Crystal Lion',
];

interface LoginScreenProps {
  onAuthenticated: (user: AuthUser, token: string) => void;
}

export function LoginScreen({ onAuthenticated }: LoginScreenProps) {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const switchTab = (next: 'login' | 'register') => {
    setTab(next);
    setError(null);
    setPassword('');
    setConfirmPassword('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const u = username.trim();
    if (!u) { setError('Please enter your knight name.'); return; }
    if (!password) { setError('Please enter a password.'); return; }

    if (tab === 'register') {
      if (password.length < 4) {
        setError('Password must be at least 4 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match. Re-enter to confirm.');
        return;
      }
    }

    setLoading(true);
    try {
      const endpoint = tab === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body: Record<string, unknown> =
        tab === 'register'
          ? { username: u, password, avatarId: selectedAvatar }
          : { username: u, password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as
        | { token: string; user: AuthUser }
        | { error: string };

      if ('error' in data) {
        setError(data.error);
        return;
      }
      onAuthenticated(data.user, data.token);
    } catch {
      setError('Could not reach the server. Ensure it is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="entry-screen">
      <div className="entry-card login-card">
        <div className="entry-header">
          <img src="/public/logo.webp" className="entry-logo" alt="Winchester Round Table" />
          <h1 className="entry-title">Winchester Round Table</h1>
          <p className="entry-subtitle">Thirteen seats. One voice circle.</p>
        </div>

        {/* Tabs */}
        <div className="login-tabs">
          <button
            type="button"
            className={`login-tab ${tab === 'login' ? 'active' : ''}`}
            onClick={() => switchTab('login')}
          >
            <LogIn className="login-tab-icon" />
            Sign In
          </button>
          <button
            type="button"
            className={`login-tab ${tab === 'register' ? 'active' : ''}`}
            onClick={() => switchTab('register')}
          >
            <UserPlus className="login-tab-icon" />
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} className="entry-form">
          <div className="input-group">
            <label htmlFor="auth-username" className="input-label">Knight Name</label>
            <input
              id="auth-username"
              type="text"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setError(null); }}
              placeholder="Enter your name"
              className="input-field"
              maxLength={32}
              autoFocus
              autoComplete="username"
              disabled={loading}
            />
          </div>

          <div className="input-group">
            <label htmlFor="auth-password" className="input-label">Password</label>
            <input
              id="auth-password"
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(null); }}
              placeholder={tab === 'register' ? 'Choose a password (min 4 chars)' : 'Your password'}
              className="input-field"
              autoComplete={tab === 'register' ? 'new-password' : 'current-password'}
              disabled={loading}
            />
          </div>

          {/* Confirm password — register only */}
          {tab === 'register' && (
            <div className="input-group">
              <label htmlFor="auth-confirm-password" className="input-label">
                Confirm Password
              </label>
              <input
                id="auth-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setError(null); }}
                placeholder="Re-enter your password"
                className={`input-field ${
                  confirmPassword && confirmPassword !== password ? 'input-field-error' : ''
                }`}
                autoComplete="new-password"
                disabled={loading}
              />
              {confirmPassword && confirmPassword !== password && (
                <p className="input-hint-error">Passwords do not match</p>
              )}
            </div>
          )}

          {/* Avatar picker — register only */}
          {tab === 'register' && (
            <div className="input-group">
              <span className="input-label">Choose Your Crest</span>
              <div className="avatar-picker-grid">
                {Array.from({ length: AVATAR_COUNT }, (_, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`avatar-picker-item ${selectedAvatar === i ? 'selected' : ''}`}
                    title={AVATAR_LABELS[i]}
                    onClick={() => setSelectedAvatar(i)}
                    disabled={loading}
                  >
                    <img
                      src={`/knights/knight${i + 1}.webp`}
                      alt={AVATAR_LABELS[i]}
                      className="avatar-picker-img"
                    />
                  </button>
                ))}
              </div>
              <p className="avatar-picker-label">{AVATAR_LABELS[selectedAvatar]}</p>
            </div>
          )}

          {error && <p className="entry-error">{error}</p>}

          <button
            type="submit"
            className="entry-button"
            disabled={
              loading ||
              !username.trim() ||
              !password ||
              (tab === 'register' && (!confirmPassword || confirmPassword !== password))
            }
          >
            {loading ? (
              <>
                <Loader2 className="button-icon spinning" />
                {tab === 'login' ? 'Entering…' : 'Registering…'}
              </>
            ) : (
              <>
                <Shield className="button-icon" />
                {tab === 'login' ? 'Enter the Chamber' : 'Claim Your Seat'}
              </>
            )}
          </button>
        </form>

        <div className="entry-footer">
          <p>
            {tab === 'login'
              ? 'New knight? Switch to Register above.'
              : 'Already registered? Switch to Sign In above.'}
          </p>
        </div>
      </div>
    </div>
  );
}
