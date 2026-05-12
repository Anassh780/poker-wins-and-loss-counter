import axios from 'axios';
import type { Player, GameSession, ApiResponse } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// Game Session APIs
export const createGameSession = async (playerCount: number): Promise<GameSession> => {
  try {
    const response = await api.post<ApiResponse<GameSession>>('/sessions', { playerCount });
    return response.data.data || ({} as GameSession);
  } catch (error) {
    console.error('Error creating session:', error);
    throw error;
  }
};

export const getGameSession = async (sessionId: string): Promise<GameSession> => {
  try {
    const response = await api.get<ApiResponse<GameSession>>(`/sessions/${sessionId}`);
    return response.data.data || ({} as GameSession);
  } catch (error) {
    console.error('Error fetching session:', error);
    throw error;
  }
};

export const endGameSession = async (sessionId: string): Promise<GameSession> => {
  try {
    const response = await api.post<ApiResponse<GameSession>>(`/sessions/${sessionId}/end`);
    return response.data.data || ({} as GameSession);
  } catch (error) {
    console.error('Error ending session:', error);
    throw error;
  }
};

// Player APIs
export const addPlayerToSession = async (
  sessionId: string,
  playerData: Partial<Player>
): Promise<Player> => {
  try {
    const response = await api.post<ApiResponse<Player>>(
      `/sessions/${sessionId}/players`,
      playerData
    );
    return response.data.data || ({} as Player);
  } catch (error) {
    console.error('Error adding player:', error);
    throw error;
  }
};

export const updatePlayerStats = async (
  sessionId: string,
  playerId: string,
  wins: number,
  losses: number
): Promise<Player> => {
  try {
    const response = await api.put<ApiResponse<Player>>(
      `/sessions/${sessionId}/players/${playerId}`,
      { wins, losses }
    );
    return response.data.data || ({} as Player);
  } catch (error) {
    console.error('Error updating player stats:', error);
    throw error;
  }
};

export const updatePlayerProfile = async (
  sessionId: string,
  playerId: string,
  name: string,
  avatar: string
): Promise<Player> => {
  try {
    const response = await api.put<ApiResponse<Player>>(
      `/sessions/${sessionId}/players/${playerId}`,
      { name, avatar }
    );
    return response.data.data || ({} as Player);
  } catch (error) {
    console.error('Error updating player profile:', error);
    throw error;
  }
};

export const deletePlayerFromSession = async (
  sessionId: string,
  playerId: string
): Promise<void> => {
  try {
    await api.delete(`/sessions/${sessionId}/players/${playerId}`);
  } catch (error) {
    console.error('Error deleting player:', error);
    throw error;
  }
};

// Leaderboard APIs
export const getLeaderboard = async (sessionId?: string): Promise<Player[]> => {
  try {
    const url = sessionId ? `/leaderboard?sessionId=${sessionId}` : '/leaderboard';
    const response = await api.get<ApiResponse<Player[]>>(url);
    return response.data.data || [];
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    throw error;
  }
};

// Local storage fallback for offline support
export const saveGameSessionLocally = (session: GameSession): void => {
  localStorage.setItem(`game-session-${session.id}`, JSON.stringify(session));
};

export const getGameSessionLocally = (sessionId: string): GameSession | null => {
  const data = localStorage.getItem(`game-session-${sessionId}`);
  return data ? JSON.parse(data) : null;
};

export const saveLeaderboardLocally = (leaderboard: Player[]): void => {
  localStorage.setItem('leaderboard', JSON.stringify(leaderboard));
};

export const getLeaderboardLocally = (): Player[] => {
  const data = localStorage.getItem('leaderboard');
  return data ? JSON.parse(data) : [];
};

export const syncWithBackend = async () => {
  try {
    const leaderboard = getLeaderboardLocally();
    if (leaderboard.length > 0) {
      // Attempt to sync with backend
      await api.post('/leaderboard/sync', { players: leaderboard });
    }
  } catch (error) {
    console.warn('Could not sync with backend:', error);
  }
};
