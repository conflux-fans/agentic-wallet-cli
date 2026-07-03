# Agentic Wallet Implementation Plan

本文档记录 Agentic Wallet 的第一阶段实现方案。当前目标不是一次性实现完整钱包，而是先搭建一个可理解、可扩展、可验证的 Agent 钱包核心架构。

## 第一阶段目标

第一阶段聚焦 Native MVP，先验证自然语言到链上操作的核心链路：

```text
用户自然语言输入
-> Agent 理解意图
-> 判断缺失信息并追问
-> 生成结构化动作
-> 执行只读工具或准备交易
-> 用户确认
-> 签名并发送交易
-> 返回结果
```

第一阶段只实现：

1. CLI 对话入口
2. OpenRouter + Vercel AI SDK
3. viem 钱包和 RPC 能力
4. Conflux eSpace 和 Monad 多链配置
5. native 余额查询
6. nonce 查询
7. native 转账的意图识别、参数补全、交易确认和发送

第一阶段暂不实现：

1. ERC20
2. Uniswap V2
3. LayerZero
4. 交易历史
5. skill 插件系统
6. 地址簿和长期记忆
7. pending transaction 持久化

## 技术选型

```text
TypeScript
commander        # CLI 命令入口
ai               # Vercel AI SDK
OpenRouter       # LLM provider
viem             # EVM RPC、签名、合约交互
dotenv           # 环境变量加载
zod              # tool 参数 schema
```

## CLI 形态

第一版 CLI 以 `chat` 为核心，同时保留少量调试命令，方便验证底层钱包能力。

```bash
wallet chat
wallet account --chain conflux
wallet balance --chain monad
```

其中 `wallet chat` 是主要产品形态，进入自然语言交互模式。

## 目录结构建议

```text
src/
  cli/
    index.ts              # commander 入口
  config/
    env.ts                # 环境变量读取和校验
  chains/
    index.ts              # chain registry
  wallet/
    client.ts             # viem client、account、signer
  agent/
    index.ts              # Agent 主流程
    session.ts            # 会话状态和 pending action
    tools/
      native.ts           # native 相关工具
```

后续扩展协议时，可以继续增加：

```text
src/protocols/
  erc20/
  uniswap-v2/
  layerzero/
```

## 链配置

内部 chain key 使用稳定、短小的标识：

```text
conflux
monad
```

展示名称：

```text
Conflux eSpace
Monad
```

链配置应包含：

1. chain key
2. display name
3. chain id
4. RPC URL
5. native currency symbol
6. block explorer URL

RPC URL 优先从环境变量读取，避免把不稳定的公共 RPC 写死在代码中。

## 钱包和私钥

第一阶段私钥通过环境变量传入：

```text
PRIVATE_KEY=...
```

私钥储存不是本项目重点。生产级项目中，Agent 不应该直接接触私钥；后续可以替换为外部 signer、硬件钱包、MPC 或交易审批服务。

## Agent 工具设计

第一阶段工具保持克制，只暴露 Native MVP 所需能力。

### 查询类工具

查询类工具可以直接执行，不需要用户确认。

```ts
getAccountInfo({
  chain: "conflux" | "monad"
})
```

返回：

1. address
2. native balance
3. nonce
4. chain name

```ts
getNativeBalance({
  chain: "conflux" | "monad"
})
```

返回：

1. address
2. balance
3. symbol
4. chain name

### 写入类工具

写入类操作必须拆成准备和发送两步。

```ts
prepareNativeTransfer({
  chain: "conflux" | "monad",
  to: string,
  amount: string
})
```

该工具只生成交易计划，不签名、不发送。返回：

1. confirmationId
2. chain
3. from
4. to
5. amount
6. symbol
7. estimatedGas
8. estimatedFee

```ts
sendPreparedTransaction({
  confirmationId: string
})
```

该工具只允许发送已经准备好且用户明确确认过的交易。

## 确认机制

任何会改变链上状态的操作都必须经过用户确认，包括后续的 ERC20 transfer、approve、swap、add liquidity、remove liquidity 和 bridge。

第一阶段 pending transaction 只保存在 CLI 进程内存中。进程退出后 pending transaction 丢失，这是可接受的 MVP 约束。

示例交互：

```text
> 帮我在 Conflux eSpace 转 0.1 CFX 给 0xabc...

Agent:
即将执行 native 转账：
链：Conflux eSpace
接收方：0xabc...
数量：0.1 CFX
预估 gas：...
预估费用：...

确认发送吗？

> 确认

Agent:
交易已发送：0x...
```

## 参数补全

Agent 需要判断用户输入中的缺失信息，并通过多轮对话补全。

例如：

```text
用户：转 10 个给 Alice
```

可能缺失：

1. 链
2. native 资产还是 token
3. Alice 对应的钱包地址
4. 是否确认执行

第一阶段不实现地址簿，因此如果用户输入 `Alice` 这类非地址标识，应追问具体地址。

## 金额处理

第一阶段 native 资产都按 18 decimals 处理，内部使用 `viem` 的 `parseEther` 和 `formatEther`。

用户输入的金额保留字符串形式传入 tool，再由 tool 负责转换为 bigint，避免浮点数精度问题。

## 安全边界

1. Agent 只能调用显式注册的 tools。
2. Agent 不能直接构造任意交易并发送。
3. 写入类操作必须先生成交易计划。
4. 交易计划必须展示给用户。
5. 只有用户明确确认后才能签名发送。
6. 第一阶段不支持用户通过自然语言传入任意 calldata。

## 后续阶段

### 第二阶段：ERC20

1. token registry
2. 支持预置 USDT、USDC
3. 支持直接输入 token address
4. ERC20 balance
5. ERC20 transfer
6. ERC20 approve

### 第三阶段：交易历史

交易历史依赖 index API。不同链的数据源不同，因此后置处理。

### 第四阶段：Uniswap V2

建议按以下顺序实现：

1. 查询 pair 信息
2. 查询 reserve 和价格
3. swap
4. add liquidity
5. remove liquidity

### 第五阶段：LayerZero

LayerZero 跨链流程复杂，应在 native、ERC20 和交易确认机制稳定后再实现。

需要处理：

1. 路由查询
2. 费用估算
3. 跨链发送
4. 状态查询
5. 可能存在的目标链领取或后续动作

### 第六阶段：Skill 插件系统

第一步先不实现。等核心工具注册、权限控制和会话状态稳定后，再考虑通过 skill 增加协议支持。

## 当前建议的下一步

下一步可以开始搭建第一阶段项目骨架，但实现范围应严格限制在：

1. TypeScript 项目初始化
2. commander CLI
3. env 配置
4. chain registry
5. viem wallet client
6. native 查询工具
7. native 转账准备和确认流程
8. OpenRouter + Vercel AI SDK tool calling
