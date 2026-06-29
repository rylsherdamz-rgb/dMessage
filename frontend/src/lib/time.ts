const MINUTE = 60;
const HOUR = 3600;
const DAY = 86400;

export function relativeTime(ts: number): string {
  const now = Date.now() / 1000;
  const diff = now - ts;

  if (diff < 10) return 'now';
  if (diff < MINUTE) return `${Math.floor(diff)}s ago`;
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  if (diff < DAY * 7) {
    const days = Math.floor(diff / DAY);
    return days === 1 ? 'Yesterday' : `${days}d ago`;
  }

  const d = new Date(ts * 1000);
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  const day = d.getDate();
  return d.getFullYear() === new Date().getFullYear()
    ? `${month} ${day}`
    : `${month} ${day}, ${d.getFullYear()}`;
}
