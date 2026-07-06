import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText, isStepCount, type ModelMessage } from "ai";
import type { WalletContext } from "../wallet/client.js";
import { sendPreparedTransaction } from "../wallet/client.js";
import type { TokenRegistry } from "../tokens/index.js";
import type { AddressBook } from "../address-book/index.js";
import type { ChainConfig, ChainKey } from "../chains/index.js";
import {
  clearSessionMessages,
  formatNextTransactionFlowStep,
  formatTransactionFlow,
  formatTransactionFlowCompleted,
  formatTransactionPlan,
  ensureCurrentFlowStepPrepared,
  isCancelInput,
  isClearInput,
  isConfirmInput,
  pruneSessionMessages,
  type AgentSession
} from "./session.js";
import { createNativeTools } from "./tools/native.js";
import { createTokenTools } from "./tools/tokens.js";
import { createErc20Tools } from "./tools/erc20.js";
import { createAddressBookTools } from "./tools/address-book.js";
import { createHistoryTools } from "./tools/history.js";
import { loadEnabledSkills } from "../skills/loader.js";
import type { ScanApiConfig } from "../history/index.js";

export type AgentConfig = {
  openRouterApiKey: string;
  openRouterModel: string;
};

export async function handleUserInput(
  input: string,
  config: AgentConfig,
  wallet: WalletContext,
  tokens: TokenRegistry,
  chains: Record<ChainKey, ChainConfig>,
  addressBook: AddressBook,
  scanApis: ScanApiConfig,
  session: AgentSession
): Promise<string> {
  if (isClearInput(input)) {
    if (session.pendingTransaction || session.pendingTransactionFlow) {
      return "当前有一笔交易等待确认。请先输入“确认”发送，或输入“取消”放弃，然后再清空上下文。";
    }

    clearSessionMessages(session);
    return "已清空对话上下文。";
  }

  if (session.pendingTransactionFlow) {
    if (isConfirmInput(input)) {
      const flow = session.pendingTransactionFlow;
      const stepIndex = flow.currentStepIndex;
      const plan = await ensureCurrentFlowStepPrepared(flow);
      const result = await sendPreparedTransaction(wallet, plan);
      flow.completedSteps.push({
        stepIndex,
        hash: result.hash,
        status: result.status
      });

      const lines = formatSentTransactionResult(result);
      if (result.status !== "success") {
        session.pendingTransactionFlow = undefined;
        return [
          ...lines,
          "",
          `多步操作已停止：第 ${stepIndex + 1}/${flow.steps.length} 步未成功，后续步骤不会继续执行。`
        ].join("\n");
      }

      flow.currentStepIndex += 1;
      if (flow.currentStepIndex >= flow.steps.length) {
        session.pendingTransactionFlow = undefined;
        return [...lines, "", formatTransactionFlowCompleted(flow)].join("\n");
      }

      await ensureCurrentFlowStepPrepared(flow);
      return [...lines, "", formatNextTransactionFlowStep(flow)].join("\n");
    }

    if (isCancelInput(input)) {
      session.pendingTransactionFlow = undefined;
      return "已取消多步操作。已发送成功的步骤不会回滚，未发送的后续步骤不会继续执行。";
    }

    return "当前有一个多步操作等待确认。请输入“确认”发送当前步骤，或输入“取消”放弃后续步骤。";
  }

  if (session.pendingTransaction) {
    if (isConfirmInput(input)) {
      const plan = session.pendingTransaction;
      session.pendingTransaction = undefined;
      const result = await sendPreparedTransaction(wallet, plan);
      return formatSentTransactionResult(result).join("\n");
    }

    if (isCancelInput(input)) {
      session.pendingTransaction = undefined;
      return "已取消待确认交易。";
    }

    return "当前有一笔交易等待确认。请输入“确认”发送，或输入“取消”放弃。";
  }

  session.messages.push({ role: "user", content: input });
  pruneSessionMessages(session);

  const openrouter = createOpenAICompatible({
    name: "openrouter",
    apiKey: config.openRouterApiKey,
    baseURL: "https://openrouter.ai/api/v1"
  });
  const enabledSkills = loadEnabledSkills({
    wallet,
    chains,
    tokens,
    addressBook,
    session
  });
  const skillTools = Object.assign({}, ...enabledSkills.map((skill) => skill.tools));
  const skillDescriptions = enabledSkills.map(
    (skill) => `- ${skill.name}: ${skill.description}`
  );

  const systemPrompt = [
    "你是一个 Agentic EVM Wallet 的命令行助手。",
    `当前支持的链：${Object.values(chains).map((c) => `${c.displayName}(${c.key})`).join("、")}。`,
    "当前支持 native 资产余额、nonce 查询，以及 native 转账准备。",
    "ERC20 支持 token 白名单查询、余额查询、allowance 查询、approve 准备和 transfer 准备。",
    "ERC20 token 列表支持查询、增加、删除、修改；内置 token 包括 USDT 和 USDC；也支持用户直接指定 ERC20 token 地址。",
    "支持地址簿，可以查询、增加、删除、修改联系人；转账和 approve 时可以使用地址簿联系人名称。",
    "支持查询 native 转账历史和 ERC20 Transfer 历史；native 历史依赖 scan API，ERC20 历史通过 RPC logs 查询。",
    "支持由工具自动生成的多步交易 flow，例如 approve + swap；多步 flow 每一步发送前都必须由用户确认。",
    "native 余额查询支持当前钱包地址，也支持用户指定的任意 EVM 地址。",
    "账户信息和 nonce 查询支持当前钱包地址，也支持用户指定的任意 EVM 地址。",
    ...(skillDescriptions.length > 0 ? ["已启用 skills:", ...skillDescriptions] : []),
    "如果用户请求未启用的协议、LayerZero、交易历史，请说明第一版暂不支持。",
    "当用户信息缺失时，必须通过自然语言追问，不要猜测。",
    "转账前只能调用 prepareNativeTransfer 生成交易计划，不能声称交易已经发送。",
    "所有回复使用简洁中文。"
  ].join("\n");
  const modelMessages = session.messages.map((message): ModelMessage => message);

  const startedAt = Date.now();
  wallet.logger.log("llm call start", {
    provider: "openrouter",
    model: config.openRouterModel,
    messageCount: modelMessages.length,
    tools: [
      "getAccountInfo",
      "getNativeBalance",
      "prepareNativeTransfer",
      "getWhitelistedTokens",
      "addWhitelistedToken",
      "updateWhitelistedToken",
      "removeWhitelistedToken",
      "getErc20Balance",
      "getErc20Allowance",
      "prepareErc20Transfer",
      "prepareErc20Approve",
      "listAddressBookEntries",
      "getAddressBookEntry",
      "addAddressBookEntry",
      "updateAddressBookEntry",
      "removeAddressBookEntry",
      "getNativeTransferHistory",
      "getErc20TransferHistory",
      ...Object.keys(skillTools)
    ],
    prompt: {
      system: systemPrompt,
      messages: modelMessages
    }
  });

  const result = await generateText({
    model: openrouter.chatModel(config.openRouterModel),
    system: systemPrompt,
    messages: modelMessages,
    tools: {
      ...createNativeTools(wallet, session, addressBook),
      ...createTokenTools(tokens, chains, wallet.logger),
      ...createErc20Tools(wallet, tokens, session, addressBook),
      ...createAddressBookTools(addressBook, wallet.logger),
      ...createHistoryTools(wallet, tokens, scanApis),
      ...skillTools
    },
    stopWhen: isStepCount(4)
  });
  wallet.logger.log("llm call end", {
    provider: "openrouter",
    model: config.openRouterModel,
    durationMs: Date.now() - startedAt,
    usage: result.usage
  });

  let response = result.text.trim();
  if (session.pendingTransactionFlow) {
    response = formatTransactionFlow(session.pendingTransactionFlow);
  } else if (session.pendingTransaction) {
    response = formatTransactionPlan(session.pendingTransaction);
  }

  session.messages.push({ role: "assistant", content: response });
  pruneSessionMessages(session);
  return response;
}

function formatSentTransactionResult(result: Awaited<ReturnType<typeof sendPreparedTransaction>>): string[] {
  const lines = [
    `交易已发送：${result.hash}`,
    `链：${result.chainName}`,
    `状态：${formatTransactionStatus(result.status)}`
  ];
  if (result.blockNumber !== undefined) {
    lines.push(`区块：${result.blockNumber.toString()}`);
  }
  if (result.gasUsed !== undefined) {
    lines.push(`Gas Used：${result.gasUsed.toString()}`);
  }
  if (result.details) {
    lines.push(...result.details);
  }
  if (result.explorerUrl) {
    lines.push(`浏览器：${result.explorerUrl}`);
  }
  if (result.receiptError) {
    lines.push(`Receipt：等待确认失败或超时，交易可能仍在链上处理中`);
  }
  return lines;
}

function formatTransactionStatus(status: "success" | "reverted" | "pending" | "unknown") {
  if (status === "success") {
    return "成功";
  }
  if (status === "reverted") {
    return "失败(reverted)";
  }
  if (status === "pending") {
    return "等待确认";
  }
  return "未知";
}
