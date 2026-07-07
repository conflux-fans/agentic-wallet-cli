import { test } from "node:test";
import assert from "node:assert/strict";
import { formatNativeAmount, type NativeTransferPlan } from "./client.js";

test("NativeTransferPlan type carries native metadata", () => {
  const plan: NativeTransferPlan = {
    id: "1",
    kind: "native-transfer",
    chain: "monad",
    chainName: "Monad",
    nativeSymbol: "MON",
    nativeDecimals: 18,
    from: "0x0000000000000000000000000000000000000001",
    to: "0x0000000000000000000000000000000000000002",
    amount: "1",
    symbol: "MON",
    value: 1n,
    estimatedGas: 21000n,
    estimatedFee: 21000n
  };
  assert.equal(plan.nativeSymbol, "MON");
  assert.equal(plan.nativeDecimals, 18);
});

test("formatNativeAmount uses the chain native decimals", () => {
  assert.equal(formatNativeAmount(123_456_789n, 6), "123.4567");
  assert.equal(formatNativeAmount(1_234_000_000_000_000_000n, 18), "1.234");
});
