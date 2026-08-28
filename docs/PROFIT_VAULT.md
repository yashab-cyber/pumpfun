# 🏦 Cyclical Profit Vault & Compounding Engine

The **Profit Vault** (`profitVault.ts`) is an automated capital preservation system designed to systematically secure gains and prevent accumulated profits from being re-risked in volatile memecoin trading.

---

## 1. Core Operating Mechanics ($1 to $101 Milestone Cycle)

```
[Start Cycle #1] ──► Active Trading Seed: 0.01 SOL ($1)
       │
       ▼
[Autonomous Trading] ──► Successful Snipes & Breakouts
       │
       ▼
[Milestone Reached] ──► Portfolio Hits 0.51 SOL ($101 = +$100 Profit)
       │
       ├─────────────────────────────────────────────┐
       ▼                                             ▼
[Safe Vault Locked]                           [Bankroll Reset]
Locks 0.50 SOL ($100) into Vault               Resets Trading Seed back to 0.01 SOL ($1)
       │                                             │
       └──────────────────────┬──────────────────────┘
                              ▼
                   [Start Cycle #2 ($1 Seed)]
```

### Mathematical Formulation

Given:
- $B_{base}$: Base trading bankroll seed (e.g. $0.01\text{ SOL}$).
- $T_{milestone}$: Profit threshold to lock (e.g. $0.50\text{ SOL}$).
- $B_{current}$: Current active portfolio balance.

Milestone Target ($M_{target}$):
$$M_{target} = B_{base} + T_{milestone}$$

When $B_{current} \ge M_{target}$:
$$A_{vault} = B_{current} - B_{base}$$
$$B_{new\_trading} = B_{base}$$
$$V_{cumulative} = V_{cumulative} + A_{vault}$$

---

## 2. Cold Storage Wallet Auto-Transfers (Live Trading)

In live mode, you can configure an external cold storage wallet address:

```env
ENABLE_PROFIT_VAULT=true
BASE_BANKROLL_SOL=0.01
PROFIT_VAULT_THRESHOLD_SOL=0.50
VAULT_DESTINATION_WALLET=YourHardwareWalletPublicKeyHere
```

Whenever the profit milestone is hit:
1. An on-chain Solana transfer is generated for $A_{vault}$ SOL.
2. The transaction is signed and broadcast to the Solana mainnet.
3. The transaction hash is stored in `data/memory.sqlite` and displayed in the Web UI.

---

## 3. Persistent Vault State in SQLite

All completed vault cycles are recorded in the `vault_cycles` table:

```sql
SELECT cycle_number, amount_vaulted_sol, total_vaulted_sol, datetime(timestamp/1000, 'unixepoch') 
FROM vault_cycles 
ORDER BY cycle_number DESC;
```
