import type { Chain } from "viem";

export type ChainKey = "conflux" | "monad";

export type ChainConfig = {
  key: ChainKey;
  displayName: string;
  chain: Chain;
  rpcUrl: string;
  explorerUrl?: string;
};

type ChainInput = {
  confluxRpcUrl: string;
  monadRpcUrl: string;
};

export function createChainRegistry(input: ChainInput): Record<ChainKey, ChainConfig> {
  return {
    conflux: {
      key: "conflux",
      displayName: "Conflux eSpace",
      rpcUrl: input.confluxRpcUrl,
      explorerUrl: "https://evm.confluxscan.io",
      chain: {
        id: 1030,
        name: "Conflux eSpace",
        nativeCurrency: {
          name: "CFX",
          symbol: "CFX",
          decimals: 18
        },
        rpcUrls: {
          default: { http: [input.confluxRpcUrl] }
        },
        blockExplorers: {
          default: {
            name: "ConfluxScan",
            url: "https://evm.confluxscan.io"
          }
        }
      }
    },
    monad: {
      key: "monad",
      displayName: "Monad",
      rpcUrl: input.monadRpcUrl,
      chain: {
        id: 10143,
        name: "Monad",
        nativeCurrency: {
          name: "MON",
          symbol: "MON",
          decimals: 18
        },
        rpcUrls: {
          default: { http: [input.monadRpcUrl] }
        }
      }
    }
  };
}

export function parseChainKey(value: string): ChainKey {
  if (value === "conflux" || value === "monad") {
    return value;
  }
  throw new Error(`Unsupported chain "${value}". Use "conflux" or "monad".`);
}
