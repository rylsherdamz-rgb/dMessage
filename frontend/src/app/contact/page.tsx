import type { Metadata } from 'next';
import Link from 'next/link';
import { ContactForm } from '@/components/landing/ContactForm';
import { Footer } from '@/components/landing/Footer';

export const metadata: Metadata = {
  title: 'Contact Us — dMessage',
  description:
    'Get in touch with the dMessage team. Submit a bug report, feature request, partnership enquiry, or general question.',
  keywords: [
    'contact dMessage',
    'dMessage support',
    'decentralized messaging',
    'bug report',
    'feature request',
    'Stellar blockchain',
  ],
  openGraph: {
    title: 'Contact Us — dMessage',
    description:
      'Have a question or feedback? Reach out to the dMessage team. We read every message.',
    type: 'website',
  },
};

export default function ContactPage() {
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
            className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--text-muted)] transition-colors hover:text-[var(--accent)]"
          >
            About
          </Link>
          <Link
            href="/contact"
            className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--accent)]"
            aria-current="page"
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
      <ContactForm />

      {/* ── FAQ strip ── */}
      <section className="relative mx-auto w-full max-w-6xl px-6 py-20">
        <h2 className="font-mono text-sm font-black uppercase tracking-[0.25em] text-[var(--text-faint)]">
          Frequently asked questions
        </h2>
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              q: 'How long does a reply take?',
              a: 'We aim to respond within 48 hours on business days. High-volume periods may take a little longer.',
            },
            {
              q: 'Where should I report security vulnerabilities?',
              a: 'Please do not report security issues publicly. Follow our responsible-disclosure policy on GitHub and email the maintainers directly.',
            },
            {
              q: 'Can I contribute to dMessage?',
              a: 'Absolutely. Fork the repo on GitHub, open a pull request, and follow the contributing guidelines in the README.',
            },
            {
              q: 'Is dMessage available on mobile?',
              a: 'A React Native mobile app is on the roadmap. For now, the web app is fully responsive and works on mobile browsers.',
            },
            {
              q: 'Can I use dMessage on mainnet?',
              a: 'Yes — the gasless contracts are deployed on Stellar Mainnet. Connect Freighter set to mainnet to use them.',
            },
            {
              q: 'Where are my messages stored?',
              a: 'Encrypted message content is stored on IPFS; only cryptographic hashes and inbox metadata touch the Soroban blockchain. Nothing is on our servers — there are none.',
            },
          ].map((faq, i) => (
            <div
              key={i}
              className="brutal bg-[var(--bg-surface)] p-6"
            >
              <h3 className="font-mono text-sm font-black tracking-tight text-[var(--text)]">
                {faq.q}
              </h3>
              <p className="mt-3 font-mono text-xs leading-relaxed text-[var(--text-muted)]">
                {faq.a}
              </p>
            </div>
          ))}
        </div>
      </section>

      <Footer />
    </main>
  );
}
