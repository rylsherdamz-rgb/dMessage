'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Float, Icosahedron, Line } from '@react-three/drei';
import * as THREE from 'three';

const ACCENT = '#00ff88';

/**
 * Decentralized-constellation mascot: a faceted core node surrounded by
 * orbiting peer nodes connected by edges — a clean visual metaphor for
 * peer-to-peer, on-chain messaging. Replaces the old distorted blob.
 */
function Constellation() {
  const group = useRef<THREE.Group>(null);

  // Peer nodes placed on the vertices of an icosahedron for even spacing.
  const nodes = useMemo<[number, number, number][]>(() => {
    const t = (1 + Math.sqrt(5)) / 2;
    const raw: [number, number, number][] = [
      [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
      [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
      [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
    ];
    const r = 2.05;
    return raw.map(([x, y, z]) => {
      const v = new THREE.Vector3(x, y, z).normalize().multiplyScalar(r);
      return [v.x, v.y, v.z] as [number, number, number];
    });
  }, []);

  useFrame((_, delta) => {
    if (group.current) {
      group.current.rotation.y += delta * 0.12;
      group.current.rotation.x += delta * 0.04;
    }
  });

  return (
    <group ref={group}>
      {/* Edges from core to each peer node */}
      {nodes.map((pos, i) => (
        <Line
          key={`edge-${i}`}
          points={[[0, 0, 0], pos]}
          color={ACCENT}
          lineWidth={1}
          transparent
          opacity={0.22}
        />
      ))}

      {/* Peer nodes */}
      {nodes.map((pos, i) => (
        <mesh key={`node-${i}`} position={pos}>
          <sphereGeometry args={[0.085, 16, 16]} />
          <meshStandardMaterial
            color={ACCENT}
            emissive={ACCENT}
            emissiveIntensity={2.2}
            toneMapped={false}
          />
        </mesh>
      ))}

      {/* Wireframe shell */}
      <Icosahedron args={[1.5, 1]}>
        <meshBasicMaterial color={ACCENT} wireframe transparent opacity={0.12} />
      </Icosahedron>

      {/* Faceted core node */}
      <Icosahedron args={[0.62, 0]}>
        <meshStandardMaterial
          color={ACCENT}
          emissive={ACCENT}
          emissiveIntensity={0.6}
          roughness={0.35}
          metalness={0.4}
          flatShading
        />
      </Icosahedron>
    </group>
  );
}

export function StellarMascot() {
  return (
    <Float speed={1.4} rotationIntensity={0.25} floatIntensity={0.8}>
      <Constellation />
    </Float>
  );
}
