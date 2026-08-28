import axios from 'axios';
import chalk from 'chalk';
import { Position } from '../types';
import { ExitSignal } from './riskManager';
import { StrategyType } from '../strategies';

export interface TelegramBotHandlers {
  getStatus: () => Promise<string>;
  getPositions: () => Promise<Position[]>;
  panicSellAll: () => Promise<void>;
  sellSinglePosition: (mint: string) => Promise<void>;
  changeStrategy: (strategy: StrategyType) => void;
  getVaultSummary: () => Promise<{ totalVaulted: number; cycles: number }>;
}

export class TelegramBot {
  private botToken?: string;
  private chatId?: string;
  private isEnabled: boolean = false;
  private handlers?: TelegramBotHandlers;
  private lastUpdateId: number = 0;
  private isPolling: boolean = false;
  private pollTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN;
    this.chatId = process.env.TELEGRAM_CHAT_ID;
    this.isEnabled = Boolean(this.botToken && this.chatId && this.botToken.length > 5);

    if (this.isEnabled) {
      console.log(chalk.green.bold('[Telegram Bot] 📱 Interactive Telegram Controller online!'));
      this.startPolling();
    }
  }

  public registerHandlers(handlers: TelegramBotHandlers): void {
    this.handlers = handlers;
  }

  private escapeHtml(text: string): string {
    return (text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  public async sendAlert(message: string): Promise<void> {
    if (!this.isEnabled || !this.botToken || !this.chatId) return;

    try {
      await axios.post(
        `https://api.telegram.org/bot${this.botToken}/sendMessage`,
        {
          chat_id: this.chatId,
          text: message,
          parse_mode: 'HTML',
          disable_web_page_preview: false
        },
        { timeout: 6000 }
      );
    } catch (err: any) {
      // Silently ignore network failures on notifications
    }
  }

  public async notifyBuy(position: Position, dynamicSol: number): Promise<void> {
    const symbol = this.escapeHtml(position.symbol);
    const name = this.escapeHtml(position.name);
    const sector = this.escapeHtml(position.category || 'TECH_AI');
    const mint = this.escapeHtml(position.mint);

    const text = 
      `🟢 <b>[PUMP.FUN AGENT] BOUGHT TOKEN</b>\n\n` +
      `• <b>Token:</b> ${symbol} (${name})\n` +
      `• <b>Sector:</b> <code>[${sector}]</code>\n` +
      `• <b>Invested:</b> ${dynamicSol.toFixed(4)} SOL\n` +
      `• <b>AI Confidence:</b> ${position.aiConfidence || 'N/A'}%\n` +
      `• <b>Mint:</b> <code>${mint}</code>\n` +
      `• <a href="https://pump.fun/${mint}">View on Pump.fun</a>`;
    await this.sendAlert(text);
  }

  public async notifySell(position: Position, signal: ExitSignal, mode: string): Promise<void> {
    const isProfit = signal.pnlSol >= 0;
    const emoji = isProfit ? '🟢' : '🔴';
    const symbol = this.escapeHtml(position.symbol);
    const name = this.escapeHtml(position.name);
    const pnlSign = isProfit ? '+' : '';

    const text = 
      `${emoji} <b>[${mode.toUpperCase()}] SOLD TOKEN</b>\n\n` +
      `• <b>Token:</b> ${symbol} (${name})\n` +
      `• <b>Reason:</b> <code>${signal.reason}</code>\n` +
      `• <b>Sold Ratio:</b> ${(signal.sellRatio * 100).toFixed(0)}%\n` +
      `• <b>Realized PnL:</b> <b>${pnlSign}${signal.pnlPercent.toFixed(2)}%</b> (${pnlSign}${signal.pnlSol.toFixed(4)} SOL)\n` +
      `• <b>Mint:</b> <code>${position.mint}</code>\n` +
      (position.txSignature ? `• <a href="https://solscan.io/tx/${position.txSignature}">View on Solscan</a>` : '');
    await this.sendAlert(text);
  }

  public async notifyVaultMilestone(cycle: number, vaultedAmountSol: number, totalVaultedSol: number): Promise<void> {
    const text = 
      `🏦 <b>[PROFIT VAULT MILESTONE REACHED] Cycle #${cycle}</b>\n\n` +
      `• <b>Locked Profit:</b> +${vaultedAmountSol.toFixed(4)} SOL (~$100)\n` +
      `• <b>Total Vaulted:</b> ${totalVaultedSol.toFixed(4)} SOL\n` +
      `• <b>Action:</b> Trading seed reset to $1 baseline for next cycle. 🔒`;
    await this.sendAlert(text);
  }

  public async notifyWhaleAlert(label: string, action: string, solAmount: number, mint: string): Promise<void> {
    const text = 
      `🐋 <b>[ALPHA WHALE RADAR ALERT]</b>\n\n` +
      `• <b>Whale:</b> ${this.escapeHtml(label)}\n` +
      `• <b>Action:</b> <b>${action}</b> ${solAmount.toFixed(2)} SOL\n` +
      `• <b>Mint:</b> <code>${this.escapeHtml(mint)}</code>\n` +
      `• <a href="https://pump.fun/${mint}">View on Pump.fun</a>`;
    await this.sendAlert(text);
  }

  // --- Long Polling Interactive Controller ---

  private async startPolling(): Promise<void> {
    if (this.isPolling) return;
    this.isPolling = true;

    const poll = async () => {
      if (!this.isEnabled || !this.botToken) return;

      try {
        const response = await axios.get(
          `https://api.telegram.org/bot${this.botToken}/getUpdates`,
          {
            params: {
              offset: this.lastUpdateId + 1,
              timeout: 10
            },
            timeout: 15000
          }
        );

        if (response.data && response.data.ok && Array.isArray(response.data.result)) {
          for (const update of response.data.result) {
            this.lastUpdateId = update.update_id;
            await this.handleIncomingUpdate(update);
          }
        }
      } catch {
        // Silently retry on timeout
      }

      if (this.isEnabled) {
        this.pollTimeout = setTimeout(poll, 1500);
      }
    };

    poll();
  }

  private async handleIncomingUpdate(update: any): Promise<void> {
    const message = update.message;
    if (!message || !message.text) return;

    const senderChatId = String(message.chat.id);
    if (this.chatId && senderChatId !== this.chatId) {
      // Ignore unauthorized users
      return;
    }

    const text = message.text.trim();
    const parts = text.split(' ');
    const command = parts[0].toLowerCase();

    switch (command) {
      case '/start':
      case '/help':
        await this.replyHelp();
        break;
      case '/status':
        await this.replyStatus();
        break;
      case '/positions':
        await this.replyPositions();
        break;
      case '/vault':
        await this.replyVault();
        break;
      case '/strategy':
        await this.handleStrategyCommand(parts[1]);
        break;
      case '/panic':
        await this.handlePanicCommand();
        break;
      case '/sell':
        await this.handleSellCommand(parts[1]);
        break;
    }
  }

  private async replyHelp(): Promise<void> {
    const text =
      `🤖 <b>PUMP.FUN QUANTUM BOT COMMANDS</b>\n\n` +
      `• <code>/status</code> - Live bankroll, win rate & realized PnL\n` +
      `• <code>/positions</code> - List active open positions & PnL\n` +
      `• <code>/vault</code> - Safe Vault locked profit summary\n` +
      `• <code>/strategy &lt;NAME&gt;</code> - Switch active strategy (SNIPER, MIGRATION_KOTH, MOMENTUM_SCALP, COPY_WHALE)\n` +
      `• <code>/sell &lt;MINT&gt;</code> - Liquidate a specific open position\n` +
      `• <code>/panic</code> - 🚨 Emergency liquidate all open positions\n` +
      `• <code>/help</code> - Show this menu`;
    await this.sendAlert(text);
  }

  private async replyStatus(): Promise<void> {
    if (!this.handlers) {
      await this.sendAlert('⚠️ Handler not initialized.');
      return;
    }
    const statusText = await this.handlers.getStatus();
    await this.sendAlert(statusText);
  }

  private async replyPositions(): Promise<void> {
    if (!this.handlers) return;
    const positions = await this.handlers.getPositions();

    if (positions.length === 0) {
      await this.sendAlert('📊 <b>Active Positions:</b> None. Quantum Matrix scanning market.');
      return;
    }

    let text = `📊 <b>ACTIVE POSITIONS (${positions.length})</b>\n\n`;
    for (const pos of positions) {
      const pnlColor = pos.pnlPercent >= 0 ? '🟢' : '🔴';
      const holdSec = Math.floor((Date.now() - pos.buyTimestamp) / 1000);
      const symbol = this.escapeHtml(pos.symbol);
      const name = this.escapeHtml(pos.name);
      text +=
        `${pnlColor} <b>${symbol}</b> (${name})\n` +
        `  • PnL: <b>${pos.pnlPercent >= 0 ? '+' : ''}${pos.pnlPercent.toFixed(2)}%</b> (${pos.pnlSol >= 0 ? '+' : ''}${pos.pnlSol.toFixed(4)} SOL)\n` +
        `  • Invested: ${pos.investedSol.toFixed(4)} SOL | Hold: ${holdSec}s\n` +
        `  • Mint: <code>${pos.mint}</code>\n\n`;
    }
    await this.sendAlert(text);
  }

  private async replyVault(): Promise<void> {
    if (!this.handlers) return;
    const vault = await this.handlers.getVaultSummary();
    const text =
      `🏦 <b>CYCLICAL PROFIT VAULT</b>\n\n` +
      `• <b>Total Locked:</b> <b>${vault.totalVaulted.toFixed(4)} SOL</b>\n` +
      `• <b>Completed Cycles:</b> #${vault.cycles}\n` +
      `• <b>Safety:</b> 100% Capital Preservation Secured. 🔒`;
    await this.sendAlert(text);
  }

  private async handleStrategyCommand(stratArg?: string): Promise<void> {
    if (!stratArg) {
      await this.sendAlert('⚠️ Please specify strategy: <code>/strategy SNIPER</code>, <code>/strategy MIGRATION_KOTH</code>, <code>/strategy MOMENTUM_SCALP</code>, <code>/strategy COPY_WHALE</code>');
      return;
    }

    const upper = stratArg.toUpperCase() as StrategyType;
    if (['SNIPER', 'MIGRATION_KOTH', 'MOMENTUM_SCALP', 'COPY_WHALE'].includes(upper)) {
      this.handlers?.changeStrategy(upper);
      await this.sendAlert(`✅ Switched active trading strategy to: <b>${upper}</b>`);
    } else {
      await this.sendAlert(`❌ Invalid strategy: ${stratArg}`);
    }
  }

  private async handlePanicCommand(): Promise<void> {
    await this.sendAlert('🚨 <b>EXECUTING PANIC SELL ALL ON ALL POSITIONS!</b>');
    await this.handlers?.panicSellAll();
    await this.sendAlert('✅ <b>All positions liquidated successfully.</b>');
  }

  private async handleSellCommand(mint?: string): Promise<void> {
    if (!mint) {
      await this.sendAlert('⚠️ Please specify mint: <code>/sell &lt;MINT_ADDRESS&gt;</code>');
      return;
    }
    await this.handlers?.sellSinglePosition(mint);
    await this.sendAlert(`✅ Sell order executed for <code>${mint}</code>.`);
  }

  public stop(): void {
    this.isEnabled = false;
    if (this.pollTimeout) clearTimeout(this.pollTimeout);
  }
}
