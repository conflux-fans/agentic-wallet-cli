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
