export type BoxType = 'normal' | 'snake' | 'boost' | 'bomb' | 'mystery' | 'shield' | 'coin' | 'checkpoint' | 'treasure' | 'start';
export type Zone = 'jungle' | 'lava' | 'ice' | 'cave' | 'ruins';

export interface SpecialBox {
  type: BoxType;
  effect: number; // positive = forward, negative = backward, 0 = no move effect
  label: string;
  icon: string;
}

export const SPECIAL_BOXES: Record<number, SpecialBox> = {
  1:  { type: 'start', effect: 0, label: 'Adventure Begins', icon: '🏁' },
  // ── Checkpoints ──
  10: { type: 'checkpoint', effect: 0, label: 'Forest Gate', icon: '🏰' },
  25: { type: 'checkpoint', effect: 0, label: 'Lava Bridge', icon: '🌋' },
  50: { type: 'checkpoint', effect: 0, label: 'Frost Peak', icon: '🏔️' },
  75: { type: 'checkpoint', effect: 0, label: 'Shadow Throne', icon: '👑' },
  // ── Snakes (go back) ──
  16: { type: 'snake', effect: -5, label: 'Jungle Viper', icon: '🐍' },
  34: { type: 'snake', effect: -7, label: 'Lava Serpent', icon: '🐉' },
  47: { type: 'snake', effect: -4, label: 'Frost Wyrm', icon: '🐍' },
  62: { type: 'snake', effect: -6, label: 'Shadow Snake', icon: '🐍' },
  88: { type: 'snake', effect: -8, label: 'Ancient Basilisk', icon: '🐲' },
  93: { type: 'snake', effect: -5, label: 'Cursed Cobra', icon: '🐍' },
  // ── Boosts (go forward) ──
  7:  { type: 'boost', effect: 3, label: 'Vine Swing', icon: '🚀' },
  22: { type: 'boost', effect: 4, label: 'Fire Leap', icon: '🔥' },
  38: { type: 'boost', effect: 5, label: 'Rocket Jump', icon: '⚡' },
  54: { type: 'boost', effect: 3, label: 'Ice Slide', icon: '💨' },
  71: { type: 'boost', effect: 4, label: 'Shadow Dash', icon: '🌀' },
  82: { type: 'boost', effect: 6, label: 'Golden Wings', icon: '🦅' },
  // ── Bombs (go back) ──
  13: { type: 'bomb', effect: -3, label: 'TNT Trap', icon: '💣' },
  29: { type: 'bomb', effect: -4, label: 'Magma Bomb', icon: '💥' },
  45: { type: 'bomb', effect: -3, label: 'Frost Mine', icon: '💣' },
  67: { type: 'bomb', effect: -4, label: 'Dark Blast', icon: '💥' },
  84: { type: 'bomb', effect: -3, label: 'Ruin Bomb', icon: '💣' },
  // ── Mystery ──
  5:  { type: 'mystery', effect: 0, label: 'Forest Mystery', icon: '❓' },
  19: { type: 'mystery', effect: 0, label: 'Hidden Chest', icon: '🎁' },
  33: { type: 'mystery', effect: 0, label: 'Lava Riddle', icon: '❓' },
  56: { type: 'mystery', effect: 0, label: 'Ice Crystal', icon: '🔮' },
  73: { type: 'mystery', effect: 0, label: 'Dark Enigma', icon: '❓' },
  91: { type: 'mystery', effect: 0, label: 'Ancient Puzzle', icon: '🎁' },
  // ── Shield ──
  12: { type: 'shield', effect: 0, label: 'Forest Ward', icon: '🛡️' },
  41: { type: 'shield', effect: 0, label: 'Flame Shield', icon: '🛡️' },
  63: { type: 'shield', effect: 0, label: 'Ice Barrier', icon: '🛡️' },
  78: { type: 'shield', effect: 0, label: 'Shadow Cloak', icon: '🛡️' },
  // ── Coins ──
  8:  { type: 'coin', effect: 0, label: 'Gold Pile', icon: '💰' },
  24: { type: 'coin', effect: 0, label: 'Ruby Cache', icon: '💎' },
  37: { type: 'coin', effect: 0, label: 'Gem Stone', icon: '💎' },
  52: { type: 'coin', effect: 0, label: 'Diamond', icon: '💰' },
  69: { type: 'coin', effect: 0, label: 'Crystal Shard', icon: '💎' },
  86: { type: 'coin', effect: 0, label: 'Star Coin', icon: '⭐' },
  95: { type: 'coin', effect: 0, label: 'Royal Jewel', icon: '👑' },
  // ── Treasure ──
  100: { type: 'treasure', effect: 0, label: 'Legendary Treasure', icon: '🏆' },
};

export function getZone(boxNum: number): Zone {
  if (boxNum <= 20) return 'jungle';
  if (boxNum <= 40) return 'lava';
  if (boxNum <= 60) return 'ice';
  if (boxNum <= 80) return 'cave';
  return 'ruins';
}

export const ZONE_COLORS: Record<Zone, { bg: string; border: string; glow: string; text: string }> = {
  jungle: { bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.35)', glow: 'rgba(34,197,94,0.4)', text: '#4ade80' },
  lava:   { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.35)', glow: 'rgba(239,68,68,0.4)', text: '#f87171' },
  ice:    { bg: 'rgba(56,189,248,0.12)', border: 'rgba(56,189,248,0.35)', glow: 'rgba(56,189,248,0.4)', text: '#38bdf8' },
  cave:   { bg: 'rgba(168,85,247,0.12)', border: 'rgba(168,85,247,0.35)', glow: 'rgba(168,85,247,0.4)', text: '#c084fc' },
  ruins:  { bg: 'rgba(250,204,21,0.12)', border: 'rgba(250,204,21,0.35)', glow: 'rgba(250,204,21,0.4)', text: '#fde047' },
};

export const BOX_TYPE_COLORS: Record<BoxType, { bg: string; border: string }> = {
  normal:     { bg: 'transparent', border: 'transparent' },
  start:      { bg: 'rgba(34,197,94,0.25)', border: 'rgba(34,197,94,0.6)' },
  snake:      { bg: 'rgba(239,68,68,0.2)', border: 'rgba(239,68,68,0.5)' },
  boost:      { bg: 'rgba(34,197,94,0.2)', border: 'rgba(34,197,94,0.5)' },
  bomb:       { bg: 'rgba(249,115,22,0.2)', border: 'rgba(249,115,22,0.5)' },
  mystery:    { bg: 'rgba(168,85,247,0.2)', border: 'rgba(168,85,247,0.5)' },
  shield:     { bg: 'rgba(56,189,248,0.2)', border: 'rgba(56,189,248,0.5)' },
  coin:       { bg: 'rgba(250,204,21,0.2)', border: 'rgba(250,204,21,0.5)' },
  checkpoint: { bg: 'rgba(250,204,21,0.25)', border: 'rgba(250,204,21,0.6)' },
  treasure:   { bg: 'rgba(250,204,21,0.3)', border: 'rgba(250,204,21,0.8)' },
};

/** Convert 1-based box number to grid {row, col} for a 10x10 snake-path board. Row 0 = top. */
export function getGridPosition(boxNum: number): { row: number; col: number } {
  const idx = boxNum - 1;
  const rowFromBottom = Math.floor(idx / 10);
  const col = rowFromBottom % 2 === 0 ? idx % 10 : 9 - (idx % 10);
  return { row: 9 - rowFromBottom, col };
}
