import { useState } from 'react';
import type { Player } from '../types';

export interface AppNotification {
  id: string;
  targetType: 'all' | 'player';
  targetPlayerId?: string;
  targetPlayerName?: string;
  message: string;
  createdAt: number;
  createdBy: string;
}

export interface ArenaSchedule {
  enabled: boolean;
  startTime: string;
  endTime: string;
  message: string;
}

export interface ScoringSettings {
  winAction: 'spreadLosses' | 'singleWin';
  lossAction: 'spreadWins' | 'singleLoss';
}

interface AdminSettingsSidebarProps {
  open: boolean;
  onClose: () => void;
  globalConfig: any;
  globalPlayers: Player[];
  onSetGlobalConfig: (updates: any) => Promise<void>;
  currentAdminName: string;
}

const DEFAULT_SCORING: ScoringSettings = {
  winAction: 'spreadLosses',
  lossAction: 'spreadWins',
};

const DEFAULT_SCHEDULE: ArenaSchedule = {
  enabled: false,
  startTime: '18:00',
  endTime: '23:59',
  message: 'Poker Arena is currently closed. Please come back during the scheduled window.',
};

export const AdminSettingsSidebar = ({
  open,
  onClose,
  globalConfig,
  globalPlayers,
  onSetGlobalConfig,
  currentAdminName,
}: AdminSettingsSidebarProps) => {
  const scoring: ScoringSettings = { ...DEFAULT_SCORING, ...(globalConfig?.scoringSettings || {}) };
  const schedule: ArenaSchedule = { ...DEFAULT_SCHEDULE, ...(globalConfig?.arenaSchedule || {}) };
  const [noticeTarget, setNoticeTarget] = useState('all');
  const [noticeText, setNoticeText] = useState('');
  const [savingNotice, setSavingNotice] = useState(false);

  const saveScoring = (updates: Partial<ScoringSettings>) =>
    onSetGlobalConfig({ scoringSettings: { ...scoring, ...updates } });

  const saveSchedule = (updates: Partial<ArenaSchedule>) =>
    onSetGlobalConfig({ arenaSchedule: { ...schedule, ...updates } });

  const sendNotification = async () => {
    const clean = noticeText.trim();
    if (!clean) return;

    const targetPlayer = noticeTarget === 'all'
      ? null
      : globalPlayers.find((player) => player.id === noticeTarget) || null;

    const notification: AppNotification = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      targetType: targetPlayer ? 'player' : 'all',
      targetPlayerId: targetPlayer?.id,
      targetPlayerName: targetPlayer?.name,
      message: clean,
      createdAt: Date.now(),
      createdBy: currentAdminName || 'Admin',
    };

    setSavingNotice(true);
    try {
      const existing = Array.isArray(globalConfig?.notifications) ? globalConfig.notifications : [];
      await onSetGlobalConfig({ notifications: [notification, ...existing].slice(0, 30) });
      setNoticeText('');
    } finally {
      setSavingNotice(false);
    }
  };

  return (
    <>
      {open && <div className="fixed inset-0 z-[150] bg-black/50 backdrop-blur-sm" onClick={onClose} />}
      <aside
        className={`fixed right-0 top-0 z-[160] flex h-full w-full max-w-md flex-col border-l border-cyan-400/20 bg-[#070b20]/95 shadow-[0_0_60px_rgba(0,217,255,0.18)] backdrop-blur-xl transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <p className="text-[10px] font-cyber font-black uppercase tracking-[0.24em] text-cyan-300">Admin</p>
            <h2 className="font-cyber text-2xl font-black text-white">Settings</h2>
          </div>
          <button onClick={onClose} className="h-9 w-9 rounded-full border border-white/15 bg-white/5 text-white hover:bg-white/10">x</button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5 custom-scrollbar">
          <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <h3 className="font-cyber text-sm font-black uppercase tracking-[0.16em] text-white">Win / Loss Logic</h3>
            <div className="mt-4 space-y-3">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-cyan-300">Win button</label>
              <select
                value={scoring.winAction}
                onChange={(event) => saveScoring({ winAction: event.target.value as ScoringSettings['winAction'] })}
                className="w-full rounded-xl border border-white/10 bg-black/45 px-3 py-3 text-sm font-bold text-white outline-none focus:border-cyan-400"
              >
                <option value="spreadLosses">Selected player wins, all others get loss</option>
                <option value="singleWin">Selected player wins only</option>
              </select>

              <label className="block pt-2 text-[10px] font-bold uppercase tracking-widest text-purple-300">Loss button</label>
              <select
                value={scoring.lossAction}
                onChange={(event) => saveScoring({ lossAction: event.target.value as ScoringSettings['lossAction'] })}
                className="w-full rounded-xl border border-white/10 bg-black/45 px-3 py-3 text-sm font-bold text-white outline-none focus:border-purple-400"
              >
                <option value="spreadWins">Selected player loses, all others get win</option>
                <option value="singleLoss">Selected player loses only</option>
              </select>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-cyber text-sm font-black uppercase tracking-[0.16em] text-white">Poker Arena Schedule</h3>
              <button
                onClick={() => saveSchedule({ enabled: !schedule.enabled })}
                className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${schedule.enabled ? 'bg-green-500/20 text-green-300 border border-green-400/30' : 'bg-white/5 text-gray-400 border border-white/10'}`}
              >
                {schedule.enabled ? 'On' : 'Off'}
              </button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="text-[10px] font-bold uppercase tracking-widest text-cyan-300">
                Opens
                <input
                  type="time"
                  value={schedule.startTime}
                  onChange={(event) => saveSchedule({ startTime: event.target.value })}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/45 px-3 py-3 text-sm font-bold text-white outline-none focus:border-cyan-400"
                />
              </label>
              <label className="text-[10px] font-bold uppercase tracking-widest text-cyan-300">
                Closes
                <input
                  type="time"
                  value={schedule.endTime}
                  onChange={(event) => saveSchedule({ endTime: event.target.value })}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/45 px-3 py-3 text-sm font-bold text-white outline-none focus:border-cyan-400"
                />
              </label>
            </div>
            <textarea
              value={schedule.message}
              onChange={(event) => saveSchedule({ message: event.target.value })}
              className="mt-3 min-h-20 w-full rounded-xl border border-white/10 bg-black/45 px-3 py-3 text-sm text-white outline-none focus:border-cyan-400"
              placeholder="Closed message"
            />
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <h3 className="font-cyber text-sm font-black uppercase tracking-[0.16em] text-white">Notifications</h3>
            <select
              value={noticeTarget}
              onChange={(event) => setNoticeTarget(event.target.value)}
              className="mt-4 w-full rounded-xl border border-white/10 bg-black/45 px-3 py-3 text-sm font-bold text-white outline-none focus:border-pink-400"
            >
              <option value="all">All players</option>
              {globalPlayers.map((player) => (
                <option key={player.id} value={player.id}>{player.name}</option>
              ))}
            </select>
            <textarea
              value={noticeText}
              onChange={(event) => setNoticeText(event.target.value)}
              className="mt-3 min-h-24 w-full rounded-xl border border-white/10 bg-black/45 px-3 py-3 text-sm text-white outline-none focus:border-pink-400"
              placeholder="Write notification..."
            />
            <button
              onClick={sendNotification}
              disabled={!noticeText.trim() || savingNotice}
              className="mt-3 w-full rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 py-3 font-cyber text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {savingNotice ? 'Sending...' : 'Send Notification'}
            </button>
          </section>
        </div>
      </aside>
    </>
  );
};
