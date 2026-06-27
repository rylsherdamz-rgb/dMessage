import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

/**
 * dMessage animated logo mascot — rendered with Remotion.
 *
 * A neobrutalist "message panel" mark: a sharp-cornered chat bubble with a
 * blinking terminal caret, a Stellar node orbiting around it, and a spring
 * entrance. Designed to loop seamlessly at 120 frames / 30fps.
 *
 * Composition canvas: 512 x 512 (transparent background).
 */
export const Logo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Spring entrance (scale + slight rotate settle).
  const enter = spring({ frame, fps, config: { damping: 14, mass: 0.8 } });
  const scale = interpolate(enter, [0, 1], [0.55, 1]);
  const settleRot = interpolate(enter, [0, 1], [-8, 0]);

  // Gentle continuous bob.
  const bob = Math.sin(frame / 18) * 8;

  // Orbiting Stellar node (one revolution every 2s).
  const angle = (frame / fps) * Math.PI; // 0.5 rev/sec
  const orbitR = 168;
  const nodeX = Math.cos(angle) * orbitR;
  const nodeY = Math.sin(angle) * orbitR * 0.62; // elliptical orbit
  const nodeBehind = Math.sin(angle) < 0; // dim when behind the panel

  // Blinking caret.
  const caretOn = Math.floor(frame / 14) % 2 === 0;

  const ACCENT = '#00ff88';
  const BORDER = '#666b78';
  const PANEL = '#101216';

  return (
    <AbsoluteFill
      style={{
        backgroundColor: 'transparent',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: 512,
          height: 512,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {/* Orbit node BEHIND the panel */}
        {nodeBehind && (
          <OrbitNode x={nodeX} y={nodeY} accent={ACCENT} dim />
        )}

        {/* The message panel mark */}
        <div
          style={{
            position: 'relative',
            transform: `translateY(${bob}px) scale(${scale}) rotate(${settleRot}deg)`,
          }}
        >
          {/* brutalist offset shadow */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              transform: 'translate(18px, 18px)',
              backgroundColor: ACCENT,
            }}
          />
          {/* panel */}
          <div
            style={{
              position: 'relative',
              width: 240,
              height: 200,
              backgroundColor: PANEL,
              border: `8px solid ${ACCENT}`,
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
              padding: '38px 30px',
              boxSizing: 'border-box',
            }}
          >
            {/* chat lines */}
            <div style={{ height: 16, width: '78%', backgroundColor: BORDER }} />
            <div style={{ height: 16, width: '56%', backgroundColor: BORDER }} />
            {/* caret row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ height: 16, width: '34%', backgroundColor: ACCENT }} />
              <div
                style={{
                  height: 22,
                  width: 14,
                  backgroundColor: ACCENT,
                  opacity: caretOn ? 1 : 0,
                }}
              />
            </div>
          </div>
          {/* bubble tail */}
          <div
            style={{
              position: 'absolute',
              bottom: -22,
              left: 36,
              width: 0,
              height: 0,
              borderLeft: '0 solid transparent',
              borderTop: `30px solid ${ACCENT}`,
              borderRight: '34px solid transparent',
            }}
          />
        </div>

        {/* Orbit node IN FRONT of the panel */}
        {!nodeBehind && <OrbitNode x={nodeX} y={nodeY} accent={ACCENT} />}
      </div>
    </AbsoluteFill>
  );
};

const OrbitNode: React.FC<{ x: number; y: number; accent: string; dim?: boolean }> = ({
  x,
  y,
  accent,
  dim,
}) => (
  <div
    style={{
      position: 'absolute',
      left: '50%',
      top: '50%',
      transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
      width: dim ? 18 : 26,
      height: dim ? 18 : 26,
      borderRadius: '50%',
      backgroundColor: accent,
      opacity: dim ? 0.4 : 1,
      boxShadow: dim ? 'none' : `0 0 22px 4px ${accent}`,
    }}
  />
);
