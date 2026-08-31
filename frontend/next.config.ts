import type { NextConfig } from "next";
import * as fs from 'node:fs';
import * as path from 'node:path';

const deploymentPath = path.resolve(process.cwd(), '..', 'deployment.json');

let env: Record<string, string> = {};

try {
  const dep = JSON.parse(fs.readFileSync(deploymentPath, 'utf-8'));
  env = {
    NEXT_PUBLIC_CONTRACT_USER_REGISTRY: dep.contracts.user_registry.id,
    NEXT_PUBLIC_CONTRACT_SOCIAL_GRAPH: dep.contracts.social_graph.id,
    NEXT_PUBLIC_CONTRACT_MESSAGES: dep.contracts.messages.id,
    NEXT_PUBLIC_STELLAR_NETWORK: 'testnet',
    NEXT_PUBLIC_SOROBAN_RPC: 'https://soroban-testnet.stellar.org'
  };
} catch (error) {
  // A malformed deployment manifest would otherwise make production silently
  // fall back to testnet defaults, leaving the client and relayer on different
  // networks. Local development can still provide the values through .env.local.
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`Unable to load deployment.json: ${(error as Error).message}`);
  }
  console.warn(`Unable to load deployment.json: ${(error as Error).message}`);
}

const nextConfig: NextConfig = {
  env,
};

export default nextConfig;
