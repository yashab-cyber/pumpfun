# 🚨 Autonomous Stealth Liquidity Drain & Ladder Dump Detector

## 1. The Stealth Dump Attack Vector

Malicious token creators on Pump.fun often disguise exit scams by avoiding single-transaction massive dumps:
1. They fragment their holdings across 10 to 20 sub-wallets.
2. They sell 0.5 to 1.0 SOL chunks from each wallet over 60 seconds.
3. Concurrently, they inject 4 to 8 tiny micro-buys (e.g. 0.005 SOL) to keep generating green buy transactions on the DEX feed.
4. **The Result**: Conventional trading bots only see "green buys" and fail to trigger stop-losses until the bonding curve is completely drained.

---

## 2. Quantitative Detection Formula (`stealthRugDetector.ts`)

The **Stealth Rug Detector** calculates rolling 60-second net volume flow:

$$\Delta V_{net} = V_{sell} - V_{buy}$$

A **Stealth Drain Alert** triggers when:
- Cumulative Sell Volume $V_{sell} \ge 3.0\text{ SOL}$
- Net Outflow $\Delta V_{net} \ge 2.0\text{ SOL}$
- Micro-Buys Count $\ge 4$
- Stealth Sells Count $\ge 3$

When triggered, the agent immediately issues a **Defensive Market Exit (`CIRCUIT_BREAKER`)**, saving open positions before the pool collapses.
