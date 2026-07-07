import { z } from "zod";
import type { Chain } from "viem";
import { CHAIN_DEFINITIONS } from "./definitions.js";
import type { ChainDefinition } from "./definitions.js";

export type ChainKey = string;

export type ChainConfig = {
  key: string;
  displayName: string;
  nativeSymbol: string;
  nativeDecimals: number;
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
  validateChainDefinitions(CHAIN_DEFINITIONS);
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
      nativeDecimals: def.nativeCurrency.decimals,
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

export function getChainConfig(registry: Record<string, ChainConfig>, value: string): ChainConfig {
  const config = registry[value];
  if (!config) {
    throw new Error(`Unsupported chain "${value}". Available: ${Object.keys(registry).join(", ")}`);
  }
  return config;
}

export function chainEnumSchema(keys: string[]) {
  if (keys.length === 0) {
    throw new Error("At least one chain key is required");
  }
  return z.enum(keys as [string, ...string[]]);
}

function validateChainDefinitions(definitions: ChainDefinition[]): void {
  const seen = new Set<string>();
  for (const def of definitions) {
    if (!/^[a-z0-9_]+$/.test(def.key)) {
      throw new Error(`Invalid chain key "${def.key}". Use lowercase letters, numbers, and underscores only.`);
    }
    if (def.envPrefix !== undefined && !/^[A-Z0-9_]+$/.test(def.envPrefix)) {
      throw new Error(`Invalid envPrefix "${def.envPrefix}" for chain "${def.key}". Use uppercase letters, numbers, and underscores only.`);
    }
    if (seen.has(def.key)) {
      throw new Error(`Duplicate chain key "${def.key}"`);
    }
    seen.add(def.key);
    if (!Number.isInteger(def.nativeCurrency.decimals) || def.nativeCurrency.decimals < 0 || def.nativeCurrency.decimals > 255) {
      throw new Error(`Invalid native currency decimals for chain "${def.key}"`);
    }
  }
}
