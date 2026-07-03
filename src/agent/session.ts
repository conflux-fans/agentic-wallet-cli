import type { TransactionPlan } from "../wallet/client.js";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AgentSession = {
  messages: ChatMessage[];
  pendingTransaction?: TransactionPlan;
};

export const MAX_SESSION_MESSAGES = 20;

export function createAgentSession(): AgentSession {
  return {
    messages: []
  };
}

export function clearSessionMessages(session: AgentSession): void {
  session.messages = [];
}

export function pruneSessionMessages(session: AgentSession): void {
  if (session.messages.length <= MAX_SESSION_MESSAGES) {
    return;
  }

  session.messages = session.messages.slice(-MAX_SESSION_MESSAGES);
}

export function isConfirmInput(input: string): boolean {
  return /^(y|yes|确认|确定|发送|执行|ok)$/i.test(input.trim());
}

export function isCancelInput(input: string): boolean {
  return /^(n|no|取消|不要|否|cancel)$/i.test(input.trim());
}

export function isClearInput(input: string): boolean {
  return /^(clear|reset|清空|重置|清除上下文|清空上下文|重置上下文)$/i.test(input.trim());
}

export function formatTransactionPlan(plan: TransactionPlan): string {
  if (plan.kind === "erc20-transfer") {
    return [
      "即将执行 ERC20 转账：",
      `链：${plan.chainName}`,
      `Token：${plan.tokenSymbol}`,
      `Token 地址：${plan.tokenAddress}`,
      `发送方：${plan.from}`,
      `接收方：${plan.to}`,
      `数量：${plan.amount} ${plan.tokenSymbol}`,
      `预估 gas：${plan.estimatedGas.toString()}`,
      `预估费用：${plan.estimatedFee.toString()} wei`,
      "",
      "确认发送吗？输入“确认”发送，或输入“取消”放弃。"
    ].join("\n");
  }

  if (plan.kind === "erc20-approve") {
    return [
      "即将执行 ERC20 Approve：",
      `链：${plan.chainName}`,
      `Token：${plan.tokenSymbol}`,
      `Token 地址：${plan.tokenAddress}`,
      `授权方：${plan.owner}`,
      `Spender：${plan.spender}`,
      `数量：${plan.amount} ${plan.tokenSymbol}`,
      `预估 gas：${plan.estimatedGas.toString()}`,
      `预估费用：${plan.estimatedFee.toString()} wei`,
      "",
      "确认发送吗？输入“确认”发送，或输入“取消”放弃。"
    ].join("\n");
  }

  return [
    "即将执行 native 转账：",
    `链：${plan.chainName}`,
    `发送方：${plan.from}`,
    `接收方：${plan.to}`,
    `数量：${plan.amount} ${plan.symbol}`,
    `预估 gas：${plan.estimatedGas.toString()}`,
    `预估费用：${plan.estimatedFee.toString()} wei`,
    "",
    "确认发送吗？输入“确认”发送，或输入“取消”放弃。"
  ].join("\n");
}
