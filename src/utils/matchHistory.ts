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
  timeframe?: TimeRange; // Optional field to lock manual adjustments to a specific timeframe
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
export const getCutoff = (range: TimeRange): number => {
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
      // Calendar month: 1st of the current month at 5:00 AM
      // Before 5 AM on the 1st, show previous month's data (same pattern as daily/weekly)
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 5, 0, 0, 0);
      if (now.getTime() < monthStart.getTime()) {
        monthStart.setMonth(monthStart.getMonth() - 1);
      }
      return monthStart.getTime();
    }
    case 'all':
      return 0;
  }
};

/**
 * Returns the start/end timestamps for the PREVIOUS completed period.
 * Used for determining period champions.
 */
export const getPreviousPeriodRange = (range: TimeRange): { start: number; end: number } | null => {
  const currentCutoff = getCutoff(range);
  switch (range) {
    case '24h':
      return { start: currentCutoff - 24 * 60 * 60 * 1000, end: currentCutoff };
    case '7d':
      return { start: currentCutoff - 7 * 24 * 60 * 60 * 1000, end: currentCutoff };
    case '30d': {
      const d = new Date(currentCutoff);
      d.setMonth(d.getMonth() - 1);
      return { start: d.getTime(), end: currentCutoff };
    }
    default:
      return null;
  }
};

/**
 * Fetch match history between two timestamps and aggregate into leaderboard data.
 * Used to determine period champions from the previous period.
 */
export const getLeaderboardForPeriod = async (
  startTs: number,
  endTs: number,
  isTestingMode: boolean
): Promise<AggregatedPlayer[]> => {
  const collRef = collection(db, 'match_history');
  const q = query(collRef, where('timestamp', '>=', startTs));
  const snap = await getDocs(q);
  const map = new Map<string, AggregatedPlayer>();

  snap.forEach((docSnap) => {
    const d = docSnap.data() as MatchHistoryEntry;
    if (d.isTestingMode !== isTestingMode) return;
    if (d.timestamp >= endTs) return; // client-side upper bound
    if (d.timeframe) return; // skip manual adjustments

    const existing = map.get(d.playerId);
    if (existing) {
      existing.wins += d.wins;
      existing.losses += d.losses;
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
      const monthReset = new Date(now.getFullYear(), now.getMonth(), 1, 5, 0, 0, 0);
      // If we are past the 1st at 5 AM, the next reset is the 1st of next month at 5 AM
      if (now.getTime() >= monthReset.getTime()) {
        monthReset.setMonth(monthReset.getMonth() + 1);
      }
      return { nextReset: monthReset, label: `Resets ${monthReset.toLocaleString('default', { month: 'long' })} 1st at 5 AM` };
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

export interface PeriodChampion {
  playerName: string;
  playerId: string;
  playerAvatar: string;
  wins: number;
  periodLabel: string;
}

export interface PeriodChampions {
  daily: PeriodChampion | null;
  weekly: PeriodChampion | null;
  monthly: PeriodChampion | null;
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

    // Strict timeframe locking:
    // If this entry was explicitly target-bounded to a specific timeframe,
    // it must ONLY count for that precise timeframe.
    if (d.timeframe && d.timeframe !== range) {
      return;
    }

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

