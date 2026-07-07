export type TokenDefinition = {
  name: string;
  decimals: number;
  address: `0x${string}`;
};

export type ChainDefinition = {
  key: string;
  envPrefix?: string;
  displayName: string;
  chainId: number;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  explorerUrl?: string;
  blockExplorerName?: string;
  defaultScanApiUrl?: string;
  defaultTokens?: Record<string, TokenDefinition>;
};

export const CHAIN_DEFINITIONS: ChainDefinition[] = [
  {
    key: "conflux",
    displayName: "Conflux eSpace",
    chainId: 1030,
    nativeCurrency: { name: "CFX", symbol: "CFX", decimals: 18 },
    explorerUrl: "https://evm.confluxscan.io",
    blockExplorerName: "ConfluxScan",
    defaultScanApiUrl: "https://evmapi.confluxscan.io/api",
    defaultTokens: {
      USDT: { name: "Tether USD", decimals: 6, address: "0xaf37e8b6c9ed7f6318979f56fc287d76c30847ff" },
      USDC: { name: "USD Coin", decimals: 6, address: "0x6963efed0ab40f6c3d7bda44a05dcf1437c44372" }
    }
  },
  {
    key: "monad",
    displayName: "Monad",
    chainId: 10143,
    nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
    defaultTokens: {
      USDT: { name: "Tether USD", decimals: 6, address: "0xe7cd86e13AC4309349F30B3435a9d337750fC82D" },
      USDC: { name: "USD Coin", decimals: 6, address: "0x754704Bc059F8C67012fEd69BC8A327a5aafb603" }
    }
  }
];
