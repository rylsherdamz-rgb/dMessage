'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessagesSquare, Archive, Settings } from 'lucide-react';
import { WalletConnector } from '@/components/wallet/WalletConnector';
import { NetworkBadge } from '@/components/ui/NetworkBadge';

const LINKS = [
  { label: 'Chats', href: '/dashboard', Icon: MessagesSquare },
  { label: 'Archive', href: '/archive', Icon: Archive },
  { label: 'Settings', href: '/settings', Icon: Settings },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b-2 border-[var(--border-strong)] bg-[var(--bg)]/90 px-2 py-2.5 backdrop-blur-md sm:gap-4 sm:px-6 sm:py-3 md:px-8">
      {/* Logo */}
      <Link href="/" className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
        <div className="h-4 w-4 bg-[var(--accent)] sm:h-5 sm:w-5" />
        <span className="font-mono text-xs font-black tracking-tight sm:text-base md:text-lg">dMessage</span>
      </Link>

      {/* Right section */}
      <div className="flex items-center gap-1 sm:gap-3 md:gap-4">
        {/* Nav links */}
        <div className="flex items-center">
          {LINKS.map(({ label, href, Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                title={label}
                className={`flex items-center gap-1 rounded-sm border-2 px-1.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] transition-colors sm:gap-2 sm:px-2.5 sm:py-2 sm:text-xs ${
                  active
                    ? 'border-[var(--accent)] text-[var(--accent)]'
                    : 'border-transparent text-[var(--text-muted)] hover:text-[var(--accent)]'
                }`}
              >
                <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
                <span className="hidden md:inline">{label}</span>
              </Link>
            );
          })}
        </div>

        {/* Network badge - hidden on small mobile, shown from sm up */}
        <div className="hidden sm:block">
          <NetworkBadge />
        </div>

        {/* Wallet button */}
        <WalletConnector compact />
      </div>
    </nav>
  );
}
