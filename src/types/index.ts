export interface Player {
  id: string;
  name: string;
  avatar: string; // base64 or image URL
  wins: number;
  losses: number;
  sessionWins?: number;
  sessionLosses?: number;
  rank?: number;
  likes?: number;
  dislikes?: number;
  isCertified?: boolean;
  isBanned?: boolean;
  banGamesRemaining?: number;
  banReason?: string;
  bannedAt?: number;
  merit?: number;
  rulesSignedAt?: number;
  lastDuel?: {
    opponentId: string;
    opponentName: string;
    opponentAvatar: string;
    result: 'win' | 'loss';
    timestamp: number;
    sessionId: string;
  };
}

export interface GameSession {
  id: string;
  playerCount: number;
  players: Player[];
  createdAt: Date;
  endedAt?: Date;
  isActive: boolean;
}

export interface MatchResult {
  sessionId: string;
  players: Player[];
  winner: Player;
  timestamp: Date;
  duration?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
