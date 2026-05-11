let unlocked = false;
const pendingAudios = new Set<HTMLAudioElement>();
let listenerInstalled = false;

function installFallbackListener(): void {
  if (listenerInstalled) return;
  listenerInstalled = true;
  const handler = () => {
    unlockAudio();
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

if (typeof window !== 'undefined') {
  installFallbackListener();
}

export function unlockAudio(): void {
  if (unlocked) return;
  unlocked = true;
  console.log('[audioUnlock] unlocked, flushing', pendingAudios.size, 'queued audio(s)');
  for (const audio of pendingAudios) {
    audio.play().then(() => {
      console.log('[audioUnlock] queued play() succeeded');
    }).catch((err) => {
      console.warn('[audioUnlock] queued play() failed:', err);
    });
  }
  pendingAudios.clear();
}

export function playOrQueue(audio: HTMLAudioElement): void {
  if (unlocked) {
    audio.play().then(() => {
      console.log('[audioUnlock] play() succeeded');
    }).catch((err) => {
      console.warn('[audioUnlock] play() failed after unlock, re-queuing:', err);
      unlocked = false;
      pendingAudios.add(audio);
      installFallbackListener();
    });
  } else {
    console.log('[audioUnlock] audio queued (not yet unlocked)');
    pendingAudios.add(audio);
  }
}

export function isUnlocked(): boolean {
  return unlocked;
}

export function getPendingCount(): number {
  return pendingAudios.size;
}
