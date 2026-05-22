import { useState } from 'react';
import type { User } from 'firebase/auth';
import { AVATARS, AVATAR_CATEGORIES } from '../data/avatars';
import { getUnlockedAchievements, ACHIEVEMENTS } from '../data/achievements';
import type { Player } from '../types';

interface ProfileModalProps {
  user: User;
  globalPlayers: Player[];
  isAdmin: boolean;
  remoteBetaEmails: string[];
  globalConfig: any;
  onUpdateBetaEmails: (emails: string[]) => void;
  onSetGlobalConfig: (updates: any) => Promise<void>;
  onClose: () => void;
  onShowBackup?: () => void;
  onAvatarChange: (url: string) => void;
  currentAvatar?: string;
}

export const ProfileModal = ({ 
  user, 
  globalPlayers, 
  isAdmin,
  remoteBetaEmails,
  globalConfig,
  onUpdateBetaEmails,
  onSetGlobalConfig,
  onClose,
  onShowBackup,
  onAvatarChange, 
  currentAvatar 
}: ProfileModalProps) => {
  const [tab, setTab] = useState<'profile' | 'avatars' | 'achievements' | 'admin'>('profile');
  const [selectedCategory, setSelectedCategory] = useState(AVATAR_CATEGORIES[0]);
  const [newBetaEmail, setNewBetaEmail] = useState('');

  // Find the logged-in user's global stats
  const myStats = globalPlayers.find(p =>
    p.name.toLowerCase() === (user.displayName || '').toLowerCase() || p.id === user.uid
  );
  const wins = myStats?.wins || 0;
  const losses = myStats?.losses || 0;
  const gp = wins + losses;
  const winRate = gp > 0 ? ((wins / gp) * 100).toFixed(1) : '0';
  const unlocked = getUnlockedAchievements(wins, losses);

  const handleAddTester = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = newBetaEmail.toLowerCase().trim();
    if (!cleanEmail || remoteBetaEmails.includes(cleanEmail)) return;
    onUpdateBetaEmails([...remoteBetaEmails, cleanEmail]);
    setNewBetaEmail('');
  };

  const handleRemoveTester = (emailToRemove: string) => {
    onUpdateBetaEmails(remoteBetaEmails.filter(e => e !== emailToRemove));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-6 bg-black/90 backdrop-blur-xl animate-fade-in">
      <div className="glass-dark sm:rounded-3xl w-full h-full sm:h-auto sm:max-h-[90vh] max-w-5xl overflow-hidden flex flex-col sm:flex-row shadow-[0_0_80px_rgba(0,217,255,0.15)] border border-white/5 relative">
        
        {/* Close Button Mobile/Desktop */}
        <button onClick={onClose} className="absolute top-4 right-5 sm:top-6 sm:right-6 text-gray-400 hover:text-white transition-smooth text-2xl z-50">
          ✕
        </button>

        {/* Left Sidebar */}
        <div className="sm:w-72 bg-black/40 border-b sm:border-b-0 sm:border-r border-white/10 flex flex-col flex-shrink-0 pt-10 sm:pt-8">
          
          <div className="px-6 pb-6 flex items-center gap-4 border-b border-white/5">
            <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-cyan-500 shadow-[0_0_20px_rgba(0,217,255,0.3)] flex-shrink-0">
              {currentAvatar 
                ? <img src={currentAvatar} alt="avatar" className="w-full h-full object-cover" />
                : (user.photoURL 
                    ? <img src={user.photoURL} alt="avatar" className="w-full h-full object-cover" />
                    : <div className="w-full h-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-xl font-bold">{user.displayName?.[0] || 'U'}</div>
                  )
              }
            </div>
            <div className="min-w-0">
              <h2 className="font-cyber font-black text-lg text-white truncate">{user.displayName || 'Player'}</h2>
              <p className="text-cyan-400 text-xs truncate">{user.email}</p>
            </div>
          </div>

          <div className="flex sm:flex-col sm:p-4 overflow-x-auto custom-scrollbar whitespace-nowrap bg-black/20 sm:bg-transparent">
            {(['profile', 'avatars', 'achievements'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 sm:px-5 py-4 sm:py-3 text-[11px] sm:text-xs font-cyber font-bold uppercase tracking-widest transition-smooth flex-shrink-0 text-left sm:rounded-xl relative ${
                  tab === t ? 'text-white' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                }`}>
                {tab === t && <div className="absolute left-0 bottom-0 sm:top-1/2 sm:-translate-y-1/2 w-full sm:w-1 h-1 sm:h-6 bg-cyan-400 sm:rounded-r-full shadow-[0_0_10px_rgba(0,217,255,0.8)]" />}
                {t === 'profile' ? '📊 Dashboard' : t === 'avatars' ? '🎭 Avatar Gallery' : '🏅 Achievements'}
              </button>
            ))}
            
            {isAdmin && (
              <>
                <div className="mx-4 my-2 border-t border-white/10 hidden sm:block"></div>
                <button onClick={() => setTab('admin')}
                  className={`px-4 sm:px-5 py-4 sm:py-3 text-[11px] sm:text-xs font-cyber font-bold uppercase tracking-widest transition-smooth flex-shrink-0 text-left sm:rounded-xl relative ${
                    tab === 'admin' ? 'text-yellow-400' : 'text-yellow-600 hover:text-yellow-500 hover:bg-yellow-500/10'
                  }`}>
                  {tab === 'admin' && <div className="absolute left-0 bottom-0 sm:top-1/2 sm:-translate-y-1/2 w-full sm:w-1 h-1 sm:h-6 bg-yellow-400 sm:rounded-r-full shadow-[0_0_10px_rgba(234,179,8,0.8)]" />}
                  ⚙️ Beta Testing
                </button>
              </>
            )}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto bg-black/20 relative">
          {tab === 'profile' && (
            <div className="p-5 sm:p-10 max-w-3xl mx-auto animate-fade-in">
              <h1 className="font-cyber font-black text-2xl sm:text-3xl mb-6 sm:mb-8 tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">Career Stats</h1>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
                <div className="bg-black/40 border border-white/5 rounded-2xl p-4 sm:p-6 text-center shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
                  <p className="text-green-400 font-cyber font-black text-2xl sm:text-4xl mb-1">{wins}</p>
                  <p className="text-gray-500 text-[9px] sm:text-[10px] uppercase font-bold tracking-widest">Total Wins</p>
                </div>
                <div className="bg-black/40 border border-white/5 rounded-2xl p-4 sm:p-6 text-center shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
                  <p className="text-red-400 font-cyber font-black text-2xl sm:text-4xl mb-1">{losses}</p>
                  <p className="text-gray-500 text-[9px] sm:text-[10px] uppercase font-bold tracking-widest">Total Losses</p>
                </div>
                <div className="bg-black/40 border border-white/5 rounded-2xl p-4 sm:p-6 text-center shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
                  <p className="text-purple-400 font-cyber font-black text-2xl sm:text-4xl mb-1">{winRate}<span className="text-xs sm:text-lg">%</span></p>
                  <p className="text-gray-500 text-[9px] sm:text-[10px] uppercase font-bold tracking-widest">Win Rate</p>
                </div>
                <div className="bg-black/40 border border-white/5 rounded-2xl p-4 sm:p-6 text-center shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
                  <p className="text-cyan-400 font-cyber font-black text-2xl sm:text-4xl mb-1">{gp}</p>
                  <p className="text-gray-500 text-[9px] sm:text-[10px] uppercase font-bold tracking-widest">Games Played</p>
                </div>
              </div>

              <div className="bg-black/40 border border-white/10 rounded-2xl p-5 sm:p-8">
                <div className="flex justify-between items-end mb-4">
                  <div>
                    <h2 className="font-cyber font-bold text-xl text-white">Trophy Case</h2>
                    <p className="text-gray-500 text-xs mt-1">Milestones Unlocked</p>
                  </div>
                  <p className="text-purple-400 font-bold text-sm bg-purple-500/10 px-3 py-1 rounded-full border border-purple-500/20">{unlocked.length} / {ACHIEVEMENTS.length}</p>
                </div>
                
                <div className="w-full bg-black/60 rounded-full h-3 mb-6 overflow-hidden border border-white/5">
                  <div className="h-full bg-gradient-to-r from-purple-500 to-cyan-400 rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${(unlocked.length / ACHIEVEMENTS.length) * 100}%` }} />
                </div>

                <div className="flex gap-3 flex-wrap">
                  {unlocked.map(a => (
                    <div key={a.id} className="w-12 h-12 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-2xl hover:scale-110 transition-smooth cursor-help" title={`${a.title}: ${a.description}`}>
                      {a.icon}
                    </div>
                  ))}
                  {unlocked.length === 0 && (
                    <p className="text-gray-600 text-sm italic py-4">No trophies unlocked yet. Keep playing!</p>
                  )}
                </div>
              </div>

              {/* Become a Certified Player Section */}
              {(() => {
                const wrNum = gp > 0 ? (wins / gp) * 100 : 0;
                const likes = myStats?.likes || 0;
                const dislikes = myStats?.dislikes || 0;
                const rating = Math.max(0, (likes - dislikes) * 0.2);
                const isCertified = wrNum >= 85 && rating >= 75;

                return (
                  <div className="bg-gradient-to-br from-purple-950/20 via-black/40 to-cyan-950/20 border border-white/10 rounded-2xl p-5 sm:p-8 mt-6 relative overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
                    {/* Subtle decorative glow */}
                    <div className="absolute -top-12 -right-12 w-32 h-32 bg-yellow-500/10 rounded-full blur-2xl pointer-events-none" />

                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5">
                      <div>
                        <h2 className="font-cyber font-bold text-xl text-white flex items-center gap-2">
                          <span>🎖️</span> Become a Certified Player
                        </h2>
                        <p className="text-gray-400 text-xs mt-1">Unlock the gold verified badge by meeting elite benchmarks.</p>
                      </div>
                      {isCertified ? (
                        <span className="flex-shrink-0 bg-yellow-500/20 border border-yellow-500/50 text-yellow-400 px-3 py-1 rounded-full text-xs font-cyber font-bold uppercase tracking-wider animate-pulse flex items-center gap-1.5 shadow-[0_0_15px_rgba(234,179,8,0.3)]">
                          <span>🏆</span> Certified
                        </span>
                      ) : (
                        <span className="flex-shrink-0 bg-white/5 border border-white/10 text-gray-400 px-3 py-1 rounded-full text-xs font-cyber font-bold uppercase tracking-wider">
                          In Progress
                        </span>
                      )}
                    </div>

                    <div className="space-y-4">
                      {/* Requirement 1: Win Rate */}
                      <div>
                        <div className="flex justify-between items-center text-xs font-cyber font-bold mb-1.5">
                          <span className="text-gray-300">Win Rate Requirement (≥85%)</span>
                          <span className={wrNum >= 85 ? 'text-green-400' : 'text-cyan-400'}>
                            {wrNum.toFixed(1)}% / 85.0%
                          </span>
                        </div>
                        <div className="w-full bg-black/60 rounded-full h-3.5 p-0.5 overflow-hidden border border-white/5">
                          <div
                            className={`h-full rounded-full transition-all duration-1000 ease-out ${
                              wrNum >= 85
                                ? 'bg-gradient-to-r from-green-500 to-emerald-400 shadow-[0_0_8px_rgba(34,197,94,0.4)]'
                                : 'bg-gradient-to-r from-cyan-500 to-blue-500'
                            }`}
                            style={{ width: `${Math.min(100, (wrNum / 85) * 100)}%` }}
                          />
                        </div>
                      </div>

                      {/* Requirement 2: Voting Rating */}
                      <div>
                        <div className="flex justify-between items-center text-xs font-cyber font-bold mb-1.5">
                          <span className="text-gray-300">Peer Approval Rating (≥75%)</span>
                          <span className={rating >= 75 ? 'text-green-400' : 'text-purple-400'}>
                            {rating.toFixed(1)}% / 75.0%
                          </span>
                        </div>
                        <div className="w-full bg-black/60 rounded-full h-3.5 p-0.5 overflow-hidden border border-white/5">
                          <div
                            className={`h-full rounded-full transition-all duration-1000 ease-out ${
                              rating >= 75
                                ? 'bg-gradient-to-r from-green-500 to-emerald-400 shadow-[0_0_8px_rgba(34,197,94,0.4)]'
                                : 'bg-gradient-to-r from-purple-500 to-pink-500'
                            }`}
                            style={{ width: `${Math.min(100, (rating / 75) * 100)}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-gray-500 mt-1 pl-1">
                          <span>Likes: {likes} • Dislikes: {dislikes}</span>
                          <span>Formula: (Likes - Dislikes) × 0.2%</span>
                        </div>
                      </div>

                      {/* Status Box */}
                      {isCertified ? (
                        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mt-2 flex items-center gap-4 animate-scale-up">
                          <div className="w-12 h-12 rounded-full bg-yellow-500/20 text-yellow-400 flex items-center justify-center text-2xl flex-shrink-0 shadow-[0_0_15px_rgba(234,179,8,0.4)] animate-pulse">
                            🏆
                          </div>
                          <div className="min-w-0">
                            <p className="text-yellow-400 font-cyber font-bold text-sm uppercase tracking-wider">Certified Global Pro</p>
                            <p className="text-gray-300 text-xs mt-0.5 leading-relaxed">
                              Outstanding play! You have earned your prestigious Certified Player badge on the leaderboard. Play well to maintain this status.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-white/5 border border-white/5 rounded-xl p-3 text-center text-xs text-gray-400 font-cyber mt-2">
                          💡 <i>Tip: Earn Likes by playing wisely and demonstrating superior gameplay during active games!</i>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {tab === 'avatars' && (
            <div className="flex flex-col h-full animate-fade-in">
              <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-xl border-b border-white/5 p-4 sm:px-8">
                <h1 className="font-cyber font-black text-xl sm:text-2xl mb-4 text-white">Avatar Selection</h1>
                <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                  {AVATAR_CATEGORIES.map(cat => (
                    <button key={cat} onClick={() => setSelectedCategory(cat)}
                      className={`px-4 py-2 rounded-full text-xs font-bold transition-smooth flex-shrink-0 border ${
                        selectedCategory === cat
                          ? 'bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.4)]'
                          : 'bg-black/50 text-gray-400 border-white/10 hover:bg-white/10 hover:text-white'
                      }`}>
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4 sm:p-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6 pb-20">
                {AVATARS.filter(a => a.category === selectedCategory).map(avatar => (
                  <button key={avatar.id}
                    onClick={() => onAvatarChange(avatar.url)}
                    className={`group relative aspect-square rounded-2xl overflow-hidden transition-all duration-300 ${
                      currentAvatar === avatar.url
                        ? 'ring-4 ring-cyan-400 shadow-[0_0_30px_rgba(0,217,255,0.4)] scale-[0.98]'
                        : 'border border-white/10 hover:border-white/40 hover:shadow-2xl hover:-translate-y-1'
                    }`}>
                    <img src={avatar.url} alt={avatar.name} loading="lazy" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent pointer-events-none opacity-80 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute bottom-3 left-3 right-3 text-left">
                      <p className="text-white font-bold text-sm tracking-wide shadow-black text-shadow">{avatar.name}</p>
                    </div>
                    {currentAvatar === avatar.url && (
                      <div className="absolute top-3 right-3 w-6 h-6 bg-cyan-400 rounded-full flex items-center justify-center shadow-lg">
                        <svg className="w-4 h-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === 'achievements' && (
            <div className="p-5 sm:p-10 max-w-4xl mx-auto animate-fade-in">
              <h1 className="font-cyber font-black text-2xl sm:text-3xl mb-6 sm:mb-8 tracking-wider text-white">Global Achievements</h1>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 pb-20">
                {ACHIEVEMENTS.map(ach => {
                  const isUnlocked = unlocked.some(u => u.id === ach.id);
                  return (
                    <div key={ach.id}
                      className={`flex items-center gap-4 p-5 rounded-2xl border transition-smooth relative overflow-hidden ${
                        isUnlocked
                          ? 'bg-gradient-to-br from-black/60 to-purple-900/20 border-purple-500/30 shadow-[0_0_20px_rgba(168,85,247,0.1)]'
                          : 'bg-black/40 border-white/5 opacity-60 grayscale'
                      }`}>
                      {isUnlocked && <div className="absolute top-0 right-0 w-16 h-16 bg-green-500/10 blur-xl rounded-full" />}
                      <div className={`w-14 h-14 rounded-full flex flex-shrink-0 items-center justify-center text-3xl bg-black border ${isUnlocked ? 'border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.4)]' : 'border-white/10'}`}>
                        {ach.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-cyber font-bold text-lg mb-0.5 ${isUnlocked ? 'text-white' : 'text-gray-400'}`}>
                          {ach.title}
                        </p>
                        <p className="text-gray-500 text-xs">
                          {ach.description}
                        </p>
                      </div>
                      {isUnlocked && <span className="text-green-400 flex-shrink-0 font-black text-xl">✓</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'admin' && isAdmin && (
            <div className="p-6 sm:p-10 max-w-3xl mx-auto animate-fade-in pb-20">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <div>
                  <h1 className="font-cyber font-black text-2xl sm:text-3xl mb-1 text-yellow-400">Beta Testing Core</h1>
                  <p className="text-gray-400 text-sm">Manage test access and publish features globally.</p>
                </div>
                
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      onShowBackup?.();
                      onClose?.();
                    }}
                    className="px-5 py-3 bg-[#0b0f2a] border border-[#00d9ff]/30 text-[#00d9ff] font-cyber font-bold rounded-xl transition-all shadow-lg hover:bg-[#00d9ff]/10 hover:shadow-[0_0_20px_rgba(0,217,255,0.4)] active:scale-95 flex-shrink-0">
                    💾 System Backups
                  </button>
                  <button
                    onClick={() => onSetGlobalConfig({ isPublicRelease: !globalConfig?.isPublicRelease })}
                    className={`px-5 py-3 font-cyber font-bold rounded-xl transition-all shadow-lg active:scale-95 flex-shrink-0 ${
                      globalConfig?.isPublicRelease 
                        ? 'bg-red-500/20 text-red-500 border border-red-500/50 hover:bg-red-500 hover:text-white' 
                        : 'bg-green-500 text-black border border-green-400 shadow-[0_0_20px_rgba(34,197,94,0.4)] hover:bg-green-400'
                    }`}>
                    {globalConfig?.isPublicRelease ? '🚫 Revert Publish' : '🚀 Publish To Main'}
                  </button>
                </div>
              </div>
              
              <div className="glass-dark border border-white/10 rounded-2xl p-6 mb-8">
                <h3 className="font-bold text-white mb-4">Invite New Tester</h3>
                <form onSubmit={handleAddTester} className="flex gap-3">
                  <input
                    type="email"
                    value={newBetaEmail}
                    onChange={(e) => setNewBetaEmail(e.target.value)}
                    placeholder="Enter Google Email Address..."
                    className="flex-1 bg-black/50 border border-white/20 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-yellow-400 focus:shadow-[0_0_15px_rgba(234,179,8,0.3)] transition-all"
                    required
                  />
                  <button type="submit"
                    className="px-6 py-3 bg-yellow-500 text-black font-cyber font-bold rounded-xl hover:bg-yellow-400 hover:shadow-[0_0_20px_rgba(234,179,8,0.5)] transition-all active:scale-95">
                    Invite →
                  </button>
                </form>
              </div>

              <div>
                <h3 className="font-bold text-white mb-4 flex items-center justify-between">
                  <span>Active Invited Testers ({remoteBetaEmails.length})</span>
                  <span className="text-xs text-gray-500 font-normal">Remote Firestore DB</span>
                </h3>
                
                <div className="bg-black/40 border border-white/5 rounded-2xl overflow-hidden divide-y divide-white/5">
                  {remoteBetaEmails.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 text-sm">No remote testers invited yet.</div>
                  ) : (
                    remoteBetaEmails.map(email => (
                      <div key={email} className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors group">
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs uppercase">{email[0]}</span>
                          <span className="text-gray-300 text-sm font-medium">{email}</span>
                        </div>
                        <button onClick={() => handleRemoveTester(email)}
                          className="text-[10px] font-bold uppercase tracking-wider text-red-500 px-3 py-1.5 rounded-lg border border-red-500/30 opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-white transition-all">
                          Remove
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
