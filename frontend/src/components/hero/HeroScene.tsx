'use client';

import { Canvas } from '@react-three/fiber';
import { Float, MeshDistortMaterial, Stars } from '@react-three/drei';
import { motion } from 'framer-motion';
import { WalletConnector } from '@/components/wallet/WalletConnector';

function StellarOrb() {
  return (
    <Float speed={1.5} rotationIntensity={0.3} floatIntensity={1}>
      <mesh scale={2}>
        <icosahedronGeometry args={[1, 3]} />
        <MeshDistortMaterial
          color="#00ff88"
          emissive="#00ff88"
          emissiveIntensity={0.15}
          roughness={0.6}
          metalness={0.3}
          distort={0.25}
          speed={2}
        />
      </mesh>
    </Float>
  );
}

export function HeroScene() {
  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden">
      <div className="absolute inset-0">
        <Canvas camera={{ position: [0, 0, 5.5], fov: 45 }}>
          <ambientLight intensity={0.3} />
          <directionalLight position={[5, 5, 5]} intensity={0.8} />
          <StellarOrb />
          <Stars radius={60} depth={40} count={1200} factor={3} saturation={0} fade speed={0.5} />
        </Canvas>
      </div>

      <div className="relative z-10 flex flex-col items-center gap-10 px-6">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="text-center"
        >
          <h1 className="font-mono text-[var(--text-hero)] font-black leading-none tracking-tighter text-white">
            dMessage
          </h1>
          <div className="mt-4 h-[3px] w-24 bg-[var(--accent)] mx-auto" />
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="max-w-md text-center font-mono text-sm uppercase tracking-[0.2em] text-[var(--text-muted)]"
        >
          Decentralized Messaging
          <br />
          on Stellar Soroban
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <WalletConnector />
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="absolute bottom-12 left-1/2 -translate-x-1/2"
        >
          <div className="flex flex-col items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--text-muted)]">
              Scroll
            </span>
            <div className="h-8 w-[1px] bg-[var(--border)]" />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
