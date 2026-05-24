import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getAvatarInitials } from '../utils/imageExport';

type VoteType = 'like' | 'dislike';

interface VoteRecord {
  id: string;
  voterId: string;
  voterName: string;
  voterAvatar: string;
  voteType: VoteType;
  timestamp: number;
}

interface VotersListProps {
  playerId?: string;
  isTestingMode: boolean;
}

export const VotersList = ({ playerId, isTestingMode }: VotersListProps) => {
  const [votes, setVotes] = useState<VoteRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!playerId) {
      setVotes([]);
      setLoading(false);
      setError('');
      return;
    }

    let cancelled = false;

    const loadVotes = async () => {
      setLoading(true);
      setError('');

      try {
        const votesCollection = isTestingMode ? 'votes_beta' : 'votes';
        const votesQuery = query(
          collection(db, votesCollection),
          where('targetPlayerId', '==', playerId)
        );
        const snap = await getDocs(votesQuery);
        const nextVotes = snap.docs
          .map((docSnap) => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              voterId: String(data.voterId || ''),
              voterName: String(data.voterName || 'Unknown Player'),
              voterAvatar: String(data.voterAvatar || ''),
              voteType: data.voteType === 'dislike' ? 'dislike' : 'like',
              timestamp: typeof data.timestamp === 'number' ? data.timestamp : 0,
            } satisfies VoteRecord;
          })
          .sort((a, b) => b.timestamp - a.timestamp);

        if (!cancelled) setVotes(nextVotes);
      } catch (err) {
        console.error('Failed to load voters:', err);
        if (!cancelled) setError('Could not load voters right now.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadVotes();

    return () => {
      cancelled = true;
    };
  }, [playerId, isTestingMode]);

  return (
    <div className="bg-black/35 border border-white/10 rounded-2xl p-4 mt-2">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-cyber font-bold text-white uppercase tracking-wider">Your Voters</h3>
          <p className="text-[10px] text-gray-500 mt-0.5">Players who rated your gameplay</p>
        </div>
        <span className="px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[10px] font-cyber font-bold">
          {votes.length}
        </span>
      </div>

      {!playerId && (
        <div className="py-5 text-center text-xs text-gray-500 border border-dashed border-white/10 rounded-xl">
          Finish profile registration to see voter history.
        </div>
      )}

      {playerId && loading && (
        <div className="py-5 text-center text-xs text-cyan-400 font-cyber uppercase tracking-widest animate-pulse">
          Loading voters...
        </div>
      )}

      {playerId && error && !loading && (
        <div className="py-5 text-center text-xs text-red-400 border border-red-500/20 rounded-xl">
          {error}
        </div>
      )}

      {playerId && !loading && !error && votes.length === 0 && (
        <div className="py-5 text-center text-xs text-gray-500 border border-dashed border-white/10 rounded-xl">
          No votes yet. Play an active match to earn peer ratings.
        </div>
      )}

      {playerId && !loading && !error && votes.length > 0 && (
        <div className="space-y-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
          {votes.map((vote) => (
            <div key={vote.id} className="flex items-center gap-3 rounded-xl bg-white/5 border border-white/5 px-3 py-2">
              <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 border border-white/10 bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center text-[10px] font-cyber font-bold text-white">
                {vote.voterAvatar ? (
                  <img src={vote.voterAvatar} alt={vote.voterName} className="w-full h-full object-cover" />
                ) : (
                  getAvatarInitials(vote.voterName)
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-white font-bold truncate">{vote.voterName}</p>
                <p className="text-[10px] text-gray-500">
                  {vote.timestamp > 0
                    ? `${formatDistanceToNow(new Date(vote.timestamp), { addSuffix: true })}`
                    : 'Recently'}
                </p>
              </div>
              <span
                className={`px-2.5 py-1 rounded-full text-[10px] font-cyber font-bold uppercase border flex-shrink-0 ${
                  vote.voteType === 'like'
                    ? 'bg-green-500/10 border-green-500/25 text-green-400'
                    : 'bg-red-500/10 border-red-500/25 text-red-400'
                }`}
              >
                {vote.voteType === 'like' ? 'Like' : 'Dislike'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
