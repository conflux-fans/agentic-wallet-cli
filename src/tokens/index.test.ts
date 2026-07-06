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
