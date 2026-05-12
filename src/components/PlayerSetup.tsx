import { useState, useRef, type ChangeEvent, type FormEvent } from 'react';
import type { Player } from '../types';
import { getAvatarInitials } from '../utils/imageExport';
import { auth } from '../lib/firebase';

interface PlayerSetupProps {
  onAddPlayer: (player: Partial<Player>) => Promise<void>;
  onClose?: () => void;
  initialPlayer?: Player;
  isEditing?: boolean;
  recentPlayers?: Player[];
  onQuickAdd?: (player: Player) => void;
}

/** Resize + compress an image to a small thumbnail via canvas.
 *  Returns a tiny base64 JPEG (~10-20 KB) regardless of original size. */
const compressImage = (file: File, maxSize = 150, quality = 0.75): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = (ev) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to decode image'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale  = Math.min(maxSize / img.width, maxSize / img.height, 1);
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  });

export const PlayerSetup = ({
  onAddPlayer,
  onClose,
  initialPlayer,
  isEditing = false,
  recentPlayers = [],
  onQuickAdd,
}: PlayerSetupProps) => {
  const [name, setName]         = useState(initialPlayer?.name   || '');
  const [avatar, setAvatar]     = useState<string | null>(initialPlayer?.avatar || null);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [imgLoading, setImgLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compress before preview so what you see = what gets saved (fast tiny base64)
  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setImgLoading(true);
    try {
      const compressed = await compressImage(file);
      setAvatar(compressed);
    } catch {
      setError('Failed to process image. Try another file.');
    } finally {
      setImgLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Player name is required');
      return;
    }
    if (name.trim().length < 2) {
      setError('Name must be at least 2 characters');
      return;
    }
    if (!auth.currentUser) {
      setError('Please login to add players');
      return;
    }

    setLoading(true);
    try {
      // avatar is already a base64 string (or null) — pass it directly
      await onAddPlayer({
        ...(initialPlayer?.id ? { id: initialPlayer.id } : {}),
        name:   name.trim(),
        avatar: avatar || undefined,
        wins:   initialPlayer?.wins   || 0,
        losses: initialPlayer?.losses || 0,
      });
    } catch (err) {
      console.error('Error adding player:', err);
      setError('Failed to save player. Please try again.');
    } finally {
      setLoading(false);
    }

    if (!isEditing) {
      setName('');
      setAvatar(null);
      setError('');
    }
  };

  return (
    <div className="glass-dark p-6 rounded-xl border border-cyan-500/50 w-full max-w-md">
      <h3 className="text-2xl font-cyber font-bold text-cyan-300 mb-6">
        {isEditing ? '✎ Edit Player' : '➕ Add New Player'}
      </h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Player Name */}
        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-2">
            Player Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setError(''); }}
            placeholder="Enter player name..."
            className="w-full bg-black/40 border border-cyan-500/30 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-smooth"
            autoComplete="off"
            maxLength={30}
          />
          {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
        </div>

        {/* Recent Players Quick Select */}
        {!isEditing && recentPlayers.length > 0 && (
          <div>
            <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1.5 px-0.5">
              Rapid Add (Already Played)
            </label>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide hide-scrollbar">
              {recentPlayers.map(p => (
                <button key={p.id} type="button" 
                  onClick={() => {
                    if (onQuickAdd) {
                      onQuickAdd(p);
                    } else {
                      setName(p.name);
                      if (p.avatar) setAvatar(p.avatar);
                    }
                  }}
                  className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full py-1 pr-3 pl-1 transition-smooth flex-shrink-0">
                  <div className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0 border border-cyan-500/30">
                    {p.avatar ? (
                      <img src={p.avatar} alt="avatar" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center text-[8px] font-cyber font-bold text-white">
                        {getAvatarInitials(p.name)}
                      </div>
                    )}
                  </div>
                  <span className="text-xs font-cyber text-cyan-200">{p.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Avatar Upload */}
        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-2">
            Player Avatar <span className="text-gray-600 font-normal">(optional · max 2 MB)</span>
          </label>
          <div className="flex gap-3 items-start">
            {/* Preview */}
            <div className="w-20 h-20 rounded-lg overflow-hidden border-2 border-cyan-500/50 flex items-center justify-center bg-gradient-to-br from-purple-500 to-cyan-500 flex-shrink-0">
              {avatar
                ? <img src={avatar} alt="preview" className="w-full h-full object-cover" />
                : <span className="text-3xl font-cyber font-bold">{name ? getAvatarInitials(name) : '?'}</span>
              }
            </div>

            {/* Buttons */}
            <div className="flex-1 flex flex-col gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={imgLoading}
                className="w-full px-4 py-2 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-lg text-purple-300 hover:border-purple-500/50 hover:bg-purple-500/30 transition-smooth font-semibold text-sm disabled:opacity-50"
              >
                {imgLoading ? '⏳ Compressing...' : '📷 Choose Image'}
              </button>
              {avatar && (
                <button
                  type="button"
                  onClick={() => setAvatar(null)}
                  className="w-full px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 hover:border-red-500/50 hover:bg-red-500/20 transition-smooth font-semibold text-sm"
                >
                  ✕ Remove
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={loading}
            className={`flex-1 px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-cyber font-bold rounded-lg transition-smooth glow-cyan hover:shadow-lg ${loading ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            {loading ? '⏳ Saving...' : isEditing ? '✓ Save Changes' : '➕ Add Player'}
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold rounded-lg transition-smooth"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
};
