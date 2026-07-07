import { z } from "zod";
import type { Chain } from "viem";
import { CHAIN_DEFINITIONS } from "./definitions.js";

export type ChainKey = string;

export type ChainConfig = {
  key: string;
  displayName: string;
  nativeSymbol: string;
  chain: Chain;
  rpcUrl: string;
  explorerUrl?: string;
};

export type ChainEnvConfig = {
  rpcUrl: string;
  tokens: Record<string, `0x${string}`>;
  scan: { apiUrl?: string; apiKey?: string };
};

export function chainKeys(): string[] {
  return CHAIN_DEFINITIONS.map((d) => d.key);
}

export function createChainRegistry(rpcUrls: Record<string, string>): Record<string, ChainConfig> {
  const registry: Record<string, ChainConfig> = {};
  for (const def of CHAIN_DEFINITIONS) {
    const rpcUrl = rpcUrls[def.key];
    if (!rpcUrl) {
      throw new Error(`Missing RPC URL for chain "${def.key}"`);
    }
    const chain: Chain = {
      id: def.chainId,
      name: def.displayName,
      nativeCurrency: def.nativeCurrency,
      rpcUrls: { default: { http: [rpcUrl] } },
      ...(def.explorerUrl
        ? {
            blockExplorers: {
              default: { name: def.blockExplorerName ?? "Explorer", url: def.explorerUrl }
            }
          }
        : {})
    };
    registry[def.key] = {
      key: def.key,
      displayName: def.displayName,
      nativeSymbol: def.nativeCurrency.symbol,
      rpcUrl,
      explorerUrl: def.explorerUrl,
      chain
    };
  }
  return registry;
}

export function isChainKey(registry: Record<string, ChainConfig>, value: string): boolean {
  return Object.prototype.hasOwnProperty.call(registry, value);
}

export function assertChainKey(registry: Record<string, ChainConfig>, value: string): string {
  if (!isChainKey(registry, value)) {
    throw new Error(`Unsupported chain "${value}". Available: ${Object.keys(registry).join(", ")}`);
  }
  return value;
}

export function chainEnumSchema(keys: string[]) {
  return z.enum(keys as [string, ...string[]]);
}
