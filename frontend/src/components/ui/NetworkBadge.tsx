'use client';

export function NetworkBadge() {
  return (
    <span className="flex items-center gap-1.5 rounded-sm border border-[var(--border)] px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--text-muted)]">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
      Testnet
    </span>
  );
}
