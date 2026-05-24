import { useState, useEffect, useRef, useMemo, type FC } from 'react';
import { PlayingCard, type CardData, type Suit, type Rank } from './PlayingCard';
import { db } from '../lib/firebase';
import { doc, onSnapshot, setDoc, updateDoc, getDoc } from 'firebase/firestore';
import type { User } from 'firebase/auth';

// ══════════════════════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════════════════════
interface ArenaPlayer { id: string; name: string; avatar: string; isBot?: boolean; botLevel?: BotLevel; }

interface ArenaRoom {
  roomId: string; hostId: string;
  players: ArenaPlayer[];
  status: 'waiting' | 'shuffling' | 'reveal' | 'done';
  deck: CardData[]; hands: Record<string, CardData[]>;
  revealedBy: string[]; dealStep: number; createdAt: number;
}

interface PokerArenaProps {
  currentUser: User | null;
  globalPlayers: { id: string; name: string; avatar: string }[];
  onClose: () => void;
}

type BotLevel = 'rookie' | 'shark' | 'legend';

// ══════════════════════════════════════════════════════════════════════════════
// BOT AI ENGINE
// ══════════════════════════════════════════════════════════════════════════════

const RANK_VALUE: Record<Rank, number> = {
  '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,
  'J':11,'Q':12,'K':13,'A':14,
};

// Hand strength categories (higher = better)
type HandRank =
  | 'High Card' | 'One Pair' | 'Two Pair' | 'Three of a Kind'
  | 'Straight' | 'Flush' | 'Full House' | 'Four of a Kind'
  | 'Straight Flush' | 'Royal Flush';

interface HandEval { rank: HandRank; score: number; description: string; }

function evaluateHand(cards: CardData[]): HandEval {
  if (cards.length === 0) return { rank: 'High Card', score: 0, description: 'No cards' };

  const rankCounts: Record<string, number> = {};
  const suitCounts: Record<string, number> = {};
  const values = cards.map(c => RANK_VALUE[c.rank]).sort((a, b) => b - a);

  cards.forEach(c => {
    rankCounts[c.rank] = (rankCounts[c.rank] || 0) + 1;
    suitCounts[c.suit] = (suitCounts[c.suit] || 0) + 1;
  });

  const counts = Object.values(rankCounts).sort((a, b) => b - a);
  const isFlush = Object.values(suitCounts).some(v => v >= 5);
  const sortedVals = [...new Set(values)].sort((a, b) => a - b);
  const isStraight = sortedVals.length >= 5 &&
    sortedVals[sortedVals.length - 1] - sortedVals[sortedVals.length - 5] === 4;
  const isRoyal = isStraight && isFlush && values[0] === 14;
  const highCard = values[0];

  if (isRoyal) return { rank: 'Royal Flush', score: 900 + highCard, description: 'Royal Flush 👑' };
  if (isStraight && isFlush) return { rank: 'Straight Flush', score: 800 + highCard, description: 'Straight Flush 🔥' };
  if (counts[0] === 4) return { rank: 'Four of a Kind', score: 700 + highCard, description: 'Four of a Kind 💥' };
  if (counts[0] === 3 && counts[1] === 2) return { rank: 'Full House', score: 600 + highCard, description: 'Full House 🏠' };
  if (isFlush) return { rank: 'Flush', score: 500 + highCard, description: 'Flush ♠' };
  if (isStraight) return { rank: 'Straight', score: 400 + highCard, description: 'Straight ➡️' };
  if (counts[0] === 3) return { rank: 'Three of a Kind', score: 300 + highCard, description: 'Three of a Kind 🎯' };
  if (counts[0] === 2 && counts[1] === 2) return { rank: 'Two Pair', score: 200 + highCard, description: 'Two Pair ✌️' };
  if (counts[0] === 2) return { rank: 'One Pair', score: 100 + highCard, description: 'One Pair 👥' };
  return { rank: 'High Card', score: highCard, description: `High Card: ${cards[0]?.rank}` };
}

// Bot personality configs
const BOT_CONFIGS: Record<BotLevel, {
  name: string; emoji: string; avatar: string;
  thinkMs: [number, number]; // min/max think time
  bluffChance: number;       // 0-1 chance to bluff
  foldThreshold: number;     // score below which bot considers folding
  aggressionBonus: number;   // extra score added to simulate aggression
  comment: string[];         // bot chat messages
}> = {
  rookie: {
    name: 'Rookie Bot', emoji: '🤖', avatar: '',
    thinkMs: [800, 1500], bluffChance: 0.05, foldThreshold: 50,
    aggressionBonus: 0,
    comment: ['Hmm...', 'Let me think...', 'I got this!', 'Uh oh...'],
  },
  shark: {
    name: 'Shark Bot', emoji: '🦈', avatar: '',
    thinkMs: [400, 900], bluffChance: 0.2, foldThreshold: 80,
    aggressionBonus: 30,
    comment: ['Interesting...', 'I see your move.', 'Bold play.', 'Calculated.'],
  },
  legend: {
    name: 'Legend Bot', emoji: '👑', avatar: '',
    thinkMs: [200, 600], bluffChance: 0.35, foldThreshold: 120,
    aggressionBonus: 60,
    comment: ['Child\'s play.', 'Predictable.', 'I\'ve seen better.', 'Too easy.', 'GG.'],
  },
};

function createBot(level: BotLevel, index: number): ArenaPlayer {
  const cfg = BOT_CONFIGS[level];
  return {
    id: `bot_${level}_${index}_${Date.now()}`,
    name: `${cfg.emoji} ${cfg.name} ${index + 1}`,
    avatar: '',
    isBot: true,
    botLevel: level,
  };
}

// Bot decision: returns { action, comment }
function botDecide(cards: CardData[], level: BotLevel): { action: 'play' | 'fold'; comment: string; handInfo: HandEval } {
  const cfg = BOT_CONFIGS[level];
  const hand = evaluateHand(cards);
  const effectiveScore = hand.score + cfg.aggressionBonus + (Math.random() < cfg.bluffChance ? 200 : 0);
  const action = effectiveScore >= cfg.foldThreshold ? 'play' : 'fold';
  const comments = cfg.comment;
  const comment = comments[Math.floor(Math.random() * comments.length)];
  return { action, comment, handInfo: hand };
}

// ══════════════════════════════════════════════════════════════════════════════
// DECK HELPERS
// ══════════════════════════════════════════════════════════════════════════════
const SUITS: Suit[] = ['♠', '♥', '♦', '♣'];
const RANKS: Rank[] = ['A','K','Q','J','10','9','8','7','6','5','4','3','2'];

function buildDeck(): CardData[] {
  const d: CardData[] = [];
  for (const suit of SUITS) for (const rank of RANKS) d.push({ suit, rank });
  return d;
}
function shuffleDeck(deck: CardData[]): CardData[] {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}
function dealCards(deck: CardData[], ids: string[]): Record<string, CardData[]> {
  const h: Record<string, CardData[]> = {};
  ids.forEach(id => { h[id] = []; });
  const per = Math.floor(deck.length / ids.length);
  let idx = 0;
  for (let c = 0; c < per; c++) for (const id of ids) h[id].push(deck[idx++]);
  return h;
}

const ARENA_COLL = 'arena_rooms';

// ══════════════════════════════════════════════════════════════════════════════
// SEAT POSITIONS
// ══════════════════════════════════════════════════════════════════════════════
function getSeatStyle(index: number, total: number): React.CSSProperties {
  const P: Record<number, { top: string; left: string; transform: string }[]> = {
    2: [
      { top:'82%', left:'50%', transform:'translate(-50%,-50%)' },
      { top:'8%',  left:'50%', transform:'translate(-50%,-50%)' },
    ],
    3: [
      { top:'82%', left:'50%', transform:'translate(-50%,-50%)' },
      { top:'8%',  left:'25%', transform:'translate(-50%,-50%)' },
      { top:'8%',  left:'75%', transform:'translate(-50%,-50%)' },
    ],
    4: [
      { top:'82%', left:'50%', transform:'translate(-50%,-50%)' },
      { top:'8%',  left:'50%', transform:'translate(-50%,-50%)' },
      { top:'45%', left:'3%',  transform:'translate(0,-50%)' },
      { top:'45%', left:'97%', transform:'translate(-100%,-50%)' },
    ],
    5: [
      { top:'82%', left:'50%', transform:'translate(-50%,-50%)' },
      { top:'8%',  left:'30%', transform:'translate(-50%,-50%)' },
      { top:'8%',  left:'70%', transform:'translate(-50%,-50%)' },
      { top:'45%', left:'3%',  transform:'translate(0,-50%)' },
      { top:'45%', left:'97%', transform:'translate(-100%,-50%)' },
    ],
    6: [
      { top:'82%', left:'50%', transform:'translate(-50%,-50%)' },
      { top:'8%',  left:'50%', transform:'translate(-50%,-50%)' },
      { top:'8%',  left:'22%', transform:'translate(-50%,-50%)' },
      { top:'8%',  left:'78%', transform:'translate(-50%,-50%)' },
      { top:'45%', left:'3%',  transform:'translate(0,-50%)' },
      { top:'45%', left:'97%', transform:'translate(-100%,-50%)' },
    ],
    7: [
      { top:'82%', left:'50%', transform:'translate(-50%,-50%)' },
      { top:'8%',  left:'50%', transform:'translate(-50%,-50%)' },
      { top:'8%',  left:'22%', transform:'translate(-50%,-50%)' },
      { top:'8%',  left:'78%', transform:'translate(-50%,-50%)' },
      { top:'45%', left:'3%',  transform:'translate(0,-50%)' },
      { top:'45%', left:'97%', transform:'translate(-100%,-50%)' },
      { top:'68%', left:'3%',  transform:'translate(0,-50%)' },
    ],
    8: [
      { top:'82%', left:'50%', transform:'translate(-50%,-50%)' },
      { top:'8%',  left:'50%', transform:'translate(-50%,-50%)' },
      { top:'8%',  left:'22%', transform:'translate(-50%,-50%)' },
      { top:'8%',  left:'78%', transform:'translate(-50%,-50%)' },
      { top:'45%', left:'3%',  transform:'translate(0,-50%)' },
      { top:'45%', left:'97%', transform:'translate(-100%,-50%)' },
      { top:'68%', left:'3%',  transform:'translate(0,-50%)' },
      { top:'68%', left:'97%', transform:'translate(-100%,-50%)' },
    ],
  };
  const list = P[Math.min(total, 8)] || P[4];
  return { position: 'absolute', ...list[index] };
}

// ══════════════════════════════════════════════════════════════════════════════
// LOBBY
// ══════════════════════════════════════════════════════════════════════════════
const Lobby: FC<{
  currentUser: User | null;
  globalPlayers: { id: string; name: string; avatar: string }[];
  onCreateRoom: (count: number, bots: { count: number; level: BotLevel }) => void;
  onJoinRoom: (id: string) => void;
}> = ({ currentUser, onCreateRoom, onJoinRoom }) => {
  const [totalSeats, setTotalSeats] = useState(4);
  const [botCount, setBotCount] = useState(3);
  const [botLevel, setBotLevel] = useState<BotLevel>('shark');
  const [joinId, setJoinId] = useState('');
  const [tab, setTab] = useState<'create' | 'join'>('create');

  const humanSeats = totalSeats - botCount;

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:20, padding:'24px 16px', maxWidth:400, margin:'0 auto' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:56, marginBottom:8 }}>🃏</div>
        <h2 style={{ color:'#4ade80', fontWeight:900, fontSize:26, letterSpacing:3, margin:0 }}>POKER ARENA</h2>
        <p style={{ color:'#6b7280', fontSize:13, marginTop:4 }}>Play vs AI bots or real players</p>
      </div>

      {/* Tab */}
      <div style={{ display:'flex', width:'100%', borderRadius:12, overflow:'hidden', border:'1px solid rgba(255,255,255,0.1)' }}>
        {(['create','join'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex:1, padding:'10px 0', fontWeight:900, fontSize:13, cursor:'pointer', border:'none',
            background: tab===t ? '#16a34a' : 'rgba(0,0,0,0.5)',
            color: tab===t ? '#fff' : '#6b7280',
          }}>
            {t==='create' ? '🎮 Create Room' : '🔗 Join Room'}
          </button>
        ))}
      </div>

      {tab === 'create' && (
        <div style={{ width:'100%', display:'flex', flexDirection:'column', gap:16 }}>
          {/* Total seats */}
          <div>
            <p style={{ color:'#9ca3af', fontSize:11, textTransform:'uppercase', letterSpacing:2, marginBottom:8 }}>Total Seats</p>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
              {[2,3,4,5,6,7,8].map(n => (
                <button key={n} onClick={() => { setTotalSeats(n); setBotCount(Math.min(botCount, n-1)); }}
                  style={{
                    padding:'10px 0', borderRadius:10, fontWeight:900, fontSize:18, cursor:'pointer',
                    background: totalSeats===n ? '#16a34a' : 'rgba(0,0,0,0.4)',
                    border: `2px solid ${totalSeats===n ? '#4ade80' : 'rgba(255,255,255,0.1)'}`,
                    color: totalSeats===n ? '#fff' : '#9ca3af',
                  }}>
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Bot count */}
          <div>
            <p style={{ color:'#9ca3af', fontSize:11, textTransform:'uppercase', letterSpacing:2, marginBottom:8 }}>
              🤖 Bot Players: <span style={{ color:'#4ade80' }}>{botCount}</span>
              <span style={{ color:'#6b7280', marginLeft:8 }}>({humanSeats} human seat{humanSeats!==1?'s':''})</span>
            </p>
            <input type="range" min={0} max={totalSeats-1} value={botCount}
              onChange={e => setBotCount(Number(e.target.value))}
              style={{ width:'100%', accentColor:'#4ade80' }} />
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'#6b7280', marginTop:2 }}>
              <span>0 bots</span><span>{totalSeats-1} bots</span>
            </div>
          </div>

          {/* Bot difficulty */}
          {botCount > 0 && (
            <div>
              <p style={{ color:'#9ca3af', fontSize:11, textTransform:'uppercase', letterSpacing:2, marginBottom:8 }}>Bot Difficulty</p>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
                {([
                  { level:'rookie' as BotLevel, label:'🤖 Rookie', desc:'Easy', color:'#22c55e' },
                  { level:'shark'  as BotLevel, label:'🦈 Shark',  desc:'Hard', color:'#3b82f6' },
                  { level:'legend' as BotLevel, label:'👑 Legend', desc:'Expert', color:'#f59e0b' },
                ]).map(({ level, label, desc, color }) => (
                  <button key={level} onClick={() => setBotLevel(level)} style={{
                    padding:'10px 6px', borderRadius:10, cursor:'pointer', border:`2px solid ${botLevel===level ? color : 'rgba(255,255,255,0.1)'}`,
                    background: botLevel===level ? `${color}22` : 'rgba(0,0,0,0.4)',
                    display:'flex', flexDirection:'column', alignItems:'center', gap:2,
                  }}>
                    <span style={{ fontSize:13, fontWeight:900, color: botLevel===level ? color : '#9ca3af' }}>{label}</span>
                    <span style={{ fontSize:10, color:'#6b7280' }}>{desc}</span>
                  </button>
                ))}
              </div>
              {botLevel === 'legend' && (
                <p style={{ color:'#f59e0b', fontSize:11, marginTop:6, textAlign:'center' }}>
                  ⚠️ Legend bots have 35% bluff rate and expert hand reading. Good luck!
                </p>
              )}
            </div>
          )}

          <p style={{ color:'#6b7280', fontSize:11, textAlign:'center' }}>
            {Math.floor(52 / totalSeats)} cards per player
          </p>

          <button onClick={() => onCreateRoom(totalSeats, { count: botCount, level: botLevel })}
            style={{
              width:'100%', padding:'14px 0', borderRadius:12, fontWeight:900, fontSize:16,
              background:'linear-gradient(135deg,#16a34a,#15803d)', color:'#fff', border:'none', cursor:'pointer',
              boxShadow:'0 4px 20px rgba(22,163,74,0.4)',
            }}>
            {botCount > 0 ? `🎮 PLAY vs ${botCount} BOT${botCount>1?'S':''}` : '🎮 CREATE ROOM'}
          </button>
        </div>
      )}

      {tab === 'join' && (
        <div style={{ width:'100%', display:'flex', flexDirection:'column', gap:12 }}>
          <input value={joinId} onChange={e => setJoinId(e.target.value.toUpperCase())}
            placeholder="ROOM CODE"
            style={{
              width:'100%', padding:'12px 16px', borderRadius:12, fontSize:22,
              textAlign:'center', letterSpacing:4, fontFamily:'monospace',
              background:'rgba(0,0,0,0.5)', border:'2px solid rgba(74,222,128,0.3)',
              color:'#fff', outline:'none', boxSizing:'border-box',
            }}
            maxLength={8} />
          <button onClick={() => joinId.trim() && onJoinRoom(joinId.trim())}
            disabled={!joinId.trim()}
            style={{
              width:'100%', padding:'14px 0', borderRadius:12, fontWeight:900, fontSize:16,
              background:'linear-gradient(135deg,#7c3aed,#6d28d9)', color:'#fff', border:'none',
              cursor: joinId.trim() ? 'pointer' : 'not-allowed', opacity: joinId.trim() ? 1 : 0.4,
            }}>
            JOIN ROOM
          </button>
        </div>
      )}

      {!currentUser && (
        <p style={{ color:'#fbbf24', fontSize:11, textAlign:'center', background:'rgba(251,191,36,0.1)', border:'1px solid rgba(251,191,36,0.2)', borderRadius:8, padding:'8px 14px' }}>
          ⚠️ Sign in to play online. Bots work offline too.
        </p>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// WAITING ROOM
// ══════════════════════════════════════════════════════════════════════════════
const WaitingRoom: FC<{
  room: ArenaRoom; currentUser: User | null;
  onJoinAsPlayer: () => void; onStartDeal: () => void; onLeave: () => void;
}> = ({ room, currentUser, onJoinAsPlayer, onStartDeal, onLeave }) => {
  const isHost = currentUser?.uid === room.hostId;
  const amIn = room.players.some(p => p.id === (currentUser?.uid || ''));
  const bots = room.players.filter(p => p.isBot);
  const humans = room.players.filter(p => !p.isBot);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16, padding:'20px 16px', maxWidth:420, margin:'0 auto' }}>
      <div style={{ textAlign:'center' }}>
        <p style={{ color:'#9ca3af', fontSize:11, textTransform:'uppercase', letterSpacing:3, marginBottom:6 }}>Room Code</p>
        <div style={{ fontSize:36, fontWeight:900, fontFamily:'monospace', letterSpacing:6, padding:'10px 24px', borderRadius:14, display:'inline-block', background:'rgba(22,163,74,0.15)', border:'2px solid rgba(74,222,128,0.4)', color:'#4ade80' }}>
          {room.roomId}
        </div>
        <p style={{ color:'#6b7280', fontSize:11, marginTop:6 }}>Share with friends to join</p>
      </div>

      <div>
        <p style={{ color:'#9ca3af', fontSize:11, textTransform:'uppercase', letterSpacing:2, marginBottom:8 }}>
          Players ({room.players.length})
        </p>
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {humans.map((p, i) => (
            <div key={p.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderRadius:12, background:'rgba(0,0,0,0.4)', border:'1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ width:36, height:36, borderRadius:'50%', overflow:'hidden', background:'linear-gradient(135deg,#16a34a,#7c3aed)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, fontSize:14, color:'#fff', flexShrink:0 }}>
                {p.avatar ? <img src={p.avatar} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" /> : p.name[0]?.toUpperCase()}
              </div>
              <span style={{ color:'#fff', fontWeight:700, flex:1 }}>{p.name}</span>
              {i === 0 && <span style={{ color:'#fbbf24', fontSize:11 }}>👑 Host</span>}
              {p.id === currentUser?.uid && <span style={{ color:'#4ade80', fontSize:11, fontWeight:900 }}>YOU</span>}
            </div>
          ))}
          {bots.map(p => (
            <div key={p.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderRadius:12, background:'rgba(59,130,246,0.08)', border:'1px solid rgba(59,130,246,0.2)' }}>
              <div style={{ width:36, height:36, borderRadius:'50%', background:'linear-gradient(135deg,#1d4ed8,#7c3aed)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>
                {BOT_CONFIGS[p.botLevel || 'rookie'].emoji}
              </div>
              <span style={{ color:'#93c5fd', fontWeight:700, flex:1 }}>{p.name}</span>
              <span style={{ color:'#6b7280', fontSize:10, background:'rgba(59,130,246,0.15)', padding:'2px 8px', borderRadius:6 }}>
                {p.botLevel?.toUpperCase()} BOT
              </span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {!amIn && (
          <button onClick={onJoinAsPlayer} style={{ padding:'12px 0', borderRadius:12, fontWeight:900, fontSize:14, background:'linear-gradient(135deg,#16a34a,#15803d)', color:'#fff', border:'none', cursor:'pointer' }}>
            JOIN AS PLAYER
          </button>
        )}
        {isHost && (
          <button onClick={onStartDeal} style={{ padding:'14px 0', borderRadius:12, fontWeight:900, fontSize:16, background:'linear-gradient(135deg,#16a34a,#15803d)', color:'#fff', border:'none', cursor:'pointer', boxShadow:'0 4px 20px rgba(22,163,74,0.5)' }}>
            🃏 SHUFFLE & DEAL
          </button>
        )}
        <button onClick={onLeave} style={{ padding:'10px 0', borderRadius:12, fontWeight:700, fontSize:13, background:'rgba(0,0,0,0.3)', color:'#9ca3af', border:'1px solid rgba(255,255,255,0.08)', cursor:'pointer' }}>
          Leave Room
        </button>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// DECK PILE
// ══════════════════════════════════════════════════════════════════════════════
const DeckPile: FC<{ count: number; isShuffling: boolean }> = ({ count, isShuffling }) => (
  <div style={{ position:'relative', width:64, height:90, display:'flex', alignItems:'center', justifyContent:'center' }}>
    {Array.from({ length: Math.min(count, 10) }).map((_, i) => (
      <div key={i} style={{
        position:'absolute', top: -i*0.7, left: i*0.3, zIndex: i,
        animation: isShuffling ? `deckShuffle 0.25s ${i*0.03}s ease-in-out infinite alternate` : undefined,
      }}>
        <PlayingCard faceDown small />
      </div>
    ))}
    {count > 0 && (
      <div style={{ position:'absolute', bottom:-18, zIndex:20, color:'#4ade80', fontWeight:900, fontSize:10 }}>
        {count} left
      </div>
    )}
  </div>
);

// ══════════════════════════════════════════════════════════════════════════════
// PLAYER SEAT
// ══════════════════════════════════════════════════════════════════════════════
const PlayerSeat: FC<{
  player: ArenaPlayer; cards: CardData[];
  isMe: boolean; revealed: boolean;
  onReveal: () => void; visibleCount: number;
  botDecision?: { action: string; comment: string; handInfo: HandEval } | null;
  isThinking?: boolean;
}> = ({ player, cards, isMe, revealed, onReveal, visibleCount, botDecision, isThinking }) => {
  const [showCards, setShowCards] = useState(false);
  const dealtCards = cards.slice(0, visibleCount);
  const isBot = player.isBot;
  const levelColor = player.botLevel === 'legend' ? '#f59e0b' : player.botLevel === 'shark' ? '#3b82f6' : '#22c55e';

  useEffect(() => { if (revealed && isMe) setShowCards(true); }, [revealed, isMe]);
  // Bots auto-reveal after dealing
  useEffect(() => { if (isBot && dealtCards.length > 0) setShowCards(false); }, [isBot, dealtCards.length]);

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:5, minWidth:80 }}>
      {/* Avatar */}
      <div style={{ position:'relative' }}>
        <div style={{
          width: isMe ? 50 : 42, height: isMe ? 50 : 42, borderRadius:'50%', overflow:'hidden',
          border: isMe ? '3px solid #4ade80' : isBot ? `2px solid ${levelColor}` : '2px solid rgba(255,255,255,0.25)',
          boxShadow: isMe ? '0 0 16px rgba(74,222,128,0.6)' : isBot ? `0 0 12px ${levelColor}44` : '0 2px 8px rgba(0,0,0,0.5)',
          background: isBot ? `linear-gradient(135deg,#1d4ed8,#7c3aed)` : 'linear-gradient(135deg,#16a34a,#7c3aed)',
          display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, fontSize:isBot?20:15, color:'#fff',
        }}>
          {!isBot && player.avatar
            ? <img src={player.avatar} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" />
            : isBot ? BOT_CONFIGS[player.botLevel||'rookie'].emoji
            : player.name[0]?.toUpperCase()
          }
        </div>
        {isThinking && (
          <div style={{ position:'absolute', top:-6, right:-6, background:'#1d4ed8', borderRadius:'50%', width:18, height:18, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, animation:'pulse 0.6s infinite' }}>
            💭
          </div>
        )}
      </div>

      {/* Name tag */}
      <div style={{ background:'rgba(0,0,0,0.8)', borderRadius:7, padding:'2px 7px', textAlign:'center', maxWidth:100 }}>
        <p style={{ color: isMe ? '#4ade80' : isBot ? levelColor : '#fff', fontWeight:900, fontSize:10, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:90 }}>
          {isMe ? 'YOU' : player.name}
        </p>
        {isBot && botDecision && !isThinking && (
          <p style={{ color:'#6b7280', fontSize:9, fontStyle:'italic', maxWidth:90, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            "{botDecision.comment}"
          </p>
        )}
      </div>

      {/* Cards */}
      {dealtCards.length > 0 && (
        <div style={{ display:'flex', gap: isMe ? 3 : -10, flexWrap:'wrap', justifyContent:'center', maxWidth: isMe ? 320 : 72 }}>
          {dealtCards.map((card, i) => (
            <div key={i} style={{ animation:`dealIn 0.35s ease-out ${i*0.05}s both` }}>
              {(isMe && showCards)
                ? <PlayingCard card={card} small={dealtCards.length > 10} />
                : <PlayingCard faceDown small />
              }
            </div>
          ))}
        </div>
      )}

      {/* Bot hand info after reveal */}
      {isBot && botDecision && dealtCards.length > 0 && (
        <div style={{ background:'rgba(0,0,0,0.7)', borderRadius:6, padding:'2px 8px', border:`1px solid ${levelColor}44` }}>
          <span style={{ color: levelColor, fontSize:9, fontWeight:900 }}>{botDecision.handInfo.description}</span>
        </div>
      )}

      {/* See cards button for human */}
      {isMe && dealtCards.length > 0 && !showCards && (
        <button onClick={() => { setShowCards(true); onReveal(); }}
          style={{ marginTop:2, padding:'4px 12px', borderRadius:7, background:'linear-gradient(135deg,#16a34a,#15803d)', color:'#fff', fontWeight:900, fontSize:10, border:'none', cursor:'pointer', boxShadow:'0 2px 8px rgba(22,163,74,0.5)' }}>
          👁 SEE CARDS
        </button>
      )}
      {isMe && showCards && dealtCards.length > 0 && (
        <span style={{ fontSize:9, color:'#4ade80', fontWeight:700 }}>✓ Revealed</span>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// POKER TABLE
// ══════════════════════════════════════════════════════════════════════════════
const PokerTable: FC<{
  room: ArenaRoom; myId: string;
  onReveal: () => void; onNewGame: () => void; onLeave: () => void;
}> = ({ room, myId, onReveal, onNewGame, onLeave }) => {
  const isHost = myId === room.hostId;
  const perPlayer = Math.floor(52 / room.players.length);

  // Put "me" at seat 0
  const myIndex = room.players.findIndex(p => p.id === myId);
  const ordered = myIndex >= 0
    ? [...room.players.slice(myIndex), ...room.players.slice(0, myIndex)]
    : room.players;

  // Dealing animation
  const [visibleCounts, setVisibleCounts] = useState<Record<string, number>>({});
  const [deckLeft, setDeckLeft] = useState(52);
  const [isShuffling, setIsShuffling] = useState(false);
  const [dealDone, setDealDone] = useState(false);
  const dealRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Bot state
  const [botDecisions, setBotDecisions] = useState<Record<string, { action: string; comment: string; handInfo: HandEval } | null>>({});
  const [thinkingBots, setThinkingBots] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (room.status === 'shuffling') {
      setIsShuffling(true); setDealDone(false);
      setVisibleCounts({}); setDeckLeft(52);
      setBotDecisions({}); setThinkingBots(new Set());
    } else if ((room.status === 'reveal' || room.status === 'done') && !dealDone) {
      setIsShuffling(false); setDealDone(true);
      const players = room.players;
      const total = perPlayer * players.length;
      let cardIdx = 0;

      const dealNext = () => {
        if (cardIdx >= total) {
          setDeckLeft(52 - total);
          // Trigger bot thinking after all cards dealt
          triggerBotThinking();
          return;
        }
        const pid = players[cardIdx % players.length].id;
        setVisibleCounts(prev => ({ ...prev, [pid]: (prev[pid] || 0) + 1 }));
        setDeckLeft(prev => Math.max(0, prev - 1));
        cardIdx++;
        dealRef.current = setTimeout(dealNext, 110);
      };
      dealRef.current = setTimeout(dealNext, 500);
    }
    return () => { if (dealRef.current) clearTimeout(dealRef.current); };
  }, [room.status]);

  const triggerBotThinking = () => {
    const bots = room.players.filter(p => p.isBot);
    bots.forEach((bot, i) => {
      const cfg = BOT_CONFIGS[bot.botLevel || 'rookie'];
      const [minT, maxT] = cfg.thinkMs;
      const thinkTime = minT + Math.random() * (maxT - minT) + i * 300;

      setThinkingBots(prev => new Set([...prev, bot.id]));

      setTimeout(() => {
        const cards = room.hands[bot.id] || [];
        const decision = botDecide(cards, bot.botLevel || 'rookie');
        setBotDecisions(prev => ({ ...prev, [bot.id]: decision }));
        setThinkingBots(prev => { const s = new Set(prev); s.delete(bot.id); return s; });
      }, thinkTime);
    });
  };

  const allDealt = ordered.every(p => (visibleCounts[p.id] || 0) >= perPlayer);

  // Find winner among bots (highest hand score)
  const botWinner = allDealt && Object.keys(botDecisions).length > 0
    ? room.players
        .filter(p => p.isBot && botDecisions[p.id]?.action === 'play')
        .sort((a, b) => (botDecisions[b.id]?.handInfo.score || 0) - (botDecisions[a.id]?.handInfo.score || 0))[0]
    : null;

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', minHeight:0 }}>
      {/* Table */}
      <div style={{ flex:1, position:'relative', padding:'10px 6px 0', minHeight:300 }}>
        {/* Wood border */}
        <div style={{ position:'absolute', inset:6, borderRadius:'50%', background:'linear-gradient(145deg,#8B5E3C,#5C3A1E,#8B5E3C)', boxShadow:'0 8px 40px rgba(0,0,0,0.8)' }} />
        {/* Green felt */}
        <div style={{ position:'absolute', inset:24, borderRadius:'50%', background:'radial-gradient(ellipse at center,#1a6b2e 0%,#145a25 50%,#0f4a1e 100%)', boxShadow:'inset 0 4px 30px rgba(0,0,0,0.4)' }}>
          <div style={{ position:'absolute', inset:0, borderRadius:'50%', opacity:0.05, backgroundImage:'repeating-linear-gradient(45deg,#fff 0,#fff 1px,transparent 0,transparent 50%)', backgroundSize:'8px 8px' }} />
        </div>

        {/* Center deck */}
        <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', zIndex:10, display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
          <DeckPile count={deckLeft} isShuffling={isShuffling} />
          {isShuffling && (
            <div style={{ background:'rgba(0,0,0,0.85)', borderRadius:8, padding:'3px 10px', color:'#4ade80', fontWeight:900, fontSize:11, letterSpacing:2, animation:'pulse 0.8s infinite' }}>
              🔀 SHUFFLING...
            </div>
          )}
          {botWinner && allDealt && (
            <div style={{ background:'rgba(0,0,0,0.85)', borderRadius:8, padding:'4px 10px', color:'#f59e0b', fontWeight:900, fontSize:10, textAlign:'center', marginTop:4 }}>
              🏆 {botWinner.name} wins!
            </div>
          )}
        </div>

        {/* Seats */}
        <div style={{ position:'absolute', inset:0 }}>
          {ordered.map((player, seatIdx) => (
            <div key={player.id} style={{ ...getSeatStyle(seatIdx, ordered.length), zIndex:20 }}>
              <PlayerSeat
                player={player}
                cards={room.hands[player.id] || []}
                isMe={player.id === myId}
                revealed={room.revealedBy.includes(player.id)}
                onReveal={onReveal}
                visibleCount={visibleCounts[player.id] || 0}
                botDecision={player.isBot ? (botDecisions[player.id] || null) : null}
                isThinking={player.isBot ? thinkingBots.has(player.id) : false}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Action bar */}
      <div style={{ padding:'8px 14px 12px', display:'flex', gap:8, alignItems:'center', background:'rgba(0,0,0,0.65)', borderTop:'1px solid rgba(255,255,255,0.06)', flexShrink:0 }}>
        <div style={{ flex:1, display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          <span style={{ color:'#4ade80', fontSize:11, fontWeight:700, fontFamily:'monospace', letterSpacing:2 }}>{room.roomId}</span>
          <span style={{ color:'#6b7280', fontSize:10 }}>• {room.players.filter(p=>!p.isBot).length} human{room.players.filter(p=>p.isBot).length>0?` + ${room.players.filter(p=>p.isBot).length} bot`:''}</span>
          {allDealt && <span style={{ color:'#4ade80', fontSize:10, fontWeight:700 }}>✓ Dealt</span>}
        </div>
        {isHost && allDealt && (
          <button onClick={onNewGame} style={{ padding:'6px 14px', borderRadius:9, fontWeight:900, fontSize:12, background:'linear-gradient(135deg,#16a34a,#15803d)', color:'#fff', border:'none', cursor:'pointer' }}>
            🔀 New Deal
          </button>
        )}
        <button onClick={onLeave} style={{ padding:'6px 12px', borderRadius:9, fontWeight:700, fontSize:12, background:'rgba(239,68,68,0.15)', color:'#f87171', border:'1px solid rgba(239,68,68,0.3)', cursor:'pointer' }}>
          Leave
        </button>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export const PokerArena: FC<PokerArenaProps> = ({ currentUser, globalPlayers, onClose }) => {
  const [screen, setScreen] = useState<'lobby' | 'room'>('lobby');
  const [room, setRoom] = useState<ArenaRoom | null>(null);
  const [error, setError] = useState('');
  const unsubRef = useRef<(() => void) | null>(null);

  const myProfile = useMemo(() => currentUser
    ? globalPlayers.find(p => p.id === currentUser.uid) || {
        id: currentUser.uid, name: currentUser.displayName || 'Player', avatar: currentUser.photoURL || '',
      }
    : { id: `guest_${Math.random().toString(36).slice(2,8)}`, name: 'Guest', avatar: '' },
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

  const handleCreateRoom = async (_totalSeats: number, bots: { count: number; level: BotLevel }) => {
    setError('');
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const humanPlayer: ArenaPlayer = { id: myProfile.id, name: myProfile.name, avatar: myProfile.avatar };
    const botPlayers: ArenaPlayer[] = Array.from({ length: bots.count }, (_, i) => createBot(bots.level, i));
    const allPlayers = [humanPlayer, ...botPlayers];

    const newRoom: ArenaRoom = {
      roomId, hostId: myProfile.id, players: allPlayers,
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

  const startDeal = async (r: ArenaRoom) => {
    const shuffled = shuffleDeck(buildDeck());
    const hands = dealCards(shuffled, r.players.map(p => p.id));
    const update = { status: 'shuffling' as const, deck: shuffled, hands, revealedBy: [], dealStep: 0 };
    const ref = doc(db, ARENA_COLL, r.roomId);
    try {
      await updateDoc(ref, update);
      setTimeout(async () => { try { await updateDoc(ref, { status: 'reveal' }); } catch { /* ignore */ } }, 1800);
    } catch {
      setRoom(prev => prev ? { ...prev, ...update, status: 'reveal' } : prev);
    }
  };

  const handleStartDeal = () => { if (room) startDeal(room); };
  const handleNewGame = () => { if (room) startDeal(room); };

  const handleReveal = async () => {
    if (!room || room.revealedBy.includes(myProfile.id)) return;
    const newRevealed = [...room.revealedBy, myProfile.id];
    const ref = doc(db, ARENA_COLL, room.roomId);
    try { await updateDoc(ref, { revealedBy: newRevealed }); }
    catch { setRoom(prev => prev ? { ...prev, revealedBy: newRevealed } : prev); }
  };

  const handleLeave = () => { if (unsubRef.current) unsubRef.current(); setRoom(null); setScreen('lobby'); };

  return (
    <div style={{ position:'fixed', inset:0, zIndex:150, background:'radial-gradient(ellipse at center,#0d2b0d 0%,#071407 100%)', display:'flex', flexDirection:'column' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 16px', background:'rgba(0,0,0,0.65)', borderBottom:'1px solid rgba(74,222,128,0.15)', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:22 }}>🃏</span>
          <span style={{ color:'#4ade80', fontWeight:900, letterSpacing:3, fontSize:14 }}>POKER ARENA</span>
          {room && <span style={{ color:'#6b7280', fontSize:11, marginLeft:4 }}>• {room.players.filter(p=>p.isBot).length > 0 ? `${room.players.filter(p=>p.isBot).length} bots` : 'online'}</span>}
        </div>
        <button onClick={onClose} style={{ width:32, height:32, borderRadius:8, background:'rgba(239,68,68,0.15)', border:'1px solid rgba(239,68,68,0.3)', color:'#f87171', fontSize:16, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
      </div>

      {error && (
        <div style={{ margin:'8px 16px', padding:'8px 14px', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:10, color:'#f87171', fontSize:13 }}>
          ⚠️ {error}
        </div>
      )}

      <div style={{ flex:1, overflow:'auto', minHeight:0 }}>
        {screen === 'lobby' && (
          <Lobby currentUser={currentUser} globalPlayers={globalPlayers}
            onCreateRoom={handleCreateRoom} onJoinRoom={handleJoinRoom} />
        )}
        {screen === 'room' && room && room.status === 'waiting' && (
          <WaitingRoom room={room} currentUser={currentUser}
            onJoinAsPlayer={handleJoinAsPlayer} onStartDeal={handleStartDeal} onLeave={handleLeave} />
        )}
        {screen === 'room' && room && (room.status === 'shuffling' || room.status === 'reveal' || room.status === 'done') && (
          <PokerTable room={room} myId={myProfile.id}
            onReveal={handleReveal} onNewGame={handleNewGame} onLeave={handleLeave} />
        )}
      </div>
    </div>
  );
};
