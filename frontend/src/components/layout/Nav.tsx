'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessagesSquare, Archive, Settings } from 'lucide-react';
import { WalletConnector } from '@/components/wallet/WalletConnector';

const LINKS = [
  { label: 'Chats', href: '/dashboard', Icon: MessagesSquare },
  { label: 'Archive', href: '/archive', Icon: Archive },
  { label: 'Settings', href: '/settings', Icon: Settings },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-30 flex items-center justify-between border-b-2 border-[var(--border-strong)] bg-[var(--bg)]/90 px-3 py-3 backdrop-blur-md sm:px-8 sm:py-4">
      <Link href="/" className="flex items-center gap-2 sm:gap-3">
        <div className="h-4 w-4 bg-[var(--accent)] sm:h-5 sm:w-5" />
        <span className="font-mono text-sm font-black tracking-tight sm:text-lg">dMessage</span>
      </Link>

      <div className="flex items-center gap-1 sm:gap-5">
        <div className="flex items-center gap-1 sm:gap-2">
          {LINKS.map(({ label, href, Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1 rounded-sm border-2 px-2 py-2 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors sm:gap-2 sm:px-3 sm:text-xs ${
                  active
                    ? 'border-[var(--accent)] text-[var(--accent)]'
                    : 'border-transparent text-[var(--text-muted)] hover:text-[var(--accent)]'
                }`}
              >
                <Icon className="h-4 w-4 sm:h-4 sm:w-4" strokeWidth={2} aria-hidden />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </div>
        <WalletConnector />
      </div>
    </nav>
  );
}
