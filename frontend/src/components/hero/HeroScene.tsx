'use client';

import { Canvas } from '@react-three/fiber';
import { Float, MeshDistortMaterial, Stars } from '@react-three/drei';
import { motion } from 'framer-motion';
import { WalletConnector } from '@/components/wallet/WalletConnector';

function StellarOrb() {
  return (
    <Float speed={2} rotationIntensity={0.4} floatIntensity={1.5}>
      <mesh scale={2.2}>
        <icosahedronGeometry args={[1, 4]} />
        <MeshDistortMaterial
          color="#6366f1"
          emissive="#4f46e5"
          emissiveIntensity={0.4}
          roughness={0.3}
          metalness={0.8}
          distort={0.35}
          speed={3}
        />
      </mesh>
    </Float>
  );
}

export function HeroScene() {
  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden">
      <div className="absolute inset-0">
        <Canvas camera={{ position: [0, 0, 6], fov: 50 }}>
          <ambientLight intensity={0.4} />
          <directionalLight position={[5, 5, 5]} intensity={1.2} />
          <StellarOrb />
          <Stars radius={80} depth={50} count={2500} factor={4} saturation={0} fade speed={1} />
        </Canvas>
      </div>

      <div className="relative z-10 flex flex-col items-center gap-8 px-6 text-center">
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="font-mono text-[var(--text-hero)] font-bold leading-none tracking-tight"
        >
          dMessage
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
          className="max-w-xl text-lg text-[var(--color-text-muted)]"
        >
          Decentralized. Encrypted. Yours.
          <br />
          Messaging on the Stellar blockchain.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.4, ease: 'easeOut' }}
        >
          <WalletConnector />
        </motion.div>
      </div>
    </section>
  );
}
