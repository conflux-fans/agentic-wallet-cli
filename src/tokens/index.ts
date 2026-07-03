import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { isAddress, type Address } from "viem";
import type { ChainKey } from "../chains/index.js";

export type TokenSymbol = string;

export type TokenConfig = {
  symbol: TokenSymbol;
  name: string;
  decimals: number;
  address?: Address;
};

export type TokenRegistry = Record<ChainKey, Record<string, TokenConfig>>;

export type TokenRegistryInput = {
  confluxUsdtAddress?: Address;
  confluxUsdcAddress?: Address;
  monadUsdtAddress?: Address;
  monadUsdcAddress?: Address;
};

const DEFAULT_CONFLUX_USDT_ADDRESS = "0xaf37e8b6c9ed7f6318979f56fc287d76c30847ff";
const DEFAULT_CONFLUX_USDC_ADDRESS = "0x6963efed0ab40f6c3d7bda44a05dcf1437c44372";
const DEFAULT_MONAD_USDT_ADDRESS = "0xe7cd86e13AC4309349F30B3435a9d337750fC82D";
const DEFAULT_MONAD_USDC_ADDRESS = "0x754704Bc059F8C67012fEd69BC8A327a5aafb603";

type TokenListFile = {
  chains?: Partial<Record<ChainKey, { tokens?: Record<string, TokenConfig>; removedSymbols?: string[] }>>;
};

export function createTokenRegistry(input: TokenRegistryInput): TokenRegistry {
  const registry: TokenRegistry = {
    conflux: {
      USDT: createToken(
        "USDT",
        "Tether USD",
        input.confluxUsdtAddress ?? DEFAULT_CONFLUX_USDT_ADDRESS
      ),
      USDC: createToken(
        "USDC",
        "USD Coin",
        input.confluxUsdcAddress ?? DEFAULT_CONFLUX_USDC_ADDRESS
      )
    },
    monad: {
      USDT: createToken(
        "USDT",
        "Tether USD",
        input.monadUsdtAddress ?? DEFAULT_MONAD_USDT_ADDRESS
      ),
      USDC: createToken(
        "USDC",
        "USD Coin",
        input.monadUsdcAddress ?? DEFAULT_MONAD_USDC_ADDRESS
      )
    }
  };

  const file = loadTokenListFile();
  for (const chain of Object.keys(registry) as ChainKey[]) {
    const chainFile = file.chains?.[chain];
    for (const removedSymbol of chainFile?.removedSymbols ?? []) {
      delete registry[chain][normalizeSymbol(removedSymbol)];
    }
    for (const token of Object.values(chainFile?.tokens ?? {})) {
      registry[chain][normalizeSymbol(token.symbol)] = {
        ...token,
        symbol: normalizeSymbol(token.symbol)
      };
    }
  }

  return registry;
}

export function getWhitelistedTokens(
  registry: TokenRegistry,
  chain: ChainKey
): TokenConfig[] {
  return Object.values(registry[chain]);
}

export function getWhitelistedToken(
  registry: TokenRegistry,
  chain: ChainKey,
  symbol: TokenSymbol
): TokenConfig | undefined {
  return registry[chain][normalizeSymbol(symbol)];
}

export function parseTokenSymbol(value: string): TokenSymbol {
  return normalizeSymbol(value);
}

export function addWhitelistedToken(
  registry: TokenRegistry,
  chain: ChainKey,
  input: { symbol: string; name?: string; decimals: number; address: string }
): TokenConfig {
  const token = normalizeTokenInput(input);
  const file = loadTokenListFile();
  const chainFile = ensureChainFile(file, chain);
  chainFile.removedSymbols = (chainFile.removedSymbols ?? []).filter(
    (symbol) => normalizeSymbol(symbol) !== token.symbol
  );
  chainFile.tokens = { ...(chainFile.tokens ?? {}), [token.symbol]: token };
  saveTokenListFile(file);
  registry[chain][token.symbol] = token;
  return token;
}

export function updateWhitelistedToken(
  registry: TokenRegistry,
  chain: ChainKey,
  symbol: string,
  input: { name?: string; decimals?: number; address?: string }
): TokenConfig {
  const normalizedSymbol = normalizeSymbol(symbol);
  const existing = registry[chain][normalizedSymbol];
  if (!existing) {
    throw new Error(`${chain} 上不存在 token ${normalizedSymbol}`);
  }

  const updated = normalizeTokenInput({
    symbol: normalizedSymbol,
    name: input.name ?? existing.name,
    decimals: input.decimals ?? existing.decimals,
    address: input.address ?? existing.address
  });
  const file = loadTokenListFile();
  const chainFile = ensureChainFile(file, chain);
  chainFile.removedSymbols = (chainFile.removedSymbols ?? []).filter(
    (removed) => normalizeSymbol(removed) !== normalizedSymbol
  );
  chainFile.tokens = { ...(chainFile.tokens ?? {}), [normalizedSymbol]: updated };
  saveTokenListFile(file);
  registry[chain][normalizedSymbol] = updated;
  return updated;
}

export function removeWhitelistedToken(
  registry: TokenRegistry,
  chain: ChainKey,
  symbol: string
): TokenConfig {
  const normalizedSymbol = normalizeSymbol(symbol);
  const existing = registry[chain][normalizedSymbol];
  if (!existing) {
    throw new Error(`${chain} 上不存在 token ${normalizedSymbol}`);
  }

  const file = loadTokenListFile();
  const chainFile = ensureChainFile(file, chain);
  const tokens = { ...(chainFile.tokens ?? {}) };
  delete tokens[normalizedSymbol];
  chainFile.tokens = tokens;
  chainFile.removedSymbols = Array.from(
    new Set([...(chainFile.removedSymbols ?? []).map(normalizeSymbol), normalizedSymbol])
  );
  saveTokenListFile(file);
  delete registry[chain][normalizedSymbol];
  return existing;
}

function createToken(
  symbol: TokenSymbol,
  name: string,
  address?: Address
): TokenConfig {
  return {
    symbol,
    name,
    decimals: 6,
    address
  };
}

function normalizeSymbol(symbol: string): string {
  const normalized = symbol.trim().toUpperCase();
  if (!normalized) {
    throw new Error("Token symbol is required");
  }
  return normalized;
}

function normalizeTokenInput(input: {
  symbol: string;
  name?: string;
  decimals: number;
  address?: string;
}): TokenConfig {
  if (!Number.isInteger(input.decimals) || input.decimals < 0 || input.decimals > 255) {
    throw new Error("Token decimals must be an integer between 0 and 255");
  }
  if (!input.address || !isAddress(input.address)) {
    throw new Error("Token address must be a valid EVM address");
  }
  const symbol = normalizeSymbol(input.symbol);
  return {
    symbol,
    name: input.name?.trim() || symbol,
    decimals: input.decimals,
    address: input.address
  };
}

function tokenListFilePath(): string {
  return resolve(process.cwd(), ".wallet-token-list.json");
}

function loadTokenListFile(): TokenListFile {
  const path = tokenListFilePath();
  if (!existsSync(path)) {
    return { chains: {} };
  }
  const data = JSON.parse(readFileSync(path, "utf8")) as TokenListFile;
  return { chains: data.chains ?? {} };
}

function saveTokenListFile(file: TokenListFile): void {
  writeFileSync(tokenListFilePath(), `${JSON.stringify(file, null, 2)}\n`);
}

function ensureChainFile(
  file: TokenListFile,
  chain: ChainKey
): { tokens?: Record<string, TokenConfig>; removedSymbols?: string[] } {
  file.chains = file.chains ?? {};
  file.chains[chain] = file.chains[chain] ?? {};
  return file.chains[chain];
}
