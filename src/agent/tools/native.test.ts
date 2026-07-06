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
