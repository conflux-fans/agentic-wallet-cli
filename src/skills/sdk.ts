import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createPublicClient, http, type Address, type Hex } from "viem";
import type { ToolSet } from "ai";
import { z } from "zod";
import type { AddressBook } from "../address-book/index.js";
import type { ChainConfig, ChainKey } from "../chains/index.js";
import type { AgentSession } from "../agent/session.js";
import type { TransactionFlow } from "../agent/session.js";
import type { Logger } from "../logger.js";
import type { TokenRegistry } from "../tokens/index.js";
import { getWhitelistedToken, parseTokenSymbol } from "../tokens/index.js";
import type { WalletContext } from "../wallet/client.js";
import {
  prepareErc20Approve,
  prepareContractCall,
  type ContractCallMetadata,
  type ContractCallPlan,
  type Erc20ApprovePlan,
  type Erc20TokenInput
} from "../wallet/client.js";

export type SkillManifest = {
  name: string;
  version: string;
  description: string;
  enabled: boolean;
  permissions: {
    readRpc?: boolean;
    prepareTransactions?: boolean;
    writeLocalFiles?: boolean;
  };
};

export type WalletSkill = {
  name: string;
  description: string;
  tools: ToolSet;
};

export type SkillContext = {
  wallet: WalletContext;
  chains: Record<ChainKey, ChainConfig>;
  tokens: TokenRegistry;
  addressBook: AddressBook;
  session: AgentSession;
  logger: Logger;
  schemas: {
    chain: z.ZodEnum<{ conflux: "conflux"; monad: "monad" }>;
  };
  rpc: {
    publicClient: (chain: ChainKey) => ReturnType<typeof createPublicClient>;
  };
  token: {
    resolve: (chain: ChainKey, input: { symbol?: string; address?: string }) => {
      address: Address;
      symbol?: string;
      decimals?: number;
    };
  };
  address: {
    resolve: (value: string) => Address | undefined;
  };
  transactions: {
    prepareContractCall: (input: {
      id: string;
      chain: ChainKey;
      protocol: string;
      action: string;
      to: Address;
      value?: bigint;
      data: Hex;
      summary: string[];
      metadata?: ContractCallMetadata;
    }) => Promise<ContractCallPlan>;
    prepareErc20Approve: (input: {
      id: string;
      chain: ChainKey;
      token: Erc20TokenInput;
      spender: Address;
      amount: string;
    }) => Promise<Erc20ApprovePlan>;
    setPending: (plan: ContractCallPlan) => void;
    setPendingFlow: (flow: TransactionFlow) => void;
  };
  config: {
    readJson: <T>(relativePath: string) => T;
  };
};

export function defineSkill(skill: WalletSkill): WalletSkill {
  return skill;
}

export function createSkillContext(input: {
  wallet: WalletContext;
  chains: Record<ChainKey, ChainConfig>;
  tokens: TokenRegistry;
  addressBook: AddressBook;
  session: AgentSession;
  skillDir: string;
}): SkillContext {
  return {
    wallet: input.wallet,
    chains: input.chains,
    tokens: input.tokens,
    addressBook: input.addressBook,
    session: input.session,
    logger: input.wallet.logger,
    schemas: {
      chain: z.enum(["conflux", "monad"])
    },
    rpc: {
      publicClient(chain) {
        const config = input.chains[chain];
        return createPublicClient({
          chain: config.chain,
          transport: http(config.rpcUrl)
        });
      }
    },
    token: {
      resolve(chain, tokenInput) {
        if (tokenInput.address) {
          return { address: parseAddress(tokenInput.address, "token address") };
        }
        if (!tokenInput.symbol) {
          throw new Error("请指定 token symbol 或 token address");
        }
        const symbol = parseTokenSymbol(tokenInput.symbol);
        const token = getWhitelistedToken(input.tokens, chain, symbol);
        if (!token?.address) {
          throw new Error(`${chain} 上的 ${symbol} 未配置 token 地址`);
        }
        return {
          address: token.address,
          symbol: token.symbol,
          decimals: token.decimals
        };
      }
    },
    address: {
      resolve(value) {
        return input.addressBook.resolve(value);
      }
    },
    transactions: {
      prepareContractCall(planInput) {
        return prepareContractCall(input.wallet, planInput);
      },
      prepareErc20Approve(planInput) {
        return prepareErc20Approve(input.wallet, planInput);
      },
      setPending(plan) {
        input.session.pendingTransactionFlow = undefined;
        input.session.pendingTransaction = plan;
      },
      setPendingFlow(flow) {
        input.session.pendingTransaction = undefined;
        input.session.pendingTransactionFlow = flow;
      }
    },
    config: {
      readJson<T>(relativePath: string): T {
        return JSON.parse(
          readFileSync(resolve(input.skillDir, relativePath), "utf8")
        ) as T;
      }
    }
  };
}

function parseAddress(value: string, label: string): Address {
  if (!/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new Error(`${label} 不是合法 EVM 地址`);
  }
  return value as Address;
}
