import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Player } from '../types';

export interface MatchHistoryEntry {
  playerId: string;
  playerName: string;
  playerAvatar: string;
  wins: number;
  losses: number;
  timestamp: number; // Unix ms
  isTestingMode: boolean;
}

/**
 * Log match results for all players in the current game session.
 * Each player's session wins/losses are recorded with a timestamp.
 */
export const logMatchResults = async (
  gamePlayers: Player[],
  isTestingMode: boolean
): Promise<void> => {
  const now = Date.now();
  const collRef = collection(db, 'match_history');

  await Promise.all(
    gamePlayers.map((p) =>
      addDoc(collRef, {
        playerId: p.id,
        playerName: p.name,
        playerAvatar: p.avatar || '',
        wins: p.wins,
        losses: p.losses,
        timestamp: now,
        isTestingMode,
      } satisfies MatchHistoryEntry)
    )
  );
};

export type TimeRange = '24h' | '7d' | '30d' | 'all';

/**
 * Returns the unix ms cutoff for a given time range.
 *
 * - 24h  → resets daily at 5:00 AM. The cutoff is the most recent 5:00 AM
 *          that has already passed (today if after 5 AM, yesterday otherwise).
 * - 7d   → resets every Monday at 5:00 AM. The cutoff is the most recent Monday
 *          5:00 AM that has already passed.
 * - 30d  → first day of the current calendar month.
 * - all  → epoch (0).
 */
const getCutoff = (range: TimeRange): number => {
  const now = new Date();
  switch (range) {
    case '24h': {
      // Build today's 5:00:00 AM
      const resetToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 5, 0, 0, 0);
      // If we haven't reached 5:00 AM yet, the last reset was yesterday at 5:00 AM
      if (now.getTime() < resetToday.getTime()) {
        resetToday.setDate(resetToday.getDate() - 1);
      }
      return resetToday.getTime();
    }
    case '7d': {
      // Find the most recent Monday at 5:00 AM
      const day = now.getDay(); // 0=Sun, 1=Mon, …, 6=Sat
      const diffToMonday = (day === 0 ? 6 : day - 1); // days since last Monday
      const lastMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday, 5, 0, 0, 0);
      // If today is Monday but we haven't reached 5:00 AM yet, we need to go back another week
      if (now.getTime() < lastMonday.getTime()) {
        lastMonday.setDate(lastMonday.getDate() - 7);
      }
      return lastMonday.getTime();
    }
    case '30d': {
      // Calendar month: start of the current month
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      return monthStart.getTime();
    }
    case 'all':
      return 0;
  }
};

/**
 * Returns { nextReset: Date, label: string } for the given time range so
 * the UI can show a countdown / info badge.
 */
export const getNextResetInfo = (range: TimeRange): { nextReset: Date; label: string } | null => {
  const now = new Date();
  switch (range) {
    case '24h': {
      const resetToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 5, 0, 0, 0);
      if (now.getTime() >= resetToday.getTime()) {
        // Next reset is tomorrow at 5:00 AM
        resetToday.setDate(resetToday.getDate() + 1);
      }
      return { nextReset: resetToday, label: 'Resets daily at 5 AM' };
    }
    case '7d': {
      const day = now.getDay();
      const daysUntilMonday = day === 1 ? 7 : (day === 0 ? 1 : 8 - day);
      const nextMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilMonday, 5, 0, 0, 0);
      // Special case: If today is Monday but before 5 AM, the next reset is TODAY at 5 AM
      if (day === 1 && now.getTime() < new Date(now.getFullYear(), now.getMonth(), now.getDate(), 5, 0, 0, 0).getTime()) {
        nextMonday.setDate(nextMonday.getDate() - 7);
      }
      return { nextReset: nextMonday, label: 'Resets Mon at 5 AM' };
    }
    case '30d': {
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
      return { nextReset: nextMonth, label: `Resets ${nextMonth.toLocaleString('default', { month: 'long' })} 1st` };
    }
    case 'all':
      return null;
  }
};

export interface AggregatedPlayer {
  id: string;
  name: string;
  avatar: string;
  wins: number;
  losses: number;
}

/**
 * Fetch match history from Firestore for a given time range and aggregate into leaderboard data.
 */
export const getFilteredLeaderboard = async (
  range: TimeRange,
  isTestingMode: boolean
): Promise<AggregatedPlayer[]> => {
  const cutoff = getCutoff(range);
  const collRef = collection(db, 'match_history');

  // Single where clause to avoid composite index requirement
  // Filter isTestingMode client-side for reliability
  const q = query(
    collRef,
    where('timestamp', '>=', cutoff)
  );

  const snap = await getDocs(q);
  const map = new Map<string, AggregatedPlayer>();

  snap.forEach((docSnap) => {
    const d = docSnap.data() as MatchHistoryEntry;
    // Client-side filter for testing mode
    if (d.isTestingMode !== isTestingMode) return;

    const existing = map.get(d.playerId);
    if (existing) {
      existing.wins += d.wins;
      existing.losses += d.losses;
      // Keep latest name/avatar
      existing.name = d.playerName;
      existing.avatar = d.playerAvatar;
    } else {
      map.set(d.playerId, {
        id: d.playerId,
        name: d.playerName,
        avatar: d.playerAvatar,
        wins: d.wins,
        losses: d.losses,
      });
    }
  });

  return Array.from(map.values()).sort((a, b) => b.wins - a.wins);
};
