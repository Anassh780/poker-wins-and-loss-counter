export interface Player {
  id: string;
  name: string;
  avatar: string; // base64 or image URL
  wins: number;
  losses: number;
  sessionWins?: number;
  sessionLosses?: number;
  rank?: number;
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
