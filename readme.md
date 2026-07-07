# Agentic Wallet MVP

Agentic Wallet MVP is a command-line EVM wallet example. Users can interact with the wallet in natural language. The current version focuses on account queries, native asset transfers, ERC20 operations, local address book management, token list management, transfer history, and protocol extensions through skills.

## Supported Scope

Supported chains:

1. Conflux eSpace
2. Monad

Supported capabilities:

1. Show account information, native balance, and nonce for the current wallet or any EVM address
2. Query native balances for the current wallet or any EVM address
3. Prepare native transfers through natural language
4. Send native transfers after explicit user confirmation
5. List the ERC20 token whitelist for each chain
6. Query ERC20 balances
7. Query ERC20 allowance
8. Prepare ERC20 transfers through natural language
9. Prepare ERC20 approvals through natural language
10. Query, add, update, and remove address book entries
11. Query, add, update, and remove ERC20 token list entries through natural language
12. Query native transfer history
13. Query ERC20 Transfer history
14. Extend protocol-specific capabilities through skills, currently including `uniswap-v2`

Not supported yet:

1. LayerZero cross-chain transfers

## Installation

```bash
npm install
```

## Environment Variables

Copy `.env.example` to `.env` and fill in the required values:

```bash
cp .env.example .env
```

Required and optional variables:

```text
OPENROUTER_API_KEY=your OpenRouter API key
OPENROUTER_MODEL=openai/gpt-4o-mini

PRIVATE_KEY=your EVM private key

CONFLUX_RPC_URL=Conflux eSpace RPC URL
MONAD_RPC_URL=Monad RPC URL

CONFLUX_USDT_ADDRESS=Conflux eSpace USDT address
CONFLUX_USDC_ADDRESS=Conflux eSpace USDC address
MONAD_USDT_ADDRESS=Monad USDT address
MONAD_USDC_ADDRESS=Monad USDC address

CONFLUX_SCAN_API_URL=ConfluxScan API URL, defaults to https://evmapi.confluxscan.io/api
CONFLUX_SCAN_API_KEY=ConfluxScan API key, optional
MONAD_SCAN_API_URL=Monad scan API URL, optional
MONAD_SCAN_API_KEY=Monad scan API key, optional
```

`PRIVATE_KEY` may include the `0x` prefix or omit it.

Token address variables are optional. If they are not set, the whitelist still includes the built-in USDT/USDC entries from the chain definitions.

Per-chain variables follow the chain env prefix convention:

```text
<KEY>_RPC_URL
<KEY>_<SYMBOL>_ADDRESS
<KEY>_SCAN_API_URL
<KEY>_SCAN_API_KEY
```

By default, `<KEY>` is the uppercase chain key from `src/chains/definitions.ts`. A chain definition may provide `envPrefix` when the chain key should not be used directly as an environment variable prefix.

Native transfer history depends on an Etherscan/ConfluxScan-compatible scan API. It queries native value transfers from regular transactions and does not include internal transfers. ERC20 Transfer history uses RPC `eth_getLogs` and does not depend on a scan API.

Note: this is an example project. In production, an agent should not directly handle private keys.

## Development Mode

Show help:

```bash
npm run dev -- --help
```

Enable verbose mode:

```bash
npm run dev -- --verbose chat
npm run dev -- balance --chain conflux --verbose
```

Verbose mode writes external call diagnostics to stderr, including:

1. OpenRouter provider, model, message count, tools, duration, and token usage
2. Web3 RPC chain, redacted endpoint, RPC method, and key parameters

Start the natural language wallet:

```bash
npm run dev -- chat
```

Chat mode shows a loading indicator while waiting for the model. Verbose mode disables the loading indicator so logs stay readable.

Clear chat context with:

```text
clear
reset
```

If a transaction is waiting for confirmation, confirm or cancel it before clearing context.

Conversation history is pruned automatically. By default, only the latest 20 user/assistant messages are retained to prevent the prompt from growing without bound.

Show account information:

```bash
npm run dev -- account --chain conflux
npm run dev -- account --chain monad
npm run dev -- account --chain conflux --address 0x0000000000000000000000000000000000000000
```

Example output:

```text
Chain: Conflux eSpace
Address: 0x...
Balance: 1.2345 CFX
Nonce: 12
```

Query native balance:

```bash
npm run dev -- balance --chain conflux
npm run dev -- balance --chain monad
npm run dev -- balance --chain conflux --address 0x0000000000000000000000000000000000000000
```

Example output:

```text
Chain: Conflux eSpace
Address: 0x...
Balance: 1.2345 CFX
```

List whitelisted ERC20 tokens:

```bash
npm run dev -- tokens --chain conflux
npm run dev -- tokens --chain monad
```

Example output:

```text
Chain: Conflux eSpace
Token: USDT
Name: Tether USD
Decimals: 6
Address: 0x...
Token: USDC
Name: USD Coin
Decimals: 6
Address: 0x...
```

Query an ERC20 balance:

```bash
npm run dev -- erc20-balance --chain conflux --token USDT
npm run dev -- erc20-balance --chain monad --token USDC --address 0x0000000000000000000000000000000000000000
npm run dev -- erc20-balance --chain conflux --token-address 0xaf37e8b6c9ed7f6318979f56fc287d76c30847ff
```

Example output:

```text
Chain: Conflux eSpace
Token: USDT
Token address: 0x...
Address: 0x...
Balance: 12.3456 USDT
```

Query ERC20 allowance:

```bash
npm run dev -- erc20-allowance --chain conflux --token USDT --spender 0x0000000000000000000000000000000000000000
npm run dev -- erc20-allowance --chain monad --token-address 0x754704Bc059F8C67012fEd69BC8A327a5aafb603 --owner 0x0000000000000000000000000000000000000000 --spender 0x0000000000000000000000000000000000000000
```

Example output:

```text
Chain: Conflux eSpace
Token: USDT
Token address: 0x...
Owner: 0x...
Spender: 0x...
Allowance: 10 USDT
```

Transfer history queries are available through natural language chat. There is no standalone CLI subcommand for transfer history.

Address book commands:

```bash
npm run dev -- address-book list
npm run dev -- address-book get Alice
npm run dev -- address-book add Alice 0x0000000000000000000000000000000000000000 --note "test address"
npm run dev -- address-book update Alice --address 0x1111111111111111111111111111111111111111
npm run dev -- address-book remove Alice
```

Short alias:

```bash
npm run dev -- ab list
```

The address book is stored in `.wallet-address-book.json` in the current working directory. It contains contact addresses and does not contain private keys.

The token list includes built-in USDT/USDC entries and can also be edited through natural language. Edited tokens are stored in `.wallet-token-list.json` in the current working directory.

## Running Built Output

Build:

```bash
npm run build
```

Run the compiled CLI:

```bash
npm start -- --help
npm start -- chat
npm start -- account --chain conflux
npm start -- balance --chain monad
npm start -- --verbose chat
```

## Chat Examples

Start chat:

```bash
npm run dev -- chat
```

Query balance:

```text
> Check my balance on Conflux eSpace
```

Query another address balance:

```text
> Check the balance of 0x0000000000000000000000000000000000000000 on Monad
```

Query account information:

```text
> Show my wallet info on Monad
```

Query nonce for another address:

```text
> Check the nonce of 0x0000000000000000000000000000000000000000 on Conflux eSpace
```

List token whitelist:

```text
> Which tokens are supported on Monad?
```

Query ERC20 balance:

```text
> Check my USDT balance on Conflux eSpace
```

Query allowance:

```text
> Check my USDC allowance to 0x0000000000000000000000000000000000000000 on Monad
```

Query transfer history:

```text
> Show my CFX transfer history on Conflux
> Show my USDT transfer history on Conflux
> Show recent USDC transfers for 0x0000000000000000000000000000000000000000
```

Prepare an ERC20 transfer:

```text
> Transfer 10 USDT to 0x0000000000000000000000000000000000000000 on Conflux eSpace
```

Prepare an ERC20 approval:

```text
> Approve 0x0000000000000000000000000000000000000000 to spend 25 USDC on Monad
```

Address book:

```text
> Add Alice with address 0x0000000000000000000000000000000000000000
> Show my address book
> Update Alice's address to 0x1111111111111111111111111111111111111111
> Remove Alice
```

Transfers and approvals can use address book contact names:

```text
> Transfer 0.1 CFX to Alice on Conflux eSpace
> Approve Alice to spend 25 USDC on Monad
```

Edit the token list:

```text
> Add a token on Monad, address 0x0000000000000000000000000000000000000000
> Show the token list on Conflux eSpace
> Update Monad DAI address to 0x1111111111111111111111111111111111111111
> Remove DAI from Monad
```

When adding a token, the wallet reads `name()`, `symbol()`, and `decimals()` through RPC. If metadata cannot be read, the token is rejected to avoid adding a non-ERC20 contract.

Token list edits are local configuration changes. They write `.wallet-token-list.json` and do not send on-chain transactions.

## Skills

The project supports protocol extensions through skills. The current built-in skill is `uniswap-v2`, configured at:

```text
skills/uniswap-v2/config.json
```

The Uniswap V2 skill is enabled only for chains that are both present in the active chain registry and configured in `skills/uniswap-v2/config.json`. Each configured chain must provide router, factory, and wrapped native token addresses. If router, factory, or wrappedNative is still the zero address, pool, quote, swap, and LP operations will refuse to run.

The current Uniswap V2 skill exposes:

```text
getUniswapV2PoolInfo
getUniswapV2Quote
prepareUniswapV2Swap
getUniswapV2LiquidityPosition
prepareUniswapV2AddLiquidity
prepareUniswapV2RemoveLiquidity
```

Quote and swap preparation support:

```text
ERC20 -> ERC20
native -> ERC20
ERC20 -> native
```

Quote and swap preparation automatically try a direct path and multi-hop paths through `wrappedNative`, `USDT`, and `USDC`, then choose the path with the highest output or lowest input. The default maximum path length is 4 pools and can be constrained with `maxHops`.

Both exact-in and exact-out modes are supported:

```text
exactIn: fixed input amount, computes expected output and minimum output
exactOut: fixed target output amount, computes expected input and maximum input
```

When the input asset is native, the skill uses `swapExactETHForTokens` or `swapETHForExactTokens` and sets the maximum input amount as transaction `value`. When the output asset is native, it uses `swapExactTokensForETH` or `swapTokensForExactETH`. Native assets in the swap path are mapped to the configured `wrappedNative` address.

Quotes and confirmation messages include execution price, price impact, and the selected path. After confirmation, if the receipt contains a Uniswap V2 `Swap` event, the response includes actual output and execution path details.

If swap preparation detects insufficient ERC20 allowance, it automatically creates an `approve + swap` multi-step operation. Each step requires user confirmation before it is sent. Native input assets do not require approval.

LP support:

```text
Query LP position
Prepare ERC20/ERC20 add liquidity
Prepare native/ERC20 add liquidity
Prepare ERC20/ERC20 remove liquidity
Prepare native/ERC20 remove liquidity
```

When adding liquidity, ERC20 inputs are checked for router allowance. If allowance is insufficient, the wallet creates an `approve + addLiquidity` multi-step operation. When removing liquidity, the LP token allowance to the router is checked; if insufficient, the wallet creates an `approve LP + removeLiquidity` multi-step operation. Each step requires user confirmation before it is sent.

Natural language examples:

```text
> How much USDT can I get for 1 CFX on Conflux?
> How much CFX do I need to receive exactly 100 USDT on Conflux?
> Prepare a swap from 10 USDT to CFX on Conflux
> Prepare a swap from 0.5 CFX to USDC on Conflux with 1% slippage
> Prepare to spend at most 1 CFX to receive 100 USDT on Conflux
> Show my CFX/USDT LP position on Conflux
> Add liquidity to CFX/USDT with 1 CFX and 100 USDT on Conflux
> Remove 0.5 CFX/USDT LP on Conflux
```

Third-party skill authoring notes:

```text
doc/skill-authoring.md
```

Prepare a native transfer:

```text
> Transfer 0.1 CFX to 0x0000000000000000000000000000000000000000 on Conflux eSpace
```

The agent first creates a transaction plan for confirmation:

```text
Pending native transfer:
Chain: Conflux eSpace
From: 0x...
To: 0x...
Amount: 0.1 CFX
Estimated gas: 21000
Estimated fee: ...

Confirm sending? Enter "confirm" to send or "cancel" to discard.
```

Confirm:

```text
> confirm
```

After confirmation, the program broadcasts the transaction and waits for the receipt. Example response:

```text
Transaction sent: 0x...
Chain: Conflux eSpace
Status: success
Block: 123456
Gas Used: 21000
Explorer: https://...
```

If on-chain execution fails:

```text
Status: failed (reverted)
```

If waiting for the receipt times out or the RPC query fails:

```text
Status: pending
Receipt: waiting for confirmation failed or timed out; the transaction may still be pending on-chain
```

This does not necessarily mean the transaction failed. Use the transaction hash or block explorer to continue checking.

Cancel:

```text
> cancel
```

## Safety Model

Operations that write on-chain state are never sent directly by the agent. The transaction flow has two steps:

1. `prepareNativeTransfer`, ERC20 prepare tools, and skill prepare tools only create transaction plans. They do not sign or send transactions.
2. The wallet sends a transaction only after the user explicitly confirms.

When a tool creates a multi-step operation, such as `approve + swap`, each step requires user confirmation before it is sent. If any step fails or receipt waiting times out, later steps are not sent.

If there is a pending transaction or pending multi-step operation, new natural language requests are blocked until the current operation is confirmed or canceled.

## Available Scripts

```bash
npm run dev        # Run the CLI through tsx
npm run build      # Compile TypeScript
npm start          # Run dist/cli/index.js
npm run typecheck  # Type check
npm run test       # Run tests
npm run eval:nl    # Run natural language intent evaluation
```

## Natural Language Intent Evaluation

The project includes a small natural language test set for evaluating whether the model maps user input to the correct tool.

Run:

```bash
npm run eval:nl
```

The evaluation uses the following values from `.env`:

```text
OPENROUTER_API_KEY
OPENROUTER_MODEL
```

The evaluation script uses mock tools. It does not call web3 RPC, sign transactions, or send transactions.

Covered scenarios include:

```text
native balance queries
account information and nonce queries
token whitelist queries
ERC20 balance queries
ERC20 allowance queries
native transfer preparation
ERC20 transfer preparation
ERC20 approve preparation
Chinese, English, and mixed-language inputs
missing parameters that require follow-up questions
currently unsupported failure cases
```

Test cases are defined in:

```text
scripts/run-nl-intent-eval.ts
```

## Verbose Mode

By default, the CLI prints only user-facing results. Use `--verbose` to debug external calls.

Global option:

```bash
npm run dev -- --verbose chat
```

Subcommand option:

```bash
npm run dev -- chat --verbose
npm run dev -- account --chain conflux --verbose
npm run dev -- balance --chain monad --verbose
```

RPC URLs are redacted. Query strings, hash fragments, usernames, and passwords are not printed. Private keys are never printed.

## Chain Keys

Use these chain keys in CLI parameters:

```text
conflux
monad
```

Natural language can use:

```text
Conflux eSpace
Monad
```

## Adding a Chain

To add another EVM chain:

1. Add an entry to `CHAIN_DEFINITIONS` in `src/chains/definitions.ts`.
2. Provide the required RPC URL in `.env` using the chain env prefix.
3. Add default token definitions if the chain should include built-in whitelisted tokens.
4. Add scan API defaults or environment variables if native transfer history should work.
5. Add protocol skill configuration separately when a skill depends on chain-specific deployments such as router, factory, or wrapped native addresses.

Chain keys should use lowercase letters, numbers, and underscores. If the desired environment variable prefix differs from the chain key, set `envPrefix` in the chain definition.
