import { tool } from "ai";
import { randomUUID } from "node:crypto";
import { isAddress, type Address } from "viem";
import { z } from "zod";
import type { AddressBook } from "../../address-book/index.js";
import type { ChainKey } from "../../chains/index.js";
import { chainEnumSchema } from "../../chains/index.js";
import {
  getErc20Allowance,
  getErc20Balance,
  prepareErc20Approve,
  prepareErc20Transfer,
  type Erc20ApprovePlan,
  type Erc20TokenInput,
  type Erc20TransferPlan,
  type WalletContext
} from "../../wallet/client.js";
import {
  getWhitelistedToken,
  parseTokenSymbol,
  type TokenRegistry
} from "../../tokens/index.js";
import type { AgentSession } from "../session.js";

const tokenSymbolSchema = z.string().optional();

function resolveToken(
  registry: TokenRegistry,
  chain: ChainKey,
  input: { tokenSymbol?: string; tokenAddress?: string }
): Erc20TokenInput {
  if (input.tokenAddress !== undefined) {
    if (!isAddress(input.tokenAddress)) {
      throw new Error("token 地址不是合法 EVM 地址");
    }

    return { address: input.tokenAddress };
  }

  if (input.tokenSymbol === undefined) {
    throw new Error("请指定 tokenSymbol 或 tokenAddress");
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

function serializeErc20TransferPlan(plan: Erc20TransferPlan) {
  return {
    id: plan.id,
    kind: plan.kind,
    chain: plan.chain,
    chainName: plan.chainName,
    from: plan.from,
    tokenAddress: plan.tokenAddress,
    tokenSymbol: plan.tokenSymbol,
    tokenDecimals: plan.tokenDecimals,
    to: plan.to,
    amount: plan.amount,
    rawAmount: plan.rawAmount.toString(),
    estimatedGas: plan.estimatedGas.toString(),
    estimatedFee: plan.estimatedFee.toString()
  };
}

function serializeErc20ApprovePlan(plan: Erc20ApprovePlan) {
  return {
    id: plan.id,
    kind: plan.kind,
    chain: plan.chain,
    chainName: plan.chainName,
    owner: plan.owner,
    tokenAddress: plan.tokenAddress,
    tokenSymbol: plan.tokenSymbol,
    tokenDecimals: plan.tokenDecimals,
    spender: plan.spender,
    amount: plan.amount,
    rawAmount: plan.rawAmount.toString(),
    estimatedGas: plan.estimatedGas.toString(),
    estimatedFee: plan.estimatedFee.toString()
  };
}

export function createErc20Tools(
  ctx: WalletContext,
  registry: TokenRegistry,
  session: AgentSession,
  addressBook?: AddressBook
) {
  const chainKeys = Object.keys(ctx.chains);
  const chainSchema = chainEnumSchema(chainKeys);
  const chainDesc = `链标识，可选值：${chainKeys.join("、")}`;
  return {
    getErc20Balance: tool({
      description:
        "查询 ERC20 token 余额。可使用白名单 tokenSymbol(USDT/USDC)，也可直接指定 tokenAddress。address 可选，默认当前钱包地址。",
      inputSchema: z.object({
        chain: chainSchema.describe(chainDesc),
        tokenSymbol: tokenSymbolSchema.describe("token symbol，例如 USDT、USDC 或自定义 token symbol"),
        tokenAddress: z.string().optional().describe("ERC20 token 合约地址"),
        address: z.string().optional().describe("要查询余额的 EVM 地址，默认当前钱包")
      }),
      execute: async ({ chain, tokenSymbol, tokenAddress, address }) => {
        const chainKey = chain;
        ctx.logger.log("agent tool call", {
          tool: "getErc20Balance",
          input: { chain, tokenSymbol, tokenAddress, address: address ?? ctx.account.address }
        });
        if (address !== undefined && !isAddress(address)) {
          throw new Error("查询地址不是合法 EVM 地址");
        }

        return getErc20Balance(
          ctx,
          chainKey,
          resolveToken(registry, chainKey, { tokenSymbol, tokenAddress }),
          address as Address | undefined
        );
      }
    }),
    getErc20Allowance: tool({
      description:
        "查询 ERC20 allowance/approve 授权额度。owner 可选，默认当前钱包地址；spender 必填。",
      inputSchema: z.object({
        chain: chainSchema.describe(chainDesc),
        tokenSymbol: tokenSymbolSchema.describe("token symbol，例如 USDT、USDC 或自定义 token symbol"),
        tokenAddress: z.string().optional().describe("ERC20 token 合约地址"),
        owner: z.string().optional().describe("授权方地址，默认当前钱包"),
        spender: z.string().describe("被授权 spender 地址或地址簿联系人名称")
      }),
      execute: async ({ chain, tokenSymbol, tokenAddress, owner, spender }) => {
        const chainKey = chain;
        const resolvedOwner = owner !== undefined ? addressBook?.resolve(owner) ?? owner : undefined;
        const resolvedSpender = addressBook?.resolve(spender) ?? spender;
        ctx.logger.log("agent tool call", {
          tool: "getErc20Allowance",
          input: {
            chain,
            tokenSymbol,
            tokenAddress,
            owner: resolvedOwner ?? ctx.account.address,
            spender,
            resolvedSpender
          }
        });
        if (resolvedOwner !== undefined && !isAddress(resolvedOwner)) {
          throw new Error("owner 不是合法 EVM 地址");
        }
        if (!isAddress(resolvedSpender)) {
          throw new Error("spender 不是合法 EVM 地址");
        }

        return getErc20Allowance(
          ctx,
          chainKey,
          resolveToken(registry, chainKey, { tokenSymbol, tokenAddress }),
          resolvedOwner as Address | undefined,
          resolvedSpender
        );
      }
    }),
    prepareErc20Transfer: tool({
      description:
        "准备 ERC20 token 转账交易。只生成待确认交易计划，不会签名或发送。",
      inputSchema: z.object({
        chain: chainSchema.describe(chainDesc),
        tokenSymbol: tokenSymbolSchema.describe("token symbol，例如 USDT、USDC 或自定义 token symbol"),
        tokenAddress: z.string().optional().describe("ERC20 token 合约地址"),
        to: z.string().describe("接收方 EVM 地址或地址簿联系人名称"),
        amount: z.string().describe("转账数量，十进制字符串，例如 10.5")
      }),
      execute: async ({ chain, tokenSymbol, tokenAddress, to, amount }) => {
        const chainKey = chain;
        const resolvedTo = addressBook?.resolve(to) ?? to;
        ctx.logger.log("agent tool call", {
          tool: "prepareErc20Transfer",
          input: { chain, tokenSymbol, tokenAddress, to, resolvedTo, amount }
        });
        if (!isAddress(resolvedTo)) {
          throw new Error("接收方地址不是合法 EVM 地址");
        }

        const plan = await prepareErc20Transfer(ctx, {
          id: randomUUID(),
          chain: chainKey,
          token: resolveToken(registry, chainKey, { tokenSymbol, tokenAddress }),
          to: resolvedTo,
          amount
        });
        session.pendingTransaction = plan;
        return serializeErc20TransferPlan(plan);
      }
    }),
    prepareErc20Approve: tool({
      description:
        "准备 ERC20 approve 授权交易。只生成待确认交易计划，不会签名或发送。",
      inputSchema: z.object({
        chain: chainSchema.describe(chainDesc),
        tokenSymbol: tokenSymbolSchema.describe("token symbol，例如 USDT、USDC 或自定义 token symbol"),
        tokenAddress: z.string().optional().describe("ERC20 token 合约地址"),
        spender: z.string().describe("被授权 spender 地址或地址簿联系人名称"),
        amount: z.string().describe("授权数量，十进制字符串，例如 10.5")
      }),
      execute: async ({ chain, tokenSymbol, tokenAddress, spender, amount }) => {
        const chainKey = chain;
        const resolvedSpender = addressBook?.resolve(spender) ?? spender;
        ctx.logger.log("agent tool call", {
          tool: "prepareErc20Approve",
          input: { chain, tokenSymbol, tokenAddress, spender, resolvedSpender, amount }
        });
        if (!isAddress(resolvedSpender)) {
          throw new Error("spender 不是合法 EVM 地址");
        }

        const plan = await prepareErc20Approve(ctx, {
          id: randomUUID(),
          chain: chainKey,
          token: resolveToken(registry, chainKey, { tokenSymbol, tokenAddress }),
          spender: resolvedSpender,
          amount
        });
        session.pendingTransaction = plan;
        return serializeErc20ApprovePlan(plan);
      }
    })
  };
}
