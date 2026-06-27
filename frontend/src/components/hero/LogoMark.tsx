'use client';

import dynamic from 'next/dynamic';
import { Logo } from '@/remotion/Logo';

// Player touches the DOM/window, so load it client-side only.
const Player = dynamic(
  () => import('@remotion/player').then((m) => m.Player),
  { ssr: false },
);

/**
 * Embeds the Remotion `Logo` composition as an autoplaying, looping
 * animated brand mark. Pure presentation — no controls.
 */
export function LogoMark({ size = 132 }: { size?: number }) {
  return (
    <Player
      component={Logo}
      durationInFrames={120}
      fps={30}
      compositionWidth={512}
      compositionHeight={512}
      loop
      autoPlay
      controls={false}
      doubleClickToFullscreen={false}
      clickToPlay={false}
      style={{ width: size, height: size }}
    />
  );
}
