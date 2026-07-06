import { isAddress, type Address } from "viem";
import { tool } from "ai";
import { z } from "zod";
import type { ChainKey } from "../../chains/index.js";
import { chainEnumSchema } from "../../chains/index.js";
import {
  getErc20TransferHistory,
  getNativeTransferHistory,
  type ScanApiConfig
} from "../../history/index.js";
import {
  getWhitelistedToken,
  parseTokenSymbol,
  type TokenRegistry
} from "../../tokens/index.js";
import type { WalletContext } from "../../wallet/client.js";

function parseOptionalBlock(value: string | undefined): bigint | undefined {
  return value === undefined ? undefined : BigInt(value);
}

function resolveToken(
  registry: TokenRegistry,
  chain: ChainKey,
  input: { tokenSymbol?: string; tokenAddress?: string }
) {
  if (input.tokenAddress) {
    if (!isAddress(input.tokenAddress)) {
      throw new Error("tokenAddress 不是合法 EVM 地址");
    }
    return { address: input.tokenAddress };
  }

  if (!input.tokenSymbol) {
    return undefined;
  }

  const symbol = parseTokenSymbol(input.tokenSymbol);
  const token = getWhitelistedToken(registry, chain, symbol);
  if (!token?.address) {
    throw new Error(`${chain} 上的 ${symbol} 未配置 token 地址`);
  }
  return {
    address: token.address,
    symbol: token.symbol,
    decimals: token.decimals
  };
}

export function createHistoryTools(
  wallet: WalletContext,
  registry: TokenRegistry,
  scanApis: ScanApiConfig
) {
  const chainSchema = chainEnumSchema(Object.keys(wallet.chains));
  return {
    getNativeTransferHistory: tool({
      description:
        "查询 native 资产转账历史。依赖链对应的 scan API。address 可选，默认当前钱包。limit 默认 20。",
      inputSchema: z.object({
        chain: chainSchema.describe("链标识，只能是 conflux 或 monad"),
        address: z.string().optional().describe("要查询的 EVM 地址，默认当前钱包"),
        startBlock: z.string().optional().describe("起始区块，十进制字符串"),
        endBlock: z.string().optional().describe("结束区块，十进制字符串"),
        limit: z.number().int().min(1).max(100).optional().describe("最多返回多少条，默认 20")
      }),
      execute: async ({ chain, address, startBlock, endBlock, limit }) => {
        const chainKey = chain;
        if (address !== undefined && !isAddress(address)) {
          throw new Error("address 不是合法 EVM 地址");
        }
        wallet.logger.log("agent tool call", {
          tool: "getNativeTransferHistory",
          input: { chain, address: address ?? wallet.account.address, startBlock, endBlock, limit }
        });
        return getNativeTransferHistory(wallet, scanApis, {
          chain: chainKey,
          address: address as Address | undefined,
          startBlock: parseOptionalBlock(startBlock),
          endBlock: parseOptionalBlock(endBlock),
          limit
        });
      }
    }),
    getErc20TransferHistory: tool({
      description:
        "查询 ERC20 Transfer 历史。通过 RPC eth_getLogs 查询，可指定 tokenSymbol/tokenAddress；不指定 token 时查询区块范围内所有 ERC20 Transfer。address 可选，默认当前钱包。",
      inputSchema: z.object({
        chain: chainSchema.describe("链标识，只能是 conflux 或 monad"),
        tokenSymbol: z.string().optional().describe("token symbol，例如 USDT、USDC"),
        tokenAddress: z.string().optional().describe("ERC20 token 合约地址"),
        address: z.string().optional().describe("要查询的 EVM 地址，默认当前钱包"),
        fromBlock: z.string().optional().describe("起始区块，十进制字符串"),
        toBlock: z.string().optional().describe("结束区块，十进制字符串"),
        blockRange: z.string().optional().describe("未指定 fromBlock 时向前查询多少个区块，默认 10000"),
        limit: z.number().int().min(1).max(100).optional().describe("最多返回多少条，默认 20")
      }),
      execute: async ({ chain, tokenSymbol, tokenAddress, address, fromBlock, toBlock, blockRange, limit }) => {
        const chainKey = chain;
        if (address !== undefined && !isAddress(address)) {
          throw new Error("address 不是合法 EVM 地址");
        }
        wallet.logger.log("agent tool call", {
          tool: "getErc20TransferHistory",
          input: {
            chain,
            tokenSymbol,
            tokenAddress,
            address: address ?? wallet.account.address,
            fromBlock,
            toBlock,
            blockRange,
            limit
          }
        });
        return getErc20TransferHistory(wallet, {
          chain: chainKey,
          address: address as Address | undefined,
          token: resolveToken(registry, chainKey, { tokenSymbol, tokenAddress }),
          fromBlock: parseOptionalBlock(fromBlock),
          toBlock: parseOptionalBlock(toBlock),
          blockRange: parseOptionalBlock(blockRange),
          limit
        });
      }
    })
  };
}
