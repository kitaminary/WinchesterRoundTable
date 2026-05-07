import { Shield, RefreshCw } from 'lucide-react';

interface FullRoomScreenProps {
  onRetry: () => void;
}

export function FullRoomScreen({ onRetry }: FullRoomScreenProps) {
  return (
    <div className="entry-screen">
      <div className="entry-card">
        <div className="entry-header">
          <Shield className="entry-icon full-room" aria-hidden />
          <h1 className="entry-title">The Winchester Round Table is full</h1>
          <p className="entry-subtitle">
            All thirteen seats are taken.
            <br />
            Wait for someone to rise, then try again.
          </p>
        </div>

        <button type="button" onClick={onRetry} className="entry-button">
          <RefreshCw className="button-icon" />
          Try Again
        </button>

        <div className="entry-footer">
          <p>The Winchester chamber is complete</p>
        </div>
      </div>
    </div>
  );
}
