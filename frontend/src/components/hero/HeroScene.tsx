'use client';

import { Canvas } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { StellarMascot } from '@/components/hero/StellarMascot';
import { LogoMark } from '@/components/hero/LogoMark';
import { WalletConnector } from '@/components/wallet/WalletConnector';

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'How', href: '#how' },
  { label: 'Contracts', href: '#contracts' },
];

export function HeroScene() {
  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden">
      {/* 3D backdrop — decentralized constellation mascot */}
      <div className="absolute inset-0 opacity-70">
        <Canvas camera={{ position: [0, 0, 6], fov: 45 }}>
          <ambientLight intensity={0.4} />
          <directionalLight position={[5, 5, 5]} intensity={0.9} />
          <pointLight position={[-4, -2, 3]} intensity={0.5} color="#00ff88" />
          <StellarMascot />
          <Stars radius={60} depth={40} count={1200} factor={3} saturation={0} fade speed={0.5} />
        </Canvas>
      </div>

      {/* scanline overlay for CRT/crypto texture */}
      <div aria-hidden className="scanlines pointer-events-none absolute inset-0" />

      {/* Floating top nav */}
      <motion.nav
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-6 py-5 sm:px-10"
      >
        <Link href="/" className="flex items-center gap-3">
          <div className="h-5 w-5 animate-pulse-glow bg-[var(--accent)]" />
          <span className="font-mono text-lg font-black tracking-tight text-white">dMessage</span>
        </Link>

        <div className="hidden items-center gap-7 md:flex">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--text-muted)] transition-colors hover:text-[var(--accent)]"
            >
              {l.label}
            </a>
          ))}
          <Link
            href="/dashboard"
            className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--text-muted)] transition-colors hover:text-[var(--accent)]"
          >
            App
          </Link>
        </div>
      </motion.nav>

      {/* Hero content */}
      <div className="relative z-10 flex flex-col items-center gap-7 px-6">
        {/* Animated Remotion logo mark */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <LogoMark size={132} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
          className="text-center"
        >
          <h1 className="font-mono text-[var(--text-hero)] font-black leading-none tracking-tighter text-white">
            dMessage
          </h1>
          <div className="mx-auto mt-4 h-[3px] w-24 bg-[var(--accent)]" />
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="max-w-md text-center font-mono text-sm uppercase leading-relaxed tracking-[0.2em] text-[var(--text-muted)]"
        >
          Censorship-resistant messaging
          <br />
          you actually own
        </motion.p>

        {/* Primary path: start chatting now */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-col items-center gap-4 sm:flex-row"
        >
          <Link
            href="/dashboard"
            className="brutal bg-[var(--accent)] px-8 py-4 font-mono text-sm font-bold uppercase tracking-wider text-black transition-colors hover:bg-[var(--accent-dim)]"
          >
            Start Chatting →
          </Link>
          <WalletConnector />
        </motion.div>
      </div>

      {/* Scroll cue -> features */}
      <motion.a
        href="#features"
        aria-label="Scroll to features"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.6 }}
        className="absolute bottom-12 left-1/2 z-10 -translate-x-1/2"
      >
        <div className="group flex flex-col items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--text-muted)] transition-colors group-hover:text-[var(--accent)]">
            Scroll
          </span>
          <motion.div
            animate={{ scaleY: [1, 0.4, 1], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            className="h-8 w-[1px] origin-top bg-[var(--accent)]"
          />
        </div>
      </motion.a>
    </section>
  );
}
