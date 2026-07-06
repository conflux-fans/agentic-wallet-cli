# Dynamic Chain Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make adding a new EVM chain a matter of appending one entry to a chain-definitions table plus setting convention-named env vars, with everything else (registry, env parsing, tool schemas, token defaults, prompt text) derived automatically.

**Architecture:** Introduce `src/chains/definitions.ts` as the single source of truth (`CHAIN_DEFINITIONS`). `ChainKey` becomes a runtime-validated `string`. `createChainRegistry`, `loadEnv`, the token registry, and every agent/skill `z.enum` chain schema derive from that table. A new `chainEnumSchema(keys)` helper turns a runtime `string[]` into a zod enum.

**Tech Stack:** TypeScript (ESM, `"type": "module"`), viem, zod v4, ai SDK v7. Tests use Node's built-in test runner (`node:test` + `node:assert/strict`) run through `tsx` — no new dependency.

## Global Constraints

- Language/runtime: TypeScript ESM; all intra-project imports use the `.js` extension (e.g. `import { x } from "../chains/index.js"`).
- Zero migration: existing `.env` (`CONFLUX_RPC_URL`, `MONAD_RPC_URL`, `CONFLUX_USDT_ADDRESS`, `CONFLUX_SCAN_API_URL`, etc.) must keep working unchanged. The env convention is `${KEY_UPPERCASE}_...` and the current names already match.
- No behavior change to existing features (balance/transfer/ERC20/address-book/history/uniswap swap).
- Token defaults must preserve current values: USDT `name="Tether USD" decimals=6`, USDC `name="USD Coin" decimals=6`.
- Test command (per file): `node --import tsx --test <path-to-test.ts>`.
- Final integration gate: `npm run typecheck` (i.e. `tsc --noEmit`) must pass.
- Commit after each task. End commit messages with the Co-Authored-By trailer already used in this repo.

---

### Task 1: Chain definitions table + chains module refactor

**Files:**
- Create: `src/chains/definitions.ts`
- Modify: `src/chains/index.ts` (full rewrite of exports below)
- Modify: `package.json` (add `test` script)
- Test: `src/chains/index.test.ts`

**Interfaces:**
- Consumes: nothing (foundation task).
- Produces:
  - `src/chains/definitions.ts`:
    - `type TokenDefinition = { name: string; decimals: number; address: ` + "`0x${string}`" + ` }`
    - `type ChainDefinition = { key: string; displayName: string; chainId: number; nativeCurrency: { name: string; symbol: string; decimals: number }; explorerUrl?: string; blockExplorerName?: string; defaultScanApiUrl?: string; defaultTokens?: Record<string, TokenDefinition> }`
    - `const CHAIN_DEFINITIONS: ChainDefinition[]`
  - `src/chains/index.ts`:
    - `type ChainKey = string`
    - `type ChainConfig = { key: string; displayName: string; nativeSymbol: string; chain: import("viem").Chain; rpcUrl: string; explorerUrl?: string }`
    - `type ChainEnvConfig = { rpcUrl: string; tokens: Record<string, ` + "`0x${string}`" + `>; scan: { apiUrl?: string; apiKey?: string } }`
    - `function createChainRegistry(rpcUrls: Record<string, string>): Record<string, ChainConfig>`
    - `function isChainKey(registry: Record<string, ChainConfig>, value: string): boolean`
    - `function assertChainKey(registry: Record<string, ChainConfig>, value: string): string`
    - `function chainEnumSchema(keys: string[]): ReturnType<typeof buildEnum>` (see step 3 — exported as `z.enum` wrapper)
    - `function chainKeys(): string[]` (returns `CHAIN_DEFINITIONS.map(d => d.key)`)

- [ ] **Step 1: Add the `test` script to package.json**

In `package.json`, add to `"scripts"` (after `"typecheck"`):

```json
    "test": "node --import tsx --test \"src/**/*.test.ts\"",
```

- [ ] **Step 2: Write `src/chains/definitions.ts`**

Move the hardcoded chain metadata + default token addresses (currently in `src/chains/index.ts` and `src/tokens/index.ts:24-27`) into the table:

```ts
export type TokenDefinition = {
  name: string;
  decimals: number;
  address: `0x${string}`;
};

export type ChainDefinition = {
  key: string;
  displayName: string;
  chainId: number;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  explorerUrl?: string;
  blockExplorerName?: string;
  defaultScanApiUrl?: string;
  defaultTokens?: Record<string, TokenDefinition>;
};

export const CHAIN_DEFINITIONS: ChainDefinition[] = [
  {
    key: "conflux",
    displayName: "Conflux eSpace",
    chainId: 1030,
    nativeCurrency: { name: "CFX", symbol: "CFX", decimals: 18 },
    explorerUrl: "https://evm.confluxscan.io",
    blockExplorerName: "ConfluxScan",
    defaultScanApiUrl: "https://evmapi.confluxscan.io/api",
    defaultTokens: {
      USDT: { name: "Tether USD", decimals: 6, address: "0xaf37e8b6c9ed7f6318979f56fc287d76c30847ff" },
      USDC: { name: "USD Coin", decimals: 6, address: "0x6963efed0ab40f6c3d7bda44a05dcf1437c44372" }
    }
  },
  {
    key: "monad",
    displayName: "Monad",
    chainId: 10143,
    nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
    defaultTokens: {
      USDT: { name: "Tether USD", decimals: 6, address: "0xe7cd86e13AC4309349F30B3435a9d337750fC82D" },
      USDC: { name: "USD Coin", decimals: 6, address: "0x754704Bc059F8C67012fEd69BC8A327a5aafb603" }
    }
  }
];
```

- [ ] **Step 3: Write the failing test `src/chains/index.test.ts`**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createChainRegistry,
  isChainKey,
  assertChainKey,
  chainEnumSchema,
  chainKeys
} from "./index.js";

const rpcUrls = { conflux: "https://cfx.example", monad: "https://monad.example" };

test("createChainRegistry builds every defined chain with rpc + nativeSymbol", () => {
  const registry = createChainRegistry(rpcUrls);
  assert.deepEqual(chainKeys().sort(), ["conflux", "monad"]);
  assert.equal(registry.conflux.rpcUrl, "https://cfx.example");
  assert.equal(registry.conflux.nativeSymbol, "CFX");
  assert.equal(registry.monad.nativeSymbol, "MON");
  assert.equal(registry.conflux.chain.id, 1030);
  assert.equal(registry.conflux.explorerUrl, "https://evm.confluxscan.io");
});

test("createChainRegistry throws when a defined chain is missing its rpc url", () => {
  assert.throws(
    () => createChainRegistry({ conflux: "https://cfx.example" }),
    /monad/i
  );
});

test("isChainKey / assertChainKey validate against the registry", () => {
  const registry = createChainRegistry(rpcUrls);
  assert.equal(isChainKey(registry, "conflux"), true);
  assert.equal(isChainKey(registry, "nope"), false);
  assert.equal(assertChainKey(registry, "monad"), "monad");
  assert.throws(() => assertChainKey(registry, "nope"), /conflux, monad/);
});

test("chainEnumSchema accepts listed keys and rejects others", () => {
  const schema = chainEnumSchema(["conflux", "monad"]);
  assert.equal(schema.parse("conflux"), "conflux");
  assert.throws(() => schema.parse("nope"));
});
```

- [ ] **Step 4: Run the test, verify it fails**

Run: `node --import tsx --test src/chains/index.test.ts`
Expected: FAIL (functions not yet exported / old signatures).

- [ ] **Step 5: Rewrite `src/chains/index.ts`**

```ts
import { z } from "zod";
import type { Chain } from "viem";
import { CHAIN_DEFINITIONS } from "./definitions.js";

export type ChainKey = string;

export type ChainConfig = {
  key: string;
  displayName: string;
  nativeSymbol: string;
  chain: Chain;
  rpcUrl: string;
  explorerUrl?: string;
};

export type ChainEnvConfig = {
  rpcUrl: string;
  tokens: Record<string, `0x${string}`>;
  scan: { apiUrl?: string; apiKey?: string };
};

export function chainKeys(): string[] {
  return CHAIN_DEFINITIONS.map((d) => d.key);
}

export function createChainRegistry(rpcUrls: Record<string, string>): Record<string, ChainConfig> {
  const registry: Record<string, ChainConfig> = {};
  for (const def of CHAIN_DEFINITIONS) {
    const rpcUrl = rpcUrls[def.key];
    if (!rpcUrl) {
      throw new Error(`Missing RPC URL for chain "${def.key}"`);
    }
    const chain: Chain = {
      id: def.chainId,
      name: def.displayName,
      nativeCurrency: def.nativeCurrency,
      rpcUrls: { default: { http: [rpcUrl] } },
      ...(def.explorerUrl
        ? {
            blockExplorers: {
              default: { name: def.blockExplorerName ?? "Explorer", url: def.explorerUrl }
            }
          }
        : {})
    };
    registry[def.key] = {
      key: def.key,
      displayName: def.displayName,
      nativeSymbol: def.nativeCurrency.symbol,
      rpcUrl,
      explorerUrl: def.explorerUrl,
      chain
    };
  }
  return registry;
}

export function isChainKey(registry: Record<string, ChainConfig>, value: string): boolean {
  return Object.prototype.hasOwnProperty.call(registry, value);
}

export function assertChainKey(registry: Record<string, ChainConfig>, value: string): string {
  if (!isChainKey(registry, value)) {
    throw new Error(`Unsupported chain "${value}". Available: ${Object.keys(registry).join(", ")}`);
  }
  return value;
}

export function chainEnumSchema(keys: string[]) {
  return z.enum(keys as [string, ...string[]]);
}
```

Note: `parseChainKey` is intentionally removed; callers migrate to `assertChainKey` in Task 8.

- [ ] **Step 6: Run the test, verify it passes**

Run: `node --import tsx --test src/chains/index.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 7: Commit**

```bash
git add package.json src/chains/definitions.ts src/chains/index.ts src/chains/index.test.ts
git commit -m "feat(chains): config-table-driven registry + dynamic chain validation

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Convention-based env loading

**Files:**
- Modify: `src/config/env.ts` (full rewrite of `AppEnv` + `loadEnv`)
- Test: `src/config/env.test.ts`

**Interfaces:**
- Consumes: `ChainEnvConfig`, `chainKeys` from Task 1; `CHAIN_DEFINITIONS` from `src/chains/definitions.js`.
- Produces:
  - `type AppEnv = { openRouterApiKey: string; openRouterModel: string; privateKey: ` + "`0x${string}`" + `; chains: Record<string, ChainEnvConfig> }`
  - `function loadEnv(): AppEnv`

- [ ] **Step 1: Write the failing test `src/config/env.test.ts`**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadEnv } from "./env.js";

function withEnv(vars: Record<string, string | undefined>, fn: () => void) {
  const saved: Record<string, string | undefined> = {};
  for (const k of Object.keys(vars)) saved[k] = process.env[k];
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

const base = {
  OPENROUTER_API_KEY: "key",
  PRIVATE_KEY: "0x" + "1".repeat(64),
  CONFLUX_RPC_URL: "https://cfx.example",
  MONAD_RPC_URL: "https://monad.example"
};

test("loadEnv derives per-chain config from convention-named vars", () => {
  withEnv({ ...base, CONFLUX_USDT_ADDRESS: "0x" + "a".repeat(40), CONFLUX_SCAN_API_KEY: "sk" }, () => {
    const env = loadEnv();
    assert.equal(env.chains.conflux.rpcUrl, "https://cfx.example");
    assert.equal(env.chains.monad.rpcUrl, "https://monad.example");
    assert.equal(env.chains.conflux.tokens.USDT, "0x" + "a".repeat(40));
    // conflux keeps its default scan api url from the definition
    assert.equal(env.chains.conflux.scan.apiUrl, "https://evmapi.confluxscan.io/api");
    assert.equal(env.chains.conflux.scan.apiKey, "sk");
  });
});

test("loadEnv throws when a chain's RPC url is missing", () => {
  withEnv({ ...base, MONAD_RPC_URL: undefined }, () => {
    assert.throws(() => loadEnv(), /MONAD_RPC_URL/);
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `node --import tsx --test src/config/env.test.ts`
Expected: FAIL (`env.chains` undefined).

- [ ] **Step 3: Rewrite `src/config/env.ts`**

```ts
import "dotenv/config";
import { CHAIN_DEFINITIONS } from "../chains/definitions.js";
import type { ChainEnvConfig } from "../chains/index.js";

export type AppEnv = {
  openRouterApiKey: string;
  openRouterModel: string;
  privateKey: `0x${string}`;
  chains: Record<string, ChainEnvConfig>;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function normalizePrivateKey(value: string): `0x${string}` {
  const normalized = value.startsWith("0x") ? value : `0x${value}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Error("PRIVATE_KEY must be a 32-byte hex private key");
  }
  return normalized as `0x${string}`;
}

function optionalAddress(name: string): `0x${string}` | undefined {
  const value = process.env[name];
  if (!value) {
    return undefined;
  }
  const normalized = value.startsWith("0x") ? value : `0x${value}`;
  if (!/^0x[0-9a-fA-F]{40}$/.test(normalized)) {
    throw new Error(`${name} must be a 20-byte EVM address`);
  }
  return normalized as `0x${string}`;
}

export function loadEnv(): AppEnv {
  const chains: Record<string, ChainEnvConfig> = {};
  for (const def of CHAIN_DEFINITIONS) {
    const KEY = def.key.toUpperCase();
    const tokens: Record<string, `0x${string}`> = {};
    for (const symbol of Object.keys(def.defaultTokens ?? {})) {
      const override = optionalAddress(`${KEY}_${symbol}_ADDRESS`);
      if (override) {
        tokens[symbol] = override;
      }
    }
    chains[def.key] = {
      rpcUrl: requireEnv(`${KEY}_RPC_URL`),
      tokens,
      scan: {
        apiUrl: process.env[`${KEY}_SCAN_API_URL`] || def.defaultScanApiUrl,
        apiKey: process.env[`${KEY}_SCAN_API_KEY`]
      }
    };
  }

  return {
    openRouterApiKey: requireEnv("OPENROUTER_API_KEY"),
    openRouterModel: process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini",
    privateKey: normalizePrivateKey(requireEnv("PRIVATE_KEY")),
    chains
  };
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `node --import tsx --test src/config/env.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/config/env.ts src/config/env.test.ts
git commit -m "feat(env): derive per-chain config from \${KEY}_* convention

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Token registry from definitions

**Files:**
- Modify: `src/tokens/index.ts` (`TokenRegistryInput`, constants, `createTokenRegistry`)
- Test: `src/tokens/index.test.ts`

**Interfaces:**
- Consumes: `CHAIN_DEFINITIONS` from `src/chains/definitions.js`; `ChainKey` from `src/chains/index.js`.
- Produces:
  - `function createTokenRegistry(overrides: Record<string, Record<string, ` + "`0x${string}`" + `>>): TokenRegistry` — outer key = chain key, inner key = token symbol, value = address override.
  - `TokenRegistry`, `TokenConfig`, and all existing whitelist functions keep their current signatures (they already use `chain: ChainKey`, which is now `string`).

- [ ] **Step 1: Write the failing test `src/tokens/index.test.ts`**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { createTokenRegistry } from "./index.js";

test("createTokenRegistry seeds defaults from chain definitions", () => {
  const registry = createTokenRegistry({});
  assert.equal(registry.conflux.USDT.name, "Tether USD");
  assert.equal(registry.conflux.USDT.decimals, 6);
  assert.equal(registry.conflux.USDT.address, "0xaf37e8b6c9ed7f6318979f56fc287d76c30847ff");
  assert.equal(registry.monad.USDC.name, "USD Coin");
});

test("createTokenRegistry applies address overrides", () => {
  const override = ("0x" + "b".repeat(40)) as `0x${string}`;
  const registry = createTokenRegistry({ conflux: { USDT: override } });
  assert.equal(registry.conflux.USDT.address, override);
  // untouched token keeps its default
  assert.equal(registry.conflux.USDC.address, "0x6963efed0ab40f6c3d7bda44a05dcf1437c44372");
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `node --import tsx --test src/tokens/index.test.ts`
Expected: FAIL (old `createTokenRegistry` signature expects named fields).

- [ ] **Step 3: Edit `src/tokens/index.ts`**

Replace the import at line 4, the `TokenRegistryInput` type (lines 17-22), the four `DEFAULT_*` constants (lines 24-27), and `createTokenRegistry` (lines 33-76). Delete `createToken` (lines 167-178) since defaults now carry name/decimals.

New import block (top of file):

```ts
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { isAddress, type Address } from "viem";
import type { ChainKey } from "../chains/index.js";
import { CHAIN_DEFINITIONS } from "../chains/definitions.js";
```

Replace `TokenRegistryInput` + constants with nothing (delete them), and rewrite `createTokenRegistry`:

```ts
export function createTokenRegistry(
  overrides: Record<string, Record<string, `0x${string}`>>
): TokenRegistry {
  const registry: TokenRegistry = {};
  for (const def of CHAIN_DEFINITIONS) {
    const chainTokens: Record<string, TokenConfig> = {};
    for (const [symbol, token] of Object.entries(def.defaultTokens ?? {})) {
      chainTokens[symbol] = {
        symbol,
        name: token.name,
        decimals: token.decimals,
        address: overrides[def.key]?.[symbol] ?? token.address
      };
    }
    registry[def.key] = chainTokens;
  }

  const file = loadTokenListFile();
  for (const chain of Object.keys(registry) as ChainKey[]) {
    const chainFile = file.chains?.[chain];
    for (const removedSymbol of chainFile?.removedSymbols ?? []) {
      delete registry[chain][normalizeSymbol(removedSymbol)];
    }
    for (const token of Object.values(chainFile?.tokens ?? {})) {
      registry[chain][normalizeSymbol(token.symbol)] = {
        ...token,
        symbol: normalizeSymbol(token.symbol)
      };
    }
  }

  return registry;
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `node --import tsx --test src/tokens/index.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/tokens/index.ts src/tokens/index.test.ts
git commit -m "feat(tokens): seed registry from chain definitions + address overrides

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Carry native symbol on transaction plans

**Files:**
- Modify: `src/wallet/client.ts` (plan types + the four `prepare*` builders + `prepareContractCall`)
- Test: `src/wallet/plan-native-symbol.test.ts`

**Interfaces:**
- Consumes: `ChainConfig.nativeSymbol` from Task 1.
- Produces: every `TransactionPlan` variant gains `nativeSymbol: string`. Specifically add `nativeSymbol: string` to `NativeTransferPlan`, `Erc20TransferPlan`, `Erc20ApprovePlan`, `ContractCallPlan`.

- [ ] **Step 1: Write the failing test `src/wallet/plan-native-symbol.test.ts`**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import type { NativeTransferPlan } from "./client.js";

test("NativeTransferPlan type carries nativeSymbol", () => {
  const plan: NativeTransferPlan = {
    id: "1",
    kind: "native-transfer",
    chain: "monad",
    chainName: "Monad",
    nativeSymbol: "MON",
    from: "0x0000000000000000000000000000000000000001",
    to: "0x0000000000000000000000000000000000000002",
    amount: "1",
    symbol: "MON",
    value: 1n,
    estimatedGas: 21000n,
    estimatedFee: 21000n
  };
  assert.equal(plan.nativeSymbol, "MON");
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `node --import tsx --test src/wallet/plan-native-symbol.test.ts`
Expected: FAIL (excess property `nativeSymbol` / type error at compile → tsx throws).

- [ ] **Step 3: Edit `src/wallet/client.ts`**

Add `nativeSymbol: string;` to each of the four plan type definitions (`NativeTransferPlan` ~line 79, `Erc20TransferPlan` ~line 93, `Erc20ApprovePlan` ~line 109, `ContractCallPlan` ~line 125).

In each builder, populate it from the chain config. In every `prepare*` function the local `config` is `ctx.chains[input.chain]` (or `ctx.chains[chainKey]`), so add `nativeSymbol: config.nativeSymbol,` to each returned object:
- `prepareNativeTransfer` return (~line 320)
- `prepareErc20Transfer` return (~line 451)
- `prepareErc20Approve` return (~line 509)
- `prepareContractCall` return (~line 566)

Example for `prepareNativeTransfer`'s returned object — add the field alongside the others:

```ts
  return {
    id: input.id,
    kind: "native-transfer",
    chain: input.chain,
    chainName: config.displayName,
    nativeSymbol: config.nativeSymbol,
    from: ctx.account.address,
    to: input.to,
    amount: input.amount,
    symbol: config.chain.nativeCurrency.symbol,
    value,
    estimatedGas,
    estimatedFee: estimatedGas * gasPrice
  };
```

Apply the same one-line addition (`nativeSymbol: config.nativeSymbol,`) to the other three builders' returned objects.

- [ ] **Step 4: Run the test, verify it passes**

Run: `node --import tsx --test src/wallet/plan-native-symbol.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/wallet/client.ts src/wallet/plan-native-symbol.test.ts
git commit -m "feat(wallet): carry nativeSymbol on every transaction plan

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Fix native symbol formatting in the session

**Files:**
- Modify: `src/agent/session.ts` (`formatNativeTransactionAmount` + its call sites)
- Test: `src/agent/session-format.test.ts`

**Interfaces:**
- Consumes: `TransactionPlan.nativeSymbol` from Task 4.
- Produces: `formatNativeTransactionAmount(symbol: string, value: bigint): string` (signature changes from `(chain, value)` to `(symbol, value)`).

- [ ] **Step 1: Write the failing test `src/agent/session-format.test.ts`**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatTransactionPlan } from "./session.js";
import type { NativeTransferPlan } from "../wallet/client.js";

const monadPlan: NativeTransferPlan = {
  id: "1",
  kind: "native-transfer",
  chain: "monad",
  chainName: "Monad",
  nativeSymbol: "MON",
  from: "0x0000000000000000000000000000000000000001",
  to: "0x0000000000000000000000000000000000000002",
  amount: "1",
  symbol: "MON",
  value: 1_000_000_000_000_000_000n,
  estimatedGas: 21000n,
  estimatedFee: 21_000_000_000_000n
};

test("formatTransactionPlan renders the chain's native symbol for fees", () => {
  const out = formatTransactionPlan(monadPlan);
  assert.match(out, /MON/);
  assert.doesNotMatch(out, /CFX/);
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `node --import tsx --test src/agent/session-format.test.ts`
Expected: FAIL (current code prints `CFX`/`MON` via `chain === "conflux"` ternary — a monad plan currently maps to `MON` by luck, but the fee line for non-native plans and any 3rd chain would break; this test locks the behavior to `nativeSymbol`). If it happens to pass on the ternary, Step 3 still required — proceed.

- [ ] **Step 3: Edit `src/agent/session.ts`**

Change the helper (lines 210-213) from taking `chain` to taking a symbol:

```ts
function formatNativeTransactionAmount(symbol: string, value: bigint): string {
  return `${padNativeDecimals(formatUnits(value, 18))} ${symbol}`;
}
```

Update all call sites inside `formatTransactionPlan` (lines 85, 87, 103, 119, 132) to pass `plan.nativeSymbol` instead of `plan.chain`. For example line 85 becomes:

```ts
      `Value：${formatNativeTransactionAmount(plan.nativeSymbol, plan.value)}`,
```

and the `预估费用` lines become:

```ts
      `预估费用：${formatNativeTransactionAmount(plan.nativeSymbol, plan.estimatedFee)}`,
```

Remove the now-unused `import type { ChainKey }` at line 2 if it is no longer referenced (check: `ChainKey` was only used by the old helper signature). Keep the `formatUnits` import.

- [ ] **Step 4: Run the test, verify it passes**

Run: `node --import tsx --test src/agent/session-format.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/agent/session.ts src/agent/session-format.test.ts
git commit -m "fix(session): render native symbol from plan, not conflux/monad ternary

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Dynamic chain enum in agent tools

**Files:**
- Modify: `src/agent/tools/native.ts`
- Modify: `src/agent/tools/erc20.ts`
- Modify: `src/agent/tools/tokens.ts`
- Modify: `src/agent/tools/history.ts`
- Test: `src/agent/tools/native.test.ts`

**Interfaces:**
- Consumes: `chainEnumSchema` from `src/chains/index.js`; each tool factory already receives the chain set (via `wallet.chains` or a `chains` param).
- Produces: no signature changes to the tool factories. Each replaces its local `const chainSchema = z.enum(["conflux","monad"])` with a `chainSchema` built from the available chain keys at factory-call time.

For each of the four files, apply this pattern:

1. Remove the module-level `const chainSchema = z.enum(["conflux", "monad"]);` and the `toChainKey` helper (replace `toChainKey(chain)` usages with `chain` directly — the value is already a valid key string).
2. Add `import { chainEnumSchema } from "../../chains/index.js";` (keep the existing `import type { ChainKey }`).
3. At the top of the exported factory function body, derive the schema from the chains available to that factory:
   - `native.ts` (`createNativeTools(ctx, session, addressBook)`): `const chainSchema = chainEnumSchema(Object.keys(ctx.chains));`
   - `erc20.ts` (`createErc20Tools(wallet, tokens, session, addressBook)`): `const chainSchema = chainEnumSchema(Object.keys(wallet.chains));`
   - `tokens.ts` (`createTokenTools(registry, chains, logger)`): `const chainSchema = chainEnumSchema(Object.keys(chains));`
   - `history.ts` (`createHistoryTools(wallet, tokens, scanApis)`): `const chainSchema = chainEnumSchema(Object.keys(wallet.chains));`
4. Every `inputSchema` that referenced the old module-level `chainSchema` now references the local one (no textual change needed beyond it being in scope). Replace calls like `toChainKey(chain)` with `chain`.

- [ ] **Step 1: Write the failing test `src/agent/tools/native.test.ts`**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNativeTools } from "./native.js";
import { createChainRegistry } from "../../chains/index.js";
import { createAgentSession } from "../session.js";

function fakeCtx() {
  const chains = createChainRegistry({ conflux: "https://cfx.example", monad: "https://monad.example" });
  return {
    account: { address: "0x0000000000000000000000000000000000000001" },
    chains,
    logger: { log() {} }
  } as any;
}

test("native tools expose a chain enum derived from the registry", () => {
  const tools = createNativeTools(fakeCtx(), createAgentSession());
  const schema = (tools.getNativeBalance as any).inputSchema;
  const parsed = schema.parse({ chain: "monad" });
  assert.equal(parsed.chain, "monad");
  assert.throws(() => schema.parse({ chain: "ethereum" }));
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `node --import tsx --test src/agent/tools/native.test.ts`
Expected: FAIL (schema still hardcoded / `toChainKey` still present — test asserting rejection of `ethereum` may pass, but acceptance test structure requires the factory-local schema; if it already passes, still do Step 3 to remove the hardcode).

- [ ] **Step 3: Apply the pattern to all four tool files**

Edit `native.ts`, `erc20.ts`, `tokens.ts`, `history.ts` exactly as described in the four bullet points above. Concretely for `native.ts`:
- Delete lines 16-20 (`const chainSchema = z.enum([...])` and `toChainKey`).
- Add `import { chainEnumSchema } from "../../chains/index.js";`.
- After `export function createNativeTools(ctx, session, addressBook) {` insert:
  `const chainSchema = chainEnumSchema(Object.keys(ctx.chains));`
- Replace `toChainKey(chain)` at lines 63, 85, 108 with `chain`.

Repeat analogously in the other three files (their `toChainKey` call sites are: `erc20.ts` uses `const chainKey = toChainKey(chain)` → `const chainKey = chain`; `tokens.ts` lines 40/61/88/107; `history.ts` lines 72/103).

- [ ] **Step 4: Run the test, verify it passes**

Run: `node --import tsx --test src/agent/tools/native.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/agent/tools/native.ts src/agent/tools/erc20.ts src/agent/tools/tokens.ts src/agent/tools/history.ts src/agent/tools/native.test.ts
git commit -m "feat(tools): derive chain enum from registry instead of hardcoded list

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Dynamic chain enum in the skill SDK and uniswap skill

**Files:**
- Modify: `src/skills/sdk.ts` (line 111 enum; the `chain` field type at line 49)
- Modify: `src/skills/uniswap-v2.ts` (line 264 enum; keep the narrower supported subset)

**Interfaces:**
- Consumes: `chainEnumSchema` from `src/chains/index.js`.
- Produces: skill context chain schema derived from the chains passed into the skill context; uniswap's own `chainSchema` derived from `Object.keys(UNISWAP_V2_CONFIG)` (its genuinely-narrower supported set).

- [ ] **Step 1: Edit `src/skills/sdk.ts`**

- Add `import { chainEnumSchema } from "../chains/index.js";` (near the existing chains import).
- Replace the hardcoded `z.enum(["conflux", "monad"])` (line 111) with `chainEnumSchema(Object.keys(input.chains))` — use whatever the in-scope variable holding the chains registry is named at that point (it is the `chains` provided to `createSkillContext`).
- Change the `chain` field type (line 49) from `z.ZodEnum<{ conflux: "conflux"; monad: "monad" }>` to `ReturnType<typeof chainEnumSchema>`.

- [ ] **Step 2: Edit `src/skills/uniswap-v2.ts`**

- Add `import { chainEnumSchema } from "../chains/index.js";` (near line 13's chains import).
- Replace `const chainSchema = z.enum(["conflux"]);` (line 264) with `const chainSchema = chainEnumSchema(Object.keys(UNISWAP_V2_CONFIG));`.
- Replace the `chain as ChainKey` casts (lines 283, 344, 388, 479, 520, 608) with `chain` (already `string`, which is `ChainKey`). These are now redundant casts; leaving them compiles too, but remove for clarity.

- [ ] **Step 3: Typecheck the two files' module graph**

Run: `node --import tsx --test src/chains/index.test.ts`
(Re-runs the chains suite to confirm the shared helper still behaves; the skill files have no standalone unit test — they are covered by the full typecheck gate in Task 8.)
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/skills/sdk.ts src/skills/uniswap-v2.ts
git commit -m "feat(skills): derive chain enums from registry / skill-supported subset

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: Wire CLI + system prompt + env example, then integration gate

**Files:**
- Modify: `src/cli/index.ts` (`createRuntime`, `parseChainKey` → `assertChainKey`, `resolveCliToken` signature, `.requiredOption` help text)
- Modify: `src/agent/index.ts` (dynamic supported-chains line in the system prompt)
- Modify: `.env.example`
- Modify: `src/cli/format.ts` (only if it imports removed symbols — verify)

**Interfaces:**
- Consumes: `createChainRegistry`, `assertChainKey`, `chainKeys` (Task 1); `AppEnv.chains` (Task 2); `createTokenRegistry(overrides)` (Task 3).
- Produces: no new exported interfaces; final integration.

- [ ] **Step 1: Rewrite `createRuntime` in `src/cli/index.ts`**

Update the import on line 6 to `import { assertChainKey, createChainRegistry, chainKeys } from "../chains/index.js";`.

Replace `createRuntime` (lines 38-64) with:

```ts
function createRuntime(verbose: boolean) {
  const env = loadEnv();
  const logger = createLogger(verbose);
  const rpcUrls: Record<string, string> = {};
  const tokenOverrides: Record<string, Record<string, `0x${string}`>> = {};
  const scanApis: ScanApiConfig = {};
  for (const [key, chainEnv] of Object.entries(env.chains)) {
    rpcUrls[key] = chainEnv.rpcUrl;
    tokenOverrides[key] = chainEnv.tokens;
    scanApis[key] = { apiUrl: chainEnv.scan.apiUrl, apiKey: chainEnv.scan.apiKey };
  }
  const chains = createChainRegistry(rpcUrls);
  const tokens = createTokenRegistry(tokenOverrides);
  const addressBook = createAddressBook();
  const wallet = createWalletContext(env.privateKey, chains, logger);
  return { env, chains, tokens, addressBook, wallet, scanApis };
}
```

- [ ] **Step 2: Replace `parseChainKey` usage in `src/cli/index.ts`**

`assertChainKey` needs the registry. The command actions call `parseChainKey(options.chain)` (lines 184, 209, 226, 252, 291) before/while they have a runtime. Each command action builds a runtime via `createRuntime`. Change each `parseChainKey(options.chain)` to `assertChainKey(runtime.chains, options.chain)` using the runtime already created in that action (inspect each action; they call `createRuntime(...)` and destructure `chains`). Update `resolveCliToken`'s second parameter type from `ReturnType<typeof parseChainKey>` to `string` (line 85). Update the five `.requiredOption("-c, --chain <chain>", "chain key: conflux or monad")` help strings (lines 172, 197, 222, 237, 274) to `` `chain key: ${chainKeys().join(" | ")}` ``.

- [ ] **Step 3: Make the system prompt chain line dynamic in `src/agent/index.ts`**

Replace the static line 131 `"当前只支持 Conflux eSpace(conflux) 和 Monad(monad)。",` with a generated line built from the `chains` param already passed into `handleUserInput`:

```ts
    `当前支持的链：${Object.values(chains).map((c) => `${c.displayName}(${c.key})`).join("、")}。`,
```

- [ ] **Step 4: Update `.env.example`**

Ensure it documents the convention. Keep existing keys and add a comment block:

```dotenv
# 每条链的变量按 ${CHAIN_KEY 大写}_ 前缀约定提供：
#   <KEY>_RPC_URL           (必需)
#   <KEY>_USDT_ADDRESS       (可选，覆盖默认 token 地址)
#   <KEY>_USDC_ADDRESS       (可选)
#   <KEY>_SCAN_API_URL       (可选)
#   <KEY>_SCAN_API_KEY       (可选)
# 新增一条链：在 src/chains/definitions.ts 的 CHAIN_DEFINITIONS 加一项，并在此按约定加变量。
```

- [ ] **Step 5: Full integration gate — typecheck + all tests**

Run: `npm run typecheck`
Expected: exit 0, no errors.

Run: `npm test`
Expected: all test files pass (chains, env, tokens, wallet plan, session format, native tools).

If `tsc` reports any residual references to removed symbols (`parseChainKey`, `TokenRegistryInput`, `confluxRpcUrl`, etc.), fix them at the reported location — they are leftover call sites; migrate each to the new API shown in earlier tasks.

- [ ] **Step 6: Manual smoke (optional but recommended)**

Run: `npm run dev -- account --chain conflux` (or any existing command) with a populated `.env`.
Expected: behaves exactly as before this feature.

- [ ] **Step 7: Commit**

```bash
git add src/cli/index.ts src/agent/index.ts .env.example
git commit -m "feat: wire dynamic chain registry through cli + system prompt

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- Single source of truth (`CHAIN_DEFINITIONS`) → Task 1. ✓
- `ChainKey` → runtime-validated `string`, `isChainKey`/`assertChainKey` → Task 1. ✓
- Registry from definitions + `nativeSymbol` → Task 1 (config), Task 4 (plans). ✓
- env convention derivation, zero migration → Task 2. ✓
- Tools drop hardcoded `z.enum`, `chainEnumSchema` → Task 6; skills → Task 7. ✓
- session native-symbol bug fix → Task 5. ✓
- tokens from `defaultTokens` → Task 3. ✓
- system prompt dynamic, CLI help/validation, `.env.example` → Task 8. ✓
- Testing strategy (registry, assertChainKey, env, chainEnumSchema, session symbol) → Tasks 1,2,3,5,6. ✓
- Acceptance: add-a-chain = table entry + env vars; zero migration; behavior unchanged; tsc + tests green → verified in Task 8 gate. ✓

**Placeholder scan:** No TBD/TODO. Every code step shows concrete code. The only judgement-call step is Task 8 Step 5's "fix residual references," which is bounded (migrate to the new APIs already given in earlier tasks) and expected in a wide-reaching type change.

**Type consistency:** `ChainEnvConfig` defined in Task 1, produced in Task 2, consumed in Task 8. `createChainRegistry(rpcUrls: Record<string,string>)` consistent across Tasks 1 and 8. `createTokenRegistry(overrides: Record<string, Record<string, 0x-string>>)` consistent across Tasks 3 and 8. `nativeSymbol` added to plans in Task 4, consumed in Task 5. `chainEnumSchema` defined in Task 1, consumed in Tasks 6 and 7.
