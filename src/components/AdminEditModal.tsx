import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Player } from '../types';
import { getAvatarInitials } from '../utils/imageExport';

interface AdminEditModalProps {
  player: Player;
  onSave: (updatedPlayer: Player) => Promise<void>;
  onDelete: (playerId: string) => Promise<void>;
  onClose: () => void;
  canDelete?: boolean;
}

export const AdminEditModal = ({ player, onSave, onDelete, onClose, canDelete = true }: AdminEditModalProps) => {
  const [name, setName] = useState(player.name);
  const [wins, setWins] = useState(player.wins.toString());
  const [losses, setLosses] = useState(player.losses.toString());
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError('Name is required');
    const w = parseInt(wins, 10);
    const l = parseInt(losses, 10);
    if (isNaN(w) || isNaN(l)) return setError('Wins and losses must be numbers');

    setError('');
    setSaving(true);
    try {
      await onSave({ ...player, name: name.trim(), wins: w, losses: l });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save');
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you absolutely sure you want to PERMANENTLY delete ${player.name} from the database?`)) return;
    setDeleting(true);
    try {
      await onDelete(player.id);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to delete');
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="glass-dark border border-cyan-500/30 p-6 rounded-2xl w-full max-w-sm"
        style={{ boxShadow: '0 0 50px rgba(0,217,255,0.1)' }}>
        
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚙️</span>
            <h2 className="text-xl font-cyber font-bold gradient-text">Admin Edit</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-smooth">✕</button>
        </div>

        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl overflow-hidden border border-cyan-500/50 flex flex-shrink-0 items-center justify-center">
            {player.avatar ? (
              <img src={player.avatar} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center text-sm font-cyber font-bold text-white">
                {getAvatarInitials(player.name)}
              </div>
            )}
          </div>
          <div className="px-2 py-1 bg-red-500/10 border border-red-500/30 text-red-400 text-[10px] font-bold uppercase rounded">
            ID: {player.id.substring(0, 8)}...
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-cyan-500/70 mb-1">PLAYER NAME</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              disabled={saving || deleting}
              className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white outline-none focus:border-cyan-500 transition-colors font-cyber" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-cyan-500/70 mb-1">TOTAL WINS</label>
              <input type="number" min="0" value={wins} onChange={e => setWins(e.target.value)}
                disabled={saving || deleting}
                className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-green-400 font-bold outline-none focus:border-cyan-500 transition-colors font-cyber" />
            </div>
            <div>
              <label className="block text-xs font-bold text-cyan-500/70 mb-1">TOTAL LOSSES</label>
              <input type="number" min="0" value={losses} onChange={e => setLosses(e.target.value)}
                disabled={saving || deleting}
                className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-red-400 font-bold outline-none focus:border-cyan-500 transition-colors font-cyber" />
            </div>
          </div>

          {error && <p className="text-red-400 text-sm font-bold text-center mt-2">{error}</p>}

          <div className="pt-4 grid grid-cols-2 gap-3 border-t border-white/10 mt-2">
            <button type="submit" disabled={saving || deleting}
              className={`py-3 bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-500/50 text-cyan-300 font-bold rounded-xl transition-smooth disabled:opacity-50 ${!canDelete ? 'col-span-2' : ''}`}>
              {saving ? 'Saving...' : '💾 Save'}
            </button>
            {canDelete && (
              <button type="button" onClick={handleDelete} disabled={saving || deleting}
                className="py-3 bg-red-600/20 hover:bg-red-600/40 border border-red-500/50 text-red-400 font-bold rounded-xl transition-smooth disabled:opacity-50">
                {deleting ? '...' : '🗑️ Delete Player'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
