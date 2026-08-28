import axios from 'axios';
import chalk from 'chalk';
import { Position } from '../types';

export class TelegramBot {
  private botToken?: string;
  private chatId?: string;
  private isEnabled: boolean = false;

  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN;
    this.chatId = process.env.TELEGRAM_CHAT_ID;
    this.isEnabled = Boolean(this.botToken && this.chatId && this.botToken.length > 5);

    if (this.isEnabled) {
      console.log(chalk.green.bold('[Telegram Bot] 📱 Interactive Telegram Controller online!'));
    }
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
        { timeout: 5000 }
      );
    } catch {
      // Silently ignore telegram network issues
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
      `• <b>Sector:</b> ${sector}\n` +
      `• <b>Invested:</b> ${dynamicSol.toFixed(4)} SOL\n` +
      `• <b>AI Confidence:</b> ${position.aiConfidence || 'N/A'}%\n` +
      `• <b>Mint:</b> <code>${mint}</code>\n` +
      `• <a href="https://pump.fun/${mint}">View on Pump.fun</a>`;
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
}
