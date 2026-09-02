import type { Metadata } from 'next';
import Link from 'next/link';
import { AboutUs } from '@/components/landing/AboutUs';
import { Footer } from '@/components/landing/Footer';

export const metadata: Metadata = {
  title: 'About Us — dMessage',
  description:
    'Learn about dMessage: who we are, why we built a decentralised end-to-end encrypted messaging platform on Stellar Soroban, and what we stand for.',
  keywords: [
    'about dMessage',
    'decentralized messaging',
    'privacy',
    'end-to-end encryption',
    'Stellar blockchain',
    'open source',
    'web3 messaging',
  ],
  openGraph: {
    title: 'About Us — dMessage',
    description:
      'dMessage is a decentralised, end-to-end encrypted messaging platform built on Stellar Soroban. Escape the surveillance. Own your conversations.',
    type: 'website',
  },
};

export default function AboutPage() {
  return (
    <main id="main-content" className="flex flex-col">
      {/* ── Minimal top nav ── */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b-2 border-[var(--border-strong)] bg-[var(--bg)]/90 px-6 py-3 backdrop-blur-md">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="h-5 w-5 bg-[var(--accent)]" />
          <span className="font-mono text-base font-black tracking-tight text-[var(--text)]">
            dMessage
          </span>
        </Link>
        <nav className="flex items-center gap-5" aria-label="Site navigation">
          <Link
            href="/about"
            className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--accent)]"
            aria-current="page"
          >
            About
          </Link>
          <Link
            href="/contact"
            className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--text-muted)] transition-colors hover:text-[var(--accent)]"
          >
            Contact
          </Link>
          <Link
            href="/dashboard"
            className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--text-muted)] transition-colors hover:text-[var(--accent)]"
          >
            App
          </Link>
        </nav>
      </header>

      {/* ── Main content ── */}
      <AboutUs />

      <Footer />
    </main>
  );
}
