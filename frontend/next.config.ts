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
    NEXT_PUBLIC_SOROBAN_RPC: dep.network === 'mainnet'
      ? 'https://soroban-rpc.mainnet.stellar.org'
      : 'https://soroban-testnet.stellar.org',
  };
} catch {
  // deployment.json not available — rely on .env.local
}

const nextConfig: NextConfig = {
  env,
};

export default nextConfig;
