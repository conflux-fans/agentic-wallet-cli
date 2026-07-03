import type { ChainKey } from "../chains/index.js";

export type AccountInfoView = {
  address: string;
  chain: ChainKey;
  chainName: string;
  balance: string;
  symbol: string;
  nonce: number;
};

export type NativeBalanceView = {
  address: string;
  chain: ChainKey;
  chainName: string;
  balance: string;
  symbol: string;
};

export type Erc20BalanceView = {
  address: string;
  chainName: string;
  tokenAddress: string;
  tokenSymbol: string;
  balance: string;
};

export type Erc20AllowanceView = {
  owner: string;
  spender: string;
  chainName: string;
  tokenAddress: string;
  tokenSymbol: string;
  allowance: string;
};

export function formatAccountInfo(info: AccountInfoView): string {
  return [
    `链：${info.chainName}`,
    `地址：${info.address}`,
    `余额：${info.balance} ${info.symbol}`,
    `Nonce：${info.nonce}`
  ].join("\n");
}

export function formatNativeBalance(balance: NativeBalanceView): string {
  return [
    `链：${balance.chainName}`,
    `地址：${balance.address}`,
    `余额：${balance.balance} ${balance.symbol}`
  ].join("\n");
}

export function formatErc20Balance(balance: Erc20BalanceView): string {
  return [
    `链：${balance.chainName}`,
    `Token：${balance.tokenSymbol}`,
    `Token 地址：${balance.tokenAddress}`,
    `地址：${balance.address}`,
    `余额：${balance.balance} ${balance.tokenSymbol}`
  ].join("\n");
}

export function formatErc20Allowance(allowance: Erc20AllowanceView): string {
  return [
    `链：${allowance.chainName}`,
    `Token：${allowance.tokenSymbol}`,
    `Token 地址：${allowance.tokenAddress}`,
    `Owner：${allowance.owner}`,
    `Spender：${allowance.spender}`,
    `Allowance：${allowance.allowance} ${allowance.tokenSymbol}`
  ].join("\n");
}
