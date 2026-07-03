import type { TokenConfig } from "../tokens/index.js";

export function formatWhitelistedTokens(
  chainName: string,
  tokens: TokenConfig[]
): string {
  const lines = [`链：${chainName}`];

  for (const token of tokens) {
    lines.push(`Token：${token.symbol}`);
    lines.push(`名称：${token.name}`);
    lines.push(`精度：${token.decimals}`);
    lines.push(`地址：${token.address ?? "未配置"}`);
  }

  return lines.join("\n");
}
