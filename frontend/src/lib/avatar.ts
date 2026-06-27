/**
 * Deterministic generative avatar sprites.
 *
 * Given a stable seed (a Stellar address), produces a symmetric 5x5 pixel
 * sprite + an accent color. Same seed always yields the same sprite, so every
 * peer gets a consistent "default randomised" avatar with no image hosting.
 */

const PALETTE = ['#00ff88', '#22d3ee', '#8b5cf6', '#ffb020', '#ff3355', '#34d399'];

/** FNV-1a 32-bit hash → unsigned int. */
function hashSeed(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export interface SpriteData {
  /** 25 booleans (row-major, 5x5) — true = filled cell. */
  cells: boolean[];
  color: string;
  /** Single uppercase initial-style glyph fallback. */
  glyph: string;
}

export function generateSprite(seed: string): SpriteData {
  const h = hashSeed(seed || 'anon');
  const color = PALETTE[h % PALETTE.length];

  // Build a 5x5 grid mirrored across the vertical axis (cols 0..2 -> 3..4).
  const cells = new Array<boolean>(25).fill(false);
  // Use 32 bits of entropy; mix in a second hash for the bottom rows.
  const h2 = hashSeed(`${seed}:salt`);
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 3; x++) {
      const bitIndex = y * 3 + x;
      const source = bitIndex < 16 ? h : h2;
      const filled = ((source >> (bitIndex % 16)) & 1) === 1;
      const i = y * 5 + x;
      const mirror = y * 5 + (4 - x);
      cells[i] = filled;
      cells[mirror] = filled;
    }
  }

  const glyph = (seed.replace(/[^a-zA-Z0-9]/g, '')[1] ?? 'x').toUpperCase();
  return { cells, color, glyph };
}
