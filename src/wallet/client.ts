import {
  encodeFunctionData,
  createPublicClient,
  createWalletClient,
  formatEther,
  formatUnits,
  http,
  parseEther,
  parseUnits,
  type Address,
  type Chain,
  type Hex
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { ChainConfig, ChainKey } from "../chains/index.js";
import { createLogger, redactUrl, type Logger } from "../logger.js";

export type WalletContext = {
  account: ReturnType<typeof privateKeyToAccount>;
  chains: Record<ChainKey, ChainConfig>;
  logger: Logger;
};

const erc20Abi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" }
    ],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: [{ name: "", type: "bool" }]
  },
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: [{ name: "", type: "bool" }]
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }]
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }]
  }
] as const;

export type NativeTransferPlan = {
  id: string;
  kind: "native-transfer";
  chain: ChainKey;
  chainName: string;
  from: Address;
  to: Address;
  amount: string;
  symbol: string;
  value: bigint;
  estimatedGas: bigint;
  estimatedFee: bigint;
};

export type Erc20TransferPlan = {
  id: string;
  kind: "erc20-transfer";
  chain: ChainKey;
  chainName: string;
  from: Address;
  tokenAddress: Address;
  tokenSymbol: string;
  tokenDecimals: number;
  to: Address;
  amount: string;
  rawAmount: bigint;
  estimatedGas: bigint;
  estimatedFee: bigint;
};

export type Erc20ApprovePlan = {
  id: string;
  kind: "erc20-approve";
  chain: ChainKey;
  chainName: string;
  owner: Address;
  tokenAddress: Address;
  tokenSymbol: string;
  tokenDecimals: number;
  spender: Address;
  amount: string;
  rawAmount: bigint;
  estimatedGas: bigint;
  estimatedFee: bigint;
};

export type TransactionPlan = NativeTransferPlan | Erc20TransferPlan | Erc20ApprovePlan;

export type Erc20TokenInput = {
  address: Address;
  symbol?: string;
  decimals?: number;
};

export type SentTransactionResult = {
  hash: Hex;
  chain: ChainKey;
  chainName: string;
  status: "success" | "reverted" | "pending" | "unknown";
  blockNumber?: bigint;
  gasUsed?: bigint;
  explorerUrl?: string;
  receiptError?: string;
};

export function createWalletContext(
  privateKey: Hex,
  chains: Record<ChainKey, ChainConfig>,
  logger: Logger = createLogger(false)
): WalletContext {
  return {
    account: privateKeyToAccount(privateKey),
    chains,
    logger
  };
}

export function getPublicClient(config: ChainConfig) {
  return createPublicClient({
    chain: config.chain,
    transport: http(config.rpcUrl)
  });
}

export function getWalletClient(config: ChainConfig, account: WalletContext["account"]) {
  return createWalletClient({
    account,
    chain: config.chain,
    transport: http(config.rpcUrl)
  });
}

export function formatNativeAmount(value: bigint): string {
  return truncateDecimalString(formatEther(value));
}

export function formatTokenAmount(value: bigint, decimals: number): string {
  return truncateDecimalString(formatUnits(value, decimals));
}

function truncateDecimalString(formatted: string): string {
  const [integer, decimals] = formatted.split(".");
  if (!decimals) {
    return integer;
  }

  const truncatedDecimals = decimals.slice(0, 4).replace(/0+$/, "");
  return truncatedDecimals ? `${integer}.${truncatedDecimals}` : integer;
}

export async function getAccountInfo(
  ctx: WalletContext,
  chainKey: ChainKey,
  address: Address = ctx.account.address
) {
  const config = ctx.chains[chainKey];
  const publicClient = getPublicClient(config);
  ctx.logger.log("web3 rpc batch", {
    chain: config.displayName,
    endpoint: redactUrl(config.rpcUrl),
    methods: ["eth_getBalance", "eth_getTransactionCount"],
    address
  });
  const [balance, nonce] = await Promise.all([
    publicClient.getBalance({ address }),
    publicClient.getTransactionCount({ address })
  ]);

  return {
    address,
    chain: chainKey,
    chainName: config.displayName,
    balance: formatNativeAmount(balance),
    symbol: config.chain.nativeCurrency.symbol,
    nonce
  };
}

export async function getNativeBalance(
  ctx: WalletContext,
  chainKey: ChainKey,
  address: Address = ctx.account.address
) {
  const config = ctx.chains[chainKey];
  const publicClient = getPublicClient(config);
  ctx.logger.log("web3 rpc call", {
    chain: config.displayName,
    endpoint: redactUrl(config.rpcUrl),
    method: "eth_getBalance",
    address
  });
  const balance = await publicClient.getBalance({ address });

  return {
    address,
    chain: chainKey,
    chainName: config.displayName,
    balance: formatNativeAmount(balance),
    symbol: config.chain.nativeCurrency.symbol
  };
}

export async function prepareNativeTransfer(
  ctx: WalletContext,
  input: {
    id: string;
    chain: ChainKey;
    to: Address;
    amount: string;
  }
): Promise<NativeTransferPlan> {
  const config = ctx.chains[input.chain];
  const publicClient = getPublicClient(config);
  const value = parseEther(input.amount);
  ctx.logger.log("web3 rpc call", {
    chain: config.displayName,
    endpoint: redactUrl(config.rpcUrl),
    method: "eth_estimateGas",
    from: ctx.account.address,
    to: input.to,
    value: value.toString()
  });
  const estimatedGas = await publicClient.estimateGas({
    account: ctx.account.address,
    to: input.to,
    value
  });
  ctx.logger.log("web3 rpc call", {
    chain: config.displayName,
    endpoint: redactUrl(config.rpcUrl),
    method: "eth_gasPrice"
  });
  const gasPrice = await publicClient.getGasPrice();

  return {
    id: input.id,
    kind: "native-transfer",
    chain: input.chain,
    chainName: config.displayName,
    from: ctx.account.address,
    to: input.to,
    amount: input.amount,
    symbol: config.chain.nativeCurrency.symbol,
    value,
    estimatedGas,
    estimatedFee: estimatedGas * gasPrice
  };
}

export async function getErc20Balance(
  ctx: WalletContext,
  chainKey: ChainKey,
  token: Erc20TokenInput,
  address: Address = ctx.account.address
) {
  const config = ctx.chains[chainKey];
  const publicClient = getPublicClient(config);
  const metadata = await resolveErc20Metadata(ctx, chainKey, token);
  ctx.logger.log("web3 rpc call", {
    chain: config.displayName,
    endpoint: redactUrl(config.rpcUrl),
    method: "eth_call",
    contract: token.address,
    function: "balanceOf",
    address
  });
  const balance = await publicClient.readContract({
    address: token.address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address]
  });

  return {
    address,
    chain: chainKey,
    chainName: config.displayName,
    tokenAddress: token.address,
    tokenSymbol: metadata.symbol,
    tokenDecimals: metadata.decimals,
    balance: formatTokenAmount(balance, metadata.decimals),
    rawBalance: balance.toString()
  };
}

export async function getErc20Allowance(
  ctx: WalletContext,
  chainKey: ChainKey,
  token: Erc20TokenInput,
  owner: Address = ctx.account.address,
  spender: Address
) {
  const config = ctx.chains[chainKey];
  const publicClient = getPublicClient(config);
  const metadata = await resolveErc20Metadata(ctx, chainKey, token);
  ctx.logger.log("web3 rpc call", {
    chain: config.displayName,
    endpoint: redactUrl(config.rpcUrl),
    method: "eth_call",
    contract: token.address,
    function: "allowance",
    owner,
    spender
  });
  const allowance = await publicClient.readContract({
    address: token.address,
    abi: erc20Abi,
    functionName: "allowance",
    args: [owner, spender]
  });

  return {
    owner,
    spender,
    chain: chainKey,
    chainName: config.displayName,
    tokenAddress: token.address,
    tokenSymbol: metadata.symbol,
    tokenDecimals: metadata.decimals,
    allowance: formatTokenAmount(allowance, metadata.decimals),
    rawAllowance: allowance.toString()
  };
}

export async function prepareErc20Transfer(
  ctx: WalletContext,
  input: {
    id: string;
    chain: ChainKey;
    token: Erc20TokenInput;
    to: Address;
    amount: string;
  }
): Promise<Erc20TransferPlan> {
  const config = ctx.chains[input.chain];
  const publicClient = getPublicClient(config);
  const metadata = await resolveErc20Metadata(ctx, input.chain, input.token);
  const rawAmount = parseUnits(input.amount, metadata.decimals);
  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: "transfer",
    args: [input.to, rawAmount]
  });
  ctx.logger.log("web3 rpc call", {
    chain: config.displayName,
    endpoint: redactUrl(config.rpcUrl),
    method: "eth_estimateGas",
    contract: input.token.address,
    function: "transfer",
    from: ctx.account.address,
    to: input.to,
    amount: rawAmount.toString()
  });
  const estimatedGas = await publicClient.estimateGas({
    account: ctx.account.address,
    to: input.token.address,
    data
  });
  ctx.logger.log("web3 rpc call", {
    chain: config.displayName,
    endpoint: redactUrl(config.rpcUrl),
    method: "eth_gasPrice"
  });
  const gasPrice = await publicClient.getGasPrice();

  return {
    id: input.id,
    kind: "erc20-transfer",
    chain: input.chain,
    chainName: config.displayName,
    from: ctx.account.address,
    tokenAddress: input.token.address,
    tokenSymbol: metadata.symbol,
    tokenDecimals: metadata.decimals,
    to: input.to,
    amount: input.amount,
    rawAmount,
    estimatedGas,
    estimatedFee: estimatedGas * gasPrice
  };
}

export async function prepareErc20Approve(
  ctx: WalletContext,
  input: {
    id: string;
    chain: ChainKey;
    token: Erc20TokenInput;
    spender: Address;
    amount: string;
  }
): Promise<Erc20ApprovePlan> {
  const config = ctx.chains[input.chain];
  const publicClient = getPublicClient(config);
  const metadata = await resolveErc20Metadata(ctx, input.chain, input.token);
  const rawAmount = parseUnits(input.amount, metadata.decimals);
  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: "approve",
    args: [input.spender, rawAmount]
  });
  ctx.logger.log("web3 rpc call", {
    chain: config.displayName,
    endpoint: redactUrl(config.rpcUrl),
    method: "eth_estimateGas",
    contract: input.token.address,
    function: "approve",
    owner: ctx.account.address,
    spender: input.spender,
    amount: rawAmount.toString()
  });
  const estimatedGas = await publicClient.estimateGas({
    account: ctx.account.address,
    to: input.token.address,
    data
  });
  ctx.logger.log("web3 rpc call", {
    chain: config.displayName,
    endpoint: redactUrl(config.rpcUrl),
    method: "eth_gasPrice"
  });
  const gasPrice = await publicClient.getGasPrice();

  return {
    id: input.id,
    kind: "erc20-approve",
    chain: input.chain,
    chainName: config.displayName,
    owner: ctx.account.address,
    tokenAddress: input.token.address,
    tokenSymbol: metadata.symbol,
    tokenDecimals: metadata.decimals,
    spender: input.spender,
    amount: input.amount,
    rawAmount,
    estimatedGas,
    estimatedFee: estimatedGas * gasPrice
  };
}

export async function sendPreparedTransaction(
  ctx: WalletContext,
  plan: TransactionPlan
): Promise<SentTransactionResult> {
  const config = ctx.chains[plan.chain];
  const publicClient = getPublicClient(config);
  const walletClient = getWalletClient(config, ctx.account);
  ctx.logger.log("web3 rpc call", {
    chain: config.displayName,
    endpoint: redactUrl(config.rpcUrl),
    method: "eth_sendRawTransaction",
    kind: plan.kind
  });
  const hash = await sendPlan(walletClient, config.chain as Chain, ctx.account, plan);
  ctx.logger.log("web3 rpc call", {
    chain: config.displayName,
    endpoint: redactUrl(config.rpcUrl),
    method: "eth_getTransactionReceipt",
    hash,
    wait: true,
    timeoutMs: 60000
  });

  try {
    const receipt = await publicClient.waitForTransactionReceipt({
      hash,
      timeout: 60_000
    });

    return {
      hash,
      chain: plan.chain,
      chainName: plan.chainName,
      status: receipt.status,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed,
      explorerUrl: config.explorerUrl ? `${config.explorerUrl}/tx/${hash}` : undefined
    };
  } catch (error) {
    return {
      hash,
      chain: plan.chain,
      chainName: plan.chainName,
      status: "pending",
      explorerUrl: config.explorerUrl ? `${config.explorerUrl}/tx/${hash}` : undefined,
      receiptError: error instanceof Error ? error.message : String(error)
    };
  }
}

async function resolveErc20Metadata(
  ctx: WalletContext,
  chainKey: ChainKey,
  token: Erc20TokenInput
): Promise<{ symbol: string; decimals: number }> {
  if (token.symbol && token.decimals !== undefined) {
    return { symbol: token.symbol, decimals: token.decimals };
  }

  const config = ctx.chains[chainKey];
  const publicClient = getPublicClient(config);
  const [symbol, decimals] = await Promise.all([
    token.symbol ??
      publicClient
        .readContract({
          address: token.address,
          abi: erc20Abi,
          functionName: "symbol"
        })
        .catch(() => "ERC20"),
    token.decimals ??
      publicClient
        .readContract({
          address: token.address,
          abi: erc20Abi,
          functionName: "decimals"
        })
        .catch(() => 18)
  ]);

  return { symbol, decimals: Number(decimals) };
}

async function sendPlan(
  walletClient: ReturnType<typeof getWalletClient>,
  chain: Chain,
  account: WalletContext["account"],
  plan: TransactionPlan
): Promise<Hex> {
  if (plan.kind === "native-transfer") {
    return walletClient.sendTransaction({
      account,
      chain,
      to: plan.to,
      value: plan.value
    });
  }

  if (plan.kind === "erc20-transfer") {
    return walletClient.writeContract({
      account,
      chain,
      address: plan.tokenAddress,
      abi: erc20Abi,
      functionName: "transfer",
      args: [plan.to, plan.rawAmount]
    });
  }

  return walletClient.writeContract({
    account,
    chain,
    address: plan.tokenAddress,
    abi: erc20Abi,
    functionName: "approve",
    args: [plan.spender, plan.rawAmount]
  });
}
