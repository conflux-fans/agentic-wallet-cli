import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import type { AddressBook } from "../address-book/index.js";
import type { ChainConfig, ChainKey } from "../chains/index.js";
import type { AgentSession } from "../agent/session.js";
import type { TokenRegistry } from "../tokens/index.js";
import type { WalletContext } from "../wallet/client.js";
import { createSkillContext, type WalletSkill } from "./sdk.js";
import type { SkillManifest } from "./sdk.js";
import { createUniswapV2Skill } from "./uniswap-v2.js";

export function loadEnabledSkills(input: {
  wallet: WalletContext;
  chains: Record<ChainKey, ChainConfig>;
  tokens: TokenRegistry;
  addressBook: AddressBook;
  session: AgentSession;
}): WalletSkill[] {
  const uniswapDir = resolve(process.cwd(), "skills/uniswap-v2");
  const manifest = readManifest(resolve(uniswapDir, "skill.json"));
  if (!manifest.enabled) {
    return [];
  }

  const uniswapContext = createSkillContext({
    ...input,
    skillDir: uniswapDir
  });
  const skills = [createUniswapV2Skill(uniswapContext)];

  return skills.filter((skill) => skill.tools && Object.keys(skill.tools).length > 0);
}

function readManifest(path: string): SkillManifest {
  return JSON.parse(readFileSync(path, "utf8")) as SkillManifest;
}
