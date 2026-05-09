import { useRef, useCallback, useEffect, useState } from 'react';

export interface UseWakeLockReturn {
  wakeLockActive: boolean;
  wakeLockUnsupported: boolean;
  requestWakeLock: () => Promise<void>;
  releaseWakeLock: () => Promise<void>;
}

export function useWakeLock(): UseWakeLockReturn {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [wakeLockUnsupported] = useState(
    typeof navigator === 'undefined' || !('wakeLock' in navigator)
  );

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
      } catch {
        /* ignore */
      }
      wakeLockRef.current = null;
      setWakeLockActive(false);
    }
  }, []);

  const requestWakeLock = useCallback(async () => {
    if (wakeLockUnsupported) return;
    if (wakeLockRef.current) return; // already held
    try {
      const sentinel = await (navigator as Navigator & { wakeLock: { request: (type: string) => Promise<WakeLockSentinel> } }).wakeLock.request('screen');
      wakeLockRef.current = sentinel;
      setWakeLockActive(true);
      sentinel.addEventListener('release', () => {
        wakeLockRef.current = null;
        setWakeLockActive(false);
      });
    } catch (err) {
      // May fail if document is hidden (tab switch etc.)
      console.warn('[WakeLock] Could not acquire:', err);
    }
  }, [wakeLockUnsupported]);

  // Re-request wake lock when page becomes visible again
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && wakeLockActive && !wakeLockRef.current) {
        void requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [wakeLockActive, requestWakeLock]);

  // Release on unmount
  useEffect(() => {
    return () => { void releaseWakeLock(); };
  }, [releaseWakeLock]);

  return { wakeLockActive, wakeLockUnsupported, requestWakeLock, releaseWakeLock };
}
