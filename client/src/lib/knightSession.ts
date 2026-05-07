export const KNIGHT_SESSION_STORAGE_KEY = 'winchester_knight_name';
export const KNIGHT_AVATAR_STORAGE_KEY = 'winchester_knight_avatar';

export function getSavedKnightNameTrimmed(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KNIGHT_SESSION_STORAGE_KEY);
    if (raw == null) return null;
    const t = raw.trim().slice(0, 32);
    return t.length > 0 ? t : null;
  } catch {
    return null;
  }
}

export function setSavedKnightName(name: string): void {
  const t = name.trim().slice(0, 32);
  if (!t) {
    clearSavedKnightName();
    return;
  }
  try {
    localStorage.setItem(KNIGHT_SESSION_STORAGE_KEY, t);
  } catch {
    /* quota / private mode */
  }
}

export function clearSavedKnightName(): void {
  try {
    localStorage.removeItem(KNIGHT_SESSION_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function getSavedAvatarId(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KNIGHT_AVATAR_STORAGE_KEY);
    if (raw == null) return null;
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed >= 0 && parsed <= 12 ? parsed : null;
  } catch {
    return null;
  }
}

export function setSavedAvatarId(avatarId: number): void {
  try {
    localStorage.setItem(KNIGHT_AVATAR_STORAGE_KEY, String(avatarId));
  } catch {
    /* quota / private mode */
  }
}

export function clearSavedAvatarId(): void {
  try {
    localStorage.removeItem(KNIGHT_AVATAR_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Сообщения сервера о невалидном имени — чистим сохранённую сессию. */
export function shouldClearSessionOnJoinError(message: string): boolean {
  return (
    message.includes('Enter your name') ||
    message.includes('name before taking') ||
    message.trim().length === 0
  );
}
