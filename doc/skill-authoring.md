# Skill Authoring

Agentic Wallet supports protocol extensions through skills. A skill contributes tools to the Agent without changing the Agent loop.

## Goals

Third-party skill authors should only need to:

1. Provide a skill manifest.
2. Provide skill configuration.
3. Implement `createSkill(context)`.
4. Return AI SDK tools.
5. Prepare transactions through the SDK instead of sending them.

Skill authors should not need to understand the CLI, private key loading, receipt waiting, or pending transaction confirmation flow.

## Directory Structure

Recommended layout:

```text
skills/
  my-skill/
    skill.json
    config.json
    README.md
```

Compiled skill implementations currently live under `src/skills/`. The long-term API target is that third-party skill code imports only from `src/skills/sdk.ts`.

## Manifest

Example:

```json
{
  "name": "uniswap-v2",
  "version": "0.1.0",
  "description": "Uniswap V2 pool, quote and swap tools",
  "enabled": true,
  "permissions": {
    "readRpc": true,
    "prepareTransactions": true,
    "writeLocalFiles": false
  }
}
```

Permissions are part of the public design. The first implementation records the expected boundary; stricter enforcement can be added later.

## SkillContext

Skills receive a `SkillContext` with limited capabilities:

```ts
context.rpc.publicClient(chain)
context.token.resolve(chain, { symbol })
context.address.resolve(nameOrAddress)
context.transactions.prepareContractCall(...)
context.transactions.setPending(plan)
context.config.readJson("config.json")
context.logger.log(...)
```

Skills do not receive private keys and must not send transactions directly.

## Transaction Safety

Write operations must create a transaction plan:

```ts
const plan = await context.transactions.prepareContractCall({
  id,
  chain,
  protocol: "my-protocol",
  action: "swap",
  to,
  value,
  data,
  summary
});

context.transactions.setPending(plan);
```

The core wallet handles:

1. Displaying the plan.
2. User confirmation.
3. Signing.
4. Broadcasting.
5. Receipt waiting.
6. Failure status display.

## Current Example

The first implemented skill is `uniswap-v2`:

```text
src/skills/uniswap-v2.ts
skills/uniswap-v2/skill.json
skills/uniswap-v2/config.json
```

It supports Conflux only for now. `config.json` currently contains zero-address placeholders and must be updated before live use.
