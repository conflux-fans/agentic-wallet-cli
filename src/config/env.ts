import "dotenv/config";

export type AppEnv = {
  openRouterApiKey: string;
  openRouterModel: string;
  privateKey: `0x${string}`;
  confluxRpcUrl: string;
  monadRpcUrl: string;
  confluxUsdtAddress?: `0x${string}`;
  confluxUsdcAddress?: `0x${string}`;
  monadUsdtAddress?: `0x${string}`;
  monadUsdcAddress?: `0x${string}`;
  confluxScanApiUrl?: string;
  confluxScanApiKey?: string;
  monadScanApiUrl?: string;
  monadScanApiKey?: string;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function normalizePrivateKey(value: string): `0x${string}` {
  const normalized = value.startsWith("0x") ? value : `0x${value}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Error("PRIVATE_KEY must be a 32-byte hex private key");
  }
  return normalized as `0x${string}`;
}

function optionalAddress(name: string): `0x${string}` | undefined {
  const value = process.env[name];
  if (!value) {
    return undefined;
  }

  const normalized = value.startsWith("0x") ? value : `0x${value}`;
  if (!/^0x[0-9a-fA-F]{40}$/.test(normalized)) {
    throw new Error(`${name} must be a 20-byte EVM address`);
  }
  return normalized as `0x${string}`;
}

export function loadEnv(): AppEnv {
  return {
    openRouterApiKey: requireEnv("OPENROUTER_API_KEY"),
    openRouterModel: process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini",
    privateKey: normalizePrivateKey(requireEnv("PRIVATE_KEY")),
    confluxRpcUrl: requireEnv("CONFLUX_RPC_URL"),
    monadRpcUrl: requireEnv("MONAD_RPC_URL"),
    confluxUsdtAddress: optionalAddress("CONFLUX_USDT_ADDRESS"),
    confluxUsdcAddress: optionalAddress("CONFLUX_USDC_ADDRESS"),
    monadUsdtAddress: optionalAddress("MONAD_USDT_ADDRESS"),
    monadUsdcAddress: optionalAddress("MONAD_USDC_ADDRESS"),
    confluxScanApiUrl: process.env.CONFLUX_SCAN_API_URL || "https://evmapi.confluxscan.io/api",
    confluxScanApiKey: process.env.CONFLUX_SCAN_API_KEY,
    monadScanApiUrl: process.env.MONAD_SCAN_API_URL,
    monadScanApiKey: process.env.MONAD_SCAN_API_KEY
  };
}
