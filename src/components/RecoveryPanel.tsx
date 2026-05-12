import { useState, useEffect } from 'react';
import { collection, doc, setDoc, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Player } from '../types';

interface RecoveryPanelProps {
  globalPlayers: Player[];
  activeUsersColl: any;
  onClose?: () => void;
  title?: string;
  isDismissible?: boolean;
}

interface BackupItem {
  id: string;
  timestamp: number;
  name?: string;
  data: Player[];
}

export const RecoveryPanel = ({ 
  globalPlayers, 
  activeUsersColl, 
  onClose, 
  title = "System Recovery Archive",
  isDismissible = false
}: RecoveryPanelProps) => {
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBackups();
  }, []);

  const loadBackups = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'leaderboard_backups'));
      const list: BackupItem[] = [];
      snap.forEach((docSnap) => {
        const docData = docSnap.data();
        list.push({
          id: docSnap.id,
          timestamp: docData.timestamp,
          name: docData.name || `Auto-Backup`,
          data: docData.data || []
        });
      });
      setBackups(list.sort((a, b) => b.timestamp - a.timestamp));
    } catch (err) {
      console.error("Failed to load backups:", err);
    } finally {
      setLoading(false);
    }
  };

  const createBackup = async () => {
    if (globalPlayers.length === 0) {
      alert("No data to backup!");
      return;
    }
    const defaultName = `Backup ${new Date().toLocaleDateString()}`;
    const nameInput = window.prompt("Name this backup:", defaultName);
    if (nameInput === null) return;
    
    const finalName = nameInput.trim() || defaultName;
    const backupId = `backup_${Date.now()}`;
    try {
      await setDoc(doc(collection(db, 'leaderboard_backups'), backupId), {
        timestamp: Date.now(),
        name: finalName,
        data: globalPlayers
      });
      alert("✅ Backup created!");
      loadBackups();
    } catch (err) {
      console.error(err);
    }
  };

  const importBackup = async (backup: BackupItem) => {
    if (!window.confirm(`RESTORE DATA?\n\nThis will wipe your current leaderboard and replace it with: "${backup.name}"\n\nAre you sure?`)) return;
    
    setLoading(true);
    try {
      const currentSnap = await getDocs(activeUsersColl);
      await Promise.all(currentSnap.docs.map(d => deleteDoc(doc(activeUsersColl, d.id))));
      
      await Promise.all(backup.data.map(player => 
        setDoc(doc(activeUsersColl, player.id), player)
      ));

      alert(`✅ Database restored from ${backup.name}!`);
      if (onClose) onClose();
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const deleteBackup = async (id: string) => {
    if (!window.confirm("Delete backup?")) return;
    try {
      await deleteDoc(doc(collection(db, 'leaderboard_backups'), id));
      loadBackups();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto glass-dark border border-cyan-500/20 rounded-2xl p-6 shadow-2xl animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-cyber font-bold gradient-text">{title}</h2>
          <p className="text-[10px] text-gray-500 font-cyber tracking-widest uppercase mt-1">Admin Control Console</p>
        </div>
        <div className="flex gap-2">
          {isDismissible && (
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-white transition-colors">
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="flex justify-between items-center bg-white/5 border border-white/10 p-4 rounded-xl mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center text-lg">📁</div>
          <div>
            <p className="text-white font-bold text-sm">Create Snapshot</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-tighter">Backup existing leaderboard</p>
          </div>
        </div>
        <button onClick={createBackup}
          className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold rounded-lg text-xs shadow-lg hover:scale-105 transition-all">
          NEW BACKUP
        </button>
      </div>

      <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
        {loading ? (
          <div className="py-10 text-center animate-pulse text-xs text-gray-500 font-cyber uppercase tracking-widest">Accessing Archive...</div>
        ) : backups.length === 0 ? (
          <div className="py-10 text-center text-xs text-gray-600 italic">No backups found in vault.</div>
        ) : (
          backups.map(b => (
            <div key={b.id} className="flex justify-between items-center bg-black/40 border border-white/5 p-3 rounded-xl group hover:border-cyan-500/30 transition-all">
              <div className="min-w-0 pr-4">
                <p className="text-white font-bold text-sm truncate">{b.name}</p>
                <p className="text-[9px] text-gray-500">{new Date(b.timestamp).toLocaleString()}</p>
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                <button onClick={() => importBackup(b)}
                  className="px-3 py-1.5 bg-green-500/10 text-green-400 border border-green-500/20 rounded-md hover:bg-green-500/20 text-[10px] font-bold transition-all uppercase">
                  Import
                </button>
                <button onClick={() => deleteBackup(b.id)}
                  className="px-3 py-1.5 bg-red-500/5 text-red-500/40 border border-red-500/10 rounded-md hover:bg-red-500/20 hover:text-red-400 text-[10px] font-bold transition-all uppercase opacity-0 group-hover:opacity-100">
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
