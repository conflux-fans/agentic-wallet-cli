#!/usr/bin/env node
import { Command } from "commander";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { isAddress, type Address } from "viem";
import { assertChainKey, createChainRegistry, chainKeys } from "../chains/index.js";
import { loadEnv } from "../config/env.js";
import { handleUserInput } from "../agent/index.js";
import { createAgentSession } from "../agent/session.js";
import {
  createWalletContext,
  getErc20Allowance,
  getErc20Balance,
  getAccountInfo,
  getNativeBalance,
  type Erc20TokenInput
} from "../wallet/client.js";
import type { ScanApiConfig } from "../history/index.js";
import { createLogger } from "../logger.js";
import {
  formatAccountInfo,
  formatErc20Allowance,
  formatErc20Balance,
  formatNativeBalance
} from "./format.js";
import { createSpinner } from "./spinner.js";
import {
  createTokenRegistry,
  getWhitelistedToken,
  getWhitelistedTokens,
  parseTokenSymbol,
  type TokenRegistry
} from "../tokens/index.js";
import { formatWhitelistedTokens } from "./token-format.js";
import { createAddressBook } from "../address-book/index.js";
import { formatAddressBookEntry, formatAddressBookList } from "./address-book-format.js";

function createRuntime(verbose: boolean) {
  const env = loadEnv();
  const logger = createLogger(verbose);
  const rpcUrls: Record<string, string> = {};
  const tokenOverrides: Record<string, Record<string, `0x${string}`>> = {};
  const scanApis: ScanApiConfig = {};
  for (const [key, chainEnv] of Object.entries(env.chains)) {
    rpcUrls[key] = chainEnv.rpcUrl;
    tokenOverrides[key] = chainEnv.tokens;
    scanApis[key] = { apiUrl: chainEnv.scan.apiUrl, apiKey: chainEnv.scan.apiKey };
  }
  const chains = createChainRegistry(rpcUrls);
  const tokens = createTokenRegistry(tokenOverrides);
  const addressBook = createAddressBook();
  const wallet = createWalletContext(env.privateKey, chains, logger);
  return { env, chains, tokens, addressBook, wallet, scanApis };
}

function printError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
}

const program = new Command();

program
  .name("wallet")
  .description("Agentic EVM Wallet MVP")
  .option("-v, --verbose", "print external LLM and web3 RPC call diagnostics")
  .version("0.1.0");

function isVerbose(options?: { verbose?: boolean }) {
  return Boolean(program.opts<{ verbose?: boolean }>().verbose || options?.verbose);
}

function resolveCliToken(
  registry: TokenRegistry,
  chain: string,
  options: { token?: string; tokenAddress?: string }
): Erc20TokenInput {
  if (options.tokenAddress !== undefined) {
    if (!isAddress(options.tokenAddress)) {
      throw new Error("Invalid ERC20 token address");
    }

    return { address: options.tokenAddress };
  }

  if (options.token === undefined) {
    throw new Error("Use --token USDT/USDC or --token-address <address>");
  }

  const symbol = parseTokenSymbol(options.token);
  const token = getWhitelistedToken(registry, chain, symbol);
  if (!token?.address) {
    throw new Error(`${chain} ${symbol} token address is not configured`);
  }

  return {
    address: token.address,
    symbol: token.symbol,
    decimals: token.decimals
  };
}

program
  .command("chat")
  .description("Start natural language wallet chat")
  .option("-v, --verbose", "print external LLM and web3 RPC call diagnostics")
  .action(async (options: { verbose?: boolean }) => {
    try {
      const { env, wallet, tokens, addressBook, scanApis } = createRuntime(isVerbose(options));
      const session = createAgentSession();
      const rl = readline.createInterface({ input, output });

      console.log("Agentic Wallet MVP");
      console.log("输入自然语言指令。输入 exit 或 quit 退出。");

      while (true) {
        const line = (await rl.question("> ")).trim();
        if (!line) {
          continue;
        }
        if (line === "exit" || line === "quit") {
          break;
        }

        try {
          const spinner = createSpinner("处理中...", !wallet.logger.verbose);
          spinner.start();
          let response: string;
          try {
            response = await handleUserInput(
              line,
              {
                openRouterApiKey: env.openRouterApiKey,
                openRouterModel: env.openRouterModel
              },
              wallet,
              tokens,
              wallet.chains,
              addressBook,
              scanApis,
              session
            );
          } finally {
            spinner.stop();
          }
          console.log(response);
        } catch (error) {
          printError(error);
        }
      }

      rl.close();
    } catch (error) {
      printError(error);
      process.exitCode = 1;
    }
  });

program
  .command("account")
  .description("Show account address, native balance, and nonce")
  .requiredOption("-c, --chain <chain>", `chain key: ${chainKeys().join(" | ")}`)
  .option("-a, --address <address>", "EVM address to query. Defaults to current wallet")
  .option("-v, --verbose", "print external web3 RPC call diagnostics")
  .action(async (options: { chain: string; address?: string; verbose?: boolean }) => {
    try {
      const { wallet, chains } = createRuntime(isVerbose(options));
      if (options.address !== undefined && !isAddress(options.address)) {
        throw new Error("Invalid EVM address");
      }

      const info = await getAccountInfo(
        wallet,
        assertChainKey(chains, options.chain),
        options.address as Address | undefined
      );
      console.log(formatAccountInfo(info));
    } catch (error) {
      printError(error);
      process.exitCode = 1;
    }
  });

program
  .command("balance")
  .description("Show native balance")
  .requiredOption("-c, --chain <chain>", `chain key: ${chainKeys().join(" | ")}`)
  .option("-a, --address <address>", "EVM address to query. Defaults to current wallet")
  .option("-v, --verbose", "print external web3 RPC call diagnostics")
  .action(async (options: { chain: string; address?: string; verbose?: boolean }) => {
    try {
      const { wallet, chains } = createRuntime(isVerbose(options));
      if (options.address !== undefined && !isAddress(options.address)) {
        throw new Error("Invalid EVM address");
      }

      const balance = await getNativeBalance(
        wallet,
        assertChainKey(chains, options.chain),
        options.address as Address | undefined
      );
      console.log(formatNativeBalance(balance));
    } catch (error) {
      printError(error);
      process.exitCode = 1;
    }
  });

program
  .command("tokens")
  .description("Show whitelisted ERC20 tokens")
  .requiredOption("-c, --chain <chain>", `chain key: ${chainKeys().join(" | ")}`)
  .action((options: { chain: string }) => {
    try {
      const { chains, tokens } = createRuntime(false);
      const chain = assertChainKey(chains, options.chain);
      console.log(formatWhitelistedTokens(chains[chain].displayName, getWhitelistedTokens(tokens, chain)));
    } catch (error) {
      printError(error);
      process.exitCode = 1;
    }
  });

program
  .command("erc20-balance")
  .description("Show ERC20 token balance")
  .requiredOption("-c, --chain <chain>", `chain key: ${chainKeys().join(" | ")}`)
  .option("-t, --token <symbol>", "whitelisted token symbol: USDT or USDC")
  .option("--token-address <address>", "ERC20 token contract address")
  .option("-a, --address <address>", "EVM address to query. Defaults to current wallet")
  .option("-v, --verbose", "print external web3 RPC call diagnostics")
  .action(
    async (options: {
      chain: string;
      token?: string;
      tokenAddress?: string;
      address?: string;
      verbose?: boolean;
    }) => {
      try {
        const { wallet, tokens, chains } = createRuntime(isVerbose(options));
        const chain = assertChainKey(chains, options.chain);
        if (options.address !== undefined && !isAddress(options.address)) {
          throw new Error("Invalid EVM address");
        }

        const balance = await getErc20Balance(
          wallet,
          chain,
          resolveCliToken(tokens, chain, options),
          options.address as Address | undefined
        );
        console.log(formatErc20Balance(balance));
      } catch (error) {
        printError(error);
        process.exitCode = 1;
      }
    }
  );

program
  .command("erc20-allowance")
  .description("Show ERC20 allowance")
  .requiredOption("-c, --chain <chain>", `chain key: ${chainKeys().join(" | ")}`)
  .requiredOption("-s, --spender <address>", "spender address")
  .option("-t, --token <symbol>", "whitelisted token symbol: USDT or USDC")
  .option("--token-address <address>", "ERC20 token contract address")
  .option("-o, --owner <address>", "owner address. Defaults to current wallet")
  .option("-v, --verbose", "print external web3 RPC call diagnostics")
  .action(
    async (options: {
      chain: string;
      spender: string;
      token?: string;
      tokenAddress?: string;
      owner?: string;
      verbose?: boolean;
    }) => {
      try {
        const { wallet, tokens, chains } = createRuntime(isVerbose(options));
        const chain = assertChainKey(chains, options.chain);
        if (!isAddress(options.spender)) {
          throw new Error("Invalid spender address");
        }
        if (options.owner !== undefined && !isAddress(options.owner)) {
          throw new Error("Invalid owner address");
        }

        const allowance = await getErc20Allowance(
          wallet,
          chain,
          resolveCliToken(tokens, chain, options),
          options.owner as Address | undefined,
          options.spender
        );
        console.log(formatErc20Allowance(allowance));
      } catch (error) {
        printError(error);
        process.exitCode = 1;
      }
    }
  );

const addressBookCommand = program
  .command("address-book")
  .alias("ab")
  .description("Manage local address book");

addressBookCommand
  .command("list")
  .description("List address book entries")
  .action(() => {
    try {
      const addressBook = createAddressBook();
      console.log(formatAddressBookList(addressBook.list()));
    } catch (error) {
      printError(error);
      process.exitCode = 1;
    }
  });

addressBookCommand
  .command("get")
  .description("Get an address book entry")
  .argument("<name>", "contact name")
  .action((name: string) => {
    try {
      const addressBook = createAddressBook();
      const entry = addressBook.get(name);
      if (!entry) {
        throw new Error(`Address book entry "${name}" does not exist`);
      }
      console.log(formatAddressBookEntry(entry));
    } catch (error) {
      printError(error);
      process.exitCode = 1;
    }
  });

addressBookCommand
  .command("add")
  .description("Add an address book entry")
  .argument("<name>", "contact name")
  .argument("<address>", "EVM address")
  .option("-n, --note <note>", "optional note")
  .action((name: string, address: string, options: { note?: string }) => {
    try {
      const addressBook = createAddressBook();
      console.log(formatAddressBookEntry(addressBook.add({ name, address, note: options.note })));
    } catch (error) {
      printError(error);
      process.exitCode = 1;
    }
  });

addressBookCommand
  .command("update")
  .description("Update an address book entry")
  .argument("<name>", "contact name")
  .option("-a, --address <address>", "new EVM address")
  .option("-n, --note <note>", "new note")
  .action((name: string, options: { address?: string; note?: string }) => {
    try {
      if (options.address === undefined && options.note === undefined) {
        throw new Error("Use --address and/or --note to update an entry");
      }
      const addressBook = createAddressBook();
      console.log(formatAddressBookEntry(addressBook.update(name, options)));
    } catch (error) {
      printError(error);
      process.exitCode = 1;
    }
  });

addressBookCommand
  .command("remove")
  .alias("delete")
  .description("Remove an address book entry")
  .argument("<name>", "contact name")
  .action((name: string) => {
    try {
      const addressBook = createAddressBook();
      console.log(formatAddressBookEntry(addressBook.remove(name)));
    } catch (error) {
      printError(error);
      process.exitCode = 1;
    }
  });

await program.parseAsync();
