let unlocked = false;
const pendingAudios = new Set<HTMLAudioElement>();
let listenerInstalled = false;

function installFallbackListener(): void {
  if (listenerInstalled) return;
  listenerInstalled = true;
  const handler = () => {
    unlockAudio();
    // Allow installFallbackListener() to attach again after a failed play()
    // (handlers are removed here but listenerInstalled must not stay stuck true).
    listenerInstalled = false;
    window.removeEventListener('click', handler, true);
    window.removeEventListener('keydown', handler, true);
    window.removeEventListener('touchstart', handler, true);
    window.removeEventListener('pointerdown', handler, true);
  };
  window.addEventListener('click', handler, true);
  window.addEventListener('keydown', handler, true);
  window.addEventListener('touchstart', handler, true);
  window.addEventListener('pointerdown', handler, true);
}

// Install at module load — any gesture anywhere unlocks audio.
// This covers the case where the user is already authenticated and
// never sees the LoginScreen (so its onClick unlock never fires).
if (typeof window !== 'undefined') {
  installFallbackListener();
}

export function unlockAudio(): void {
  if (unlocked) return;
  unlocked = true;
  pendingAudios.forEach((audio) => {
    audio.play().catch((err) => {
      console.warn('[audioUnlock] play failed:', err);
    });
  });
  pendingAudios.clear();
}

export function playOrQueue(audio: HTMLAudioElement): void {
  if (unlocked) {
    audio.play().catch((err) => {
      console.warn('[audioUnlock] play failed:', err);
      // Queue for next gesture in case the failure is autoplay-related.
      unlocked = false;
      pendingAudios.add(audio);
      installFallbackListener();
    });
  } else {
    pendingAudios.add(audio);
  }
}

export function isUnlocked(): boolean {
  return unlocked;
}
