# 🔍 Sybil Bundle & Dev Cluster Detection Engine

## 1. What is Dev Bundling / Sybil Sniping?

In Pump.fun memecoin launches, deceptive developers often execute **Sybil Multi-Wallet Bundling**:
1. The developer creates a new token.
2. In the exact same block (Block 0 or Block 1), the developer distributes SOL into 5 to 10 separate fresh burner wallets.
3. All 5 to 10 wallets purchase large fractions of the bonding curve simultaneously.
4. **The Trap**: Unsuspecting retail traders and standard trading bots see high initial buy activity, think there is organic hype, and buy in.
5. The developer then dumps all 10 wallets simultaneously, draining all liquidity.

---

## 2. How the Cluster Detector Protects You (`clusterDetector.ts`)

The **Cluster Detector** analyzes early transactional topology during the first 5 seconds of token launch:

```
[Token Created] ──► [Block 0-2 Transactional Inspection]
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
[Multi-Wallet Velocity Check]   [Volume Concentration Check]
>= 5 unique buyers in <= 1.5s?   >= 8 SOL volume in <= 3.0s?
             │                           │
             └─────────────┬─────────────┘
                           ▼
             [Cluster Risk Score Computed]
                           │
            Score >= 60? ──┼──► YES: Flag as SYBIL_BUNDLE_TRAP (Reject Entry)
                           │
                           └──► NO:  Legitimate Organic Launch (Proceed)
```

---

## 3. Real-Time Dashboard Integration

When a bundled token is detected, the agent logs:
`⚠️ Sybil Bundle Trap Rejected: Abc123 (High-velocity multi-wallet bundle detected: 7 wallets in 1.1s)`

This saves capital and ensures the bot only participates in genuine, organic community memecoins and tech tokens.
