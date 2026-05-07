import { useState, FormEvent, useEffect } from 'react';
import { Shield, Loader2 } from 'lucide-react';
import type { ConnectionStatus } from '../types';

interface EntryScreenProps {
  onJoin: (knightName: string) => void;
  socketConnected: boolean;
  joinPending: boolean;
  serverStatus: ConnectionStatus;
  error: string | null;
  defaultKnightName: string;
}

export function EntryScreen({
  onJoin,
  socketConnected,
  joinPending,
  serverStatus,
  error,
  defaultKnightName,
}: EntryScreenProps) {
  const [name, setName] = useState(defaultKnightName);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setName(defaultKnightName);
  }, [defaultKnightName]);

  const trimmedName = name.trim();
  const waitingForSocket =
    !socketConnected ||
    serverStatus === 'disconnected' ||
    (serverStatus === 'connecting' && !socketConnected);

  const cannotSubmit =
    trimmedName.length === 0 || joinPending || waitingForSocket;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setLocalError('Enter your name to take a seat.');
      return;
    }
    if (waitingForSocket || joinPending) {
      return;
    }
    onJoin(trimmed);
  };

  return (
    <div className="entry-screen">
      <div className="entry-card">
        <div className="entry-header">
          <img src="/public/logo.webp" className="entry-logo" alt="Winchester Round Table" />
          <h1 className="entry-title">Winchester Round Table</h1>
          <p className="entry-subtitle">
            Sit with your company council — thirteen seats, one voice circle.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="entry-form">
          <div className="input-group">
            <label htmlFor="knight-name" className="input-label">
              Knight Name
            </label>
            <input
              id="knight-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (localError) setLocalError(null);
              }}
              placeholder="Enter your name at the table"
              className="input-field"
              maxLength={32}
              disabled={joinPending}
              autoFocus
              autoComplete="off"
            />
          </div>

          {waitingForSocket && (
            <p className="entry-connection-hint" role="status">
              Connecting to server… Ensure the backend runs on port 3000 when using npm run dev.
            </p>
          )}

          {(localError || error) && (
            <p className="entry-error">{localError ?? error}</p>
          )}

          <button
            type="submit"
            className="entry-button"
            disabled={cannotSubmit}
          >
            {joinPending ? (
              <>
                <Loader2 className="button-icon spinning" />
                Taking seat…
              </>
            ) : (
              <>
                <Shield className="button-icon" />
                Take a Seat
              </>
            )}
          </button>
        </form>

        <div className="entry-footer">
          <p>Up to thirteen knights may gather at the Winchester Round Table.</p>
        </div>
      </div>
    </div>
  );
}
