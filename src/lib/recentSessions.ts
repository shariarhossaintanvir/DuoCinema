import { RecentSession } from '@/types/database';

const STORAGE_KEY = 'duocinema_recent_sessions_v1';
const MAX_SESSIONS = 5;

export function getRecentSessions(): RecentSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, MAX_SESSIONS);
  } catch {
    return [];
  }
}

export function saveRecentSession(session: Omit<RecentSession, 'lastVisited'>): void {
  try {
    const existing = getRecentSessions().filter(s => s.roomCode !== session.roomCode);
    const updated: RecentSession[] = [
      {
        ...session,
        lastVisited: new Date().toISOString(),
      },
      ...existing,
    ].slice(0, MAX_SESSIONS);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // LocalStorage quota or privacy mode - ignore gracefully
  }
}

export function removeRecentSession(roomCode: string): void {
  try {
    const updated = getRecentSessions().filter(s => s.roomCode !== roomCode);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore
  }
}
