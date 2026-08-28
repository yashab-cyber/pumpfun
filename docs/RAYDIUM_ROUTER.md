# 🪐 Autonomous Raydium Graduation & Jupiter Auto-Router

## 1. The Graduation Problem

When a Pump.fun token completes its bonding curve ($\sim 85\text{ SOL}$ accumulated):
1. The Pump.fun bonding curve program is closed and finalized.
2. The liquidity ($\$12,000+$ in SOL and remaining tokens) is deposited into a **Raydium Constant Product AMM pool**.
3. Standard Pump.fun bonding curve trade instructions cease to execute.
4. Conventional bots fail to liquidate or trade tokens that migrate while a position is open.

---

## 2. Dynamic Raydium Auto-Routing Pipeline (`raydiumRouter.ts`)

```
[Bonding Curve >= 100%] ──► [Migration Complete Event]
                                     │
                 ┌───────────────────┴───────────────────┐
                 ▼                                       ▼
     [Raydium Pool ID Resolution]             [Jupiter Quote API v6]
     • Extracts AMM Market Key                • Queries low-slippage routes
     • Verifies base/quote vaults             • Obtains exact output lamports
                 │                                       │
                 └───────────────────┬───────────────────┘
                                     ▼
                      [Execute Seamless Swap / Exit]
```

This guarantees seamless liquidity execution across both the Pump.fun bonding curve phase and the post-migration Raydium pool phase.
