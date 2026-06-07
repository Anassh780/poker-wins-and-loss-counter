import { useState, useEffect, useRef } from 'react';
import {
  PlayerCard,
  Leaderboard,
  ResultCard,
  PlayerSetup,
  PlayerControls,
  AdminEditModal,
  ErrorSidebar,
  PokerArena,
} from './components';
import { ProfileModal } from './components/ProfileModal';
import { ProfileView } from './components/ProfileView';
import { RecoveryPanel } from './components/RecoveryPanel';
import { AdminSettingsSidebar, type AppNotification, type ArenaSchedule, type ScoringSettings } from './components/AdminSettingsSidebar';
import {
  downloadImage,
  copyToClipboard,
  shareToWhatsApp,
  generateResultSummary,
} from './utils/imageExport';
import { logMatchResults, getFilteredLeaderboard, getCutoff, getPreviousPeriodRange, getLeaderboardForPeriod, type TimeRange, type PeriodChampion, type PeriodChampions } from './utils/matchHistory';
import type { Player } from './types';
import type { AdminPermissions } from './components/AdminManagement';
import { auth, handleGoogleRedirectResult, loginWithGoogle, logout, configCollection, db } from './lib/firebase';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { onSnapshot, doc, setDoc, deleteDoc, collection, query, where, getDocs, addDoc, getDoc } from 'firebase/firestore';
import './index.css';

type View = 'setup' | 'game' | 'result';
type DuelProfile = NonNullable<Player['lastDuel']>;
type DuelPlayer = Pick<Player, 'id' | 'name' | 'avatar'>;
type DuelHighlight = {
  id: string;
  winner: DuelPlayer;
  opponent: DuelPlayer;
};

const DEFAULT_MERIT = 100;
const BAN_GAMES = 2;

const getScoringSettings = (globalConfig: any): ScoringSettings => ({
  winAction: globalConfig?.scoringSettings?.winAction || 'spreadLosses',
  lossAction: globalConfig?.scoringSettings?.lossAction || 'spreadWins',
});

const isPokerArenaAvailable = (schedule?: Partial<ArenaSchedule>) => {
  if (!schedule?.enabled) return true;
  if (!schedule.startTime || !schedule.endTime) return true;

  const [startHour, startMinute] = schedule.startTime.split(':').map(Number);
  const [endHour, endMinute] = schedule.endTime.split(':').map(Number);
  const now = new Date();
  const current = now.getHours() * 60 + now.getMinutes();
  const start = (startHour || 0) * 60 + (startMinute || 0);
  const end = (endHour || 0) * 60 + (endMinute || 0);

  if (start <= end) return current >= start && current <= end;
  return current >= start || current <= end;
};

const notificationMatchesUser = (notification: AppNotification, user: User | null, player?: Player) => {
  if (notification.targetType === 'all') return true;
  if (!notification.targetPlayerId) return false;
  return notification.targetPlayerId === user?.uid || notification.targetPlayerId === player?.id;
};

const getPlayerInitial = (name: string) => name.trim().charAt(0).toUpperCase() || '?';
const getGoogleLoginErrorMessage = (error: unknown) => {
  const code = (error as { code?: string })?.code;

  if (code === 'auth/popup-closed-by-user') return 'Google sign-in was closed before it finished.';
  if (code === 'auth/unauthorized-domain') return 'This domain is not authorized in Firebase Authentication.';
  if (code === 'auth/operation-not-allowed') return 'Google sign-in is not enabled in Firebase Authentication.';
  if (code === 'auth/configuration-not-found') return 'Firebase Authentication is not configured for this project.';
  if (code === 'auth/network-request-failed') return 'Network error while connecting to Google sign-in.';

  return 'Google sign-in failed. Please try again.';
};

const DuelWinPopup = ({ duel }: { duel: DuelHighlight }) => {
  const renderAvatar = (player: Pick<Player, 'name' | 'avatar'>, className: string) => (
    <div className={`${className} duel-avatar-ring rounded-full overflow-hidden flex items-center justify-center bg-black/70`}>
      {player.avatar ? (
        <img src={player.avatar} alt={player.name} className="h-full w-full object-cover" />
      ) : (
        <span className="font-cyber text-2xl font-black text-white">{getPlayerInitial(player.name)}</span>
      )}
    </div>
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-[140] flex items-center justify-center px-4">
      <div className="duel-win-pop relative aspect-square w-[min(86vw,360px)] rounded-full border border-cyan-400/35 bg-black/85 shadow-[0_0_70px_rgba(0,217,255,0.28)] backdrop-blur-xl">
        <div className="duel-win-ring absolute inset-3 rounded-full border border-purple-400/30" />
        <div className="duel-win-ring duel-win-ring-delayed absolute inset-9 rounded-full border border-cyan-300/25" />
        <div className="absolute inset-0 flex flex-col items-center justify-center p-7 text-center">
          <p className="mb-4 text-[10px] font-cyber font-black uppercase tracking-[0.24em] text-cyan-300">1 v 1 win</p>
          <div className="flex w-full items-center justify-center gap-3">
            {renderAvatar(duel.winner, 'h-24 w-24 border-2 border-green-300 shadow-[0_0_26px_rgba(74,222,128,0.45)]')}
            <div className="rounded-full border border-white/15 bg-white/10 px-3 py-2 text-[11px] font-cyber font-black text-white">VS</div>
            {renderAvatar(duel.opponent, 'h-16 w-16 border border-red-300/70 shadow-[0_0_20px_rgba(248,113,113,0.3)]')}
          </div>
          <h3 className="mt-4 max-w-full truncate text-2xl font-cyber font-black text-white">{duel.winner.name}</h3>
          <p className="mt-1 max-w-full truncate text-xs font-bold text-gray-300">beat {duel.opponent.name}</p>
        </div>
      </div>
    </div>
  );
};

const getDuelOrbitRings = (total: number) => {
  if (total <= 8) return [{ count: total, radius: 39, size: '23%', min: 94, offset: 0 }];
  if (total <= 14) {
    const outer = Math.ceil(total * 0.62);
    return [
      { count: outer, radius: 41, size: '18%', min: 76, offset: 0 },
      { count: total - outer, radius: 28, size: '15%', min: 62, offset: 24 },
    ];
  }

  const outer = Math.min(12, Math.ceil(total * 0.44));
  const middle = Math.min(12, Math.ceil((total - outer) * 0.58));
  return [
    { count: outer, radius: 42, size: '14%', min: 52, offset: 0 },
    { count: middle, radius: 31, size: '12.5%', min: 46, offset: 18 },
    { count: total - outer - middle, radius: 21, size: '11%', min: 40, offset: 36 },
  ].filter((ring) => ring.count > 0);
};

const getDuelOrbitStyle = (index: number, total: number): React.CSSProperties => {
  const rings = getDuelOrbitRings(total);
  let cursor = index;

  for (const ring of rings) {
    if (cursor < ring.count) {
      const angle = (-90 + ring.offset + (360 / ring.count) * cursor) * (Math.PI / 180);
      return {
        left: `${50 + Math.cos(angle) * ring.radius}%`,
        top: `${50 + Math.sin(angle) * ring.radius}%`,
        width: ring.size,
        height: ring.size,
        minWidth: ring.min,
        minHeight: ring.min,
        transform: 'translate(-50%, -50%)',
      };
    }
    cursor -= ring.count;
  }

  return { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' };
};

const DuelOpponentSelector = ({
  winner,
  candidates,
  onSelect,
  onClose,
}: {
  winner: DuelPlayer;
  candidates: DuelPlayer[];
  onSelect: (opponent: DuelPlayer) => void;
  onClose: () => void;
}) => {
  const crowded = candidates.length > 8;
  const packed = candidates.length > 14;
  const centerSizeClass = packed
    ? 'h-[28%] w-[28%] min-h-[108px] min-w-[108px]'
    : crowded
      ? 'h-[31%] w-[31%] min-h-[122px] min-w-[122px]'
      : 'h-[36%] w-[36%] min-h-[140px] min-w-[140px]';
  const avatarSizeClass = packed
    ? 'h-7 w-7 sm:h-9 sm:w-9'
    : crowded
      ? 'h-9 w-9 sm:h-11 sm:w-11'
      : 'h-11 w-11 sm:h-14 sm:w-14';
  const nameSizeClass = packed
    ? 'mt-1 max-w-[62px] text-[8px] sm:max-w-[74px] sm:text-[9px]'
    : crowded
      ? 'mt-1.5 max-w-[72px] text-[9px] sm:max-w-[84px] sm:text-[10px]'
      : 'mt-2 max-w-[76px] text-[10px] sm:max-w-[92px] sm:text-xs';

  return (
  <div className="fixed inset-0 z-[145] flex items-center justify-center bg-black/65 px-4 backdrop-blur-md">
    <div className="duel-selector-pop relative aspect-square w-[min(94vw,520px)] overflow-hidden rounded-full border border-cyan-300/30 bg-[radial-gradient(circle_at_50%_50%,rgba(168,85,247,0.24),rgba(6,10,30,0.97)_46%,rgba(3,6,18,0.98)_100%)] text-center shadow-[0_0_100px_rgba(168,85,247,0.28)]">
      <button
        onClick={onClose}
        className="absolute right-[14%] top-[12%] z-30 flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/10 text-sm font-black text-gray-300 shadow-lg backdrop-blur hover:bg-red-500/20 hover:text-white"
        aria-label="Close opponent selector"
      >
        x
      </button>

      <div className="duel-win-ring pointer-events-none absolute inset-4 rounded-full border border-purple-300/25" />
      <div className="duel-win-ring duel-win-ring-delayed pointer-events-none absolute inset-14 rounded-full border border-cyan-300/18" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[38%] w-[38%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10 bg-white/[0.03] shadow-[inset_0_0_30px_rgba(255,255,255,0.05)]" />

      <div className={`duel-orbit-core absolute left-1/2 top-1/2 z-20 flex ${centerSizeClass} -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border border-cyan-300/35 bg-[radial-gradient(circle_at_35%_24%,rgba(255,255,255,0.9),rgba(59,130,246,0.64)_18%,rgba(168,85,247,0.62)_48%,rgba(9,13,36,0.95)_100%)] p-4 shadow-[0_0_36px_rgba(0,217,255,0.34)]`}>
        <p className="mb-2 text-[9px] font-cyber font-black uppercase tracking-[0.2em] text-cyan-100">Winner</p>
        <div className="h-16 w-16 overflow-hidden rounded-full border-2 border-green-300 bg-black/60 shadow-[0_0_24px_rgba(74,222,128,0.42)] sm:h-20 sm:w-20">
          {winner.avatar ? (
            <img src={winner.avatar} alt={winner.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-3xl font-cyber font-black text-white">
              {getPlayerInitial(winner.name)}
            </div>
          )}
        </div>
        <p className="mt-2 max-w-[120px] truncate text-sm font-cyber font-black text-white sm:text-base">{winner.name}</p>
        <p className="text-[8px] font-bold uppercase tracking-[0.18em] text-green-200">choose 1v1</p>
      </div>

      {candidates.map((player, index) => (
        <button
          key={player.id}
          onClick={() => onSelect(player)}
          className="duel-orbit-button absolute z-20 flex flex-col items-center justify-center rounded-full border border-white/18 bg-[radial-gradient(circle_at_35%_25%,rgba(255,255,255,0.28),rgba(25,31,74,0.92)_45%,rgba(7,10,29,0.96)_100%)] p-1.5 text-center shadow-[0_0_26px_rgba(129,140,248,0.22),inset_0_1px_0_rgba(255,255,255,0.15)] transition-all hover:border-cyan-300/70 hover:shadow-[0_0_36px_rgba(0,217,255,0.34)]"
          style={getDuelOrbitStyle(index, candidates.length)}
        >
          <span className={`${avatarSizeClass} overflow-hidden rounded-full border border-cyan-200/45 bg-black/60 shadow-[0_0_18px_rgba(0,217,255,0.22)]`}>
            {player.avatar ? (
              <img src={player.avatar} alt={player.name} className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-base font-cyber font-black text-white sm:text-lg">
                {getPlayerInitial(player.name)}
              </span>
            )}
          </span>
          <span className={`${nameSizeClass} truncate font-cyber font-black text-white`}>{player.name}</span>
        </button>
      ))}
    </div>
  </div>
  );
};

export default function App() {
  const [view, setView] = useState<View>('setup');
  const [appMode, setAppMode] = useState<'profile' | 'game'>('game');
  const [showArena, setShowArena] = useState(false);
  const [playerCount, setPlayerCount] = useState<number>(2);
  const [gamePlayers, setGamePlayers] = useState<Player[]>([]);
  const [activeGamePlayers, setActiveGamePlayers] = useState<{ id: string; name: string }[]>([]);
  const [activeGameSessionId, setActiveGameSessionId] = useState<string>('');
  const [historyStack, setHistoryStack] = useState<Player[][]>([]);
  const [redoStack, setRedoStack] = useState<Player[][]>([]);
  const [globalPlayers, setGlobalPlayers] = useState<Player[]>([]);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [showPlayerSetup, setShowPlayerSetup] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [winner, setWinner] = useState<Player | null>(null);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [theme, setTheme] = useState<'cyber' | 'light' | 'black' | 'matrix' | 'blood'>(() => (localStorage.getItem('ct-theme') as any) || 'cyber');
  const [font, setFont] = useState<'orbitron' | 'montserrat' | 'monster' | 'pixel' | 'roboto'>(() => (localStorage.getItem('ct-font') as any) || 'orbitron');
  const [fontColor, setFontColor] = useState<'cyan' | 'red' | 'green' | 'blue' | 'yellow' | 'pink'>(() => (localStorage.getItem('ct-fcolor') as any) || 'cyan');
  const [uiStyle, setUiStyle] = useState<'cyberpunk' | 'sharp' | 'corporate' | 'arcade' | 'frost' | 'steel' | 'royal'>(() => (localStorage.getItem('ct-uistyle') as any) || 'cyberpunk');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mobileTab, setMobileTab] = useState<'controls' | 'leaderboard'>('leaderboard');
  const [dbError, setDbError] = useState<string | null>(null);
  const [showResultBackup, setShowResultBackup] = useState(false);
  const [periodChampions, setPeriodChampions] = useState<PeriodChampions>({ daily: null, weekly: null, monthly: null });
  const [sessionDuelProfiles, setSessionDuelProfiles] = useState<Record<string, DuelProfile>>({});
  const [duelHighlight, setDuelHighlight] = useState<DuelHighlight | null>(null);
  const [duelSelector, setDuelSelector] = useState<{ winner: DuelPlayer; candidates: DuelPlayer[] } | null>(null);
  const [showAdminSettings, setShowAdminSettings] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => localStorage.getItem('ct-notifications') === 'true');
  const [appNotice, setAppNotice] = useState<{ title: string; message: string; tone?: 'info' | 'warning' | 'danger' } | null>(null);
  const duelPopupTimerRef = useRef<number | null>(null);
  const lastActiveGameSessionRef = useRef<string>('');
  const lastNotificationIdRef = useRef<string>(localStorage.getItem('ct-last-notification-id') || '');
  
  // Admin logic
  const [adminEditingPlayer, setAdminEditingPlayer] = useState<Player | null>(null);
  const [adminEditTimeRange, setAdminEditTimeRange] = useState<TimeRange>('all');
  const [adminEditOriginalPlayer, setAdminEditOriginalPlayer] = useState<Player | null>(null);
  const [leaderboardRefreshTrigger, setLeaderboardRefreshTrigger] = useState<number>(0);
  const MAIN_ADMIN_EMAIL = 'ghhhbbbhjn3@gmail.com';
  const [adminPermissions, setAdminPermissions] = useState<Record<string, AdminPermissions>>({});
  const userEmail = currentUser?.email?.toLowerCase().trim() || '';
  const allAdminEmails = [MAIN_ADMIN_EMAIL, ...Object.keys(adminPermissions)];
  const isAdmin = userEmail ? allAdminEmails.includes(userEmail) : false;
  const isMainAdmin = userEmail === MAIN_ADMIN_EMAIL;

  // Permission helper: main admin has all, others checked against their permissions
  const hasPermission = (feature: keyof AdminPermissions): boolean => {
    if (isMainAdmin) return true;
    if (!isAdmin) return false;
    const perms = adminPermissions[userEmail];
    return perms ? perms[feature] : false;
  };

  // Beta Mode Config
  const [remoteBetaEmails, setRemoteBetaEmails] = useState<string[]>([]);
  const HARDCODED_TESTERS = ['ghhhbbbhjn3@gmail.com'];
  
  const isBetaTester = userEmail ? (allAdminEmails.includes(userEmail) || HARDCODED_TESTERS.includes(userEmail) || remoteBetaEmails.includes(userEmail)) : false;
  
  const [isTestingMode, setIsTestingMode] = useState<boolean>(() => localStorage.getItem('ct-testing') === 'true');

  // Master Global Settings
  const [globalConfig, setGlobalConfig] = useState<any>({});
  
  useEffect(() => {
    const unsub = onSnapshot(doc(configCollection, 'master_settings'), (snap) => {
      if (snap.exists()) setGlobalConfig(snap.data());
    }, (err) => {
      console.warn('master_settings listener failed:', err);
    });
    return () => unsub();
  }, []);

  // Listen to the active game players list from Firestore config (real-time sync for everyone)
  useEffect(() => {
    const docRef = doc(configCollection, isTestingMode ? 'active_game_beta' : 'active_game');
    const unsub = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setActiveGamePlayers(data.players || []);
        setActiveGameSessionId(data.sessionId || '');
      } else {
        setActiveGamePlayers([]);
        setActiveGameSessionId('');
      }
    }, (err) => {
      console.warn('active_game listener failed:', err);
    });
    return () => unsub();
  }, [isTestingMode]);

  // Sync admin's current gamePlayers to Firestore (only runs for authenticated admins)
  useEffect(() => {
    if (isAdmin && currentUser) {
      const docRef = doc(configCollection, isTestingMode ? 'active_game_beta' : 'active_game');
      if (view === 'game' && gamePlayers.length > 0) {
        setDoc(docRef, {
          sessionId: sessionStartTime ? String(sessionStartTime) : String(Date.now()),
          players: gamePlayers.map(p => ({ id: p.id, name: p.name }))
        }, { merge: true }).catch(err => console.error("Failed to sync active game players:", err));
      } else {
        setDoc(docRef, {
          sessionId: '',
          players: []
        }, { merge: true }).catch(err => console.error("Failed to clear active game players:", err));
      }
    }
  }, [gamePlayers, view, isAdmin, currentUser, isTestingMode, sessionStartTime]);

  // Listen to admin permissions from Firestore
  useEffect(() => {
    const unsub = onSnapshot(doc(configCollection, 'admin_permissions'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setAdminPermissions(data.admins || {});
      }
    }, (err) => {
      console.warn('admin_permissions listener failed:', err);
    });
    return () => unsub();
  }, []);

  // Save admin permissions handler
  const handleSaveAdminPermissions = async (perms: Record<string, AdminPermissions>) => {
    try {
      await setDoc(doc(configCollection, 'admin_permissions'), { admins: perms }, { merge: true });
    } catch (e) {
      console.error('Failed to save admin permissions', e);
    }
  };

  // ── Period Champions: listen to Firestore document ──
  useEffect(() => {
    const champDocId = isTestingMode ? 'period_champions_beta' : 'period_champions';
    const unsub = onSnapshot(doc(configCollection, champDocId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setPeriodChampions({
          daily: data.daily || null,
          weekly: data.weekly || null,
          monthly: data.monthly || null,
        });
      }
    }, (err) => console.warn('period_champions listener failed:', err));
    return () => unsub();
  }, [isTestingMode]);

  // ── Period Champions: check for resets and record winners ──
  useEffect(() => {
    if (!currentUser) return;
    const checkChampions = async () => {
      try {
        const champDocId = isTestingMode ? 'period_champions_beta' : 'period_champions';
        const champDocRef = doc(configCollection, champDocId);
        const champSnap = await getDoc(champDocRef);
        const existingData = champSnap.exists() ? champSnap.data() : {};

        const periods: { range: TimeRange; key: keyof PeriodChampions }[] = [
          { range: '24h', key: 'daily' },
          { range: '7d', key: 'weekly' },
          { range: '30d', key: 'monthly' },
        ];

        const updates: Record<string, any> = {};
        let hasUpdates = false;

        for (const { range, key } of periods) {
          const currentCutoff = getCutoff(range);
          const storedCutoff = existingData[`${key}_cutoff`] || 0;

          if (storedCutoff === 0) {
            // First run: just record current cutoff, don't compute any champion (start fresh)
            updates[`${key}_cutoff`] = currentCutoff;
            hasUpdates = true;
          } else if (currentCutoff !== storedCutoff) {
            // Period has reset — find the winner of the previous period
            const prevRange = getPreviousPeriodRange(range);
            if (prevRange) {
              const players = await getLeaderboardForPeriod(prevRange.start, prevRange.end, isTestingMode);
              if (players.length > 0 && players[0].wins > 0) {
                const winner = players[0];
                const periodEnd = new Date(prevRange.end);
                const label = key === 'daily'
                  ? periodEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  : key === 'weekly'
                    ? `Week of ${new Date(prevRange.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                    : periodEnd.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                updates[key] = {
                  playerName: winner.name,
                  playerId: winner.id,
                  playerAvatar: winner.avatar,
                  wins: winner.wins,
                  periodLabel: label,
                } satisfies PeriodChampion;
              }
            }
            updates[`${key}_cutoff`] = currentCutoff;
            hasUpdates = true;
          }
        }

        if (hasUpdates) {
          await setDoc(champDocRef, updates, { merge: true });
        }
      } catch (err) {
        console.warn('Period champion check failed:', err);
      }
    };
    checkChampions();
  }, [currentUser, isTestingMode]);

  // Database Selectors based on Testing Mode
  const activeUsersColl = collection(db, isTestingMode ? 'users_beta' : 'users');
  const currentProfile = currentUser
    ? globalPlayers.find((player) => player.id === currentUser.uid || player.name.toLowerCase() === (currentUser.displayName || '').toLowerCase())
    : undefined;
  const scoringSettings = getScoringSettings(globalConfig);
  const arenaSchedule = globalConfig?.arenaSchedule as ArenaSchedule | undefined;
  const isArenaAvailable = isPokerArenaAvailable(arenaSchedule);

  const showAppNotification = (title: string, message: string, tone: 'info' | 'warning' | 'danger' = 'info') => {
    setAppNotice({ title, message, tone });

    if (
      notificationsEnabled &&
      typeof Notification !== 'undefined' &&
      Notification.permission === 'granted'
    ) {
      new Notification(title, { body: message });
    }
  };

  const toggleGameNotifications = async () => {
    if (notificationsEnabled) {
      setNotificationsEnabled(false);
      localStorage.setItem('ct-notifications', 'false');
      setAppNotice({ title: 'Notifications off', message: 'Game-start notifications are paused.', tone: 'warning' });
      return;
    }

    if (typeof Notification !== 'undefined') {
      if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          setNotificationsEnabled(false);
          localStorage.setItem('ct-notifications', 'false');
          setAppNotice({ title: 'Notifications blocked', message: 'Allow browser notifications to receive poker game alerts.', tone: 'warning' });
          return;
        }
      }

      if (Notification.permission === 'denied') {
        setNotificationsEnabled(false);
        localStorage.setItem('ct-notifications', 'false');
        setAppNotice({ title: 'Notifications blocked', message: 'Browser notifications are blocked for this site.', tone: 'warning' });
        return;
      }
    }

    setNotificationsEnabled(true);
    localStorage.setItem('ct-notifications', 'true');
    setAppNotice({ title: 'Notifications on', message: 'You will be notified when players are playing poker.', tone: 'info' });
  };

  useEffect(() => {
    const hasActiveGame = !!activeGameSessionId && activeGamePlayers.length > 0;

    if (hasActiveGame && lastActiveGameSessionRef.current !== activeGameSessionId) {
      lastActiveGameSessionRef.current = activeGameSessionId;
      const names = activeGamePlayers.map((player) => player.name).join(', ');
      if (notificationsEnabled) {
        showAppNotification('Poker game active', names ? `${names} are playing poker now.` : 'Players are playing poker now.');
      }
      return;
    }

    if (!hasActiveGame && lastActiveGameSessionRef.current) {
      lastActiveGameSessionRef.current = '';
    }
  }, [activeGameSessionId, activeGamePlayers, notificationsEnabled]);

  useEffect(() => {
    const notifications = Array.isArray(globalConfig?.notifications)
      ? (globalConfig.notifications as AppNotification[])
      : [];
    const latest = notifications
      .filter((notification) => notificationMatchesUser(notification, currentUser, currentProfile))
      .sort((a, b) => b.createdAt - a.createdAt)[0];

    if (!latest) return;

    if (!lastNotificationIdRef.current) {
      lastNotificationIdRef.current = latest.id;
      localStorage.setItem('ct-last-notification-id', latest.id);
      return;
    }

    if (latest.id !== lastNotificationIdRef.current) {
      lastNotificationIdRef.current = latest.id;
      localStorage.setItem('ct-last-notification-id', latest.id);
      showAppNotification('Admin notification', latest.message);
    }
  }, [globalConfig?.notifications, currentUser?.uid, currentProfile?.id]);

  useEffect(() => {
    if (!showArena || isArenaAvailable) return;
    setShowArena(false);
    showAppNotification(
      'Poker Arena closed',
      arenaSchedule?.message || 'Poker Arena is outside the scheduled play window.',
      'warning'
    );
  }, [showArena, isArenaAvailable, arenaSchedule?.message]);

  // Listen to remote beta testers dynamically
  useEffect(() => {
    const unsub = onSnapshot(doc(configCollection, 'beta_testers'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setRemoteBetaEmails(data.emails || []);
      }
    }, (err) => {
      console.warn('beta_testers listener failed:', err);
    });
    return () => unsub();
  }, []);

  const handleUpdateBetaEmails = async (newEmails: string[]) => {
    try {
      await setDoc(doc(configCollection, 'beta_testers'), { emails: newEmails }, { merge: true });
    } catch (e) {
      console.error("Failed to update beta testers", e);
    }
  };

  // Profile
  const [showProfile, setShowProfile] = useState(false);
  const [profileAvatar, setProfileAvatar] = useState<string>(() => localStorage.getItem('ct-avatar') || '');

  // Registration System
  const [needsRegistration, setNeedsRegistration] = useState(false);
  const [regFirstName, setRegFirstName] = useState('');

  const handleAvatarChange = async (url: string) => {
    setProfileAvatar(url);
    localStorage.setItem('ct-avatar', url);

    const myNameLower = (currentUser?.displayName || '').toLowerCase();
    const existingGlobal = globalPlayers.find(p => p.name.toLowerCase() === myNameLower || p.id === currentUser?.uid);
    
    if (existingGlobal) {
      try {
        await setDoc(doc(activeUsersColl, existingGlobal.id), { avatar: url }, { merge: true });
      } catch (e) {
        console.error("Failed to sync avatar to database", e);
      }
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setCurrentUser(u);
      if (u) {
        setAuthError(null);
        setAuthLoading(false);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    handleGoogleRedirectResult().catch((error) => {
      setAuthError(getGoogleLoginErrorMessage(error));
    });
  }, []);

  useEffect(() => {
    return () => {
      if (duelPopupTimerRef.current) window.clearTimeout(duelPopupTimerRef.current);
    };
  }, []);

  useEffect(() => {
    document.body.className = '';
    if (theme === 'light') document.body.classList.add('theme-light');
    if (theme === 'black') document.body.classList.add('theme-black');
    if (theme === 'matrix') document.body.classList.add('theme-matrix');
    if (theme === 'blood') document.body.classList.add('theme-blood');
    document.body.classList.add(`font-${font}`);
    document.body.classList.add(`fcolor-${fontColor}`);
    if (uiStyle !== 'cyberpunk') document.body.classList.add(`ui-${uiStyle}`);
    // Persist to localStorage
    localStorage.setItem('ct-theme', theme);
    localStorage.setItem('ct-font', font);
    localStorage.setItem('ct-fcolor', fontColor);
    localStorage.setItem('ct-uistyle', uiStyle);
  }, [theme, font, fontColor, uiStyle]);

  useEffect(() => {
    const unsub = onSnapshot(activeUsersColl, (snap) => {
      setDbError(null);
      const list: Player[] = [];
      snap.forEach((d) => {
        const data = d.data();
        // Always use Firestore document ID as the authoritative ID
        list.push({ ...data, id: d.id } as Player);
      });
      setGlobalPlayers(list.sort((a, b) => b.wins - a.wins));
    }, (error) => {
      console.error("Firestore error:", error);
      setDbError(`Database Error: ${error.message}. Please make sure you have created a Firestore Database in your Firebase Console and set the rules to 'Test Mode'.`);
    });
    return () => unsub();
  }, [isTestingMode]);  // Re-run whenever they switch beta databases

  // Registration Hook
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (currentUser && globalPlayers.length > 0) {
      const isRegistered = globalPlayers.some(p => p.id === currentUser.uid);
      if (!isRegistered) {
        setRegFirstName('');
        setNeedsRegistration(true);
      } else {
        setNeedsRegistration(false);
      }
    } else {
      setNeedsRegistration(false);
    }
  }, [currentUser, globalPlayers]);

  // Automated Backups for 7d, 30d, all timeframes every 8 hours
  useEffect(() => {
    if (currentUser && globalPlayers.length > 0) {
      const triggerAutoBackups = async () => {
        const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;
        try {
          const backupsColl = collection(db, 'leaderboard_backups');
          const snap = await getDocs(backupsColl);
          const existingBackups: any[] = [];
          snap.forEach(d => {
            existingBackups.push({ id: d.id, ...d.data() });
          });

          const timeframes: ('7d' | '30d' | 'all')[] = ['7d', '30d', 'all'];

          for (const tf of timeframes) {
            const tfBackups = existingBackups.filter(b => b.timeframe === tf && b.isAuto === true);
            tfBackups.sort((a, b) => b.timestamp - a.timestamp);
            const latest = tfBackups[0];

            if (!latest || (Date.now() - latest.timestamp >= EIGHT_HOURS_MS)) {
              let dataToBackup: Player[] = [];
              if (tf === 'all') {
                dataToBackup = globalPlayers;
              } else {
                const aggPlayers = await getFilteredLeaderboard(tf, isTestingMode);
                dataToBackup = aggPlayers.map(ap => ({
                  id: ap.id,
                  name: ap.name,
                  avatar: ap.avatar,
                  wins: ap.wins,
                  losses: ap.losses
                }));
              }

              if (dataToBackup.length > 0) {
                const timestamp = Date.now();
                const backupId = `auto_${tf}_${timestamp}`;
                const formattedDate = new Date(timestamp).toLocaleString();
                const name = `Auto-Backup (${tf === 'all' ? 'All Time' : tf}) - ${formattedDate}`;

                await setDoc(doc(backupsColl, backupId), {
                  timestamp,
                  name,
                  timeframe: tf,
                  isAuto: true,
                  isTestingMode,
                  data: dataToBackup
                });
                console.log(`Automated backup created for ${tf}: ${name}`);
              }
            }
          }
        } catch (error) {
          console.error("Failed to run automated backups:", error);
        }
      };

      triggerAutoBackups();
    }
  }, [currentUser, globalPlayers, isTestingMode]);

  const handleRegisterProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regFirstName.trim() || !currentUser) return;
    
    // Check if they played locally before registering so we can merge their stats!
    const oldMatch = globalPlayers.find(p => p.name.toLowerCase().trim() === regFirstName.toLowerCase().trim());
    
    const finalWins = oldMatch ? oldMatch.wins : 0;
    const finalLosses = oldMatch ? oldMatch.losses : 0;
    const newDocId = currentUser.uid;
    
    await setDoc(doc(activeUsersColl, newDocId), {
      id: newDocId,
      name: regFirstName.trim(),
      avatar: profileAvatar || currentUser.photoURL || '',
      wins: finalWins,
      losses: finalLosses,
      merit: oldMatch?.merit ?? DEFAULT_MERIT,
      rulesSignedAt: oldMatch?.rulesSignedAt || 0,
      isBanned: oldMatch?.isBanned || false,
      banGamesRemaining: oldMatch?.banGamesRemaining || 0
    }, { merge: true });
    
    // Cleanup old orphaned static record if we merged
    if (oldMatch && oldMatch.id !== newDocId) {
       await deleteDoc(doc(activeUsersColl, oldMatch.id));
    }
    
    setNeedsRegistration(false);
  };

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (sessionStartTime > 0 && view === 'game') {
      const tick = () => setCurrentTime(Date.now());
      tick();
      interval = setInterval(tick, 1000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [sessionStartTime, view]);

  const sortedGamePlayers = [...gamePlayers].sort((a, b) => {
    const rA = a.wins + a.losses > 0 ? a.wins / (a.wins + a.losses) : 0;
    const rB = b.wins + b.losses > 0 ? b.wins / (b.wins + b.losses) : 0;
    return b.wins - a.wins || rB - rA;
  });

  const sessionDuration = sessionStartTime && currentTime ? currentTime - sessionStartTime : 0;

  const handleStartGame = (count: number) => {
    setPlayerCount(count);
    setGamePlayers([]);
    setEditingPlayer(null);
    setShowPlayerSetup(true);
    setSessionStartTime(Date.now());
    setWinner(null);
    setSessionDuelProfiles({});
    setDuelHighlight(null);
    setDuelSelector(null);
    setMobileTab('leaderboard');
    setView('game');
  };

  const handleAddPlayer = async (playerData: Partial<Player>): Promise<void> => {
    // Prevent duplicates: Check if a player with this name already exists in the global DB
    const existingNameMatch = globalPlayers.find(
      (p) => p.name.toLowerCase().trim() === playerData.name?.toLowerCase().trim()
    );

    // Reuse their existing global ID if found, otherwise use provided or generate new
    const id = playerData.id || existingNameMatch?.id || Date.now().toString();

    if (existingNameMatch?.isBanned) {
      showAppNotification(
        'Player banned',
        `${existingNameMatch.name} is banned for ${existingNameMatch.banGamesRemaining || BAN_GAMES} more game(s).`,
        'danger'
      );
      return;
    }

    // Check if they are already in the *current* game
    const existingInGame = gamePlayers.find((p) => p.id === id);

    const player: Player = {
      id,
      name:   playerData.name   || existingNameMatch?.name || '',
      avatar: playerData.avatar || existingNameMatch?.avatar || '',
      wins:   existingInGame?.wins    ?? 0,
      losses: existingInGame?.losses  ?? 0,
      merit: existingNameMatch?.merit ?? DEFAULT_MERIT,
      rulesSignedAt: existingNameMatch?.rulesSignedAt || 0,
      isBanned: existingNameMatch?.isBanned || false,
      banGamesRemaining: existingNameMatch?.banGamesRemaining || 0,
    };

    setGamePlayers((prev) => {
      const idx = prev.findIndex((p) => p.id === id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], name: player.name, avatar: player.avatar };
        return next;
      }
      return [...prev, player];
    });

    // Save to active Firestore database
    if (currentUser) {
      setDoc(doc(activeUsersColl, id), {
        id,
        name: player.name,
        avatar: player.avatar || '',
        wins: existingNameMatch?.wins ?? 0,
        losses: existingNameMatch?.losses ?? 0,
        merit: existingNameMatch?.merit ?? DEFAULT_MERIT,
        rulesSignedAt: existingNameMatch?.rulesSignedAt || 0,
      }, { merge: true }).catch((err) => console.error("Firebase save failed:", err));
    }

    setEditingPlayer(null);
    setShowPlayerSetup(false);
  };

  const handleEditPlayer = (player: Player) => {
    setEditingPlayer(player);
    setShowPlayerSetup(true);
    setMobileTab('controls');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeletePlayer = (id: string) => {
    pushHistory([...gamePlayers]);
    setGamePlayers((prev) => prev.filter((p) => p.id !== id));
  };

  const pushHistory = (prevState: Player[]) => {
    setHistoryStack((curr) => [...curr, prevState]);
    setRedoStack([]); // Clear redo stack on new action
  };

  const handleUndo = () => {
    if (historyStack.length === 0) return;
    const lastState = historyStack[historyStack.length - 1];
    setRedoStack((curr) => [...curr, gamePlayers]);
    setGamePlayers(lastState);
    setHistoryStack((curr) => curr.slice(0, -1));
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const nextState = redoStack[redoStack.length - 1];
    setHistoryStack((curr) => [...curr, gamePlayers]);
    setGamePlayers(nextState);
    setRedoStack((curr) => curr.slice(0, -1));
  };

  const toDuelPlayer = (player: DuelPlayer): DuelPlayer => ({
    id: player.id,
    name: player.name,
    avatar: player.avatar || '',
  });

  const getDuelOpponentCandidates = (winnerId: string): DuelPlayer[] => {
    const candidates = new Map<string, DuelPlayer>();
    [...gamePlayers, ...globalPlayers].forEach((player) => {
      if (player.id === winnerId || !player.name.trim()) return;
      if (!candidates.has(player.id)) candidates.set(player.id, toDuelPlayer(player));
    });
    return Array.from(candidates.values());
  };

  const createOneOnOneDuel = (winnerPlayer: DuelPlayer, opponentPlayer: DuelPlayer): { records: Record<string, DuelProfile>; highlight: DuelHighlight } => {
    const winner = toDuelPlayer(winnerPlayer);
    const opponent = toDuelPlayer(opponentPlayer);

    const timestamp = Date.now();
    const sessionId = sessionStartTime ? String(sessionStartTime) : String(timestamp);
    const winnerRecord: DuelProfile = {
      opponentId: opponent.id,
      opponentName: opponent.name,
      opponentAvatar: opponent.avatar || '',
      result: 'win',
      timestamp,
      sessionId,
    };
    const opponentRecord: DuelProfile = {
      opponentId: winner.id,
      opponentName: winner.name,
      opponentAvatar: winner.avatar || '',
      result: 'loss',
      timestamp,
      sessionId,
    };

    return {
      records: {
        [winner.id]: winnerRecord,
        [opponent.id]: opponentRecord,
      },
      highlight: {
        id: `${sessionId}-${timestamp}-${winner.id}`,
        winner,
        opponent,
      },
    };
  };

  const recordDuelSelection = (winnerPlayer: DuelPlayer, opponentPlayer: DuelPlayer) => {
    const duel = createOneOnOneDuel(winnerPlayer, opponentPlayer);
    setSessionDuelProfiles((prev) => ({ ...prev, ...duel.records }));
    setGamePlayers((prev) => prev.map((player) => (
      duel.records[player.id] ? { ...player, lastDuel: duel.records[player.id] } : player
    )));
    showDuelHighlight(duel.highlight);
  };

  const openDuelSelector = (winnerId: string) => {
    const winnerPlayer = gamePlayers.find((player) => player.id === winnerId) || globalPlayers.find((player) => player.id === winnerId);
    if (!winnerPlayer) return;
    const candidates = getDuelOpponentCandidates(winnerId);
    if (candidates.length === 0) return;
    setDuelSelector({ winner: toDuelPlayer(winnerPlayer), candidates });
  };

  const showDuelHighlight = (highlight: DuelHighlight) => {
    setDuelHighlight(highlight);
    if (duelPopupTimerRef.current) window.clearTimeout(duelPopupTimerRef.current);
    duelPopupTimerRef.current = window.setTimeout(() => setDuelHighlight(null), 3600);
  };

  const handleAddWin = (id: string) => {
    pushHistory([...gamePlayers]);
    setGamePlayers((prev) => prev.map((p) => {
      if (p.id === id) return { ...p, wins: p.wins + 1 };
      return scoringSettings.winAction === 'spreadLosses' ? { ...p, losses: p.losses + 1 } : p;
    }));
    openDuelSelector(id);
  };

  const handleAddLoss = (id: string) => {
    pushHistory([...gamePlayers]);
    const winnerId = gamePlayers.length === 2 ? gamePlayers.find((p) => p.id !== id)?.id : undefined;
    setGamePlayers((prev) =>
      prev.map((p) => {
        if (p.id === id) return { ...p, losses: p.losses + 1 };
        return scoringSettings.lossAction === 'spreadWins' ? { ...p, wins: p.wins + 1 } : p;
      })
    );
    if (winnerId) openDuelSelector(winnerId);
  };

  const handleResetStats = (id?: string) => {
    pushHistory([...gamePlayers]);
    setGamePlayers((prev) =>
      prev.map((p) => (!id || p.id === id) ? { ...p, wins: 0, losses: 0 } : p)
    );
  };

  const checkPlayerCertification = (wins: number, losses: number, likes = 0, dislikes = 0): boolean => {
    const gp = wins + losses;
    const winRate = gp > 0 ? (wins / gp) * 100 : 0;
    const rating = Math.max(0, (likes - dislikes) * 0.2);
    return winRate >= 85 && rating >= 75;
  };

  const handleVotePlayer = async (playerId: string, voteType: 'like' | 'dislike'): Promise<void> => {
    if (!currentUser) return;
    const player = globalPlayers.find((p) => p.id === playerId);
    if (!player) return;

    const currentLikes = player.likes || 0;
    const currentDislikes = player.dislikes || 0;
    const newLikes = voteType === 'like' ? currentLikes + 1 : currentLikes;
    const newDislikes = voteType === 'dislike' ? currentDislikes + 1 : currentDislikes;

    const isCertified = checkPlayerCertification(player.wins, player.losses, newLikes, newDislikes);

    try {
      // 1. Update target player stats
      await setDoc(
        doc(activeUsersColl, playerId),
        {
          likes: newLikes,
          dislikes: newDislikes,
          isCertified,
        },
        { merge: true }
      );

      // 2. Save vote entry (with voter details)
      const votesColl = collection(db, isTestingMode ? 'votes_beta' : 'votes');
      const voteDocId = `${currentUser.uid}_${playerId}_${activeGameSessionId || 'nosession'}`;
      await setDoc(doc(votesColl, voteDocId), {
        id: voteDocId,
        voterId: currentUser.uid,
        voterName: currentUser.displayName || 'Anonymous',
        voterAvatar: profileAvatar || currentUser.photoURL || '',
        targetPlayerId: playerId,
        voteType,
        sessionId: activeGameSessionId || 'nosession',
        timestamp: Date.now(),
        isTestingMode
      });

      // Keep local gamePlayers in sync in real-time
      setGamePlayers((prev) =>
        prev.map((p) =>
          p.id === playerId
            ? {
                ...p,
                likes: newLikes,
                dislikes: newDislikes,
                isCertified,
              }
            : p
        )
      );
    } catch (e) {
      console.error("Failed to save vote", e);
    }
  };

  const handleEndGame = () => {
    if (sortedGamePlayers.length === 0) return;
    setWinner(sortedGamePlayers[0]);
    setView('result');
    setShowResultBackup(true);
    if (currentUser) {
      setSaving(true);
      const gamePlayerIds = new Set(gamePlayers.map((player) => player.id));
      Promise.all(
        [
        ...gamePlayers.map((p) => {
          const global = globalPlayers.find((g) => g.id === p.id);
          const finalWins = (global?.wins || 0) + p.wins;
          const finalLosses = (global?.losses || 0) + p.losses;
          const likes = global?.likes || 0;
          const dislikes = global?.dislikes || 0;
          const isCertified = checkPlayerCertification(finalWins, finalLosses, likes, dislikes);
          const lastDuel = sessionDuelProfiles[p.id] || p.lastDuel;
          const playerUpdate: Partial<Player> & Pick<Player, 'id' | 'name' | 'avatar' | 'wins' | 'losses'> = {
            id: p.id,
            name: p.name,
            avatar: p.avatar || '',
            wins: finalWins,
            losses: finalLosses,
            isCertified,
          };
          if (lastDuel) playerUpdate.lastDuel = lastDuel;

          return setDoc(doc(activeUsersColl, p.id), playerUpdate, { merge: true }).catch((err) => {
            console.error("Firebase save failed for", p.name, err);
            alert(`Failed to save ${p.name}. Make sure Firestore rules are set to test mode.`);
          });
        }),
        ...Object.entries(sessionDuelProfiles)
          .filter(([playerId]) => !gamePlayerIds.has(playerId))
          .map(([playerId, lastDuel]) =>
            setDoc(doc(activeUsersColl, playerId), { lastDuel }, { merge: true }).catch((err) => {
              console.error("Firebase duel record save failed for", playerId, err);
            })
          ),
        ...globalPlayers
          .filter((player) => player.isBanned)
          .map((player) => {
            const remaining = Math.max(0, (player.banGamesRemaining ?? BAN_GAMES) - 1);
            const banUpdate: Partial<Player> = remaining <= 0
              ? {
                  isBanned: false,
                  banGamesRemaining: 0,
                  banReason: '',
                  bannedAt: 0,
                }
              : { banGamesRemaining: remaining };

            return setDoc(doc(activeUsersColl, player.id), banUpdate, { merge: true }).catch((err) => {
              console.error("Firebase ban countdown failed for", player.name, err);
            });
          })
        ]
      ).then(() => {
        // Log match history with timestamps for time-filtered leaderboard
        logMatchResults(gamePlayers, isTestingMode).catch((err) =>
          console.error('Failed to log match history:', err)
        );
      }).finally(() => setSaving(false));
    }
  };

  const handleResetGame = () => {
    setEditingPlayer(null);
    setShowPlayerSetup(false);
    setView('setup');
    setSessionStartTime(0);
    setGamePlayers([]);
    setWinner(null);
    setSessionDuelProfiles({});
    setDuelHighlight(null);
    setDuelSelector(null);
    setSelectedPlayers([]);
  };

  const togglePlayerSelection = (id: string) => {
    setSelectedPlayers(prev => prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]);
  };

  const handleStartGameWithSelected = () => {
    if (selectedPlayers.length < 2) return;
    const selectedGlobalPlayers = globalPlayers.filter(p => selectedPlayers.includes(p.id));
    const bannedSelected = selectedGlobalPlayers.filter((player) => player.isBanned);
    const playablePlayers = selectedGlobalPlayers.filter((player) => !player.isBanned);

    if (bannedSelected.length > 0) {
      showAppNotification(
        'Banned player blocked',
        `${bannedSelected.map((player) => player.name).join(', ')} cannot play until the ban is removed.`,
        'danger'
      );
    }

    if (playablePlayers.length < 2) return;

    const playersToStart = playablePlayers.map(p => ({
      ...p,
      wins: 0,
      losses: 0
    }));
    setPlayerCount(playersToStart.length);
    setGamePlayers(playersToStart);
    setEditingPlayer(null);
    setShowPlayerSetup(false);
    setSessionStartTime(Date.now());
    setWinner(null);
    setSessionDuelProfiles({});
    setDuelHighlight(null);
    setDuelSelector(null);
    setMobileTab('leaderboard');
    setView('game');
  };

  const handleAdminSave = async (updatedPlayer: Player) => {
    if (!isAdmin || !hasPermission('edit_players')) return;

    if (adminEditTimeRange !== 'all') {
      const orig = adminEditOriginalPlayer;
      if (!orig) return;

      const deltaWins = updatedPlayer.wins - orig.wins;
      const deltaLosses = updatedPlayer.losses - orig.losses;

      // Update name/avatar globally in users collection
      const globalPlayer = globalPlayers.find(p => p.id === updatedPlayer.id);
      if (globalPlayer) {
        await setDoc(doc(activeUsersColl, updatedPlayer.id), {
          name: updatedPlayer.name,
          avatar: updatedPlayer.avatar
        }, { merge: true });
      }

      // Add adjustment match_history entry if there's any stats change
      if (deltaWins !== 0 || deltaLosses !== 0) {
        await addDoc(collection(db, 'match_history'), {
          playerId: updatedPlayer.id,
          playerName: updatedPlayer.name,
          playerAvatar: updatedPlayer.avatar || '',
          wins: deltaWins,
          losses: deltaLosses,
          timestamp: Date.now(),
          isTestingMode,
          timeframe: adminEditTimeRange
        });
      }

      // Increment refresh trigger to refresh Leaderboard
      setLeaderboardRefreshTrigger(prev => prev + 1);
    } else {
      const isCertified = checkPlayerCertification(
        updatedPlayer.wins,
        updatedPlayer.losses,
        updatedPlayer.likes || 0,
        updatedPlayer.dislikes || 0
      );
      const finalPlayer = { ...updatedPlayer, isCertified };

      // Write directly to global firestore
      await setDoc(doc(activeUsersColl, finalPlayer.id), finalPlayer, { merge: true });
      
      // Also update locally if they are in the current match, but preserve session stats
      setGamePlayers(prev => prev.map(p => 
        p.id === finalPlayer.id 
          ? { 
              ...p, 
              name: finalPlayer.name, 
              avatar: finalPlayer.avatar,
              isCertified: finalPlayer.isCertified,
              likes: finalPlayer.likes,
              dislikes: finalPlayer.dislikes
            } 
          : p
      ));
    }
  };

  const handleOpenAdminEdit = (player: Player, range: TimeRange = 'all') => {
    if (!isAdmin || !hasPermission('edit_players')) return;

    setAdminEditTimeRange(range);
    if (range === 'all') {
      const globalPlayer = globalPlayers.find(p => p.id === player.id);
      setAdminEditingPlayer(globalPlayer || player);
      setAdminEditOriginalPlayer(globalPlayer || player);
    } else {
      setAdminEditingPlayer(player);
      setAdminEditOriginalPlayer(player);
    }
  };

  const handlePlayerQuickAction = async (player: Player, action: 'ban' | 'unban' | 'merit') => {
    if (!isAdmin || !hasPermission('edit_players')) return;

    const globalPlayer = globalPlayers.find((p) => p.id === player.id) || player;
    const currentMerit = globalPlayer.merit ?? DEFAULT_MERIT;
    let update: Partial<Player> = {};
    let title = '';
    let message = '';

    if (action === 'ban') {
      update = {
        isBanned: true,
        banGamesRemaining: BAN_GAMES,
        banReason: 'Fair play violation',
        bannedAt: Date.now(),
        merit: Math.max(0, currentMerit - 10),
      };
      title = 'Player banned';
      message = `${globalPlayer.name} is banned for ${BAN_GAMES} games and lost 10 merit.`;
    }

    if (action === 'unban') {
      update = {
        isBanned: false,
        banGamesRemaining: 0,
        banReason: '',
        bannedAt: 0,
      };
      title = 'Player unbanned';
      message = `${globalPlayer.name} can play again.`;
    }

    if (action === 'merit') {
      update = {
        merit: Math.min(100, currentMerit + 5),
      };
      title = 'Merit restored';
      message = `${globalPlayer.name} received +5 fair play merit.`;
    }

    if (!Object.keys(update).length) return;

    await setDoc(doc(activeUsersColl, player.id), update, { merge: true });
    setGamePlayers((prev) => prev.map((p) => p.id === player.id ? { ...p, ...update } : p));
    setLeaderboardRefreshTrigger((prev) => prev + 1);
    showAppNotification(title, message, action === 'ban' ? 'danger' : 'info');
  };

  const handleAdminDelete = async (playerId: string) => {
    if (!isAdmin || !hasPermission('delete_players')) return;

    try {
      // 1. Delete from the main users collection
      await deleteDoc(doc(activeUsersColl, playerId));
    } catch (e: any) {
      console.error('Failed to delete player from database:', e);
      throw new Error(`Database delete failed: ${e?.message || 'Permission denied'}. Check Firestore security rules.`);
    }
    
    // 2. Delete all match history records for this player
    try {
      const historyColl = collection(db, 'match_history');
      const q = query(historyColl, where('playerId', '==', playerId));
      const snap = await getDocs(q);
      if (snap.size > 0) {
        await Promise.all(snap.docs.map(docSnap => deleteDoc(doc(db, 'match_history', docSnap.id))));
      }
    } catch (e) {
      console.error('Failed to delete player history records:', e);
    }
    
    // 3. Remove from all local state
    setGamePlayers(prev => prev.filter(p => p.id !== playerId));
    setSelectedPlayers(prev => prev.filter(pid => pid !== playerId));
    setAdminEditingPlayer(null);
  };

  // ----- UI Renderings Methods -----

  // Check if features are universally unlocked
  const isFeaturesUnlocked = isTestingMode || globalConfig?.isPublicRelease;

  const handleLoginWithGoogle = async () => {
    setAuthError(null);
    setAuthLoading(true);
    try {
      await loginWithGoogle();
    } catch (error) {
      setAuthError(getGoogleLoginErrorMessage(error));
    } finally {
      setAuthLoading(false);
    }
  };

  // ── Auth Header & Config Bar ──
  const handleOpenArena = () => {
    if (!isArenaAvailable) {
      showAppNotification(
        'Poker Arena closed',
        arenaSchedule?.message || 'Poker Arena is outside the scheduled play window.',
        'warning'
      );
      return;
    }

    setShowArena(true);
  };

  const renderAuthHeader = (showBack: boolean = false) => (
    <div className="sticky top-0 z-50 flex flex-col w-full shadow-lg">
      {/* Top Bar: Navigation & Auth */}
      <div className="flex items-center justify-between px-3 sm:px-5 py-2.5 backdrop-blur-xl"
        style={{ background: 'rgba(8,12,32,0.85)', borderBottom: '1px solid rgba(0,217,255,0.08)' }}>
        {/* Left: logo or back button */}
        <div className="flex items-center gap-2 min-w-0">
          {showBack
            ? <button onClick={handleResetGame}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/15 hover:bg-red-500/25 border border-red-500/40 text-red-300 rounded-lg text-xs font-bold transition-smooth flex-shrink-0">
                ← Back
              </button>
            : <span className="font-cyber font-black text-base sm:text-lg gradient-text">⚡ CYBERTRACK</span>
          }
          {isTestingMode && (
            <span className="px-2 py-0.5 bg-yellow-500/20 border border-yellow-500/50 rounded-full text-yellow-400 text-[9px] font-bold uppercase tracking-wider animate-pulse">
              BETA
            </span>
          )}
        </div>

        {/* Center: Profile ↔ Game Toggle */}
        {currentUser && view === 'setup' && (
          <div className="flex items-center gap-2">
            <span className={`text-[10px] sm:text-xs font-cyber font-bold uppercase transition-smooth ${
              appMode === 'profile' ? 'text-cyan-400' : 'text-gray-600'
            }`}>Profile</span>
            <button
              onClick={() => setAppMode(appMode === 'game' ? 'profile' : 'game')}
              className="relative w-12 h-6 sm:w-14 sm:h-7 rounded-full border transition-all duration-300 flex-shrink-0"
              style={{
                background: appMode === 'game'
                  ? 'linear-gradient(135deg, rgba(0,217,255,0.3), rgba(139,92,246,0.3))'
                  : 'linear-gradient(135deg, rgba(139,92,246,0.3), rgba(236,72,153,0.3))',
                borderColor: appMode === 'game' ? 'rgba(0,217,255,0.5)' : 'rgba(236,72,153,0.5)',
                boxShadow: appMode === 'game'
                  ? '0 0 15px rgba(0,217,255,0.2), inset 0 0 10px rgba(0,217,255,0.1)'
                  : '0 0 15px rgba(236,72,153,0.2), inset 0 0 10px rgba(236,72,153,0.1)',
              }}
              title={appMode === 'game' ? 'Switch to Profile' : 'Switch to Game Mode'}
            >
              <div
                className="absolute top-0.5 w-5 h-5 sm:w-6 sm:h-6 rounded-full transition-all duration-300 flex items-center justify-center text-[10px] sm:text-xs shadow-lg"
                style={{
                  left: appMode === 'game' ? 'calc(100% - 22px)' : '2px',
                  background: appMode === 'game'
                    ? 'linear-gradient(135deg, #00d9ff, #8b5cf6)'
                    : 'linear-gradient(135deg, #ec4899, #8b5cf6)',
                  boxShadow: appMode === 'game'
                    ? '0 0 12px rgba(0,217,255,0.6)'
                    : '0 0 12px rgba(236,72,153,0.6)',
                }}
              >
                {appMode === 'game' ? '🎮' : '👤'}
              </div>
            </button>
            <span className={`text-[10px] sm:text-xs font-cyber font-bold uppercase transition-smooth ${
              appMode === 'game' ? 'text-cyan-400' : 'text-gray-600'
            }`}>Game</span>
          </div>
        )}

        {/* Right: auth & profile */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          {currentUser ? (
            <>
              {/* Beta Tester Toggle */}
              {(isBetaTester || isAdmin) && (
                <button onClick={() => {
                  const newVal = !isTestingMode;
                  setIsTestingMode(newVal);
                  localStorage.setItem('ct-testing', String(newVal));
                }}
                  className={`px-2 sm:px-3 py-1.5 rounded-full border text-[10px] font-bold uppercase transition-smooth flex-shrink-0 ${
                    isTestingMode
                      ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50 shadow-[0_0_10px_rgba(234,179,8,0.2)]'
                      : 'bg-black/40 text-gray-400 border-white/10 hover:border-yellow-500/30 hover:text-yellow-500/80'
                  }`}>
                  <span className="hidden sm:inline">{isTestingMode ? '🧪 Testing On' : '🧪 Tester'}</span>
                  <span className="sm:hidden text-xs">🧪</span>
                </button>
              )}

              <button
                onClick={toggleGameNotifications}
                className={`px-2 sm:px-3 py-1.5 rounded-full border text-[10px] font-bold uppercase transition-smooth flex-shrink-0 ${
                  notificationsEnabled
                    ? 'bg-green-500/15 text-green-300 border-green-400/40 shadow-[0_0_10px_rgba(34,197,94,0.18)]'
                    : 'bg-black/40 text-gray-400 border-white/10 hover:border-cyan-400/40 hover:text-cyan-300'
                }`}
              >
                <span className="hidden sm:inline">{notificationsEnabled ? 'Notify On' : 'Notify Off'}</span>
                <span className="sm:hidden">{notificationsEnabled ? 'On' : 'Off'}</span>
              </button>

              {isAdmin && (
                <button
                  onClick={() => setShowAdminSettings(true)}
                  className="px-2 sm:px-3 py-1.5 rounded-full border border-cyan-400/30 bg-cyan-500/10 text-[10px] font-bold uppercase text-cyan-300 transition-smooth hover:border-cyan-300 hover:bg-cyan-500/20 flex-shrink-0"
                >
                  Settings
                </button>
              )}

              {/* Profile/Features Button (non-beta users who have features unlocked) */}
              {isFeaturesUnlocked && !isBetaTester && (
                <button onClick={() => setShowProfile(true)}
                  className="w-6 h-6 sm:w-7 sm:h-7 rounded-full border border-cyan-500/50 flex items-center justify-center text-sm hover:border-cyan-400 transition-smooth bg-black/40 flex-shrink-0 overflow-hidden"
                  title="My Profile">
                  {profileAvatar ? <img src={profileAvatar} className="w-full h-full object-cover" /> : '👤'}
                </button>
              )}
              
              <div className="flex items-center gap-1.5 sm:gap-2 bg-black/40 border border-white/10 rounded-full px-2 sm:px-2.5 py-1 sm:py-1.5">
                <img src={currentUser.photoURL || ''} alt="avatar"
                  className="w-4 h-4 sm:w-6 sm:h-6 rounded-full border border-cyan-500 flex-shrink-0" />
                <span className="text-[10px] sm:text-xs font-cyber text-cyan-300 hidden md:block max-w-[80px] truncate">
                  {currentUser.displayName}
                </span>
                <button onClick={logout} className="text-[9px] sm:text-[10px] text-red-400 hover:text-red-300 ml-0.5 flex-shrink-0">
                ×Out
              </button>
            </div>
            </>
          ) : (
            <button onClick={handleLoginWithGoogle} disabled={authLoading}
              className="btn-shimmer flex items-center gap-1.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full px-3 py-1.5 transition-smooth cursor-pointer disabled:opacity-60 disabled:cursor-wait">
              <svg className="w-3 h-3 text-white flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span className="text-[11px] sm:text-xs font-cyber font-bold text-white whitespace-nowrap">{authLoading ? 'Signing in...' : 'Sign in'}</span>
            </button>
          )}
        </div>
      </div>

      {authError && (
        <div className="flex items-center justify-center gap-3 border-b border-red-500/25 bg-red-500/10 px-3 py-2 text-center text-[11px] font-bold text-red-200">
          <span>{authError}</span>
          <button
            onClick={() => setAuthError(null)}
            className="rounded-full border border-red-300/30 px-2 py-0.5 text-[10px] uppercase tracking-wider text-red-100 hover:bg-red-500/20"
          >
            Close
          </button>
        </div>
      )}

      {/* Settings Bar: Dropdowns that never glitch and wrap perfectly on mobile */}
      <div className="flex items-center justify-center flex-wrap gap-2 sm:gap-4 px-3 sm:px-5 py-2 bg-black/60 border-b border-white/5 backdrop-blur-md">
        {/* Theme Select */}
        <select value={theme} onChange={(e) => setTheme(e.target.value as any)}
          className="bg-black/50 text-gray-300 outline-none cursor-pointer border border-white/10 rounded-lg px-2 py-1 text-[11px] sm:text-xs hover:border-cyan-500/50 transition-smooth">
          <option value="cyber">🌌 Cyber Theme</option>
          <option value="light">☀️ Light Theme</option>
          <option value="black">🌑 Pitch Black</option>
          <option value="matrix">💻 Matrix Green</option>
          <option value="blood">🩸 Blood Red</option>
        </select>
        
        {/* Font Select */}
        <select value={font} onChange={(e) => setFont(e.target.value as any)}
          className="bg-black/50 text-gray-300 outline-none cursor-pointer border border-white/10 rounded-lg px-2 py-1 text-[11px] sm:text-xs hover:border-cyan-500/50 transition-smooth">
          <option value="orbitron">🔠 Orbitron</option>
          <option value="montserrat">📝 Montserrat</option>
          <option value="monster">👹 Monster</option>
          <option value="pixel">👾 Pixel Type</option>
          <option value="roboto">📰 Roboto</option>
        </select>

        {/* Font Color Select */}
        <select value={fontColor} onChange={(e) => setFontColor(e.target.value as any)}
          className="bg-black/50 text-gray-300 outline-none cursor-pointer border border-white/10 rounded-lg px-2 py-1 text-[11px] sm:text-xs hover:border-cyan-500/50 transition-smooth">
          <option value="cyan">🔵 Cyan Accent</option>
          <option value="red">🔴 Red Accent</option>
          <option value="green">🟢 Green Accent</option>
          <option value="pink">🟣 Pink Accent</option>
          <option value="yellow">🟡 Gold Accent</option>
          <option value="blue">🔵 Deep Blue</option>
        </select>

        {/* UI Style Select */}
        <select value={uiStyle} onChange={(e) => setUiStyle(e.target.value as any)}
          className="bg-black/50 text-gray-300 outline-none cursor-pointer border border-white/10 rounded-lg px-2 py-1 text-[11px] sm:text-xs hover:border-cyan-500/50 transition-smooth">
          <option value="cyberpunk">✨ Cyberpunk</option>
          <option value="sharp">🔲 Sharp Dark</option>
          <option value="corporate">💼 Corporate</option>
          <option value="arcade">🕹️ Neon Arcade</option>
          <option value="frost">❄️ Frost Premium</option>
          <option value="steel">⚙️ Steel</option>
          <option value="royal">👑 Royal Gold</option>
        </select>
      </div>

      {/* Global Modals Mounted Here so they show up over any View */}
      {isAdmin && adminEditingPlayer && (
        <AdminEditModal
          player={adminEditingPlayer}
          onSave={handleAdminSave}
          onDelete={handleAdminDelete}
          onClose={() => setAdminEditingPlayer(null)}
          canDelete={hasPermission('delete_players')}
        />
      )}

      {showProfile && currentUser && isFeaturesUnlocked && (
        <ProfileModal
          user={currentUser}
          globalPlayers={globalPlayers}
          isAdmin={isAdmin}
          remoteBetaEmails={remoteBetaEmails}
          globalConfig={globalConfig}
          onUpdateBetaEmails={handleUpdateBetaEmails}
          onSetGlobalConfig={async (updates) => {
            await setDoc(doc(configCollection, 'master_settings'), updates, { merge: true });
          }}
          onClose={() => setShowProfile(false)}
          onAvatarChange={handleAvatarChange}
          currentAvatar={profileAvatar}
          isTestingMode={isTestingMode}
        />
      )}

      {/* Global Error Diagnostics */}
      <ErrorSidebar isAdmin={isAdmin} />

      {isAdmin && (
        <AdminSettingsSidebar
          open={showAdminSettings}
          onClose={() => setShowAdminSettings(false)}
          globalConfig={globalConfig}
          globalPlayers={globalPlayers}
          onSetGlobalConfig={async (updates) => {
            await setDoc(doc(configCollection, 'master_settings'), updates, { merge: true });
          }}
          currentAdminName={currentUser?.displayName || userEmail || 'Admin'}
        />
      )}

      {appNotice && (
        <div className="fixed right-4 top-24 z-[170] w-[min(92vw,360px)] rounded-2xl border border-white/12 bg-[#080d24]/95 p-4 shadow-[0_20px_55px_rgba(0,0,0,0.45)] backdrop-blur-xl animate-slide-up">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className={`font-cyber text-sm font-black uppercase tracking-[0.14em] ${
                appNotice.tone === 'danger' ? 'text-red-300' : appNotice.tone === 'warning' ? 'text-amber-300' : 'text-cyan-300'
              }`}>
                {appNotice.title}
              </p>
              <p className="mt-1 text-xs font-semibold leading-relaxed text-gray-200">{appNotice.message}</p>
            </div>
            <button
              onClick={() => setAppNotice(null)}
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs font-black text-gray-300 hover:bg-white/10 hover:text-white"
              aria-label="Close notification"
            >
              x
            </button>
          </div>
        </div>
      )}

      {duelHighlight && <DuelWinPopup duel={duelHighlight} />}
      {duelSelector && (
        <DuelOpponentSelector
          winner={duelSelector.winner}
          candidates={duelSelector.candidates}
          onSelect={(opponent) => {
            recordDuelSelection(duelSelector.winner, opponent);
            setDuelSelector(null);
          }}
          onClose={() => setDuelSelector(null)}
        />
      )}

      {/* Poker Arena Overlay — global, shows over any view */}
      {showArena && (
        <PokerArena
          currentUser={currentUser}
          globalPlayers={globalPlayers}
          onClose={() => setShowArena(false)}
        />
      )}

      {/* Offline Alert Popup */}
      {isOffline && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="glass-dark border border-red-500/50 p-8 rounded-3xl w-full max-w-sm text-center shadow-[0_0_50px_rgba(239,68,68,0.3)]">
            <div className="text-6xl mb-4 animate-pulse drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]">📡</div>
            <h2 className="text-2xl font-cyber font-bold text-red-400 mb-2">Connection Lost</h2>
            <p className="text-gray-400 text-sm font-semibold">Please check your internet connection to sync with the database.</p>
          </div>
        </div>
      )}
    </div>
  );

  // ══════════════════════════════════════
  // SETUP VIEW
  // ══════════════════════════════════════
  // ══════════════════════════════════════
  // PROFILE VIEW (Beta Mode)
  // ══════════════════════════════════════
  if (view === 'setup' && appMode === 'profile' && currentUser) {
    return (
      <div className="min-h-screen text-white font-sans flex flex-col relative overflow-hidden app-background transition-colors duration-1000">
        {renderAuthHeader(false)}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 right-1/4 w-60 sm:w-80 h-60 sm:h-80 bg-purple-500/8 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 left-1/4 w-60 sm:w-80 h-60 sm:h-80 bg-pink-500/8 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 flex-1">
          <ProfileView
            user={currentUser}
            globalPlayers={globalPlayers}
            isAdmin={isAdmin}
            isMainAdmin={isMainAdmin}
            adminPermissions={adminPermissions}
            onSaveAdminPermissions={handleSaveAdminPermissions}
            hasPermission={hasPermission}
            mainAdminEmail={MAIN_ADMIN_EMAIL}
            remoteBetaEmails={remoteBetaEmails}
            globalConfig={globalConfig}
            onUpdateBetaEmails={handleUpdateBetaEmails}
            onSetGlobalConfig={async (updates) => {
              await setDoc(doc(configCollection, 'master_settings'), updates, { merge: true });
            }}
            onAvatarChange={handleAvatarChange}
            currentAvatar={profileAvatar}
            activeUsersColl={activeUsersColl}
            isTestingMode={isTestingMode}
          />
        </div>
      </div>
    );
  }

  if (view === 'setup') {
    return (
    <div className="min-h-screen text-white font-sans flex flex-col relative overflow-hidden app-background transition-colors duration-1000">
      
      {/* Dynamic Background Warning for Beta */}
      {isTestingMode && (
        <div className="fixed inset-0 border-4 border-yellow-500/30 pointer-events-none z-50">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-yellow-500 text-black font-cyber font-bold text-[10px] px-4 py-0.5 rounded-b-xl uppercase tracking-widest shadow-[0_0_20px_rgba(234,179,8,0.5)]">
            Testing Environment Matrix
          </div>
        </div>
      )}

      {/* Registration Interstitial Screen (Beta Feature) */}
      {needsRegistration && currentUser && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/95 backdrop-blur-3xl animate-fade-in">
          <div className="glass-dark border border-cyan-500/30 p-8 sm:p-12 rounded-3xl max-w-lg w-full text-center shadow-[0_0_80px_rgba(0,217,255,0.2)]">
            <h1 className="font-cyber font-black text-4xl mb-4 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">Welcome to Cybertrack</h1>
            <p className="text-gray-400 text-sm mb-8">Establish your global Gamer Tag to join the leaderboards.</p>
            <form onSubmit={handleRegisterProfile}>
              <div className="mb-8">
                <input
                  type="text"
                  value={regFirstName}
                  onChange={e => setRegFirstName(e.target.value)}
                  placeholder="Enter First Name / Tag"
                  className="w-full bg-black/60 border-2 border-white/10 rounded-2xl p-4 text-center text-xl font-cyber font-bold text-white outline-none focus:border-cyan-400 focus:shadow-[0_0_30px_rgba(0,217,255,0.3)] transition-all"
                  maxLength={15}
                  required
                />
              </div>
              <button type="submit"
                className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 font-cyber font-bold text-black text-xl rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-[0_0_40px_rgba(0,217,255,0.4)]">
                Initialize Profile →
              </button>
            </form>
          </div>
        </div>
      )}

      {renderAuthHeader(false)}

        {/* Ambient blobs */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 right-1/4 w-60 sm:w-80 h-60 sm:h-80 bg-cyan-500/8 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 left-1/4 w-60 sm:w-80 h-60 sm:h-80 bg-purple-500/8 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 flex flex-col items-center px-4 pt-8 pb-16">
          {/* Hero */}
          <div className="w-full max-w-md mb-10">
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/25 rounded-full px-3 py-1 mb-4">
                <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse flex-shrink-0" />
                <span className="text-cyan-400 text-[10px] sm:text-xs font-semibold tracking-widest uppercase">Premium Tracker</span>
              </div>
              <h1 className="text-4xl sm:text-6xl font-cyber font-black gradient-text mb-3 leading-none tracking-tight">⚡ CYBERTRACK</h1>
              <p className="text-gray-500 text-sm">Multiplayer Win/Loss Ranking System</p>
              <div className="h-px w-32 bg-gradient-to-r from-transparent via-cyan-500 to-transparent mx-auto mt-4" />
            </div>

            {/* Poker Arena Entry Button */}
            <button
              onClick={handleOpenArena}
              className="w-full py-3 rounded-2xl font-black text-base tracking-widest transition-all flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95"
              style={{
                background: isArenaAvailable
                  ? 'linear-gradient(135deg, #1a0533 0%, #2d0a5e 50%, #1a0533 100%)'
                  : 'linear-gradient(135deg, rgba(39,20,26,0.95), rgba(73,28,36,0.95))',
                border: isArenaAvailable ? '1.5px solid rgba(168,85,247,0.5)' : '1.5px solid rgba(248,113,113,0.35)',
                boxShadow: isArenaAvailable
                  ? '0 0 24px rgba(168,85,247,0.2), inset 0 1px 0 rgba(255,255,255,0.05)'
                  : '0 0 18px rgba(248,113,113,0.12), inset 0 1px 0 rgba(255,255,255,0.04)',
                color: isArenaAvailable ? '#e879f9' : '#fca5a5',
              }}
            >
              <span style={{ fontSize: '1.4rem' }}>🃏</span>
              <span>{isArenaAvailable ? 'POKER ARENA' : 'ARENA CLOSED'}</span>
              <span className="text-xs font-normal opacity-60 ml-1">{isArenaAvailable ? 'Deal Cards Online' : 'Scheduled Offline'}</span>
            </button>
            {arenaSchedule?.enabled && (
              <div className={`mt-2 rounded-xl border px-3 py-2 text-center text-[10px] font-cyber font-bold uppercase tracking-wider ${
                isArenaAvailable
                  ? 'border-green-400/25 bg-green-500/10 text-green-300'
                  : 'border-red-400/25 bg-red-500/10 text-red-300'
              }`}>
                {isArenaAvailable ? 'Arena online' : 'Arena offline'} {arenaSchedule.startTime} - {arenaSchedule.endTime}
              </div>
            )}
          </div>

          {/* Database Error Banner */}
          {dbError && (
            <div className="w-full max-w-2xl bg-red-500/10 border border-red-500/50 rounded-xl p-4 mb-6 text-center animate-slide-up">
              <p className="text-red-400 font-bold mb-1">🚨 Database Connection Failed</p>
              <p className="text-red-300 text-xs">{dbError}</p>
            </div>
          )}

          {/* Period Champions */}
          {false && currentUser && (periodChampions.daily || periodChampions.weekly || periodChampions.monthly) && (
            <div className="w-full max-w-2xl mb-8 animate-fade-in">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px bg-gradient-to-r from-transparent to-yellow-500/60 flex-1 min-w-0" />
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-[11px] sm:text-xs font-cyber font-bold text-yellow-400 tracking-widest uppercase whitespace-nowrap">🏅 Last Period Champions</span>
                </div>
                <div className="h-px bg-gradient-to-l from-transparent to-yellow-500/60 flex-1 min-w-0" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                {(['daily', 'weekly', 'monthly'] as const).map((period) => {
                  const champ = periodChampions[period];
                  const labels = { daily: '⏱️ Daily', weekly: '📅 Weekly', monthly: '🗓️ Monthly' };
                  const glowColors = { daily: 'rgba(234,179,8,0.08)', weekly: 'rgba(59,130,246,0.08)', monthly: 'rgba(168,85,247,0.08)' };
                  const borderColors = { daily: 'border-yellow-500/20', weekly: 'border-blue-500/20', monthly: 'border-purple-500/20' };
                  const textColors = { daily: 'text-yellow-400', weekly: 'text-blue-400', monthly: 'text-purple-400' };
                  return (
                    <div key={period}
                      className={`glass-dark border ${borderColors[period]} rounded-xl p-3 text-center transition-all hover:scale-[1.02]`}
                      style={{ boxShadow: `0 0 30px ${glowColors[period]}` }}>
                      <p className={`text-[9px] font-cyber font-bold uppercase tracking-wider ${textColors[period]} mb-2`}>
                        {labels[period]}
                      </p>
                      {champ ? (
                        <>
                          <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden border-2 ${borderColors[period]} mx-auto mb-2 ring-2 ring-yellow-500/20`}>
                            {champ.playerAvatar ? (
                              <img src={champ.playerAvatar} alt={champ.playerName} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center text-sm font-bold text-white">
                                {champ.playerName.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <p className={`text-xs sm:text-sm font-cyber font-bold ${textColors[period]} truncate`}>{champ.playerName}</p>
                          <p className="text-[9px] text-gray-500 mt-0.5">{champ.wins} wins</p>
                          <p className="text-[8px] text-gray-600 mt-0.5 italic">{champ.periodLabel}</p>
                        </>
                      ) : (
                        <div className="py-4">
                          <p className="text-[9px] text-gray-600 italic">No champion yet</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}


          {/* Global Leaderboard (Moved to Top) */}
          {currentUser && !dbError && (() => {
            const isGameRunning = activeGamePlayers.length > 0;
            const gamePlayerIds = activeGamePlayers.map((p) => p.id);
            const gamePlayerNames = activeGamePlayers.map((p) => p.name.toLowerCase().trim());
            
            return (
            <div className="w-full max-w-2xl mb-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px bg-gradient-to-r from-transparent to-cyan-500 flex-1 min-w-0" />
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />
                  <span className="text-[11px] sm:text-xs font-cyber font-bold text-cyan-400 tracking-widest uppercase whitespace-nowrap">Global Standings</span>
                  <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />
                </div>
                <div className="h-px bg-gradient-to-l from-transparent to-cyan-500 flex-1 min-w-0" />
              </div>
              <div className="glass-dark border border-cyan-500/20 p-4 sm:p-6 rounded-2xl sm:rounded-3xl overflow-hidden"
                style={{ boxShadow: '0 0 40px rgba(0,217,255,0.07)' }}>
                {globalPlayers.length > 0
                  ? <Leaderboard
                      players={globalPlayers}
                      globalPlayers={globalPlayers}
                      isAdmin={isAdmin}
                      canEditPlayers={isAdmin && hasPermission('edit_players')}
                      onAdminEdit={isAdmin && hasPermission('edit_players') ? handleOpenAdminEdit : undefined}
                      onPlayerQuickAction={isAdmin && hasPermission('edit_players') ? handlePlayerQuickAction : undefined}
                      showTimeFilter={true}
                      isTestingMode={isTestingMode}
                      isGameActive={isGameRunning}
                      activeGamePlayerIds={gamePlayerIds}
                      activeGamePlayerNames={gamePlayerNames}
                      onVotePlayer={handleVotePlayer}
                      currentUserId={currentUser?.uid}
                      refreshTrigger={leaderboardRefreshTrigger}
                      activeGameSessionId={activeGameSessionId}
                    />
                  : (
                    <div className="text-center py-10">
                      <div className="text-4xl mb-3 opacity-30">🏆</div>
                      <p className="text-cyan-500/40 font-cyber text-xs tracking-widest uppercase">No records yet</p>
                      <p className="text-gray-600 text-[11px] mt-1">Complete a game to appear here</p>
                    </div>
                  )
                }
              </div>
            </div>
            );
          })()}

          {/* Admin Setup Section */}
          {isAdmin && (
            <div className="w-full max-w-md mb-10 mt-6 animate-fade-in">
              {/* Quick Start Card */}
              <div className="glass-dark rounded-2xl sm:rounded-3xl p-5 sm:p-8 mb-4" style={{ border: '1px solid rgba(0,217,255,.15)' }}>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-sm sm:text-lg font-cyber font-bold text-white/80 tracking-wider uppercase">Select Players to Start</h2>
                  <span className="text-xs text-cyan-400/80 font-cyber font-bold">{selectedPlayers.length} Selected</span>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5 max-h-[35vh] overflow-y-auto pr-2 custom-scrollbar">
                  {globalPlayers.map(p => {
                    const isSelected = selectedPlayers.includes(p.id);
                    return (
                      <button key={p.id} onClick={() => togglePlayerSelection(p.id)}
                        className={`flex flex-col items-center p-3 rounded-xl border transition-all ${isSelected ? 'bg-cyan-500/20 border-cyan-400 shadow-[0_0_15px_rgba(0,217,255,0.3)]' : 'bg-black/40 border-white/10 hover:border-cyan-500/50'}`}>
                        <div className={`w-10 h-10 rounded-full mb-2 overflow-hidden border ${isSelected ? 'border-cyan-400' : 'border-white/20'}`}>
                          {p.avatar ? <img src={p.avatar} alt={p.name} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center text-xs font-bold text-white">{p.name.charAt(0).toUpperCase()}</div>}
                        </div>
                        <span className={`text-xs font-cyber font-bold w-full text-center truncate ${isSelected ? 'text-cyan-300' : 'text-gray-300'}`}>{p.name}</span>
                      </button>
                    );
                  })}
                  
                  {/* New Player Tile */}
                  <button onClick={() => handleStartGame(0)}
                    className="flex flex-col items-center justify-center p-3 rounded-xl border border-dashed border-cyan-500/50 hover:border-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 transition-all min-h-[90px]">
                    <span className="text-2xl mb-1">➕</span>
                    <span className="text-xs font-cyber font-bold text-cyan-300 text-center">New Player</span>
                  </button>
                </div>

                <button onClick={handleStartGameWithSelected} disabled={selectedPlayers.length < 2}
                  className={`w-full py-3 font-cyber font-bold rounded-xl text-sm sm:text-base tracking-wider transition-smooth ${selectedPlayers.length >= 2 ? 'bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white hover:shadow-[0_0_24px_rgba(0,217,255,.4)]' : 'bg-white/10 text-gray-500 cursor-not-allowed'}`}>
                  {selectedPlayers.length < 2 ? `Select at least 2 players` : `Start Match (${selectedPlayers.length}) →`}
                </button>
              </div>
            </div>
          )}

          {/* Admin Backup Section — visible for admins with manage_backups permission */}
          {currentUser && isAdmin && hasPermission('manage_backups') && (
            <div className="w-full max-w-2xl mt-6">
              <RecoveryPanel 
                globalPlayers={globalPlayers} 
                activeUsersColl={activeUsersColl}
                title="💾 System Recovery & Archives"
              />
            </div>
          )}
        </div>

        {/* Global Admin Modal */}
        {isAdmin && adminEditingPlayer && (
          <AdminEditModal
            player={adminEditingPlayer}
            onSave={handleAdminSave}
            onDelete={handleAdminDelete}
            onClose={() => setAdminEditingPlayer(null)}
          />
        )}
      </div>
    );
  }

  // ══════════════════════════════════════
  // GAME VIEW
  // ══════════════════════════════════════
  if (view === 'game') {
    const playersNeeded = playerCount - gamePlayers.length;
    const isGameReady   = gamePlayers.length >= playerCount;

    return (
      <div className="min-h-screen bg-transparent transition-colors duration-500">
        {/* No overlap: back button lives inside the sticky header */}
        {renderAuthHeader(true)}

        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 right-10 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-20 left-10 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
          {/* Sub-header: player count info */}
          <div className="mb-4 sm:mb-6">
            <p className="text-gray-400 text-xs sm:text-sm">
              {playerCount} Player Match — {gamePlayers.length} of {playerCount} Added
            </p>
          </div>

          {/* Mobile tab switcher */}
          {isGameReady && isAdmin && (
            <div className="lg:hidden flex rounded-xl overflow-hidden mb-4 border border-white/10">
              {(['controls', 'leaderboard'] as const).map((t) => (
                <button key={t} onClick={() => setMobileTab(t)}
                  className={`flex-1 py-2.5 text-xs font-cyber font-bold uppercase tracking-wider transition-smooth ${
                    mobileTab === t
                      ? 'bg-gradient-to-r from-cyan-500/25 to-purple-500/25 text-cyan-300 border-b-2 border-cyan-400'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}>
                  {t === 'controls' ? '🎮 Controls' : '🏆 Rankings'}
                </button>
              ))}
            </div>
          )}

          <div className="lg:grid lg:grid-cols-3 lg:gap-8">
            {/* LEFT — Controls */}
            {isAdmin && (
            <div className={`lg:col-span-1 space-y-4 ${isGameReady && mobileTab !== 'controls' ? 'hidden lg:block' : 'block'}`}>
              {/* Player setup form */}
              {showPlayerSetup && (
                <div className="animate-slide-in">
                  <PlayerSetup
                    key={editingPlayer?.id || 'new'}
                    onAddPlayer={handleAddPlayer}
                    onClose={() => { setShowPlayerSetup(false); setEditingPlayer(null); }}
                    initialPlayer={editingPlayer || undefined}
                    isEditing={!!editingPlayer}
                    recentPlayers={globalPlayers.filter(p => !gamePlayers.some(gp => gp.id === p.id))}
                    onQuickAdd={(p) => {
                      handleAddPlayer({ id: p.id, name: p.name, avatar: p.avatar, wins: 0, losses: 0 });
                      setShowPlayerSetup(false);
                    }}
                  />
                  {!editingPlayer && playersNeeded > 0 && (
                    <p className="text-gray-500 text-xs mt-2 pl-1">
                      {playersNeeded} more player{playersNeeded !== 1 ? 's' : ''} needed
                    </p>
                  )}
                </div>
              )}

              {/* Add player button — admin only */}
              {!showPlayerSetup && (
                <button onClick={() => { setEditingPlayer(null); setShowPlayerSetup(true); }}
                  className="w-full px-4 py-4 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border-2 border-dashed border-cyan-500/50 hover:border-cyan-500 hover:bg-cyan-500/25 rounded-xl text-cyan-300 font-cyber font-bold transition-smooth text-sm sm:text-base active:scale-[.98]">
                  ➕ Add Player ({gamePlayers.length} in game)
                </button>
              )}

              {isGameReady && (
                <>
                  <PlayerControls
                    players={sortedGamePlayers}
                    onAddWin={handleAddWin}
                    onAddLoss={handleAddLoss}
                    onEditPlayer={handleEditPlayer}
                    onDeletePlayer={handleDeletePlayer}
                    onResetStats={handleResetStats}
                  />

                  {/* Undo / Redo Row */}
                  <div className="flex gap-2 w-full my-2">
                    <button onClick={handleUndo} disabled={historyStack.length === 0}
                      className="flex-1 btn-shimmer bg-white/5 border border-white/10 text-white rounded-xl py-2 px-2 font-cyber font-bold transition-smooth disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/10 active:scale-95 shadow-[0_0_15px_rgba(255,255,255,0.05)]">
                      ↩ Undo
                    </button>
                    <button onClick={handleRedo} disabled={redoStack.length === 0}
                      className="flex-1 btn-shimmer bg-white/5 border border-white/10 text-white rounded-xl py-2 px-2 font-cyber font-bold transition-smooth disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/10 active:scale-95 shadow-[0_0_15px_rgba(255,255,255,0.05)]">
                      ↪ Redo
                    </button>
                  </div>

                  <button onClick={handleEndGame}
                    className="w-full px-4 py-3.5 bg-gradient-to-r from-pink-500 to-red-600 hover:from-pink-400 hover:to-red-500 text-white font-cyber font-bold rounded-xl transition-smooth glow-pink text-sm sm:text-base active:scale-[.98]">
                    🏁 END GAME & Show Results
                  </button>
                </>
              )}
            </div>
            )}

            {/* RIGHT — Leaderboard */}
            <div className={`lg:col-span-2 mt-4 lg:mt-0 overflow-hidden ${isGameReady && isAdmin && mobileTab !== 'leaderboard' ? 'hidden lg:block' : 'block'}`}>
              <Leaderboard
                players={sortedGamePlayers}
                globalPlayers={globalPlayers}
                isAdmin={isAdmin}
                canEditPlayers={isAdmin && hasPermission('edit_players')}
                onAdminEdit={isAdmin && hasPermission('edit_players') ? handleOpenAdminEdit : undefined}
                onPlayerQuickAction={isAdmin && hasPermission('edit_players') ? handlePlayerQuickAction : undefined}
                isGameActive={activeGamePlayers.length > 0}
                activeGamePlayerIds={activeGamePlayers.map((p) => p.id)}
                activeGamePlayerNames={activeGamePlayers.map((p) => p.name.toLowerCase().trim())}
                onVotePlayer={handleVotePlayer}
                currentUserId={currentUser?.uid}
                refreshTrigger={leaderboardRefreshTrigger}
                activeGameSessionId={activeGameSessionId}
              />
            </div>
          </div>

          {/* Player cards */}
          {isGameReady && (
            <div className="mt-8">
              <h2 className="text-lg sm:text-2xl font-cyber font-bold gradient-text mb-4">📊 Individual Stats</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {sortedGamePlayers.map((player, index) => (
                  <PlayerCard key={player.id} player={player} rank={index + 1} showActions={true}
                    onEdit={() => handleEditPlayer(player)}
                    onDelete={() => handleDeletePlayer(player.id)} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Global Admin Modal */}
        {isAdmin && adminEditingPlayer && (
          <AdminEditModal
            player={adminEditingPlayer}
            timeRange={adminEditTimeRange}
            onSave={handleAdminSave}
            onDelete={handleAdminDelete}
            onClose={() => setAdminEditingPlayer(null)}
            canDelete={adminEditTimeRange === 'all'}
          />
        )}
      </div>
    );
  }

  // ══════════════════════════════════════
  // RESULT VIEW
  // ══════════════════════════════════════
  if (view === 'result' && winner) {
    const resultSummary = generateResultSummary(sortedGamePlayers, winner, sessionDuration);

    return (
      <div className="min-h-screen bg-transparent transition-colors duration-500">
        {renderAuthHeader(true)}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 right-10 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-20 left-10 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 w-full max-w-lg mx-auto px-3 sm:px-4 py-6">
          <div className="text-center mb-6">
            <h1 className="text-2xl sm:text-4xl font-cyber font-bold gradient-text mb-3">✨ MATCH COMPLETE ✨</h1>
            <div className="h-1 w-28 sm:w-44 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 rounded-full mx-auto glow-cyan" />
            {saving && <p className="text-[11px] text-cyan-500/50 mt-2 animate-pulse">Syncing to leaderboard…</p>}
          </div>

          {/* Result card */}
          <div className="mb-4 sm:mb-6 overflow-hidden rounded-3xl">
            <ResultCard players={sortedGamePlayers} winner={winner} duration={sessionDuration} />
          </div>

          {/* Share buttons */}
          <div className="rounded-2xl p-4 mb-4"
            style={{ background: 'rgba(0,217,255,0.03)', border: '1px solid rgba(0,217,255,0.15)' }}>
            <p className="text-[10px] font-bold uppercase tracking-[.2em] text-cyan-500/50 text-center mb-3">Share Results</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { fn: () => copyToClipboard('result-card'), icon: '📋', label: 'Copy', c: '#e879f9', bg: 'rgba(131,56,236,0.2)', b: 'rgba(131,56,236,0.35)' },
                { fn: () => downloadImage('result-card','cybertrack-result'), icon: '⬇️', label: 'Download', c: '#00d9ff', bg: 'rgba(0,217,255,0.15)', b: 'rgba(0,217,255,0.3)' },
                { fn: () => shareToWhatsApp(resultSummary), icon: '💬', label: 'WhatsApp', c: '#06d6a0', bg: 'rgba(6,214,160,0.15)', b: 'rgba(6,214,160,0.3)' },
              ].map(({ fn, icon, label, c, bg, b }) => (
                <button key={label} onClick={fn}
                  className="btn-shimmer flex flex-col items-center gap-1 py-3 rounded-xl font-cyber font-bold transition-smooth active:scale-95"
                  style={{ background: bg, border: `1px solid ${b}`, color: c }}>
                  <span className="text-lg">{icon}</span>
                  <span className="text-[10px] sm:text-xs">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => { setView('game'); setEditingPlayer(null); setShowPlayerSetup(false); }}
              className="px-3 py-3 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-cyber font-bold rounded-xl transition-smooth glow-cyan text-sm sm:text-base active:scale-95">
              🔄 Continue
            </button>
            <button onClick={handleResetGame}
              className="px-3 py-3 bg-gradient-to-r from-pink-500 to-red-600 hover:from-pink-400 hover:to-red-500 text-white font-cyber font-bold rounded-xl transition-smooth glow-pink text-sm sm:text-base active:scale-95">
              ← New Game
            </button>
          </div>

          {/* End-Game Backup Popup Section — Admin Only */}
          {showResultBackup && isAdmin && hasPermission('manage_backups') && (
            <div className="mt-8 transition-all animate-slide-up">
              <RecoveryPanel 
                globalPlayers={globalPlayers} 
                activeUsersColl={activeUsersColl}
                title="🎁 Instant Match Archive"
                isDismissible={true}
                onClose={() => setShowResultBackup(false)}
              />
            </div>
          )}
        </div>

        {/* Global Admin Modal Rendered on Top */}
        {isAdmin && adminEditingPlayer && (
          <AdminEditModal
            player={adminEditingPlayer}
            timeRange={adminEditTimeRange}
            onSave={handleAdminSave}
            onDelete={handleAdminDelete}
            onClose={() => setAdminEditingPlayer(null)}
            canDelete={adminEditTimeRange === 'all'}
          />
        )}

        {/* Profile Modal */}
        {showProfile && currentUser && isFeaturesUnlocked && (
          <ProfileModal
            user={currentUser}
            globalPlayers={globalPlayers}
            isAdmin={isAdmin}
            remoteBetaEmails={remoteBetaEmails}
            globalConfig={globalConfig}
            onUpdateBetaEmails={handleUpdateBetaEmails}
            onSetGlobalConfig={async (updates) => {
              await setDoc(doc(configCollection, 'master_settings'), updates, { merge: true });
            }}
            onClose={() => setShowProfile(false)}
            onShowBackup={() => {
              setView('setup'); // Go home to see the section
              window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
            }}
            onAvatarChange={handleAvatarChange}
            currentAvatar={profileAvatar}
            isTestingMode={isTestingMode}
          />
        )}
      </div>
    );
  }

  return <div className="min-h-screen flex items-center justify-center text-white font-cyber">Loading…</div>;
}
