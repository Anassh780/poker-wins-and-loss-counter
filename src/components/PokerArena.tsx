import { useState, useEffect, useRef, useMemo, type FC } from 'react';
import { PlayingCard, SuitMark, ClassicPips, type CardData, type Suit, type Rank } from './PlayingCard';
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
  publicRevealedBy?: string[];
  packedPlayerIds?: string[];
  playedCards?: PlayedCard[];
  discardPile?: PlayedCard[];
  capturedPiles?: Record<string, PlayedCard[]>;
  currentTurnId?: string;
  gameStarted?: boolean;
  leadSuit?: Suit | '';
  winnerId?: string;
  winnerName?: string;
  winnerAvatar?: string;
  winnerIds?: string[];
  winnerNames?: string[];
  loserIds?: string[];
  loserNames?: string[];
  endedReason?: string;
}

interface PokerArenaProps {
  currentUser: User | null;
  globalPlayers: { id: string; name: string; avatar: string }[];
  onClose: () => void;
}

type BotLevel = 'rookie' | 'shark' | 'legend';
type HandStyle = 'readable' | 'classic';
type CardGroupMode = 'suit' | 'rank';

interface PlayedCard {
  playerId: string;
  playerName: string;
  card: CardData;
  order: number;
  timestamp: number;
  isCut?: boolean;
  capturedBy?: string;
  capturedAt?: number;
}

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
function getCardsPerPlayer(cardCount: number, playerCount: number): number {
  return playerCount > 0 ? Math.floor(cardCount / playerCount) : 0;
}

function getCardDistribution(cardCount: number, playerCount: number): number[] {
  if (playerCount <= 0) return [];
  const base = getCardsPerPlayer(cardCount, playerCount);
  const extra = cardCount % playerCount;
  return Array.from({ length: playerCount }, (_, index) => base + (index < extra ? 1 : 0));
}

function getCardDistributionLabel(cardCount: number, playerCount: number): string {
  const distribution = getCardDistribution(cardCount, playerCount);
  if (distribution.length === 0) return '0 cards per player';

  const min = Math.min(...distribution);
  const max = Math.max(...distribution);
  return min === max ? `${min} cards per player` : `${min}-${max} cards per player`;
}

function dealCards(deck: CardData[], ids: string[]): Record<string, CardData[]> {
  const h: Record<string, CardData[]> = {};
  ids.forEach(id => { h[id] = []; });
  if (ids.length === 0) return h;
  deck.forEach((card, index) => {
    h[ids[index % ids.length]].push(card);
  });
  return h;
}

function getRemainingDeck(deck: CardData[], playerCount: number): CardData[] {
  return playerCount > 0 ? [] : deck;
}

function getTotalHandCards(hands: Record<string, CardData[]>): number {
  return Object.values(hands).reduce((total, cards) => total + cards.length, 0);
}

function compareCardsBySuit(a: CardData, b: CardData): number {
  return SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit) || RANK_VALUE[b.rank] - RANK_VALUE[a.rank];
}

function compareCardsByRank(a: CardData, b: CardData): number {
  return RANK_VALUE[b.rank] - RANK_VALUE[a.rank] || SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit);
}

const ARENA_COLL = 'arena_rooms';
const CARD_SPACING_MIN = 12;
const CARD_SPACING_MAX = 42;
const CARD_SPACING_DEFAULT = 24;
const CARD_SIGN_SCALE_MIN = 0.65;
const CARD_SIGN_SCALE_MAX = 1.35;
const CARD_SIGN_SCALE_DEFAULT = 0.82;
const CARD_PROFILE_GAP_MIN = -18;
const CARD_PROFILE_GAP_MAX = 36;
const CARD_PROFILE_GAP_DEFAULT = 0;
const BOT_CARD_PLAY_DELAY_MS = 650;
const TRICK_CLEAR_DELAY_MS = 1500;

function clampCardSpacing(value: number): number {
  if (!Number.isFinite(value)) return CARD_SPACING_DEFAULT;
  return Math.max(CARD_SPACING_MIN, Math.min(CARD_SPACING_MAX, value));
}

function clampCardSignScale(value: number): number {
  if (!Number.isFinite(value)) return CARD_SIGN_SCALE_DEFAULT;
  return Math.max(CARD_SIGN_SCALE_MIN, Math.min(CARD_SIGN_SCALE_MAX, value));
}

function clampCardProfileGap(value: number): number {
  if (!Number.isFinite(value)) return CARD_PROFILE_GAP_DEFAULT;
  return Math.max(CARD_PROFILE_GAP_MIN, Math.min(CARD_PROFILE_GAP_MAX, value));
}

function getCardKey(card: CardData): string {
  return `${card.rank}-${card.suit}`;
}

function isAceOfSpades(card: CardData): boolean {
  return card.rank === 'A' && card.suit === SUITS[0];
}

function getCardLabel(card: CardData): string {
  return `${card.rank}${card.suit}`;
}

function getRemainingCards(
  cards: CardData[],
  playerId: string,
  playedCards: PlayedCard[] = [],
): CardData[] {
  const playedCounts = playedCards.reduce<Record<string, number>>((counts, play) => {
    if (play.playerId !== playerId) return counts;
    const key = getCardKey(play.card);
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});

  return cards.filter(card => {
    const key = getCardKey(card);
    if (!playedCounts[key]) return true;
    playedCounts[key] -= 1;
    return false;
  });
}

function getStartingPlayerId(players: ArenaPlayer[], hands: Record<string, CardData[]>): string {
  return players.find(player => (hands[player.id] || []).some(isAceOfSpades))?.id || players[0]?.id || '';
}

function canPlayCard(
  card: CardData,
  hand: CardData[],
  currentTrick: PlayedCard[],
  discardPile: PlayedCard[],
  leadSuit: Suit | '',
): boolean {
  if (discardPile.length === 0 && currentTrick.length === 0) return isAceOfSpades(card);
  if (!leadSuit || currentTrick.length === 0) return true;

  const hasLeadSuit = hand.some(handCard => handCard.suit === leadSuit);
  return !hasLeadSuit || card.suit === leadSuit;
}

function isCutPlay(
  card: CardData,
  hand: CardData[],
  currentTrick: PlayedCard[],
  leadSuit: Suit | '',
): boolean {
  if (!leadSuit || currentTrick.length === 0) return false;
  const hasLeadSuit = hand.some(handCard => handCard.suit === leadSuit);
  return !hasLeadSuit && card.suit !== leadSuit;
}

function getCutPlays(currentTrick: PlayedCard[], leadSuit: Suit | ''): PlayedCard[] {
  if (!leadSuit) return [];
  return currentTrick.filter(play => play.card.suit !== leadSuit);
}

function getRandomCard(cards: CardData[]): CardData | undefined {
  if (cards.length === 0) return undefined;
  return cards[Math.floor(Math.random() * cards.length)];
}

function getPlayableCards(
  hand: CardData[],
  currentTrick: PlayedCard[],
  discardPile: PlayedCard[],
  leadSuit: Suit | '',
): CardData[] {
  const legal = hand.filter(card => canPlayCard(card, hand, currentTrick, discardPile, leadSuit));
  return legal.length > 0 ? legal : hand;
}

function getTrickWinner(currentTrick: PlayedCard[], leadSuit: Suit | '', packedPlayerIds: string[] = []): PlayedCard | null {
  if (currentTrick.length === 0) return null;
  const suitToBeat = leadSuit || currentTrick[0].card.suit;
  const packed = new Set(packedPlayerIds);
  const activeTrick = currentTrick.filter(play => !packed.has(play.playerId));

  return activeTrick
    .filter(play => play.card.suit === suitToBeat)
    .sort((a, b) => RANK_VALUE[b.card.rank] - RANK_VALUE[a.card.rank])[0] || activeTrick[0] || currentTrick[0];
}

function getNextClockwisePlayerId(
  players: ArenaPlayer[],
  hands: Record<string, CardData[]>,
  playedCards: PlayedCard[],
  currentPlayerId: string,
  blockedPlayerIds: string[] = [],
): string {
  if (players.length === 0) return '';
  const startIndex = Math.max(0, players.findIndex(player => player.id === currentPlayerId));
  const blocked = new Set(blockedPlayerIds);

  for (let offset = 1; offset <= players.length; offset++) {
    const next = players[(startIndex + offset) % players.length];
    if (blocked.has(next.id)) continue;
    if (getRemainingCards(hands[next.id] || [], next.id, playedCards).length > 0) {
      return next.id;
    }
  }

  return '';
}

function getTurnOrderLabel(players: ArenaPlayer[], currentPlayerId: string, nextPlayerId: string): string {
  const currentIndex = players.findIndex(player => player.id === currentPlayerId);
  const nextIndex = players.findIndex(player => player.id === nextPlayerId);
  if (currentIndex < 0 || nextIndex < 0) return '';
  return `P${currentIndex + 1} -> P${nextIndex + 1}`;
}

// ══════════════════════════════════════════════════════════════════════════════
// SEAT POSITIONS
// ══════════════════════════════════════════════════════════════════════════════
function getSeatStyle(index: number, total: number): React.CSSProperties {
  const P: Record<number, { top: string; left: string; transform: string }[]> = {
    2: [
      { top:'74%', left:'50%', transform:'translate(-50%,-50%)' },
      { top:'16%', left:'50%', transform:'translate(-50%,-50%)' },
    ],
    3: [
      { top:'74%', left:'50%', transform:'translate(-50%,-50%)' },
      { top:'16%', left:'25%', transform:'translate(-50%,-50%)' },
      { top:'16%', left:'75%', transform:'translate(-50%,-50%)' },
    ],
    4: [
      { top:'74%', left:'50%', transform:'translate(-50%,-50%)' },
      { top:'16%', left:'50%', transform:'translate(-50%,-50%)' },
      { top:'45%', left:'3%',  transform:'translate(0,-50%)' },
      { top:'45%', left:'97%', transform:'translate(-100%,-50%)' },
    ],
    5: [
      { top:'74%', left:'50%', transform:'translate(-50%,-50%)' },
      { top:'16%', left:'30%', transform:'translate(-50%,-50%)' },
      { top:'16%', left:'70%', transform:'translate(-50%,-50%)' },
      { top:'45%', left:'3%',  transform:'translate(0,-50%)' },
      { top:'45%', left:'97%', transform:'translate(-100%,-50%)' },
    ],
    6: [
      { top:'74%', left:'50%', transform:'translate(-50%,-50%)' },
      { top:'16%', left:'50%', transform:'translate(-50%,-50%)' },
      { top:'16%', left:'22%', transform:'translate(-50%,-50%)' },
      { top:'16%', left:'78%', transform:'translate(-50%,-50%)' },
      { top:'45%', left:'3%',  transform:'translate(0,-50%)' },
      { top:'45%', left:'97%', transform:'translate(-100%,-50%)' },
    ],
    7: [
      { top:'74%', left:'50%', transform:'translate(-50%,-50%)' },
      { top:'16%', left:'50%', transform:'translate(-50%,-50%)' },
      { top:'16%', left:'22%', transform:'translate(-50%,-50%)' },
      { top:'16%', left:'78%', transform:'translate(-50%,-50%)' },
      { top:'45%', left:'3%',  transform:'translate(0,-50%)' },
      { top:'45%', left:'97%', transform:'translate(-100%,-50%)' },
      { top:'68%', left:'3%',  transform:'translate(0,-50%)' },
    ],
    8: [
      { top:'74%', left:'50%', transform:'translate(-50%,-50%)' },
      { top:'16%', left:'50%', transform:'translate(-50%,-50%)' },
      { top:'16%', left:'22%', transform:'translate(-50%,-50%)' },
      { top:'16%', left:'78%', transform:'translate(-50%,-50%)' },
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
            {getCardDistributionLabel(52, totalSeats)}
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
  room: ArenaRoom; myId: string;
  onJoinAsPlayer: () => void; onStartDeal: () => void; onLeave: () => void;
}> = ({ room, myId, onJoinAsPlayer, onStartDeal, onLeave }) => {
  const isHost = myId === room.hostId;
  const amIn = room.players.some(p => p.id === myId);
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
              {p.id === myId && <span style={{ color:'#4ade80', fontSize:11, fontWeight:900 }}>YOU</span>}
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
// FAN HAND — proper overlapping fan, numbers clearly visible
// ══════════════════════════════════════════════════════════════════════════════
const FanHand: FC<{
  cards: CardData[];
  faceDown: boolean;
  isMe: boolean;
  handSpacing?: number;
  cardSignScale?: number;
  handStyle?: HandStyle;
  selectedCardKey?: string | null;
  canInteract?: boolean;
  onCardTap?: (card: CardData) => void;
  dragEnabled?: boolean;
  onReorderCards?: (fromIndex: number, toIndex: number) => void;
}> = ({
  cards,
  faceDown,
  isMe,
  handSpacing = 20,
  cardSignScale = CARD_SIGN_SCALE_DEFAULT,
  handStyle = 'readable',
  selectedCardKey,
  canInteract = false,
  onCardTap,
  dragEnabled = false,
  onReorderCards,
}) => {
  const dragIndexRef = useRef<number | null>(null);
  if (cards.length === 0) return null;
  const n = cards.length;

  // My cards are taller so both top and bottom ranks stay fully visible.
  const cardW  = isMe ? 58  : 28;
  const cardH  = isMe ? 92  : 40;
  const signScale = clampCardSignScale(cardSignScale);
  const isClassicHold = isMe && handStyle === 'classic';
  const step = isMe
    ? isClassicHold
      ? Math.max(18, Math.min(30, clampCardSpacing(handSpacing)))
      : clampCardSpacing(handSpacing)
    : Math.max(10, Math.min(16, 120 / n));
  const totalW  = cardW + step * (n - 1);
  const maxTilt = isClassicHold ? Math.min(26, 10 + n * 0.8) : isMe ? 0 : 1.5; // slight tilt for opponents only
  const handHeight = isClassicHold ? cardH + 30 : cardH + 24;

  const red = (suit: string) => suit === SUITS[1] || suit === SUITS[2];
  const handleHandClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isMe || !canInteract || !onCardTap) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const cardIndex = Math.max(0, Math.min(n - 1, Math.floor(x / step)));
    onCardTap(cards[cardIndex]);
  };

  return (
    <div style={{
      width: isMe ? 'min(94vw, 1120px)' : totalW,
      maxWidth: isMe ? '94vw' : totalW,
      overflowX: isMe ? 'auto' : 'visible',
      overflowY: 'visible',
      padding: isMe ? isClassicHold ? '26px 6px 4px' : '22px 6px 8px' : 0,
      flexShrink: 0,
    }}>
    <div
      onClick={handleHandClick}
      style={{ position: 'relative', width: totalW, height: handHeight, flexShrink: 0, margin: isMe ? '0 auto' : undefined, cursor: canInteract ? 'pointer' : 'default' }}
    >
      {cards.map((card, i) => {
        const spreadRatio = n > 1 ? ((i / (n - 1)) - 0.5) : 0;
        const tilt = isClassicHold ? spreadRatio * maxTilt * 2 : n > 1 ? spreadRatio * maxTilt * 2 : 0;
        const cardKey = getCardKey(card);
        const isSelected = isMe && selectedCardKey === cardKey;
        const fanY = isClassicHold ? (isSelected ? -24 : Math.abs(spreadRatio) * 18) : 0;
        const cardTransform = isClassicHold
          ? `translateY(${fanY}px) rotate(${tilt}deg)`
          : `rotate(${tilt}deg)`;
        const fanVars = isClassicHold
          ? ({ '--fan-rot': `${tilt}deg`, '--fan-y': `${fanY}px` } as React.CSSProperties)
          : {};
        const canDragCard = dragEnabled && isMe && !faceDown && canInteract;
        return (
          <div
            key={`${cardKey}-${i}`}
            draggable={canDragCard}
            onDragStart={(event) => {
              if (!canDragCard) return;
              dragIndexRef.current = i;
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('text/plain', String(i));
            }}
            onDragOver={(event) => {
              if (!canDragCard) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
            }}
            onDrop={(event) => {
              if (!canDragCard) return;
              event.preventDefault();
              const rawIndex = event.dataTransfer.getData('text/plain');
              const fromIndex = rawIndex === '' ? dragIndexRef.current : Number(rawIndex);
              if (typeof fromIndex === 'number' && Number.isInteger(fromIndex) && fromIndex >= 0 && fromIndex !== i) {
                onReorderCards?.(fromIndex, i);
              }
              dragIndexRef.current = null;
            }}
            onDragEnd={() => { dragIndexRef.current = null; }}
            style={{
            position: 'absolute',
            left: i * step,
            top: isClassicHold ? 8 : isSelected ? 0 : 18,
            zIndex: isSelected ? 200 : i + 1,
            transform: cardTransform,
            transformOrigin: isClassicHold ? '50% 118%' : 'bottom center',
            animation: isClassicHold
              ? `classicFanIn 0.52s cubic-bezier(.2,.9,.25,1.15) ${i * 0.035}s both`
              : `dealIn 0.3s ease-out ${i * 0.05}s both`,
            transition: 'top 140ms ease, filter 140ms ease, transform 140ms ease',
            cursor: canDragCard ? 'grab' : canInteract ? 'pointer' : 'default',
            filter: isSelected ? 'drop-shadow(0 0 14px rgba(74,222,128,0.75))' : undefined,
            ...fanVars,
          }}>
            {faceDown ? (
              <div style={{
                width: cardW, height: cardH, borderRadius: 5,
                background: 'linear-gradient(160deg,#1e3a8a 0%,#1d4ed8 100%)',
                border: '2px solid #fff',
                boxShadow: '0 2px 8px rgba(0,0,0,0.6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{
                  width: cardW - 8, height: cardH - 8, borderRadius: 3,
                  border: '1px solid rgba(255,255,255,0.25)',
                  background: 'repeating-linear-gradient(45deg,rgba(255,255,255,0.04) 0,rgba(255,255,255,0.04) 2px,transparent 2px,transparent 7px)',
                }} />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => canInteract && onCardTap?.(card)}
                disabled={!canInteract}
                aria-label={`Card ${getCardLabel(card)}`}
                style={{
                width: cardW, height: cardH, borderRadius: 5,
                background: '#fff', border: '1.5px solid #bbb',
                boxShadow: '0 3px 10px rgba(0,0,0,0.4)',
                display: 'block',
                padding: 0,
                boxSizing: 'border-box', overflow: 'hidden',
                position: 'relative',
                cursor: canInteract ? 'pointer' : 'default',
                pointerEvents: 'none',
              }}>
                {/* Top-left: rank + suit stacked */}
                <div style={{ position: 'absolute', top: isMe ? 5 : 3, left: isMe ? 6 : 3, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.05 }}>
                  <span style={{
                    fontSize: isMe ? 13 : 8, fontWeight: 900, lineHeight: 1,
                    color: red(card.suit) ? '#cc0000' : '#111',
                    fontFamily: 'Arial Black, Arial, sans-serif',
                  }}>{card.rank}</span>
                  <span style={{
                    fontSize: isMe ? 11 : 7, lineHeight: 1,
                    color: red(card.suit) ? '#cc0000' : '#111',
                  }}>
                    <SuitMark suit={card.suit} size={(isMe ? 9 : 6) * signScale} color={red(card.suit) ? '#cc0000' : '#111'} />
                  </span>
                </div>
                {/* Center suit — only show on my cards */}
                {(
                  <div style={{ position: 'absolute', top: isMe ? 22 : 12, right: isMe ? 8 : 4, bottom: isMe ? 22 : 12, left: isMe ? 8 : 4, display: 'flex', pointerEvents: 'none' }}>
                    <ClassicPips suit={card.suit} rank={card.rank} compact={!isMe} symbolScale={signScale} />
                  </div>
                )}
                {/* Bottom-right rotated */}
                <div style={{ position: 'absolute', right: isMe ? 6 : 3, bottom: isMe ? 5 : 3, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.05, transform: 'rotate(180deg)' }}>
                  <span style={{
                    fontSize: isMe ? 13 : 8, fontWeight: 900, lineHeight: 1,
                    color: red(card.suit) ? '#cc0000' : '#111',
                    fontFamily: 'Arial Black, Arial, sans-serif',
                  }}>{card.rank}</span>
                  <span style={{
                    fontSize: isMe ? 11 : 7, lineHeight: 1,
                    color: red(card.suit) ? '#cc0000' : '#111',
                  }}>
                    <SuitMark suit={card.suit} size={(isMe ? 9 : 6) * signScale} color={red(card.suit) ? '#cc0000' : '#111'} />
                  </span>
                </div>
              </button>
            )}
          </div>
        );
      })}
    </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// PLAYER SEAT — cards on top, avatar+name BELOW
// ══════════════════════════════════════════════════════════════════════════════
const PlayerSeat: FC<{
  player: ArenaPlayer; cards: CardData[];
  isMe: boolean; revealed: boolean;
  onReveal: () => void; visibleCount: number;
  handSpacing: number;
  cardSignScale: number;
  handStyle: HandStyle;
  cardProfileGap: number;
  wonCards?: PlayedCard[];
  isPubliclyRevealed?: boolean;
  isPacked?: boolean;
  selectedCardKey?: string | null;
  isMyTurn?: boolean;
  onCardTap?: (card: CardData) => void;
  onReorderCards?: (fromIndex: number, toIndex: number) => void;
  onGroupCards?: (mode: CardGroupMode) => void;
  onShowCardsPublicly?: () => void;
  onPackCards?: () => void;
  isThinking?: boolean;
}> = ({ player, cards, isMe, revealed, onReveal, visibleCount, handSpacing, cardSignScale, handStyle, cardProfileGap, wonCards = [], isPubliclyRevealed = false, isPacked = false, selectedCardKey, isMyTurn, onCardTap, onReorderCards, onGroupCards, onShowCardsPublicly, onPackCards, isThinking }) => {
  const [showCards, setShowCards] = useState(false);
  const dealtCards = cards.slice(0, visibleCount);
  const isBot = player.isBot;
  const levelColor = player.botLevel === 'legend' ? '#f59e0b' : player.botLevel === 'shark' ? '#3b82f6' : '#22c55e';
  const avatarSize = isMe ? 40 : 32;
  const lastWonCard = wonCards[wonCards.length - 1];

  useEffect(() => { if ((revealed || isPubliclyRevealed) && isMe) setShowCards(true); }, [revealed, isPubliclyRevealed, isMe]);

  const WonDeck = wonCards.length > 0 && (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
      <div style={{ position: 'relative', width: 28, height: 22 }}>
        {Array.from({ length: Math.min(3, wonCards.length) }).map((_, i) => (
          <div key={i} style={{
            position: 'absolute',
            left: i * 3,
            top: i * -1,
            width: 18,
            height: 24,
            borderRadius: 3,
            background: 'linear-gradient(135deg,#1e3a8a,#2563eb)',
            border: '1px solid rgba(255,255,255,0.9)',
            boxShadow: '0 2px 5px rgba(0,0,0,0.45)',
          }} />
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, lineHeight: 1 }}>
        <span style={{ color: '#bbf7d0', fontSize: 9, fontWeight: 900, textShadow: '0 2px 5px rgba(0,0,0,0.75)' }}>
          Deck {wonCards.length}
        </span>
        {lastWonCard?.isCut && (
          <span style={{ color: '#facc15', fontSize: 8, fontWeight: 900, textShadow: '0 2px 5px rgba(0,0,0,0.75)' }}>
            Cut received
          </span>
        )}
      </div>
    </div>
  );

  // Name tag component
  const NameTag = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, marginTop: isMe ? clampCardProfileGap(cardProfileGap) : 3 }}>
      <div style={{ position: 'relative' }}>
        <div style={{
          width: avatarSize, height: avatarSize, borderRadius: '50%', overflow: 'hidden',
          border: isMe ? '2.5px solid #4ade80' : isBot ? `2px solid ${levelColor}` : '2px solid rgba(255,255,255,0.35)',
          boxShadow: isMe ? '0 0 12px rgba(74,222,128,0.5)' : '0 2px 6px rgba(0,0,0,0.6)',
          background: isBot ? 'linear-gradient(135deg,#1d4ed8,#7c3aed)' : 'linear-gradient(135deg,#16a34a,#7c3aed)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 900, fontSize: isBot ? 16 : 13, color: '#fff', flexShrink: 0,
        }}>
          {!isBot && player.avatar
            ? <img src={player.avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
            : isBot ? BOT_CONFIGS[player.botLevel || 'rookie'].emoji
            : player.name[0]?.toUpperCase()}
        </div>
        {isThinking && (
          <div style={{ position: 'absolute', top: -4, right: -4, background: '#1d4ed8', borderRadius: '50%', width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, animation: 'pulse 0.6s infinite' }}>💭</div>
        )}
      </div>
      <div style={{ padding: '1px 6px', maxWidth: 104, textAlign: 'center' }}>
        <p style={{ color: isMe ? '#4ade80' : isBot ? levelColor : '#fff', fontWeight: 900, fontSize: 10, textShadow: '0 2px 6px rgba(0,0,0,0.85)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 100, margin: 0 }}>
          {isMe ? 'YOU' : player.name}
        </p>
        {isPacked && (
          <p style={{ color: '#f87171', fontWeight: 900, fontSize: 8, textShadow: '0 2px 5px rgba(0,0,0,0.8)', margin: '2px 0 0' }}>
            PACKED
          </p>
        )}
      </div>
    </div>
  );

  if (isMe) {
    // MY SEAT: cards on top, avatar below, see-cards button below avatar
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
        {dealtCards.length > 0 && (
          <FanHand
            cards={dealtCards}
            faceDown={!showCards}
            isMe={true}
            handSpacing={handSpacing}
            cardSignScale={cardSignScale}
            handStyle={handStyle}
            selectedCardKey={selectedCardKey}
            canInteract={showCards}
            onCardTap={onCardTap}
            dragEnabled={Boolean(onReorderCards)}
            onReorderCards={onReorderCards}
          />
        )}
        {NameTag}
        {WonDeck}
        {dealtCards.length > 0 && showCards && !isPacked && (
          <div style={{ display: 'flex', gap: 6, marginTop: 5 }}>
            {!isPubliclyRevealed && (
              <button
                type="button"
                onClick={() => { setShowCards(true); onShowCardsPublicly?.(); }}
                style={{
                  padding: '5px 9px',
                  borderRadius: 7,
                  background: 'rgba(59,130,246,0.18)',
                  color: '#93c5fd',
                  border: '1px solid rgba(147,197,253,0.35)',
                  fontWeight: 900,
                  fontSize: 9,
                  cursor: 'pointer',
                }}
              >
                Show Cards
              </button>
            )}
            <button
              type="button"
              onClick={onPackCards}
              style={{
                padding: '5px 9px',
                borderRadius: 7,
                background: 'rgba(239,68,68,0.16)',
                color: '#fca5a5',
                border: '1px solid rgba(252,165,165,0.35)',
                fontWeight: 900,
                fontSize: 9,
                cursor: 'pointer',
              }}
            >
              Pack
            </button>
          </div>
        )}
        {dealtCards.length > 1 && showCards && !isPacked && onGroupCards && (
          <div style={{ display: 'flex', gap: 6, marginTop: 5 }}>
            <button
              type="button"
              onClick={() => onGroupCards('suit')}
              style={{
                padding: '4px 8px',
                borderRadius: 7,
                background: 'rgba(74,222,128,0.13)',
                color: '#bbf7d0',
                border: '1px solid rgba(74,222,128,0.28)',
                fontWeight: 900,
                fontSize: 8,
                cursor: 'pointer',
              }}
            >
              Group Suit
            </button>
            <button
              type="button"
              onClick={() => onGroupCards('rank')}
              style={{
                padding: '4px 8px',
                borderRadius: 7,
                background: 'rgba(96,165,250,0.13)',
                color: '#bfdbfe',
                border: '1px solid rgba(96,165,250,0.28)',
                fontWeight: 900,
                fontSize: 8,
                cursor: 'pointer',
              }}
            >
              Group Rank
            </button>
          </div>
        )}
        {dealtCards.length > 0 && !showCards && (
          <button onClick={() => { setShowCards(true); onReveal(); }}
            style={{ marginTop: 4, padding: '5px 16px', borderRadius: 8, background: 'linear-gradient(135deg,#16a34a,#15803d)', color: '#fff', fontWeight: 900, fontSize: 11, border: 'none', cursor: 'pointer', boxShadow: '0 2px 10px rgba(22,163,74,0.5)' }}>
            👁 SEE MY CARDS
          </button>
        )}
        {dealtCards.length > 0 && showCards && (
          <span style={{ marginTop: 3, fontSize: 9, color: isMyTurn ? '#facc15' : '#4ade80', fontWeight: 700 }}>
            {isMyTurn ? 'Your turn' : '✓ Revealed'}
          </span>
        )}
      </div>
    );
  }

  // OPPONENT SEAT: cards on top, avatar below
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
      {dealtCards.length > 0 && (
        <FanHand cards={dealtCards} faceDown={!isPubliclyRevealed && !isPacked} isMe={false} cardSignScale={cardSignScale} handStyle={handStyle} />
      )}
      {NameTag}
      {WonDeck}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// POKER TABLE
// ══════════════════════════════════════════════════════════════════════════════
const PokerTable: FC<{
  room: ArenaRoom; myId: string;
  onReveal: () => void; onNewGame: () => void; onLeave: () => void;
  onRoomUpdate: (updates: Partial<ArenaRoom>) => Promise<void>;
  handSpacing: number;
  onHandSpacingChange: (value: number) => void;
  cardSignScale: number;
  onCardSignScaleChange: (value: number) => void;
  handStyle: HandStyle;
  onHandStyleChange: (value: HandStyle) => void;
  cardProfileGap: number;
  onCardProfileGapChange: (value: number) => void;
}> = ({ room, myId, onReveal, onNewGame, onLeave, onRoomUpdate, handSpacing, onHandSpacingChange, cardSignScale, onCardSignScaleChange, handStyle, onHandStyleChange, cardProfileGap, onCardProfileGapChange }) => {
  const isHost = myId === room.hostId;
  const totalDealtCards = getTotalHandCards(room.hands);

  const myIndex = room.players.findIndex(p => p.id === myId);
  const ordered = myIndex >= 0
    ? [...room.players.slice(myIndex), ...room.players.slice(0, myIndex)]
    : room.players;

  const [visibleCounts, setVisibleCounts] = useState<Record<string, number>>({});
  const [deckLeft, setDeckLeft] = useState(52);
  const [isShuffling, setIsShuffling] = useState(false);
  const [dealDone, setDealDone] = useState(false);
  const dealRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [thinkingBots, setThinkingBots] = useState<Set<string>>(new Set());
  const [isCompactLayout, setIsCompactLayout] = useState(() => (
    typeof window !== 'undefined' ? window.innerWidth < 980 : false
  ));
  const [isPortraitLayout, setIsPortraitLayout] = useState(() => (
    typeof window !== 'undefined' ? window.innerWidth <= 760 && window.innerHeight >= window.innerWidth : false
  ));
  const [isMobileLandscapeLayout, setIsMobileLandscapeLayout] = useState(() => (
    typeof window !== 'undefined' ? window.innerWidth <= 1180 && window.innerHeight <= 620 && window.innerWidth > window.innerHeight : false
  ));
  const [controlsOpen, setControlsOpen] = useState(false);
  const [selectedCardKey, setSelectedCardKey] = useState<string | null>(null);
  const [playMessage, setPlayMessage] = useState('');
  const [cardOrder, setCardOrder] = useState<Record<string, string[]>>({});
  const botPlayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const botTurnKeyRef = useRef('');
  const trickResolveKeyRef = useRef('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      setIsCompactLayout(window.innerWidth < 980);
      setIsPortraitLayout(window.innerWidth <= 760 && window.innerHeight >= window.innerWidth);
      setIsMobileLandscapeLayout(window.innerWidth <= 1180 && window.innerHeight <= 620 && window.innerWidth > window.innerHeight);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (isPortraitLayout || isMobileLandscapeLayout) setControlsOpen(false);
  }, [isPortraitLayout, isMobileLandscapeLayout]);

  useEffect(() => {
    if (room.status === 'shuffling') {
      setIsShuffling(true); setDealDone(false);
      setVisibleCounts({}); setDeckLeft(52);
      setThinkingBots(new Set());
      setSelectedCardKey(null); setPlayMessage('');
      setCardOrder({});
      if (botPlayRef.current) clearTimeout(botPlayRef.current);
      botTurnKeyRef.current = '';
      trickResolveKeyRef.current = '';
    } else if ((room.status === 'reveal' || room.status === 'done') && !dealDone) {
      setIsShuffling(false); setDealDone(true);
      const players = room.players;
      const total = getTotalHandCards(room.hands);
      let cardIdx = 0;
      const dealNext = () => {
        if (cardIdx >= total) { setDeckLeft(52 - total); triggerBotThinking(); return; }
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

  useEffect(() => () => {
    if (botPlayRef.current) clearTimeout(botPlayRef.current);
  }, []);

  const triggerBotThinking = () => {
    room.players.filter(p => p.isBot).forEach((bot, i) => {
      const cfg = BOT_CONFIGS[bot.botLevel || 'rookie'];
      const thinkTime = cfg.thinkMs[0] + Math.random() * (cfg.thinkMs[1] - cfg.thinkMs[0]) + i * 300;
      setThinkingBots(prev => new Set([...prev, bot.id]));
      setTimeout(() => {
        void botDecide(room.hands[bot.id] || [], bot.botLevel || 'rookie');
        setThinkingBots(prev => { const s = new Set(prev); s.delete(bot.id); return s; });
      }, thinkTime);
    });
  };

  const allDealt = Boolean(room.gameStarted) ||
    (totalDealtCards > 0 && ordered.every(p => (visibleCounts[p.id] || 0) >= (room.hands[p.id] || []).length));
  const playedCards = room.playedCards || [];
  const discardPile = room.discardPile || [];
  const capturedPiles = room.capturedPiles || {};
  const publicRevealedBy = room.publicRevealedBy || [];
  const packedPlayerIds = room.packedPlayerIds || [];
  const currentTurnId = room.currentTurnId || '';
  const currentTurnPlayer = room.players.find(player => player.id === currentTurnId) || null;
  const winnerPlayer = room.winnerId ? room.players.find(player => player.id === room.winnerId) || null : null;
  const winnerPlayers = (room.winnerIds && room.winnerIds.length > 0)
    ? room.winnerIds.map(id => room.players.find(player => player.id === id)).filter(Boolean) as ArenaPlayer[]
    : winnerPlayer ? [winnerPlayer] : [];
  const winnerStatusLabel = winnerPlayers.length > 1
    ? `${winnerPlayers.length} players win`
    : winnerPlayers[0]
      ? `${winnerPlayers[0].name} wins`
      : 'Round complete';
  const isMyTurn = currentTurnId === myId;
  const leadSuit = room.leadSuit || playedCards[0]?.card.suit || '';
  const usedCardCount = playedCards.length + discardPile.length;
  const activePlayers = room.players.filter(player => !packedPlayerIds.includes(player.id));
  const activePlayersWithCards = activePlayers.filter(player =>
    getRemainingCards(room.hands[player.id] || [], player.id, [...discardPile, ...playedCards]).length > 0
  );
  const roundComplete = Boolean(room.winnerId) || (allDealt && (usedCardCount >= totalDealtCards || activePlayersWithCards.length <= 1));
  const cutPlayedOnTable = playedCards.some(play => play.isCut);
  const activeTrickPlayers = activePlayers.filter(player =>
    playedCards.some(play => play.playerId === player.id) ||
    getRemainingCards(room.hands[player.id] || [], player.id, [...discardPile, ...playedCards]).length > 0
  );
  const currentTrickComplete = allDealt && playedCards.length > 0 && (
    cutPlayedOnTable ||
    activeTrickPlayers.every(player => playedCards.some(play => play.playerId === player.id))
  );
  const firstPlayNeedsAce = discardPile.length === 0 && playedCards.length === 0;
  const capturedDeckLeader = room.players
    .map(player => ({ player, count: capturedPiles[player.id]?.length || 0 }))
    .filter(entry => entry.count > 0)
    .sort((a, b) => b.count - a.count)[0];

  const getVisibleCards = (playerId: string) => getRemainingCards(
    room.hands[playerId] || [],
    playerId,
    [...discardPile, ...playedCards],
  );

  const getOrderedCards = (playerId: string, cards: CardData[]) => {
    const savedOrder = cardOrder[playerId] || [];
    if (savedOrder.length === 0) return cards;

    const originalIndex = new Map(cards.map((card, index) => [`${getCardKey(card)}-${index}`, index]));
    const nextCards = [...cards];
    return nextCards.sort((a, b) => {
      const aOrder = savedOrder.indexOf(getCardKey(a));
      const bOrder = savedOrder.indexOf(getCardKey(b));
      if (aOrder >= 0 && bOrder >= 0) return aOrder - bOrder;
      if (aOrder >= 0) return -1;
      if (bOrder >= 0) return 1;
      return (originalIndex.get(`${getCardKey(a)}-${cards.indexOf(a)}`) || 0) - (originalIndex.get(`${getCardKey(b)}-${cards.indexOf(b)}`) || 0);
    });
  };

  const handleReorderMyCards = (fromIndex: number, toIndex: number) => {
    const visibleCards = getOrderedCards(myId, getVisibleCards(myId));
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= visibleCards.length || toIndex >= visibleCards.length) return;

    const keys = visibleCards.map(getCardKey);
    const [moved] = keys.splice(fromIndex, 1);
    keys.splice(toIndex, 0, moved);
    setCardOrder(prev => ({ ...prev, [myId]: keys }));
    setSelectedCardKey(null);
  };

  const handleGroupMyCards = (mode: CardGroupMode) => {
    const visibleCards = getVisibleCards(myId);
    const sorted = [...visibleCards].sort(mode === 'suit' ? compareCardsBySuit : compareCardsByRank);
    setCardOrder(prev => ({ ...prev, [myId]: sorted.map(getCardKey) }));
    setSelectedCardKey(null);
  };

  const playCardForPlayer = async (player: ArenaPlayer, card: CardData) => {
    if (!allDealt) return;
    if (room.winnerId) return;
    if (packedPlayerIds.includes(player.id)) return;
    if (currentTurnId && player.id !== currentTurnId) return;

    const remaining = getVisibleCards(player.id);
    if (!remaining.some(remainingCard => getCardKey(remainingCard) === getCardKey(card))) return;

    if (firstPlayNeedsAce && !isAceOfSpades(card)) {
      setPlayMessage(`Start with ${getCardLabel({ rank: 'A', suit: SUITS[0] })}.`);
      return;
    }

    if (!canPlayCard(card, remaining, playedCards, discardPile, leadSuit)) {
      const neededSuit = leadSuit || SUITS[0];
      setPlayMessage(`Follow ${neededSuit} if you have it.`);
      return;
    }

    const nextLeadSuit = leadSuit || card.suit;
    const playIsCut = isCutPlay(card, remaining, playedCards, nextLeadSuit);

    const nextPlayedCards: PlayedCard[] = [
      ...playedCards,
      {
        playerId: player.id,
        playerName: player.name,
        card,
        order: playedCards.length,
        timestamp: Date.now(),
        isCut: playIsCut,
      },
    ];
    const blockedForNextTurn = [...packedPlayerIds, ...nextPlayedCards.map(play => play.playerId)];
    const nextTurnId = playIsCut
      ? ''
      : getNextClockwisePlayerId(room.players, room.hands, [...discardPile, ...nextPlayedCards], player.id, blockedForNextTurn);
    const nextPlayer = room.players.find(candidate => candidate.id === nextTurnId);
    const turnOrderLabel = nextPlayer ? getTurnOrderLabel(room.players, player.id, nextTurnId) : '';

    setSelectedCardKey(null);
    setPlayMessage(playIsCut
      ? `${player.name} cuts with ${getCardLabel(card)}`
      : nextPlayer ? `${turnOrderLabel ? `${turnOrderLabel}: ` : ''}${nextPlayer.name}'s turn` : 'Checking trick winner...');
    await onRoomUpdate({
      playedCards: nextPlayedCards,
      currentTurnId: nextTurnId,
      gameStarted: true,
      leadSuit: nextLeadSuit,
    });
  };

  const handleMyCardTap = (card: CardData) => {
    const key = getCardKey(card);

    if (selectedCardKey !== key) {
      setSelectedCardKey(key);
      if (firstPlayNeedsAce && !isAceOfSpades(card)) {
        setPlayMessage(`Select ${getCardLabel({ rank: 'A', suit: SUITS[0] })} to start.`);
      } else if (!isMyTurn) {
        setPlayMessage(currentTurnPlayer ? `Wait for ${currentTurnPlayer.name}.` : 'Waiting for first turn.');
      } else if (!canPlayCard(card, getVisibleCards(myId), playedCards, discardPile, leadSuit)) {
        setPlayMessage(`Follow ${leadSuit || SUITS[0]} if you have it.`);
      } else if (isCutPlay(card, getVisibleCards(myId), playedCards, leadSuit)) {
        setPlayMessage(`No ${leadSuit} cards. Tap again to cut with ${getCardLabel(card)}.`);
      } else {
        setPlayMessage('Tap the raised card again to play it.');
      }
      return;
    }

    if (!isMyTurn) {
      setPlayMessage(currentTurnPlayer ? `Wait for ${currentTurnPlayer.name}.` : 'Waiting for first turn.');
      return;
    }

    const me = room.players.find(player => player.id === myId);
    if (me) void playCardForPlayer(me, card);
  };

  const handleShowCardsPublicly = async () => {
    if (publicRevealedBy.includes(myId)) return;
    setPlayMessage('Your cards are shown to everyone.');
    await onRoomUpdate({ publicRevealedBy: [...publicRevealedBy, myId] });
  };

  const handlePackCards = async () => {
    if (packedPlayerIds.includes(myId)) return;
    if (room.winnerId) return;

    const nextPackedPlayerIds = [...packedPlayerIds, myId];
    const nextPublicRevealedBy = publicRevealedBy.includes(myId)
      ? publicRevealedBy
      : [...publicRevealedBy, myId];
    const remainingPlayers = room.players.filter(player => !nextPackedPlayerIds.includes(player.id));
    const updates: Partial<ArenaRoom> = {
      packedPlayerIds: nextPackedPlayerIds,
      publicRevealedBy: nextPublicRevealedBy,
    };

    if (remainingPlayers.length === 1) {
      const winner = remainingPlayers[0];
      setPlayMessage(`${winner.name} wins. Last opponent packed.`);
      await onRoomUpdate({
        ...updates,
        status: 'done',
        winnerId: winner.id,
        winnerName: winner.name,
        winnerAvatar: winner.avatar,
        winnerIds: [winner.id],
        winnerNames: [winner.name],
        loserIds: nextPackedPlayerIds,
        loserNames: room.players.filter(player => nextPackedPlayerIds.includes(player.id)).map(player => player.name),
        endedReason: 'Opponent packed',
        currentTurnId: '',
        playedCards: [],
        leadSuit: '',
      });
      return;
    }

    if (currentTurnId === myId) {
      const nextTurnId = getNextClockwisePlayerId(
        room.players,
        room.hands,
        [...discardPile, ...playedCards],
        myId,
        [...nextPackedPlayerIds, ...playedCards.map(play => play.playerId)],
      );
      updates.currentTurnId = nextTurnId;

      const nextPlayer = room.players.find(player => player.id === nextTurnId);
      setPlayMessage(nextPlayer ? `${nextPlayer.name}'s turn` : 'Checking trick winner...');
    } else {
      setPlayMessage('You packed and accepted the loss.');
    }

    await onRoomUpdate(updates);
  };

  useEffect(() => {
    if (!allDealt || room.currentTurnId || room.gameStarted) return;

    const startingPlayerId = getStartingPlayerId(room.players, room.hands);
    if (!startingPlayerId) return;

    const startingPlayer = room.players.find(player => player.id === startingPlayerId);
    setPlayMessage(startingPlayer ? `${startingPlayer.name} starts with ${getCardLabel({ rank: 'A', suit: SUITS[0] })}` : '');
    void onRoomUpdate({ currentTurnId: startingPlayerId, gameStarted: true, playedCards: [], discardPile: [], leadSuit: '', winnerId: '', winnerName: '', winnerAvatar: '', winnerIds: [], winnerNames: [], loserIds: [], loserNames: [], endedReason: '' });
  }, [allDealt, room.currentTurnId, room.gameStarted, room.roomId]);

  useEffect(() => {
    if (!currentTrickComplete || playedCards.length === 0) return;

    const resolveKey = `${room.roomId}-${discardPile.length}-${playedCards.map(play => `${play.playerId}:${getCardKey(play.card)}`).join('|')}`;
    if (trickResolveKeyRef.current === resolveKey) return;
    trickResolveKeyRef.current = resolveKey;

    const winner = getTrickWinner(playedCards, leadSuit, packedPlayerIds);
    if (!winner) return;

    const cutPlays = getCutPlays(playedCards, leadSuit);
    const cutMessage = cutPlays.length > 0
      ? ` Cut goes to ${winner.playerName}.`
      : '';
    setPlayMessage(`${winner.playerName} wins trick with ${getCardLabel(winner.card)}.${cutMessage}`);
    const timeout = setTimeout(() => {
      const capturedCards = playedCards.map(play => ({
        ...play,
        capturedBy: winner.playerId,
        capturedAt: Date.now(),
      }));
      const cutReturnsToWinner = cutPlays.length > 0;
      const nextDiscardPile = [...discardPile, ...capturedCards];
      const nextHands = cutReturnsToWinner
        ? {
            ...room.hands,
            [winner.playerId]: [...(room.hands[winner.playerId] || []), ...capturedCards.map(play => play.card)],
          }
        : room.hands;
      const nextCapturedPiles = {
        ...capturedPiles,
        [winner.playerId]: [...(capturedPiles[winner.playerId] || []), ...capturedCards],
      };
      const nextTotalCards = getTotalHandCards(nextHands);
      const activeAfterTrick = room.players.filter(player => !packedPlayerIds.includes(player.id));
      const zeroCardWinners = activeAfterTrick.filter(player =>
        getRemainingCards(nextHands[player.id] || [], player.id, nextDiscardPile).length === 0
      );
      const cardHoldingLosers = activeAfterTrick.filter(player =>
        getRemainingCards(nextHands[player.id] || [], player.id, nextDiscardPile).length > 0
      );
      const packedLosers = room.players.filter(player => packedPlayerIds.includes(player.id));
      const losingPlayers = [...cardHoldingLosers, ...packedLosers];
      const isGameDone = zeroCardWinners.length > 0 || nextDiscardPile.length >= nextTotalCards;
      const winnerCanLead = getRemainingCards(nextHands[winner.playerId] || [], winner.playerId, nextDiscardPile).length > 0;
      const nextLeadPlayerId = isGameDone
        ? ''
        : winnerCanLead
          ? winner.playerId
          : getNextClockwisePlayerId(room.players, nextHands, nextDiscardPile, winner.playerId, packedPlayerIds);
      const nextLeadPlayer = room.players.find(candidate => candidate.id === nextLeadPlayerId);

      void onRoomUpdate({
        playedCards: [],
        hands: nextHands,
        discardPile: nextDiscardPile,
        capturedPiles: nextCapturedPiles,
        currentTurnId: nextLeadPlayerId,
        leadSuit: '',
        ...(isGameDone && zeroCardWinners.length > 0 ? {
          status: 'done' as const,
          winnerId: zeroCardWinners[0].id,
          winnerName: zeroCardWinners[0].name,
          winnerAvatar: zeroCardWinners[0].avatar,
          winnerIds: zeroCardWinners.map(player => player.id),
          winnerNames: zeroCardWinners.map(player => player.name),
          loserIds: losingPlayers.map(player => player.id),
          loserNames: losingPlayers.map(player => player.name),
          endedReason: losingPlayers.length > 0 ? 'Zero-card players win' : 'All players cleared their cards',
        } : {}),
      });
      setPlayMessage(isGameDone
        ? zeroCardWinners.length > 0 ? `${zeroCardWinners.map(player => player.name).join(', ')} win with 0 cards` : 'All cards played'
        : cutPlays.length > 0
          ? winnerCanLead
            ? `${winner.playerName} received the cut cards and leads next`
            : `${winner.playerName} received the cut. ${nextLeadPlayer?.name || 'Next player'} leads next`
          : `${nextLeadPlayer?.name || winner.playerName} leads next`);
    }, TRICK_CLEAR_DELAY_MS);

    return () => clearTimeout(timeout);
  }, [currentTrickComplete, playedCards.length, discardPile.length, leadSuit, room.roomId]);

  useEffect(() => {
    if (!allDealt || room.winnerId || playedCards.length > 0) return;

    const zeroCardWinners = activePlayers.filter(player =>
      getRemainingCards(room.hands[player.id] || [], player.id, discardPile).length === 0
    );
    const cardHoldingLosers = activePlayers.filter(player =>
      getRemainingCards(room.hands[player.id] || [], player.id, discardPile).length > 0
    );
    const packedLosers = room.players.filter(player => packedPlayerIds.includes(player.id));
    const losingPlayers = [...cardHoldingLosers, ...packedLosers];
    if (zeroCardWinners.length === 0 || activePlayers.length <= 1) return;

    setPlayMessage(`${zeroCardWinners.map(player => player.name).join(', ')} win with 0 cards.`);
    void onRoomUpdate({
      status: 'done',
      winnerId: zeroCardWinners[0].id,
      winnerName: zeroCardWinners[0].name,
      winnerAvatar: zeroCardWinners[0].avatar,
      winnerIds: zeroCardWinners.map(player => player.id),
      winnerNames: zeroCardWinners.map(player => player.name),
      loserIds: losingPlayers.map(player => player.id),
      loserNames: losingPlayers.map(player => player.name),
      endedReason: losingPlayers.length > 0 ? 'Zero-card players win' : 'All players cleared their cards',
      currentTurnId: '',
      leadSuit: '',
    });
  }, [allDealt, room.winnerId, playedCards.length, discardPile.length, room.roomId, activePlayersWithCards.length]);

  useEffect(() => {
    if (!allDealt || !currentTurnId || roundComplete || currentTrickComplete) return;

    const currentPlayer = room.players.find(player => player.id === currentTurnId);
    if (!currentPlayer?.isBot) return;
    if (packedPlayerIds.includes(currentPlayer.id)) return;

    const turnKey = `${room.roomId}-${currentTurnId}-${playedCards.length}`;
    if (botTurnKeyRef.current === turnKey) return;
    botTurnKeyRef.current = turnKey;

    setThinkingBots(prev => new Set([...prev, currentPlayer.id]));
    botPlayRef.current = setTimeout(() => {
      const remaining = getVisibleCards(currentPlayer.id);
      const mustCut = Boolean(leadSuit && playedCards.length > 0 && !remaining.some(card => card.suit === leadSuit));
      const playable = getPlayableCards(remaining, playedCards, discardPile, leadSuit);
      const cardToPlay = firstPlayNeedsAce
        ? remaining.find(isAceOfSpades) || remaining[0]
        : mustCut
          ? getRandomCard(playable)
          : [...playable].sort((a, b) => RANK_VALUE[b.rank] - RANK_VALUE[a.rank])[0];

      setThinkingBots(prev => {
        const next = new Set(prev);
        next.delete(currentPlayer.id);
        return next;
      });

      if (cardToPlay) void playCardForPlayer(currentPlayer, cardToPlay);
    }, BOT_CARD_PLAY_DELAY_MS);

    return () => {
      if (botPlayRef.current) clearTimeout(botPlayRef.current);
    };
  }, [allDealt, currentTurnId, playedCards.length, discardPile.length, leadSuit, room.roomId, roundComplete, currentTrickComplete]);

  const renderPlayerSeat = (player: ArenaPlayer) => {
    const visibleCards = getOrderedCards(player.id, getVisibleCards(player.id));

    return (
      <PlayerSeat
        player={player}
        cards={visibleCards}
        isMe={player.id === myId}
        revealed={room.revealedBy.includes(player.id)}
        onReveal={onReveal}
        visibleCount={allDealt ? visibleCards.length : visibleCounts[player.id] || 0}
        handSpacing={handSpacing}
        cardSignScale={cardSignScale}
        handStyle={handStyle}
        cardProfileGap={cardProfileGap}
        wonCards={capturedPiles[player.id] || []}
        isPubliclyRevealed={publicRevealedBy.includes(player.id)}
        isPacked={packedPlayerIds.includes(player.id)}
        selectedCardKey={player.id === myId ? selectedCardKey : null}
        isMyTurn={player.id === myId && isMyTurn}
        onCardTap={player.id === myId ? handleMyCardTap : undefined}
        onReorderCards={player.id === myId ? handleReorderMyCards : undefined}
        onGroupCards={player.id === myId ? handleGroupMyCards : undefined}
        onShowCardsPublicly={player.id === myId ? handleShowCardsPublicly : undefined}
        onPackCards={player.id === myId ? handlePackCards : undefined}
        isThinking={player.isBot ? thinkingBots.has(player.id) : false}
      />
    );
  };

  const renderWinnerCelebration = () => {
    const winner = winnerPlayer || (room.winnerId ? {
      id: room.winnerId,
      name: room.winnerName || 'Winner',
      avatar: room.winnerAvatar || '',
    } as ArenaPlayer : null);
    const winners = winnerPlayers.length > 0 ? winnerPlayers : winner ? [winner] : [];
    if (winners.length === 0) return null;
    const title = winners.length === 1 ? winners[0].name : `${winners.length} winners`;

    return (
      <div style={{
        position: 'absolute',
        inset: 0,
        zIndex: 120,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        background: 'radial-gradient(circle at 50% 45%, rgba(22,163,74,0.16), rgba(0,0,0,0.22) 45%, transparent 70%)',
      }}>
        <div style={{
          position: 'relative',
          width: 'min(86vw, 360px)',
          borderRadius: 18,
          padding: 18,
          background: 'linear-gradient(180deg,rgba(2,18,8,0.96),rgba(0,0,0,0.9))',
          border: '1px solid rgba(250,204,21,0.5)',
          boxShadow: '0 24px 70px rgba(0,0,0,0.65), 0 0 40px rgba(250,204,21,0.22)',
          textAlign: 'center',
          animation: 'winnerPop 0.55s cubic-bezier(.18,.9,.25,1.2) both',
        }}>
          {['CHEERS', 'WINNER', 'GG'].map((label, index) => (
            <span key={label} style={{
              position: 'absolute',
              left: `${18 + index * 28}%`,
              top: -18 - index * 6,
              color: index === 1 ? '#facc15' : '#4ade80',
              fontSize: 10,
              fontWeight: 900,
              letterSpacing: 1.5,
              animation: `cheerFloat ${1.1 + index * 0.12}s ease-in-out ${index * 0.08}s infinite alternate`,
            }}>
              {label}
            </span>
          ))}
          <div style={{
            width: 76,
            height: 76,
            borderRadius: '50%',
            margin: '0 auto 10px',
            border: '3px solid #facc15',
            background: 'linear-gradient(135deg,#16a34a,#7c3aed)',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 900,
            fontSize: 28,
            boxShadow: '0 0 28px rgba(250,204,21,0.42)',
          }}>
            {winners[0].avatar ? <img src={winners[0].avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : winners[0].name[0]?.toUpperCase()}
          </div>
          {winners.length > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, margin: '-2px 0 8px' }}>
              {winners.slice(0, 5).map(player => (
                <div key={player.id} style={{ width: 26, height: 26, borderRadius: '50%', overflow: 'hidden', border: '1px solid rgba(250,204,21,0.7)', background: 'linear-gradient(135deg,#16a34a,#7c3aed)', color: '#fff', fontSize: 10, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {player.avatar ? <img src={player.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : player.name[0]?.toUpperCase()}
                </div>
              ))}
            </div>
          )}
          <p style={{ margin: 0, color: '#facc15', fontSize: 11, fontWeight: 900, letterSpacing: 2 }}>WINNER</p>
          <h2 style={{ margin: '4px 0 6px', color: '#f8fafc', fontSize: 22, lineHeight: 1.05 }}>{title}</h2>
          <p style={{ margin: 0, color: '#9ca3af', fontSize: 12, fontWeight: 700 }}>{room.endedReason || 'Round complete'}</p>
        </div>
      </div>
    );
  };

  const renderPortraitOpponentSeat = (player: ArenaPlayer) => {
    const visibleCards = getOrderedCards(player.id, getVisibleCards(player.id));
    const previewCards = visibleCards.slice(0, Math.min(6, visibleCards.length));
    const isBot = player.isBot;
    const levelColor = player.botLevel === 'legend' ? '#f59e0b' : player.botLevel === 'shark' ? '#3b82f6' : '#22c55e';
    const isPacked = packedPlayerIds.includes(player.id);
    const isPublic = publicRevealedBy.includes(player.id);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, width: 112 }}>
        {previewCards.length > 0 && (
          <div style={{ width: 112, overflow: 'hidden', display: 'flex', justifyContent: 'center' }}>
            <FanHand
              cards={previewCards}
              faceDown={!isPublic && !isPacked}
              isMe={false}
              cardSignScale={cardSignScale}
              handStyle={handStyle}
            />
          </div>
        )}
        <div style={{
          width: 30,
          height: 30,
          borderRadius: '50%',
          overflow: 'hidden',
          border: isBot ? `2px solid ${levelColor}` : '2px solid rgba(255,255,255,0.35)',
          background: isBot ? 'linear-gradient(135deg,#1d4ed8,#7c3aed)' : 'linear-gradient(135deg,#16a34a,#7c3aed)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontWeight: 900,
          fontSize: isBot ? 15 : 12,
        }}>
          {!isBot && player.avatar
            ? <img src={player.avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
            : isBot ? BOT_CONFIGS[player.botLevel || 'rookie'].emoji
            : player.name[0]?.toUpperCase()}
        </div>
        <p style={{
          margin: 0,
          width: '100%',
          color: isBot ? levelColor : '#f8fafc',
          fontWeight: 900,
          fontSize: 9,
          textAlign: 'center',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          textShadow: '0 2px 6px rgba(0,0,0,0.85)',
        }}>
          {player.name}
        </p>
        <span style={{ color: player.id === currentTurnId ? '#facc15' : '#9ca3af', fontSize: 8, fontWeight: 900 }}>
          {isPacked ? 'PACKED' : player.id === currentTurnId ? 'TURN' : `${visibleCards.length} cards`}
        </span>
      </div>
    );
  };

  if (isMobileLandscapeLayout) {
    const myPlayer = ordered.find(player => player.id === myId);
    const opponentPlayers = ordered.filter(player => player.id !== myId);
    const renderLandscapeMySeat = (player: ArenaPlayer) => {
      const visibleCards = getOrderedCards(player.id, getVisibleCards(player.id));
      const dealtCards = visibleCards.slice(0, allDealt ? visibleCards.length : visibleCounts[player.id] || 0);
      const showCards = room.revealedBy.includes(player.id) || publicRevealedBy.includes(player.id);
      const isPacked = packedPlayerIds.includes(player.id);

      return (
        <div style={{
          height: '100%',
          minWidth: 0,
          display: 'grid',
          gridTemplateColumns: 'minmax(0,1fr) 92px',
          alignItems: 'center',
          gap: 6,
        }}>
          <div style={{
            minWidth: 0,
            height: '100%',
            overflowX: 'auto',
            overflowY: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            paddingTop: 2,
          }}>
            {dealtCards.length > 0 && (
              <div style={{
                transform: 'scale(0.82)',
                transformOrigin: 'center center',
                width: 'fit-content',
                flex: '0 0 auto',
              }}>
                <FanHand
                  cards={dealtCards}
                  faceDown={!showCards}
                  isMe={true}
                  handSpacing={handSpacing}
                  cardSignScale={cardSignScale}
                  handStyle={handStyle}
                  selectedCardKey={selectedCardKey}
                  canInteract={showCards && !isPacked}
                  onCardTap={handleMyCardTap}
                  dragEnabled={!isPacked}
                  onReorderCards={handleReorderMyCards}
                />
              </div>
            )}
          </div>

          <div style={{
            height: '100%',
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            paddingRight: 4,
          }}>
            <div style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              overflow: 'hidden',
              border: '2px solid #4ade80',
              boxShadow: '0 0 12px rgba(74,222,128,0.38)',
              background: 'linear-gradient(135deg,#16a34a,#7c3aed)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 900,
              fontSize: 12,
            }}>
              {player.avatar
                ? <img src={player.avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                : player.name[0]?.toUpperCase()}
            </div>
            <p style={{ color: '#4ade80', fontWeight: 900, fontSize: 9, margin: 0, lineHeight: 1 }}>YOU</p>
            {isPacked && <span style={{ color: '#f87171', fontSize: 8, fontWeight: 900 }}>PACKED</span>}
            {!isPacked && dealtCards.length > 0 && !showCards && (
              <button
                type="button"
                onClick={onReveal}
                style={{ width: '100%', padding: '5px 4px', borderRadius: 7, background: 'linear-gradient(135deg,#16a34a,#15803d)', color: '#fff', border: 'none', fontWeight: 900, fontSize: 9 }}
              >
                See Cards
              </button>
            )}
            {!isPacked && dealtCards.length > 0 && showCards && (
              <>
                {!publicRevealedBy.includes(player.id) && (
                  <button
                    type="button"
                    onClick={handleShowCardsPublicly}
                    style={{ width: '100%', padding: '4px 4px', borderRadius: 7, background: 'rgba(59,130,246,0.18)', color: '#bfdbfe', border: '1px solid rgba(147,197,253,0.28)', fontWeight: 900, fontSize: 8 }}
                  >
                    Show
                  </button>
                )}
                <button
                  type="button"
                  onClick={handlePackCards}
                  style={{ width: '100%', padding: '4px 4px', borderRadius: 7, background: 'rgba(239,68,68,0.16)', color: '#fca5a5', border: '1px solid rgba(252,165,165,0.3)', fontWeight: 900, fontSize: 8 }}
                >
                  Pack
                </button>
              </>
            )}
            {dealtCards.length > 0 && showCards && (
              <span style={{ fontSize: 8, color: isMyTurn ? '#facc15' : '#86efac', fontWeight: 900, textAlign: 'center' }}>
                {isMyTurn ? 'Your turn' : 'Ready'}
              </span>
            )}
          </div>
        </div>
      );
    };

    const renderLandscapeOpponentSeat = (player: ArenaPlayer) => {
      const visibleCards = getOrderedCards(player.id, getVisibleCards(player.id));
      const isPacked = packedPlayerIds.includes(player.id);
      const isTurn = player.id === currentTurnId;
      const isBot = player.isBot;
      const levelColor = player.botLevel === 'legend' ? '#f59e0b' : player.botLevel === 'shark' ? '#3b82f6' : '#22c55e';

      return (
        <div style={{
          width: 118,
          minWidth: 118,
          height: 44,
          borderRadius: 12,
          padding: '5px 7px',
          display: 'grid',
          gridTemplateColumns: '30px minmax(0,1fr)',
          alignItems: 'center',
          gap: 7,
          border: isTurn ? '1px solid rgba(250,204,21,0.62)' : '1px solid rgba(255,255,255,0.1)',
          background: isTurn ? 'rgba(250,204,21,0.12)' : 'rgba(255,255,255,0.045)',
          boxShadow: isTurn ? '0 0 16px rgba(250,204,21,0.18)' : undefined,
        }}>
          <div style={{
            width: 30,
            height: 30,
            borderRadius: '50%',
            overflow: 'hidden',
            border: isBot ? `2px solid ${levelColor}` : '2px solid rgba(255,255,255,0.35)',
            background: isBot ? 'linear-gradient(135deg,#1d4ed8,#7c3aed)' : 'linear-gradient(135deg,#16a34a,#7c3aed)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 900,
            fontSize: isBot ? 15 : 12,
          }}>
            {!isBot && player.avatar
              ? <img src={player.avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
              : isBot ? BOT_CONFIGS[player.botLevel || 'rookie'].emoji
              : player.name[0]?.toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{
              margin: 0,
              color: isTurn ? '#facc15' : isBot ? levelColor : '#38bdf8',
              fontSize: 10,
              fontWeight: 900,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              textShadow: '0 2px 6px rgba(0,0,0,0.8)',
            }}>
              {player.name}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3, minWidth: 0 }}>
              <span style={{ color: isTurn ? '#facc15' : '#9ca3af', fontSize: 8, fontWeight: 900 }}>
                {isPacked ? 'PACKED' : isTurn ? 'TURN' : `${visibleCards.length} cards`}
              </span>
              {!isPacked && (
                <span style={{ display: 'flex', width: 38, height: 16, position: 'relative', flexShrink: 0 }}>
                  {visibleCards.slice(0, 4).map((_, index) => (
                    <span key={index} style={{
                      position: 'absolute',
                      left: index * 8,
                      top: 0,
                      width: 15,
                      height: 20,
                      borderRadius: 3,
                      border: '1px solid rgba(255,255,255,0.75)',
                      background: 'linear-gradient(135deg,#1d4ed8,#172554)',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.35)',
                    }} />
                  ))}
                </span>
              )}
            </div>
          </div>
        </div>
      );
    };

    return (
      <div style={{
        height: '100%',
        overflow: 'hidden',
        background: '#041105',
        position: 'relative',
        display: 'grid',
        gridTemplateRows: '56px minmax(0,1fr) 126px',
      }}>
        <div style={{
          minWidth: 0,
          minHeight: 0,
          overflowX: 'auto',
          overflowY: 'hidden',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '5px 8px',
          borderBottom: '1px solid rgba(74,222,128,0.14)',
          background: 'linear-gradient(180deg,rgba(0,0,0,0.72),rgba(2,19,8,0.88))',
        }}>
          {opponentPlayers.map(player => (
            <div key={player.id} style={{ flex: '0 0 auto' }}>
              {renderLandscapeOpponentSeat(player)}
            </div>
          ))}
        </div>

        <div style={{ position: 'relative', minWidth: 0, minHeight: 0, overflow: 'hidden', padding: 6 }}>
          <div style={{
            position: 'absolute',
            inset: '4px 8px',
            borderRadius: '50%',
            background: 'linear-gradient(160deg,#a0714f 0%,#6b3f1f 42%,#8B5E3C 70%,#5C3A1E 100%)',
            boxShadow: '0 9px 34px rgba(0,0,0,0.78), inset 0 2px 4px rgba(255,220,150,0.15)',
          }} />
          <div style={{
            position: 'absolute',
            inset: '17px 34px',
            borderRadius: '50%',
            background: 'radial-gradient(ellipse at 50% 40%, #1e7a35 0%, #155c28 54%, #0e4a1e 100%)',
            boxShadow: 'inset 0 6px 28px rgba(0,0,0,0.48), inset 0 -4px 18px rgba(0,0,0,0.28)',
            overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              opacity: 0.04,
              backgroundImage: 'repeating-linear-gradient(45deg,#fff 0,#fff 1px,transparent 0,transparent 50%)',
              backgroundSize: '6px 6px',
            }} />
          </div>

          <div style={{
            position: 'absolute',
            top: '47%',
            left: '50%',
            transform: 'translate(-50%, -52%)',
            zIndex: 20,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
            width: 'min(78vw, 430px)',
            pointerEvents: 'none',
          }}>
            <div style={{ transform: 'scale(0.82)', transformOrigin: 'center' }}>
              <DeckPile count={deckLeft} isShuffling={isShuffling} />
            </div>
            {isShuffling && (
              <div style={{ background: 'rgba(0,0,0,0.88)', borderRadius: 8, padding: '4px 10px', color: '#4ade80', fontWeight: 900, fontSize: 10, letterSpacing: 1.5, animation: 'pulse 0.8s infinite' }}>
                SHUFFLING...
              </div>
            )}
            {allDealt && playedCards.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 58, marginTop: -6 }}>
                {playedCards.map((play, index, list) => (
                  <div key={`${play.playerId}-${play.order}`} style={{
                    position: 'relative',
                    marginLeft: index === 0 ? 0 : -25,
                    transform: `rotate(${(index - (list.length - 1) / 2) * 6}deg)`,
                    zIndex: index + 1,
                  }}>
                    <PlayingCard card={play.card} small symbolScale={cardSignScale} />
                    {play.isCut && (
                      <div style={{
                        position: 'absolute',
                        left: '50%',
                        bottom: -12,
                        transform: 'translateX(-50%)',
                        borderRadius: 999,
                        padding: '1px 5px',
                        background: 'rgba(250,204,21,0.95)',
                        color: '#111827',
                        fontSize: 8,
                        fontWeight: 900,
                      }}>
                        CUT
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {allDealt && (
              <div style={{ background: 'rgba(0,0,0,0.88)', borderRadius: 10, padding: '5px 9px', color: isMyTurn ? '#facc15' : '#4ade80', fontWeight: 900, fontSize: 9, maxWidth: 300, textAlign: 'center' }}>
                {roundComplete
                  ? winnerStatusLabel
                  : currentTrickComplete
                    ? 'Checking trick winner...'
                    : isMyTurn
                      ? 'Your turn: tap a card twice'
                      : currentTurnPlayer
                        ? `${currentTurnPlayer.name}'s turn`
                        : `Start with ${getCardLabel({ rank: 'A', suit: SUITS[0] })}`}
              </div>
            )}
          </div>
        </div>

        <div style={{
          minWidth: 0,
          minHeight: 0,
          padding: '0 8px max(5px, env(safe-area-inset-bottom))',
          borderTop: '1px solid rgba(74,222,128,0.14)',
          background: 'linear-gradient(180deg,rgba(2,19,8,0.94),rgba(0,0,0,0.82))',
          overflowX: 'auto',
          overflowY: 'auto',
        }}>
          {myPlayer && renderLandscapeMySeat(myPlayer)}
        </div>

        {renderWinnerCelebration()}
      </div>
    );
  }

  if (isPortraitLayout) {
    const myPlayer = ordered.find(player => player.id === myId);
    const opponentPlayers = ordered.filter(player => player.id !== myId);

    return (
      <div style={{
        height: '100%',
        overflow: 'hidden',
        background: '#041105',
        position: 'relative',
        display: 'grid',
        gridTemplateRows: 'auto minmax(240px, 1fr) auto',
      }}>
        <div style={{
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          overflowY: 'hidden',
          padding: '10px',
          borderBottom: '1px solid rgba(74,222,128,0.12)',
          background: 'linear-gradient(180deg,rgba(0,0,0,0.6),rgba(2,19,8,0.82))',
        }}>
          {opponentPlayers.map(player => (
            <div key={player.id} style={{
              minWidth: 126,
              display: 'flex',
              justifyContent: 'center',
              padding: '4px 6px',
              borderRadius: 12,
              border: player.id === currentTurnId ? '1px solid rgba(250,204,21,0.45)' : '1px solid rgba(255,255,255,0.08)',
              background: player.id === currentTurnId ? 'rgba(250,204,21,0.08)' : 'rgba(255,255,255,0.04)',
            }}>
              {renderPortraitOpponentSeat(player)}
            </div>
          ))}
        </div>

        <div style={{ position: 'relative', minHeight: 0, overflow: 'hidden', padding: 10 }}>
          <div style={{
            position: 'absolute',
            inset: 10,
            borderRadius: 28,
            background: 'linear-gradient(160deg,#a0714f 0%,#6b3f1f 42%,#8B5E3C 70%,#5C3A1E 100%)',
            boxShadow: '0 10px 34px rgba(0,0,0,0.75), inset 0 2px 4px rgba(255,220,150,0.15)',
          }} />
          <div style={{
            position: 'absolute',
            inset: 26,
            borderRadius: 22,
            background: 'radial-gradient(ellipse at 50% 40%, #1e7a35 0%, #155c28 52%, #0e4a1e 100%)',
            boxShadow: 'inset 0 6px 26px rgba(0,0,0,0.48), inset 0 -4px 18px rgba(0,0,0,0.28)',
            overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute',
              inset: 0,
              opacity: 0.04,
              backgroundImage: 'repeating-linear-gradient(45deg,#fff 0,#fff 1px,transparent 0,transparent 50%)',
              backgroundSize: '6px 6px',
            }} />
          </div>

          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 20,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
            width: 'min(82vw, 300px)',
          }}>
            <DeckPile count={deckLeft} isShuffling={isShuffling} />
            {isShuffling && (
              <div style={{ background: 'rgba(0,0,0,0.9)', borderRadius: 8, padding: '4px 10px', color: '#4ade80', fontWeight: 900, fontSize: 11, letterSpacing: 1.5, animation: 'pulse 0.8s infinite' }}>
                SHUFFLING...
              </div>
            )}
            {allDealt && playedCards.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 78, marginTop: 2 }}>
                {playedCards.map((play, index, list) => (
                  <div key={`${play.playerId}-${play.order}`} style={{
                    position: 'relative',
                    marginLeft: index === 0 ? 0 : -24,
                    transform: `rotate(${(index - (list.length - 1) / 2) * 6}deg)`,
                    zIndex: index + 1,
                  }}>
                    <PlayingCard card={play.card} small symbolScale={cardSignScale} />
                    {play.isCut && (
                      <div style={{
                        position: 'absolute',
                        left: '50%',
                        bottom: -13,
                        transform: 'translateX(-50%)',
                        borderRadius: 999,
                        padding: '1px 5px',
                        background: 'rgba(250,204,21,0.95)',
                        color: '#111827',
                        fontSize: 8,
                        fontWeight: 900,
                      }}>
                        CUT
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {allDealt && (
              <div style={{ background: 'rgba(0,0,0,0.88)', borderRadius: 10, padding: '6px 10px', color: isMyTurn ? '#facc15' : '#4ade80', fontWeight: 900, fontSize: 11, maxWidth: 250, textAlign: 'center' }}>
                {roundComplete
                  ? winnerStatusLabel
                  : currentTrickComplete
                    ? 'Checking trick winner...'
                    : isMyTurn
                      ? 'Your turn: tap a card twice'
                      : currentTurnPlayer
                        ? `${currentTurnPlayer.name}'s turn`
                        : `Start with ${getCardLabel({ rank: 'A', suit: SUITS[0] })}`}
                {playMessage && <div style={{ color: '#9ca3af', fontSize: 9, fontWeight: 700, marginTop: 2 }}>{playMessage}</div>}
              </div>
            )}
            {allDealt && discardPile.length > 0 && (
              <div style={{ background: 'rgba(0,0,0,0.78)', borderRadius: 8, padding: '4px 9px', color: '#9ca3af', fontWeight: 800, fontSize: 9 }}>
                Won decks: {discardPile.length} cards
              </div>
            )}
          </div>
        </div>

        <div style={{
          minHeight: 178,
          padding: '4px 0 max(10px, env(safe-area-inset-bottom))',
          borderTop: '1px solid rgba(74,222,128,0.14)',
          background: 'linear-gradient(180deg,rgba(2,19,8,0.94),rgba(0,0,0,0.82))',
          overflowX: 'hidden',
          overflowY: 'auto',
        }}>
          {myPlayer && renderPlayerSeat(myPlayer)}
        </div>

        {!isPortraitLayout && controlsOpen && (
          <div style={{
            position: 'absolute',
            top: 8,
            right: 8,
            bottom: 8,
            width: 'min(330px, calc(100vw - 16px))',
            zIndex: 140,
            borderRadius: 16,
            border: '1px solid rgba(74,222,128,0.22)',
            background: 'linear-gradient(180deg,rgba(0,0,0,0.92),rgba(2,19,8,0.97))',
            padding: 14,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            boxShadow: '0 24px 70px rgba(0,0,0,0.7)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
              <div>
                <p style={{ color: '#4ade80', fontWeight: 900, letterSpacing: 2.5, fontSize: 11, margin: 0 }}>ARENA CONTROLS</p>
                <p style={{ color: '#6b7280', fontSize: 10, margin: '4px 0 0' }}>Room {room.roomId}</p>
              </div>
              <button type="button" onClick={() => setControlsOpen(false)} style={{ width: 30, height: 30, borderRadius: 9, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: '#d1d5db', fontWeight: 900, cursor: 'pointer' }}>
                X
              </button>
            </div>

            <div style={{ background: 'rgba(74,222,128,0.07)', border: '1px solid rgba(74,222,128,0.18)', borderRadius: 14, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                <p style={{ color: '#d1fae5', fontWeight: 900, fontSize: 12, margin: 0 }}>Card spacing</p>
                <span style={{ color: '#4ade80', fontFamily: 'monospace', fontSize: 12, fontWeight: 900 }}>{handSpacing}px</span>
              </div>
              <input type="range" min={CARD_SPACING_MIN} max={CARD_SPACING_MAX} step={1} value={handSpacing} onChange={(event) => onHandSpacingChange(clampCardSpacing(Number(event.target.value)))} style={{ width: '100%', accentColor: '#4ade80', marginTop: 10 }} aria-label="Card spacing" />
            </div>

            <div style={{ background: 'rgba(168,85,247,0.07)', border: '1px solid rgba(168,85,247,0.18)', borderRadius: 14, padding: 12 }}>
              <p style={{ color: '#ede9fe', fontWeight: 900, fontSize: 12, margin: '0 0 10px' }}>Holding style</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {([{ value: 'readable' as HandStyle, label: 'Readable row' }, { value: 'classic' as HandStyle, label: 'Classic fan' }]).map(option => (
                  <button key={option.value} type="button" onClick={() => onHandStyleChange(option.value)} style={{
                    padding: '8px 8px',
                    borderRadius: 9,
                    border: `1px solid ${handStyle === option.value ? 'rgba(196,181,253,0.6)' : 'rgba(255,255,255,0.12)'}`,
                    background: handStyle === option.value ? 'rgba(168,85,247,0.22)' : 'rgba(0,0,0,0.32)',
                    color: handStyle === option.value ? '#ddd6fe' : '#9ca3af',
                    fontSize: 11,
                    fontWeight: 900,
                    cursor: 'pointer',
                  }}>
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ background: 'rgba(250,204,21,0.07)', border: '1px solid rgba(250,204,21,0.18)', borderRadius: 14, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                <p style={{ color: '#fef3c7', fontWeight: 900, fontSize: 12, margin: 0 }}>Profile distance</p>
                <span style={{ color: '#facc15', fontFamily: 'monospace', fontSize: 12, fontWeight: 900 }}>{cardProfileGap}px</span>
              </div>
              <input type="range" min={CARD_PROFILE_GAP_MIN} max={CARD_PROFILE_GAP_MAX} step={1} value={cardProfileGap} onChange={(event) => onCardProfileGapChange(clampCardProfileGap(Number(event.target.value)))} style={{ width: '100%', accentColor: '#facc15', marginTop: 10 }} aria-label="Card to profile distance" />
            </div>

            <div style={{ background: 'rgba(14,165,233,0.07)', border: '1px solid rgba(14,165,233,0.18)', borderRadius: 14, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                <p style={{ color: '#dbeafe', fontWeight: 900, fontSize: 12, margin: 0 }}>Card signs</p>
                <span style={{ color: '#60a5fa', fontFamily: 'monospace', fontSize: 12, fontWeight: 900 }}>{Math.round(cardSignScale * 100)}%</span>
              </div>
              <input type="range" min={CARD_SIGN_SCALE_MIN} max={CARD_SIGN_SCALE_MAX} step={0.05} value={cardSignScale} onChange={(event) => onCardSignScaleChange(clampCardSignScale(Number(event.target.value)))} style={{ width: '100%', accentColor: '#60a5fa', marginTop: 10 }} aria-label="Card sign size" />
            </div>

            {isHost && allDealt && (
              <button onClick={onNewGame} style={{ width: '100%', padding: '11px 16px', borderRadius: 12, fontWeight: 900, fontSize: 12, background: 'linear-gradient(135deg,#16a34a,#15803d)', color: '#fff', border: 'none', cursor: 'pointer' }}>
                New Deal
              </button>
            )}
            <button onClick={onLeave} style={{ width: '100%', marginTop: 'auto', padding: '11px 14px', borderRadius: 12, fontWeight: 700, fontSize: 12, background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer' }}>
              Leave
            </button>
          </div>
        )}

        {renderWinnerCelebration()}
      </div>
    );
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: !isCompactLayout && controlsOpen ? 'minmax(0,1fr) 320px' : '1fr',
      gridTemplateRows: '1fr',
      height: '100%',
      overflow: 'hidden',
      background: '#041105',
      position: 'relative',
    }}>
      {/* Table stage stays separate from controls so seats and cards never sit under UI. */}
      <div style={{ position: 'relative', overflow: 'hidden', minWidth: 0, minHeight: isCompactLayout ? 560 : 0 }}>
        {/* Dark bg */}
        <div style={{ position: 'absolute', inset: 0, background: '#071407' }} />

        <button
          type="button"
          onClick={() => setControlsOpen(true)}
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
            zIndex: 60,
            padding: '9px 13px',
            borderRadius: 12,
            border: '1px solid rgba(74,222,128,0.28)',
            background: 'rgba(0,0,0,0.72)',
            color: '#bbf7d0',
            fontWeight: 900,
            fontSize: 12,
            cursor: 'pointer',
            boxShadow: '0 6px 20px rgba(0,0,0,0.35)',
          }}
        >
          Controls
        </button>

        {/* Wood border — proper wide ellipse */}
        <div style={{
          position: 'absolute',
          top: '8%', bottom: '8%', left: '4%', right: '4%',
          borderRadius: '50%',
          background: 'linear-gradient(160deg,#a0714f 0%,#6b3f1f 40%,#8B5E3C 70%,#5C3A1E 100%)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.9), inset 0 2px 4px rgba(255,220,150,0.15)',
        }} />

        {/* Green felt — inset from wood */}
        <div style={{
          position: 'absolute',
          top: '13%', bottom: '13%', left: '8%', right: '8%',
          borderRadius: '50%',
          background: 'radial-gradient(ellipse at 50% 40%, #1e7a35 0%, #155c28 50%, #0e4a1e 100%)',
          boxShadow: 'inset 0 6px 30px rgba(0,0,0,0.5), inset 0 -4px 20px rgba(0,0,0,0.3)',
        }}>
          {/* Felt texture */}
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%', opacity: 0.035,
            backgroundImage: 'repeating-linear-gradient(45deg,#fff 0,#fff 1px,transparent 0,transparent 50%)',
            backgroundSize: '6px 6px',
          }} />
        </div>

        {/* Center deck pile */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 15, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        }}>
          <DeckPile count={deckLeft} isShuffling={isShuffling} />
          {isShuffling && (
            <div style={{ background: 'rgba(0,0,0,0.9)', borderRadius: 8, padding: '4px 12px', color: '#4ade80', fontWeight: 900, fontSize: 12, letterSpacing: 2, animation: 'pulse 0.8s infinite' }}>
              🔀 SHUFFLING...
            </div>
          )}
          {allDealt && playedCards.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 86, marginTop: 2 }}>
              {playedCards.map((play, index, list) => (
                <div key={`${play.playerId}-${play.order}`} style={{
                  position: 'relative',
                  marginLeft: index === 0 ? 0 : -22,
                  transform: `rotate(${(index - (list.length - 1) / 2) * 5}deg)`,
                  zIndex: index + 1,
                }}>
                  <PlayingCard card={play.card} small symbolScale={cardSignScale} />
                  {play.isCut && (
                    <div style={{
                      position: 'absolute',
                      left: '50%',
                      bottom: -13,
                      transform: 'translateX(-50%)',
                      borderRadius: 999,
                      padding: '1px 5px',
                      background: 'rgba(250,204,21,0.95)',
                      color: '#111827',
                      fontSize: 8,
                      fontWeight: 900,
                    }}>
                      CUT
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {allDealt && (
            <div style={{ background: 'rgba(0,0,0,0.88)', borderRadius: 8, padding: '5px 12px', color: isMyTurn ? '#facc15' : '#4ade80', fontWeight: 900, fontSize: 11, maxWidth: 240, textAlign: 'center' }}>
              {roundComplete
                ? winnerStatusLabel
                : currentTrickComplete
                  ? 'Checking trick winner...'
                  : isMyTurn
                    ? 'Your turn: tap a card twice'
                    : currentTurnPlayer
                      ? `${currentTurnPlayer.name}'s turn`
                      : `Start with ${getCardLabel({ rank: 'A', suit: SUITS[0] })}`}
              {playMessage && <div style={{ color: '#9ca3af', fontSize: 9, fontWeight: 700, marginTop: 2 }}>{playMessage}</div>}
            </div>
          )}
          {allDealt && discardPile.length > 0 && (
            <div style={{ background: 'rgba(0,0,0,0.82)', borderRadius: 8, padding: '4px 10px', color: '#9ca3af', fontWeight: 800, fontSize: 10 }}>
              Won decks: {discardPile.length} cards
              {capturedDeckLeader && (
                <div style={{ color: '#bbf7d0', marginTop: 2 }}>
                  {capturedDeckLeader.player.name}: {capturedDeckLeader.count}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Player seats */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 20 }}>
          {ordered.map((player, seatIdx) => (
            <div key={player.id} style={{ ...getSeatStyle(seatIdx, ordered.length) }}>
              {renderPlayerSeat(player)}
            </div>
          ))}
        </div>
        {renderWinnerCelebration()}
      </div>

      {/* Controls panel */}
      {controlsOpen && (
      <div style={{
        position: isCompactLayout ? 'absolute' : 'relative',
        top: isCompactLayout ? 0 : undefined,
        right: isCompactLayout ? 0 : undefined,
        bottom: isCompactLayout ? 0 : undefined,
        width: isCompactLayout ? 'min(320px, 92vw)' : 'auto',
        zIndex: isCompactLayout ? 80 : undefined,
        borderLeft: isCompactLayout ? 'none' : '1px solid rgba(74,222,128,0.14)',
        borderTop: isCompactLayout ? '1px solid rgba(74,222,128,0.14)' : 'none',
        background: 'linear-gradient(180deg,rgba(0,0,0,0.82),rgba(2,19,8,0.94))',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        overflowY: 'auto',
        minWidth: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <div>
            <p style={{ color: '#4ade80', fontWeight: 900, letterSpacing: 3, fontSize: 12, margin: 0 }}>ARENA CONTROLS</p>
            <p style={{ color: '#6b7280', fontSize: 11, margin: '5px 0 0' }}>Room {room.roomId}</p>
          </div>
          <button
            type="button"
            onClick={() => setControlsOpen(false)}
            style={{ width: 30, height: 30, borderRadius: 9, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: '#d1d5db', fontWeight: 900, cursor: 'pointer' }}
          >
            X
          </button>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ color: '#4ade80', fontSize: 11, fontWeight: 700, fontFamily: 'monospace', letterSpacing: 2 }}>{room.roomId}</span>
          <span style={{ color: '#6b7280', fontSize: 10 }}>
            {room.players.filter(p => !p.isBot).length}👤
            {room.players.filter(p => p.isBot).length > 0 && ` + ${room.players.filter(p => p.isBot).length}🤖`}
          </span>
          {allDealt && <span style={{ color: '#4ade80', fontSize: 10, fontWeight: 700 }}>✓ All dealt</span>}
        </div>

        <div style={{ background: 'rgba(74,222,128,0.07)', border: '1px solid rgba(74,222,128,0.18)', borderRadius: 14, padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
            <p style={{ color: '#d1fae5', fontWeight: 900, fontSize: 12, margin: 0 }}>Card spacing</p>
            <span style={{ color: '#4ade80', fontFamily: 'monospace', fontSize: 12, fontWeight: 900 }}>{handSpacing}px</span>
          </div>
          <input
            type="range"
            min={CARD_SPACING_MIN}
            max={CARD_SPACING_MAX}
            step={1}
            value={handSpacing}
            onChange={(event) => onHandSpacingChange(clampCardSpacing(Number(event.target.value)))}
            style={{ width: '100%', accentColor: '#4ade80', marginTop: 10 }}
            aria-label="Card spacing"
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
            <button
              type="button"
              onClick={() => onHandSpacingChange(clampCardSpacing(handSpacing - 4))}
              style={{ padding: '7px 8px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.35)', color: '#d1d5db', fontSize: 11, fontWeight: 900, cursor: 'pointer' }}
            >
              - Tighten
            </button>
            <button
              type="button"
              onClick={() => onHandSpacingChange(clampCardSpacing(handSpacing + 4))}
              style={{ padding: '7px 8px', borderRadius: 9, border: '1px solid rgba(74,222,128,0.28)', background: 'rgba(74,222,128,0.12)', color: '#bbf7d0', fontSize: 11, fontWeight: 900, cursor: 'pointer' }}
            >
              + Spread
            </button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6b7280', fontSize: 10, fontWeight: 700 }}>
            <span>Close</span>
            <span>Readable</span>
          </div>
        </div>

        <div style={{ background: 'rgba(168,85,247,0.07)', border: '1px solid rgba(168,85,247,0.18)', borderRadius: 14, padding: 12 }}>
          <p style={{ color: '#ede9fe', fontWeight: 900, fontSize: 12, margin: '0 0 10px' }}>Holding style</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {([
              { value: 'readable' as HandStyle, label: 'Readable row' },
              { value: 'classic' as HandStyle, label: 'Classic fan' },
            ]).map(option => {
              const selected = handStyle === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onHandStyleChange(option.value)}
                  style={{
                    padding: '8px 8px',
                    borderRadius: 9,
                    border: `1px solid ${selected ? 'rgba(196,181,253,0.6)' : 'rgba(255,255,255,0.12)'}`,
                    background: selected ? 'rgba(168,85,247,0.22)' : 'rgba(0,0,0,0.32)',
                    color: selected ? '#ddd6fe' : '#9ca3af',
                    fontSize: 11,
                    fontWeight: 900,
                    cursor: 'pointer',
                  }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ background: 'rgba(250,204,21,0.07)', border: '1px solid rgba(250,204,21,0.18)', borderRadius: 14, padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
            <p style={{ color: '#fef3c7', fontWeight: 900, fontSize: 12, margin: 0 }}>Profile distance</p>
            <span style={{ color: '#facc15', fontFamily: 'monospace', fontSize: 12, fontWeight: 900 }}>{cardProfileGap}px</span>
          </div>
          <input
            type="range"
            min={CARD_PROFILE_GAP_MIN}
            max={CARD_PROFILE_GAP_MAX}
            step={1}
            value={cardProfileGap}
            onChange={(event) => onCardProfileGapChange(clampCardProfileGap(Number(event.target.value)))}
            style={{ width: '100%', accentColor: '#facc15', marginTop: 10 }}
            aria-label="Card to profile distance"
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
            <button
              type="button"
              onClick={() => onCardProfileGapChange(clampCardProfileGap(cardProfileGap - 4))}
              style={{ padding: '7px 8px', borderRadius: 9, border: '1px solid rgba(250,204,21,0.28)', background: 'rgba(250,204,21,0.12)', color: '#fde68a', fontSize: 11, fontWeight: 900, cursor: 'pointer' }}
            >
              Pull closer
            </button>
            <button
              type="button"
              onClick={() => onCardProfileGapChange(clampCardProfileGap(cardProfileGap + 4))}
              style={{ padding: '7px 8px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.35)', color: '#d1d5db', fontSize: 11, fontWeight: 900, cursor: 'pointer' }}
            >
              Push away
            </button>
          </div>
        </div>

        <div style={{ background: 'rgba(14,165,233,0.07)', border: '1px solid rgba(14,165,233,0.18)', borderRadius: 14, padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
            <p style={{ color: '#dbeafe', fontWeight: 900, fontSize: 12, margin: 0 }}>Card signs</p>
            <span style={{ color: '#60a5fa', fontFamily: 'monospace', fontSize: 12, fontWeight: 900 }}>{Math.round(cardSignScale * 100)}%</span>
          </div>
          <input
            type="range"
            min={CARD_SIGN_SCALE_MIN}
            max={CARD_SIGN_SCALE_MAX}
            step={0.05}
            value={cardSignScale}
            onChange={(event) => onCardSignScaleChange(clampCardSignScale(Number(event.target.value)))}
            style={{ width: '100%', accentColor: '#60a5fa', marginTop: 10 }}
            aria-label="Card sign size"
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
            <button
              type="button"
              onClick={() => onCardSignScaleChange(clampCardSignScale(cardSignScale - 0.05))}
              style={{ padding: '7px 8px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.35)', color: '#d1d5db', fontSize: 11, fontWeight: 900, cursor: 'pointer' }}
            >
              - Smaller
            </button>
            <button
              type="button"
              onClick={() => onCardSignScaleChange(clampCardSignScale(cardSignScale + 0.05))}
              style={{ padding: '7px 8px', borderRadius: 9, border: '1px solid rgba(96,165,250,0.28)', background: 'rgba(96,165,250,0.12)', color: '#bfdbfe', fontSize: 11, fontWeight: 900, cursor: 'pointer' }}
            >
              + Larger
            </button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6b7280', fontSize: 10, fontWeight: 700 }}>
            <span>Small</span>
            <span>Bold</span>
          </div>
        </div>

        {isHost && allDealt && (
          <button onClick={onNewGame} style={{ width: '100%', padding: '11px 16px', borderRadius: 12, fontWeight: 900, fontSize: 12, background: 'linear-gradient(135deg,#16a34a,#15803d)', color: '#fff', border: 'none', cursor: 'pointer' }}>
            🔀 New Deal
          </button>
        )}
        <button onClick={onLeave} style={{ width: '100%', marginTop: isCompactLayout ? 0 : 'auto', padding: '11px 14px', borderRadius: 12, fontWeight: 700, fontSize: 12, background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer' }}>
          Leave
        </button>
      </div>
      )}
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
  const [handSpacing, setHandSpacing] = useState(() => {
    if (typeof localStorage === 'undefined') return CARD_SPACING_DEFAULT;
    const saved = localStorage.getItem('ct-poker-hand-spacing');
    return clampCardSpacing(saved ? Number(saved) : CARD_SPACING_DEFAULT);
  });
  const [cardSignScale, setCardSignScale] = useState(() => {
    if (typeof localStorage === 'undefined') return CARD_SIGN_SCALE_DEFAULT;
    const saved = localStorage.getItem('ct-poker-card-sign-scale');
    return clampCardSignScale(saved ? Number(saved) : CARD_SIGN_SCALE_DEFAULT);
  });
  const [handStyle, setHandStyle] = useState<HandStyle>(() => {
    if (typeof localStorage === 'undefined') return 'readable';
    return localStorage.getItem('ct-poker-hand-style') === 'classic' ? 'classic' : 'readable';
  });
  const [cardProfileGap, setCardProfileGap] = useState(() => {
    if (typeof localStorage === 'undefined') return CARD_PROFILE_GAP_DEFAULT;
    const saved = localStorage.getItem('ct-poker-card-profile-gap');
    return clampCardProfileGap(saved ? Number(saved) : CARD_PROFILE_GAP_DEFAULT);
  });
  const unsubRef = useRef<(() => void) | null>(null);
  const guestProfileRef = useRef<ArenaPlayer | null>(null);

  if (!guestProfileRef.current) {
    guestProfileRef.current = {
      id: `guest_${Math.random().toString(36).slice(2, 8)}`,
      name: 'Guest',
      avatar: '',
    };
  }

  const myProfile = useMemo(() => currentUser
    ? globalPlayers.find(p => p.id === currentUser.uid) || {
        id: currentUser.uid, name: currentUser.displayName || 'Player', avatar: currentUser.photoURL || '',
      }
    : guestProfileRef.current!,
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

  useEffect(() => {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem('ct-poker-hand-spacing', String(handSpacing));
  }, [handSpacing]);

  useEffect(() => {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem('ct-poker-card-sign-scale', String(cardSignScale));
  }, [cardSignScale]);

  useEffect(() => {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem('ct-poker-hand-style', handStyle);
  }, [handStyle]);

  useEffect(() => {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem('ct-poker-card-profile-gap', String(cardProfileGap));
  }, [cardProfileGap]);

  // Lock body scroll while arena is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const handleCreateRoom = async (_totalSeats: number, bots: { count: number; level: BotLevel }) => {
    setError('');
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const humanPlayer: ArenaPlayer = { id: myProfile.id, name: myProfile.name, avatar: myProfile.avatar };
    const botPlayers: ArenaPlayer[] = Array.from({ length: bots.count }, (_, i) => createBot(bots.level, i));
    const allPlayers = [humanPlayer, ...botPlayers];

    const newRoom: ArenaRoom = {
      roomId, hostId: myProfile.id, players: allPlayers,
      status: 'waiting', deck: [], hands: {}, revealedBy: [], publicRevealedBy: [], packedPlayerIds: [], dealStep: 0, createdAt: Date.now(),
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
    const remainingDeck = getRemainingDeck(shuffled, r.players.length);
    const update = { status: 'shuffling' as const, deck: remainingDeck, hands, revealedBy: [], publicRevealedBy: [], packedPlayerIds: [], dealStep: 0, playedCards: [], discardPile: [], capturedPiles: {}, currentTurnId: '', gameStarted: false, leadSuit: '' as const, winnerId: '', winnerName: '', winnerAvatar: '', winnerIds: [], winnerNames: [], loserIds: [], loserNames: [], endedReason: '' };
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

  const handleRoomUpdate = async (updates: Partial<ArenaRoom>) => {
    if (!room) return;
    const ref = doc(db, ARENA_COLL, room.roomId);
    setRoom(prev => prev ? { ...prev, ...updates } : prev);
    try {
      await updateDoc(ref, updates);
    } catch {
      // Local optimistic state keeps offline/bot games responsive.
    }
  };

  const handleLeave = () => { if (unsubRef.current) unsubRef.current(); setRoom(null); setScreen('lobby'); };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'radial-gradient(ellipse at center,#0d2b0d 0%,#071407 100%)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden', // prevent any scroll
    }}>
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

      <div style={{ flex: 1, overflow: 'hidden', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {screen === 'lobby' && (
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            <Lobby currentUser={currentUser} globalPlayers={globalPlayers}
              onCreateRoom={handleCreateRoom} onJoinRoom={handleJoinRoom} />
          </div>
        )}
        {screen === 'room' && room && room.status === 'waiting' && (
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            <WaitingRoom room={room} myId={myProfile.id}
              onJoinAsPlayer={handleJoinAsPlayer} onStartDeal={handleStartDeal} onLeave={handleLeave} />
          </div>
        )}
        {screen === 'room' && room && (room.status === 'shuffling' || room.status === 'reveal' || room.status === 'done') && (
          <PokerTable room={room} myId={myProfile.id}
            onReveal={handleReveal} onNewGame={handleNewGame} onLeave={handleLeave}
            onRoomUpdate={handleRoomUpdate}
            handSpacing={handSpacing} onHandSpacingChange={setHandSpacing}
            cardSignScale={cardSignScale} onCardSignScaleChange={setCardSignScale}
            handStyle={handStyle} onHandStyleChange={setHandStyle}
            cardProfileGap={cardProfileGap} onCardProfileGapChange={setCardProfileGap} />
        )}
      </div>
    </div>
  );
};
