# Agentic Wallet MVP

Agentic Wallet MVP 是一个命令行 EVM 钱包示例项目。用户可以通过自然语言与钱包交互，当前版本聚焦 Native 资产的查询和转账流程。

## 当前支持范围

支持链：

1. Conflux eSpace
2. Monad

支持能力：

1. 查看当前钱包或任意 EVM 地址的账户信息、native 余额和 nonce
2. 查询当前钱包或任意 EVM 地址的 native 资产余额
3. 通过自然语言准备 native 转账
4. 用户确认后发送 native 转账
5. 查询每条链的 ERC20 token 白名单
6. 查询 ERC20 token 余额
7. 查询 ERC20 allowance
8. 通过自然语言准备 ERC20 transfer
9. 通过自然语言准备 ERC20 approve
10. 地址簿查询、增加、删除、修改
11. 通过自然语言查询、增加、删除、修改 ERC20 token 列表
12. 查询 native 转账历史
13. 查询 ERC20 Transfer 历史

暂不支持：

1. LayerZero 跨链

## 安装

```bash
npm install
```

## 环境变量

复制 `.env.example` 为 `.env`，并填入配置：

```bash
cp .env.example .env
```

需要配置：

```text
OPENROUTER_API_KEY=你的 OpenRouter API Key
OPENROUTER_MODEL=openai/gpt-4o-mini

PRIVATE_KEY=你的 EVM 私钥

CONFLUX_RPC_URL=Conflux eSpace RPC URL
MONAD_RPC_URL=Monad RPC URL

CONFLUX_USDT_ADDRESS=Conflux eSpace USDT 地址
CONFLUX_USDC_ADDRESS=Conflux eSpace USDC 地址
MONAD_USDT_ADDRESS=Monad USDT 地址
MONAD_USDC_ADDRESS=Monad USDC 地址

CONFLUX_SCAN_API_URL=ConfluxScan API URL，默认 https://evmapi.confluxscan.io/api
CONFLUX_SCAN_API_KEY=ConfluxScan API Key，可选
MONAD_SCAN_API_URL=Monad scan API URL，可选
MONAD_SCAN_API_KEY=Monad scan API Key，可选
```

`PRIVATE_KEY` 可以带 `0x` 前缀，也可以不带。

token 地址是可选配置。未配置时，白名单仍会显示 USDT/USDC，但地址会显示为“未配置”。

native 转账历史依赖 Etherscan/ConfluxScan 兼容的 scan API，当前查询普通交易里的 native value 转账，不包含 internal transfer。ERC20 Transfer 历史通过 RPC `eth_getLogs` 查询，不依赖 scan API。

注意：这是示例项目。生产环境中 Agent 不应该直接接触私钥。

## 开发模式运行

查看帮助：

```bash
npm run dev -- --help
```

开启 verbose 模式：

```bash
npm run dev -- --verbose chat
npm run dev -- balance --chain conflux --verbose
```

verbose 模式会把外部接口调用信息输出到 stderr，包括：

1. OpenRouter 大模型调用的 provider、model、消息数量、tools、耗时和 token usage
2. web3 RPC 调用的 chain、脱敏 endpoint、RPC method 和关键参数

进入自然语言钱包：

```bash
npm run dev -- chat
```

chat 模式等待大模型返回时会显示 loading。开启 verbose 时会关闭 loading，避免和调试日志混在一起。

chat 模式支持清空上下文：

```text
clear
reset
清空
重置
清空上下文
```

如果当前有待确认交易，需要先输入“确认”或“取消”，然后才能清空上下文。

对话历史会自动裁剪，默认只保留最近 20 条 user/assistant 消息，避免 prompt 无限增长。

查看账户信息：

```bash
npm run dev -- account --chain conflux
npm run dev -- account --chain monad
npm run dev -- account --chain conflux --address 0x0000000000000000000000000000000000000000
```

输出格式：

```text
链：Conflux eSpace
地址：0x...
余额：1.2345 CFX
Nonce：12
```

查询 native 余额：

```bash
npm run dev -- balance --chain conflux
npm run dev -- balance --chain monad
npm run dev -- balance --chain conflux --address 0x0000000000000000000000000000000000000000
```

输出格式：

```text
链：Conflux eSpace
地址：0x...
余额：1.2345 CFX
```

查询 ERC20 token 白名单：

```bash
npm run dev -- tokens --chain conflux
npm run dev -- tokens --chain monad
```

输出格式：

```text
链：Conflux eSpace
Token：USDT
名称：Tether USD
精度：6
地址：0x...
Token：USDC
名称：USD Coin
精度：6
地址：0x...
```

查询 ERC20 余额：

```bash
npm run dev -- erc20-balance --chain conflux --token USDT
npm run dev -- erc20-balance --chain monad --token USDC --address 0x0000000000000000000000000000000000000000
npm run dev -- erc20-balance --chain conflux --token-address 0xaf37e8b6c9ed7f6318979f56fc287d76c30847ff
```

输出格式：

```text
链：Conflux eSpace
Token：USDT
Token 地址：0x...
地址：0x...
余额：12.3456 USDT
```

查询 ERC20 allowance：

```bash
npm run dev -- erc20-allowance --chain conflux --token USDT --spender 0x0000000000000000000000000000000000000000
npm run dev -- erc20-allowance --chain monad --token-address 0x754704Bc059F8C67012fEd69BC8A327a5aafb603 --owner 0x0000000000000000000000000000000000000000 --spender 0x0000000000000000000000000000000000000000
```

输出格式：

```text
链：Conflux eSpace
Token：USDT
Token 地址：0x...
Owner：0x...
Spender：0x...
Allowance：10 USDT
```

转账历史查询通过 chat 自然语言完成，不提供单独 CLI 子命令。

地址簿：

```bash
npm run dev -- address-book list
npm run dev -- address-book get Alice
npm run dev -- address-book add Alice 0x0000000000000000000000000000000000000000 --note "测试地址"
npm run dev -- address-book update Alice --address 0x1111111111111111111111111111111111111111
npm run dev -- address-book remove Alice
```

也可以使用短命令：

```bash
npm run dev -- ab list
```

地址簿会保存到当前工作目录的 `.wallet-address-book.json`。该文件包含联系人地址，不包含私钥。

token 列表内置 USDT / USDC，也支持通过自然语言编辑。编辑后的 token 会保存到当前工作目录的 `.wallet-token-list.json`。

## 构建后运行

构建：

```bash
npm run build
```

运行构建产物：

```bash
npm start -- --help
npm start -- chat
npm start -- account --chain conflux
npm start -- balance --chain monad
npm start -- --verbose chat
```

## Chat 使用示例

启动：

```bash
npm run dev -- chat
```

查询余额：

```text
> 查一下我在 Conflux eSpace 的余额
```

查询任意地址余额：

```text
> 查一下 0x0000000000000000000000000000000000000000 在 Monad 上的余额
```

查询账户信息：

```text
> 查看 Monad 上的钱包信息
```

查询任意地址 nonce：

```text
> 查一下 0x0000000000000000000000000000000000000000 在 Conflux eSpace 上的 nonce
```

查询 token 白名单：

```text
> Monad 支持哪些 token
```

查询 ERC20 余额：

```text
> 查一下我在 Conflux eSpace 的 USDT 余额
```

查询 allowance：

```text
> 查一下我在 Monad 上给 0x0000000000000000000000000000000000000000 的 USDC 授权额度
```

查询转账历史：

```text
> 查一下我在 Conflux 上的 CFX 转账历史
> 查一下我在 Conflux 上的 USDT 转账历史
> 查一下 0x0000000000000000000000000000000000000000 最近的 USDC 转账记录
```

准备 ERC20 转账：

```text
> 在 Conflux eSpace 转 10 USDT 给 0x0000000000000000000000000000000000000000
```

准备 ERC20 approve：

```text
> 在 Monad 上授权 0x0000000000000000000000000000000000000000 使用 25 USDC
```

地址簿：

```text
> 添加 Alice 的地址 0x0000000000000000000000000000000000000000
> 查询地址簿
> 修改 Alice 的地址为 0x1111111111111111111111111111111111111111
> 删除 Alice
```

转账和 approve 可以使用地址簿联系人名称：

```text
> 在 Conflux eSpace 转 0.1 CFX 给 Alice
> 在 Monad 上授权 Alice 使用 25 USDC
```

编辑 token 列表：

```text
> 在 Monad 增加 token，地址是 0x0000000000000000000000000000000000000000
> 查询 Conflux eSpace 的 token 列表
> 把 Monad 的 DAI 地址修改为 0x1111111111111111111111111111111111111111
> 删除 Monad 上的 DAI
```

新增 token 时会通过 RPC 调用合约的 `name()`、`symbol()`、`decimals()` 读取元数据。如果读取失败，会拒绝添加，以避免把非 ERC20 合约写入 token 列表。

token 列表编辑是本地配置操作，会直接写入 `.wallet-token-list.json`，不会发起链上交易。

## Skills

项目支持通过 skill 扩展协议能力。当前已接入 `uniswap-v2` skill，配置位于：

```text
skills/uniswap-v2/config.json
```

当前 Uniswap V2 skill 只支持 Conflux，配置中需要提供 router、factory、wrappedNative 地址。router、factory 或 wrappedNative 仍为 0 地址时，pool、quote、swap 会拒绝执行。

当前 Uniswap V2 skill 支持：

```text
getUniswapV2PoolInfo
getUniswapV2Quote
prepareUniswapV2Swap
getUniswapV2LiquidityPosition
prepareUniswapV2AddLiquidity
prepareUniswapV2RemoveLiquidity
```

quote 和 swap preparation 支持：

```text
ERC20 -> ERC20
CFX -> ERC20
ERC20 -> CFX
```

报价和兑换准备会自动尝试直连路径，以及通过 `wrappedNative`、`USDT`、`USDC` 的多跳路径，并选择输出最多或输入最少的路径。默认最多经过 4 个池子，可以通过 `maxHops` 限制最大跳数。

支持 exact-in 和 exact-out 两种模式：

```text
exactIn：固定输入数量，计算预计输出和最少输出
exactOut：固定目标输出数量，计算预计输入和最大输入
```

当输入资产是 CFX 时，会使用 `swapExactETHForTokens` 或 `swapETHForExactTokens`，并把最大输入数量作为交易 `value`。当输出资产是 CFX 时，会使用 `swapExactTokensForETH` 或 `swapTokensForExactETH`。路径中的 CFX 会自动映射为 `wrappedNative` 地址。

报价和确认信息会展示执行价格、价格影响和最终选择的路径。交易确认后，如果 receipt 中包含 Uniswap V2 `Swap` 事件，会展示实际输出和成交路径。

swap preparation 如果发现输入 ERC20 allowance 不足，会自动生成 `approve + swap` 多步操作。多步操作每一步发送前都需要用户确认。如果输入资产是 CFX，则不需要 approve。

LP 支持：

```text
查询 LP position
准备添加 ERC20/ERC20 流动性
准备添加 CFX/ERC20 流动性
准备移除 ERC20/ERC20 流动性
准备移除 CFX/ERC20 流动性
```

添加流动性时，如果输入资产包含 ERC20，会检查该 ERC20 给 router 的 allowance；不足时会自动生成 `approve + addLiquidity` 多步操作。移除流动性时，会检查 LP token 给 router 的 allowance；不足时会自动生成 `approve LP + removeLiquidity` 多步操作。多步操作每一步发送前都需要用户确认。

自然语言示例：

```text
> 查一下在 Conflux 上 1 CFX 能换多少 USDT
> 查一下在 Conflux 上要拿到 100 USDT 需要多少 CFX
> 在 Conflux 上准备把 10 USDT 换成 CFX
> 在 Conflux 上准备把 0.5 CFX 换成 USDC，滑点 1%
> 在 Conflux 上准备最多花 1 CFX 换到 100 USDT
> 查询我在 Conflux 上 CFX/USDT 的 LP
> 在 Conflux 上给 CFX/USDT 添加 1 CFX 和 100 USDT 的流动性
> 在 Conflux 上移除 0.5 个 CFX/USDT LP
```

第三方 skill 编写说明见：

```text
doc/skill-authoring.md
```

准备转账：

```text
> 在 Conflux eSpace 转 0.1 CFX 给 0x0000000000000000000000000000000000000000
```

Agent 会先生成待确认交易计划，例如：

```text
即将执行 native 转账：
链：Conflux eSpace
发送方：0x...
接收方：0x...
数量：0.1 CFX
预估 gas：21000
预估费用：...

确认发送吗？输入“确认”发送，或输入“取消”放弃。
```

确认发送：

```text
> 确认
```

确认后程序会先广播交易，再等待交易 receipt。返回格式示例：

```text
交易已发送：0x...
链：Conflux eSpace
状态：成功
区块：123456
Gas Used：21000
浏览器：https://...
```

如果链上执行失败，会显示：

```text
状态：失败(reverted)
```

如果等待 receipt 超时或 RPC 查询失败，会显示：

```text
状态：等待确认
Receipt：等待确认失败或超时，交易可能仍在链上处理中
```

这种情况不代表交易失败，需要用交易 hash 或浏览器继续查询。

取消交易：

```text
> 取消
```

## 安全机制

写入链上状态的操作不会被 Agent 直接发送。当前交易流程分两步：

1. `prepareNativeTransfer`、ERC20 prepare 工具和 skill prepare 工具只生成交易计划，不签名、不发送。
2. 用户输入“确认”后，程序才会调用钱包发送交易。

当工具自动生成多步操作时，例如 `approve + swap`，每一步发送前都需要用户输入“确认”。如果某一步失败或等待 receipt 超时，后续步骤不会继续执行。

如果存在待确认交易或待确认多步操作，新的自然语言请求不会继续执行，必须先确认或取消当前操作。

## 可用脚本

```bash
npm run dev        # 使用 tsx 运行 CLI
npm run build      # 编译 TypeScript
npm start          # 运行 dist/cli/index.js
npm run typecheck  # 类型检查
npm run eval:nl    # 运行自然语言意图识别评测
```

## 自然语言意图识别评测

项目内置了一组自然语言测试用例，用于评估大模型是否能把用户输入识别到正确的 tool。

运行：

```bash
npm run eval:nl
```

评测会调用 `.env` 中配置的：

```text
OPENROUTER_API_KEY
OPENROUTER_MODEL
```

评测脚本使用 mock tools，不会访问 web3 RPC，不会签名，也不会发送交易。

覆盖场景包括：

```text
native 余额查询
账户信息和 nonce 查询
token 白名单查询
ERC20 余额查询
ERC20 allowance 查询
native 转账准备
ERC20 transfer 准备
ERC20 approve 准备
中英文和混合语言
缺失参数需要追问
当前不支持的失败场景
```

测试用例定义在：

```text
scripts/run-nl-intent-eval.ts
```

## Verbose 模式

默认情况下 CLI 只输出用户需要看到的结果。如果需要调试外部调用，可以使用 `--verbose`。

全局写法：

```bash
npm run dev -- --verbose chat
```

子命令写法：

```bash
npm run dev -- chat --verbose
npm run dev -- account --chain conflux --verbose
npm run dev -- balance --chain monad --verbose
```

RPC URL 会被脱敏，不会打印 query string、hash、username 或 password。私钥不会被打印。

## 链标识

CLI 参数中使用以下 chain key：

```text
conflux
monad
```

自然语言中可以使用：

```text
Conflux eSpace
Monad
```
