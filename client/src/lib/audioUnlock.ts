let unlocked = false;
const pendingAudios = new Set<HTMLAudioElement>();

export function unlockAudio(): void {
  if (unlocked) return;
  unlocked = true;
  pendingAudios.forEach((audio) => {
    audio.play().catch(() => {});
  });
  pendingAudios.clear();
}

export function playOrQueue(audio: HTMLAudioElement): void {
  if (unlocked) {
    audio.play().catch(() => {});
  } else {
    pendingAudios.add(audio);
  }
}

export function isUnlocked(): boolean {
  return unlocked;
}
