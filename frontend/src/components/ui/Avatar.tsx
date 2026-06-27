import { generateSprite } from '@/lib/avatar';

interface AvatarProps {
  /** Seed string — typically a Stellar address. */
  seed: string;
  size?: number;
  /** Show an online status dot. */
  online?: boolean;
  className?: string;
}

/**
 * Neobrutalist pixel-sprite avatar generated deterministically from `seed`.
 * Renders a 5x5 symmetric sprite on a dark inset with a hard border.
 */
export function Avatar({ seed, size = 40, online, className = '' }: AvatarProps) {
  const { cells, color } = generateSprite(seed);

  return (
    <span
      className={`relative inline-block shrink-0 border-2 border-[var(--border-strong)] bg-[var(--bg-inset)] ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 5 5"
        width="100%"
        height="100%"
        shapeRendering="crispEdges"
        aria-hidden
      >
        {cells.map((filled, i) =>
          filled ? (
            <rect key={i} x={i % 5} y={Math.floor(i / 5)} width={1} height={1} fill={color} />
          ) : null,
        )}
      </svg>
      {online && (
        <span
          className="absolute -bottom-1 -right-1 h-3 w-3 border-2 border-[var(--bg)]"
          style={{ background: 'var(--accent)' }}
        />
      )}
    </span>
  );
}
