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

  private escapeHtml(text: string): string {
    return (text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  public async notifyBuy(position: Position, mode: string): Promise<void> {
    const symbol = this.escapeHtml(position.symbol);
    const name = this.escapeHtml(position.name);
    const mint = this.escapeHtml(position.mint);

    const title = `🟢 [${mode.toUpperCase()}] BUY: ${symbol} (${name})`;
    const htmlMessage =
      `<b>Token:</b> ${symbol} (${name})\n` +
      `<b>Mint:</b> <code>${mint}</code>\n` +
      `<b>Invested:</b> ${position.investedSol.toFixed(4)} SOL\n` +
      `<b>Entry Price:</b> ${position.entryPriceSol.toExponential(4)} SOL\n` +
      `<b>Pump.fun:</b> https://pump.fun/${mint}\n` +
      (position.txSignature ? `<b>Tx:</b> https://solscan.io/tx/${position.txSignature}` : '');

    await this.send(title, htmlMessage, 0x00ff00);
  }

  public async notifySell(position: Position, signal: ExitSignal, mode: string): Promise<void> {
    const isProfit = signal.pnlSol >= 0;
    const emoji = isProfit ? '🟢' : '🔴';
    const symbol = this.escapeHtml(position.symbol);
    const name = this.escapeHtml(position.name);
    const mint = this.escapeHtml(position.mint);

    const title = `${emoji} [${mode.toUpperCase()}] SELL: ${symbol} (${signal.reason})`;
    const htmlMessage =
      `<b>Token:</b> ${symbol} (${name})\n` +
      `<b>Mint:</b> <code>${mint}</code>\n` +
      `<b>Reason:</b> <code>${signal.reason}</code>\n` +
      `<b>Sold Ratio:</b> ${(signal.sellRatio * 100).toFixed(0)}%\n` +
      `<b>PnL:</b> <b>${isProfit ? '+' : ''}${signal.pnlPercent.toFixed(2)}%</b> (${isProfit ? '+' : ''}${signal.pnlSol.toFixed(4)} SOL)\n` +
      (position.txSignature ? `<b>Tx:</b> https://solscan.io/tx/${position.txSignature}` : '');

    await this.send(title, htmlMessage, isProfit ? 0x00ff00 : 0xff0000);
  }

  public async notifyAlert(title: string, message: string): Promise<void> {
    await this.send(`⚠️ ${this.escapeHtml(title)}`, this.escapeHtml(message), 0xffaa00);
  }

  private async send(title: string, htmlMessage: string, color: number): Promise<void> {
    // Discord Webhook
    if (this.discordWebhookUrl && this.discordWebhookUrl.startsWith('http')) {
      try {
        const plainText = htmlMessage
          .replace(/<b>/g, '**')
          .replace(/<\/b>/g, '**')
          .replace(/<code>/g, '`')
          .replace(/<\/code>/g, '`');

        await axios.post(this.discordWebhookUrl, {
          embeds: [
            {
              title: title,
              description: plainText,
              color: color,
              timestamp: new Date().toISOString()
            }
          ]
        }, { timeout: 5000 });
      } catch (err: any) {
        console.error(chalk.yellow(`[Notifications] Discord webhook failed: ${err.message}`));
      }
    }

    // Telegram Bot
    if (this.telegramBotToken && this.telegramChatId) {
      try {
        const text = `<b>${title}</b>\n\n${htmlMessage}`;
        await axios.post(`https://api.telegram.org/bot${this.telegramBotToken}/sendMessage`, {
          chat_id: this.telegramChatId,
          text: text,
          parse_mode: 'HTML',
          disable_web_page_preview: true
        }, { timeout: 5000 });
      } catch (err: any) {
        console.error(chalk.yellow(`[Notifications] Telegram send failed: ${err.message}`));
      }
    }
  }
}
