import type { FC } from 'react';
import type { Player } from '../types';
import { calculateWinRate, getAvatarInitials } from '../utils/imageExport';

interface PlayerCardProps {
  player: Player;
  rank: number;
  isCompact?: boolean;
  showActions?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

export const PlayerCard: FC<PlayerCardProps> = ({
  player, rank, showActions = false, onEdit, onDelete,
}) => {
  const winRate = calculateWinRate(player.wins, player.losses);
  const rankColor =
    rank === 1 ? 'from-yellow-400 to-yellow-600' :
    rank === 2 ? 'from-gray-300 to-gray-500' :
    rank === 3 ? 'from-orange-400 to-orange-600' :
    'from-cyan-500/30 to-purple-500/30';

  return (
    <div className="glass-dark p-3 sm:p-4 rounded-xl border border-white/10 hover:border-cyan-500/50 transition-smooth flex flex-col gap-3 w-full">
      {/* Top row: rank badge + actions */}
      <div className="flex items-center justify-between gap-2">
        <div className={`bg-gradient-to-br ${rankColor} text-white font-cyber font-bold text-sm w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0`}>
          #{rank}
        </div>
        {showActions && (
          <div className="flex gap-1 flex-shrink-0">
            {onEdit && (
              <button onClick={onEdit}
                className="p-1.5 hover:bg-cyan-500/20 rounded-lg transition-smooth text-cyan-400 text-sm"
                aria-label="Edit">✎</button>
            )}
            {onDelete && (
              <button onClick={onDelete}
                className="p-1.5 hover:bg-pink-500/20 rounded-lg transition-smooth text-pink-400 text-sm"
                aria-label="Delete">✕</button>
            )}
          </div>
        )}
      </div>

      {/* Avatar + Name */}
      <div className="flex items-center gap-2.5">
        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg overflow-hidden border border-cyan-500/40 flex items-center justify-center bg-gradient-to-br from-purple-500 to-cyan-500 flex-shrink-0">
          {player.avatar
            ? <img src={player.avatar} alt={player.name} className="w-full h-full object-cover" />
            : <span className="text-sm sm:text-base font-cyber font-bold">{getAvatarInitials(player.name)}</span>
          }
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-cyber font-bold text-xs sm:text-sm truncate text-cyan-300">{player.name}</h3>
          <p className="text-[10px] text-gray-500">{player.wins + player.losses} matches</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-1.5 text-center">
        {[
          { label: 'W', value: player.wins, color: 'text-green-400' },
          { label: 'L', value: player.losses, color: 'text-red-400' },
          { label: '%', value: `${winRate.toFixed(1)}%`, color: 'text-purple-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-lg py-1.5 px-1" style={{ background: 'rgba(0,0,0,0.3)' }}>
            <p className="text-[9px] text-gray-600 uppercase">{label}</p>
            <p className={`font-cyber font-black text-xs sm:text-sm ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Win rate bar */}
      <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden flex-shrink-0 mt-auto">
        <div className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 transition-all duration-500"
          style={{ width: `${Math.min(winRate, 100)}%` }} />
      </div>
    </div>
  );
};
