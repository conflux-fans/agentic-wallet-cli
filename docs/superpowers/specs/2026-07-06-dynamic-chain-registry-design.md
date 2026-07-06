# 动态链注册系统 (Dynamic Chain Registry)

日期: 2026-07-06
状态: 已批准设计,待实现计划

## 背景与问题

当前项目只支持 Conflux eSpace 和 Monad 两条链,且链信息以硬编码方式散落在整个代码库:

- `src/chains/index.ts` — `createChainRegistry` 写死两条链配置;`parseChainKey` 写死判断;`ChainKey` 是联合类型 `"conflux" | "monad"`
- `src/config/env.ts` + `src/cli/index.ts` — 每条链一组具名 env 字段(rpc / token / scan)手工透传
- 5 个工具文件各自重复 `const chainSchema = z.enum(["conflux", "monad"])`(`agent/tools/native.ts`、`erc20.ts`、`tokens.ts`、`history.ts`、`skills/sdk.ts`)
- `src/agent/session.ts:211` — `chain === "conflux" ? "CFX" : "MON"`(隐性 bug:多于两条链时 native symbol 显示错误)
- `src/agent/index.ts:131` — system prompt 里"当前只支持 …"的散文
- `src/tokens/index.ts` — 每条链的默认 token 地址硬编码

结果:**加一条链要改十几处**,直接卡住"用自然语言操作各种 web3 钱包"的产品目标。

## 目标

让"加一条链"退化为:**往一张链定义表加一项 + 在 `.env` 按约定加变量**,其余全部自动派生。

非目标(YAGNI):
- 不做项目外的 JSON/TS 外部配置文件
- 不改动 `ChainKey` 之外的架构(agent loop、确认机制、工具语义等)
- 不新增当前尚不需要的具体链

## 关键决策

1. **单一配置表驱动**:一张链定义表作为唯一真源,registry / env 装配 / 工具的 zod enum 全部从它派生。
2. **`ChainKey` → 运行时校验的 `string`**:放弃编译期穷尽检查,换取真正的可扩展性;非法链在运行时校验并报错。
3. **env 变量按链 key 约定派生**:`${KEY大写}_RPC_URL`、`${KEY}_USDT_ADDRESS`、`${KEY}_SCAN_API_URL` 等。现有 `.env` 变量名已符合此约定,**零迁移**。

## 架构

### 单一真源:链定义表

新增 `src/chains/definitions.ts`:

```ts
export type ChainDefinition = {
  key: string;                 // "conflux" —— 同时作为 env 变量前缀
  displayName: string;         // "Conflux eSpace"
  chainId: number;             // 1030
  nativeCurrency: { name: string; symbol: string; decimals: number };
  explorerUrl?: string;
  blockExplorerName?: string;
  defaultTokens?: Record<string, `0x${string}`>;  // { USDT: "0x..", USDC: "0x.." }
};

export const CHAIN_DEFINITIONS: ChainDefinition[] = [
  // conflux (id 1030, CFX, ConfluxScan, defaultTokens: USDT/USDC)
  // monad   (id 10143, MON, 无 explorer)
];
```

**加一条链 = 往此数组追加一项。**

### 类型与校验

- `ChainKey` 由联合类型改为 `string`。大量 `chain: ChainKey` 参数与 `Record<ChainKey, X>` 会自然放宽,预期可编译通过。
- 新增校验辅助(放在 `src/chains/index.ts`):
  - `isChainKey(registry, value): boolean`
  - `assertChainKey(registry, value): string` —— 非法时抛出 `Unsupported chain "x". Available: conflux, monad`,替代原 `parseChainKey`。
- `parseChainKey` 保留为薄封装或替换为 `assertChainKey`,由实现计划决定,保证 CLI 调用点行为不变。

### Registry 构建

`createChainRegistry` 改为遍历 `CHAIN_DEFINITIONS`,结合按约定派生的 rpcUrl 构建 viem `Chain` 对象。`ChainConfig` **新增 `nativeSymbol: string` 字段**(来自 `nativeCurrency.symbol`),供格式化层读取。

### env 约定派生

`src/config/env.ts`:
- 全局 env 保持不变:`OPENROUTER_API_KEY`、`OPENROUTER_MODEL`、`PRIVATE_KEY`。
- 按链遍历 `CHAIN_DEFINITIONS`,对每个 key 读取:
  - `${KEY}_RPC_URL`(必需,缺失抛错)
  - `${KEY}_${SYMBOL}_ADDRESS`(可选 token 覆盖,遍历该链 `defaultTokens` 的键)
  - `${KEY}_SCAN_API_URL` / `${KEY}_SCAN_API_KEY`(可选)
- 产出结构从"每链具名字段"改为 `Record<key, { rpcUrl: string; tokens: Record<string,`0x${string}`>; scan: { apiUrl?: string; apiKey?: string } }>`。
- `src/cli/index.ts` 的装配相应简化,不再逐链写字段。
- `.env.example` 按约定同步更新并注明"加链只需按 `${KEY}_RPC_URL` 追加"。

### 动态 zod enum

新增辅助 `chainEnumSchema(keys: string[])`(建议放 `src/chains/index.ts` 或 `src/agent/tools/` 下的共享文件):把运行时 `string[]` 转成 `z.enum([...keys] as [string, ...string[]])`。

- 5 个工具文件删除各自的 `z.enum(["conflux","monad"])`,改为在工具工厂内用 `chainEnumSchema(Object.keys(chains))` 生成。所有工具工厂已能拿到 `chains` 或 `wallet.chains`。
- **skill 保留声明更窄链子集的能力**:`uniswap-v2` 的 swap 只支持部分链是合理的,用 `chainEnumSchema(Object.keys(UNISWAP_V2_CONFIG))` 传子集,而非全部链。

### 格式化层修复

`src/agent/session.ts` 的 `formatNativeTransactionAmount` 删除 `chain === "conflux" ? "CFX" : "MON"`,改为从链配置的 `nativeSymbol` 读取。实现方式(线程 registry 进格式化函数,或在 plan 上携带 `nativeSymbol`)由实现计划确定;二者皆可,优先改动最小、不破坏现有调用点的方案。

### tokens 与 system prompt

- `src/tokens/index.ts`:默认 token 地址来源改为链定义表的 `defaultTokens`;registry 遍历链 key 构建,env 覆盖优先。
- `src/agent/index.ts`:system prompt 中"当前只支持 …"一行从 registry 的 key 动态生成。

## 数据流

```
CHAIN_DEFINITIONS (真源)
        │
        ├─► env.ts ── 按 key 约定读取 rpc/token/scan ──► AppEnv.chains
        │
        └─► createChainRegistry(definitions, env.chains) ──► Record<key, ChainConfig(+nativeSymbol)>
                    │
                    ├─► 工具工厂 chainEnumSchema(Object.keys(chains)) ──► LLM 可选链动态化
                    ├─► tokens registry / system prompt / CLI help ──► 动态派生
                    └─► session 格式化 ──► nativeSymbol 正确显示
```

## 错误处理

- 某链缺 `${KEY}_RPC_URL`:`loadEnv` 抛出明确错误,指出缺失的变量名。
- LLM 或 CLI 传入未知链 key:`assertChainKey` 抛出错误并列出可用链。
- token 地址 / scan 变量缺失:按现有"可选"语义静默降级。

## 测试策略 (TDD)

单元测试覆盖:
- `createChainRegistry`:能为 `CHAIN_DEFINITIONS` 中每条链建出配置;某链缺 RPC 时抛错;`nativeSymbol` 正确。
- `assertChainKey` / `isChainKey`:合法链通过、非法链抛错且错误信息含可用链列表。
- env 约定派生:给定一组 `${KEY}_*` 环境变量能正确产出 `AppEnv.chains`。
- `chainEnumSchema`:给定 keys 生成的 schema 接受这些 key、拒绝其他值。
- session native symbol:多链场景下 `formatNativeTransactionAmount` 显示对应链的 symbol(回归 `conflux==CFX` bug)。

## 验收标准

1. 新增一条链只需:在 `CHAIN_DEFINITIONS` 加一项 + `.env` 按约定加 `${KEY}_RPC_URL`(及可选 token/scan)。无需改动任何工具文件、session、tokens、system prompt。
2. 现有 `.env` 无需任何改动即可继续运行(零迁移)。
3. 全部现有功能(余额/转账/ERC20/地址簿/历史/uniswap swap)行为不变。
4. `tsc` 通过,新增单元测试通过。
