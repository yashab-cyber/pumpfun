import axios from 'axios';
import chalk from 'chalk';
import { Position } from '../types';
import { ExitSignal } from './riskManager';

export class NotificationService {
  private discordWebhookUrl?: string;
  private telegramBotToken?: string;
  private telegramChatId?: string;

  constructor() {
    this.discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;
    this.telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
    this.telegramChatId = process.env.TELEGRAM_CHAT_ID;
  }

  public async notifyBuy(position: Position, mode: string): Promise<void> {
    const title = `🟢 [${mode.toUpperCase()}] BUY: ${position.symbol} (${position.name})`;
    const message =
      `**Token:** ${position.symbol} (${position.name})\n` +
      `**Mint:** \`${position.mint}\`\n` +
      `**Invested:** ${position.investedSol.toFixed(4)} SOL\n` +
      `**Entry Price:** ${position.entryPriceSol.toExponential(4)} SOL\n` +
      `**Pump.fun:** https://pump.fun/${position.mint}\n` +
      (position.txSignature ? `**Tx:** https://solscan.io/tx/${position.txSignature}` : '');

    await this.send(title, message, 0x00ff00);
  }

  public async notifySell(position: Position, signal: ExitSignal, mode: string): Promise<void> {
    const isProfit = signal.pnlSol >= 0;
    const emoji = isProfit ? '🟢' : '🔴';
    const title = `${emoji} [${mode.toUpperCase()}] SELL: ${position.symbol} (${signal.reason})`;
    const message =
      `**Token:** ${position.symbol} (${position.name})\n` +
      `**Mint:** \`${position.mint}\`\n` +
      `**Reason:** ${signal.reason}\n` +
      `**Sold Ratio:** ${(signal.sellRatio * 100).toFixed(0)}%\n` +
      `**PnL:** ${isProfit ? '+' : ''}${signal.pnlPercent.toFixed(2)}% (${isProfit ? '+' : ''}${signal.pnlSol.toFixed(4)} SOL)\n` +
      (position.txSignature ? `**Tx:** https://solscan.io/tx/${position.txSignature}` : '');

    await this.send(title, message, isProfit ? 0x00ff00 : 0xff0000);
  }

  public async notifyAlert(title: string, message: string): Promise<void> {
    await this.send(`⚠️ ${title}`, message, 0xffaa00);
  }

  private async send(title: string, message: string, color: number): Promise<void> {
    // Discord Webhook
    if (this.discordWebhookUrl && this.discordWebhookUrl.startsWith('http')) {
      try {
        await axios.post(this.discordWebhookUrl, {
          embeds: [
            {
              title: title,
              description: message,
              color: color,
              timestamp: new Date().toISOString()
            }
          ]
        });
      } catch (err: any) {
        console.error(chalk.yellow(`[Notifications] Discord webhook failed: ${err.message}`));
      }
    }

    // Telegram Bot
    if (this.telegramBotToken && this.telegramChatId) {
      try {
        const text = `*${title}*\n\n${message.replace(/\*\*/g, '*').replace(/`/g, '')}`;
        await axios.post(`https://api.telegram.org/bot${this.telegramBotToken}/sendMessage`, {
          chat_id: this.telegramChatId,
          text: text,
          parse_mode: 'Markdown'
        });
      } catch (err: any) {
        console.error(chalk.yellow(`[Notifications] Telegram send failed: ${err.message}`));
      }
    }
  }
}
