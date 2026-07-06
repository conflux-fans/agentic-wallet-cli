import "dotenv/config";
import { CHAIN_DEFINITIONS } from "../chains/definitions.js";
import type { ChainEnvConfig } from "../chains/index.js";

export type AppEnv = {
  openRouterApiKey: string;
  openRouterModel: string;
  privateKey: `0x${string}`;
  chains: Record<string, ChainEnvConfig>;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function normalizePrivateKey(value: string): `0x${string}` {
  const normalized = value.startsWith("0x") ? value : `0x${value}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Error("PRIVATE_KEY must be a 32-byte hex private key");
  }
  return normalized as `0x${string}`;
}

function optionalAddress(name: string): `0x${string}` | undefined {
  const value = process.env[name];
  if (!value) {
    return undefined;
  }
  const normalized = value.startsWith("0x") ? value : `0x${value}`;
  if (!/^0x[0-9a-fA-F]{40}$/.test(normalized)) {
    throw new Error(`${name} must be a 20-byte EVM address`);
  }
  return normalized as `0x${string}`;
}

export function loadEnv(): AppEnv {
  const chains: Record<string, ChainEnvConfig> = {};
  for (const def of CHAIN_DEFINITIONS) {
    const KEY = def.key.toUpperCase();
    const tokens: Record<string, `0x${string}`> = {};
    for (const symbol of Object.keys(def.defaultTokens ?? {})) {
      const override = optionalAddress(`${KEY}_${symbol}_ADDRESS`);
      if (override) {
        tokens[symbol] = override;
      }
    }
    chains[def.key] = {
      rpcUrl: requireEnv(`${KEY}_RPC_URL`),
      tokens,
      scan: {
        apiUrl: process.env[`${KEY}_SCAN_API_URL`] || def.defaultScanApiUrl,
        apiKey: process.env[`${KEY}_SCAN_API_KEY`]
      }
    };
  }

  return {
    openRouterApiKey: requireEnv("OPENROUTER_API_KEY"),
    openRouterModel: process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini",
    privateKey: normalizePrivateKey(requireEnv("PRIVATE_KEY")),
    chains
  };
}
