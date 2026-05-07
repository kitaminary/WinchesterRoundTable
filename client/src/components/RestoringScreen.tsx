import { Loader2 } from 'lucide-react';

interface RestoringScreenProps {
  savedKnightName: string;
  socketConnected: boolean;
  joinPending: boolean;
  error: string | null;
  onCancel: () => void;
  onRetry: () => void;
}

export function RestoringScreen({
  savedKnightName,
  socketConnected,
  joinPending,
  error,
  onCancel,
  onRetry,
}: RestoringScreenProps) {
  const waitingSocket = !socketConnected;

  return (
    <div className="entry-screen">
      <div className="entry-card restoring-card">
        <div className="restoring-spinner-wrap" aria-hidden>
          <Loader2 className={`restoring-spinner ${joinPending ? 'spinning' : ''}`} />
        </div>
        <h1 className="entry-title">Returning to the Winchester Round Table...</h1>
        <p className="entry-subtitle restoring-detail">
          {waitingSocket ? 'Connecting…' : 'Taking your seat'}{savedKnightName ? ` as "${savedKnightName}"` : ''}.
        </p>

        {error && <p className="entry-error restoring-error">{error}</p>}

        <div className="restoring-actions">
          {!error ? (
            <button type="button" className="entry-button muted-button" onClick={onCancel}>
              Use another name
            </button>
          ) : (
            <>
              <button type="button" className="entry-button" onClick={onRetry}>
                Try again
              </button>
              <button type="button" className="entry-button muted-button" onClick={onCancel}>
                Use another name
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
