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

/** Three-chain context built manually to bypass CHAIN_DEFINITIONS constraints */
function fakeCtxThreeChains() {
  return {
    account: { address: "0x0000000000000000000000000000000000000001" },
    chains: {
      conflux: {} as any,
      monad: {} as any,
      base: {} as any
    },
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

test("chain field description is derived from registry keys, not hardcoded", () => {
  const tools = createNativeTools(fakeCtxThreeChains(), createAgentSession());
  // Check all three tools that carry a chain field
  for (const toolName of ["getAccountInfo", "getNativeBalance", "prepareNativeTransfer"] as const) {
    const schema = (tools[toolName] as any).inputSchema;
    const chainDesc = schema.shape.chain.description as string;
    assert.ok(
      chainDesc.includes("base"),
      `${toolName}: description should include 'base' but got: "${chainDesc}"`
    );
    assert.ok(
      !chainDesc.includes("只能是"),
      `${toolName}: description must not contain the hardcoded '只能是' text, got: "${chainDesc}"`
    );
  }
});
