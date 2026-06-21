export type UserSession = {
  userId: string;
  userDid: string;
  displayName: string;
};

const SESSION_KEY = "t3pay_session";

export function loadSession(): UserSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserSession;
    if (!parsed.userId || !parsed.displayName) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveSession(session: UserSession): void {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  window.localStorage.removeItem(SESSION_KEY);
}
