import { useState, useEffect, useRef, useMemo, type FC } from 'react';
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
  dealStep: number; // which card index is currently being dealt (for animation)
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

function shuffleDeck(deck: CardData[]): CardData[] {
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

// ─── Player positions around the oval table ───────────────────────────────────
// Returns CSS position style for each seat index given total players
function getSeatStyle(index: number, total: number): React.CSSProperties {
  // Positions as % of table container: [top%, left%, transform-origin]
  const positions: Record<number, { top: string; left: string; transform: string }[]> = {
    2: [
      { top: '82%', left: '50%', transform: 'translate(-50%,-50%)' },   // bottom (you)
      { top: '8%',  left: '50%', transform: 'translate(-50%,-50%)' },   // top
    ],
    3: [
      { top: '82%', left: '50%', transform: 'translate(-50%,-50%)' },
      { top: '8%',  left: '25%', transform: 'translate(-50%,-50%)' },
      { top: '8%',  left: '75%', transform: 'translate(-50%,-50%)' },
    ],
    4: [
      { top: '82%', left: '50%', transform: 'translate(-50%,-50%)' },
      { top: '8%',  left: '50%', transform: 'translate(-50%,-50%)' },
      { top: '45%', left: '3%',  transform: 'translate(0,-50%)' },
      { top: '45%', left: '97%', transform: 'translate(-100%,-50%)' },
    ],
    5: [
      { top: '82%', left: '50%', transform: 'translate(-50%,-50%)' },
      { top: '8%',  left: '30%', transform: 'translate(-50%,-50%)' },
      { top: '8%',  left: '70%', transform: 'translate(-50%,-50%)' },
      { top: '45%', left: '3%',  transform: 'translate(0,-50%)' },
      { top: '45%', left: '97%', transform: 'translate(-100%,-50%)' },
    ],
    6: [
      { top: '82%', left: '50%', transform: 'translate(-50%,-50%)' },
      { top: '8%',  left: '50%', transform: 'translate(-50%,-50%)' },
      { top: '8%',  left: '22%', transform: 'translate(-50%,-50%)' },
      { top: '8%',  left: '78%', transform: 'translate(-50%,-50%)' },
      { top: '45%', left: '3%',  transform: 'translate(0,-50%)' },
      { top: '45%', left: '97%', transform: 'translate(-100%,-50%)' },
    ],
    7: [
      { top: '82%', left: '50%', transform: 'translate(-50%,-50%)' },
      { top: '8%',  left: '50%', transform: 'translate(-50%,-50%)' },
      { top: '8%',  left: '22%', transform: 'translate(-50%,-50%)' },
      { top: '8%',  left: '78%', transform: 'translate(-50%,-50%)' },
      { top: '45%', left: '3%',  transform: 'translate(0,-50%)' },
      { top: '45%', left: '97%', transform: 'translate(-100%,-50%)' },
      { top: '68%', left: '3%',  transform: 'translate(0,-50%)' },
    ],
    8: [
      { top: '82%', left: '50%', transform: 'translate(-50%,-50%)' },
      { top: '8%',  left: '50%', transform: 'translate(-50%,-50%)' },
      { top: '8%',  left: '22%', transform: 'translate(-50%,-50%)' },
      { top: '8%',  left: '78%', transform: 'translate(-50%,-50%)' },
      { top: '45%', left: '3%',  transform: 'translate(0,-50%)' },
      { top: '45%', left: '97%', transform: 'translate(-100%,-50%)' },
      { top: '68%', left: '3%',  transform: 'translate(0,-50%)' },
      { top: '68%', left: '97%', transform: 'translate(-100%,-50%)' },
    ],
  };
  const list = positions[total] || positions[4];
  return { position: 'absolute', ...list[index] };
}

// ─── Lobby ────────────────────────────────────────────────────────────────────
const Lobby: FC<{
  currentUser: User | null;
  globalPlayers: { id: string; name: string; avatar: string }[];
  onCreateRoom: (count: number) => void;
  onJoinRoom: (id: string) => void;
}> = ({ currentUser, onCreateRoom, onJoinRoom }) => {
  const [count, setCount] = useState(2);
  const [joinId, setJoinId] = useState('');
  const [tab, setTab] = useState<'create' | 'join'>('create');

  return (
    <div className="flex flex-col items-center gap-6 py-8 px-4 max-w-sm mx-auto">
      <div className="text-center">
        <div className="text-6xl mb-3">🃏</div>
        <h2 className="text-3xl font-black tracking-widest" style={{ color: '#4ade80' }}>POKER ARENA</h2>
        <p className="text-gray-400 text-sm mt-1">Real cards. Real players. Online.</p>
      </div>

      <div className="flex gap-2 w-full rounded-xl overflow-hidden border border-white/10">
        {(['create', 'join'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="flex-1 py-2.5 text-sm font-black transition-all"
            style={{ background: tab === t ? '#16a34a' : 'rgba(0,0,0,0.4)', color: tab === t ? '#fff' : '#6b7280' }}>
            {t === 'create' ? '🎮 Create Room' : '🔗 Join Room'}
          </button>
        ))}
      </div>

      {tab === 'create' && (
        <div className="w-full flex flex-col gap-4">
          <p className="text-gray-400 text-xs uppercase tracking-wider text-center">Players at table</p>
          <div className="grid grid-cols-4 gap-2">
            {[2,3,4,5,6,7,8].map(n => (
              <button key={n} onClick={() => setCount(n)}
                className="py-2.5 rounded-xl font-black text-xl transition-all border-2"
                style={{
                  background: count === n ? '#16a34a' : 'rgba(0,0,0,0.4)',
                  borderColor: count === n ? '#4ade80' : 'rgba(255,255,255,0.1)',
                  color: count === n ? '#fff' : '#9ca3af',
                }}>
                {n}
              </button>
            ))}
          </div>
          <p className="text-gray-500 text-xs text-center">{Math.floor(52 / count)} cards per player</p>
          <button onClick={() => onCreateRoom(count)}
            className="w-full py-3.5 rounded-xl font-black text-white text-lg transition-all"
            style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)', boxShadow: '0 4px 20px rgba(22,163,74,0.4)' }}>
            CREATE ROOM
          </button>
        </div>
      )}

      {tab === 'join' && (
        <div className="w-full flex flex-col gap-4">
          <input value={joinId} onChange={e => setJoinId(e.target.value.toUpperCase())}
            placeholder="ROOM CODE"
            className="w-full rounded-xl px-4 py-3 text-white text-center text-2xl tracking-widest font-mono focus:outline-none"
            style={{ background: 'rgba(0,0,0,0.5)', border: '2px solid rgba(74,222,128,0.3)' }}
            maxLength={8} />
          <button onClick={() => joinId.trim() && onJoinRoom(joinId.trim())}
            disabled={!joinId.trim()}
            className="w-full py-3.5 rounded-xl font-black text-white text-lg transition-all disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', boxShadow: '0 4px 20px rgba(124,58,237,0.4)' }}>
            JOIN ROOM
          </button>
        </div>
      )}

      {!currentUser && (
        <p className="text-yellow-400 text-xs text-center bg-yellow-400/10 border border-yellow-400/20 rounded-lg px-4 py-2">
          ⚠️ Sign in to play online. Local mode available.
        </p>
      )}
    </div>
  );
};

// ─── Waiting Room ─────────────────────────────────────────────────────────────
const WaitingRoom: FC<{
  room: ArenaRoom;
  currentUser: User | null;
  onJoinAsPlayer: () => void;
  onStartDeal: () => void;
  onLeave: () => void;
}> = ({ room, currentUser, onJoinAsPlayer, onStartDeal, onLeave }) => {
  const isHost = currentUser?.uid === room.hostId;
  const amIn = room.players.some(p => p.id === (currentUser?.uid || ''));

  return (
    <div className="flex flex-col gap-5 py-6 px-4 max-w-md mx-auto">
      <div className="text-center">
        <p className="text-gray-400 text-xs uppercase tracking-widest mb-2">Room Code</p>
        <div className="text-4xl font-black font-mono tracking-widest py-3 px-8 rounded-2xl inline-block"
          style={{ background: 'rgba(22,163,74,0.15)', border: '2px solid rgba(74,222,128,0.4)', color: '#4ade80' }}>
          {room.roomId}
        </div>
        <p className="text-gray-500 text-xs mt-2">Share this code with friends</p>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-gray-400 text-xs uppercase tracking-wider">Players ({room.players.length}/8)</p>
        {room.players.map((p, i) => (
          <div key={p.id} className="flex items-center gap-3 rounded-xl px-4 py-3"
            style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center font-black text-sm"
              style={{ background: 'linear-gradient(135deg,#16a34a,#7c3aed)' }}>
              {p.avatar ? <img src={p.avatar} className="w-full h-full object-cover" alt="" /> : p.name[0]?.toUpperCase()}
            </div>
            <span className="text-white font-bold flex-1">{p.name}</span>
            {i === 0 && <span className="text-yellow-400 text-xs">👑 Host</span>}
            {p.id === currentUser?.uid && <span className="text-green-400 text-xs font-bold">YOU</span>}
          </div>
        ))}
        {room.players.length < 2 && (
          <div className="text-center text-gray-600 text-sm py-4 rounded-xl border border-dashed border-white/10">
            Waiting for more players...
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 mt-2">
        {!amIn && (
          <button onClick={onJoinAsPlayer}
            className="w-full py-3 rounded-xl font-black text-white"
            style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)' }}>
            JOIN AS PLAYER
          </button>
        )}
        {isHost && room.players.length >= 2 && (
          <button onClick={onStartDeal}
            className="w-full py-3.5 rounded-xl font-black text-white text-lg"
            style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)', boxShadow: '0 4px 24px rgba(22,163,74,0.5)' }}>
            🃏 SHUFFLE & DEAL
          </button>
        )}
        {isHost && room.players.length < 2 && (
          <p className="text-center text-gray-500 text-xs">Need at least 2 players</p>
        )}
        <button onClick={onLeave}
          className="w-full py-2.5 rounded-xl text-gray-400 text-sm"
          style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)' }}>
          Leave Room
        </button>
      </div>
    </div>
  );
};

// ─── Deck pile in center (52 stacked cards) ───────────────────────────────────
const DeckPile: FC<{ count: number; isShuffling: boolean }> = ({ count, isShuffling }) => (
  <div className="relative flex items-center justify-center" style={{ width: 72, height: 100 }}>
    {/* Stack of cards */}
    {Array.from({ length: Math.min(count, 12) }).map((_, i) => (
      <div key={i} style={{
        position: 'absolute',
        top: -i * 0.8,
        left: i * 0.3,
        zIndex: i,
        animation: isShuffling ? `deckShuffle 0.3s ${i * 0.04}s ease-in-out infinite alternate` : undefined,
      }}>
        <PlayingCard faceDown small />
      </div>
    ))}
    {count > 0 && (
      <div style={{ position: 'absolute', bottom: -18, zIndex: 20 }}>
        <span style={{ fontSize: 10, color: '#4ade80', fontWeight: 900 }}>{count} cards</span>
      </div>
    )}
  </div>
);

// ─── Single player seat on the table ─────────────────────────────────────────
const PlayerSeat: FC<{
  player: { id: string; name: string; avatar: string };
  cards: CardData[];
  isMe: boolean;
  isDealing: boolean;
  dealingCardIndex: number; // which card is currently flying to this seat
  revealed: boolean;
  onReveal: () => void;
  cardCount: number; // total cards this player should have
  visibleCardCount: number; // how many have been dealt so far
}> = ({ player, cards, isMe, revealed, onReveal, visibleCardCount }) => {
  const [showCards, setShowCards] = useState(false);

  useEffect(() => {
    if (revealed && isMe) setShowCards(true);
  }, [revealed, isMe]);

  const handleReveal = () => {
    setShowCards(true);
    onReveal();
  };

  // Only show as many cards as have been dealt
  const dealtCards = cards.slice(0, visibleCardCount);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 90 }}>
      {/* Avatar + name */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
        <div style={{
          width: isMe ? 52 : 44,
          height: isMe ? 52 : 44,
          borderRadius: '50%',
          overflow: 'hidden',
          border: isMe ? '3px solid #4ade80' : '2px solid rgba(255,255,255,0.3)',
          boxShadow: isMe ? '0 0 16px rgba(74,222,128,0.6)' : '0 2px 8px rgba(0,0,0,0.5)',
          background: 'linear-gradient(135deg,#16a34a,#7c3aed)',
          flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 900, fontSize: 16, color: '#fff',
        }}>
          {player.avatar
            ? <img src={player.avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
            : player.name[0]?.toUpperCase()}
        </div>
        <div style={{
          background: 'rgba(0,0,0,0.75)',
          borderRadius: 8,
          padding: '2px 8px',
          textAlign: 'center',
        }}>
          <p style={{ color: isMe ? '#4ade80' : '#fff', fontWeight: 900, fontSize: 11, whiteSpace: 'nowrap' }}>
            {isMe ? 'YOU' : player.name}
          </p>
        </div>
      </div>

      {/* Cards */}
      {dealtCards.length > 0 && (
        <div style={{ display: 'flex', gap: isMe ? 4 : -8, flexWrap: 'wrap', justifyContent: 'center', maxWidth: isMe ? 300 : 80 }}>
          {dealtCards.map((card, i) => (
            <div key={i} style={{ animation: `dealIn 0.4s ease-out ${i * 0.06}s both` }}>
              {isMe && showCards
                ? <PlayingCard card={card} small={dealtCards.length > 10} />
                : <PlayingCard faceDown small />
              }
            </div>
          ))}
        </div>
      )}

      {/* See Cards button for me */}
      {isMe && dealtCards.length > 0 && !showCards && (
        <button onClick={handleReveal}
          style={{
            marginTop: 4,
            padding: '5px 14px',
            borderRadius: 8,
            background: 'linear-gradient(135deg,#16a34a,#15803d)',
            color: '#fff',
            fontWeight: 900,
            fontSize: 11,
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 2px 10px rgba(22,163,74,0.5)',
          }}>
          👁 SEE MY CARDS
        </button>
      )}
      {isMe && showCards && dealtCards.length > 0 && (
        <span style={{ fontSize: 10, color: '#4ade80', fontWeight: 700 }}>✓ Revealed</span>
      )}
    </div>
  );
};

// ─── Poker Table ──────────────────────────────────────────────────────────────
const PokerTable: FC<{
  room: ArenaRoom;
  myId: string;
  onReveal: () => void;
  onNewGame: () => void;
  onLeave: () => void;
}> = ({ room, myId, onReveal, onNewGame, onLeave }) => {
  const isHost = myId === room.hostId;
  const perPlayer = Math.floor(52 / room.players.length);

  // Reorder players so "me" is always index 0 (bottom seat)
  const myIndex = room.players.findIndex(p => p.id === myId);
  const orderedPlayers = myIndex >= 0
    ? [...room.players.slice(myIndex), ...room.players.slice(0, myIndex)]
    : room.players;

  // Dealing animation state: how many cards each player has received so far
  const [visibleCounts, setVisibleCounts] = useState<Record<string, number>>({});
  const [deckRemaining, setDeckRemaining] = useState(52);
  const [isShuffling, setIsShuffling] = useState(false);
  const [shuffleDone, setShuffleDone] = useState(false);
  const dealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (room.status === 'shuffling') {
      setIsShuffling(true);
      setShuffleDone(false);
      setVisibleCounts({});
      setDeckRemaining(52);
    } else if (room.status === 'reveal' || room.status === 'done') {
      setIsShuffling(false);
      if (!shuffleDone) {
        // Start sequential dealing animation
        setShuffleDone(true);
        const players = room.players;
        const total = perPlayer * players.length;
        let cardIdx = 0;

        const dealNext = () => {
          if (cardIdx >= total) {
            setDeckRemaining(52 - total);
            return;
          }
          const playerIdx = cardIdx % players.length;
          const pid = players[playerIdx].id;
          setVisibleCounts(prev => ({ ...prev, [pid]: (prev[pid] || 0) + 1 }));
          setDeckRemaining(prev => Math.max(0, prev - 1));
          cardIdx++;
          dealTimerRef.current = setTimeout(dealNext, 120);
        };

        // Short pause after shuffle before dealing
        dealTimerRef.current = setTimeout(dealNext, 600);
      }
    }
    return () => { if (dealTimerRef.current) clearTimeout(dealTimerRef.current); };
  }, [room.status]);

  const allDealt = orderedPlayers.every(p => (visibleCounts[p.id] || 0) >= perPlayer);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Table area */}
      <div style={{ flex: 1, position: 'relative', padding: '12px 8px 0' }}>
        {/* Outer wood border */}
        <div style={{
          position: 'absolute', inset: 8,
          borderRadius: '50%',
          background: 'linear-gradient(145deg, #8B5E3C, #5C3A1E, #8B5E3C)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.8), inset 0 2px 4px rgba(255,255,255,0.1)',
        }} />
        {/* Green felt */}
        <div style={{
          position: 'absolute', inset: 28,
          borderRadius: '50%',
          background: 'radial-gradient(ellipse at center, #1a6b2e 0%, #145a25 50%, #0f4a1e 100%)',
          boxShadow: 'inset 0 4px 30px rgba(0,0,0,0.4)',
        }}>
          {/* Felt pattern overlay */}
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%', opacity: 0.06,
            backgroundImage: 'repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 0, transparent 50%)',
            backgroundSize: '8px 8px',
          }} />
        </div>

        {/* Center deck pile */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 10,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        }}>
          <DeckPile count={deckRemaining} isShuffling={isShuffling} />
          {isShuffling && (
            <div style={{
              background: 'rgba(0,0,0,0.8)', borderRadius: 10, padding: '4px 12px',
              color: '#4ade80', fontWeight: 900, fontSize: 12, letterSpacing: 2,
              animation: 'pulse 0.8s infinite',
            }}>
              🔀 SHUFFLING...
            </div>
          )}
        </div>

        {/* Players around the table */}
        <div style={{ position: 'absolute', inset: 0 }}>
          {orderedPlayers.map((player, seatIdx) => (
            <div key={player.id} style={{ ...getSeatStyle(seatIdx, orderedPlayers.length), zIndex: 20 }}>
              <PlayerSeat
                player={player}
                cards={room.hands[player.id] || []}
                isMe={player.id === myId}
                isDealing={room.status === 'reveal'}
                dealingCardIndex={0}
                revealed={room.revealedBy.includes(player.id)}
                onReveal={onReveal}
                cardCount={perPlayer}
                visibleCardCount={visibleCounts[player.id] || 0}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Bottom action bar */}
      <div style={{
        padding: '10px 16px 14px',
        display: 'flex', gap: 8, alignItems: 'center',
        background: 'rgba(0,0,0,0.6)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0,
      }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: '#4ade80', fontSize: 11, fontWeight: 700 }}>
            Room: <span style={{ fontFamily: 'monospace', letterSpacing: 2 }}>{room.roomId}</span>
          </span>
          <span style={{ color: '#6b7280', fontSize: 10 }}>• {room.players.length} players</span>
          {allDealt && <span style={{ color: '#4ade80', fontSize: 10, fontWeight: 700 }}>✓ All dealt</span>}
        </div>
        {isHost && allDealt && (
          <button onClick={onNewGame}
            style={{
              padding: '7px 16px', borderRadius: 10, fontWeight: 900, fontSize: 12,
              background: 'linear-gradient(135deg,#16a34a,#15803d)',
              color: '#fff', border: 'none', cursor: 'pointer',
            }}>
            🔀 New Deal
          </button>
        )}
        <button onClick={onLeave}
          style={{
            padding: '7px 14px', borderRadius: 10, fontWeight: 700, fontSize: 12,
            background: 'rgba(239,68,68,0.15)', color: '#f87171',
            border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer',
          }}>
          Leave
        </button>
      </div>
    </div>
  );
};

// ─── Main PokerArena ──────────────────────────────────────────────────────────
export const PokerArena: FC<PokerArenaProps> = ({ currentUser, globalPlayers, onClose }) => {
  const [screen, setScreen] = useState<'lobby' | 'room'>('lobby');
  const [room, setRoom] = useState<ArenaRoom | null>(null);
  const [error, setError] = useState('');
  const unsubRef = useRef<(() => void) | null>(null);

  const myProfile = useMemo(() => currentUser
    ? globalPlayers.find(p => p.id === currentUser.uid) || {
        id: currentUser.uid,
        name: currentUser.displayName || 'Player',
        avatar: currentUser.photoURL || '',
      }
    : { id: `guest_${Math.random().toString(36).slice(2, 8)}`, name: 'Guest', avatar: '' },
  [currentUser, globalPlayers]);

  const subscribeToRoom = (roomId: string) => {
    if (unsubRef.current) unsubRef.current();
    const ref = doc(db, ARENA_COLL, roomId);
    unsubRef.current = onSnapshot(ref, snap => {
      if (snap.exists()) { setRoom(snap.data() as ArenaRoom); setScreen('room'); }
      else { setRoom(null); setScreen('lobby'); }
    }, err => { console.error(err); setError('Connection error. Check Firestore rules.'); });
  };

  useEffect(() => () => { if (unsubRef.current) unsubRef.current(); }, []);

  const handleCreateRoom = async (_count: number) => {
    setError('');
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const newRoom: ArenaRoom = {
      roomId, hostId: myProfile.id,
      players: [{ id: myProfile.id, name: myProfile.name, avatar: myProfile.avatar }],
      status: 'waiting', deck: [], hands: {}, revealedBy: [], dealStep: 0, createdAt: Date.now(),
    };
    try {
      await setDoc(doc(db, ARENA_COLL, roomId), newRoom);
      subscribeToRoom(roomId);
    } catch {
      setRoom(newRoom); setScreen('room');
    }
  };

  const handleJoinRoom = async (roomId: string) => {
    setError('');
    const ref = doc(db, ARENA_COLL, roomId);
    subscribeToRoom(roomId);
    setTimeout(async () => {
      try {
        const snap = await getDoc(ref);
        if (!snap.exists()) { setError('Room not found.'); setScreen('lobby'); return; }
        const data = snap.data() as ArenaRoom;
        if (data.players.some(p => p.id === myProfile.id)) return;
        if (data.players.length >= 8) { setError('Room is full.'); return; }
        await updateDoc(ref, { players: [...data.players, { id: myProfile.id, name: myProfile.name, avatar: myProfile.avatar }] });
      } catch (e: any) { setError('Could not join: ' + e.message); }
    }, 400);
  };

  const handleJoinAsPlayer = async () => {
    if (!room || room.players.some(p => p.id === myProfile.id)) return;
    const ref = doc(db, ARENA_COLL, room.roomId);
    try {
      await updateDoc(ref, { players: [...room.players, { id: myProfile.id, name: myProfile.name, avatar: myProfile.avatar }] });
    } catch {
      setRoom(prev => prev ? { ...prev, players: [...prev.players, { id: myProfile.id, name: myProfile.name, avatar: myProfile.avatar }] } : prev);
    }
  };

  const handleStartDeal = async () => {
    if (!room) return;
    const shuffled = shuffleDeck(buildDeck());
    const hands = dealCards(shuffled, room.players.map(p => p.id));
    const ref = doc(db, ARENA_COLL, room.roomId);
    const update = { status: 'shuffling' as const, deck: shuffled, hands, revealedBy: [], dealStep: 0 };
    try {
      await updateDoc(ref, update);
      // After shuffle animation, switch to reveal
      setTimeout(async () => {
        try { await updateDoc(ref, { status: 'reveal' }); } catch { /* ignore */ }
      }, 1800);
    } catch {
      setRoom(prev => prev ? { ...prev, ...update, status: 'reveal' } : prev);
    }
  };

  const handleReveal = async () => {
    if (!room || room.revealedBy.includes(myProfile.id)) return;
    const newRevealed = [...room.revealedBy, myProfile.id];
    const ref = doc(db, ARENA_COLL, room.roomId);
    try { await updateDoc(ref, { revealedBy: newRevealed }); }
    catch { setRoom(prev => prev ? { ...prev, revealedBy: newRevealed } : prev); }
  };

  const handleNewGame = async () => {
    if (!room) return;
    const shuffled = shuffleDeck(buildDeck());
    const hands = dealCards(shuffled, room.players.map(p => p.id));
    const ref = doc(db, ARENA_COLL, room.roomId);
    const update = { status: 'shuffling' as const, deck: shuffled, hands, revealedBy: [], dealStep: 0 };
    try {
      await updateDoc(ref, update);
      setTimeout(async () => {
        try { await updateDoc(ref, { status: 'reveal' }); } catch { /* ignore */ }
      }, 1800);
    } catch {
      setRoom(prev => prev ? { ...prev, ...update, status: 'reveal' } : prev);
    }
  };

  const handleLeave = () => {
    if (unsubRef.current) unsubRef.current();
    setRoom(null); setScreen('lobby');
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 150,
      background: 'radial-gradient(ellipse at center, #0d2b0d 0%, #071407 100%)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px',
        background: 'rgba(0,0,0,0.6)',
        borderBottom: '1px solid rgba(74,222,128,0.15)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 22 }}>🃏</span>
          <span style={{ color: '#4ade80', fontWeight: 900, letterSpacing: 3, fontSize: 14 }}>POKER ARENA</span>
        </div>
        <button onClick={onClose} style={{
          width: 32, height: 32, borderRadius: 8,
          background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
          color: '#f87171', fontSize: 16, cursor: 'pointer', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }}>✕</button>
      </div>

      {error && (
        <div style={{ margin: '8px 16px', padding: '8px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, color: '#f87171', fontSize: 13 }}>
          ⚠️ {error}
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {screen === 'lobby' && (
          <Lobby currentUser={currentUser} globalPlayers={globalPlayers}
            onCreateRoom={handleCreateRoom} onJoinRoom={handleJoinRoom} />
        )}
        {screen === 'room' && room && room.status === 'waiting' && (
          <WaitingRoom room={room} currentUser={currentUser}
            onJoinAsPlayer={handleJoinAsPlayer} onStartDeal={handleStartDeal} onLeave={handleLeave} />
        )}
        {screen === 'room' && room && (room.status === 'shuffling' || room.status === 'dealing' || room.status === 'reveal' || room.status === 'done') && (
          <PokerTable room={room} myId={myProfile.id}
            onReveal={handleReveal} onNewGame={handleNewGame} onLeave={handleLeave} />
        )}
      </div>
    </div>
  );
};
