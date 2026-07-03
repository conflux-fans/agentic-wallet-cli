import "dotenv/config";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText, isStepCount, tool, type ModelMessage } from "ai";
import { z } from "zod";

type ToolName =
  | "getAccountInfo"
  | "getNativeBalance"
  | "prepareNativeTransfer"
  | "getWhitelistedTokens"
  | "getErc20Balance"
  | "getErc20Allowance"
  | "prepareErc20Transfer"
  | "prepareErc20Approve";

type EvalCase = {
  id: string;
  category: string;
  input: string;
  expect: {
    tools?: ToolName[];
    noTool?: boolean;
    textIncludesAny?: string[];
  };
};

const systemPrompt = [
  "你是一个 Agentic EVM Wallet 的命令行助手。",
  "当前只支持 Conflux eSpace(conflux) 和 Monad(monad)。",
  "当前支持 native 资产余额、nonce 查询，以及 native 转账准备。",
  "ERC20 支持 token 白名单查询、余额查询、allowance 查询、approve 准备和 transfer 准备。",
  "ERC20 白名单 token 是 USDT 和 USDC；也支持用户直接指定 ERC20 token 地址。",
  "native 余额查询支持当前钱包地址，也支持用户指定的任意 EVM 地址。",
  "账户信息和 nonce 查询支持当前钱包地址，也支持用户指定的任意 EVM 地址。",
  "如果用户请求 Uniswap、LayerZero、交易历史或地址簿，请说明第一版暂不支持。",
  "当用户信息缺失时，必须通过自然语言追问，不要猜测。",
  "转账前只能调用 prepareNativeTransfer 生成交易计划，不能声称交易已经发送。",
  "ERC20 transfer 前只能调用 prepareErc20Transfer 生成交易计划，不能声称交易已经发送。",
  "ERC20 approve 前只能调用 prepareErc20Approve 生成交易计划，不能声称交易已经发送。",
  "所有回复使用简洁中文。"
].join("\n");

const cases: EvalCase[] = [
  {
    id: "native-balance-self-zh",
    category: "native balance",
    input: "查一下我在 Conflux eSpace 的余额",
    expect: { tools: ["getNativeBalance"] }
  },
  {
    id: "account-info-self-zh",
    category: "account info",
    input: "查看我在 Monad 上的钱包信息",
    expect: { tools: ["getAccountInfo"] }
  },
  {
    id: "nonce-self-zh",
    category: "nonce",
    input: "查询我在 conflux 的 nonce",
    expect: { tools: ["getAccountInfo"] }
  },
  {
    id: "native-balance-address-zh",
    category: "native balance",
    input: "查一下 0x0000000000000000000000000000000000000000 在 Monad 上的余额",
    expect: { tools: ["getNativeBalance"] }
  },
  {
    id: "nonce-address-en",
    category: "nonce",
    input: "Show the nonce of 0x0000000000000000000000000000000000000000 on Conflux eSpace.",
    expect: { tools: ["getAccountInfo"] }
  },
  {
    id: "token-whitelist-zh",
    category: "token whitelist",
    input: "Monad 支持哪些 token？",
    expect: { tools: ["getWhitelistedTokens"] }
  },
  {
    id: "token-whitelist-en",
    category: "token whitelist",
    input: "What ERC20 tokens are whitelisted on Conflux?",
    expect: { tools: ["getWhitelistedTokens"] }
  },
  {
    id: "erc20-balance-self-zh",
    category: "erc20 balance",
    input: "查一下我在 Conflux eSpace 的 USDT 余额",
    expect: { tools: ["getErc20Balance"] }
  },
  {
    id: "erc20-balance-address-en",
    category: "erc20 balance",
    input:
      "What is the USDT balance of 0x0000000000000000000000000000000000000000 on Conflux eSpace?",
    expect: { tools: ["getErc20Balance"] }
  },
  {
    id: "erc20-balance-token-address-zh",
    category: "erc20 balance",
    input: "查询我在 Monad 上 0x754704Bc059F8C67012fEd69BC8A327a5aafb603 这个 token 的余额",
    expect: { tools: ["getErc20Balance"] }
  },
  {
    id: "allowance-self-zh",
    category: "erc20 allowance",
    input: "查一下我在 Conflux eSpace 上给 0x0000000000000000000000000000000000000000 的 USDT 授权额度",
    expect: { tools: ["getErc20Allowance"] }
  },
  {
    id: "allowance-owner-spender-en",
    category: "erc20 allowance",
    input:
      "How much USDC has 0x1111111111111111111111111111111111111111 approved to 0x2222222222222222222222222222222222222222 on Monad?",
    expect: { tools: ["getErc20Allowance"] }
  },
  {
    id: "native-transfer-zh",
    category: "native transfer",
    input: "在 Conflux eSpace 转 0.1 CFX 给 0x0000000000000000000000000000000000000000",
    expect: { tools: ["prepareNativeTransfer"] }
  },
  {
    id: "native-transfer-en",
    category: "native transfer",
    input: "Send 0.01 MON to 0x0000000000000000000000000000000000000000 on Monad.",
    expect: { tools: ["prepareNativeTransfer"] }
  },
  {
    id: "erc20-transfer-zh",
    category: "erc20 transfer",
    input: "在 Conflux eSpace 转 10 USDT 给 0x0000000000000000000000000000000000000000",
    expect: { tools: ["prepareErc20Transfer"] }
  },
  {
    id: "erc20-transfer-en",
    category: "erc20 transfer",
    input: "Transfer 1.5 USDC to 0x0000000000000000000000000000000000000000 on Monad.",
    expect: { tools: ["prepareErc20Transfer"] }
  },
  {
    id: "erc20-transfer-token-address-zh",
    category: "erc20 transfer",
    input:
      "在 Conflux 上把 2 个 0xaf37e8b6c9ed7f6318979f56fc287d76c30847ff 转给 0x0000000000000000000000000000000000000000",
    expect: { tools: ["prepareErc20Transfer"] }
  },
  {
    id: "erc20-approve-zh",
    category: "erc20 approve",
    input: "在 Conflux eSpace 授权 0x0000000000000000000000000000000000000000 使用 100 USDT",
    expect: { tools: ["prepareErc20Approve"] }
  },
  {
    id: "erc20-approve-en",
    category: "erc20 approve",
    input: "Allow 0x0000000000000000000000000000000000000000 to spend 10 USDC on Monad.",
    expect: { tools: ["prepareErc20Approve"] }
  },
  {
    id: "mixed-language-balance",
    category: "mixed language",
    input: "帮我 check 一下 Monad 上的 USDT balance",
    expect: { tools: ["getErc20Balance"] }
  },
  {
    id: "mixed-language-approve",
    category: "mixed language",
    input: "在 Monad approve 10 USDC to 0x0000000000000000000000000000000000000000",
    expect: { tools: ["prepareErc20Approve"] }
  },
  {
    id: "missing-chain-balance",
    category: "follow-up required",
    input: "查一下我的余额",
    expect: { noTool: true, textIncludesAny: ["哪条链", "Conflux", "Monad", "链"] }
  },
  {
    id: "missing-token-approve",
    category: "follow-up required",
    input: "给 0x0000000000000000000000000000000000000000 授权 100",
    expect: { noTool: true, textIncludesAny: ["token", "USDT", "USDC", "哪条链", "链"] }
  },
  {
    id: "missing-recipient-transfer",
    category: "follow-up required",
    input: "Send 10 USDT.",
    expect: { noTool: true, textIncludesAny: ["地址", "recipient", "接收", "to"] }
  },
  {
    id: "missing-spender-approve-en",
    category: "follow-up required",
    input: "Approve 100 USDC.",
    expect: { noTool: true, textIncludesAny: ["spender", "地址", "授权给", "哪条链"] }
  },
  {
    id: "unsupported-btc",
    category: "unsupported",
    input: "查一下我的 BTC 余额",
    expect: { noTool: true, textIncludesAny: ["不支持", "EVM", "BTC"] }
  },
  {
    id: "unsupported-swap",
    category: "unsupported",
    input: "在 Conflux 上 swap 10 USDT 成 CFX",
    expect: { noTool: true, textIncludesAny: ["不支持", "swap", "Uniswap"] }
  },
  {
    id: "unsupported-bridge",
    category: "unsupported",
    input: "把 10 USDT 从 Conflux 跨链到 Monad",
    expect: { noTool: true, textIncludesAny: ["不支持", "跨链", "LayerZero"] }
  },
  {
    id: "unsupported-history",
    category: "unsupported",
    input: "查询我的交易历史",
    expect: { noTool: true, textIncludesAny: ["不支持", "交易历史"] }
  },
  {
    id: "unsupported-address-book",
    category: "unsupported",
    input: "转 1 USDT 给 Alice",
    expect: { noTool: true, textIncludesAny: ["地址", "Alice", "地址簿"] }
  },
  {
    id: "unsupported-chain",
    category: "unsupported",
    input: "查询 Ethereum 上的 USDC 余额",
    expect: { noTool: true, textIncludesAny: ["Conflux", "Monad", "不支持"] }
  }
];

async function main() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENROUTER_API_KEY");
  }

  const model = process.env.OPENROUTER_MODEL ?? "qwen/qwen3.7-plus";
  const openrouter = createOpenAICompatible({
    name: "openrouter",
    apiKey,
    baseURL: "https://openrouter.ai/api/v1"
  });

  let passed = 0;
  const failures: Array<{ id: string; reason: string; text: string; tools: string[] }> = [];

  for (const testCase of cases) {
    const toolCalls: string[] = [];
    const result = await generateText({
      model: openrouter.chatModel(model),
      system: systemPrompt,
      messages: [{ role: "user", content: testCase.input }] satisfies ModelMessage[],
      tools: createMockTools(toolCalls),
      stopWhen: isStepCount(4)
    });

    const actualTools = [...new Set(toolCalls)];
    const reason = evaluateCase(testCase, actualTools, result.text);
    if (reason === undefined) {
      passed += 1;
      console.log(`PASS ${testCase.id}`);
    } else {
      failures.push({ id: testCase.id, reason, text: result.text, tools: actualTools });
      console.log(`FAIL ${testCase.id}: ${reason}`);
      console.log(`  tools: ${actualTools.join(", ") || "(none)"}`);
      console.log(`  text: ${result.text.replace(/\s+/g, " ").slice(0, 240)}`);
    }
  }

  console.log("");
  console.log(`Result: ${passed}/${cases.length} passed`);

  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

function evaluateCase(testCase: EvalCase, actualTools: string[], text: string): string | undefined {
  if (testCase.expect.noTool && actualTools.length > 0) {
    return `expected no tool calls, got ${actualTools.join(", ")}`;
  }

  for (const expectedTool of testCase.expect.tools ?? []) {
    if (!actualTools.includes(expectedTool)) {
      return `expected tool ${expectedTool}, got ${actualTools.join(", ") || "(none)"}`;
    }
  }

  if (testCase.expect.textIncludesAny) {
    const normalizedText = text.toLowerCase();
    const matched = testCase.expect.textIncludesAny.some((item) =>
      normalizedText.includes(item.toLowerCase())
    );
    if (!matched) {
      return `expected response to include one of: ${testCase.expect.textIncludesAny.join(", ")}`;
    }
  }

  return undefined;
}

function createMockTools(toolCalls: string[]) {
  const chainSchema = z.enum(["conflux", "monad"]);
  const tokenSymbolSchema = z.enum(["USDT", "USDC"]).optional();
  const addressSchema = z.string();

  return {
    getAccountInfo: tool({
      description:
        "查询指定链上的账户信息，包括地址、native 余额和 nonce。address 可选；如果用户没有指定地址，则查询当前钱包账户。",
      inputSchema: z.object({
        chain: chainSchema,
        address: addressSchema.optional()
      }),
      execute: async (input) => {
        toolCalls.push("getAccountInfo");
        return {
          address: input.address ?? "0x1111111111111111111111111111111111111111",
          chain: input.chain,
          chainName: input.chain === "conflux" ? "Conflux eSpace" : "Monad",
          balance: "1.2345",
          symbol: input.chain === "conflux" ? "CFX" : "MON",
          nonce: 7
        };
      }
    }),
    getNativeBalance: tool({
      description:
        "查询指定链上的 native 资产余额。address 可选；如果用户没有指定地址，则查询当前钱包账户。",
      inputSchema: z.object({
        chain: chainSchema,
        address: addressSchema.optional()
      }),
      execute: async (input) => {
        toolCalls.push("getNativeBalance");
        return {
          address: input.address ?? "0x1111111111111111111111111111111111111111",
          chain: input.chain,
          chainName: input.chain === "conflux" ? "Conflux eSpace" : "Monad",
          balance: "1.2345",
          symbol: input.chain === "conflux" ? "CFX" : "MON"
        };
      }
    }),
    prepareNativeTransfer: tool({
      description:
        "准备 native 资产转账交易。这个工具只生成待确认交易计划，不会签名或发送交易。",
      inputSchema: z.object({
        chain: chainSchema,
        to: addressSchema,
        amount: z.string()
      }),
      execute: async (input) => {
        toolCalls.push("prepareNativeTransfer");
        return {
          id: "mock-native-transfer",
          kind: "native-transfer",
          chain: input.chain,
          to: input.to,
          amount: input.amount
        };
      }
    }),
    getWhitelistedTokens: tool({
      description:
        "查询指定链当前白名单支持的 ERC20 token。当前白名单 token 是 USDT 和 USDC。",
      inputSchema: z.object({
        chain: chainSchema
      }),
      execute: async (input) => {
        toolCalls.push("getWhitelistedTokens");
        return {
          chain: input.chain,
          tokens: ["USDT", "USDC"]
        };
      }
    }),
    getErc20Balance: tool({
      description:
        "查询 ERC20 token 余额。可使用白名单 tokenSymbol(USDT/USDC)，也可直接指定 tokenAddress。address 可选，默认当前钱包地址。",
      inputSchema: z.object({
        chain: chainSchema,
        tokenSymbol: tokenSymbolSchema,
        tokenAddress: addressSchema.optional(),
        address: addressSchema.optional()
      }),
      execute: async (input) => {
        toolCalls.push("getErc20Balance");
        return {
          address: input.address ?? "0x1111111111111111111111111111111111111111",
          chain: input.chain,
          tokenSymbol: input.tokenSymbol ?? "ERC20",
          tokenAddress: input.tokenAddress ?? "0x9999999999999999999999999999999999999999",
          balance: "12.3456"
        };
      }
    }),
    getErc20Allowance: tool({
      description:
        "查询 ERC20 allowance/approve 授权额度。owner 可选，默认当前钱包地址；spender 必填。",
      inputSchema: z.object({
        chain: chainSchema,
        tokenSymbol: tokenSymbolSchema,
        tokenAddress: addressSchema.optional(),
        owner: addressSchema.optional(),
        spender: addressSchema
      }),
      execute: async (input) => {
        toolCalls.push("getErc20Allowance");
        return {
          owner: input.owner ?? "0x1111111111111111111111111111111111111111",
          spender: input.spender,
          chain: input.chain,
          tokenSymbol: input.tokenSymbol ?? "ERC20",
          allowance: "10"
        };
      }
    }),
    prepareErc20Transfer: tool({
      description:
        "准备 ERC20 token 转账交易。只生成待确认交易计划，不会签名或发送。",
      inputSchema: z.object({
        chain: chainSchema,
        tokenSymbol: tokenSymbolSchema,
        tokenAddress: addressSchema.optional(),
        to: addressSchema,
        amount: z.string()
      }),
      execute: async (input) => {
        toolCalls.push("prepareErc20Transfer");
        return {
          id: "mock-erc20-transfer",
          kind: "erc20-transfer",
          chain: input.chain,
          tokenSymbol: input.tokenSymbol ?? "ERC20",
          tokenAddress: input.tokenAddress ?? "0x9999999999999999999999999999999999999999",
          to: input.to,
          amount: input.amount
        };
      }
    }),
    prepareErc20Approve: tool({
      description:
        "准备 ERC20 approve 授权交易。只生成待确认交易计划，不会签名或发送。",
      inputSchema: z.object({
        chain: chainSchema,
        tokenSymbol: tokenSymbolSchema,
        tokenAddress: addressSchema.optional(),
        spender: addressSchema,
        amount: z.string()
      }),
      execute: async (input) => {
        toolCalls.push("prepareErc20Approve");
        return {
          id: "mock-erc20-approve",
          kind: "erc20-approve",
          chain: input.chain,
          tokenSymbol: input.tokenSymbol ?? "ERC20",
          tokenAddress: input.tokenAddress ?? "0x9999999999999999999999999999999999999999",
          spender: input.spender,
          amount: input.amount
        };
      }
    })
  };
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
