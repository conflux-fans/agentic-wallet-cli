import { randomUUID } from "node:crypto";
import {
  encodeFunctionData,
  formatUnits,
  getAddress,
  isAddress,
  parseUnits,
  type Address
} from "viem";
import { tool } from "ai";
import { z } from "zod";
import { defineSkill, type SkillContext } from "./sdk.js";
import { chainEnumSchema, type ChainKey } from "../chains/index.js";

type UniswapV2Config = Partial<
  Record<ChainKey, { router: Address; factory: Address; wrappedNative: Address }>
>;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const DEFAULT_MAX_HOPS = 4;

const factoryAbi = [
  {
    type: "function",
    name: "getPair",
    stateMutability: "view",
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" }
    ],
    outputs: [{ name: "pair", type: "address" }]
  }
] as const;

const pairAbi = [
  {
    type: "function",
    name: "token0",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }]
  },
  {
    type: "function",
    name: "token1",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }]
  },
  {
    type: "function",
    name: "getReserves",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "reserve0", type: "uint112" },
      { name: "reserve1", type: "uint112" },
      { name: "blockTimestampLast", type: "uint32" }
    ]
  },
  {
    type: "function",
    name: "totalSupply",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }]
  }
] as const;

const routerAbi = [
  {
    type: "function",
    name: "getAmountsOut",
    stateMutability: "view",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "path", type: "address[]" }
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }]
  },
  {
    type: "function",
    name: "getAmountsIn",
    stateMutability: "view",
    inputs: [
      { name: "amountOut", type: "uint256" },
      { name: "path", type: "address[]" }
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }]
  },
  {
    type: "function",
    name: "swapExactTokensForTokens",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "amountOutMin", type: "uint256" },
      { name: "path", type: "address[]" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" }
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }]
  },
  {
    type: "function",
    name: "swapTokensForExactTokens",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amountOut", type: "uint256" },
      { name: "amountInMax", type: "uint256" },
      { name: "path", type: "address[]" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" }
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }]
  },
  {
    type: "function",
    name: "swapETHForExactTokens",
    stateMutability: "payable",
    inputs: [
      { name: "amountOut", type: "uint256" },
      { name: "path", type: "address[]" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" }
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }]
  },
  {
    type: "function",
    name: "swapTokensForExactETH",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amountOut", type: "uint256" },
      { name: "amountInMax", type: "uint256" },
      { name: "path", type: "address[]" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" }
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }]
  },
  {
    type: "function",
    name: "swapExactETHForTokens",
    stateMutability: "payable",
    inputs: [
      { name: "amountOutMin", type: "uint256" },
      { name: "path", type: "address[]" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" }
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }]
  },
  {
    type: "function",
    name: "swapExactTokensForETH",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "amountOutMin", type: "uint256" },
      { name: "path", type: "address[]" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" }
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }]
  },
  {
    type: "function",
    name: "addLiquidity",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
      { name: "amountADesired", type: "uint256" },
      { name: "amountBDesired", type: "uint256" },
      { name: "amountAMin", type: "uint256" },
      { name: "amountBMin", type: "uint256" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" }
    ],
    outputs: [
      { name: "amountA", type: "uint256" },
      { name: "amountB", type: "uint256" },
      { name: "liquidity", type: "uint256" }
    ]
  },
  {
    type: "function",
    name: "addLiquidityETH",
    stateMutability: "payable",
    inputs: [
      { name: "token", type: "address" },
      { name: "amountTokenDesired", type: "uint256" },
      { name: "amountTokenMin", type: "uint256" },
      { name: "amountETHMin", type: "uint256" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" }
    ],
    outputs: [
      { name: "amountToken", type: "uint256" },
      { name: "amountETH", type: "uint256" },
      { name: "liquidity", type: "uint256" }
    ]
  },
  {
    type: "function",
    name: "removeLiquidity",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
      { name: "liquidity", type: "uint256" },
      { name: "amountAMin", type: "uint256" },
      { name: "amountBMin", type: "uint256" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" }
    ],
    outputs: [
      { name: "amountA", type: "uint256" },
      { name: "amountB", type: "uint256" }
    ]
  },
  {
    type: "function",
    name: "removeLiquidityETH",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "liquidity", type: "uint256" },
      { name: "amountTokenMin", type: "uint256" },
      { name: "amountETHMin", type: "uint256" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" }
    ],
    outputs: [
      { name: "amountToken", type: "uint256" },
      { name: "amountETH", type: "uint256" }
    ]
  }
] as const;

const erc20AllowanceAbi = [
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" }
    ],
    outputs: [{ name: "", type: "uint256" }]
  }
] as const;

export function createUniswapV2Skill(ctx: SkillContext) {
  const config = ctx.config.readJson<UniswapV2Config>("config.json");
  const chainSchema = chainEnumSchema(Object.keys(config));
  const tokenInputSchema = z.object({
    symbol: z.string().optional().describe("token symbol，例如 USDT 或 CFX"),
    address: z.string().optional().describe("token 地址")
  });

  return defineSkill({
    name: "uniswap-v2",
    description:
      "Uniswap V2 skill: supports Conflux pool info, exact-in/exact-out quote, multi-hop route selection, swap preparation, and LP liquidity tools for ERC20 and CFX via wrapped native.",
    tools: {
      getUniswapV2PoolInfo: tool({
        description: "查询 Conflux 上 Uniswap V2 pair 地址、token0/token1、reserves 和 spot price。",
        inputSchema: z.object({
          chain: chainSchema,
          tokenA: tokenInputSchema,
          tokenB: tokenInputSchema
        }),
        execute: async ({ chain, tokenA, tokenB }) => {
          const chainKey = chain;
          const skillConfig = requireConfig(config, chainKey);
          rejectPlaceholderConfig(skillConfig);
          const resolvedA = resolveSwapToken(ctx, chainKey, skillConfig, tokenA);
          const resolvedB = resolveSwapToken(ctx, chainKey, skillConfig, tokenB);
          const pair = await getPair(ctx, chainKey, skillConfig.factory, resolvedA.address, resolvedB.address);
          if (pair === ZERO_ADDRESS) {
            return { chain, pair, exists: false };
          }
          const client = ctx.rpc.publicClient(chainKey);
          const [token0, token1, reserves] = await Promise.all([
            client.readContract({ address: pair, abi: pairAbi, functionName: "token0" }),
            client.readContract({ address: pair, abi: pairAbi, functionName: "token1" }),
            client.readContract({ address: pair, abi: pairAbi, functionName: "getReserves" })
          ]);
          return {
            chain,
            pair,
            exists: true,
            token0,
            token1,
            reserve0: reserves[0].toString(),
            reserve1: reserves[1].toString(),
            tokenA: resolvedA.symbol ?? resolvedA.address,
            tokenB: resolvedB.symbol ?? resolvedB.address,
            reserveA: formatUnits(
              token0.toLowerCase() === resolvedA.address.toLowerCase() ? reserves[0] : reserves[1],
              resolvedA.decimals ?? 18
            ),
            reserveB: formatUnits(
              token0.toLowerCase() === resolvedA.address.toLowerCase() ? reserves[1] : reserves[0],
              resolvedB.decimals ?? 18
            ),
            priceAInB: formatDecimalRatio(
              token0.toLowerCase() === resolvedA.address.toLowerCase() ? reserves[1] : reserves[0],
              resolvedB.decimals ?? 18,
              token0.toLowerCase() === resolvedA.address.toLowerCase() ? reserves[0] : reserves[1],
              resolvedA.decimals ?? 18
            ),
            priceBInA: formatDecimalRatio(
              token0.toLowerCase() === resolvedA.address.toLowerCase() ? reserves[0] : reserves[1],
              resolvedA.decimals ?? 18,
              token0.toLowerCase() === resolvedA.address.toLowerCase() ? reserves[1] : reserves[0],
              resolvedB.decimals ?? 18
            )
          };
        }
      }),
      getUniswapV2Quote: tool({
        description:
          "查询 Conflux 上 Uniswap V2 swap 报价，支持 exactIn/exactOut、直连和多跳路径、CFX 与 ERC20 互换。",
        inputSchema: z.object({
          chain: chainSchema,
          tokenIn: tokenInputSchema,
          tokenOut: tokenInputSchema,
          mode: z.enum(["exactIn", "exactOut"]).optional().describe("报价模式，默认 exactIn"),
          amountIn: z.string().optional().describe("exactIn 输入数量，十进制字符串"),
          amountOut: z.string().optional().describe("exactOut 目标输出数量，十进制字符串"),
          maxHops: z.number().int().min(1).max(4).optional().describe("最多经过多少个池子，默认 4")
        }),
        execute: async ({ chain, tokenIn, tokenOut, mode, amountIn, amountOut, maxHops }) => {
          const chainKey = chain;
          const skillConfig = requireConfig(config, chainKey);
          rejectPlaceholderConfig(skillConfig);
          rejectWrappedNativePlaceholder(skillConfig);
          const resolvedIn = resolveSwapToken(ctx, chainKey, skillConfig, tokenIn);
          const resolvedOut = resolveSwapToken(ctx, chainKey, skillConfig, tokenOut);
          rejectSameNative(resolvedIn, resolvedOut);
          const quoteMode = mode ?? "exactIn";
          const quote =
            quoteMode === "exactOut"
              ? await quoteExactOut(ctx, chainKey, skillConfig, resolvedIn, resolvedOut, amountOut, maxHops)
              : await quoteExactIn(ctx, chainKey, skillConfig, resolvedIn, resolvedOut, amountIn, maxHops);
          return {
            chain,
            mode: quoteMode,
            maxHops: maxHops ?? DEFAULT_MAX_HOPS,
            tokenIn: resolvedIn.symbol ?? resolvedIn.address,
            tokenOut: resolvedOut.symbol ?? resolvedOut.address,
            amountIn: formatUnits(quote.amountInRaw, resolvedIn.decimals ?? 18),
            amountOut: formatUnits(quote.amountOutRaw, resolvedOut.decimals ?? 18),
            amountInRaw: quote.amountInRaw.toString(),
            amountOutRaw: quote.amountOutRaw.toString(),
            path: quote.path,
            displayPath: formatPathSymbols(quote.routeTokens),
            executionPrice: formatExecutionPrice(quote.amountInRaw, resolvedIn.decimals ?? 18, quote.amountOutRaw, resolvedOut.decimals ?? 18),
            priceImpact: quote.priceImpact
          };
        }
      }),
      prepareUniswapV2Swap: tool({
        description:
          "准备 Conflux 上 Uniswap V2 swap 交易，支持 exactIn/exactOut、直连和多跳路径、CFX 与 ERC20 互换。不会签名或发送；ERC20 输入 token allowance 不足时会自动生成 approve + swap 多步操作。",
        inputSchema: z.object({
          chain: chainSchema,
          tokenIn: tokenInputSchema,
          tokenOut: tokenInputSchema,
          mode: z.enum(["exactIn", "exactOut"]).optional().describe("swap 模式，默认 exactIn"),
          amountIn: z.string().optional().describe("exactIn 输入数量，十进制字符串"),
          amountOut: z.string().optional().describe("exactOut 目标输出数量，十进制字符串"),
          slippageBps: z.number().int().min(1).max(5000).optional().describe("滑点 bps，默认 50"),
          maxHops: z.number().int().min(1).max(4).optional().describe("最多经过多少个池子，默认 4"),
          recipient: z.string().optional().describe("接收方地址或地址簿联系人，默认当前钱包")
        }),
        execute: async ({ chain, tokenIn, tokenOut, mode, amountIn, amountOut, slippageBps, maxHops, recipient }) => {
          const chainKey = chain;
          const skillConfig = requireConfig(config, chainKey);
          rejectPlaceholderConfig(skillConfig);
          rejectWrappedNativePlaceholder(skillConfig);
          const resolvedIn = resolveSwapToken(ctx, chainKey, skillConfig, tokenIn);
          const resolvedOut = resolveSwapToken(ctx, chainKey, skillConfig, tokenOut);
          rejectSameNative(resolvedIn, resolvedOut);
          const swapMode = mode ?? "exactIn";
          const quote =
            swapMode === "exactOut"
              ? await quoteExactOut(ctx, chainKey, skillConfig, resolvedIn, resolvedOut, amountOut, maxHops)
              : await quoteExactIn(ctx, chainKey, skillConfig, resolvedIn, resolvedOut, amountIn, maxHops);
          const bps = BigInt(slippageBps ?? 50);
          const amountOutMin =
            swapMode === "exactIn" ? (quote.amountOutRaw * (10_000n - bps)) / 10_000n : quote.amountOutRaw;
          const amountInMax =
            swapMode === "exactOut" ? (quote.amountInRaw * (10_000n + bps)) / 10_000n : quote.amountInRaw;
          const to = resolveRecipient(ctx, recipient);
          const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60);
          const call = encodeSwapCall({
            mode: swapMode,
            amountInRaw: quote.amountInRaw,
            amountInMax,
            amountOutRaw: quote.amountOutRaw,
            amountOutMin,
            path: quote.path,
            to,
            deadline,
            nativeIn: resolvedIn.isNative,
            nativeOut: resolvedOut.isNative
          });
          const prepareSwapPlan = () =>
            ctx.transactions.prepareContractCall({
              id: randomUUID(),
              chain: chainKey,
              protocol: "uniswap-v2",
              action: call.action,
              to: skillConfig.router,
              value: resolvedIn.isNative ? amountInMax : 0n,
              data: call.data,
              summary: [
                `模式：${swapMode}`,
                `输入：${formatUnits(quote.amountInRaw, resolvedIn.decimals ?? 18)} ${resolvedIn.symbol ?? resolvedIn.address}`,
                `最大输入：${formatUnits(amountInMax, resolvedIn.decimals ?? 18)} ${resolvedIn.symbol ?? resolvedIn.address}`,
                `预计输出：${formatUnits(quote.amountOutRaw, resolvedOut.decimals ?? 18)} ${resolvedOut.symbol ?? resolvedOut.address}`,
                `最少输出：${formatUnits(amountOutMin, resolvedOut.decimals ?? 18)} ${resolvedOut.symbol ?? resolvedOut.address}`,
                `路径：${formatPathSymbols(quote.routeTokens)}`,
                `最大跳数：${maxHops ?? DEFAULT_MAX_HOPS}`,
                `执行价格：${formatExecutionPrice(quote.amountInRaw, resolvedIn.decimals ?? 18, quote.amountOutRaw, resolvedOut.decimals ?? 18)} ${resolvedOut.symbol ?? resolvedOut.address}/${resolvedIn.symbol ?? resolvedIn.address}`,
                `价格影响：${quote.priceImpact}`,
                `接收方：${to}`,
                `滑点：${slippageBps ?? 50} bps`
              ],
              metadata: {
                kind: "uniswap-v2-swap",
                path: quote.routeTokens.map((token) => ({
                  address: token.address,
                  symbol: token.symbol,
                  decimals: token.decimals
                })),
                pairs: quote.pairs
              }
            });
          const approvalSteps = await prepareApprovalSteps(ctx, chainKey, skillConfig.router, [
            { token: resolvedIn, amount: amountInMax }
          ]);
          if (approvalSteps.length > 0) {
            return setPendingFlow(ctx, "Uniswap V2 Swap", [
              ...approvalSteps,
              {
                kind: "deferred",
                title: "Uniswap V2 Swap",
                prepare: prepareSwapPlan
              }
            ]);
          }

          const plan = await prepareSwapPlan();
          ctx.transactions.setPending(plan);
          return stringifyPlanBigints(plan);
        }
      }),
      getUniswapV2LiquidityPosition: tool({
        description: "查询 Conflux 上 Uniswap V2 LP position，包括 pair、LP 余额、总供应、份额和对应底层资产数量。",
        inputSchema: z.object({
          chain: chainSchema,
          tokenA: tokenInputSchema,
          tokenB: tokenInputSchema,
          owner: z.string().optional().describe("LP 持有人地址或地址簿联系人，默认当前钱包")
        }),
        execute: async ({ chain, tokenA, tokenB, owner }) => {
          const chainKey = chain;
          const skillConfig = requireConfig(config, chainKey);
          rejectPlaceholderConfig(skillConfig);
          rejectWrappedNativePlaceholder(skillConfig);
          const resolvedA = resolveSwapToken(ctx, chainKey, skillConfig, tokenA);
          const resolvedB = resolveSwapToken(ctx, chainKey, skillConfig, tokenB);
          rejectSameNative(resolvedA, resolvedB);
          const positionOwner = resolveOwner(ctx, owner);
          const position = await getLiquidityPosition(ctx, chainKey, skillConfig, resolvedA, resolvedB, positionOwner);
          return {
            chain,
            owner: positionOwner,
            pair: position.pair,
            exists: position.exists,
            tokenA: resolvedA.symbol ?? resolvedA.address,
            tokenB: resolvedB.symbol ?? resolvedB.address,
            lpBalance: position.lpBalanceFormatted,
            lpBalanceRaw: position.lpBalance.toString(),
            totalSupply: position.totalSupplyFormatted,
            totalSupplyRaw: position.totalSupply.toString(),
            share: position.share,
            amountA: position.amountAFormatted,
            amountARaw: position.amountA.toString(),
            amountB: position.amountBFormatted,
            amountBRaw: position.amountB.toString()
          };
        }
      }),
      prepareUniswapV2AddLiquidity: tool({
        description:
          "准备 Conflux 上 Uniswap V2 添加流动性交易，支持 ERC20/ERC20 和 CFX/ERC20。不会签名或发送；ERC20 allowance 不足时会自动生成 approve + add liquidity 多步操作。",
        inputSchema: z.object({
          chain: chainSchema,
          tokenA: tokenInputSchema,
          tokenB: tokenInputSchema,
          amountA: z.string().describe("tokenA 期望添加数量，十进制字符串"),
          amountB: z.string().describe("tokenB 期望添加数量，十进制字符串"),
          slippageBps: z.number().int().min(1).max(5000).optional().describe("滑点 bps，默认 50"),
          recipient: z.string().optional().describe("LP 接收方地址或地址簿联系人，默认当前钱包")
        }),
        execute: async ({ chain, tokenA, tokenB, amountA, amountB, slippageBps, recipient }) => {
          const chainKey = chain;
          const skillConfig = requireConfig(config, chainKey);
          rejectPlaceholderConfig(skillConfig);
          rejectWrappedNativePlaceholder(skillConfig);
          const resolvedA = resolveSwapToken(ctx, chainKey, skillConfig, tokenA);
          const resolvedB = resolveSwapToken(ctx, chainKey, skillConfig, tokenB);
          rejectSameNative(resolvedA, resolvedB);
          const amountARaw = parseUnits(amountA, resolvedA.decimals ?? 18);
          const amountBRaw = parseUnits(amountB, resolvedB.decimals ?? 18);
          const expected = await estimateAddLiquidityAmounts(
            ctx,
            chainKey,
            skillConfig.factory,
            resolvedA,
            resolvedB,
            amountARaw,
            amountBRaw
          );
          const bps = BigInt(slippageBps ?? 50);
          const amountAMin = applySlippageDown(expected.amountA, bps);
          const amountBMin = applySlippageDown(expected.amountB, bps);
          const to = resolveRecipient(ctx, recipient);
          const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60);
          const call = encodeAddLiquidityCall({
            tokenA: resolvedA,
            tokenB: resolvedB,
            amountADesired: amountARaw,
            amountBDesired: amountBRaw,
            amountAMin,
            amountBMin,
            to,
            deadline
          });
          const prepareAddLiquidityPlan = () =>
            ctx.transactions.prepareContractCall({
              id: randomUUID(),
              chain: chainKey,
              protocol: "uniswap-v2",
              action: call.action,
              to: skillConfig.router,
              value: call.value,
              data: call.data,
              summary: [
                `操作：添加流动性`,
                `Token A：${resolvedA.symbol ?? resolvedA.address}`,
                `Token B：${resolvedB.symbol ?? resolvedB.address}`,
                `期望数量 A：${formatUnits(amountARaw, resolvedA.decimals ?? 18)} ${resolvedA.symbol ?? resolvedA.address}`,
                `期望数量 B：${formatUnits(amountBRaw, resolvedB.decimals ?? 18)} ${resolvedB.symbol ?? resolvedB.address}`,
                `预计使用 A：${formatUnits(expected.amountA, resolvedA.decimals ?? 18)} ${resolvedA.symbol ?? resolvedA.address}`,
                `预计使用 B：${formatUnits(expected.amountB, resolvedB.decimals ?? 18)} ${resolvedB.symbol ?? resolvedB.address}`,
                `最少数量 A：${formatUnits(amountAMin, resolvedA.decimals ?? 18)} ${resolvedA.symbol ?? resolvedA.address}`,
                `最少数量 B：${formatUnits(amountBMin, resolvedB.decimals ?? 18)} ${resolvedB.symbol ?? resolvedB.address}`,
                `接收方：${to}`,
                `滑点：${slippageBps ?? 50} bps`
              ]
            });
          const approvalSteps = await prepareApprovalSteps(ctx, chainKey, skillConfig.router, [
            { token: resolvedA, amount: amountARaw },
            { token: resolvedB, amount: amountBRaw }
          ]);
          if (approvalSteps.length > 0) {
            return setPendingFlow(ctx, "Uniswap V2 Add Liquidity", [
              ...approvalSteps,
              {
                kind: "deferred",
                title: "Uniswap V2 Add Liquidity",
                prepare: prepareAddLiquidityPlan
              }
            ]);
          }

          const plan = await prepareAddLiquidityPlan();
          ctx.transactions.setPending(plan);
          return stringifyPlanBigints(plan);
        }
      }),
      prepareUniswapV2RemoveLiquidity: tool({
        description:
          "准备 Conflux 上 Uniswap V2 移除流动性交易，支持 ERC20/ERC20 和 CFX/ERC20。不会签名或发送；LP token allowance 不足时会自动生成 approve LP + remove liquidity 多步操作。",
        inputSchema: z.object({
          chain: chainSchema,
          tokenA: tokenInputSchema,
          tokenB: tokenInputSchema,
          liquidity: z.string().describe("要移除的 LP token 数量，十进制字符串"),
          slippageBps: z.number().int().min(1).max(5000).optional().describe("滑点 bps，默认 50"),
          recipient: z.string().optional().describe("底层资产接收方地址或地址簿联系人，默认当前钱包")
        }),
        execute: async ({ chain, tokenA, tokenB, liquidity, slippageBps, recipient }) => {
          const chainKey = chain;
          const skillConfig = requireConfig(config, chainKey);
          rejectPlaceholderConfig(skillConfig);
          rejectWrappedNativePlaceholder(skillConfig);
          const resolvedA = resolveSwapToken(ctx, chainKey, skillConfig, tokenA);
          const resolvedB = resolveSwapToken(ctx, chainKey, skillConfig, tokenB);
          rejectSameNative(resolvedA, resolvedB);
          const pair = await getPair(ctx, chainKey, skillConfig.factory, resolvedA.address, resolvedB.address);
          if (pair === ZERO_ADDRESS) {
            throw new Error("该交易对 pair 不存在，无法移除流动性");
          }
          const liquidityRaw = parseUnits(liquidity, 18);
          const expected = await estimateRemoveLiquidityAmounts(ctx, chainKey, pair, resolvedA, resolvedB, liquidityRaw);
          const bps = BigInt(slippageBps ?? 50);
          const amountAMin = applySlippageDown(expected.amountA, bps);
          const amountBMin = applySlippageDown(expected.amountB, bps);
          const to = resolveRecipient(ctx, recipient);
          const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60);
          const call = encodeRemoveLiquidityCall({
            tokenA: resolvedA,
            tokenB: resolvedB,
            liquidity: liquidityRaw,
            amountAMin,
            amountBMin,
            to,
            deadline
          });
          const prepareRemoveLiquidityPlan = () =>
            ctx.transactions.prepareContractCall({
              id: randomUUID(),
              chain: chainKey,
              protocol: "uniswap-v2",
              action: call.action,
              to: skillConfig.router,
              value: 0n,
              data: call.data,
              summary: [
                `操作：移除流动性`,
                `Pair：${pair}`,
                `Token A：${resolvedA.symbol ?? resolvedA.address}`,
                `Token B：${resolvedB.symbol ?? resolvedB.address}`,
                `LP 数量：${formatUnits(liquidityRaw, 18)}`,
                `预计取回 A：${formatUnits(expected.amountA, resolvedA.decimals ?? 18)} ${resolvedA.symbol ?? resolvedA.address}`,
                `预计取回 B：${formatUnits(expected.amountB, resolvedB.decimals ?? 18)} ${resolvedB.symbol ?? resolvedB.address}`,
                `最少取回 A：${formatUnits(amountAMin, resolvedA.decimals ?? 18)} ${resolvedA.symbol ?? resolvedA.address}`,
                `最少取回 B：${formatUnits(amountBMin, resolvedB.decimals ?? 18)} ${resolvedB.symbol ?? resolvedB.address}`,
                `接收方：${to}`,
                `滑点：${slippageBps ?? 50} bps`
              ]
            });
          const approvalSteps = await prepareApprovalSteps(ctx, chainKey, skillConfig.router, [
            {
              token: {
                address: pair,
                symbol: "UNI-V2",
                decimals: 18,
                isNative: false
              },
              amount: liquidityRaw
            }
          ]);
          if (approvalSteps.length > 0) {
            return setPendingFlow(ctx, "Uniswap V2 Remove Liquidity", [
              ...approvalSteps,
              {
                kind: "deferred",
                title: "Uniswap V2 Remove Liquidity",
                prepare: prepareRemoveLiquidityPlan
              }
            ]);
          }

          const plan = await prepareRemoveLiquidityPlan();
          ctx.transactions.setPending(plan);
          return stringifyPlanBigints(plan);
        }
      })
    }
  });
}

function requireConfig(config: UniswapV2Config, chain: ChainKey) {
  const chainConfig = config[chain];
  if (!chainConfig) {
    throw new Error(`uniswap-v2 skill 暂不支持 ${chain}`);
  }
  return chainConfig;
}

function rejectPlaceholderConfig(config: { router: Address; factory: Address }) {
  if (config.router === ZERO_ADDRESS || config.factory === ZERO_ADDRESS) {
    throw new Error("uniswap-v2 skill 仍使用 0 地址占位配置，请先更新 skills/uniswap-v2/config.json");
  }
}

function rejectWrappedNativePlaceholder(config: { wrappedNative: Address }) {
  if (config.wrappedNative === ZERO_ADDRESS) {
    throw new Error("uniswap-v2 skill 的 wrappedNative 仍是 0 地址，请先更新 skills/uniswap-v2/config.json");
  }
}

type SwapToken = {
  address: Address;
  symbol?: string;
  decimals?: number;
  isNative: boolean;
};

function resolveSwapToken(
  ctx: SkillContext,
  chain: ChainKey,
  config: { wrappedNative: Address },
  input: { symbol?: string; address?: string }
): SwapToken {
  if (input.symbol?.toUpperCase() === ctx.chains[chain].chain.nativeCurrency.symbol.toUpperCase()) {
    return {
      address: config.wrappedNative,
      symbol: ctx.chains[chain].chain.nativeCurrency.symbol,
      decimals: ctx.chains[chain].chain.nativeCurrency.decimals,
      isNative: true
    };
  }

  return {
    ...ctx.token.resolve(chain, input),
    isNative: false
  };
}

function rejectSameNative(tokenIn: SwapToken, tokenOut: SwapToken) {
  if (tokenIn.isNative && tokenOut.isNative) {
    throw new Error("不支持 native token 与自身 swap");
  }
}

type QuoteResult = {
  amountInRaw: bigint;
  amountOutRaw: bigint;
  path: Address[];
  routeTokens: SwapToken[];
  pairs: Address[];
  priceImpact: string;
};

type RouteHop = {
  pair: Address;
  reserveIn: bigint;
  reserveOut: bigint;
};

type ApprovalToken = {
  address: Address;
  symbol?: string;
  decimals?: number;
  isNative?: boolean;
};

type ApprovalRequest = {
  token: ApprovalToken;
  amount: bigint;
};

async function prepareApprovalSteps(
  ctx: SkillContext,
  chain: ChainKey,
  spender: Address,
  requests: ApprovalRequest[]
) {
  const steps = [];
  for (const request of requests) {
    if (request.token.isNative) {
      continue;
    }
    const allowance = await getAllowance(ctx, chain, request.token.address, ctx.wallet.account.address, spender);
    if (allowance >= request.amount) {
      continue;
    }
    const decimals = request.token.decimals ?? 18;
    const symbol = request.token.symbol ?? "ERC20";
    const plan = await ctx.transactions.prepareErc20Approve({
      id: randomUUID(),
      chain,
      token: {
        address: request.token.address,
        symbol,
        decimals
      },
      spender,
      amount: formatUnits(request.amount, decimals)
    });
    steps.push({
      kind: "prepared" as const,
      title: `Approve ${symbol}`,
      plan
    });
  }
  return steps;
}

function setPendingFlow(
  ctx: SkillContext,
  title: string,
  steps: Array<
    | Awaited<ReturnType<typeof prepareApprovalSteps>>[number]
    | {
        kind: "deferred";
        title: string;
        prepare: () => Promise<Awaited<ReturnType<SkillContext["transactions"]["prepareContractCall"]>>>;
      }
  >
) {
  ctx.transactions.setPendingFlow({
    id: randomUUID(),
    title,
    steps,
    currentStepIndex: 0,
    completedSteps: []
  });
  return {
    kind: "transaction-flow",
    title,
    steps: steps.length,
    currentStep: 1,
    message: "已生成多步操作。每一步发送前都需要你确认。"
  };
}

type LiquidityPosition = {
  exists: boolean;
  pair: Address;
  lpBalance: bigint;
  lpBalanceFormatted: string;
  totalSupply: bigint;
  totalSupplyFormatted: string;
  share: string;
  amountA: bigint;
  amountAFormatted: string;
  amountB: bigint;
  amountBFormatted: string;
};

async function getLiquidityPosition(
  ctx: SkillContext,
  chain: ChainKey,
  config: { factory: Address },
  tokenA: SwapToken,
  tokenB: SwapToken,
  owner: Address
): Promise<LiquidityPosition> {
  const pair = await getPair(ctx, chain, config.factory, tokenA.address, tokenB.address);
  if (pair === ZERO_ADDRESS) {
    return {
      exists: false,
      pair,
      lpBalance: 0n,
      lpBalanceFormatted: "0",
      totalSupply: 0n,
      totalSupplyFormatted: "0",
      share: "0.00%",
      amountA: 0n,
      amountAFormatted: "0",
      amountB: 0n,
      amountBFormatted: "0"
    };
  }

  const client = ctx.rpc.publicClient(chain);
  const [lpBalance, totalSupply, token0, reserves] = await Promise.all([
    client.readContract({ address: pair, abi: pairAbi, functionName: "balanceOf", args: [owner] }),
    client.readContract({ address: pair, abi: pairAbi, functionName: "totalSupply" }),
    client.readContract({ address: pair, abi: pairAbi, functionName: "token0" }),
    client.readContract({ address: pair, abi: pairAbi, functionName: "getReserves" })
  ]);
  const inputAIsToken0 = token0.toLowerCase() === tokenA.address.toLowerCase();
  const reserveA = inputAIsToken0 ? reserves[0] : reserves[1];
  const reserveB = inputAIsToken0 ? reserves[1] : reserves[0];
  const amountA = totalSupply === 0n ? 0n : (reserveA * lpBalance) / totalSupply;
  const amountB = totalSupply === 0n ? 0n : (reserveB * lpBalance) / totalSupply;

  return {
    exists: true,
    pair,
    lpBalance,
    lpBalanceFormatted: formatUnits(lpBalance, 18),
    totalSupply,
    totalSupplyFormatted: formatUnits(totalSupply, 18),
    share: formatShare(lpBalance, totalSupply),
    amountA,
    amountAFormatted: formatUnits(amountA, tokenA.decimals ?? 18),
    amountB,
    amountBFormatted: formatUnits(amountB, tokenB.decimals ?? 18)
  };
}

async function estimateAddLiquidityAmounts(
  ctx: SkillContext,
  chain: ChainKey,
  factory: Address,
  tokenA: SwapToken,
  tokenB: SwapToken,
  amountADesired: bigint,
  amountBDesired: bigint
): Promise<{ amountA: bigint; amountB: bigint }> {
  const pair = await getPair(ctx, chain, factory, tokenA.address, tokenB.address);
  if (pair === ZERO_ADDRESS) {
    return { amountA: amountADesired, amountB: amountBDesired };
  }

  const client = ctx.rpc.publicClient(chain);
  const [token0, reserves] = await Promise.all([
    client.readContract({ address: pair, abi: pairAbi, functionName: "token0" }),
    client.readContract({ address: pair, abi: pairAbi, functionName: "getReserves" })
  ]);
  const inputAIsToken0 = token0.toLowerCase() === tokenA.address.toLowerCase();
  const reserveA = inputAIsToken0 ? reserves[0] : reserves[1];
  const reserveB = inputAIsToken0 ? reserves[1] : reserves[0];
  if (reserveA === 0n || reserveB === 0n) {
    return { amountA: amountADesired, amountB: amountBDesired };
  }

  const amountBOptimal = quoteLiquidityAmount(amountADesired, reserveA, reserveB);
  if (amountBOptimal <= amountBDesired) {
    return { amountA: amountADesired, amountB: amountBOptimal };
  }

  const amountAOptimal = quoteLiquidityAmount(amountBDesired, reserveB, reserveA);
  return { amountA: amountAOptimal, amountB: amountBDesired };
}

async function estimateRemoveLiquidityAmounts(
  ctx: SkillContext,
  chain: ChainKey,
  pair: Address,
  tokenA: SwapToken,
  tokenB: SwapToken,
  liquidity: bigint
): Promise<{ amountA: bigint; amountB: bigint }> {
  const client = ctx.rpc.publicClient(chain);
  const [totalSupply, token0, reserves] = await Promise.all([
    client.readContract({ address: pair, abi: pairAbi, functionName: "totalSupply" }),
    client.readContract({ address: pair, abi: pairAbi, functionName: "token0" }),
    client.readContract({ address: pair, abi: pairAbi, functionName: "getReserves" })
  ]);
  if (totalSupply === 0n) {
    throw new Error("pair totalSupply 为 0，无法估算移除流动性数量");
  }
  const inputAIsToken0 = token0.toLowerCase() === tokenA.address.toLowerCase();
  const reserveA = inputAIsToken0 ? reserves[0] : reserves[1];
  const reserveB = inputAIsToken0 ? reserves[1] : reserves[0];
  return {
    amountA: (reserveA * liquidity) / totalSupply,
    amountB: (reserveB * liquidity) / totalSupply
  };
}

function quoteLiquidityAmount(amountA: bigint, reserveA: bigint, reserveB: bigint): bigint {
  if (reserveA === 0n) {
    throw new Error("reserveA 为 0，无法估算流动性比例");
  }
  return (amountA * reserveB) / reserveA;
}

async function quoteExactIn(
  ctx: SkillContext,
  chain: ChainKey,
  config: { router: Address; factory: Address; wrappedNative: Address },
  tokenIn: SwapToken,
  tokenOut: SwapToken,
  amountIn: string | undefined,
  maxHops: number | undefined
): Promise<QuoteResult> {
  if (!amountIn) {
    throw new Error("exactIn 模式请提供 amountIn");
  }

  const amountInRaw = parseUnits(amountIn, tokenIn.decimals ?? 18);
  const candidates = buildRouteCandidates(ctx, chain, config, tokenIn, tokenOut, maxHops);
  const quotes = await Promise.all(
    candidates.map(async (routeTokens) => {
      try {
        const path = routeTokens.map((token) => token.address);
        const amounts = await getAmountsOut(ctx, chain, config.router, amountInRaw, path);
        return { routeTokens, path, amounts };
      } catch {
        return undefined;
      }
    })
  );
  const best = quotes
    .filter((quote): quote is { routeTokens: SwapToken[]; path: Address[]; amounts: readonly bigint[] } =>
      Boolean(quote)
    )
    .sort((a, b) => compareBigintDesc(a.amounts[a.amounts.length - 1], b.amounts[b.amounts.length - 1]))[0];
  if (!best) {
    throw new Error("未找到可用的 Uniswap V2 兑换路径");
  }

  const amountOutRaw = best.amounts[best.amounts.length - 1];
  const hops = await getRouteHops(ctx, chain, config.factory, best.routeTokens);
  return {
    amountInRaw,
    amountOutRaw,
    path: best.path,
    routeTokens: best.routeTokens,
    pairs: hops.map((hop) => hop.pair),
    priceImpact: formatPriceImpact(calculateExactInPriceImpactBps(amountInRaw, amountOutRaw, hops))
  };
}

async function quoteExactOut(
  ctx: SkillContext,
  chain: ChainKey,
  config: { router: Address; factory: Address; wrappedNative: Address },
  tokenIn: SwapToken,
  tokenOut: SwapToken,
  amountOut: string | undefined,
  maxHops: number | undefined
): Promise<QuoteResult> {
  if (!amountOut) {
    throw new Error("exactOut 模式请提供 amountOut");
  }

  const amountOutRaw = parseUnits(amountOut, tokenOut.decimals ?? 18);
  const candidates = buildRouteCandidates(ctx, chain, config, tokenIn, tokenOut, maxHops);
  const quotes = await Promise.all(
    candidates.map(async (routeTokens) => {
      try {
        const path = routeTokens.map((token) => token.address);
        const amounts = await getAmountsIn(ctx, chain, config.router, amountOutRaw, path);
        return { routeTokens, path, amounts };
      } catch {
        return undefined;
      }
    })
  );
  const best = quotes
    .filter((quote): quote is { routeTokens: SwapToken[]; path: Address[]; amounts: readonly bigint[] } =>
      Boolean(quote)
    )
    .sort((a, b) => compareBigintAsc(a.amounts[0], b.amounts[0]))[0];
  if (!best) {
    throw new Error("未找到可用的 Uniswap V2 兑换路径");
  }

  const amountInRaw = best.amounts[0];
  const hops = await getRouteHops(ctx, chain, config.factory, best.routeTokens);
  return {
    amountInRaw,
    amountOutRaw,
    path: best.path,
    routeTokens: best.routeTokens,
    pairs: hops.map((hop) => hop.pair),
    priceImpact: formatPriceImpact(calculateExactOutPriceImpactBps(amountInRaw, amountOutRaw, hops))
  };
}

function buildRouteCandidates(
  ctx: SkillContext,
  chain: ChainKey,
  config: { wrappedNative: Address },
  tokenIn: SwapToken,
  tokenOut: SwapToken,
  maxHops: number | undefined
): SwapToken[][] {
  const bases = getBaseRouteTokens(ctx, chain, config, tokenIn, tokenOut);
  const hopLimit = maxHops ?? DEFAULT_MAX_HOPS;
  const maxIntermediateCount = Math.max(0, hopLimit - 1);
  const routes: SwapToken[][] = [];

  for (let count = 0; count <= maxIntermediateCount; count += 1) {
    for (const intermediateTokens of buildIntermediatePermutations(bases, count)) {
      routes.push([tokenIn, ...intermediateTokens, tokenOut]);
    }
  }

  const seen = new Set<string>();
  return routes.filter((route) => {
    const key = route.map((token) => token.address.toLowerCase()).join("-");
    const hasDuplicateHop = route.some((token, index) =>
      route.findIndex((other) => other.address.toLowerCase() === token.address.toLowerCase()) !== index
    );
    if (seen.has(key) || hasDuplicateHop) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function buildIntermediatePermutations(tokens: SwapToken[], length: number): SwapToken[][] {
  if (length === 0) {
    return [[]];
  }

  const results: SwapToken[][] = [];
  for (const token of tokens) {
    const remaining = tokens.filter((candidate) => candidate.address.toLowerCase() !== token.address.toLowerCase());
    for (const tail of buildIntermediatePermutations(remaining, length - 1)) {
      results.push([token, ...tail]);
    }
  }
  return results;
}

function getBaseRouteTokens(
  ctx: SkillContext,
  chain: ChainKey,
  config: { wrappedNative: Address },
  tokenIn: SwapToken,
  tokenOut: SwapToken
): SwapToken[] {
  const native = {
    address: config.wrappedNative,
    symbol: ctx.chains[chain].chain.nativeCurrency.symbol,
    decimals: ctx.chains[chain].chain.nativeCurrency.decimals,
    isNative: false
  };
  const tokens = [native, resolveOptionalBaseToken(ctx, chain, "USDT"), resolveOptionalBaseToken(ctx, chain, "USDC")];
  const seen = new Set<string>();
  return tokens.filter((token): token is SwapToken => {
    if (!token) {
      return false;
    }
    const address = token.address.toLowerCase();
    if (seen.has(address) || address === tokenIn.address.toLowerCase() || address === tokenOut.address.toLowerCase()) {
      return false;
    }
    seen.add(address);
    return true;
  });
}

function resolveOptionalBaseToken(ctx: SkillContext, chain: ChainKey, symbol: string): SwapToken | undefined {
  try {
    return {
      ...ctx.token.resolve(chain, { symbol }),
      isNative: false
    };
  } catch {
    return undefined;
  }
}

async function getRouteHops(
  ctx: SkillContext,
  chain: ChainKey,
  factory: Address,
  routeTokens: SwapToken[]
): Promise<RouteHop[]> {
  const client = ctx.rpc.publicClient(chain);
  return Promise.all(
    routeTokens.slice(0, -1).map(async (tokenIn, index) => {
      const tokenOut = routeTokens[index + 1];
      const pair = await getPair(ctx, chain, factory, tokenIn.address, tokenOut.address);
      if (pair === ZERO_ADDRESS) {
        throw new Error(`路径 ${formatPathSymbols([tokenIn, tokenOut])} 的 pair 不存在`);
      }
      const [token0, reserves] = await Promise.all([
        client.readContract({ address: pair, abi: pairAbi, functionName: "token0" }),
        client.readContract({ address: pair, abi: pairAbi, functionName: "getReserves" })
      ]);
      const inputIsToken0 = token0.toLowerCase() === tokenIn.address.toLowerCase();
      return {
        pair,
        reserveIn: inputIsToken0 ? reserves[0] : reserves[1],
        reserveOut: inputIsToken0 ? reserves[1] : reserves[0]
      };
    })
  );
}

function calculateExactInPriceImpactBps(amountIn: bigint, actualOut: bigint, hops: RouteHop[]): bigint {
  const spotOut = hops.reduce((amount, hop) => (amount * hop.reserveOut) / hop.reserveIn, amountIn);
  if (spotOut === 0n || spotOut <= actualOut) {
    return 0n;
  }
  return ((spotOut - actualOut) * 10_000n) / spotOut;
}

function calculateExactOutPriceImpactBps(actualIn: bigint, amountOut: bigint, hops: RouteHop[]): bigint {
  const spotIn = hops
    .slice()
    .reverse()
    .reduce((amount, hop) => (amount * hop.reserveIn) / hop.reserveOut, amountOut);
  if (actualIn === 0n || actualIn <= spotIn) {
    return 0n;
  }
  return ((actualIn - spotIn) * 10_000n) / actualIn;
}

function formatPriceImpact(bps: bigint): string {
  return `${formatBpsAsPercent(bps)}`;
}

function formatBpsAsPercent(bps: bigint): string {
  const integer = bps / 100n;
  const decimals = (bps % 100n).toString().padStart(2, "0");
  return `${integer}.${decimals}%`;
}

function compareBigintDesc(a: bigint, b: bigint): number {
  if (a === b) {
    return 0;
  }
  return a > b ? -1 : 1;
}

function compareBigintAsc(a: bigint, b: bigint): number {
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
}

function encodeSwapCall(input: {
  mode: "exactIn" | "exactOut";
  amountInRaw: bigint;
  amountInMax: bigint;
  amountOutRaw: bigint;
  amountOutMin: bigint;
  path: Address[];
  to: Address;
  deadline: bigint;
  nativeIn: boolean;
  nativeOut: boolean;
}): {
  action:
    | "swapExactTokensForTokens"
    | "swapExactETHForTokens"
    | "swapExactTokensForETH"
    | "swapTokensForExactTokens"
    | "swapETHForExactTokens"
    | "swapTokensForExactETH";
  data: `0x${string}`;
} {
  if (input.mode === "exactOut") {
    if (input.nativeIn) {
      return {
        action: "swapETHForExactTokens",
        data: encodeFunctionData({
          abi: routerAbi,
          functionName: "swapETHForExactTokens",
          args: [input.amountOutRaw, input.path, input.to, input.deadline]
        })
      };
    }

    if (input.nativeOut) {
      return {
        action: "swapTokensForExactETH",
        data: encodeFunctionData({
          abi: routerAbi,
          functionName: "swapTokensForExactETH",
          args: [input.amountOutRaw, input.amountInMax, input.path, input.to, input.deadline]
        })
      };
    }

    return {
      action: "swapTokensForExactTokens",
      data: encodeFunctionData({
        abi: routerAbi,
        functionName: "swapTokensForExactTokens",
        args: [input.amountOutRaw, input.amountInMax, input.path, input.to, input.deadline]
      })
    };
  }

  if (input.nativeIn) {
    return {
      action: "swapExactETHForTokens",
      data: encodeFunctionData({
        abi: routerAbi,
        functionName: "swapExactETHForTokens",
        args: [input.amountOutMin, input.path, input.to, input.deadline]
      })
    };
  }

  if (input.nativeOut) {
    return {
      action: "swapExactTokensForETH",
      data: encodeFunctionData({
        abi: routerAbi,
        functionName: "swapExactTokensForETH",
        args: [input.amountInRaw, input.amountOutMin, input.path, input.to, input.deadline]
      })
    };
  }

  return {
    action: "swapExactTokensForTokens",
    data: encodeFunctionData({
      abi: routerAbi,
      functionName: "swapExactTokensForTokens",
      args: [input.amountInRaw, input.amountOutMin, input.path, input.to, input.deadline]
    })
  };
}

function encodeAddLiquidityCall(input: {
  tokenA: SwapToken;
  tokenB: SwapToken;
  amountADesired: bigint;
  amountBDesired: bigint;
  amountAMin: bigint;
  amountBMin: bigint;
  to: Address;
  deadline: bigint;
}): { action: "addLiquidity" | "addLiquidityETH"; value: bigint; data: `0x${string}` } {
  if (input.tokenA.isNative || input.tokenB.isNative) {
    const erc20Token = input.tokenA.isNative ? input.tokenB : input.tokenA;
    const amountNativeDesired = input.tokenA.isNative ? input.amountADesired : input.amountBDesired;
    const amountTokenDesired = input.tokenA.isNative ? input.amountBDesired : input.amountADesired;
    const amountNativeMin = input.tokenA.isNative ? input.amountAMin : input.amountBMin;
    const amountTokenMin = input.tokenA.isNative ? input.amountBMin : input.amountAMin;
    return {
      action: "addLiquidityETH",
      value: amountNativeDesired,
      data: encodeFunctionData({
        abi: routerAbi,
        functionName: "addLiquidityETH",
        args: [erc20Token.address, amountTokenDesired, amountTokenMin, amountNativeMin, input.to, input.deadline]
      })
    };
  }

  return {
    action: "addLiquidity",
    value: 0n,
    data: encodeFunctionData({
      abi: routerAbi,
      functionName: "addLiquidity",
      args: [
        input.tokenA.address,
        input.tokenB.address,
        input.amountADesired,
        input.amountBDesired,
        input.amountAMin,
        input.amountBMin,
        input.to,
        input.deadline
      ]
    })
  };
}

function encodeRemoveLiquidityCall(input: {
  tokenA: SwapToken;
  tokenB: SwapToken;
  liquidity: bigint;
  amountAMin: bigint;
  amountBMin: bigint;
  to: Address;
  deadline: bigint;
}): { action: "removeLiquidity" | "removeLiquidityETH"; data: `0x${string}` } {
  if (input.tokenA.isNative || input.tokenB.isNative) {
    const erc20Token = input.tokenA.isNative ? input.tokenB : input.tokenA;
    const amountNativeMin = input.tokenA.isNative ? input.amountAMin : input.amountBMin;
    const amountTokenMin = input.tokenA.isNative ? input.amountBMin : input.amountAMin;
    return {
      action: "removeLiquidityETH",
      data: encodeFunctionData({
        abi: routerAbi,
        functionName: "removeLiquidityETH",
        args: [erc20Token.address, input.liquidity, amountTokenMin, amountNativeMin, input.to, input.deadline]
      })
    };
  }

  return {
    action: "removeLiquidity",
    data: encodeFunctionData({
      abi: routerAbi,
      functionName: "removeLiquidity",
      args: [
        input.tokenA.address,
        input.tokenB.address,
        input.liquidity,
        input.amountAMin,
        input.amountBMin,
        input.to,
        input.deadline
      ]
    })
  };
}

async function getPair(
  ctx: SkillContext,
  chain: ChainKey,
  factory: Address,
  tokenA: Address,
  tokenB: Address
): Promise<Address> {
  const client = ctx.rpc.publicClient(chain);
  return client.readContract({
    address: factory,
    abi: factoryAbi,
    functionName: "getPair",
    args: [tokenA, tokenB]
  });
}

async function getAmountsOut(
  ctx: SkillContext,
  chain: ChainKey,
  router: Address,
  amountIn: bigint,
  path: Address[]
): Promise<readonly bigint[]> {
  const client = ctx.rpc.publicClient(chain);
  return client.readContract({
    address: router,
    abi: routerAbi,
    functionName: "getAmountsOut",
    args: [amountIn, path]
  });
}

async function getAmountsIn(
  ctx: SkillContext,
  chain: ChainKey,
  router: Address,
  amountOut: bigint,
  path: Address[]
): Promise<readonly bigint[]> {
  const client = ctx.rpc.publicClient(chain);
  return client.readContract({
    address: router,
    abi: routerAbi,
    functionName: "getAmountsIn",
    args: [amountOut, path]
  });
}

async function getAllowance(
  ctx: SkillContext,
  chain: ChainKey,
  token: Address,
  owner: Address,
  spender: Address
): Promise<bigint> {
  const client = ctx.rpc.publicClient(chain);
  return client.readContract({
    address: token,
    abi: erc20AllowanceAbi,
    functionName: "allowance",
    args: [owner, spender]
  });
}

function resolveRecipient(ctx: SkillContext, recipient: string | undefined): Address {
  if (!recipient) {
    return ctx.wallet.account.address;
  }
  const resolved = ctx.address.resolve(recipient);
  if (!resolved || !isAddress(resolved)) {
    if (isAddress(recipient)) {
      return getAddress(recipient);
    }
    throw new Error("接收方不是合法 EVM 地址，也不是地址簿联系人");
  }
  return resolved;
}

function resolveOwner(ctx: SkillContext, owner: string | undefined): Address {
  return resolveRecipient(ctx, owner);
}

function applySlippageDown(value: bigint, bps: bigint): bigint {
  return (value * (10_000n - bps)) / 10_000n;
}

function formatShare(balance: bigint, totalSupply: bigint): string {
  if (totalSupply === 0n) {
    return "0.00%";
  }
  return formatBpsAsPercent((balance * 10_000n) / totalSupply);
}

function stringifyPlanBigints<T extends { value: bigint; estimatedGas: bigint; estimatedFee: bigint }>(plan: T) {
  return {
    ...plan,
    value: plan.value.toString(),
    estimatedGas: plan.estimatedGas.toString(),
    estimatedFee: plan.estimatedFee.toString()
  };
}

function formatPathSymbols(tokens: Array<{ address: Address; symbol?: string }>): string {
  return tokens.map((token) => token.symbol ?? token.address).join(" -> ");
}

function formatExecutionPrice(
  amountInRaw: bigint,
  inputDecimals: number,
  amountOutRaw: bigint,
  outputDecimals: number
): string {
  return formatDecimalRatio(amountOutRaw, outputDecimals, amountInRaw, inputDecimals);
}

function formatDecimalRatio(
  numeratorRaw: bigint,
  numeratorDecimals: number,
  denominatorRaw: bigint,
  denominatorDecimals: number
): string {
  if (denominatorRaw === 0n) {
    return "0";
  }

  const numerator = Number(formatUnits(numeratorRaw, numeratorDecimals));
  const denominator = Number(formatUnits(denominatorRaw, denominatorDecimals));
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return "0";
  }

  const ratio = numerator / denominator;
  if (ratio === 0) {
    return "0";
  }
  if (ratio >= 1) {
    return trimDecimal(ratio.toFixed(6));
  }
  return trimDecimal(ratio.toPrecision(6));
}

function trimDecimal(value: string): string {
  return value.includes(".") ? value.replace(/0+$/, "").replace(/\.$/, "") : value;
}
