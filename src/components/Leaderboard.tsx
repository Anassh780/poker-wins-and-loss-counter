import { useState, useEffect } from 'react';
import type { Player } from '../types';
import { calculateWinRate, getAvatarInitials, copyDOMElementToClipboard } from '../utils/imageExport';
import { getFilteredLeaderboard, getNextResetInfo, type TimeRange, type AggregatedPlayer } from '../utils/matchHistory';

interface LeaderboardProps {
  players: Player[];
  sortBy?: 'wins' | 'winRate' | 'matches';
  isAdmin?: boolean;
  canEditPlayers?: boolean;
  onAdminEdit?: (player: Player) => void;
  showTimeFilter?: boolean;
  isTestingMode?: boolean;
}

export const Leaderboard = ({ players, sortBy = 'wins', isAdmin, canEditPlayers, onAdminEdit, showTimeFilter = false, isTestingMode = false }: LeaderboardProps) => {
  const [sortMethod, setSortMethod] = useState<'wins' | 'winRate' | 'matches'>(sortBy);
  const [timeRange, setTimeRange] = useState<TimeRange>(showTimeFilter ? '24h' : 'all');
  const [filteredPlayers, setFilteredPlayers] = useState<AggregatedPlayer[] | null>(null);
  const [loadingFilter, setLoadingFilter] = useState(false);
  const [resetCountdown, setResetCountdown] = useState<string>('');
  const [resetLabel, setResetLabel] = useState<string>('');

  // Fetch filtered data when time range changes (only when not 'all')
  useEffect(() => {
    if (!showTimeFilter || timeRange === 'all') {
      setFilteredPlayers(null);
      return;
    }

    let cancelled = false;
    setLoadingFilter(true);

    getFilteredLeaderboard(timeRange, isTestingMode)
      .then((data) => {
        if (!cancelled) setFilteredPlayers(data);
      })
      .catch((err) => {
        console.error('Failed to load filtered leaderboard:', err);
        if (!cancelled) setFilteredPlayers(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingFilter(false);
      });

    return () => { cancelled = true; };
  }, [timeRange, isTestingMode, showTimeFilter]);

  // Countdown timer for next reset + auto-refresh when reset time is crossed
  useEffect(() => {
    if (!showTimeFilter || timeRange === 'all') {
      setResetCountdown('');
      setResetLabel('');
      return;
    }

    const info = getNextResetInfo(timeRange);
    if (!info) return;

    setResetLabel(info.label);

    const tick = () => {
      const now = Date.now();
      const diff = info.nextReset.getTime() - now;

      if (diff <= 0) {
        // Reset time has passed — refresh the data
        setResetCountdown('Resetting...');
        setLoadingFilter(true);
        getFilteredLeaderboard(timeRange, isTestingMode)
          .then((data) => setFilteredPlayers(data))
          .catch(console.error)
          .finally(() => setLoadingFilter(false));
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const mins  = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs  = Math.floor((diff % (1000 * 60)) / 1000);

      if (hours > 24) {
        const days = Math.floor(hours / 24);
        setResetCountdown(`${days}d ${hours % 24}h`);
      } else if (hours > 0) {
        setResetCountdown(`${hours}h ${mins}m`);
      } else {
        setResetCountdown(`${mins}m ${secs}s`);
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [timeRange, isTestingMode, showTimeFilter]);

  // Use filtered data or original players
  const activePlayers: Player[] = filteredPlayers
    ? filteredPlayers.map((p) => ({ ...p, sessionWins: 0, sessionLosses: 0 }))
    : players;

  const getSorted = () => {
    const list = [...activePlayers];
    if (sortMethod === 'winRate') return list.sort((a, b) => calculateWinRate(b.wins, b.losses) - calculateWinRate(a.wins, a.losses));
    if (sortMethod === 'matches') return list.sort((a, b) => (b.wins + b.losses) - (a.wins + a.losses));
    return list.sort((a, b) => b.wins - a.wins);
  };

  const sorted = getSorted();

  const rowBg = (rank: number) => {
    if (rank === 1) return { bg: 'rgba(250,204,21,0.07)', border: '3px solid rgba(250,204,21,0.3)', shadow: 'inset 4px 0 20px rgba(250,204,21,0.12)' };
    if (rank === 2) return { bg: 'rgba(148,163,184,0.05)', border: '3px solid rgba(148,163,184,0.25)', shadow: 'inset 4px 0 15px rgba(148,163,184,0.08)' };
    if (rank === 3) return { bg: 'rgba(249,115,22,0.06)', border: '3px solid rgba(249,115,22,0.25)', shadow: 'inset 4px 0 15px rgba(249,115,22,0.08)' };
    return { bg: 'rgba(0,0,0,0.3)', border: '1px solid rgba(0,217,255,0.08)', shadow: 'none' };
  };

  const rankDisplay = (rank: number) => {
    if (rank === 1) return <span className="text-xl sm:text-2xl">🥇</span>;
    if (rank === 2) return <span className="text-xl sm:text-2xl">🥈</span>;
    if (rank === 3) return <span className="text-xl sm:text-2xl">🥉</span>;
    return <span className="font-cyber font-bold text-xs sm:text-sm" style={{ color: 'rgba(0,217,255,0.35)' }}>#{rank}</span>;
  };

  const currentMonthName = new Date().toLocaleString('default', { month: 'long' });

  const timeFilters: { key: TimeRange; label: string; icon: string }[] = [
    { key: '24h', label: '24h', icon: '⏱️' },
    { key: '7d', label: '7 Days', icon: '📅' },
    { key: '30d', label: currentMonthName, icon: '🗓️' },
    { key: 'all', label: 'All Time', icon: '♾️' },
  ];

  return (
    <div id="export-leaderboard" className="w-full bg-[#0a0e27] p-2 sm:p-4 rounded-2xl relative">
      {/* Export Watermark - only visible via html2canvas injected CSS or style toggle */}
      <div className="absolute opacity-0 bottom-4 right-6 text-[10px] text-white/30 font-cyber font-bold data-export-mark tracking-widest">
        ⚡ Generated by CyberTrack
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-2xl sm:text-4xl font-cyber font-bold gradient-text">🏆 LEADERBOARD</h2>
        <div className="flex gap-1.5 sm:gap-2 items-center admin-ignore">
          {/* Copy as Image */}
          <button onClick={() => copyDOMElementToClipboard('export-leaderboard')}
            className="px-2 sm:px-3 py-1.5 rounded-lg font-bold text-[10px] sm:text-xs transition-smooth bg-black/40 text-purple-400 border border-purple-500/30 hover:border-purple-400 hover:text-purple-300 hover:shadow-[0_0_15px_rgba(168,85,247,0.4)] flex items-center gap-1.5">
            <span>📋</span> <span className="hidden sm:inline">Copy</span>
          </button>

          <div className="w-px h-5 bg-white/10"></div>

          {/* Sorter */}
          {(['wins', 'winRate', 'matches'] as const).map((m) => (
              <button key={m} onClick={() => setSortMethod(m)}
                className={`px-2 sm:px-3 py-1.5 rounded-lg font-bold text-[10px] sm:text-xs transition-smooth ${
                  sortMethod === m
                    ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white shadow-[0_0_12px_rgba(0,217,255,0.3)]'
                    : 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10'
                }`}>
                {m === 'wins' ? 'Wins' : m === 'winRate' ? 'Win%' : 'Games'}
              </button>
            ))}
        </div>
      </div>

      {/* Time Filter Bar */}
      {showTimeFilter && (
        <div className="flex items-center gap-1.5 mb-4 p-1.5 bg-black/40 rounded-xl border border-white/5 overflow-x-auto">
          {timeFilters.map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setTimeRange(key)}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-[10px] sm:text-xs font-cyber font-bold uppercase tracking-wider transition-all flex-shrink-0 ${
                timeRange === key
                  ? 'bg-gradient-to-r from-cyan-500/25 to-purple-500/25 text-cyan-300 border border-cyan-500/40 shadow-[0_0_12px_rgba(0,217,255,0.2)]'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/5 border border-transparent'
              }`}
            >
              <span className="text-xs">{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Reset Timing Info Badge */}
        {resetLabel && (
          <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg mb-1"
            style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)' }}>
            <div className="flex items-center gap-2">
              <span className="text-[10px]">🔄</span>
              <span className="text-[10px] sm:text-xs text-purple-300 font-cyber font-bold uppercase tracking-wider">
                {resetLabel}
              </span>
            </div>
            {resetCountdown && (
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] text-gray-500 uppercase tracking-wider">Next in</span>
                <span className="text-xs sm:text-sm font-cyber font-black text-purple-400"
                  style={{ textShadow: '0 0 8px rgba(139,92,246,0.5)' }}>
                  {resetCountdown}
                </span>
              </div>
            )}
          </div>
        )}
      )}

      <div className="h-px w-24 sm:w-32 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 rounded-full mb-4 sm:mb-5" />

      {/* Loading state for filtered data */}
      {loadingFilter && (
        <div className="py-8 text-center">
          <div className="inline-flex items-center gap-2 text-cyan-400 text-xs font-cyber uppercase tracking-widest animate-pulse">
            <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            Loading {timeRange} stats...
          </div>
        </div>
      )}

      {/* No data message for filtered views */}
      {!loadingFilter && filteredPlayers && filteredPlayers.length === 0 && (
        <div className="py-10 text-center rounded-xl" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="text-3xl mb-3 opacity-40">📭</div>
          <p className="text-gray-400 font-cyber text-xs tracking-widest uppercase">No match data for this period</p>
          <p className="text-gray-600 text-[11px] mt-1">Games played after this update will appear here</p>
        </div>
      )}
        
      {/* Column headers — hidden on mobile */}
      {!loadingFilter && sorted.length > 0 && (
      <>
      <div className="hidden sm:grid grid-cols-12 gap-2 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.15em] rounded-t-xl mb-1"
        style={{ background: 'rgba(0,217,255,0.05)', borderBottom: '1px solid rgba(0,217,255,0.12)', color: 'rgba(0,217,255,0.5)' }}>
        <div className="col-span-1 text-center">Rank</div>
        <div className="col-span-4 pl-1">Player</div>
        <div className="col-span-2 text-center">Wins</div>
        <div className="col-span-2 text-center">Losses</div>
        <div className="col-span-2 text-center">Rate</div>
        <div className="col-span-1 text-center">GP</div>
        {(isAdmin && canEditPlayers !== false) && <div className="absolute right-4 top-3">Admin</div>}
      </div>

      {/* Rows */}
      <div className="space-y-1.5 sm:space-y-2 w-full overflow-x-hidden p-1">
        {sorted.map((player, idx) => {
          const rank = idx + 1;
          const wr   = calculateWinRate(player.wins, player.losses);
          const gp   = player.wins + player.losses;
          const s    = rowBg(rank);

          return (
            <div key={player.id}
              className="rounded-xl sm:rounded-r-xl transition-all duration-300 overflow-hidden animate-slide-in"
              style={{ background: s.bg, borderLeft: s.border, boxShadow: s.shadow, animationDelay: `${idx * 0.05}s` }}>

              {/* ── Desktop row */}
              <div className="hidden sm:grid grid-cols-12 gap-2 px-4 py-3.5 items-center relative">
                <div className="col-span-1 flex justify-center">{rankDisplay(rank)}</div>
                <div className="col-span-4 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 border"
                    style={{ borderColor: rank <= 3 ? 'rgba(250,204,21,0.3)' : 'rgba(0,217,255,0.25)', boxShadow: rank <= 3 ? '0 0 10px rgba(250,204,21,0.2)' : '0 0 8px rgba(0,217,255,0.1)' }}>
                    {player.avatar
                      ? <img src={player.avatar} alt={player.name} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-sm font-cyber font-black text-white"
                          style={{ background: rank <= 3 ? 'linear-gradient(135deg,#b45309,#78350f)' : 'linear-gradient(135deg,#7c3aed,#0891b2)' }}>
                          {getAvatarInitials(player.name)}
                        </div>
                    }
                  </div>
                  <p className="font-cyber font-bold text-base truncate"
                    style={{ color: rank === 1 ? '#fde68a' : rank === 2 ? '#e2e8f0' : rank === 3 ? '#fdba74' : '#67e8f9' }}>
                    {player.name}
                  </p>
                </div>
                <div className="col-span-2 text-center">
                  <span className="font-cyber font-black text-lg" style={{ color: '#22c55e', textShadow: '0 0 8px rgba(34,197,94,0.5)' }}>{player.wins}</span>
                </div>
                <div className="col-span-2 text-center">
                  <span className="font-cyber font-black text-lg" style={{ color: '#f87171', textShadow: '0 0 8px rgba(248,113,113,0.5)' }}>{player.losses}</span>
                </div>
                <div className="col-span-2 text-center">
                  <div className="inline-block rounded-lg px-2 py-1" style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)' }}>
                    <span className="font-cyber font-bold text-sm" style={{ color: '#a78bfa' }}>{gp > 0 ? `${wr.toFixed(0)}%` : '—'}</span>
                  </div>
                </div>
                <div className="col-span-1 text-center">
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>{gp}</span>
                </div>
                {isAdmin && canEditPlayers !== false && (
                  <div className="absolute right-4 cursor-pointer" onClick={() => onAdminEdit?.(player)}>
                    <span className="text-gray-400 hover:text-cyan-400 transition-smooth p-1 text-base bg-white/5 rounded-lg border border-white/10 shadow-lg">⚙️</span>
                  </div>
                )}
              </div>

              {/* ── Mobile row (compact) */}
              <div className="flex sm:hidden items-center gap-1.5 px-2 py-2.5">
                <div className="w-6 flex-shrink-0 flex justify-center">{rankDisplay(rank)}</div>
                <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0"
                  style={{ border: `1px solid ${rank <= 3 ? 'rgba(250,204,21,0.3)' : 'rgba(0,217,255,0.2)'}` }}>
                  {player.avatar
                    ? <img src={player.avatar} alt={player.name} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-[10px] font-cyber font-black text-white"
                        style={{ background: rank <= 3 ? 'linear-gradient(135deg,#b45309,#78350f)' : 'linear-gradient(135deg,#7c3aed,#0891b2)' }}>
                        {getAvatarInitials(player.name)}
                      </div>
                  }
                </div>
                <div className="flex-1 min-w-0 pr-1">
                  <p className="font-cyber font-bold text-[11px] truncate"
                    style={{ color: rank === 1 ? '#fde68a' : rank <= 3 ? '#fdba74' : '#67e8f9' }}>{player.name}</p>
                  <p className="text-[8px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{gp} games</p>
                </div>
                <div className="flex gap-2 flex-shrink-0 text-right items-center">
                  <div className="w-6">
                    <p className="text-[8px] uppercase" style={{ color: 'rgba(255,255,255,0.3)' }}>W</p>
                    <p className="font-cyber font-black text-xs" style={{ color: '#22c55e' }}>{player.wins}</p>
                  </div>
                  <div className="w-6">
                    <p className="text-[8px] uppercase" style={{ color: 'rgba(255,255,255,0.3)' }}>L</p>
                    <p className="font-cyber font-black text-xs" style={{ color: '#f87171' }}>{player.losses}</p>
                  </div>
                  <div className="w-8 text-center">
                    <p className="text-[8px] uppercase" style={{ color: 'rgba(255,255,255,0.3)' }}>%</p>
                    <p className="font-cyber font-bold text-xs" style={{ color: '#a78bfa' }}>{gp > 0 ? `${wr.toFixed(0)}` : '—'}</p>
                  </div>
                  {isAdmin && canEditPlayers !== false && (
                    <div className="flex items-center pl-1 border-l border-white/10 ml-1">
                      <button onClick={() => onAdminEdit?.(player)}
                        className="text-gray-400 hover:text-cyan-400 bg-white/5 border border-white/10 rounded-md p-1.5 transition-smooth text-xs">
                        ⚙️
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      </>
      )}

      {!loadingFilter && !filteredPlayers && players.length === 0 && (
        <div className="py-12 text-center rounded-xl" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-gray-500 text-sm">No players yet. Add players to start tracking!</p>
        </div>
      )}
    </div>
  );
};
