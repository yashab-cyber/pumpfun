# 📱 Interactive Telegram Controller Setup

Control your trading bot and receive instant trade alerts and profit notifications directly on your mobile device.

---

## 1. Setting Up Your Telegram Bot

1. Open Telegram and search for `@BotFather`.
2. Send `/newbot` and follow the prompts to choose a bot name and username (e.g. `MyPumpAgentBot`).
3. Copy the **HTTP API Token** provided by BotFather (e.g. `789123456:AAFlk...`).
4. Start a chat with your new bot and send any message (e.g. `hello`).
5. Open Telegram and search for `@userinfobot` to get your personal **Chat ID** (a number like `123456789`).

---

## 2. Configuring `.env`

Add your bot credentials to `/root/pumpfun/.env`:

```env
TELEGRAM_BOT_TOKEN=789123456:AAFlk...
TELEGRAM_CHAT_ID=123456789
```

---

## 3. Alerts You Will Receive

- 🟢 **New Buy Alerts**: Token symbol, sector, dynamic SOL size, AI confidence, and direct Pump.fun link.
- 🔴 **Exit & Profit Alerts**: Realized PnL %, SOL returned, and exit trigger reason.
- 🏦 **Vault Milestones**: Notifies you whenever a $100 profit milestone is locked and trading bankroll is reset.
- 🐋 **Whale Alerts**: Real-time notifications when alpha insider wallets accumulate tokens.
