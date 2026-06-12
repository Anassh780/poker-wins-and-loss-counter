import type { Player } from '../types';
import { StreakBadge } from './StreakBadge';

interface PlayerControlsProps {
  players: Player[];
  onAddWin: (playerId: string) => void;
  onAddLoss: (playerId: string) => void;
  onEditPlayer: (player: Player) => void;
  onDeletePlayer: (playerId: string) => void;
  onResetStats: (playerId?: string) => void;
}

export const PlayerControls = ({
  players, onAddWin, onAddLoss, onEditPlayer, onDeletePlayer, onResetStats,
}: PlayerControlsProps) => {
  return (
    <div className="w-full">
      <h3 className="text-lg sm:text-2xl font-cyber font-bold gradient-text mb-3 sm:mb-4">🎮 Controls</h3>

      <div className="space-y-2">
        {players.map((player) => (
          <div key={player.id}
            className="glass-dark rounded-xl border border-white/8 hover:border-cyan-500/25 transition-smooth overflow-hidden">

            {/* Player name row */}
            <div className="flex items-center gap-2 px-3 pt-3 pb-2">
              {player.avatar
                ? <img src={player.avatar} alt={player.name} className="w-7 h-7 rounded-lg object-cover flex-shrink-0 border border-white/10" />
                : <div className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-[10px] font-cyber font-black text-white"
                    style={{ background: 'linear-gradient(135deg,#7c3aed,#0891b2)' }}>
                    {player.name.slice(0,2).toUpperCase()}
                  </div>
              }
              <span className="font-cyber font-bold text-sm text-cyan-300 truncate flex-1">{player.name}</span>
              <span className="text-[10px] text-gray-500 whitespace-nowrap flex-shrink-0">
                {player.wins}W · {player.losses}L
              </span>
              <StreakBadge value={player.winStreak || 0} earnedAt={player.winStreakUpdatedAt} size="xs" />
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-4 gap-0 border-t border-white/5">
              <button onClick={() => onAddWin(player.id)}
                className="py-2.5 text-xs font-bold transition-smooth hover:bg-green-500/15 text-green-400 active:scale-95 border-r border-white/5"
                title="Win">
                ✓ Win
              </button>
              <button onClick={() => onAddLoss(player.id)}
                className="py-2.5 text-xs font-bold transition-smooth hover:bg-red-500/15 text-red-400 active:scale-95 border-r border-white/5"
                title="Loss">
                ✗ Loss
              </button>
              <button onClick={() => onEditPlayer(player)}
                className="py-2.5 text-xs font-bold transition-smooth hover:bg-purple-500/15 text-purple-400 active:scale-95 border-r border-white/5"
                title="Edit">
                ✎ Edit
              </button>
              <button
                onClick={() => { if (confirm(`Remove "${player.name}"?`)) onDeletePlayer(player.id); }}
                className="py-2.5 text-xs font-bold transition-smooth hover:bg-red-500/10 text-red-300/60 active:scale-95"
                title="Delete">
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => { if (confirm('Reset ALL stats?')) onResetStats(); }}
        className="mt-3 w-full py-2.5 text-xs sm:text-sm bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 text-orange-400 rounded-xl font-bold transition-smooth">
        ⟲ Reset All Stats
      </button>
    </div>
  );
};
