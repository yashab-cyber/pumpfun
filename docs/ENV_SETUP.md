# 🔑 Complete Step-by-Step Environment & Credentials Setup Guide

This guide details **every single variable** in `.env`, what it controls, and **exact step-by-step instructions on where to obtain each credential or API key**.

---

## 📑 Table of Contents
1. [Core Trading Mode & Network](#1-core-trading-mode--network)
2. [Solana Wallet & RPC Configuration](#2-solana-wallet--rpc-configuration)
3. [AI Model Credentials (Copilot, Claude, Gemini, Ollama, OpenAI)](#3-ai-model-credentials)
4. [Profit Auto-Vault & Cold Storage Setup](#4-profit-auto-vault--cold-storage-setup)
5. [Jito MEV Bundle Configuration](#5-jito-mev-bundle-configuration)
6. [Telegram Bot & Mobile Alerts](#6-telegram-bot--mobile-alerts)
7. [Full `.env` Template](#7-full-env-template)

---

## 1. Core Trading Mode & Network

### `TRADING_MODE`
- **Options**: `paper` or `live`
- **Default**: `paper`
- **Description**: 
  - `paper`: Runs a full real-time simulation using live market data from Pump.fun WebSockets. No real SOL is spent.
  - `live`: Executes real on-chain transactions on Solana Mainnet using your private key.

### `WEB_PORT`
- **Default**: `3000`
- **Description**: The port for the web dashboard interface (`http://localhost:3000`). If port 3000 is occupied, the agent automatically falls back to 3001.

---

## 2. Solana Wallet & RPC Configuration

### `SOLANA_RPC_URL`
- **Default**: `https://api.mainnet-beta.solana.com`
- **Description**: The Solana RPC endpoint for querying balances, fetching token account data, and submitting transactions.

#### 📍 Where to get a High-Speed Private RPC (Recommended for Live Trading):
1. **Helius (Fastest for Pump.fun)**:
   - Go to [https://helius.dev](https://helius.dev) and sign up with GitHub or Google.
   - Click **"Create RPC Key"** $\rightarrow$ select **"Solana Mainnet"**.
   - Copy your RPC URL: `https://mainnet.helius-rpc.com/?api-key=YOUR_KEY`.
2. **QuickNode**:
   - Go to [https://quicknode.com](https://quicknode.com) $\rightarrow$ **Create Endpoint** $\rightarrow$ choose **Solana Mainnet**.
   - Copy your HTTP RPC URL.
3. **Free Public RPC (For Paper Trading)**:
   - Use `https://api.mainnet-beta.solana.com`.

---

### `SOLANA_PRIVATE_KEY`
- **Required For**: `live` mode only. (Leave empty or dummy for `paper` mode).
- **Format**: Base58 encoded private key string (e.g. `5Jz...` or `4Kx...`).

#### 📍 Where to export your Private Key:
1. **From Phantom Wallet**:
   - Open Phantom $\rightarrow$ Click **Settings (Gear icon)** in bottom right.
   - Click **"Manage Accounts"** $\rightarrow$ Select your trading account.
   - Click **"Show Private Key"** $\rightarrow$ Enter your password.
   - Copy the Base58 string and paste it into `.env`:
     ```env
     SOLANA_PRIVATE_KEY=your_exported_base58_private_key_here
     ```
2. **From Solflare Wallet**:
   - Open Solflare $\rightarrow$ Settings $\rightarrow$ Export Private Key $\rightarrow$ Copy Base58 string.
3. **Generate a fresh CLI wallet**:
   ```bash
   solana-keygen new --outfile ~/pump-agent-key.json
   # View base58 private key:
   cat ~/pump-agent-key.json
   ```

> [!CAUTION]
> Never share your private key with anyone. Never commit your `.env` file to public GitHub repositories.

---

## 3. AI Model Credentials

You only need credentials for the **one** provider you choose in `AI_PROVIDER`.

### Option A: Local GitHub Copilot Proxy (`copilot`) — *(Default)*
- **Cost**: Uses your existing GitHub Copilot subscription.
- **`AI_PROVIDER`**: `copilot`
- **`COPILOT_URL`**: `http://localhost:4141`
- **`AI_MODEL`**: `gpt-4o`

#### 📍 How to set up:
1. Start your local Copilot proxy on port `4141`.
2. Verify it is running in your terminal:
   ```bash
   curl http://localhost:4141/v1/models
   ```
3. Set in `.env`:
   ```env
   AI_PROVIDER=copilot
   COPILOT_URL=http://localhost:4141
   AI_MODEL=gpt-4o
   ```

---

### Option B: Google Gemini API (`gemini`) — *(Fast & Free Tier Available)*
- **`AI_PROVIDER`**: `gemini`
- **`AI_MODEL`**: `gemini-1.5-flash`

#### 📍 Where to get your Gemini API Key:
1. Go to [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey).
2. Sign in with your Google account.
3. Click **"Create API Key"** $\rightarrow$ Select or create a project.
4. Copy the generated API key (starts with `AIzaSy...`).
5. Set in `.env`:
   ```env
   AI_PROVIDER=gemini
   GEMINI_API_KEY=AIzaSyYourGeneratedGeminiKeyHere
   AI_MODEL=gemini-1.5-flash
   ```

---

### Option C: Anthropic Claude API (`anthropic`) — *(Elite Reasoning)*
- **`AI_PROVIDER`**: `anthropic`
- **`AI_MODEL`**: `claude-3-5-haiku-20241022`

#### 📍 Where to get your Anthropic API Key:
1. Go to [https://console.anthropic.com](https://console.anthropic.com).
2. Sign up and navigate to **"API Keys"** in the left menu.
3. Click **"Create Key"** $\rightarrow$ Name it `pumpfun-agent`.
4. Copy the key (starts with `sk-ant-api03-...`).
5. Set in `.env`:
   ```env
   AI_PROVIDER=anthropic
   ANTHROPIC_API_KEY=sk-ant-api03-YourAnthropicKeyHere
   AI_MODEL=claude-3-5-haiku-20241022
   ```

---

### Option D: Ollama Offline Local LLM (`ollama`) — *(100% Free & Private)*
- **Cost**: $0.00 (Runs locally on your CPU/GPU).
- **`AI_PROVIDER`**: `ollama`
- **`OLLAMA_HOST`**: `http://localhost:11434`
- **`AI_MODEL`**: `deepseek-r1` or `llama3.3`

#### 📍 How to install & run Ollama:
1. Install Ollama in Linux:
   ```bash
   curl -fsSL https://ollama.com/install.sh | sh
   ```
2. Pull DeepSeek or Llama:
   ```bash
   ollama pull deepseek-r1
   ```
3. Set in `.env`:
   ```env
   AI_PROVIDER=ollama
   OLLAMA_HOST=http://localhost:11434
   AI_MODEL=deepseek-r1
   ```

---

### Option E: OpenAI API (`openai`)
- **`AI_PROVIDER`**: `openai`
- **`AI_MODEL`**: `gpt-4o-mini`

#### 📍 Where to get your OpenAI API Key:
1. Go to [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys).
2. Sign in $\rightarrow$ Click **"Create new secret key"**.
3. Copy the key (starts with `sk-proj-...`).
4. Set in `.env`:
   ```env
   AI_PROVIDER=openai
   OPENAI_API_KEY=sk-proj-YourOpenAIKeyHere
   AI_MODEL=gpt-4o-mini
   ```

---

## 4. Profit Auto-Vault & Cold Storage Setup

### `ENABLE_PROFIT_VAULT`
- **Default**: `true`
- **Description**: Activates the automated milestone locking engine.

### `BASE_BANKROLL_SOL`
- **Default**: `0.01` ($\sim \$2.00$ starting seed)
- **Description**: The active capital used for trading. After hitting each milestone, the active bankroll is reset to this amount.

### `PROFIT_VAULT_THRESHOLD_SOL`
- **Default**: `0.50` ($\sim \$100.00$ profit milestone)
- **Description**: When your balance crosses `BASE_BANKROLL_SOL + PROFIT_VAULT_THRESHOLD_SOL` (e.g. $0.01 + 0.50 = 0.51\text{ SOL}$), the bot locks the $0.50\text{ SOL}$ profit into the vault and resets your trading seed back to $0.01\text{ SOL}$.

### `VAULT_DESTINATION_WALLET`
- **Required**: Optional (Leave empty for local virtual vault).
- **Description**: A secondary cold storage or hardware wallet address. In `live` mode, the bot will automatically broadcast an on-chain transfer sending the locked profits to this address upon reaching each milestone.

```env
ENABLE_PROFIT_VAULT=true
BASE_BANKROLL_SOL=0.01
PROFIT_VAULT_THRESHOLD_SOL=0.50
VAULT_DESTINATION_WALLET=YourLedgerOrColdWalletSolanaAddressHere
```

---

## 5. Jito MEV Bundle Configuration

### `ENABLE_JITO`
- **Default**: `true`
- **Description**: When set to `true`, live transactions are packaged as private atomic bundles submitted directly to Jito Block Engines, protecting you against sandwich attacks and frontrunning.

### `JITO_TIP_LAMPORTS`
- **Default**: `1000000` ($0.001\text{ SOL}$)
- **Description**: The validator tip attached to the Jito bundle to guarantee placement in the very first slot of the block.

---

## 6. Telegram Bot & Mobile Alerts

Control your trading bot and receive instant trade alerts on your smartphone.

### `TELEGRAM_BOT_TOKEN` & `TELEGRAM_CHAT_ID`

#### 📍 Step-by-Step Telegram Setup:
1. Open Telegram on your phone or computer.
2. Search for `@BotFather` and click **Start**.
3. Send the command:
   ```text
   /newbot
   ```
4. Follow the prompts:
   - Enter a display name: `My Pump Agent`
   - Enter a username ending in `bot`: `my_pump_agent_bot`
5. BotFather will reply with your **API Token** (e.g. `7123456789:AAFlkjw9823k4jhkjsdf`).
6. Click the link to your new bot and click **Start** or send `/start`.
7. Next, search for `@userinfobot` in Telegram and click **Start**.
8. It will reply with your personal **Id** (a number like `987654321`).
9. Paste both values into `.env`:
   ```env
   TELEGRAM_BOT_TOKEN=7123456789:AAFlkjw9823k4jhkjsdf
   TELEGRAM_CHAT_ID=987654321
   ```

---

## 7. Full `.env` Template

Create a file named `.env` in the project root directory (`/root/pumpfun/.env`) and populate it:

```env
# ==========================================
# 🚀 PUMP.FUN QUANTUM AGENT CONFIGURATION
# ==========================================

# 1. Trading Mode
TRADING_MODE=paper              # 'paper' for simulation, 'live' for real mainnet SOL
WEB_PORT=3000

# 2. Solana Network & Keypair (Required for Live Mode)
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_PRIVATE_KEY=

# 3. AI Model Brain Matrix
AI_PROVIDER=copilot             # copilot | gemini | anthropic | ollama | openai | builtin
COPILOT_URL=http://localhost:4141
AI_MODEL=gpt-4o
MIN_AI_CONFIDENCE=60

# Optional API Keys (Only fill the one for your selected AI_PROVIDER)
GEMINI_API_KEY=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
OPENROUTER_API_KEY=
OLLAMA_HOST=http://localhost:11434

# 4. Cyclical Profit Auto-Vault ($1 -> $101 Milestone Lock)
ENABLE_PROFIT_VAULT=true
BASE_BANKROLL_SOL=0.01          # Base trading seed (~$2)
PROFIT_VAULT_THRESHOLD_SOL=0.50 # Lock +$100 into Safe Vault per cycle
VAULT_DESTINATION_WALLET=       # Optional on-chain cold wallet address

# 5. Trading Strategy & Risk Management
ACTIVE_STRATEGY=SNIPER          # SNIPER | MIGRATION_KOTH | MOMENTUM_SCALP | COPY_WHALE
SOL_PER_TRADE=0.01
MAX_ACTIVE_POSITIONS=3
SLIPPAGE_PERCENT=15
PRIORITY_FEE_LAMPORTS=1000000

# 6. Multi-Tier Take Profit & Breakeven Stop Levels
TAKE_PROFIT_1_PERCENT=50        # Sells 50%, elevates SL to Breakeven (+5%)
TAKE_PROFIT_2_PERCENT=100       # Sells 25%, elevates SL to +30%
TAKE_PROFIT_3_PERCENT=200       # Moonbag exit
STOP_LOSS_PERCENT=-20
TRAILING_STOP_TRIGGER_PERCENT=30
TRAILING_STOP_DISTANCE_PERCENT=15
MAX_HOLD_TIME_SECONDS=180

# 7. Jito MEV Anti-Frontrunning Protection
ENABLE_JITO=true
JITO_TIP_LAMPORTS=1000000

# 8. Mobile Telegram Alerts
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```
