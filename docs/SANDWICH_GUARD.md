# 🥪 Autonomous MEV Sandwich Attack Guard & Slippage Safeguard

## 1. What is an MEV Sandwich Attack?

When a transaction is submitted with excessive slippage on a shallow liquidity pool:
1. An MEV searcher bot notices your transaction in the mempool.
2. The bot buys tokens immediately before you (frontrun), pushing the execution price up.
3. Your order fills at the worst possible price tolerance.
4. The bot immediately sells back its tokens (backrun), pocketing your slippage difference.

---

## 2. Dynamic Sandwich Guard Architecture (`sandwichGuard.ts`)

The **Sandwich Guard** calculates single-order price impact before execution:

$$\text{Impact } (\%) = \left(\frac{S_{order}}{vSol + S_{order}}\right) \times 100$$

- If Impact $\ge 4.0\%$: Flags **High MEV Risk**, tightens slippage to $\le 5\%$, and chops entry into sub-orders.
- If Impact $2.0\% - 3.9\%$: Moderates slippage tolerance to $\le 8\%$.
- If Impact $< 2.0\%$: Safe for execution.
