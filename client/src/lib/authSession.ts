export const AUTH_TOKEN_KEY = 'winchester_auth_token';

export interface AuthUser {
  id: string;
  username: string;
  avatarId: number;
}

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY) ?? null;
  } catch {
    return null;
  }
}

export function storeToken(token: string): void {
  try {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  } catch {
    /* quota / private mode */
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export async function fetchMe(token: string): Promise<AuthUser | null> {
  try {
    const res = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { user: AuthUser };
    return data.user;
  } catch {
    return null;
  }
}

export async function apiRegister(
  username: string,
  password: string,
  avatarId: number
): Promise<{ token: string; user: AuthUser } | { error: string }> {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, avatarId }),
  });
  return res.json() as Promise<{ token: string; user: AuthUser } | { error: string }>;
}

export async function apiLogin(
  username: string,
  password: string
): Promise<{ token: string; user: AuthUser } | { error: string }> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  return res.json() as Promise<{ token: string; user: AuthUser } | { error: string }>;
}

export async function apiLogout(token: string): Promise<void> {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    /* fire-and-forget */
  }
}
