import { calculateWinRate, getAvatarInitials } from '../utils/imageExport';
import type { Player } from '../types';
import { StreakBadge } from './StreakBadge';

interface ResultCardProps {
  players: Player[];
  winner: Player;
  duration?: number;
}

/* ── Confetti ─────────────────────── */
const CONFETTI_COLORS = ['#00d9ff','#8338ec','#ff006e','#ffbe0b','#06d6a0'];
const ConfettiParticle = ({ index }: { index: number }) => (
  <div style={{
    position: 'absolute',
    left: `${(index * 13.37) % 101}%`,
    top: '-20px',
    width: index % 2 === 0 ? '8px' : '5px',
    height: index % 2 === 0 ? '8px' : '5px',
    backgroundColor: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
    borderRadius: index % 3 === 0 ? '50%' : '2px',
    animation: `confetti-fall ${(3.5 + (index % 5) * 0.4).toFixed(1)}s ${((index * 0.41) % 3).toFixed(2)}s ease-in both`,
  }} />
);

const fmtDur = (ms: number) => `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;

const RANK_META: Record<number, { medal: string; glow: string; nameCls: string; rowBg: string; rowBorder: string }> = {
  1: { medal: '🥇', glow: 'rgba(250,204,21,0.5)',   nameCls: 'text-yellow-300', rowBg: 'rgba(250,204,21,0.08)',  rowBorder: 'rgba(250,204,21,0.25)'  },
  2: { medal: '🥈', glow: 'rgba(148,163,184,0.4)',  nameCls: 'text-slate-200',  rowBg: 'rgba(148,163,184,0.06)', rowBorder: 'rgba(148,163,184,0.2)'  },
  3: { medal: '🥉', glow: 'rgba(249,115,22,0.4)',   nameCls: 'text-orange-300', rowBg: 'rgba(249,115,22,0.07)',  rowBorder: 'rgba(249,115,22,0.2)'   },
};

/* ── Component ─────────────────────── */
export const ResultCard = ({ players, winner, duration }: ResultCardProps) => {
  const winnerShowsStreak = !!winner.winStreakUpdatedAt && (winner.winStreak || 0) >= 3;
  const sorted = [...players].sort((a, b) => {
    const rA = a.wins + a.losses > 0 ? a.wins / (a.wins + a.losses) : 0;
    const rB = b.wins + b.losses > 0 ? b.wins / (b.wins + b.losses) : 0;
    return b.wins - a.wins || rB - rA;
  });

  return (
    <div
      id="result-card"
      className="w-full relative overflow-hidden rounded-3xl"
      style={{
        background: 'linear-gradient(145deg, rgba(0,217,255,0.06) 0%, rgba(8,12,32,0.98) 40%, rgba(131,56,236,0.05) 100%)',
        border: '1px solid rgba(0,217,255,0.2)',
        boxShadow: '0 0 80px rgba(0,217,255,0.12), inset 0 1px 0 rgba(255,255,255,0.06)',
      }}
    >
      {/* Confetti */}
      <div className="confetti-container">
        {Array.from({ length: 24 }, (_, i) => <ConfettiParticle key={i} index={i} />)}
      </div>

      {/* Top shimmer */}
      <div className="absolute top-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(0,217,255,0.8), rgba(131,56,236,0.6), transparent)' }} />

      {/* Ambient blobs */}
      <div className="absolute top-0 left-1/4 w-64 h-64 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(0,217,255,0.07) 0%, transparent 70%)', transform: 'translateY(-40%)' }} />
      <div className="absolute bottom-0 right-1/4 w-48 h-48 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(131,56,236,0.07) 0%, transparent 70%)', transform: 'translateY(40%)' }} />

      <div className="relative p-6">

        {/* ── Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-4"
            style={{ background: 'rgba(0,217,255,0.08)', border: '1px solid rgba(0,217,255,0.2)' }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#00d9ff', boxShadow: '0 0 6px #00d9ff' }} />
            <span className="text-xs font-cyber font-bold tracking-[0.2em] uppercase" style={{ color: '#00d9ff' }}>Match Complete</span>
          </div>
          <div className="text-4xl mb-1 animate-float">🏆</div>
          <h2 className="text-2xl font-cyber font-black tracking-widest text-white">FINAL RESULTS</h2>
        </div>

        {/* ── Winner Hero */}
        <div className="rounded-2xl p-5 mb-5 text-center relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(0,217,255,0.1), rgba(0,217,255,0.02))',
            border: '1px solid rgba(0,217,255,0.25)',
            boxShadow: '0 0 30px rgba(0,217,255,0.1), inset 0 1px 0 rgba(0,217,255,0.15)',
          }}>
          <div className="absolute top-0 left-0 right-0 h-px"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(0,217,255,0.5), transparent)' }} />

          <div className="text-[10px] font-bold tracking-[0.3em] uppercase mb-2" style={{ color: 'rgba(0,217,255,0.6)' }}>🏅 Winner</div>

          <div className="relative inline-block mb-3">
            <div className="w-20 h-20 rounded-2xl overflow-hidden mx-auto"
              style={{ border: '2px solid rgba(0,217,255,0.4)', boxShadow: '0 0 25px rgba(0,217,255,0.3)' }}>
              {winner.avatar
                ? <img src={winner.avatar} alt={winner.name} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, #0891b2, #7c3aed)' }}>
                    <span className="text-2xl font-cyber font-black text-white">{getAvatarInitials(winner.name)}</span>
                  </div>
              }
            </div>
          </div>

          <h3 className="text-xl font-cyber font-black text-white mb-4 tracking-wide">{winner.name}</h3>

          <div className={`grid ${winnerShowsStreak ? 'grid-cols-4' : 'grid-cols-3'} gap-2`}>
            {[
              { label: 'WINS',     value: winner.wins,  color: '#22c55e' },
              { label: 'LOSSES',   value: winner.losses, color: '#f87171' },
              { label: 'WIN RATE', value: `${calculateWinRate(winner.wins, winner.losses).toFixed(0)}%`, color: '#a78bfa' },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl py-2.5 px-2"
                style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-[9px] font-bold tracking-[0.2em] uppercase mb-1"
                  style={{ color: 'rgba(255,255,255,0.35)' }}>{label}</p>
                <p className="text-xl font-cyber font-black" style={{ color }}>{value}</p>
              </div>
            ))}
            {winnerShowsStreak && (
              <div className="rounded-xl py-2.5 px-2"
                style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-[9px] font-bold tracking-[0.2em] uppercase mb-1"
                  style={{ color: 'rgba(255,255,255,0.35)' }}>STREAK</p>
                <StreakBadge value={winner.winStreak || 0} earnedAt={winner.winStreakUpdatedAt} size="sm" />
              </div>
            )}
          </div>
        </div>

        {/* ── Full Standings Table (ALL players) */}
        {sorted.length > 1 && (
          <div className="rounded-2xl overflow-hidden"
            style={{ border: '1px solid rgba(0,217,255,0.12)' }}>

            {/* Table header */}
            <div className="grid grid-cols-12 gap-1 px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.15em]"
              style={{ background: 'rgba(0,217,255,0.06)', borderBottom: '1px solid rgba(0,217,255,0.1)', color: 'rgba(0,217,255,0.5)' }}>
              <div className="col-span-1 text-center">#</div>
              <div className="col-span-4">Player</div>
              <div className="col-span-1 text-center">Wins</div>
              <div className="col-span-1 text-center">Losses</div>
              <div className="col-span-2 text-center">Streak</div>
              <div className="col-span-2 text-center">Rate</div>
              <div className="col-span-1 text-center">GP</div>
            </div>

            {/* Player rows */}
            {sorted.map((player, idx) => {
              const rank  = idx + 1;
              const meta  = RANK_META[rank];
              const wr    = calculateWinRate(player.wins, player.losses);
              const gp    = player.wins + player.losses;

              return (
                <div
                  key={player.id}
                  className="grid grid-cols-12 gap-1 px-4 py-3 items-center"
                  style={{
                    background: meta ? meta.rowBg : (idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent'),
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    borderLeft: meta ? `3px solid ${meta.rowBorder}` : '3px solid transparent',
                  }}
                >
                  {/* Rank */}
                  <div className="col-span-1 text-center">
                    {meta
                      ? <span className="text-lg">{meta.medal}</span>
                      : <span className="font-cyber font-bold text-xs" style={{ color: 'rgba(0,217,255,0.3)' }}>#{rank}</span>
                    }
                  </div>

                  {/* Avatar + Name */}
                  <div className="col-span-4 flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0"
                      style={{ border: `1px solid ${meta ? meta.rowBorder : 'rgba(255,255,255,0.08)'}` }}>
                      {player.avatar
                        ? <img src={player.avatar} alt={player.name} className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center text-[10px] font-cyber font-black text-white"
                            style={{ background: 'linear-gradient(135deg, #7c3aed, #0891b2)' }}>
                            {getAvatarInitials(player.name)}
                          </div>
                      }
                    </div>
                    <span
                      className="font-cyber font-bold text-xs truncate"
                      style={{ color: meta ? meta.nameCls as string : 'rgba(255,255,255,0.65)' }}
                    >
                      {player.name}
                    </span>
                  </div>

                  {/* Wins */}
                  <div className="col-span-1 text-center">
                    <span className="font-cyber font-black text-sm" style={{ color: '#22c55e' }}>{player.wins}</span>
                  </div>

                  {/* Losses */}
                  <div className="col-span-1 text-center">
                    <span className="font-cyber font-black text-sm" style={{ color: '#f87171' }}>{player.losses}</span>
                  </div>

                  {/* Streak */}
                  <div className="col-span-2 flex justify-center">
                    <StreakBadge value={player.winStreak || 0} earnedAt={player.winStreakUpdatedAt} size="xs" />
                  </div>

                  {/* Win Rate */}
                  <div className="col-span-2 text-center">
                    <span className="font-cyber font-bold text-xs" style={{ color: '#a78bfa' }}>
                      {gp > 0 ? `${wr.toFixed(0)}%` : '—'}
                    </span>
                  </div>

                  {/* Games Played */}
                  <div className="col-span-1 text-center">
                    <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>{gp}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Footer */}
        <div className="flex items-center justify-between mt-5 pt-4"
          style={{ borderTop: '1px solid rgba(0,217,255,0.08)' }}>
          <p className="text-xs font-cyber" style={{ color: 'rgba(0,217,255,0.35)' }}>⚡ CyberTrack</p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
            {duration && duration > 0 ? `${fmtDur(duration)}  ·  ` : ''}
            {new Date().toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Bottom shimmer */}
      <div className="absolute bottom-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(131,56,236,0.6), rgba(0,217,255,0.4), transparent)' }} />
    </div>
  );
};
