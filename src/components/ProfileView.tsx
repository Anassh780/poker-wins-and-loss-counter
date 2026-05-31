import { useState, useEffect } from 'react';
import type { User } from 'firebase/auth';
import { AVATARS, AVATAR_CATEGORIES } from '../data/avatars';
import { getUnlockedAchievements, ACHIEVEMENTS } from '../data/achievements';
import { RecoveryPanel } from './RecoveryPanel';
import { AdminManagement } from './AdminManagement';
import { uploadAvatar, db } from '../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import type { AdminPermissions } from './AdminManagement';

import type { Player } from '../types';

interface ProfileViewProps {
  user: User;
  globalPlayers: Player[];
  isAdmin: boolean;
  isMainAdmin: boolean;
  adminPermissions: Record<string, AdminPermissions>;
  onSaveAdminPermissions: (perms: Record<string, AdminPermissions>) => Promise<void>;
  hasPermission: (feature: keyof AdminPermissions) => boolean;
  mainAdminEmail: string;
  remoteBetaEmails: string[];
  globalConfig: any;
  onUpdateBetaEmails: (emails: string[]) => void;
  onSetGlobalConfig: (updates: any) => Promise<void>;
  onAvatarChange: (url: string) => void;
  currentAvatar?: string;
  activeUsersColl: any;
  isTestingMode: boolean;
}

export const ProfileView = ({
  user,
  globalPlayers,
  isAdmin,
  isMainAdmin,
  adminPermissions,
  onSaveAdminPermissions,
  hasPermission,
  mainAdminEmail,
  remoteBetaEmails,
  globalConfig,
  onUpdateBetaEmails,
  onSetGlobalConfig,
  onAvatarChange,
  currentAvatar,
  activeUsersColl,
  isTestingMode,
}: ProfileViewProps) => {
  const [tab, setTab] = useState<'profile' | 'avatars' | 'achievements' | 'arcade' | 'admin' | 'manage_admins'>('profile');
  const [selectedCategory, setSelectedCategory] = useState(AVATAR_CATEGORIES[0]);
  const [newBetaEmail, setNewBetaEmail] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [receivedVotes, setReceivedVotes] = useState<{
    id: string;
    voterName: string;
    voterAvatar: string;
    voteType: 'like' | 'dislike';
    timestamp: number;
  }[]>([]);
  const [loadingVotes, setLoadingVotes] = useState(true);

  const handleCustomUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploading(true);
      const url = await uploadAvatar(file, user.uid);
      await onAvatarChange(url);
      alert('✅ Success! Your profile picture was uploaded and synced to the Leaderboard.');
    } catch (err) {
      console.error(err);
      alert('❌ Failed to upload image. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const myStats = globalPlayers.find(
    (p) => p.name.toLowerCase() === (user.displayName || '').toLowerCase() || p.id === user.uid
  );
  const wins = myStats?.wins || 0;
  const losses = myStats?.losses || 0;
  const gp = wins + losses;
  const winRate = gp > 0 ? ((wins / gp) * 100).toFixed(1) : '0';
  const unlocked = getUnlockedAchievements(wins, losses);

  useEffect(() => {
    const targetId = myStats?.id || user.uid;
    const votesCollName = isTestingMode ? 'votes_beta' : 'votes';
    const q = query(
      collection(db, votesCollName),
      where('targetPlayerId', '==', targetId)
    );

    const unsub = onSnapshot(q, (snap) => {
      const list: any[] = [];
      snap.forEach((docSnap) => {
        list.push(docSnap.data());
      });
      // Sort by timestamp descending
      list.sort((a, b) => b.timestamp - a.timestamp);
      setReceivedVotes(list);
      setLoadingVotes(false);
    }, (err) => {
      console.warn("Failed to load received votes:", err);
      setLoadingVotes(false);
    });

    return () => unsub();
  }, [user.uid, myStats?.id, isTestingMode]);

  const handleAddTester = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = newBetaEmail.toLowerCase().trim();
    if (!cleanEmail || remoteBetaEmails.includes(cleanEmail)) return;
    onUpdateBetaEmails([...remoteBetaEmails, cleanEmail]);
    setNewBetaEmail('');
  };

  const handleRemoveTester = (emailToRemove: string) => {
    onUpdateBetaEmails(remoteBetaEmails.filter((e) => e !== emailToRemove));
  };

  const tabs: { key: typeof tab; icon: string; label: string; adminOnly?: boolean; mainOnly?: boolean }[] = [
    { key: 'profile', icon: '📊', label: 'Dashboard' },
    { key: 'avatars', icon: '🎭', label: 'Avatar Gallery' },
    { key: 'achievements', icon: '🏅', label: 'Achievements' },
    { key: 'arcade', icon: '🎮', label: 'Arcade' },
    ...(isAdmin ? [{ key: 'admin' as const, icon: '⚙️', label: 'Admin Panel', adminOnly: true }] : []),
    ...(isMainAdmin ? [{ key: 'manage_admins' as const, icon: '👑', label: 'Manage Admins', mainOnly: true }] : []),
  ];

  return (
    <div className="w-full flex flex-col lg:flex-row min-h-[calc(100vh-120px)] animate-fade-in">
      {/* ─── Left Sidebar ─── */}
      <div
        className="lg:w-72 flex-shrink-0 border-b lg:border-b-0 lg:border-r border-white/10"
        style={{ background: 'rgba(0,0,0,0.4)' }}
      >
        {/* User Identity Card */}
        <div className="px-6 py-6 flex items-center gap-4 border-b border-white/5">
          <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-cyan-500 shadow-[0_0_20px_rgba(0,217,255,0.3)] flex-shrink-0">
            {currentAvatar ? (
              <img src={currentAvatar} alt="avatar" className="w-full h-full object-cover" />
            ) : user.photoURL ? (
              <img src={user.photoURL} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-xl font-bold">
                {user.displayName?.[0] || 'U'}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <h2 className="font-cyber font-black text-lg text-white truncate">
              {user.displayName || 'Player'}
            </h2>
            <p className="text-cyan-400 text-xs truncate">{user.email}</p>
            <div className="flex gap-2 mt-1.5">
              <span className="text-[9px] bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 px-2 py-0.5 rounded-full font-bold uppercase">
                LVL {Math.floor(gp / 5) + 1}
              </span>
              {isMainAdmin && (
                <span className="text-[9px] bg-gradient-to-r from-yellow-500/15 to-orange-500/15 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded-full font-bold uppercase">
                  👑 Main Admin
                </span>
              )}
              {isAdmin && !isMainAdmin && (
                <span className="text-[9px] bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded-full font-bold uppercase">
                  Admin
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex lg:flex-col overflow-x-auto lg:overflow-x-visible custom-scrollbar whitespace-nowrap bg-black/20 lg:bg-transparent lg:p-3">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 lg:px-5 py-4 lg:py-3.5 text-[11px] lg:text-xs font-cyber font-bold uppercase tracking-widest transition-smooth flex-shrink-0 text-left lg:rounded-xl relative ${
                tab === t.key
                  ? t.adminOnly || t.mainOnly
                    ? 'text-yellow-400 bg-yellow-500/10'
                    : 'text-white bg-cyan-500/10'
                  : t.adminOnly || t.mainOnly
                  ? 'text-yellow-600 hover:text-yellow-500 hover:bg-yellow-500/5'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
              }`}
            >
              {tab === t.key && (
                <div
                  className={`absolute left-0 bottom-0 lg:top-1/2 lg:-translate-y-1/2 w-full lg:w-1 h-1 lg:h-6 ${
                    t.adminOnly || t.mainOnly ? 'bg-yellow-400' : 'bg-cyan-400'
                  } lg:rounded-r-full`}
                  style={{ boxShadow: `0 0 10px ${t.adminOnly || t.mainOnly ? 'rgba(234,179,8,0.8)' : 'rgba(0,217,255,0.8)'}` }}
                />
              )}
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Main Content ─── */}
      <div className="flex-1 overflow-y-auto">
        {/* ═══ Dashboard Tab ═══ */}
        {tab === 'profile' && (
          <div className="p-5 sm:p-10 max-w-3xl mx-auto animate-fade-in">
            <h1 className="font-cyber font-black text-2xl sm:text-3xl mb-6 sm:mb-8 tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">
              Career Stats
            </h1>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
              {[
                { value: wins, label: 'Total Wins', color: 'text-green-400' },
                { value: losses, label: 'Total Losses', color: 'text-red-400' },
                {
                  value: (
                    <>
                      {winRate}
                      <span className="text-xs sm:text-lg">%</span>
                    </>
                  ),
                  label: 'Win Rate',
                  color: 'text-purple-400',
                },
                { value: gp, label: 'Games Played', color: 'text-cyan-400' },
              ].map(({ value, label, color }) => (
                <div
                  key={label}
                  className="bg-black/40 border border-white/5 rounded-2xl p-4 sm:p-6 text-center shadow-[0_4px_20px_rgba(0,0,0,0.5)] hover:border-white/15 transition-smooth"
                >
                  <p className={`${color} font-cyber font-black text-2xl sm:text-4xl mb-1`}>{value}</p>
                  <p className="text-gray-500 text-[9px] sm:text-[10px] uppercase font-bold tracking-widest">{label}</p>
                </div>
              ))}
            </div>

            {/* Trophy Case */}
            <div className="bg-black/40 border border-white/10 rounded-2xl p-5 sm:p-8">
              <div className="flex justify-between items-end mb-4">
                <div>
                  <h2 className="font-cyber font-bold text-xl text-white">Trophy Case</h2>
                  <p className="text-gray-500 text-xs mt-1">Milestones Unlocked</p>
                </div>
                <p className="text-purple-400 font-bold text-sm bg-purple-500/10 px-3 py-1 rounded-full border border-purple-500/20">
                  {unlocked.length} / {ACHIEVEMENTS.length}
                </p>
              </div>

              <div className="w-full bg-black/60 rounded-full h-3 mb-6 overflow-hidden border border-white/5">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-cyan-400 rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${(unlocked.length / ACHIEVEMENTS.length) * 100}%` }}
                />
              </div>

              <div className="flex gap-3 flex-wrap">
                {unlocked.map((a) => (
                  <div
                    key={a.id}
                    className="w-12 h-12 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-2xl hover:scale-110 transition-smooth cursor-help"
                    title={`${a.title}: ${a.description}`}
                  >
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

                    {/* Peer Votes History Details */}
                    <div className="mt-6 border-t border-white/5 pt-4">
                      <h4 className="text-xs font-cyber font-bold uppercase text-purple-300 mb-3 tracking-wider">
                        Peer Votes Breakdown ({receivedVotes.length})
                      </h4>
                      {loadingVotes ? (
                        <p className="text-[10px] text-gray-500 font-cyber animate-pulse">Loading voters detail...</p>
                      ) : receivedVotes.length === 0 ? (
                        <p className="text-[10px] text-gray-500 italic">No votes received yet. Get certified by performing in active games!</p>
                      ) : (
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                          {receivedVotes.map((vote) => (
                            <div key={vote.id} className="flex items-center justify-between bg-black/35 border border-white/5 rounded-xl p-2.5 hover:border-white/10 transition-all">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-7 h-7 rounded-full overflow-hidden border border-white/10 flex-shrink-0">
                                  {vote.voterAvatar ? (
                                    <img src={vote.voterAvatar} alt={vote.voterName} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center text-[10px] font-bold text-white">
                                      {vote.voterName.charAt(0).toUpperCase()}
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold text-white truncate">{vote.voterName}</p>
                                  <p className="text-[8px] text-gray-500">{new Date(vote.timestamp).toLocaleString()}</p>
                                </div>
                              </div>
                              <span className={`text-[10px] font-cyber font-bold px-2 py-0.5 rounded-full ${
                                vote.voteType === 'like'
                                  ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                                  : 'bg-red-500/10 border border-red-500/20 text-red-400'
                              }`}>
                                {vote.voteType === 'like' ? '👍 LIKE' : '👎 DISLIKE'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ═══ Avatars Tab ═══ */}
        {tab === 'avatars' && (
          <div className="flex flex-col h-full animate-fade-in">
            <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-xl border-b border-white/5 p-4 sm:px-8">
              <h1 className="font-cyber font-black text-xl sm:text-2xl mb-4 text-white">Avatar Selection</h1>
              <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                {AVATAR_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-4 py-2 rounded-full text-xs font-bold transition-smooth flex-shrink-0 border ${
                      selectedCategory === cat
                        ? 'bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.4)]'
                        : 'bg-black/50 text-gray-400 border-white/10 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 sm:p-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6 pb-20">
              {/* Custom Upload Tile */}
              <div className="relative aspect-square rounded-2xl overflow-hidden border border-dashed border-white/30 hover:border-cyan-400 bg-black/40 flex flex-col items-center justify-center transition-colors group">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleCustomUpload}
                  disabled={isUploading}
                  className="absolute inset-0 opacity-0 cursor-pointer z-10 flex w-full h-full"
                />
                <div className="text-3xl mb-2 text-cyan-400 group-hover:scale-110 transition-transform">
                  {isUploading ? '⏳' : '📸'}
                </div>
                <p className="text-white text-xs font-bold tracking-wider text-center px-2">
                  {isUploading ? 'UPLOADING...' : 'UPLOAD CUSTOM'}
                </p>
                <div className="absolute inset-0 bg-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>

              {AVATARS.filter((a) => a.category === selectedCategory).map((avatar) => (
                <button
                  key={avatar.id}
                  onClick={() => onAvatarChange(avatar.url)}
                  className={`group relative aspect-square rounded-2xl overflow-hidden transition-all duration-300 ${
                    currentAvatar === avatar.url
                      ? 'ring-4 ring-cyan-400 shadow-[0_0_30px_rgba(0,217,255,0.4)] scale-[0.98]'
                      : 'border border-white/10 hover:border-white/40 hover:shadow-2xl hover:-translate-y-1'
                  }`}
                >
                  <img
                    src={avatar.url}
                    alt={avatar.name}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent pointer-events-none opacity-80 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute bottom-3 left-3 right-3 text-left">
                    <p className="text-white font-bold text-sm tracking-wide shadow-black text-shadow">
                      {avatar.name}
                    </p>
                  </div>
                  {currentAvatar === avatar.url && (
                    <div className="absolute top-3 right-3 w-6 h-6 bg-cyan-400 rounded-full flex items-center justify-center shadow-lg">
                      <svg className="w-4 h-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ═══ Achievements Tab ═══ */}
        {tab === 'achievements' && (
          <div className="flex flex-col items-center justify-center p-10 mt-20 animate-fade-in text-center max-w-lg mx-auto bg-black/40 border border-white/5 rounded-3xl">
             <div className="text-6xl mb-6">🔒</div>
             <h2 className="font-cyber text-3xl text-white tracking-widest font-black uppercase mb-3">Locked</h2>
             <p className="text-gray-400 text-sm">Global Achievements are currently in exclusive closed beta testing and will be available to all users soon.</p>
          </div>
        )}

        {/* ═══ Admin Tab ═══ */}
        {tab === 'admin' && isAdmin && (
          <div className="p-6 sm:p-10 max-w-3xl mx-auto animate-fade-in pb-20">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
              <div>
                <h1 className="font-cyber font-black text-2xl sm:text-3xl mb-1 text-yellow-400">Admin Control Center</h1>
                <p className="text-gray-400 text-sm">Manage beta access, backups, and global features.</p>
              </div>

              {hasPermission('publish_release') && (
                <button
                  onClick={() => onSetGlobalConfig({ isPublicRelease: !globalConfig?.isPublicRelease })}
                  className={`px-5 py-3 font-cyber font-bold rounded-xl transition-all shadow-lg active:scale-95 flex-shrink-0 ${
                    globalConfig?.isPublicRelease
                      ? 'bg-red-500/20 text-red-500 border border-red-500/50 hover:bg-red-500 hover:text-white'
                      : 'bg-green-500 text-black border border-green-400 shadow-[0_0_20px_rgba(34,197,94,0.4)] hover:bg-green-400'
                  }`}
                >
                  {globalConfig?.isPublicRelease ? '🚫 Revert Publish' : '🚀 Publish To Main'}
                </button>
              )}
            </div>

            {/* Permission Summary for non-main admins */}
            {isAdmin && !isMainAdmin && (
              <div className="mb-8 bg-black/40 border border-white/10 rounded-2xl p-5">
                <h3 className="font-bold text-white mb-3 flex items-center gap-2">
                  <span>🛡️</span> Your Permissions
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {([
                    ['edit_players', '✏️ Edit Players'],
                    ['delete_players', '🗑️ Delete Players'],
                    ['manage_backups', '💾 Backups'],
                    ['manage_beta_testers', '🧪 Beta Testers'],
                    ['publish_release', '🚀 Publish'],
                  ] as [keyof AdminPermissions, string][]).map(([key, label]) => (
                    <div
                      key={key}
                      className={`px-3 py-2 rounded-lg text-xs font-bold border ${
                        hasPermission(key)
                          ? 'bg-green-500/10 border-green-500/30 text-green-400'
                          : 'bg-red-500/5 border-red-500/20 text-red-400 opacity-50'
                      }`}
                    >
                      {hasPermission(key) ? '✓' : '✗'} {label}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* System Backups Section */}
            {hasPermission('manage_backups') && (
              <div className="mb-8">
                <RecoveryPanel
                  globalPlayers={globalPlayers}
                  activeUsersColl={activeUsersColl}
                  title="💾 System Backups"
                />
              </div>
            )}

            {/* Beta Testers Management */}
            {hasPermission('manage_beta_testers') && (
              <>
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
                    <button
                      type="submit"
                      className="px-6 py-3 bg-yellow-500 text-black font-cyber font-bold rounded-xl hover:bg-yellow-400 hover:shadow-[0_0_20px_rgba(234,179,8,0.5)] transition-all active:scale-95"
                    >
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
                      remoteBetaEmails.map((email) => (
                        <div key={email} className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors group">
                          <div className="flex items-center gap-3">
                            <span className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs uppercase">
                              {email[0]}
                            </span>
                            <span className="text-gray-300 text-sm font-medium">{email}</span>
                          </div>
                          <button
                            onClick={() => handleRemoveTester(email)}
                            className="text-[10px] font-bold uppercase tracking-wider text-red-500 px-3 py-1.5 rounded-lg border border-red-500/30 opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-white transition-all"
                          >
                            Remove
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}

            {/* No permissions message */}
            {!hasPermission('manage_backups') && !hasPermission('manage_beta_testers') && !hasPermission('publish_release') && !isMainAdmin && (
              <div className="bg-black/40 border border-white/5 rounded-2xl p-8 text-center">
                <div className="text-4xl mb-3 opacity-40">🔒</div>
                <p className="text-gray-400 text-sm">Your admin features are currently restricted. Contact the main admin for access.</p>
              </div>
            )}
          </div>
        )}

        {/* ═══ Manage Admins Tab (Main Admin Only) ═══ */}
        {tab === 'manage_admins' && isMainAdmin && (
          <div className="p-6 sm:p-10 max-w-3xl mx-auto pb-20">
            <AdminManagement
              adminPermissions={adminPermissions}
              mainAdminEmail={mainAdminEmail}
              onSavePermissions={onSaveAdminPermissions}
            />
          </div>
        )}

        {/* ═══ Arcade Tab ═══ */}
        {tab === 'arcade' && (
          <div className="flex flex-col items-center justify-center p-10 mt-20 animate-fade-in text-center max-w-lg mx-auto bg-black/40 border border-white/5 rounded-3xl">
             <div className="text-6xl mb-6">🔒</div>
             <h2 className="font-cyber text-3xl text-white tracking-widest font-black uppercase mb-3">Locked</h2>
             <p className="text-gray-400 text-sm">The 100-Tile Adventure Board game is currently in exclusive closed beta testing and will be available to all users soon.</p>
          </div>
        )}
      </div>
    </div>
  );
};
