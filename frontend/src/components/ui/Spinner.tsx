export function Spinner({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <div className="h-2 w-2 bg-[var(--accent)] animate-pulse" />
      <div className="h-2 w-2 bg-[var(--accent)] animate-pulse [animation-delay:0.2s]" />
      <div className="h-2 w-2 bg-[var(--accent)] animate-pulse [animation-delay:0.4s]" />
    </div>
  );
}
