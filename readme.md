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

暂不支持：

1. Uniswap V2
2. LayerZero 跨链
3. 交易历史
4. 地址簿
5. skill 插件系统

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
```

`PRIVATE_KEY` 可以带 `0x` 前缀，也可以不带。

token 地址是可选配置。未配置时，白名单仍会显示 USDT/USDC，但地址会显示为“未配置”。

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

写入链上状态的操作不会被 Agent 直接发送。当前转账流程分两步：

1. `prepareNativeTransfer` 只生成交易计划，不签名、不发送。
2. 用户输入“确认”后，程序才会调用钱包发送交易。

如果存在待确认交易，新的自然语言请求不会继续执行，必须先确认或取消当前交易。

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
