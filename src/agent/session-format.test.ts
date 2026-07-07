import { test } from "node:test";
import assert from "node:assert/strict";
import { formatTransactionPlan } from "./session.js";
import type { NativeTransferPlan } from "../wallet/client.js";

const monadPlan: NativeTransferPlan = {
  id: "1",
  kind: "native-transfer",
  chain: "base",
  chainName: "Base",
  nativeSymbol: "ETH",
  nativeDecimals: 18,
  from: "0x0000000000000000000000000000000000000001",
  to: "0x0000000000000000000000000000000000000002",
  amount: "1",
  symbol: "ETH",
  value: 1_000_000_000_000_000_000n,
  estimatedGas: 21000n,
  estimatedFee: 21_000_000_000_000n
};

test("formatTransactionPlan renders the chain's native symbol for fees", () => {
  const out = formatTransactionPlan(monadPlan);
  assert.match(out, /ETH/);
  assert.doesNotMatch(out, /MON/);
  assert.doesNotMatch(out, /CFX/);
});

test("formatTransactionPlan renders native fees with the chain's decimals", () => {
  const out = formatTransactionPlan({
    ...monadPlan,
    nativeSymbol: "SIX",
    nativeDecimals: 6,
    estimatedFee: 12_345n
  });
  assert.match(out, /预估费用：0\.012345 SIX/);
});
