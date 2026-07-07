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
