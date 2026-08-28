# 📊 Trading Strategies & Market Regime Guide

The agent features 4 specialized autonomous trading strategies, coordinated by the **Autonomous Market Regime Coordinator** (`strategyCoordinator.ts`).

---

## 1. ⚡ SNIPER STRATEGY (`SNIPER`)

### Objective
Capture high-velocity, early-stage gains on newly created tokens within the first 1-3 blocks of launch.

### Entry Criteria
1. **Dev Initial Buy**: Must be within optimal skin-in-the-game range ($0.2\text{ SOL} \le \text{Dev Buy} \le 2.5\text{ SOL}$).
2. **On-Chain Safety**: Dev has no history of serial rug-pulls in SQLite memory; RugCheck score $\ge 65/100$.
3. **Research Score**: Narrative matches `TECH_AI`, `VIRAL_MEME`, or `POLITICAL`.
4. **AI Confidence**: $\ge 60\%$.

### Exit Rules
- TP1: $+50\%$ (sells $50\%$ of bag, sets Stop Loss to Breakeven $+5\%$).
- TP2: $+100\%$ (sells $25\%$ of bag, sets Stop Loss to $+30\%$).
- TP3: $+200\%$ (sells remaining moonbag).
- Hard SL: $-20\%$.

---

## 2. 👑 RAYDIUM MIGRATION & KOTH STRATEGY (`MIGRATION_KOTH`)

### Objective
Trade tokens approaching King of the Hill (KOTH) and the $85\text{ SOL}$ Raydium graduation threshold where institutional liquidity and Raydium bots flood in.

### Entry Criteria
1. **Bonding Curve Progress**: $\ge 70\%$ of graduation curve completed.
2. **SOL Velocity**: Accumulation rate $\ge 0.2\text{ SOL/minute}$.
3. **Top Holder Concentration**: Top 10 non-bonding curve holders hold $< 25\%$ total supply.

### Exit Rules
- Pre-Migration Take-Profit: At $92\%-95\%$ curve completion to beat the migration liquidity seeding cooldown.
- Trailing Stop: $12\%$ drop from peak.

---

## 3. 📈 MOMENTUM BREAKOUT SCALP (`MOMENTUM_SCALP`)

### Objective
Avoid noise and false launches by only entering tokens that display sustained buy volume and positive price velocity over a 2-minute window.

### Entry Criteria
1. Token has completed at least $10\text{ SOL}$ of real trading volume on the curve.
2. Net buy/sell ratio over 30 ticks is $> 2.0$.
3. Price has broken above the initial 5-minute resistance level.

### Exit Rules
- Dynamic Trailing Stop: $10\%$ trailing distance.
- Max Hold Duration: 120 seconds.

---

## 4. 🕵️ ALPHA COPY-WHALE (`COPY_WHALE`)

### Objective
Mirror transactions from verified, high-winrate Pump.fun insider and whale wallets.

### Entry Criteria
1. Trade initiated by a tracked alpha address in `whaleTracker.ts`.
2. Buy amount $\ge 1.5\text{ SOL}$.
3. Dev reputation is not blacklisted.

### Exit Rules
- Proportional mirror exit or Risk Manager trailing take-profit.

---

## 🔄 5. Autonomous Market Regime Coordinator

The coordinator analyzes market conditions in 5-minute rolling windows:

```
                  ┌──────────────────────────────┐
                  │ Token Launch Rate > 15/min?  │
                  └──────────────┬───────────────┘
                                 │
                 ┌───────────────┴───────────────┐
                 │                               │
             YES │                               │ NO
                 ▼                               ▼
     ┌────────────────────────┐      ┌────────────────────────┐
     │ Win Rate < 45%?        │      │ KOTH Curves >= 3?      │
     └───────────┬────────────┘      └───────────┬────────────┘
                 │                               │
        YES ┌────┴────┐ NO              YES ┌────┴────┐ NO
            ▼         ▼                     ▼         ▼
     [MOMENTUM]   [SNIPER]             [MIGRATION]  [SNIPER]
```
