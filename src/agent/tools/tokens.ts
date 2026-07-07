import { tool } from "ai";
import { z } from "zod";
import type { ChainKey } from "../../chains/index.js";
import type { ChainConfig } from "../../chains/index.js";
import { chainEnumSchema } from "../../chains/index.js";
import {
  addWhitelistedToken,
  getWhitelistedTokens,
  removeWhitelistedToken,
  updateWhitelistedToken,
  type TokenRegistry
} from "../../tokens/index.js";
import { readErc20Metadata } from "../../tokens/metadata.js";
import type { Logger } from "../../logger.js";
import { isAddress } from "viem";

export function createTokenTools(
  registry: TokenRegistry,
  chains: Record<ChainKey, ChainConfig>,
  logger: Logger
) {
  const chainKeys = Object.keys(chains);
  const chainSchema = chainEnumSchema(chainKeys);
  const chainDesc = `链标识，可选值：${chainKeys.join("、")}`;
  return {
    getWhitelistedTokens: tool({
      description:
        "查询指定链当前白名单支持的 ERC20 token。",
      inputSchema: z.object({
        chain: chainSchema.describe(chainDesc)
      }),
      execute: async ({ chain }) => {
        logger.log("agent tool call", {
          tool: "getWhitelistedTokens",
          input: { chain }
        });

        return getWhitelistedTokens(registry, chain);
      }
    }),
    addWhitelistedToken: tool({
      description:
        "向指定链的 ERC20 token 白名单增加 token。只需要 chain 和 address；会通过 RPC 读取 ERC20 name、symbol、decimals。symbol/name/decimals 可选，用于覆盖链上读取结果。",
      inputSchema: z.object({
        chain: chainSchema.describe(chainDesc),
        address: z.string().describe("ERC20 token 合约地址"),
        symbol: z.string().optional().describe("可选覆盖 token symbol，例如 DAI"),
        decimals: z.number().int().min(0).max(255).optional().describe("可选覆盖 token decimals"),
        name: z.string().optional().describe("token 名称")
      }),
      execute: async ({ chain, symbol, address, decimals, name }) => {
        logger.log("agent tool call", {
          tool: "addWhitelistedToken",
          input: { chain, symbol, address, decimals, name }
        });
        if (!isAddress(address)) {
          throw new Error("token 地址不是合法 EVM 地址");
        }
        const chainKey = chain;
        const metadata = await readErc20Metadata(chains[chainKey], address, logger);

        return addWhitelistedToken(registry, chainKey, {
          symbol: symbol ?? metadata.symbol,
          address,
          decimals: decimals ?? metadata.decimals,
          name: name ?? metadata.name
        });
      }
    }),
    updateWhitelistedToken: tool({
      description:
        "修改指定链 token 白名单中的 token 地址、名称或 decimals。",
      inputSchema: z.object({
        chain: chainSchema.describe(chainDesc),
        symbol: z.string().describe("要修改的 token symbol"),
        address: z.string().optional().describe("新的 ERC20 token 合约地址"),
        decimals: z.number().int().min(0).max(255).optional().describe("新的 token decimals"),
        name: z.string().optional().describe("新的 token 名称")
      }),
      execute: async ({ chain, symbol, address, decimals, name }) => {
        logger.log("agent tool call", {
          tool: "updateWhitelistedToken",
          input: { chain, symbol, address, decimals, name }
        });

        return updateWhitelistedToken(registry, chain, symbol, {
          address,
          decimals,
          name
        });
      }
    }),
    removeWhitelistedToken: tool({
      description: "从指定链的 ERC20 token 白名单删除 token。",
      inputSchema: z.object({
        chain: chainSchema.describe(chainDesc),
        symbol: z.string().describe("要删除的 token symbol")
      }),
      execute: async ({ chain, symbol }) => {
        logger.log("agent tool call", {
          tool: "removeWhitelistedToken",
          input: { chain, symbol }
        });

        return removeWhitelistedToken(registry, chain, symbol);
      }
    })
  };
}
