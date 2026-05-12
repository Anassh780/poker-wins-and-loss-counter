export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  condition: (stats: { wins: number; losses: number; gamesPlayed: number }) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_blood', title: 'First Blood', description: 'Win your very first game', icon: '🩸', condition: (s) => s.wins >= 1 },
  { id: 'triple_kill', title: 'Triple Kill', description: 'Win 3 games', icon: '🔥', condition: (s) => s.wins >= 3 },
  { id: 'penta_kill', title: 'Penta Kill', description: 'Win 5 games', icon: '💥', condition: (s) => s.wins >= 5 },
  { id: 'dominator', title: 'Dominator', description: 'Win 10 games', icon: '👑', condition: (s) => s.wins >= 10 },
  { id: 'legend', title: 'Legend', description: 'Win 25 games', icon: '🏆', condition: (s) => s.wins >= 25 },
  { id: 'god_mode', title: 'God Mode', description: 'Win 50 games', icon: '⚡', condition: (s) => s.wins >= 50 },
  { id: 'centurion', title: 'Centurion', description: 'Win 100 games', icon: '💎', condition: (s) => s.wins >= 100 },
  { id: 'survivor', title: 'Survivor', description: 'Play 10 games', icon: '🛡️', condition: (s) => s.gamesPlayed >= 10 },
  { id: 'veteran', title: 'Veteran', description: 'Play 25 games', icon: '⭐', condition: (s) => s.gamesPlayed >= 25 },
  { id: 'iron_will', title: 'Iron Will', description: 'Play 50 games', icon: '🔩', condition: (s) => s.gamesPlayed >= 50 },
  { id: 'perfectionist', title: 'Perfectionist', description: 'Maintain 100% win rate with 5+ games', icon: '🎯', condition: (s) => s.gamesPlayed >= 5 && s.losses === 0 },
  { id: 'comeback_king', title: 'Comeback King', description: 'Win after having 5+ losses', icon: '🔄', condition: (s) => s.losses >= 5 && s.wins >= 1 },
  { id: 'unbreakable', title: 'Unbreakable', description: 'Win rate above 80% with 10+ games', icon: '💪', condition: (s) => s.gamesPlayed >= 10 && (s.wins / s.gamesPlayed) > 0.8 },
  { id: 'balanced', title: 'Balanced', description: 'Equal wins and losses (5+)', icon: '⚖️', condition: (s) => s.wins >= 5 && s.wins === s.losses },
  { id: 'underdog', title: 'Underdog', description: 'Win with more losses than wins (10+ games)', icon: '🐕', condition: (s) => s.gamesPlayed >= 10 && s.losses > s.wins && s.wins >= 1 },
];

export function getUnlockedAchievements(wins: number, losses: number): Achievement[] {
  const gamesPlayed = wins + losses;
  return ACHIEVEMENTS.filter(a => a.condition({ wins, losses, gamesPlayed }));
}
