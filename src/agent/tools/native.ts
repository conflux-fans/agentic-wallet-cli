import { tool } from "ai";
import { randomUUID } from "node:crypto";
import { isAddress } from "viem";
import { z } from "zod";
import type { AddressBook } from "../../address-book/index.js";
import type { AgentSession } from "../session.js";
import type { ChainKey } from "../../chains/index.js";
import {
  getAccountInfo,
  getNativeBalance,
  prepareNativeTransfer,
  type NativeTransferPlan,
  type WalletContext
} from "../../wallet/client.js";

const chainSchema = z.enum(["conflux", "monad"]);

function toChainKey(chain: z.infer<typeof chainSchema>): ChainKey {
  return chain;
}

function serializeNativeTransferPlan(plan: NativeTransferPlan) {
  return {
    id: plan.id,
    kind: plan.kind,
    chain: plan.chain,
    chainName: plan.chainName,
    from: plan.from,
    to: plan.to,
    amount: plan.amount,
    symbol: plan.symbol,
    value: plan.value.toString(),
    estimatedGas: plan.estimatedGas.toString(),
    estimatedFee: plan.estimatedFee.toString()
  };
}

export function createNativeTools(
  ctx: WalletContext,
  session: AgentSession,
  addressBook?: AddressBook
) {
  return {
    getAccountInfo: tool({
      description:
        "查询指定链上的账户信息，包括地址、native 余额和 nonce。address 可选；如果用户没有指定地址，则查询当前钱包账户。",
      inputSchema: z.object({
        chain: chainSchema.describe("链标识，只能是 conflux 或 monad"),
        address: z
          .string()
          .optional()
          .describe("要查询的 EVM 地址；如果省略，则查询当前钱包账户")
      }),
      execute: async ({ chain, address }) => {
        ctx.logger.log("agent tool call", {
          tool: "getAccountInfo",
          input: { chain, address: address ?? ctx.account.address }
        });
        if (address !== undefined && !isAddress(address)) {
          throw new Error("查询地址不是合法 EVM 地址");
        }

        return getAccountInfo(ctx, toChainKey(chain), address);
      }
    }),
    getNativeBalance: tool({
      description:
        "查询指定链上的 native 资产余额。address 可选；如果用户没有指定地址，则查询当前钱包账户。",
      inputSchema: z.object({
        chain: chainSchema.describe("链标识，只能是 conflux 或 monad"),
        address: z
          .string()
          .optional()
          .describe("要查询的 EVM 地址；如果省略，则查询当前钱包账户")
      }),
      execute: async ({ chain, address }) => {
        ctx.logger.log("agent tool call", {
          tool: "getNativeBalance",
          input: { chain, address: address ?? ctx.account.address }
        });
        if (address !== undefined && !isAddress(address)) {
          throw new Error("查询地址不是合法 EVM 地址");
        }

        return getNativeBalance(ctx, toChainKey(chain), address);
      }
    }),
    prepareNativeTransfer: tool({
      description:
        "准备 native 资产转账交易。这个工具只生成待确认交易计划，不会签名或发送交易。",
      inputSchema: z.object({
        chain: chainSchema.describe("链标识，只能是 conflux 或 monad"),
        to: z.string().describe("接收方 EVM 地址或地址簿联系人名称"),
        amount: z.string().describe("转账数量，十进制字符串，例如 0.1")
      }),
      execute: async ({ chain, to, amount }) => {
        const resolvedTo = addressBook?.resolve(to) ?? to;
        ctx.logger.log("agent tool call", {
          tool: "prepareNativeTransfer",
          input: { chain, to, resolvedTo, amount }
        });
        if (!isAddress(resolvedTo)) {
          throw new Error("接收方地址不是合法 EVM 地址");
        }

        const plan = await prepareNativeTransfer(ctx, {
          id: randomUUID(),
          chain: toChainKey(chain),
          to: resolvedTo,
          amount
        });
        session.pendingTransaction = plan;
        return serializeNativeTransferPlan(plan);
      }
    })
  };
}
