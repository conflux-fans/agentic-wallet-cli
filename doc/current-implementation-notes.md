# Current Implementation Notes

本文档用于解释当前 Agentic Wallet MVP 的实现方式，方便在继续扩展前先理解现有架构。

## 当前模块

当前实现可以拆成以下模块：

```text
CLI              # 命令入口、读取用户输入、展示结果
Agent            # 调 LLM、管理多轮对话、注册 tools
Session          # 保存 messages 和 pendingTransaction
Tools            # 暴露给 LLM 的受控能力
Wallet           # viem RPC、余额、nonce、估 gas、发交易
Chains           # Conflux / Monad 配置
Logger           # verbose 外部调用日志
```

对应文件：

```text
src/cli/index.ts
src/cli/format.ts
src/agent/index.ts
src/agent/session.ts
src/agent/tools/native.ts
src/wallet/client.ts
src/chains/index.ts
src/config/env.ts
src/logger.ts
```

## 推荐阅读顺序

建议按以下顺序理解代码：

1. `src/cli/index.ts`
2. `src/agent/index.ts`
3. `src/agent/session.ts`
4. `src/agent/tools/native.ts`
5. `src/wallet/client.ts`
6. `src/chains/index.ts`
7. `src/logger.ts`

这个顺序基本对应一次用户请求从命令行进入系统，再到 LLM、tool、RPC 的完整路径。

## CLI 模块

入口文件是：

```text
src/cli/index.ts
```

当前提供三个命令：

```bash
wallet chat
wallet account --chain conflux
wallet balance --chain monad
```

开发模式下使用：

```bash
npm run dev -- chat
npm run dev -- account --chain conflux
npm run dev -- balance --chain monad
```

CLI 的主要职责：

1. 读取环境变量
2. 创建 chain registry
3. 创建 wallet context
4. 创建 session
5. 读取用户输入
6. 调用 Agent 或 wallet 方法
7. 展示结果

CLI 不负责自然语言理解。自然语言理解交给 Agent。

## Agent 主流程

Agent 主流程在：

```text
src/agent/index.ts
```

核心函数是：

```ts
handleUserInput(input, config, wallet, session)
```

它负责处理每一轮用户输入。

整体流程：

```text
用户输入
-> handleUserInput()
-> 如果有 pendingTransaction，先处理确认/取消
-> 如果没有 pendingTransaction，把用户输入加入 messages
-> 调用 OpenRouter LLM
-> LLM 可以调用注册的 tools
-> 得到最终回复
-> 把 assistant 回复加入 messages
-> 返回文本给 CLI 展示
```

## 多轮对话消息管理

Session 定义在：

```text
src/agent/session.ts
```

核心结构：

```ts
export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AgentSession = {
  messages: ChatMessage[];
  pendingTransaction?: TransactionPlan;
};
```

当前 session 只存在内存中，不持久化。

启动 `wallet chat` 时会创建一个新 session：

```ts
const session = createAgentSession();
```

之后整个 chat 循环都复用这个 session。

正常对话时，每轮会：

```text
1. push user message
2. 调用 LLM
3. push assistant message
```

示例：

```text
user: 查一下我在 Monad 的余额
assistant: ...
user: 那 Conflux 呢？
assistant: ...
```

模型能理解“那 Conflux 呢？”这类上下文依赖，是因为历史 messages 会一起传给模型。

## Messages 何时清空

目前没有主动清空 messages 的逻辑。

messages 清空时机：

```text
1. 启动新的 chat 进程时
2. 当前 CLI 进程退出时
3. 程序崩溃或被终止时
```

目前没有：

```text
clear/reset 命令
最大消息数裁剪
token budget 控制
按任务结束自动清空
持久化到文件或数据库
```

目前会主动清空的是 `pendingTransaction`：

```text
用户确认交易 -> pendingTransaction = undefined
用户取消交易 -> pendingTransaction = undefined
```

但确认或取消交易不会清空 messages。

## Tool Calling

Agent 可调用的工具定义在：

```text
src/agent/tools/native.ts
```

当前有三个 tools：

```text
getAccountInfo
getNativeBalance
prepareNativeTransfer
```

### getAccountInfo

用于查询账户信息：

```text
address
chain
chainName
balance
symbol
nonce
```

支持查询：

```text
当前钱包地址
任意 EVM 地址
```

### getNativeBalance

用于查询 native 资产余额。

支持查询：

```text
当前钱包地址
任意 EVM 地址
```

余额展示最多保留 4 位小数，并直接截断，不四舍五入。

### prepareNativeTransfer

用于准备 native 转账。

这个 tool 只生成交易计划：

```text
不签名
不发送交易
只估算 gas
只保存 pendingTransaction
```

返回给 LLM 的交易计划会把 bigint 字段转成字符串，避免 JSON 序列化失败。

内部 session 中保存的 pending transaction 仍保留 bigint，便于后续真正发送交易。

## 转账确认流程

转账是当前系统里最重要的安全流程。

流程：

```text
用户：转 0.1 CFX 给 0x...
-> LLM 调用 prepareNativeTransfer
-> wallet 估算 gas
-> session.pendingTransaction = plan
-> CLI 展示交易计划
-> 用户输入“确认”
-> sendNativeTransfer
-> 发送交易
```

如果用户输入“取消”：

```text
session.pendingTransaction = undefined
```

如果存在 pending transaction，系统不会继续让 LLM 处理新的自然语言请求。

也就是说，pending 状态下：

```text
确认 -> 发送
取消 -> 丢弃
其他输入 -> 提醒先确认或取消
```

这样可以避免用户在待确认交易时继续对话，导致交易上下文被覆盖或误解。

## Wallet 模块

Wallet 逻辑在：

```text
src/wallet/client.ts
```

主要职责：

```text
创建 viem publicClient
创建 viem walletClient
从 PRIVATE_KEY 创建 account
查询余额
查询 nonce
估算 gas
发送 native 转账
格式化 native 余额
```

当前支持的链上能力：

```text
eth_getBalance
eth_getTransactionCount
eth_estimateGas
eth_gasPrice
eth_sendRawTransaction
```

私钥只在 wallet 模块中使用。

## Chains 模块

链配置在：

```text
src/chains/index.ts
```

当前支持：

```text
conflux -> Conflux eSpace
monad   -> Monad
```

内部使用 chain key：

```text
conflux
monad
```

展示给用户时使用 display name：

```text
Conflux eSpace
Monad
```

RPC URL 从环境变量读取：

```text
CONFLUX_RPC_URL
MONAD_RPC_URL
```

## Verbose 日志

verbose 逻辑在：

```text
src/logger.ts
```

CLI 支持：

```bash
npm run dev -- --verbose chat
npm run dev -- chat --verbose
npm run dev -- account --chain conflux --verbose
npm run dev -- balance --chain monad --verbose
```

verbose 模式会打印：

```text
LLM provider
LLM model
system prompt
messages
tools
LLM duration
LLM usage
tool call
web3 RPC chain
web3 RPC method
web3 RPC key params
```

不会打印：

```text
OpenRouter API key
PRIVATE_KEY
RPC URL query/hash/username/password
```

logger 支持 bigint-safe JSON 序列化，避免 verbose 模式下打印 bigint 报错。

## 当前实现的边界

当前实现是 MVP，不是完整钱包。

已支持：

```text
多链配置
自然语言 chat
当前钱包余额和 nonce 查询
任意地址余额和 nonce 查询
native 转账准备
用户确认后发送 native 转账
verbose 调试日志
```

暂不支持：

```text
ERC20
Uniswap V2
LayerZero
交易历史
地址簿
长期记忆
messages 持久化
messages 裁剪
复杂多工具 trace 保存
```

## 需要特别理解的设计点

### 1. Agent 不直接操作链

Agent 只能通过 tools 操作钱包能力。

这能保证 LLM 不会直接构造任意 RPC 请求或任意交易。

### 2. 写操作必须确认

当前唯一写操作是 native transfer。

它必须经过：

```text
prepare -> pending -> confirm -> send
```

### 3. Messages 是文本级记忆

当前 `session.messages` 只保存 user/assistant 文本。

没有保存完整 tool call 和 tool result trace。

这让实现简单，但未来如果要支持复杂多步任务，可能需要升级为完整 `ModelMessage[]` 管理。

### 4. Pending transaction 是安全状态

只要存在 `pendingTransaction`，新的自然语言请求不会进入 LLM。

用户必须先确认或取消。

这是为了避免交易误发。

## 下一步可能的改进

后续可以考虑：

```text
增加 clear/reset 命令
增加 message 裁剪策略
保存完整 ModelMessage tool trace
增加 ERC20 balance/transfer/approve
抽象 confirmation manager
增加地址簿
增加 transaction simulation
增加更细粒度的权限控制
```
