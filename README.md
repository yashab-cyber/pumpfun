# 🚀 Pump.fun Autonomous Trading Agent (QUANTUM PRO v9.0 TITAN)

An institutional-grade, AI-driven autonomous trading agent for **Pump.fun** on the Solana blockchain. Engineered with **MEV Sandwich Guard & Price Impact Protection**, **Session Reinvestment Compounding Engine**, **Interactive Long-Polling Telegram Controller**, **Raydium Graduation & Jupiter Auto-Router**, **Social Virality Scraper**, **Loss Recovery Sizer**, **Stealth Liquidity Drain Detection**, **Multi-RPC Latency Racing**, **Sybil Cluster Detection**, **Jito MEV Frontrunning Protection**, **Historical Strategy Backtester**, **Dynamic Breakeven Trailing Stop Ladder**, **Raydium Migration & KOTH Velocity Predictor**, **Autonomous Strategy Regime Coordinator**, **Insider Whale Tracking Radar**, **Kelly Dynamic Sizer**, **AI CoT Inspector**, **Synthesized Audio Chimes**, **Automated Profit Vault**, and multi-model AI reasoning (**Copilot `http://localhost:4141`**, **Anthropic**, **Gemini**, **Ollama**, **OpenAI**).

---

## ⚠️ Important Disclaimer & Risk Notice
- **No Guaranteed Profits**: Memecoin markets are speculative and volatile. Algorithms and trading bots cannot guarantee profits or turn micro-investments into riches without risk.
- **Capital Risk**: Live Solana trading involves financial risk. Always test strategies thoroughly in **Paper Trading Mode** first.
- **Never trade funds you cannot afford to lose.**

---

## 📚 Complete Documentation Index

For in-depth guides, credential walkthroughs, and technical specifications, refer to [`docs/`](file:///root/pumpfun/docs):

- 🔑 [**Step-by-Step Environment & Credentials Guide**](file:///root/pumpfun/docs/ENV_SETUP.md): Where and how to get RPC URLs, Solana private keys, Copilot/Claude/Gemini API keys, and Telegram credentials.
- 🥪 [**MEV Sandwich Guard**](file:///root/pumpfun/docs/SANDWICH_GUARD.md): Pre-execution price impact modeling and anti-sandwich slippage clamping.
- 🪐 [**Raydium & Jupiter Auto-Router**](file:///root/pumpfun/docs/RAYDIUM_ROUTER.md): Seamless post-graduation Raydium pool execution and swap routing.
- 🌐 [**Social Sentiment & Virality Scraper**](file:///root/pumpfun/docs/SOCIAL_VIRALITY.md): Cultural momentum, ticker meta relevance, and virality scoring.
- 🚨 [**Stealth Liquidity Drain Detector**](file:///root/pumpfun/docs/STEALTH_RUG_DETECTOR.md): Net volume flow tracking to detect disguised developer ladder dumps.
- ⚡ [**Multi-RPC Failover & Latency Racing**](file:///root/pumpfun/docs/RPC_FAILOVER.md): Continuous benchmark testing and instant failover between RPC nodes.
- 🔍 [**Sybil Bundle & Cluster Detection**](file:///root/pumpfun/docs/CLUSTER_DETECTOR.md): How the agent detects and avoids multi-wallet developer honeypot traps.
- 🏛️ [**System Architecture & Mathematics**](file:///root/pumpfun/docs/ARCHITECTURE.md): AMM constant-product formulas, Kelly Criterion models, and SQLite schemas.
- 📊 [**Trading Strategies Guide**](file:///root/pumpfun/docs/STRATEGIES.md): Sniper, Raydium KOTH, Momentum Scalping, Copy Whale, and Auto-Regime Coordinator.
- 🧠 [**Multi-Model AI Setup**](file:///root/pumpfun/docs/AI_MODELS.md): Copilot (`http://localhost:4141`), Claude, Gemini, DeepSeek (Ollama), and OpenAI.
- 🏦 [**Cyclical Profit Vault Guide**](file:///root/pumpfun/docs/PROFIT_VAULT.md): $1 to $101 milestone locking mechanics and cold storage transfers.
- 🛡️ [**Jito MEV Bundle Protection**](file:///root/pumpfun/docs/JITO_MEV.md): Anti-sandwich routing and private mempool bundle submission.
- 📱 [**Telegram Controller Setup**](file:///root/pumpfun/docs/TELEGRAM_SETUP.md): Mobile alerts and remote management setup.

---

## ⚡ Core Feature Matrix

| Feature | Description | File Reference |
|---|---|---|
| **Sandwich Guard** | Calculates price impact to prevent MEV searcher frontrunning | [`sandwichGuard.ts`](file:///root/pumpfun/src/services/sandwichGuard.ts) |
| **Reinvestment Engine**| Dynamically compounds 5% of session profits into trade sizes | [`reinvestmentEngine.ts`](file:///root/pumpfun/src/services/reinvestmentEngine.ts) |
| **Telegram Controller**| Long-polling phone remote for `/status`, `/positions`, `/vault`, `/panic` | [`telegramBot.ts`](file:///root/pumpfun/src/services/telegramBot.ts) |
| **Raydium Auto-Router** | Executes post-graduation swaps and exits seamlessly on Raydium/Jupiter | [`raydiumRouter.ts`](file:///root/pumpfun/src/services/raydiumRouter.ts) |
| **Social Virality Scraper** | Scores cultural meta relevance and verified community channels | [`socialSentiment.ts`](file:///root/pumpfun/src/services/socialSentiment.ts) |
| **Loss Recovery Manager** | Applies controlled 1.25x sizing on high-confidence setups after drawdowns | [`lossRecovery.ts`](file:///root/pumpfun/src/services/lossRecovery.ts) |
| **Stealth Drain Detector** | Identifies ladder dumps disguised with fake micro-buys and triggers defensive exits | [`stealthRugDetector.ts`](file:///root/pumpfun/src/services/stealthRugDetector.ts) |
| **Multi-RPC Failover** | Auto-benchmarks slot latency and swaps failing RPCs dynamically | [`rpcFailover.ts`](file:///root/pumpfun/src/services/rpcFailover.ts) |
| **Cluster Detector** | Rejects multi-wallet developer bundle traps and artificial launch volume | [`clusterDetector.ts`](file:///root/pumpfun/src/services/clusterDetector.ts) |
| **Cyclical Profit Vault** | Auto-locks $100 milestone profits and resets trading seed to $1 | [`profitVault.ts`](file:///root/pumpfun/src/services/profitVault.ts) |
| **Crash Recovery** | Zero context loss across restarts via SQLite persistent memory | [`sqliteMemory.ts`](file:///root/pumpfun/src/services/sqliteMemory.ts) |
| **Multi-Model AI Brain** | Multi-provider LLM reasoning (Copilot, Claude, Gemini, Ollama) | [`aiBrain.ts`](file:///root/pumpfun/src/services/aiBrain.ts) |
| **Autonomous Research Hub** | IPFS inspector for AI/Tech coins, viral memes, and GitHub docs | [`researchEngine.ts`](file:///root/pumpfun/src/services/researchEngine.ts) |
| **KOTH Migration Predictor** | Predicts time-to-Raydium-graduation based on SOL curve velocity | [`migrationPredictor.ts`](file:///root/pumpfun/src/services/migrationPredictor.ts) |
| **Whale Radar** | Tracks top 100 insider wallets and large accumulation buys (>2 SOL) | [`whaleTracker.ts`](file:///root/pumpfun/src/services/whaleTracker.ts) |
| **Kelly Position Sizer** | Dynamically scales trade allocation using AI confidence | [`positionSizer.ts`](file:///root/pumpfun/src/services/positionSizer.ts) |
| **Breakeven Stop Ladder** | Automatically locks +5% breakeven upon hitting TP1 (+50%) | [`riskManager.ts`](file:///root/pumpfun/src/services/riskManager.ts) |
| **Jito MEV Bundler** | Direct JSON-RPC bundle submission to bypass public mempools | [`jitoBundler.ts`](file:///root/pumpfun/src/services/jitoBundler.ts) |
| **Backtesting Lab** | Simulates strategy parameters over SQLite historical trade memory | [`backtester.ts`](file:///root/pumpfun/src/services/backtester.ts) |
| **Web Dashboard** | Mobile-responsive dark glassmorphism terminal with audio chimes | [`index.html`](file:///root/pumpfun/src/public/index.html) |

---

## 🚀 How to Run

### 1. Paper Trading Mode (Simulation)
```bash
npm run paper
```
- Open **`http://localhost:3000`** in your browser.

### 2. Live Trading Mode (On-Chain Mainnet SOL)
```bash
npm run live
```
