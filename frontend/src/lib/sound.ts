let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

export function playNotification() {
  try {
    const c = getCtx();
    const o = c.createOscillator();
    const g = c.createGain();
    o.connect(g);
    g.connect(c.destination);
    o.type = 'sine';
    o.frequency.setValueAtTime(660, c.currentTime);
    o.frequency.setValueAtTime(880, c.currentTime + 0.08);
    g.gain.setValueAtTime(0.15, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.2);
    o.start(c.currentTime);
    o.stop(c.currentTime + 0.2);
  } catch {
    // audio not available
  }
}
