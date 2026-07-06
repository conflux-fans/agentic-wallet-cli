import {
  formatEther,
  formatUnits,
  getAddress,
  parseAbiItem,
  type Address,
  type Hex
} from "viem";
import type { ChainKey } from "../chains/index.js";
import { getPublicClient, type Erc20TokenInput, type WalletContext } from "../wallet/client.js";
import { redactUrl } from "../logger.js";

const erc20MetadataAbi = [
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }]
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }]
  }
] as const;

const transferEvent = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)"
);

export type ScanApiConfig = Partial<Record<ChainKey, { apiUrl?: string; apiKey?: string }>>;

export type NativeTransferHistoryEntry = {
  chain: ChainKey;
  chainName: string;
  hash: Hex;
  blockNumber: bigint;
  timestamp?: number;
  from: Address;
  to?: Address;
  value: string;
  rawValue: string;
  symbol: string;
  direction: "in" | "out" | "self";
  status?: "success" | "failed";
};

export type Erc20TransferHistoryEntry = {
  chain: ChainKey;
  chainName: string;
  hash: Hex;
  blockNumber: bigint;
  logIndex: number;
  tokenAddress: Address;
  tokenSymbol: string;
  tokenDecimals: number;
  from: Address;
  to: Address;
  value: string;
  rawValue: string;
  direction: "in" | "out" | "self";
};

export async function getNativeTransferHistory(
  ctx: WalletContext,
  scanApis: ScanApiConfig,
  input: {
    chain: ChainKey;
    address?: Address;
    startBlock?: bigint;
    endBlock?: bigint;
    limit?: number;
  }
): Promise<NativeTransferHistoryEntry[]> {
  const config = ctx.chains[input.chain];
  const address = getAddress(input.address ?? ctx.account.address);
  const scanApi = scanApis[input.chain];
  if (!scanApi?.apiUrl) {
    throw new Error(`${config.displayName} 未配置 scan API URL，无法查询 native 转账历史`);
  }

  const url = buildScanUrl(scanApi.apiUrl, {
    module: "account",
    action: "txlist",
    address,
    startblock: (input.startBlock ?? 0n).toString(),
    endblock: (input.endBlock ?? 999999999999n).toString(),
    page: "1",
    offset: String(input.limit ?? 20),
    sort: "desc",
    apikey: scanApi.apiKey
  });
  ctx.logger.log("scan api call", {
    chain: config.displayName,
    endpoint: redactUrl(scanApi.apiUrl),
    action: "txlist",
    address,
    startBlock: (input.startBlock ?? 0n).toString(),
    endBlock: (input.endBlock ?? 999999999999n).toString(),
    limit: input.limit ?? 20
  });

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`scan API 请求失败：${response.status} ${response.statusText}`);
  }
  const payload = (await response.json()) as {
    status?: string;
    message?: string;
    result?: unknown;
  };
  if (!Array.isArray(payload.result)) {
    if (payload.status === "0" && payload.message?.toLowerCase().includes("no transactions")) {
      return [];
    }
    throw new Error(`scan API 返回格式不符合预期：${payload.message ?? "unknown error"}`);
  }

  return payload.result
    .map((item) => normalizeNativeScanTx(item, input.chain, config.displayName, config.chain.nativeCurrency.symbol, address))
    .filter((item): item is NativeTransferHistoryEntry => Boolean(item))
    .slice(0, input.limit ?? 20);
}

export async function getErc20TransferHistory(
  ctx: WalletContext,
  input: {
    chain: ChainKey;
    address?: Address;
    token?: Erc20TokenInput;
    fromBlock?: bigint;
    toBlock?: bigint;
    blockRange?: bigint;
    limit?: number;
  }
): Promise<Erc20TransferHistoryEntry[]> {
  const config = ctx.chains[input.chain];
  const publicClient = getPublicClient(config);
  const address = getAddress(input.address ?? ctx.account.address);
  const latestBlock = await publicClient.getBlockNumber();
  const toBlock = input.toBlock ?? latestBlock;
  const fromBlock = input.fromBlock ?? clampFromBlock(toBlock, input.blockRange ?? 10_000n);
  const limit = input.limit ?? 20;
  const tokenAddress = input.token?.address;

  ctx.logger.log("web3 rpc batch", {
    chain: config.displayName,
    endpoint: redactUrl(config.rpcUrl),
    methods: ["eth_getLogs", "eth_getLogs"],
    event: "ERC20 Transfer",
    address,
    token: tokenAddress,
    fromBlock: fromBlock.toString(),
    toBlock: toBlock.toString(),
    limit
  });

  const [outLogs, inLogs] = await Promise.all([
    publicClient.getLogs({
      address: tokenAddress,
      event: transferEvent,
      args: { from: address },
      fromBlock,
      toBlock
    }),
    publicClient.getLogs({
      address: tokenAddress,
      event: transferEvent,
      args: { to: address },
      fromBlock,
      toBlock
    })
  ]);

  const metadataCache = new Map<string, Promise<{ symbol: string; decimals: number }>>();
  const entries = await Promise.all(
    [...outLogs, ...inLogs].map(async (log) => {
      if (!log.args.from || !log.args.to || log.args.value === undefined) {
        return undefined;
      }
      const metadata = await getTokenMetadata(ctx, input.chain, {
        address: log.address,
        symbol: input.token?.address?.toLowerCase() === log.address.toLowerCase() ? input.token.symbol : undefined,
        decimals: input.token?.address?.toLowerCase() === log.address.toLowerCase() ? input.token.decimals : undefined
      }, metadataCache);
      const from = getAddress(log.args.from);
      const to = getAddress(log.args.to);
      const value = log.args.value;
      return {
        chain: input.chain,
        chainName: config.displayName,
        hash: log.transactionHash,
        blockNumber: log.blockNumber,
        logIndex: log.logIndex,
        tokenAddress: log.address,
        tokenSymbol: metadata.symbol,
        tokenDecimals: metadata.decimals,
        from,
        to,
        value: formatUnits(value, metadata.decimals),
        rawValue: value.toString(),
        direction: getDirection(address, from, to)
      };
    })
  );

  return dedupeErc20Entries(entries.filter((entry): entry is Erc20TransferHistoryEntry => Boolean(entry)))
    .sort((a, b) => compareHistoryPositionDesc(a.blockNumber, a.logIndex, b.blockNumber, b.logIndex))
    .slice(0, limit);
}

function buildScanUrl(apiUrl: string, params: Record<string, string | undefined>): string {
  const url = new URL(apiUrl);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

function normalizeNativeScanTx(
  value: unknown,
  chain: ChainKey,
  chainName: string,
  symbol: string,
  address: Address
): NativeTransferHistoryEntry | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const tx = value as Record<string, string | undefined>;
  if (!tx.hash || !tx.from || !tx.value || !tx.blockNumber) {
    return undefined;
  }

  const from = getAddress(tx.from);
  const to = tx.to ? getAddress(tx.to) : undefined;
  const rawValue = BigInt(tx.value);
  if (rawValue === 0n) {
    return undefined;
  }
  return {
    chain,
    chainName,
    hash: tx.hash as Hex,
    blockNumber: BigInt(tx.blockNumber),
    timestamp: tx.timeStamp ? Number(tx.timeStamp) : undefined,
    from,
    to,
    value: formatEther(rawValue),
    rawValue: rawValue.toString(),
    symbol,
    direction: getDirection(address, from, to),
    status: tx.isError === "1" ? "failed" : "success"
  };
}

async function getTokenMetadata(
  ctx: WalletContext,
  chain: ChainKey,
  token: Erc20TokenInput,
  cache: Map<string, Promise<{ symbol: string; decimals: number }>>
): Promise<{ symbol: string; decimals: number }> {
  if (token.symbol && token.decimals !== undefined) {
    return { symbol: token.symbol, decimals: token.decimals };
  }
  const key = token.address.toLowerCase();
  const cached = cache.get(key);
  if (cached) {
    return cached;
  }

  const metadata = readTokenMetadata(ctx, chain, token);
  cache.set(key, metadata);
  return metadata;
}

async function readTokenMetadata(
  ctx: WalletContext,
  chain: ChainKey,
  token: Erc20TokenInput
): Promise<{ symbol: string; decimals: number }> {
  const client = getPublicClient(ctx.chains[chain]);
  const [symbol, decimals] = await Promise.all([
    token.symbol ??
      client
        .readContract({ address: token.address, abi: erc20MetadataAbi, functionName: "symbol" })
        .catch(() => "ERC20"),
    token.decimals ??
      client
        .readContract({ address: token.address, abi: erc20MetadataAbi, functionName: "decimals" })
        .catch(() => 18)
  ]);
  return { symbol, decimals: Number(decimals) };
}

function clampFromBlock(toBlock: bigint, range: bigint): bigint {
  return toBlock > range ? toBlock - range : 0n;
}

function getDirection(address: Address, from: Address, to: Address | undefined): "in" | "out" | "self" {
  const normalized = address.toLowerCase();
  const isFrom = from.toLowerCase() === normalized;
  const isTo = to?.toLowerCase() === normalized;
  if (isFrom && isTo) {
    return "self";
  }
  return isFrom ? "out" : "in";
}

function dedupeErc20Entries(entries: Erc20TransferHistoryEntry[]): Erc20TransferHistoryEntry[] {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const key = `${entry.hash}-${entry.logIndex}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function compareHistoryPositionDesc(
  blockA: bigint,
  indexA: number,
  blockB: bigint,
  indexB: number
): number {
  if (blockA !== blockB) {
    return blockA > blockB ? -1 : 1;
  }
  return indexB - indexA;
}
