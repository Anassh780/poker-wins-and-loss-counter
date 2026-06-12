interface StreakBadgeProps {
  value?: number;
  earnedAt?: number;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

const sizeClasses = {
  xs: 'gap-1 px-1.5 py-0.5 text-[9px]',
  sm: 'gap-1.5 px-2 py-1 text-[10px]',
  md: 'gap-2 px-3 py-1.5 text-xs',
  lg: 'gap-2 px-4 py-2 text-sm',
};

const iconClasses = {
  xs: 'text-[10px]',
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
};

export const StreakBadge = ({
  value = 0,
  earnedAt,
  size = 'sm',
  showLabel = false,
  className = '',
}: StreakBadgeProps) => {
  const streak = Math.max(0, Number(value) || 0);
  if (!earnedAt || streak < 3) return null;

  return (
    <span
      className={`inline-flex items-center justify-center rounded-xl border font-cyber font-black leading-none ${
        sizeClasses[size]
      } border-orange-400/55 bg-orange-500/10 text-amber-100 shadow-[0_0_14px_rgba(249,115,22,0.22)] ${className}`}
      title={`${streak} win streak`}
    >
      <span className={`${iconClasses[size]} drop-shadow-[0_0_8px_rgba(251,146,60,0.65)]`} aria-hidden="true">
        &#128293;
      </span>
      <span>{streak}</span>
      {showLabel && <span className="text-[0.72em] uppercase tracking-[0.14em] opacity-75">Streak</span>}
    </span>
  );
};
