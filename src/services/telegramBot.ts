import axios from 'axios';
import chalk from 'chalk';
import { AgentConfig, Position } from '../types';
import { ExitSignal } from './riskManager';
import { StrategyType } from '../strategies';
import { MigrationPrediction } from './migrationPredictor';

export interface TelegramBotHandlers {
  getStatus: () => Promise<string>;
  getPositions: () => Promise<Position[]>;
  panicSellAll: () => Promise<void>;
  sellSinglePosition: (mint: string, ratio?: number) => Promise<void>;
  changeStrategy: (strategy: StrategyType) => void;
  getVaultSummary: () => Promise<{ totalVaulted: number; cycles: number }>;
  getConfig: () => AgentConfig;
  updateConfig: (newConfig: Partial<AgentConfig>) => void;
  getRecentAiDecisions?: () => Promise<any[]>;
  getKothPredictions?: () => MigrationPrediction[];
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
    this.isEnabled = Boolean(this.botToken && this.botToken.trim().length > 5);

    if (this.isEnabled) {
      console.log(chalk.green.bold('[Telegram Bot] 📱 Ultra-Control Telegram Matrix Controller online!'));
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

  private makeProgressBar(percent: number, length: number = 10): string {
    const clamped = Math.max(0, Math.min(100, percent));
    const filled = Math.round((clamped / 100) * length);
    const empty = length - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  }

  // --- Telegram API Helpers ---

  public async sendAlert(message: string, replyMarkup?: any): Promise<void> {
    if (!this.isEnabled || !this.botToken || !this.chatId) return;

    try {
      await axios.post(
        `https://api.telegram.org/bot${this.botToken}/sendMessage`,
        {
          chat_id: this.chatId,
          text: message,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
          reply_markup: replyMarkup
        },
        { timeout: 6000 }
      );
    } catch (err: any) {
      console.error(chalk.yellow(`[Telegram Bot] Send alert failed: ${err.message}`));
    }
  }

  private async editMessage(messageId: number, text: string, replyMarkup?: any): Promise<void> {
    if (!this.isEnabled || !this.botToken || !this.chatId) return;

    try {
      await axios.post(
        `https://api.telegram.org/bot${this.botToken}/editMessageText`,
        {
          chat_id: this.chatId,
          message_id: messageId,
          text: text,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
          reply_markup: replyMarkup
        },
        { timeout: 6000 }
      );
    } catch {
      // If edit fails (e.g. identical content), fallback to sendAlert
      await this.sendAlert(text, replyMarkup);
    }
  }

  private async answerCallbackQuery(callbackQueryId: string, text?: string, showAlert: boolean = false): Promise<void> {
    if (!this.botToken) return;
    try {
      await axios.post(
        `https://api.telegram.org/bot${this.botToken}/answerCallbackQuery`,
        {
          callback_query_id: callbackQueryId,
          text: text,
          show_alert: showAlert
        },
        { timeout: 4000 }
      );
    } catch {
      // Silently ignore
    }
  }

  // --- Trade & Matrix Push Notifications ---

  public async notifyBuy(position: Position, dynamicSol: number): Promise<void> {
    const symbol = this.escapeHtml(position.symbol);
    const name = this.escapeHtml(position.name);
    const sector = this.escapeHtml(position.category || 'TECH_AI');
    const mint = this.escapeHtml(position.mint);
    const conf = position.aiConfidence || 75;
    const bar = this.makeProgressBar(conf, 8);

    const text =
      `🟢 <b>[MATRIX BOUGHT TOKEN]</b> 🚀\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `🪙 <b>${symbol}</b> (${name})\n` +
      `🏷️ <b>Category:</b> <code>[${sector}]</code>\n` +
      `💰 <b>Allocation:</b> <b>${dynamicSol.toFixed(4)} SOL</b>\n` +
      `🧠 <b>AI Conviction:</b> [${bar}] <b>${conf}%</b>\n` +
      (position.aiReasoning ? `💡 <i>"${this.escapeHtml(position.aiReasoning.substring(0, 120))}"</i>\n` : '') +
      `🔑 <code>${mint}</code>`;

    const markup = {
      inline_keyboard: [
        [
          { text: '🔴 Liquidate 100%', callback_data: `sell:${position.mint}:1.0` },
          { text: '🟠 Take 50%', callback_data: `sell:${position.mint}:0.5` }
        ],
        [
          { text: '🚀 View Pump.fun', url: `https://pump.fun/${position.mint}` },
          { text: '🔍 Solscan', url: `https://solscan.io/account/${position.mint}` }
        ]
      ]
    };

    await this.sendAlert(text, markup);
  }

  public async notifySell(position: Position, signal: ExitSignal, mode: string): Promise<void> {
    const isProfit = signal.pnlSol >= 0;
    const emoji = isProfit ? '🟢' : '🔴';
    const statusEmoji = isProfit ? '🏆 PROFIT HARVEST' : '🛡️ STOP LOSS DEFENSE';
    const symbol = this.escapeHtml(position.symbol);
    const name = this.escapeHtml(position.name);
    const pnlSign = isProfit ? '+' : '';
    const holdSecs = Math.max(0, Math.floor((Date.now() - position.buyTimestamp) / 1000));

    const text =
      `${emoji} <b>[${mode.toUpperCase()} ${statusEmoji}]</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `🪙 <b>${symbol}</b> (${name})\n` +
      `📊 <b>Realized PnL:</b> <b>${pnlSign}${signal.pnlPercent.toFixed(2)}%</b> (<b>${pnlSign}${signal.pnlSol.toFixed(4)} SOL</b>)\n` +
      `🎯 <b>Exit Trigger:</b> <code>${signal.reason}</code> (${(signal.sellRatio * 100).toFixed(0)}% sold)\n` +
      `⏱️ <b>Hold Time:</b> ${holdSecs}s\n` +
      `🔑 <code>${this.escapeHtml(position.mint)}</code>`;

    const markup = {
      inline_keyboard: [
        [
          { text: '📊 Matrix Status', callback_data: 'nav:status' },
          { text: '💼 Active Portfolio', callback_data: 'nav:positions' }
        ]
      ]
    };

    await this.sendAlert(text, markup);
  }

  public async notifyVaultMilestone(cycle: number, vaultedAmountSol: number, totalVaultedSol: number): Promise<void> {
    const text =
      `🏦 <b>[PROFIT VAULT MILESTONE SECURED!]</b> 🔒\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `🏆 <b>Cycle #${cycle} Completed Successfully!</b>\n` +
      `💎 <b>Locked To Safe Vault:</b> <b>+${vaultedAmountSol.toFixed(4)} SOL (~$100)</b>\n` +
      `🏦 <b>Total Vaulted Capital:</b> <b>${totalVaultedSol.toFixed(4)} SOL</b>\n` +
      `♻️ <b>Trading Bankroll:</b> Seed reset to baseline for Cycle #${cycle + 1}!`;

    const markup = {
      inline_keyboard: [
        [{ text: '🏦 View Vault Details', callback_data: 'nav:vault' }]
      ]
    };

    await this.sendAlert(text, markup);
  }

  public async notifyWhaleAlert(label: string, action: string, solAmount: number, mint: string): Promise<void> {
    const text =
      `🐋 <b>[ALPHA WHALE RADAR ALERT]</b> 📡\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 <b>Entity:</b> <code>${this.escapeHtml(label)}</code>\n` +
      `⚡ <b>Action:</b> <b>${action.toUpperCase()} ${solAmount.toFixed(2)} SOL</b>\n` +
      `🔑 <code>${this.escapeHtml(mint)}</code>`;

    const markup = {
      inline_keyboard: [
        [
          { text: '🚀 View on Pump.fun', url: `https://pump.fun/${mint}` },
          { text: '💼 Portfolio', callback_data: 'nav:positions' }
        ]
      ]
    };

    await this.sendAlert(text, markup);
  }

  // --- Long Polling Engine ---

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
            if (update.callback_query) {
              await this.handleCallbackQuery(update.callback_query);
            } else if (update.message) {
              await this.handleIncomingMessage(update.message);
            }
          }
        }
      } catch {
        // Silently retry on connection drops
      }

      if (this.isEnabled) {
        this.pollTimeout = setTimeout(poll, 1500);
      }
    };

    poll();
  }

  // --- Message & Command Processing ---

  private async handleIncomingMessage(message: any): Promise<void> {
    if (!message || !message.text) return;

    const senderChatId = String(message.chat.id);
    if (!this.chatId || this.chatId.trim().length === 0) {
      this.chatId = senderChatId;
      console.log(chalk.green(`[Telegram Bot] Connected and linked to Telegram Chat ID: ${this.chatId}`));
    } else if (senderChatId !== this.chatId) {
      return;
    }

    const text = message.text.trim();
    const parts = text.split(' ');
    const command = parts[0].toLowerCase();

    switch (command) {
      case '/start':
      case '/menu':
      case '📋 menu':
      case '/help':
        await this.replyMainMenu();
        break;
      case '/status':
      case '📊 status':
        await this.replyStatus();
        break;
      case '/positions':
      case '💼 positions':
        await this.replyPositions();
        break;
      case '/vault':
      case '🏦 vault':
        await this.replyVault();
        break;
      case '/strategy':
      case '🎯 strategy':
        if (parts[1]) {
          await this.executeStrategySwitch(parts[1]);
        } else {
          await this.replyStrategyMenu();
        }
        break;
      case '/settings':
      case '⚙️ settings':
        await this.replySettingsMenu();
        break;
      case '/ai':
      case '🧠 ai insights':
        await this.replyAiRadar();
        break;
      case '/koth':
        await this.replyKothRadar();
        break;
      case '/panic':
      case '🚨 panic sell':
        await this.replyPanicConfirmation();
        break;
      case '/sell':
        if (parts[1]) {
          const ratio = parts[2] ? parseFloat(parts[2]) : 1.0;
          await this.executeSingleSell(parts[1], ratio);
        } else {
          await this.sendAlert('⚠️ Usage: <code>/sell &lt;MINT_ADDRESS&gt; [0.5|1.0]</code>');
        }
        break;
      default:
        // Handle natural language shortcuts or unknown commands
        await this.replyMainMenu();
        break;
    }
  }

  // --- Callback Query (Button Clicks) Router ---

  private async handleCallbackQuery(cb: any): Promise<void> {
    const data: string = cb.data || '';
    const messageId: number = cb.message?.message_id;
    const queryId: string = cb.id;

    if (data.startsWith('nav:')) {
      const view = data.replace('nav:', '');
      await this.answerCallbackQuery(queryId);
      if (view === 'menu') await this.replyMainMenu(messageId);
      else if (view === 'status') await this.replyStatus(messageId);
      else if (view === 'positions') await this.replyPositions(messageId);
      else if (view === 'vault') await this.replyVault(messageId);
      else if (view === 'strategy') await this.replyStrategyMenu(messageId);
      else if (view === 'settings') await this.replySettingsMenu(messageId);
      else if (view === 'ai') await this.replyAiRadar(messageId);
      else if (view === 'koth') await this.replyKothRadar(messageId);
      else if (view === 'panic') await this.replyPanicConfirmation(messageId);
    } else if (data.startsWith('strat:')) {
      const strat = data.replace('strat:', '') as StrategyType;
      this.handlers?.changeStrategy(strat);
      await this.answerCallbackQuery(queryId, `✅ Active Strategy: ${strat}`, true);
      await this.replyStrategyMenu(messageId);
    } else if (data.startsWith('set:size:')) {
      const val = parseFloat(data.replace('set:size:', ''));
      this.handlers?.updateConfig({ solPerTrade: val });
      await this.answerCallbackQuery(queryId, `✅ Trade Size: ${val} SOL`, false);
      await this.replySettingsMenu(messageId);
    } else if (data.startsWith('set:slip:')) {
      const val = parseFloat(data.replace('set:slip:', ''));
      this.handlers?.updateConfig({ slippagePercent: val });
      await this.answerCallbackQuery(queryId, `✅ Slippage: ${val}%`, false);
      await this.replySettingsMenu(messageId);
    } else if (data.startsWith('set:conf:')) {
      const val = parseFloat(data.replace('set:conf:', ''));
      this.handlers?.updateConfig({ minAiConfidence: val });
      await this.answerCallbackQuery(queryId, `✅ Min AI Conf: ${val}%`, false);
      await this.replySettingsMenu(messageId);
    } else if (data.startsWith('sell:')) {
      const parts = data.split(':');
      const mint = parts[1];
      const ratio = parseFloat(parts[2] || '1.0');
      await this.answerCallbackQuery(queryId, `Liquidating ${(ratio * 100).toFixed(0)}%...`);
      await this.executeSingleSell(mint, ratio);
      await this.replyPositions(messageId);
    } else if (data === 'panic:confirm') {
      await this.answerCallbackQuery(queryId, '🚨 Liquidating all open positions!', true);
      await this.handlers?.panicSellAll();
      await this.sendAlert('✅ <b>All open positions liquidated successfully!</b>');
      await this.replyPositions(messageId);
    } else if (data === 'panic:cancel') {
      await this.answerCallbackQuery(queryId, 'Liquidation cancelled.');
      await this.replyMainMenu(messageId);
    }
  }

  // --- UI Screen Builders ---

  private async replyMainMenu(messageId?: number): Promise<void> {
    const config = this.handlers?.getConfig();
    const mode = (config?.tradingMode || 'paper').toUpperCase();
    const strat = config?.activeStrategy || 'SNIPER';

    const text =
      `🤖 <b>PUMP.FUN QUANTUM TITAN TRADING MATRIX</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `⚡ <b>Engine Status:</b> 🟢 <code>ONLINE & SCANNING</code>\n` +
      `🎯 <b>Strategy:</b> <b>${strat}</b> | <b>Mode:</b> <code>${mode}</code>\n` +
      `💡 <i>Select a module below for live control & telemetry:</i>`;

    const inlineMarkup = {
      inline_keyboard: [
        [
          { text: '📊 Live Status', callback_data: 'nav:status' },
          { text: '💼 Positions', callback_data: 'nav:positions' }
        ],
        [
          { text: '🏦 Profit Vault', callback_data: 'nav:vault' },
          { text: '🎯 Switch Strategy', callback_data: 'nav:strategy' }
        ],
        [
          { text: '🧠 AI Intelligence', callback_data: 'nav:ai' },
          { text: '👑 Raydium KOTH', callback_data: 'nav:koth' }
        ],
        [
          { text: '⚙️ Settings & Risk', callback_data: 'nav:settings' },
          { text: '🚨 PANIC SELL', callback_data: 'nav:panic' }
        ]
      ]
    };

    if (messageId) {
      await this.editMessage(messageId, text, inlineMarkup);
    } else {
      // Send with persistent bottom keyboard for 1-tap mobile navigation
      const persistentKeyboard = {
        keyboard: [
          [{ text: '📊 Status' }, { text: '💼 Positions' }],
          [{ text: '🏦 Vault' }, { text: '🎯 Strategy' }],
          [{ text: '🧠 AI Insights' }, { text: '⚙️ Settings' }],
          [{ text: '🚨 PANIC SELL' }]
        ],
        resize_keyboard: true,
        persistent: true
      };
      await this.sendAlert(text, inlineMarkup);
      await this.sendAlert('📱 <i>Quick menu attached below.</i>', persistentKeyboard);
    }
  }

  private async replyStatus(messageId?: number): Promise<void> {
    if (!this.handlers) return;
    const statusText = await this.handlers.getStatus();

    const markup = {
      inline_keyboard: [
        [
          { text: '🔄 Refresh', callback_data: 'nav:status' },
          { text: '💼 View Positions', callback_data: 'nav:positions' }
        ],
        [
          { text: '🏦 Profit Vault', callback_data: 'nav:vault' },
          { text: '🔙 Main Menu', callback_data: 'nav:menu' }
        ]
      ]
    };

    if (messageId) {
      await this.editMessage(messageId, statusText, markup);
    } else {
      await this.sendAlert(statusText, markup);
    }
  }

  private async replyPositions(messageId?: number): Promise<void> {
    if (!this.handlers) return;
    const positions = await this.handlers.getPositions();

    if (positions.length === 0) {
      const text =
        `💼 <b>ACTIVE PORTFOLIO (0 POSITIONS)</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🔍 Quantum Matrix is scanning token launches for optimal high-conviction entries.\n\n` +
        `<i>No risk active in the market right now.</i>`;

      const markup = {
        inline_keyboard: [
          [
            { text: '🔄 Scan Again', callback_data: 'nav:positions' },
            { text: '📊 Matrix Status', callback_data: 'nav:status' }
          ],
          [{ text: '🔙 Main Menu', callback_data: 'nav:menu' }]
        ]
      };

      if (messageId) await this.editMessage(messageId, text, markup);
      else await this.sendAlert(text, markup);
      return;
    }

    let text = `💼 <b>ACTIVE PORTFOLIO (${positions.length} OPEN POSITIONS)</b>\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    const keyboard: any[][] = [];

    positions.forEach((pos, idx) => {
      const isProfitable = pos.pnlPercent >= 0;
      const emoji = isProfitable ? '🟢' : '🔴';
      const sign = isProfitable ? '+' : '';
      const holdSec = Math.floor((Date.now() - pos.buyTimestamp) / 1000);
      const symbol = this.escapeHtml(pos.symbol);
      const name = this.escapeHtml(pos.name);
      const curveBar = this.makeProgressBar(pos.bondingCurveProgress || 0, 6);

      text +=
        `${emoji} <b>#${idx + 1} ${symbol}</b> (${name})\n` +
        `  • PnL: <b>${sign}${pos.pnlPercent.toFixed(2)}%</b> (<b>${sign}${pos.pnlSol.toFixed(4)} SOL</b>)\n` +
        `  • Invested: <code>${pos.investedSol.toFixed(4)} SOL</code> | Hold: <code>${holdSec}s</code>\n` +
        `  • Bonding Curve: [${curveBar}] ${(pos.bondingCurveProgress || 0).toFixed(0)}%\n` +
        `  • Mint: <code>${pos.mint.substring(0, 8)}...${pos.mint.substring(pos.mint.length - 6)}</code>\n\n`;

      keyboard.push([
        { text: `🔴 Sell 100% ${pos.symbol}`, callback_data: `sell:${pos.mint}:1.0` },
        { text: `🟠 Sell 50%`, callback_data: `sell:${pos.mint}:0.5` }
      ]);
    });

    keyboard.push([
      { text: '🚨 Panic Liquidate All', callback_data: 'nav:panic' },
      { text: '🔄 Refresh', callback_data: 'nav:positions' }
    ]);
    keyboard.push([{ text: '🔙 Main Menu', callback_data: 'nav:menu' }]);

    if (messageId) await this.editMessage(messageId, text, { inline_keyboard: keyboard });
    else await this.sendAlert(text, { inline_keyboard: keyboard });
  }

  private async replyVault(messageId?: number): Promise<void> {
    if (!this.handlers) return;
    const vault = await this.handlers.getVaultSummary();
    const config = this.handlers.getConfig();
    const threshold = config.profitVaultThresholdSol || 0.5;
    const progressPercent = Math.min(100, Math.round(((vault.totalVaulted % threshold) / threshold) * 100));
    const progressBar = this.makeProgressBar(progressPercent, 10);

    const text =
      `🏦 <b>CYCLICAL PROFIT VAULT MATRIX</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🔒 <b>Total Capital Secured:</b> <b>${vault.totalVaulted.toFixed(4)} SOL</b> (~$${(vault.totalVaulted * 200).toFixed(0)})\n` +
      `♻️ <b>Completed Vault Cycles:</b> <b>#${vault.cycles}</b>\n` +
      `🎯 <b>Cycle Milestone Progress:</b>\n` +
      `   [${progressBar}] <b>${progressPercent}%</b> towards Cycle #${vault.cycles + 1}\n\n` +
      `🛡️ <i>The Profit Vault automatically skims and locks profits to preserve principal capital across all market volatility.</i>`;

    const markup = {
      inline_keyboard: [
        [
          { text: '🔄 Refresh Vault', callback_data: 'nav:vault' },
          { text: '📊 Live Status', callback_data: 'nav:status' }
        ],
        [{ text: '🔙 Main Menu', callback_data: 'nav:menu' }]
      ]
    };

    if (messageId) await this.editMessage(messageId, text, markup);
    else await this.sendAlert(text, markup);
  }

  private async replyStrategyMenu(messageId?: number): Promise<void> {
    const config = this.handlers?.getConfig();
    const current = config?.activeStrategy || 'SNIPER';

    const text =
      `🎯 <b>STRATEGY COORDINATION MATRIX</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `⚡ <b>Active Strategy:</b> <b>${current}</b>\n\n` +
      `Select a quantitative strategy below to switch execution algorithm:`;

    const markup = {
      inline_keyboard: [
        [
          { text: `${current === 'SNIPER' ? '✅' : '⚡'} SNIPER (Sub-Sec)`, callback_data: 'strat:SNIPER' },
          { text: `${current === 'MIGRATION_KOTH' ? '✅' : '👑'} RAYDIUM KOTH`, callback_data: 'strat:MIGRATION_KOTH' }
        ],
        [
          { text: `${current === 'MOMENTUM_SCALP' ? '✅' : '📈'} MOMENTUM SCALP`, callback_data: 'strat:MOMENTUM_SCALP' },
          { text: `${current === 'COPY_WHALE' ? '✅' : '🐋'} COPY WHALE`, callback_data: 'strat:COPY_WHALE' }
        ],
        [{ text: '🔙 Main Menu', callback_data: 'nav:menu' }]
      ]
    };

    if (messageId) await this.editMessage(messageId, text, markup);
    else await this.sendAlert(text, markup);
  }

  private async replySettingsMenu(messageId?: number): Promise<void> {
    const config = this.handlers?.getConfig();
    if (!config) return;

    const text =
      `⚙️ <b>AGENT SETTINGS & RISK CONTROLS</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `💰 <b>Trade Size:</b> <code>${config.solPerTrade} SOL</code>\n` +
      `⚡ <b>Max Slippage:</b> <code>${config.slippagePercent}%</code>\n` +
      `🧠 <b>Min AI Conviction:</b> <code>${config.minAiConfidence}%</code>\n` +
      `🛡️ <b>Stop Loss:</b> <code>${config.stopLossPercent}%</code> | <b>TP1:</b> <code>+${config.takeProfit1Percent}%</code>\n\n` +
      `<i>Tap any parameter below to adjust in real-time:</i>`;

    const markup = {
      inline_keyboard: [
        [
          { text: '💰 0.01 SOL', callback_data: 'set:size:0.01' },
          { text: '💰 0.02 SOL', callback_data: 'set:size:0.02' },
          { text: '💰 0.05 SOL', callback_data: 'set:size:0.05' },
          { text: '💰 0.10 SOL', callback_data: 'set:size:0.10' }
        ],
        [
          { text: '⚡ 10% Slip', callback_data: 'set:slip:10' },
          { text: '⚡ 15% Slip', callback_data: 'set:slip:15' },
          { text: '⚡ 20% Slip', callback_data: 'set:slip:20' },
          { text: '⚡ 25% Slip', callback_data: 'set:slip:25' }
        ],
        [
          { text: '🧠 50% Conf', callback_data: 'set:conf:50' },
          { text: '🧠 60% Conf', callback_data: 'set:conf:60' },
          { text: '🧠 70% Conf', callback_data: 'set:conf:70' },
          { text: '🧠 80% Conf', callback_data: 'set:conf:80' }
        ],
        [
          { text: '🔄 Refresh', callback_data: 'nav:settings' },
          { text: '🔙 Main Menu', callback_data: 'nav:menu' }
        ]
      ]
    };

    if (messageId) await this.editMessage(messageId, text, markup);
    else await this.sendAlert(text, markup);
  }

  private async replyAiRadar(messageId?: number): Promise<void> {
    let text =
      `🧠 <b>AI QUANTUM INTELLIGENCE RADAR</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🤖 <b>Model:</b> <code>${this.handlers?.getConfig().aiModel || 'GPT-4o'}</code>\n` +
      `📊 <b>Recent Evaluated Opportunities:</b>\n\n`;

    if (this.handlers?.getRecentAiDecisions) {
      const decisions = await this.handlers.getRecentAiDecisions();
      if (decisions && decisions.length > 0) {
        for (const d of decisions.slice(0, 4)) {
          const actionEmoji = d.decision === 'BUY' ? '🟢 BUY' : '⚪ SKIP';
          text +=
            `• ${actionEmoji} <b>${this.escapeHtml(d.symbol)}</b> (Score: ${d.confidence}%)\n` +
            `  <i>"${this.escapeHtml(d.reasoning?.substring(0, 80) || 'Quantitative match')}"</i>\n\n`;
        }
      } else {
        text += `<i>Scanning active pump.fun stream...</i>\n\n`;
      }
    } else {
      text += `<i>Scanning active pump.fun stream...</i>\n\n`;
    }

    const markup = {
      inline_keyboard: [
        [
          { text: '🔄 Refresh AI', callback_data: 'nav:ai' },
          { text: '💼 View Positions', callback_data: 'nav:positions' }
        ],
        [{ text: '🔙 Main Menu', callback_data: 'nav:menu' }]
      ]
    };

    if (messageId) await this.editMessage(messageId, text, markup);
    else await this.sendAlert(text, markup);
  }

  private async replyKothRadar(messageId?: number): Promise<void> {
    const preds = this.handlers?.getKothPredictions?.() || [];

    let text =
      `👑 <b>RAYDIUM GRADUATION KOTH RADAR</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Tracking tokens nearing 100% bonding curve completion:\n\n`;

    if (preds.length === 0) {
      text += `<i>No tokens currently in 70%+ graduation zone. Monitoring curve inflows...</i>\n\n`;
    } else {
      for (const p of preds.slice(0, 5)) {
        const bar = this.makeProgressBar(p.progressPercent, 8);
        const velocity = typeof p.solVelocityPerMinute === 'number' ? p.solVelocityPerMinute.toFixed(2) : '0.00';
        text +=
          `👑 <b>${this.escapeHtml(p.symbol)}</b> [${bar}] <b>${p.progressPercent.toFixed(1)}%</b>\n` +
          `  • Velocity: ${velocity} SOL/min | Est: ~${p.estimatedMinutesToGraduation || '?'} mins\n` +
          `  • Mint: <code>${p.mint}</code>\n\n`;
      }
    }

    const markup = {
      inline_keyboard: [
        [
          { text: '🔄 Refresh KOTH', callback_data: 'nav:koth' },
          { text: '🎯 Strategy', callback_data: 'nav:strategy' }
        ],
        [{ text: '🔙 Main Menu', callback_data: 'nav:menu' }]
      ]
    };

    if (messageId) await this.editMessage(messageId, text, markup);
    else await this.sendAlert(text, markup);
  }

  private async replyPanicConfirmation(messageId?: number): Promise<void> {
    const text =
      `🚨 <b>EMERGENCY PANIC LIQUIDATION CONFIRMATION</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `⚠️ <b>WARNING:</b> This will execute immediate market sells on <b>ALL</b> active open positions at current market prices.\n\n` +
      `Are you sure you want to liquidate the entire portfolio?`;

    const markup = {
      inline_keyboard: [
        [
          { text: '🚨 YES, LIQUIDATE ALL', callback_data: 'panic:confirm' },
          { text: '❌ CANCEL', callback_data: 'panic:cancel' }
        ]
      ]
    };

    if (messageId) await this.editMessage(messageId, text, markup);
    else await this.sendAlert(text, markup);
  }

  // --- Execution Actions ---

  private async executeStrategySwitch(stratArg: string): Promise<void> {
    const upper = stratArg.toUpperCase() as StrategyType;
    if (['SNIPER', 'MIGRATION_KOTH', 'MOMENTUM_SCALP', 'COPY_WHALE'].includes(upper)) {
      this.handlers?.changeStrategy(upper);
      await this.sendAlert(`✅ Switched active trading strategy to: <b>${upper}</b>`);
    } else {
      await this.sendAlert(`❌ Invalid strategy: <code>${stratArg}</code>\nOptions: SNIPER, MIGRATION_KOTH, MOMENTUM_SCALP, COPY_WHALE`);
    }
  }

  private async executeSingleSell(mint: string, ratio: number = 1.0): Promise<void> {
    try {
      await this.handlers?.sellSinglePosition(mint, ratio);
      await this.sendAlert(`✅ Sell order of <b>${(ratio * 100).toFixed(0)}%</b> dispatched for <code>${mint}</code>.`);
    } catch (err: any) {
      await this.sendAlert(`❌ Sell failed: ${err.message}`);
    }
  }

  public stop(): void {
    this.isEnabled = false;
    if (this.pollTimeout) clearTimeout(this.pollTimeout);
  }
}
