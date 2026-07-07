import { formatUnits } from "viem";
import type { TransactionPlan } from "../wallet/client.js";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AgentSession = {
  messages: ChatMessage[];
  pendingTransaction?: TransactionPlan;
  pendingTransactionFlow?: TransactionFlow;
};

export type TransactionFlow = {
  id: string;
  title: string;
  steps: TransactionFlowStep[];
  currentStepIndex: number;
  completedSteps: TransactionFlowStepResult[];
};

export type TransactionFlowStep =
  | {
      kind: "prepared";
      title: string;
      plan: TransactionPlan;
    }
  | {
      kind: "deferred";
      title: string;
      prepare: () => Promise<TransactionPlan>;
      plan?: TransactionPlan;
    };

export type TransactionFlowStepResult = {
  stepIndex: number;
  hash: string;
  status: "success" | "reverted" | "pending" | "unknown";
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
  if (plan.kind === "contract-call") {
    return [
      "即将执行合约调用：",
      `链：${plan.chainName}`,
      `协议：${plan.protocol}`,
      `操作：${plan.action}`,
      `发送方：${plan.from}`,
      `合约：${plan.to}`,
      ...plan.summary,
      `Value：${formatNativeTransactionAmount(plan.nativeSymbol, plan.value)}`,
      `预估 gas：${plan.estimatedGas.toString()}`,
      `预估费用：${formatNativeTransactionAmount(plan.nativeSymbol, plan.estimatedFee)}`,
      "",
      "确认发送吗？输入“确认”发送，或输入“取消”放弃。"
    ].join("\n");
  }

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
      `预估费用：${formatNativeTransactionAmount(plan.nativeSymbol, plan.estimatedFee)}`,
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
      `预估费用：${formatNativeTransactionAmount(plan.nativeSymbol, plan.estimatedFee)}`,
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
    `预估费用：${formatNativeTransactionAmount(plan.nativeSymbol, plan.estimatedFee)}`,
    "",
    "确认发送吗？输入“确认”发送，或输入“取消”放弃。"
  ].join("\n");
}

export function formatTransactionFlow(flow: TransactionFlow): string {
  const step = getPreparedFlowStepPlan(flow);
  return [
    "即将执行多步操作：",
    `标题：${flow.title}`,
    `步骤：${flow.steps.length}`,
    `当前步骤：${flow.currentStepIndex + 1}/${flow.steps.length}`,
    "",
    formatTransactionPlan(step).replace("确认发送吗？输入“确认”发送，或输入“取消”放弃。", `确认发送第 ${flow.currentStepIndex + 1} 步吗？输入“确认”发送，或输入“取消”放弃整个多步操作。`)
  ].join("\n");
}

export function formatNextTransactionFlowStep(flow: TransactionFlow): string {
  const step = getPreparedFlowStepPlan(flow);
  return [
    `下一步：${flow.currentStepIndex + 1}/${flow.steps.length}`,
    "",
    formatTransactionPlan(step).replace("确认发送吗？输入“确认”发送，或输入“取消”放弃。", `确认发送第 ${flow.currentStepIndex + 1} 步吗？输入“确认”发送，或输入“取消”放弃整个多步操作。`)
  ].join("\n");
}

export async function ensureCurrentFlowStepPrepared(flow: TransactionFlow): Promise<TransactionPlan> {
  const step = flow.steps[flow.currentStepIndex];
  if (!step) {
    throw new Error("多步操作当前步骤不存在");
  }
  if (step.kind === "prepared") {
    return step.plan;
  }
  if (!step.plan) {
    step.plan = await step.prepare();
  }
  return step.plan;
}

function getPreparedFlowStepPlan(flow: TransactionFlow): TransactionPlan {
  const step = flow.steps[flow.currentStepIndex];
  if (!step) {
    throw new Error("多步操作当前步骤不存在");
  }
  if (step.kind === "prepared") {
    return step.plan;
  }
  if (!step.plan) {
    throw new Error("多步操作当前步骤尚未准备完成");
  }
  return step.plan;
}

export function formatTransactionFlowCompleted(flow: TransactionFlow): string {
  return [
    "多步操作已完成：",
    `标题：${flow.title}`,
    ...flow.completedSteps.map(
      (step) => `步骤 ${step.stepIndex + 1}：${formatFlowStepStatus(step.status)} ${step.hash}`
    )
  ].join("\n");
}

function formatFlowStepStatus(status: "success" | "reverted" | "pending" | "unknown") {
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

function formatNativeTransactionAmount(symbol: string, value: bigint): string {
  return `${padNativeDecimals(formatUnits(value, 18))} ${symbol}`;
}

function padNativeDecimals(value: string): string {
  const [integer, decimals = ""] = value.split(".");
  const trimmedDecimals = decimals.replace(/0+$/, "");
  return `${integer}.${trimmedDecimals.padEnd(6, "0")}`;
}
