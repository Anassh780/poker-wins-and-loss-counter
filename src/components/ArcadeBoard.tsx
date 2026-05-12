import React, { useState, useMemo, useRef } from 'react';
import type { Player } from '../types';

interface ArcadeBoardProps {
  players: Player[];
  currentUserId?: string;
}

const ZONES = ['jungle', 'lava', 'ice', 'ruins', 'mystic'] as const;
type Zone = typeof ZONES[number];
const ZONE_RANGES = [[1, 20], [21, 40], [41, 60], [61, 80], [81, 100]];

const SPECIAL_TILES: Record<number, { type: string, icon: string, label: string }> = {
  1:{type:'start',icon:'🏁',label:'START - Begin your adventure!'},
  5:{type:'snake',icon:'🐍',label:'Snake! Slide down to tile 2'},
  8:{type:'boost',icon:'⚡',label:'Lightning boost! Jump to tile 14'},
  12:{type:'gem',icon:'💎',label:'Gem found! +50 coins'},
  17:{type:'bomb',icon:'💣',label:'Bomb! Lose a turn'},
  21:{type:'portal',icon:'🌀',label:'Portal! Warp to tile 36'},
  25:{type:'shield',icon:'🛡️',label:'Shield gained! Protected for 2 turns'},
  28:{type:'snake',icon:'🐍',label:'Dragon! Slide back to tile 15'},
  32:{type:'treasure',icon:'💐',label:'Treasure chest! +200 coins'},
  35:{type:'mystery',icon:'❓',label:'Mystery box! Unknown reward awaits...'},
  39:{type:'bomb',icon:'💣',label:'Volcano trap! Go back 5 tiles'},
  41:{type:'boost',icon:'🚀',label:'Rocket boost! Jump to tile 52'},
  44:{type:'gem',icon:'💎',label:'Crystal gem! +75 coins'},
  47:{type:'snake',icon:'🐁',label:'Ice serpent! Frozen, skip 2 turns'},
  50:{type:'portal',icon:'🌀',label:'Midpoint portal! Warp to tile 58'},
  55:{type:'shield',icon:'🛡️',label:'Ice shield! Protected next 3 turns'},
  58:{type:'mystery',icon:'❓',label:'Ancient mystery box!'},
  62:{type:'boost',icon:'⚡',label:'Ancient power! Jump to tile 70'},
  65:{type:'treasure',icon:'💐',label:'Ancient gold! +300 coins'},
  68:{type:'snake',icon:'🐍',label:'Ancient serpent! Back to tile 55'},
  71:{type:'bomb',icon:'💣',label:'Mystic bomb! Lose 2 turns'},
  74:{type:'gem',icon:'💎',label:'Mystic gem! +100 coins'},
  77:{type:'portal',icon:'🌀',label:'Mystic vortex! Jump to tile 85'},
  80:{type:'shield',icon:'🛡️',label:'Mystic shield! Ultimate protection'},
  83:{type:'mystery',icon:'❓',label:'Final mystery! Dare to open?'},
  87:{type:'snake',icon:'🐍',label:'Final dragon! Banished to tile 73'},
  90:{type:'boost',icon:'🚀',label:'Final boost! Jump to tile 96'},
  93:{type:'bomb',icon:'💣',label:'DANGER ZONE! Go back to tile 80'},
  97:{type:'gem',icon:'💎',label:'Legend gem! +500 coins'},
  99:{type:'shield',icon:'🛡️',label:'Final shield! So close to glory!'},
  100:{type:'finish',icon:'💎',label:'LEGENDARY TREASURE! You win the adventure!'}
};

function getZone(n: number): Zone {
  for (let i = 0; i < ZONE_RANGES.length; i++) {
    if (n >= ZONE_RANGES[i][0] && n <= ZONE_RANGES[i][1]) return ZONES[i];
  }
  return 'jungle';
}

function getBoardPos(wins: number): number {
  if (wins <= 0) return 1;
  const pos = ((wins - 1) % 100) + 1;
  return pos;
}

const boardStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Cinzel+Decorative:wght@700&display=swap');
  
  .adventure-board-root {
    --wood-dark:#3d1f0a;--wood-mid:#6b3a1f;--wood-light:#8b5a2b;--wood-grain:#7a4520;
    --gold:#d4a843;--gold-light:#f0c860;--gold-dark:#a07820;
    --tile-base:#c8a96e;--tile-dark:#9a7840;--tile-light:#e8d09a;
    --jungle:#1a5c2a;--lava:#8b1a0a;--ice:#0a3060;--ruins:#6b4a0a;--mystic:#3a0a6b;
    --jungle-light:#2d9c4a;--lava-light:#d44020;--ice-light:#2060b0;--ruins-light:#b07820;--mystic-light:#7030b0;
    --glow-green:rgba(50,200,80,0.7);--glow-red:rgba(220,60,20,0.8);--glow-blue:rgba(40,120,220,0.7);
    --glow-gold:rgba(212,168,67,0.8);--glow-purple:rgba(140,50,220,0.7);
    
    font-family:'Cinzel',serif;
    color: #fff;
    width: 100%;
    height: 100%;
  }

  .game-wrapper {
    min-height: 100%; width: 100%;
    background: radial-gradient(ellipse at center, #1a0d05 0%, #0a0603 60%, #060402 100%);
    display: flex; flex-direction: column; align-items: center; justify-content: flex-start;
    padding: 12px 8px; position: relative; overflow-x: hidden; overflow-y: auto;
  }
  .bg-ambient { position: absolute; inset: 0; pointer-events: none; z-index: 0; overflow: hidden; }
  .bg-ambient::before {
    content:''; position: absolute; top: -20%; left: -10%; width: 50%; height: 60%;
    background: radial-gradient(ellipse, rgba(180,100,20,0.08) 0%, transparent 70%);
    animation: ambientPulse 6s ease-in-out infinite;
  }
  .bg-ambient::after {
    content:''; position: absolute; bottom: -20%; right: -10%; width: 60%; height: 70%;
    background: radial-gradient(ellipse, rgba(80,20,150,0.06) 0%, transparent 70%);
    animation: ambientPulse 8s ease-in-out infinite reverse;
  }
  @keyframes ambientPulse { 0%, 100% { opacity: 0.5 } 50% { opacity: 1 } }
  
  .game-header { position: relative; z-index: 10; text-align: center; margin-bottom: 15px; width: 100%; }
  .title-ornament { display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 2px; }
  .ornament-line { flex: 1; max-width: 80px; height: 1px; background: linear-gradient(90deg, transparent, var(--gold), transparent); }
  .diamond { width: 6px; height: 6px; background: var(--gold); transform: rotate(45deg); flex-shrink: 0; }
  .game-title {
    font-family: 'Cinzel Decorative', cursive; font-size: clamp(24px, 5vw, 42px); font-weight: 700;
    color: var(--gold-light); letter-spacing: 3px; text-transform: uppercase;
    text-shadow: 0 0 20px rgba(212,168,67,0.6), 0 0 40px rgba(212,168,67,0.3), 0 2px 4px rgba(0,0,0,0.8);
    line-height: 1.1;
  }
  .game-subtitle {
    font-size: clamp(10px, 1.8vw, 14px); color: rgba(212,168,67,0.7); letter-spacing: 2px;
    text-transform: uppercase; margin-top: 3px;
  }
  
  .zone-filters {
    display: flex; flex-wrap: wrap; gap: 8px; justify-content: center;
    margin-bottom: 15px; position: relative; z-index: 10;
  }
  .zone-btn {
    padding: 6px 14px; border-radius: 20px; border: 1px solid; font-family: 'Cinzel', serif;
    font-size: 11px; font-weight: 600; letter-spacing: 1px; cursor: pointer; transition: all 0.3s;
    text-transform: uppercase;
  }
  .zone-btn.active { filter: brightness(1.5); box-shadow: 0 0 15px rgba(255,255,255,0.2); }
  .zone-btn.all { background: rgba(80,80,80,0.4); border-color: #aaa; color: #fff; }
  .zone-btn.jungle { background: rgba(26,92,42,0.4); border-color: var(--jungle-light); color: #5dde80; }
  .zone-btn.lava { background: rgba(139,26,10,0.4); border-color: var(--lava-light); color: #ff7040; }
  .zone-btn.ice { background: rgba(10,48,96,0.4); border-color: var(--ice-light); color: #60b0ff; }
  .zone-btn.ruins { background: rgba(107,74,10,0.4); border-color: var(--ruins-light); color: #f0c060; }
  .zone-btn.mystic { background: rgba(58,10,107,0.4); border-color: var(--mystic-light); color: #c060ff; }
  .zone-btn:hover { transform: translateY(-2px); filter: brightness(1.3); box-shadow: 0 4px 12px rgba(255,255,255,0.1); }
  
  .board-outer {
    position: relative; z-index: 10; width: 100%; max-width: 760px;
    display: flex; justify-content: center;
  }
  .board-frame {
    position: relative; width: 100%;
    background:
      repeating-linear-gradient(90deg, transparent, transparent 3px, rgba(0,0,0,0.05) 3px, rgba(0,0,0,0.05) 4px),
      repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.05) 3px, rgba(0,0,0,0.05) 4px),
      linear-gradient(135deg, #5c2e0a 0%, #8b4a1a 20%, #6b3510 40%, #9b5520 60%, #7a4018 80%, #5a2a08 100%);
    border-radius: 12px; padding: 16px;
    box-shadow:
      0 0 0 2px #2a1005, 0 0 0 4px var(--gold-dark), 0 0 0 6px #2a1005,
      inset 0 0 30px rgba(0,0,0,0.5), 0 20px 60px rgba(0,0,0,0.8), 0 0 80px rgba(180,100,20,0.15);
  }
  .frame-corner {
    position: absolute; width: 32px; height: 32px;
    background: radial-gradient(circle, var(--gold) 30%, var(--gold-dark) 70%);
    border-radius: 50%; border: 2px solid var(--gold-dark);
    box-shadow: 0 0 8px var(--glow-gold), 0 0 15px rgba(212,168,67,0.4);
    z-index: 5; display: flex; align-items: center; justify-content: center; font-size: 12px;
  }
  .frame-corner.tl { top: -6px; left: -6px; }
  .frame-corner.tr { top: -6px; right: -6px; }
  .frame-corner.bl { bottom: -6px; left: -6px; }
  .frame-corner.br { bottom: -6px; right: -6px; }
  
  .board-inlay {
    width: 100%; height: 100%;
    background: linear-gradient(135deg, rgba(255,200,100,0.08) 0%, transparent 50%, rgba(0,0,0,0.2) 100%);
    border-radius: 6px; border: 1px solid rgba(212,168,67,0.3);
    padding: 8px; position: relative; overflow: hidden;
  }
  
  .board-grid {
    display: grid; grid-template-columns: repeat(10, 1fr);
    gap: 3px; position: relative; z-index: 1; width: 100%; aspect-ratio: 1;
  }
  
  .tile {
    aspect-ratio: 1; border-radius: 6px; position: relative; cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s, opacity 0.3s, filter 0.3s; overflow: hidden;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    border: 1px solid rgba(0,0,0,0.3);
  }
  .tile:hover { transform: scale(1.08) translateY(-2px); z-index: 20; filter: brightness(1.2); }
  .tile-num {
    font-family: 'Cinzel', serif; font-weight: 700; position: absolute;
    font-size: clamp(6px, 1.1vw, 12px);
    top: 4px; left: 4px; line-height: 1; opacity: 0.9;
    text-shadow: 0 1px 2px rgba(0,0,0,0.8); z-index: 3;
  }
  .tile-icon { font-size: clamp(14px, 2.5vw, 24px); z-index: 3; line-height: 1; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.6)); }
  
  /* Tile Zones */
  .tile.jungle { background: linear-gradient(135deg, #1a4a20 0%, #2d7a3a 40%, #1f5c28 100%); box-shadow: inset 0 -2px 4px rgba(0,0,0,0.4), inset 0 1px 1px rgba(100,200,80,0.15); }
  .tile.jungle .tile-num { color: #80e060; }
  .tile.lava { background: linear-gradient(135deg, #4a0a00 0%, #8b2000 40%, #c04010 60%, #7a1800 100%); box-shadow: inset 0 -2px 4px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,100,20,0.2); animation: lavaFlicker 3s ease-in-out infinite; }
  @keyframes lavaFlicker { 0%, 100% { filter: brightness(1); } 50% { filter: brightness(1.15); } }
  .tile.lava .tile-num { color: #ff8050; }
  .tile.ice { background: linear-gradient(135deg, #0a2040 0%, #1040a0 40%, #2060c0 60%, #0a3060 100%); box-shadow: inset 0 -2px 4px rgba(0,0,0,0.4), inset 0 1px 1px rgba(100,160,255,0.3); }
  .tile.ice .tile-num { color: #80c0ff; }
  .tile.ruins { background: linear-gradient(135deg, #3a2000 0%, #6b4010 40%, #8b5820 60%, #5a3810 100%); box-shadow: inset 0 -2px 4px rgba(0,0,0,0.4), inset 0 1px 1px rgba(200,150,40,0.2); }
  .tile.ruins .tile-num { color: #d4a843; }
  .tile.mystic { background: linear-gradient(135deg, #1a0030 0%, #4a10a0 40%, #6020c0 60%, #300060 100%); box-shadow: inset 0 -2px 4px rgba(0,0,0,0.5), inset 0 1px 1px rgba(180,80,255,0.2); animation: mysticPulse 4s ease-in-out infinite; }
  @keyframes mysticPulse { 0%, 100% { box-shadow: inset 0 -2px 4px rgba(0,0,0,0.5); } 50% { box-shadow: inset 0 -2px 4px rgba(0,0,0,0.5), 0 0 12px rgba(140,50,220,0.5); } }
  .tile.mystic .tile-num { color: #c060ff; }
  
  /* Tile Specials */
  .tile.snake { box-shadow: inset 0 -2px 4px rgba(0,0,0,0.4), 0 0 8px rgba(50,200,50,0.6), 0 0 15px rgba(50,200,50,0.3) !important; }
  .tile.bomb { box-shadow: inset 0 -2px 4px rgba(0,0,0,0.4), 0 0 8px rgba(220,60,20,0.7), 0 0 15px rgba(220,60,20,0.4) !important; }
  .tile.boost { box-shadow: inset 0 -2px 4px rgba(0,0,0,0.4), 0 0 8px rgba(40,180,220,0.7), 0 0 15px rgba(40,180,220,0.4) !important; }
  .tile.shield { box-shadow: inset 0 -2px 4px rgba(0,0,0,0.4), 0 0 8px rgba(100,180,255,0.7), 0 0 15px rgba(100,180,255,0.4) !important; }
  .tile.treasure { box-shadow: inset 0 -2px 4px rgba(0,0,0,0.4), 0 0 10px rgba(212,168,67,0.8), 0 0 20px rgba(212,168,67,0.5) !important; animation: treasurePulse 2s ease-in-out infinite !important; }
  @keyframes treasurePulse { 0%, 100% { box-shadow: 0 0 10px rgba(212,168,67,0.8), 0 0 20px rgba(212,168,67,0.5); } 50% { box-shadow: 0 0 15px rgba(212,168,67,1), 0 0 30px rgba(212,168,67,0.7), 0 0 45px rgba(212,168,67,0.3); } }
  .tile.mystery { box-shadow: inset 0 -2px 4px rgba(0,0,0,0.4), 0 0 8px rgba(140,80,220,0.7) !important; }
  .tile.gem { box-shadow: inset 0 -2px 4px rgba(0,0,0,0.4), 0 0 8px rgba(80,200,255,0.8) !important; }
  .tile.portal { box-shadow: inset 0 -2px 4px rgba(0,0,0,0.4), 0 0 10px rgba(180,40,255,0.8) !important; animation: portalSpin 3s linear infinite !important; }
  @keyframes portalSpin { 0% { filter: hue-rotate(0deg); } 100% { filter: hue-rotate(360deg); } }
  
  .tile.start {
    background: linear-gradient(135deg, #0a4020 0%, #1a8040 50%, #0a5028 100%) !important;
    box-shadow: 0 0 15px rgba(40,220,100,0.8), 0 0 30px rgba(40,220,100,0.4) !important;
  }
  .tile.finish {
    background: linear-gradient(135deg, #4a2000 0%, #a06000 30%, #d4a843 50%, #b07820 70%, #6a3800 100%) !important;
    box-shadow: 0 0 20px var(--glow-gold), 0 0 40px rgba(212,168,67,0.6), 0 0 60px rgba(212,168,67,0.3) !important;
    animation: finishGlow 2s ease-in-out infinite !important; z-index: 5 !important;
  }
  @keyframes finishGlow { 0%, 100% { box-shadow: 0 0 15px var(--glow-gold), 0 0 30px rgba(212,168,67,0.6); } 50% { box-shadow: 0 0 30px rgba(255,200,80,1), 0 0 60px rgba(212,168,67,0.8), 0 0 90px rgba(212,168,67,0.4); } }
  
  /* Bottom Stats */
  .board-bottom { position: relative; z-index: 10; width: 100%; max-width: 760px; margin-top: 15px; display: flex; flex-direction: column; gap: 12px; }
  .progress-section { background: rgba(20,10,0,0.8); border: 1px solid rgba(212,168,67,0.3); border-radius: 8px; padding: 16px; }
  .progress-label { display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: rgba(212,168,67,0.9); letter-spacing: 1px; text-transform: uppercase; margin-bottom: 12px; border-bottom: 1px solid rgba(212,168,67,0.2); padding-bottom: 8px; }
  
  .legend { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; background: rgba(10,5,0,0.7); border: 1px solid rgba(212,168,67,0.2); border-radius: 8px; padding: 10px 16px; }
  .legend-item { display: flex; align-items: center; gap: 6px; font-size: 10px; color: rgba(212,168,67,0.7); letter-spacing: 0.5px; }
  .legend-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  
  .arcade-tooltip {
    position: fixed; background: rgba(10,5,0,0.95); border: 1px solid var(--gold); border-radius: 8px; padding: 10px 16px;
    font-size: 11px; color: var(--gold-light); pointer-events: none; z-index: 100; max-width: 200px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.8), 0 0 10px rgba(212,168,67,0.3);
    pointer-events: none; opacity: 1; transition: transform 0.15s, opacity 0.15s; letter-spacing: 0.5px; line-height: 1.5;
  }
`;

export const ArcadeBoard = ({ players, currentUserId }: ArcadeBoardProps) => {
  const [activeFilter, setActiveFilter] = useState<Zone | 'all'>('all');
  const [hoverBox, setHoverBox] = useState<number | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const rankedPlayers = useMemo(() => {
    return [...players]
      .sort((a, b) => b.wins - a.wins)
      .map(p => ({
        ...p,
        boardPos: getBoardPos(p.wins)
      }));
  }, [players]);

  const playerPositions = useMemo(() => {
    const map = new Map<number, typeof rankedPlayers>();
    for (const p of rankedPlayers) {
      if (!map.has(p.boardPos)) map.set(p.boardPos, []);
      map.get(p.boardPos)!.push(p);
    }
    return map;
  }, [rankedPlayers]);

  const gridCells = useMemo(() => {
    const cells: number[] = [];
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 10; col++) {
        let n;
        const r = 9 - row;
        if (r % 2 === 0) {
          n = r * 10 + (col + 1);
        } else {
          n = r * 10 + (10 - col);
        }
        cells.push(n);
      }
    }
    return cells;
  }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (tooltipRef.current) {
      let x = e.clientX + 15;
      let y = e.clientY - 50;
      if (x + 200 > window.innerWidth) x = e.clientX - 200;
      if (y < 0) y = e.clientY + 15;
      tooltipRef.current.style.left = x + 'px';
      tooltipRef.current.style.top = y + 'px';
    }
  };

  const renderTooltip = () => {
    const sp = hoverBox ? SPECIAL_TILES[hoverBox] : null;
    const zone = hoverBox ? getZone(hoverBox) : 'jungle';
    const zoneName = zone.charAt(0).toUpperCase() + zone.slice(1);

    return (
      <div
        ref={tooltipRef}
        className={`arcade-tooltip ${hoverBox ? 'show' : ''}`}
        style={{ left: 0, top: 0, opacity: hoverBox ? 1 : 0 }}
      >
        {hoverBox && (
          <>
            <div style={{ paddingBottom: '4px', borderBottom: '1px solid rgba(212,168,67,0.3)', marginBottom: '4px' }}>
              <strong style={{ color: '#fff' }}>Tile {hoverBox}</strong> &bull; {zoneName} Zone
            </div>
            {sp ? (
              <div>{sp.label}</div>
            ) : (
              <div style={{ opacity: 0.7 }}>Normal tile path</div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="adventure-board-root" onMouseMove={handleMouseMove}>
      <style dangerouslySetInnerHTML={{ __html: boardStyles }} />
      <div className="game-wrapper custom-scrollbar">
        <div className="bg-ambient"></div>
        
        {/* Header */}
        <div className="game-header">
          <div className="title-ornament">
            <div className="ornament-line"></div>
            <div className="diamond"></div>
            <div className="game-title">Adventure Board</div>
            <div className="diamond"></div>
            <div className="ornament-line"></div>
          </div>
          <div className="game-subtitle">Compete to Advance &bull; Reach 100 to Claim the Treasure</div>
        </div>

        {/* Zone Filters */}
        <div className="zone-filters">
          <button className={`zone-btn all ${activeFilter === 'all' ? 'active' : ''}`} onClick={() => setActiveFilter('all')}>🌐 All</button>
          <button className={`zone-btn jungle ${activeFilter === 'jungle' ? 'active' : ''}`} onClick={() => setActiveFilter('jungle')}>🌿 Jungle</button>
          <button className={`zone-btn lava ${activeFilter === 'lava' ? 'active' : ''}`} onClick={() => setActiveFilter('lava')}>🔥 Lava</button>
          <button className={`zone-btn ice ${activeFilter === 'ice' ? 'active' : ''}`} onClick={() => setActiveFilter('ice')}>❄ Ice</button>
          <button className={`zone-btn ruins ${activeFilter === 'ruins' ? 'active' : ''}`} onClick={() => setActiveFilter('ruins')}>🏛 Ruins</button>
          <button className={`zone-btn mystic ${activeFilter === 'mystic' ? 'active' : ''}`} onClick={() => setActiveFilter('mystic')}>✨ Mystic</button>
        </div>

        {/* Game Board */}
        <div className="board-outer">
          <div className="board-frame">
            <div className="frame-corner tl">◈</div>
            <div className="frame-corner tr">◈</div>
            <div className="frame-corner bl">◈</div>
            <div className="frame-corner br">◈</div>
            <div className="board-inlay">
              <div className="board-grid">
                {gridCells.map((n) => {
                  const sp = SPECIAL_TILES[n];
                  const zone = getZone(n);
                  const isFilteredOut = activeFilter !== 'all' && activeFilter !== zone;
                  const playersHere = playerPositions.get(n) || [];
                  const isStartTile = n === 1;

                  return (
                    <div
                      key={n}
                      onMouseEnter={() => setHoverBox(n)}
                      onMouseLeave={() => setHoverBox(null)}
                      className={`tile ${zone} ${sp?.type || ''}`}
                      style={{
                        opacity: isFilteredOut ? 0.25 : 1,
                        filter: isFilteredOut ? 'saturate(0.2)' : 'none'
                      }}
                    >
                      <span className="tile-num">{n}</span>
                      {sp && <span className="tile-icon">{sp.icon}</span>}
                      
                      {playersHere.length > 0 && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30" style={{ padding: '2px' }}>
                          <div className="flex flex-wrap gap-1 justify-center items-center w-full h-full">
                            {playersHere.slice(0, isStartTile ? 4 : 3).map((p) => (
                              <div
                                key={p.id}
                                className="relative rounded-full border-2 border-[var(--gold)] overflow-hidden shadow-[0_0_10px_rgba(0,0,0,0.8)]"
                                style={{
                                  width: isStartTile ? 'min(24px, 4vw)' : 'min(16px, 2.5vw)',
                                  height: isStartTile ? 'min(24px, 4vw)' : 'min(16px, 2.5vw)',
                                  backgroundColor: '#111'
                                }}
                              >
                                {p.avatar ? (
                                  <img src={p.avatar} alt={p.name} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center font-bold text-white" style={{ fontSize: isStartTile ? '10px' : '7px' }}>
                                    {p.name[0]}
                                  </div>
                                )}
                              </div>
                            ))}
                            {playersHere.length > (isStartTile ? 4 : 3) && (
                              <div
                                className="relative rounded-full border border-[var(--gold)] flex items-center justify-center bg-black/80 shadow-[0_0_10px_rgba(0,0,0,0.8)] text-[var(--gold-light)] font-bold"
                                style={{
                                  width: isStartTile ? 'min(24px, 4vw)' : 'min(16px, 2.5vw)',
                                  height: isStartTile ? 'min(24px, 4vw)' : 'min(16px, 2.5vw)',
                                  fontSize: isStartTile ? '10px' : '8px'
                                }}
                              >
                                +{playersHere.length - (isStartTile ? 4 : 3)}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section - Player Stats */}
        <div className="board-bottom">
          <div className="progress-section">
            <div className="progress-label">
              <span>🏆 Player Progress</span>
            </div>
            {rankedPlayers.length === 0 ? (
              <div className="text-center text-sm text-[var(--gold-dark)] py-4">No players on the board yet. Play matches to advance!</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[250px] overflow-y-auto custom-scrollbar pr-2">
                {rankedPlayers.map(p => {
                  const isCurrent = p.id === currentUserId;
                  const zone = getZone(p.boardPos);
                  return (
                    <div
                      key={p.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                        isCurrent
                          ? 'bg-[var(--gold-dark)]/20 border-[var(--gold)] shadow-[0_0_15px_rgba(212,168,67,0.3)]'
                          : 'bg-black/40 border-[var(--gold)]/20 hover:border-[var(--gold)]/50'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full border-2 border-[var(--gold)] shadow-[0_0_10px_rgba(0,0,0,0.5)] overflow-hidden shrink-0 bg-[#222]">
                        {p.avatar ? (
                          <img src={p.avatar} alt="avatar" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center font-bold text-white text-lg">
                            {p.name[0]}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-bold text-white uppercase tracking-wider truncate flex items-center gap-2">
                          {p.name}
                          {isCurrent && <span className="text-[8px] bg-[var(--gold)] text-black px-1.5 py-0.5 rounded-full font-black">YOU</span>}
                        </div>
                        <div className="text-[10px] text-[var(--gold-light)] capitalize mt-0.5">
                          {zone} Zone
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[14px] font-bold text-[var(--gold-light)]">Tile {p.boardPos}</div>
                        <div className="text-[10px] text-white/50">{p.wins} Wins</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          <div className="legend">
            <div className="legend-item"><div className="legend-dot" style={{ background: '#2d9c4a' }}></div>Jungle</div>
            <div className="legend-item"><div className="legend-dot" style={{ background: '#d44020' }}></div>Lava</div>
            <div className="legend-item"><div className="legend-dot" style={{ background: '#2060b0' }}></div>Ice</div>
            <div className="legend-item"><div className="legend-dot" style={{ background: '#b07820' }}></div>Ruins</div>
            <div className="legend-item"><div className="legend-dot" style={{ background: '#7030b0' }}></div>Mystic</div>
            <div className="legend-item" style={{ marginLeft: '6px' }}><div className="legend-dot" style={{ background: '#50e060', boxShadow: '0 0 4px #50e060' }}></div>Snake/Trap</div>
            <div className="legend-item"><div className="legend-dot" style={{ background: '#ff6030', boxShadow: '0 0 4px #ff6030' }}></div>Bomb</div>
            <div className="legend-item"><div className="legend-dot" style={{ background: '#40c0ff', boxShadow: '0 0 4px #40c0ff' }}></div>Boost</div>
            <div className="legend-item"><div className="legend-dot" style={{ background: '#d4a843', boxShadow: '0 0 4px #d4a843' }}></div>Treasure</div>
            <div className="legend-item"><div className="legend-dot" style={{ background: '#c040ff', boxShadow: '0 0 4px #c040ff' }}></div>Mystic/Portal</div>
          </div>
        </div>

        {renderTooltip()}
      </div>
    </div>
  );
};
