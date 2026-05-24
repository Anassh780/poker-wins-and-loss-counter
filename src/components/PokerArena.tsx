import { useState, useEffect, useRef, type FC } from 'react';
import { PlayingCard, type CardData, type Suit, type Rank } from './PlayingCard';
import { db } from '../lib/firebase';
import { doc, onSnapshot, setDoc, updateDoc, getDoc } from 'firebase/firestore';
import type { User } from 'firebase/auth';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ArenaRoom {
  roomId: string;
  hostId: string;
  players: { id: string; name: string; avatar: string }[];
  status: 'waiting' | 'shuffling' | 'dealing' | 'reveal' | 'done';
  deck: CardData[];
  hands: Record<string, CardData[]>;
  revealedBy: string[];
  createdAt: number;
}

interface PokerArenaProps {
  currentUser: User | null;
  globalPlayers: { id: string; name: string; avatar: string }[];
  onClose: () => void;
}

// ─── Deck helpers ─────────────────────────────────────────────────────────────
const SUITS: Suit[] = ['♠', '♥', '♦', '♣'];
const RANKS: Rank[] = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];

function buildDeck(): CardData[] {
  const deck: CardData[] = [];
  for (const suit of SUITS) for (const rank of RANKS) deck.push({ suit, rank });
  return deck;
}

function shuffle(deck: CardData[]): CardData[] {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

function dealCards(deck: CardData[], playerIds: string[]): Record<string, CardData[]> {
  const hands: Record<string, CardData[]> = {};
  playerIds.forEach(id => { hands[id] = []; });
  const perPlayer = Math.floor(deck.length / playerIds.length);
  let idx = 0;
  for (let c = 0; c < perPlayer; c++) {
    for (const id of playerIds) {
      hands[id].push(deck[idx++]);
    }
  }
  return hands;
}

const ARENA_COLL = 'arena_rooms';

// ─── Lobby Screen ─────────────────────────────────────────────────────────────
const Lobby: FC<{
  currentUser: User | null;
  globalPlayers: { id: string; name: string; avatar: string }[];
  onCreateRoom: (playerCount: number) => void;
  onJoinRoom: (roomId: string) => void;
}> = ({ currentUser, onCreateRoom, onJoinRoom }) => {
  const [count, setCount] = useState(2);
  const [joinId, setJoinId] = useState('');
  const [tab, setTab] = useState<'create' | 'join'>('create');

  return (
    <div className="flex flex-col items-center gap-6 py-6 px-4 max-w-md mx-auto">
      <div className="text-center">
        <div className="text-5xl mb-2">🃏</div>
        <h2 className="text-2xl font-black text-cyan-300 tracking-widest">POKER ARENA</h2>
        <p className="text-gray-400 text-sm mt-1">Deal cards online with 2–8 players</p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 bg-black/40 rounded-xl p-1 w-full">
        {(['create', 'join'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${tab === t ? 'bg-cyan-500 text-black' : 'text-gray-400 hover:text-white'}`}>
            {t === 'create' ? '🎮 Create Room' : '🔗 Join Room'}
          </button>
        ))}
      </div>

      {tab === 'create' && (
        <div className="w-full flex flex-col gap-4">
          <div>
            <p className="text-gray-400 text-xs mb-2 uppercase tracking-wider">Number of Players</p>
            <div className="grid grid-cols-4 gap-2">
              {[2,3,4,5,6,7,8].map(n => (
                <button key={n} onClick={() => setCount(n)}
                  className={`py-2 rounded-lg font-black text-lg transition-all border-2 ${count === n ? 'bg-cyan-500 border-cyan-400 text-black' : 'bg-black/30 border-white/10 text-gray-300 hover:border-cyan-500/50'}`}>
                  {n}
                </button>
              ))}
            </div>
            <p className="text-gray-500 text-xs mt-2 text-center">
              Each player gets {Math.floor(52 / count)} cards
            </p>
          </div>
          <button onClick={() => onCreateRoom(count)}
            className="w-full py-3 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-xl font-black text-white text-lg hover:opacity-90 transition-all shadow-lg shadow-cyan-500/20">
            CREATE ROOM
          </button>
        </div>
      )}

      {tab === 'join' && (
        <div className="w-full flex flex-col gap-4">
          <div>
            <p className="text-gray-400 text-xs mb-2 uppercase tracking-wider">Room Code</p>
            <input value={joinId} onChange={e => setJoinId(e.target.value.toUpperCase())}
              placeholder="Enter room code..."
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-center text-xl tracking-widest font-mono focus:outline-none focus:border-cyan-500"
              maxLength={8}
            />
          </div>
          <button onClick={() => joinId.trim() && onJoinRoom(joinId.trim())}
            disabled={!joinId.trim()}
            className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl font-black text-white text-lg hover:opacity-90 transition-all disabled:opacity-40 shadow-lg shadow-purple-500/20">
            JOIN ROOM
          </button>
        </div>
      )}

      {!currentUser && (
        <p className="text-yellow-400 text-xs text-center bg-yellow-400/10 border border-yellow-400/20 rounded-lg px-4 py-2">
          ⚠️ Sign in to play online. You can still create a local room.
        </p>
      )}
    </div>
  );
};

// ─── Waiting Room ─────────────────────────────────────────────────────────────
const WaitingRoom: FC<{
  room: ArenaRoom;
  currentUser: User | null;
  myProfile: { id: string; name: string; avatar: string } | null;
  onJoinAsPlayer: () => void;
  onStartDeal: () => void;
  onLeave: () => void;
}> = ({ room, currentUser, onJoinAsPlayer, onStartDeal, onLeave }) => {
  const isHost = currentUser?.uid === room.hostId;
  const amInRoom = room.players.some(p => p.id === currentUser?.uid);
  const canStart = isHost && room.players.length >= 2;

  return (
    <div className="flex flex-col gap-5 py-4 px-4 max-w-lg mx-auto">
      <div className="text-center">
        <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Room Code</p>
        <div className="text-3xl font-black text-cyan-300 tracking-widest font-mono bg-black/40 rounded-xl py-2 px-6 inline-block border border-cyan-500/30">
          {room.roomId}
        </div>
        <p className="text-gray-500 text-xs mt-2">Share this code with friends to join</p>
      </div>

      <div>
        <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">
          Players ({room.players.length} / 8)
        </p>
        <div className="flex flex-col gap-2">
          {room.players.map((p, i) => (
            <div key={p.id} className="flex items-center gap-3 bg-black/30 rounded-xl px-4 py-2.5 border border-white/5">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-sm font-black overflow-hidden flex-shrink-0">
                {p.avatar ? <img src={p.avatar} className="w-full h-full object-cover" alt="" /> : p.name[0]?.toUpperCase()}
              </div>
              <span className="text-white font-bold text-sm flex-1">{p.name}</span>
              {i === 0 && <span className="text-yellow-400 text-xs">👑 Host</span>}
              {p.id === currentUser?.uid && <span className="text-cyan-400 text-xs">You</span>}
            </div>
          ))}
          {room.players.length < 2 && (
            <div className="text-center text-gray-600 text-sm py-3 border border-dashed border-white/10 rounded-xl">
              Waiting for more players...
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {!amInRoom && (
          <button onClick={onJoinAsPlayer}
            className="w-full py-3 bg-gradient-to-r from-green-500 to-teal-600 rounded-xl font-black text-white hover:opacity-90 transition-all">
            JOIN AS PLAYER
          </button>
        )}
        {canStart && (
          <button onClick={onStartDeal}
            className="w-full py-3 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-xl font-black text-white text-lg hover:opacity-90 transition-all shadow-lg shadow-cyan-500/20">
            🃏 SHUFFLE & DEAL
          </button>
        )}
        {!canStart && isHost && (
          <p className="text-center text-gray-500 text-xs">Need at least 2 players to start</p>
        )}
        <button onClick={onLeave}
          className="w-full py-2 bg-black/30 border border-white/10 rounded-xl text-gray-400 text-sm hover:text-red-400 hover:border-red-500/30 transition-all">
          Leave Room
        </button>
      </div>
    </div>
  );
};

// ─── Shuffle Animation ────────────────────────────────────────────────────────
const ShuffleAnimation: FC<{ onDone: () => void }> = ({ onDone }) => {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 400);
    const t2 = setTimeout(() => setPhase(2), 900);
    const t3 = setTimeout(() => setPhase(3), 1400);
    const t4 = setTimeout(() => onDone(), 2000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [onDone]);

  const cards = Array.from({ length: 7 });

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-12">
      <div className="relative h-28 w-48">
        {cards.map((_, i) => (
          <div key={i} style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: `translate(-50%, -50%) rotate(${phase >= 1 ? (i - 3) * (phase >= 2 ? 12 : 5) : 0}deg) translateX(${phase >= 2 ? (i - 3) * 8 : 0}px)`,
            transition: 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1)',
            zIndex: i,
          }}>
            <PlayingCard faceDown />
          </div>
        ))}
      </div>
      <div className="text-center">
        <p className="text-cyan-300 font-black text-xl tracking-widest animate-pulse">
          {phase < 2 ? '🔀 SHUFFLING...' : phase < 3 ? '🃏 DEALING...' : '✅ READY!'}
        </p>
        <p className="text-gray-500 text-xs mt-1">52 cards being distributed</p>
      </div>
      <div className="flex gap-1">
        {[0,1,2].map(i => (
          <div key={i} className="w-2 h-2 rounded-full bg-cyan-500"
            style={{ animation: `bounce 0.6s ${i * 0.15}s infinite alternate` }} />
        ))}
      </div>
    </div>
  );
};

// ─── Card Hand Display ────────────────────────────────────────────────────────
const HandDisplay: FC<{
  player: { id: string; name: string; avatar: string };
  cards: CardData[];
  revealed: boolean;
  isMe: boolean;
  onReveal: () => void;
  totalPlayers: number;
}> = ({ player, cards, revealed, isMe, onReveal, totalPlayers }) => {
  const [showCards, setShowCards] = useState(false);
  const [animating, setAnimating] = useState(false);

  const handleReveal = () => {
    if (animating) return;
    setAnimating(true);
    setTimeout(() => { setShowCards(true); setAnimating(false); }, 300);
    onReveal();
  };

  // Auto-show if already revealed
  useEffect(() => {
    if (revealed) setShowCards(true);
  }, [revealed]);

  return (
    <div className={`rounded-2xl border p-4 transition-all ${isMe ? 'border-cyan-500/60 bg-cyan-500/5' : 'border-white/10 bg-black/20'}`}>
      {/* Player header */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center font-black text-sm overflow-hidden flex-shrink-0">
          {player.avatar ? <img src={player.avatar} className="w-full h-full object-cover" alt="" /> : player.name[0]?.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm truncate">{player.name} {isMe && <span className="text-cyan-400 text-xs">(You)</span>}</p>
          <p className="text-gray-500 text-xs">{cards.length} cards</p>
        </div>
        {revealed
          ? <span className="text-green-400 text-xs font-bold bg-green-400/10 px-2 py-1 rounded-lg">👁 Revealed</span>
          : isMe
            ? <button onClick={handleReveal}
                className="px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-lg text-white text-xs font-black hover:opacity-90 transition-all shadow-md shadow-cyan-500/20">
                SEE CARDS
              </button>
            : <span className="text-gray-600 text-xs">🔒 Hidden</span>
        }
      </div>

      {/* Cards grid */}
      <div className="flex flex-wrap gap-1.5 justify-start">
        {cards.map((card, i) => (
          <div key={i} style={{
            animation: showCards ? `dealIn 0.35s ease-out ${i * 0.04}s both` : undefined,
          }}>
            <PlayingCard
              card={showCards ? card : undefined}
              faceDown={!showCards}
              small={totalPlayers > 3 || cards.length > 13}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Game Table ───────────────────────────────────────────────────────────────
const GameTable: FC<{
  room: ArenaRoom;
  currentUser: User | null;
  onReveal: () => void;
  onNewGame: () => void;
  onLeave: () => void;
}> = ({ room, currentUser, onReveal, onNewGame, onLeave }) => {
  const [localShuffling, setLocalShuffling] = useState(room.status === 'shuffling' || room.status === 'dealing');
  const isHost = currentUser?.uid === room.hostId;
  const allRevealed = room.players.length > 0 && room.players.every(p => room.revealedBy.includes(p.id));
  const myId = currentUser?.uid || '';

  useEffect(() => {
    if (room.status === 'shuffling' || room.status === 'dealing') {
      setLocalShuffling(true);
    } else {
      setLocalShuffling(false);
    }
  }, [room.status]);

  if (localShuffling) {
    return <ShuffleAnimation onDone={() => setLocalShuffling(false)} />;
  }

  return (
    <div className="flex flex-col gap-4 py-4 px-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-400 text-xs uppercase tracking-wider">Room</p>
          <p className="text-cyan-300 font-black font-mono tracking-widest">{room.roomId}</p>
        </div>
        <div className="flex items-center gap-2">
          {allRevealed && <span className="text-green-400 text-xs bg-green-400/10 px-2 py-1 rounded-lg font-bold">All Revealed!</span>}
          <span className="text-gray-500 text-xs">{room.players.length} players</span>
        </div>
      </div>

      {/* Reveal progress */}
      <div className="bg-black/30 rounded-xl px-4 py-2 flex items-center gap-3">
        <span className="text-gray-400 text-xs">Revealed:</span>
        <div className="flex gap-1 flex-1">
          {room.players.map(p => (
            <div key={p.id} title={p.name}
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black overflow-hidden border-2 transition-all ${room.revealedBy.includes(p.id) ? 'border-green-400 opacity-100' : 'border-gray-600 opacity-40'}`}
              style={{ background: 'linear-gradient(135deg,#06b6d4,#8b5cf6)' }}>
              {p.avatar ? <img src={p.avatar} className="w-full h-full object-cover" alt="" /> : p.name[0]}
            </div>
          ))}
        </div>
        <span className="text-gray-400 text-xs">{room.revealedBy.length}/{room.players.length}</span>
      </div>

      {/* Hands */}
      <div className="flex flex-col gap-3">
        {room.players.map(p => (
          <HandDisplay
            key={p.id}
            player={p}
            cards={room.hands[p.id] || []}
            revealed={room.revealedBy.includes(p.id)}
            isMe={p.id === myId}
            onReveal={onReveal}
            totalPlayers={room.players.length}
          />
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-2">
        {isHost && (
          <button onClick={onNewGame}
            className="flex-1 py-2.5 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-xl font-black text-white text-sm hover:opacity-90 transition-all">
            🔀 New Deal
          </button>
        )}
        <button onClick={onLeave}
          className="flex-1 py-2.5 bg-black/30 border border-white/10 rounded-xl text-gray-400 text-sm hover:text-red-400 hover:border-red-500/30 transition-all">
          Leave
        </button>
      </div>
    </div>
  );
};

// ─── Main PokerArena Component ────────────────────────────────────────────────
export const PokerArena: FC<PokerArenaProps> = ({ currentUser, globalPlayers, onClose }) => {
  const [screen, setScreen] = useState<'lobby' | 'room'>('lobby');
  const [room, setRoom] = useState<ArenaRoom | null>(null);
  const [error, setError] = useState('');
  const unsubRef = useRef<(() => void) | null>(null);

  const myProfile = currentUser
    ? globalPlayers.find(p => p.id === currentUser.uid) || {
        id: currentUser.uid,
        name: currentUser.displayName || 'Player',
        avatar: currentUser.photoURL || '',
      }
    : { id: `guest_${Date.now()}`, name: 'Guest', avatar: '' };

  const subscribeToRoom = (roomId: string) => {
    if (unsubRef.current) unsubRef.current();
    const ref = doc(db, ARENA_COLL, roomId);
    unsubRef.current = onSnapshot(ref, snap => {
      if (snap.exists()) {
        setRoom(snap.data() as ArenaRoom);
        setScreen('room');
      } else {
        setRoom(null);
        setScreen('lobby');
      }
    }, err => {
      console.error('Arena room listener error:', err);
      setError('Connection error. Check Firestore rules.');
    });
  };

  useEffect(() => () => { if (unsubRef.current) unsubRef.current(); }, []);

  const handleCreateRoom = async (_playerCount: number) => {
    setError('');
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const newRoom: ArenaRoom = {
      roomId,
      hostId: myProfile.id,
      players: [{ id: myProfile.id, name: myProfile.name, avatar: myProfile.avatar }],
      status: 'waiting',
      deck: [],
      hands: {},
      revealedBy: [],
      createdAt: Date.now(),
    };
    try {
      await setDoc(doc(db, ARENA_COLL, roomId), newRoom);
      subscribeToRoom(roomId);
    } catch (e: any) {
      // Fallback: local-only mode
      setRoom(newRoom);
      setScreen('room');
    }
  };

  const handleJoinRoom = async (roomId: string) => {
    setError('');
    try {
      const ref = doc(db, ARENA_COLL, roomId);
      subscribeToRoom(roomId);
      // Add self to players list
      setTimeout(async () => {
        try {
          const snap = await getDoc(ref);
          if (!snap.exists()) { setError('Room not found.'); setScreen('lobby'); return; }
          const data = snap.data() as ArenaRoom;
          if (data.players.some(p => p.id === myProfile.id)) return;
          if (data.players.length >= 8) { setError('Room is full (max 8 players).'); return; }
          await updateDoc(ref, {
            players: [...data.players, { id: myProfile.id, name: myProfile.name, avatar: myProfile.avatar }]
          });
        } catch (e: any) { setError('Could not join room: ' + e.message); }
      }, 500);
    } catch (e: any) {
      setError('Room not found or connection error.');
    }
  };

  const handleJoinAsPlayer = async () => {
    if (!room) return;
    if (room.players.some(p => p.id === myProfile.id)) return;
    const ref = doc(db, ARENA_COLL, room.roomId);
    try {
      await updateDoc(ref, {
        players: [...room.players, { id: myProfile.id, name: myProfile.name, avatar: myProfile.avatar }]
      });
    } catch { /* local fallback */
      setRoom(prev => prev ? { ...prev, players: [...prev.players, { id: myProfile.id, name: myProfile.name, avatar: myProfile.avatar }] } : prev);
    }
  };

  const handleStartDeal = async () => {
    if (!room) return;
    const shuffled = shuffle(buildDeck());
    const hands = dealCards(shuffled, room.players.map(p => p.id));
    const updated: Partial<ArenaRoom> = { status: 'shuffling', deck: shuffled, hands, revealedBy: [] };
    const ref = doc(db, ARENA_COLL, room.roomId);
    try {
      await updateDoc(ref, updated);
      setTimeout(async () => {
        try { await updateDoc(ref, { status: 'reveal' }); } catch { /* ignore */ }
      }, 2200);
    } catch {
      setRoom(prev => prev ? { ...prev, ...updated, status: 'reveal' } : prev);
    }
  };

  const handleReveal = async () => {
    if (!room) return;
    if (room.revealedBy.includes(myProfile.id)) return;
    const newRevealed = [...room.revealedBy, myProfile.id];
    const ref = doc(db, ARENA_COLL, room.roomId);
    try {
      await updateDoc(ref, { revealedBy: newRevealed });
    } catch {
      setRoom(prev => prev ? { ...prev, revealedBy: newRevealed } : prev);
    }
  };

  const handleNewGame = async () => {
    if (!room) return;
    const shuffled = shuffle(buildDeck());
    const hands = dealCards(shuffled, room.players.map(p => p.id));
    const updated: Partial<ArenaRoom> = { status: 'shuffling', deck: shuffled, hands, revealedBy: [] };
    const ref = doc(db, ARENA_COLL, room.roomId);
    try {
      await updateDoc(ref, updated);
      setTimeout(async () => {
        try { await updateDoc(ref, { status: 'reveal' }); } catch { /* ignore */ }
      }, 2200);
    } catch {
      setRoom(prev => prev ? { ...prev, ...updated, status: 'reveal' } : prev);
    }
  };

  const handleLeave = () => {
    if (unsubRef.current) unsubRef.current();
    setRoom(null);
    setScreen('lobby');
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-start justify-center overflow-y-auto"
      style={{ background: 'rgba(5,8,30,0.97)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-2xl min-h-screen relative">
        {/* Header bar */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-white/10"
          style={{ background: 'rgba(5,8,30,0.95)', backdropFilter: 'blur(12px)' }}>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🃏</span>
            <span className="text-cyan-300 font-black tracking-widest text-sm">POKER ARENA</span>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-all flex items-center justify-center text-lg">
            ✕
          </button>
        </div>

        {error && (
          <div className="mx-4 mt-3 px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
            ⚠️ {error}
          </div>
        )}

        {screen === 'lobby' && (
          <Lobby
            currentUser={currentUser}
            globalPlayers={globalPlayers}
            onCreateRoom={handleCreateRoom}
            onJoinRoom={handleJoinRoom}
          />
        )}

        {screen === 'room' && room && (room.status === 'waiting') && (
          <WaitingRoom
            room={room}
            currentUser={currentUser}
            myProfile={myProfile}
            onJoinAsPlayer={handleJoinAsPlayer}
            onStartDeal={handleStartDeal}
            onLeave={handleLeave}
          />
        )}

        {screen === 'room' && room && (room.status === 'shuffling' || room.status === 'dealing' || room.status === 'reveal' || room.status === 'done') && (
          <GameTable
            room={room}
            currentUser={currentUser}
            onReveal={handleReveal}
            onNewGame={handleNewGame}
            onLeave={handleLeave}
          />
        )}
      </div>
    </div>
  );
};
