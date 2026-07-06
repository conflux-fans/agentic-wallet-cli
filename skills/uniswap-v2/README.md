# Uniswap V2 Skill

This skill adds Uniswap V2 style AMM tools.

Current scope:

1. Conflux only
2. Pool info with reserves and spot prices
3. Exact-in quote and swap preparation
4. Exact-out quote and swap preparation
5. ERC20-to-ERC20 swap preparation
6. CFX-to-ERC20 swap preparation through wrapped native
7. ERC20-to-CFX swap preparation through wrapped native
8. Direct and multi-hop route selection through wrapped native, USDT, and USDC
9. Receipt parsing for Uniswap V2 Swap logs
10. LP position lookup
11. Add liquidity preparation for ERC20/ERC20 and CFX/ERC20 pairs
12. Remove liquidity preparation for ERC20/ERC20 and CFX/ERC20 pairs

`config.json` must provide router, factory, and wrapped native token addresses. The skill rejects pool, quote, and swap calls when any required address is still the zero address.
