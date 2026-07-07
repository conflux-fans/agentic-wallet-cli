import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createChainRegistry,
  getChainConfig,
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
  assert.equal(registry.conflux.nativeDecimals, 18);
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
  assert.equal(getChainConfig(registry, "monad").displayName, "Monad");
  assert.throws(() => assertChainKey(registry, "nope"), /conflux, monad/);
  assert.throws(() => getChainConfig(registry, "nope"), /conflux, monad/);
});

test("chainEnumSchema accepts listed keys and rejects others", () => {
  const schema = chainEnumSchema(["conflux", "monad"]);
  assert.equal(schema.parse("conflux"), "conflux");
  assert.throws(() => schema.parse("nope"));
});

test("chainEnumSchema rejects an empty chain list with a clear error", () => {
  assert.throws(() => chainEnumSchema([]), /At least one chain key/);
});
