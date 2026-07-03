import { createPublicClient, http, type Address } from "viem";
import type { ChainConfig } from "../chains/index.js";
import { redactUrl, type Logger } from "../logger.js";

const erc20MetadataAbi = [
  {
    type: "function",
    name: "name",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }]
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }]
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }]
  }
] as const;

export async function readErc20Metadata(
  config: ChainConfig,
  tokenAddress: Address,
  logger?: Logger
): Promise<{ name: string; symbol: string; decimals: number }> {
  const publicClient = createPublicClient({
    chain: config.chain,
    transport: http(config.rpcUrl)
  });
  logger?.log("web3 rpc batch", {
    chain: config.displayName,
    endpoint: redactUrl(config.rpcUrl),
    contract: tokenAddress,
    methods: ["name", "symbol", "decimals"]
  });

  const [name, symbol, decimals] = await Promise.all([
    publicClient.readContract({
      address: tokenAddress,
      abi: erc20MetadataAbi,
      functionName: "name"
    }),
    publicClient.readContract({
      address: tokenAddress,
      abi: erc20MetadataAbi,
      functionName: "symbol"
    }),
    publicClient.readContract({
      address: tokenAddress,
      abi: erc20MetadataAbi,
      functionName: "decimals"
    })
  ]);

  return {
    name,
    symbol,
    decimals: Number(decimals)
  };
}
