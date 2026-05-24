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
}

const isRed = (suit: Suit) => suit === '♥' || suit === '♦';

// Suit pip layout: how many pips per row for each rank
const PIP_LAYOUTS: Record<Rank, number[][]> = {
  'A':  [[1]],
  '2':  [[1],[1]],
  '3':  [[1],[1],[1]],
  '4':  [[2],[2]],
  '5':  [[2],[1],[2]],
  '6':  [[2],[2],[2]],
  '7':  [[2],[1],[2],[2]],
  '8':  [[2],[2],[2],[2]],
  '9':  [[2],[1],[2],[2],[2]],
  '10': [[2],[2],[1],[2],[2]],
  'J':  [],
  'Q':  [],
  'K':  [],
};

const FACE_SYMBOLS: Record<string, string> = {
  J: 'J',
  Q: 'Q',
  K: 'K',
};

const SuitPips: FC<{ suit: Suit; rank: Rank }> = ({ suit, rank }) => {
  const color = isRed(suit) ? '#d40000' : '#111';
  const isFace = ['J', 'Q', 'K'].includes(rank);

  if (isFace) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span style={{
          fontSize: '2.2rem',
          fontWeight: 900,
          color,
          fontFamily: 'Georgia, serif',
          lineHeight: 1,
          textShadow: isRed(suit) ? '0 1px 2px rgba(180,0,0,0.2)' : '0 1px 2px rgba(0,0,0,0.15)',
        }}>
          {FACE_SYMBOLS[rank]}
        </span>
      </div>
    );
  }

  if (rank === 'A') {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span style={{ fontSize: '2.4rem', color, lineHeight: 1 }}>{suit}</span>
      </div>
    );
  }

  const rows = PIP_LAYOUTS[rank] || [];
  const totalPips = rows.reduce((s, r) => s + r[0], 0);
  const pipSize = totalPips <= 4 ? '1.1rem' : totalPips <= 6 ? '0.95rem' : '0.8rem';

  return (
    <div className="flex-1 flex flex-col justify-around items-center py-1 px-1">
      {rows.map((row, ri) => (
        <div key={ri} className="flex justify-around w-full">
          {Array.from({ length: row[0] }).map((_, ci) => (
            <span key={ci} style={{ fontSize: pipSize, color, lineHeight: 1 }}>{suit}</span>
          ))}
        </div>
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
}) => {
  const w = small ? 52 : 80;
  const h = small ? 74 : 112;
  const rankSize = small ? '0.6rem' : '0.85rem';
  const suitSize = small ? '0.55rem' : '0.75rem';

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
        <span style={{ fontSize: suitSize, color: textColor, lineHeight: 1 }}>{card.suit}</span>
      </div>

      {/* Center pips / face */}
      {!small && <SuitPips suit={card.suit} rank={card.rank} />}
      {small && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: '1rem', color: textColor }}>{card.suit}</span>
        </div>
      )}

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
        <span style={{ fontSize: suitSize, color: textColor, lineHeight: 1 }}>{card.suit}</span>
      </div>
    </div>
  );
};
