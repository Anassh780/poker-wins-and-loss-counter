import type { FC } from 'react';

export type Suit = '♠' | '♥' | '♦' | '♣';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export interface CardData {
  suit: Suit;
  rank: Rank;
}

interface PlayingCardProps {
  card?: CardData;
  faceDown?: boolean;
  small?: boolean;
  dealIndex?: number; // for stagger animation
  isNew?: boolean;   // triggers deal-in animation
  symbolScale?: number;
}

const isRed = (suit: Suit) => suit === '♥' || suit === '♦';

export const SuitMark: FC<{ suit: Suit; size?: number; color?: string; style?: React.CSSProperties }> = ({
  suit,
  size = 16,
  color,
  style,
}) => {
  const fill = color || (isRed(suit) ? '#d40000' : '#050505');
  const common = { width: size, height: size, display: 'block', ...style };

  if (suit === '♥') {
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true" style={common}>
        <path
          fill={fill}
          d="M32 56C17.5 43.5 6 34.1 6 20.7C6 11.4 12.5 5 21.2 5C26.2 5 30.2 7.7 32 11.2C33.8 7.7 37.8 5 42.8 5C51.5 5 58 11.4 58 20.7C58 34.1 46.5 43.5 32 56Z"
        />
      </svg>
    );
  }

  if (suit === '♦') {
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true" style={common}>
        <path fill={fill} d="M32 3L58 32L32 61L6 32L32 3Z" />
      </svg>
    );
  }

  if (suit === '♣') {
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true" style={common}>
        <circle cx="32" cy="19" r="15" fill={fill} />
        <circle cx="18" cy="36" r="15" fill={fill} />
        <circle cx="46" cy="36" r="15" fill={fill} />
        <path fill={fill} d="M32 34C34 45 38 54 45 61H19C26 54 30 45 32 34Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" style={common}>
      <path
        fill={fill}
        d="M32 3C18 17 6 28.5 6 41.6C6 51 12.8 57.5 22 57.5C26.5 57.5 30 55.4 32 51.8C30.6 56.1 27.9 59.2 23.8 62H40.2C36.1 59.2 33.4 56.1 32 51.8C34 55.4 37.5 57.5 42 57.5C51.2 57.5 58 51 58 41.6C58 28.5 46 17 32 3Z"
      />
    </svg>
  );
};

type CourtRank = 'J' | 'Q' | 'K';

const COURT_STYLES: Record<CourtRank, {
  robe: string;
  robeDark: string;
  accent: string;
  accentTwo: string;
  crown: string;
  trim: string;
  hair: string;
}> = {
  J: {
    robe: '#e11d48',
    robeDark: '#7f1d1d',
    accent: '#0ea5e9',
    accentTwo: '#fde047',
    crown: '#ef4444',
    trim: '#111827',
    hair: '#111827',
  },
  Q: {
    robe: '#facc15',
    robeDark: '#b45309',
    accent: '#dc2626',
    accentTwo: '#22c55e',
    crown: '#fde68a',
    trim: '#0ea5e9',
    hair: '#7c2d12',
  },
  K: {
    robe: '#111827',
    robeDark: '#020617',
    accent: '#dc2626',
    accentTwo: '#facc15',
    crown: '#facc15',
    trim: '#0ea5e9',
    hair: '#111827',
  },
};

const PIP_POSITIONS: Partial<Record<Rank, { x: number; y: number; rotate?: boolean }[]>> = {
  'A':  [{ x: 50, y: 50 }],
  '2':  [{ x: 50, y: 24 }, { x: 50, y: 76, rotate: true }],
  '3':  [{ x: 50, y: 22 }, { x: 50, y: 50 }, { x: 50, y: 78, rotate: true }],
  '4':  [{ x: 30, y: 24 }, { x: 70, y: 24 }, { x: 30, y: 76, rotate: true }, { x: 70, y: 76, rotate: true }],
  '5':  [{ x: 30, y: 22 }, { x: 70, y: 22 }, { x: 50, y: 50 }, { x: 30, y: 78, rotate: true }, { x: 70, y: 78, rotate: true }],
  '6':  [{ x: 30, y: 20 }, { x: 70, y: 20 }, { x: 30, y: 50 }, { x: 70, y: 50 }, { x: 30, y: 80, rotate: true }, { x: 70, y: 80, rotate: true }],
  '7':  [{ x: 30, y: 17 }, { x: 70, y: 17 }, { x: 50, y: 34 }, { x: 30, y: 52 }, { x: 70, y: 52 }, { x: 30, y: 82, rotate: true }, { x: 70, y: 82, rotate: true }],
  '8':  [{ x: 30, y: 16 }, { x: 70, y: 16 }, { x: 50, y: 33 }, { x: 30, y: 48 }, { x: 70, y: 48 }, { x: 50, y: 67, rotate: true }, { x: 30, y: 84, rotate: true }, { x: 70, y: 84, rotate: true }],
  '9':  [{ x: 30, y: 14 }, { x: 70, y: 14 }, { x: 30, y: 36 }, { x: 70, y: 36 }, { x: 50, y: 50 }, { x: 30, y: 64, rotate: true }, { x: 70, y: 64, rotate: true }, { x: 30, y: 86, rotate: true }, { x: 70, y: 86, rotate: true }],
  '10': [{ x: 30, y: 12 }, { x: 70, y: 12 }, { x: 50, y: 27 }, { x: 30, y: 38 }, { x: 70, y: 38 }, { x: 30, y: 62, rotate: true }, { x: 70, y: 62, rotate: true }, { x: 50, y: 73, rotate: true }, { x: 30, y: 88, rotate: true }, { x: 70, y: 88, rotate: true }],
};

const CourtArt: FC<{ suit: Suit; rank: Rank; compact: boolean; symbolScale: number }> = ({ suit, rank, compact, symbolScale }) => {
  const color = isRed(suit) ? '#d40000' : '#111';
  const courtRank: CourtRank = rank === 'J' || rank === 'Q' || rank === 'K' ? rank : 'K';
  const court = COURT_STYLES[courtRank];
  const suitSize = Math.max(5, (compact ? 5.5 : 8.5) * symbolScale);
  const detailOpacity = compact ? 0.75 : 1;
  const faceLabel = courtRank === 'K' ? 'King' : courtRank === 'Q' ? 'Queen' : 'Jack';
  const CourtHalf = ({ flipped }: { flipped?: boolean }) => (
    <g transform={flipped ? 'rotate(180 50 70)' : undefined}>
      <path d="M17 68L31 30L50 18L69 30L83 68Z" fill={court.robe} stroke={court.trim} strokeWidth="1.5" />
      <path d="M50 18L83 68H50Z" fill={court.robeDark} opacity="0.55" />
      <path d="M26 68L41 32L50 24L59 32L74 68" fill="none" stroke={court.accentTwo} strokeWidth="2.6" />
      <path d="M36 31L64 66" stroke={court.accent} strokeWidth="8" strokeLinecap="round" />
      <path d="M38 31L66 66" stroke={court.accentTwo} strokeWidth="2" strokeLinecap="round" opacity={detailOpacity} />
      <path d="M28 48L16 57L23 66L39 58Z" fill={court.accent} stroke={court.trim} strokeWidth="1" />
      <path d="M72 48L84 57L77 66L61 58Z" fill={court.accentTwo} stroke={court.trim} strokeWidth="1" />
      <path d="M39 23C39 14 45 8 50 8C55 8 61 14 61 23C61 31 56 36 50 36C44 36 39 31 39 23Z" fill="#f4c99d" stroke="#7c2d12" strokeWidth="1" />
      <path d="M38 20C40 10 47 7 52 8C58 10 62 15 62 23C58 19 55 16 50 16C45 16 42 18 38 20Z" fill={court.hair} />
      <path d="M39 11L43 3L47 10L50 2L53 10L57 3L61 11Z" fill={court.crown} stroke="#92400e" strokeWidth="1" />
      <circle cx="45" cy="24" r="1.1" fill="#111827" />
      <circle cx="55" cy="24" r="1.1" fill="#111827" />
      <path d="M49 25L47 30H52Z" fill="#c2410c" opacity="0.75" />
      <path d="M45 32C48 34 52 34 55 32" fill="none" stroke="#7f1d1d" strokeWidth="1" strokeLinecap="round" />
      <path d="M50 37L43 49H57Z" fill="#f8fafc" stroke="#111827" strokeWidth="0.8" opacity="0.9" />
      {courtRank === 'K' && (
        <>
          <path d="M72 22L77 18L76 61L71 64Z" fill="#f8fafc" stroke="#111827" strokeWidth="1" />
          <path d="M68 22H80" stroke={court.accentTwo} strokeWidth="2" strokeLinecap="round" />
        </>
      )}
      {courtRank === 'Q' && (
        <path d="M72 24C80 29 78 39 70 41C64 36 65 28 72 24Z" fill="#ef4444" stroke="#166534" strokeWidth="1" />
      )}
      {courtRank === 'J' && (
        <path d="M28 20L23 24L30 62L35 58Z" fill="#111827" stroke={court.accentTwo} strokeWidth="1" />
      )}
      <circle cx="34" cy="53" r="2" fill={court.accentTwo} opacity={detailOpacity} />
      <circle cx="66" cy="53" r="2" fill={court.accent} opacity={detailOpacity} />
    </g>
  );

  return (
    <div style={{
      position: 'relative',
      flex: 1,
      minHeight: 0,
      width: '100%',
      overflow: 'hidden',
      border: compact ? 'none' : '1px solid rgba(14,165,233,0.65)',
      background: compact ? 'transparent' : 'linear-gradient(180deg,rgba(248,250,252,0.3),rgba(255,255,255,0.05))',
    }}>
      <svg viewBox="0 0 100 140" preserveAspectRatio="none" aria-label={`${faceLabel} court art`} style={{ width: '100%', height: '100%', display: 'block' }}>
        <rect x="6" y="4" width="88" height="132" rx="3" fill="rgba(255,255,255,0.45)" stroke={court.trim} strokeWidth={compact ? 0.7 : 1.2} opacity={compact ? 0.55 : 1} />
        <path d="M12 70H88" stroke={court.trim} strokeWidth="1.2" opacity="0.42" />
        <path d="M18 6L82 134" stroke={court.accentTwo} strokeWidth="2" opacity="0.45" />
        <CourtHalf />
        <CourtHalf flipped />
      </svg>
      <SuitMark suit={suit} size={suitSize} color={color} style={{ position: 'absolute', left: compact ? '16%' : '13%', top: compact ? '35%' : '31%' }} />
      <SuitMark suit={suit} size={suitSize} color={color} style={{ position: 'absolute', right: compact ? '16%' : '13%', bottom: compact ? '35%' : '31%', transform: 'rotate(180deg)' }} />
    </div>
  );
};

export const ClassicPips: FC<{ suit: Suit; rank: Rank; compact?: boolean; symbolScale?: number }> = ({ suit, rank, compact = false, symbolScale = 1 }) => {
  const color = isRed(suit) ? '#d40000' : '#111';
  const isFace = ['J', 'Q', 'K'].includes(rank);

  if (isFace) {
    return (
      <CourtArt suit={suit} rank={rank} compact={compact} symbolScale={symbolScale} />
    );
  }

  const pips = PIP_POSITIONS[rank] || [];
  const basePipSize = rank === 'A' ? (compact ? 8 : 18) : compact ? 5.5 : rank === '10' || rank === '9' ? 8 : 9;
  const pipSize = Math.max(4, basePipSize * symbolScale);

  return (
    <div style={{ position: 'relative', flex: 1, minHeight: 0, width: '100%' }}>
      {pips.map((pip, index) => (
        <SuitMark
          key={index}
          suit={suit}
          size={pipSize}
          color={color}
          style={{
            position: 'absolute',
            left: `${pip.x}%`,
            top: `${pip.y}%`,
            transform: `translate(-50%, -50%)${pip.rotate ? ' rotate(180deg)' : ''}`,
          }}
        />
      ))}
    </div>
  );
};

export const PlayingCard: FC<PlayingCardProps> = ({
  card,
  faceDown = false,
  small = false,
  dealIndex = 0,
  isNew = false,
  symbolScale = 0.82,
}) => {
  const w = small ? 52 : 80;
  const h = small ? 74 : 112;
  const rankSize = small ? '0.6rem' : '0.85rem';

  const animStyle: React.CSSProperties = isNew
    ? {
        animation: `dealIn 0.4s ease-out ${dealIndex * 0.08}s both`,
      }
    : {};

  if (faceDown) {
    return (
      <div
        style={{
          width: w,
          height: h,
          borderRadius: 8,
          background: 'linear-gradient(135deg, #1a237e 0%, #283593 40%, #1a237e 100%)',
          border: '2px solid #fff',
          boxShadow: '0 3px 10px rgba(0,0,0,0.5), inset 0 0 0 3px rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          ...animStyle,
        }}
      >
        {/* Card back pattern */}
        <div style={{
          width: w - 12,
          height: h - 12,
          borderRadius: 5,
          border: '1.5px solid rgba(255,255,255,0.25)',
          background: `repeating-linear-gradient(
            45deg,
            rgba(255,255,255,0.04) 0px,
            rgba(255,255,255,0.04) 2px,
            transparent 2px,
            transparent 8px
          )`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <span style={{ fontSize: small ? '1rem' : '1.4rem', opacity: 0.5 }}>🂠</span>
        </div>
      </div>
    );
  }

  if (!card) return null;

  const red = isRed(card.suit);
  const textColor = red ? '#d40000' : '#111111';

  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: 8,
        background: '#fff',
        border: '1.5px solid #ccc',
        boxShadow: '0 4px 14px rgba(0,0,0,0.35), 0 1px 3px rgba(0,0,0,0.2)',
        display: 'flex',
        flexDirection: 'column',
        padding: '3px 4px',
        flexShrink: 0,
        position: 'relative',
        userSelect: 'none',
        ...animStyle,
      }}
    >
      {/* Top-left rank + suit */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.1 }}>
        <span style={{ fontSize: rankSize, fontWeight: 900, color: textColor, fontFamily: 'Arial Black, Arial, sans-serif' }}>
          {card.rank}
        </span>
        <SuitMark suit={card.suit} size={(small ? 7 : 9) * symbolScale} color={textColor} />
      </div>

      {/* Center pips / face */}
      <ClassicPips suit={card.suit} rank={card.rank} compact={small} symbolScale={symbolScale} />

      {/* Bottom-right rank + suit (rotated) */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        lineHeight: 1.1,
        transform: 'rotate(180deg)',
      }}>
        <span style={{ fontSize: rankSize, fontWeight: 900, color: textColor, fontFamily: 'Arial Black, Arial, sans-serif' }}>
          {card.rank}
        </span>
        <SuitMark suit={card.suit} size={(small ? 7 : 9) * symbolScale} color={textColor} />
      </div>
    </div>
  );
};
