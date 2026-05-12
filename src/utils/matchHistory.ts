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
 */
const getCutoff = (range: TimeRange): number => {
  const now = new Date();
  switch (range) {
    case '24h':
      return now.getTime() - 24 * 60 * 60 * 1000;
    case '7d':
      return now.getTime() - 7 * 24 * 60 * 60 * 1000;
    case '30d': {
      // Calendar month: start of the current month
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      return monthStart.getTime();
    }
    case 'all':
      return 0;
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
