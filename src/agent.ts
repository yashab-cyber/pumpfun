import chalk from 'chalk';
import Table from 'cli-table3';
import { AgentConfig, Position, TokenCreationEvent, TradeEvent } from './types';
import { SolanaService } from './services/solana';
import { FilterEngine } from './services/filterEngine';
import { RiskManager, ExitSignal } from './services/riskManager';
import { PumpPortalService } from './services/pumpPortal';
import { PaperTrader } from './services/paperTrader';
import { LiveTrader } from './services/liveTrader';
import { WebServer } from './services/webServer';
import { NotificationService } from './services/notificationService';
import { RugCheckService } from './services/rugCheck';
import { CopyTrader } from './services/copyTrader';
import { TradeJournal } from './services/db';
import { StrategyManager, StrategyType } from './strategies';
import { GasOptimizer } from './services/gasOptimizer';
import { BondingCurveCalculator } from './services/bondingCurve';
import { SQLiteMemory } from './services/sqliteMemory';
import { AIBrain } from './services/aiBrain';
import { ProfitVault } from './services/profitVault';
import { ResearchEngine, TokenCategory } from './services/researchEngine';
import { WhaleTracker, WhaleAlert } from './services/whaleTracker';
import { PositionSizer } from './services/positionSizer';
import { MigrationPredictor, MigrationPrediction } from './services/migrationPredictor';
import { StrategyCoordinator, MarketRegime } from './services/strategyCoordinator';
import { TelegramBot } from './services/telegramBot';
import { ClusterDetector } from './services/clusterDetector';
import { StealthRugDetector } from './services/stealthRugDetector';
import { RpcFailoverManager } from './services/rpcFailover';
import { SocialSentimentAnalyzer } from './services/socialSentiment';
import { LossRecoveryManager } from './services/lossRecovery';
import { SandwichGuard } from './services/sandwichGuard';
import { ReinvestmentEngine } from './services/reinvestmentEngine';
import { Backtester } from './services/backtester';

export class PumpFunAgent {
  private config: AgentConfig;
  private solanaService: SolanaService;
  private filterEngine: FilterEngine;
  private riskManager: RiskManager;
  private pumpPortal: PumpPortalService;
  private paperTrader?: PaperTrader;
  private liveTrader?: LiveTrader;
  private webServer: WebServer;
  private notificationService: NotificationService;
  private rugCheckService: RugCheckService;
  private copyTrader: CopyTrader;
  private journal: TradeJournal;
  private strategyManager: StrategyManager;
  private gasOptimizer: GasOptimizer;
  private sqliteMemory: SQLiteMemory;
  private aiBrain: AIBrain;
  private profitVault: ProfitVault;
  private researchEngine: ResearchEngine;
  private whaleTracker: WhaleTracker;
  private positionSizer: PositionSizer;
  private migrationPredictor: MigrationPredictor;
  private strategyCoordinator: StrategyCoordinator;
  private telegramBot: TelegramBot;
  private clusterDetector: ClusterDetector;
  private stealthRugDetector: StealthRugDetector;
  private rpcFailover: RpcFailoverManager;
  private socialSentiment: SocialSentimentAnalyzer;
  private lossRecovery: LossRecoveryManager;
  private sandwichGuard: SandwichGuard;
  private reinvestmentEngine: ReinvestmentEngine;
  private backtester: Backtester;

  private isRunning: boolean = false;
  private monitorInterval: NodeJS.Timeout | null = null;
  private dashboardInterval: NodeJS.Timeout | null = null;
  private processedTokensCount: number = 0;
  private passedTokensCount: number = 0;
  private devPubkeyMap: Map<string, string> = new Map();
  private tokenSymbolMap: Map<string, string> = new Map();
  private latestPredictions: Map<string, MigrationPrediction> = new Map();

  constructor(config: AgentConfig) {
    this.config = config;
    this.solanaService = new SolanaService(config.rpcUrl, config.privateKey);
    this.rpcFailover = new RpcFailoverManager(config.rpcUrl);
    this.rpcFailover.setOnFailover((node) => {
      this.solanaService.updateConnection(node.connection);
    });
    this.filterEngine = new FilterEngine(config);
    this.riskManager = new RiskManager(config);
    this.pumpPortal = new PumpPortalService(this.solanaService);
    this.journal = new TradeJournal(config.tradingMode === 'paper' ? 1.0 : 0);
    this.sqliteMemory = new SQLiteMemory();
    this.aiBrain = new AIBrain(this.sqliteMemory);
    this.profitVault = new ProfitVault(config, this.sqliteMemory, this.solanaService);
    this.strategyManager = new StrategyManager(config.activeStrategy);
    this.gasOptimizer = new GasOptimizer(this.solanaService.getConnection());
    this.researchEngine = new ResearchEngine();
    this.whaleTracker = new WhaleTracker();
    this.positionSizer = new PositionSizer(config);
    this.migrationPredictor = new MigrationPredictor();
    this.strategyCoordinator = new StrategyCoordinator(config.activeStrategy, true);
    this.telegramBot = new TelegramBot();
    this.clusterDetector = new ClusterDetector();
    this.stealthRugDetector = new StealthRugDetector();
    this.socialSentiment = new SocialSentimentAnalyzer();
    this.lossRecovery = new LossRecoveryManager();
    this.sandwichGuard = new SandwichGuard();
    this.reinvestmentEngine = new ReinvestmentEngine(config.solPerTrade, 0.05);
    this.backtester = new Backtester(this.sqliteMemory);
    this.webServer = new WebServer(this.journal, this.backtester);
    this.notificationService = new NotificationService();
    this.rugCheckService = new RugCheckService(this.solanaService);
    this.copyTrader = new CopyTrader();

    if (config.tradingMode === 'live') {
      this.liveTrader = new LiveTrader(config, this.pumpPortal, this.solanaService, this.journal, this.sqliteMemory, this.profitVault);
    } else {
      this.paperTrader = new PaperTrader(config, 1.0, this.journal, this.sqliteMemory, this.profitVault);
    }

    this.webServer.registerActionHandlers(
      this.panicSellAll.bind(this),
      this.sellSinglePosition.bind(this),
      this.changeStrategy.bind(this),
      this.updateConfig.bind(this)
    );

    this.telegramBot.registerHandlers({
      getStatus: async () => {
        const stats = this.config.tradingMode === 'live' ? await this.liveTrader!.getStats() : this.paperTrader!.getStats();
        const mode = this.config.tradingMode.toUpperCase();
        const strat = this.strategyCoordinator.getActiveStrategy();
        const pnlEmoji = stats.realizedPnlSol >= 0 ? '🟢' : '🔴';
        const pnlSign = stats.realizedPnlSol >= 0 ? '+' : '';

        return (
          `📊 <b>QUANTUM MATRIX TELEMETRY</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `⚡ <b>Mode:</b> <code>${mode}</code> | <b>Engine:</b> 🟢 <code>ACTIVE</code>\n` +
          `🎯 <b>Active Strategy:</b> <b>${strat}</b>\n` +
          `💰 <b>Bankroll:</b> <b>${stats.currentBalanceSol.toFixed(4)} SOL</b>\n` +
          `🔒 <b>Safe Vault:</b> <b>${this.profitVault.getTotalVaulted().toFixed(4)} SOL</b> (Cycle #${this.profitVault.getCycleCount()})\n` +
          `📈 <b>Realized PnL:</b> ${pnlEmoji} <b>${pnlSign}${stats.realizedPnlSol.toFixed(4)} SOL</b>\n` +
          `🏆 <b>Win Rate:</b> <b>${stats.winRate.toFixed(1)}%</b> (${stats.winningTrades}W / ${stats.losingTrades}L)\n` +
          `🔍 <b>Tokens Scanned:</b> ${this.processedTokensCount} | <b>Passed:</b> ${this.passedTokensCount}`
        );
      },
      getPositions: async () => {
        return this.config.tradingMode === 'live'
          ? (this.liveTrader?.getOpenPositions() || [])
          : (this.paperTrader?.getOpenPositions() || []);
      },
      panicSellAll: async () => {
        await this.panicSellAll();
      },
      sellSinglePosition: async (mint: string, ratio: number = 1.0) => {
        await this.sellSinglePosition(mint, ratio);
      },
      changeStrategy: (strategy: StrategyType) => {
        this.changeStrategy(strategy);
      },
      getVaultSummary: async () => {
        return {
          totalVaulted: this.profitVault.getTotalVaulted(),
          cycles: this.profitVault.getCycleCount()
        };
      },
      getConfig: () => {
        return this.config;
      },
      updateConfig: (newConfig: Partial<AgentConfig>) => {
        this.updateConfig(newConfig);
      },
      getRecentAiDecisions: async () => {
        return this.sqliteMemory.getRecentAIDecisions(5);
      },
      getKothPredictions: () => {
        return Array.from(this.latestPredictions.values());
      }
    });
  }

  public async start(): Promise<void> {
    this.isRunning = true;
    console.log(chalk.blue.bold('\n======================================================'));
    console.log(chalk.green.bold(` 🚀 PUMP.FUN TRADING AGENT (QUANTUM PRO v9.0 TITAN)`));
    console.log(chalk.blue.bold('======================================================\n'));

    await this.sqliteMemory.init();
    await this.profitVault.init();
    await this.webServer.start();

    if (this.config.tradingMode === 'live' && this.liveTrader) {
      await this.liveTrader.init();
      if (!this.solanaService.getKeypair()) {
        console.error(chalk.red.bold('❌ Cannot run in LIVE mode without a valid SOLANA_PRIVATE_KEY in .env!'));
        process.exit(1);
      }
      await this.liveTrader.restoreFromMemory();
    } else if (this.paperTrader) {
      await this.paperTrader.restoreFromMemory();
      console.log(chalk.magenta(`[Agent] Paper Trading Active (Trading Bankroll: ${this.paperTrader.getBalance().toFixed(4)} SOL | Vaulted: ${this.profitVault.getTotalVaulted().toFixed(4)} SOL)`));
    }

    console.log(chalk.yellow(`[Agent] Active Matrix Configuration:`));
    console.log(chalk.gray(`  • AI Model: ${this.config.aiProvider} (${this.config.aiModel})`));
    console.log(chalk.gray(`  • Multi-RPC Failover: Active (${this.rpcFailover.getActiveUrl()})`));
    console.log(chalk.gray(`  • Sandwich Guard: Active (Auto-Tolerancing MEV Risk)`));
    console.log(chalk.gray(`  • Stealth Drain Detector: Active`));
    console.log(chalk.gray(`  • Telegram Bot: ${process.env.TELEGRAM_BOT_TOKEN ? 'Active (Polling Commands)' : 'Disabled'}`));
    console.log(chalk.gray(`  • Profit Vault: Base ${this.config.baseBankrollSol} SOL | Milestone Lock: +${this.config.profitVaultThresholdSol} SOL\n`));

    this.pumpPortal.connect(
      this.handleNewToken.bind(this),
      this.handleTokenTrade.bind(this)
    );

    this.monitorInterval = setInterval(() => {
      this.evaluateActivePositions();
    }, 1000);

    this.dashboardInterval = setInterval(async () => {
      await this.syncAndRenderDashboard();
    }, 4000);
  }

  public changeStrategy(strategy: StrategyType): void {
    this.strategyCoordinator.setActiveStrategy(strategy);
    this.strategyManager.setActiveStrategy(strategy);
    this.config.activeStrategy = strategy;
    console.log(chalk.cyan.bold(`[Agent] Switched active strategy to: ${strategy}`));
    this.webServer.broadcastLog(`Switched active strategy to: ${strategy}`);
  }

  public updateConfig(newConfig: Partial<AgentConfig>): void {
    Object.assign(this.config, newConfig);
    console.log(chalk.cyan(`[Agent] Config updated live from Web UI`));
    this.webServer.broadcastLog(`Live config updated from dashboard`);
  }

  private async handleNewToken(token: TokenCreationEvent): Promise<void> {
    this.processedTokensCount++;
    this.strategyCoordinator.recordTokenLaunch();
    this.clusterDetector.registerLaunch(token.mint);
    this.devPubkeyMap.set(token.mint, token.traderPublicKey);
    this.tokenSymbolMap.set(token.mint, token.symbol);
    this.webServer.broadcastNewToken(token);

    const filterResult = this.filterEngine.evaluateToken(token);
    if (!filterResult.passed) return;

    const research = await this.researchEngine.conductResearch(token);
    const sentiment = this.socialSentiment.analyzeToken(token);

    const rugCheck = await this.rugCheckService.evaluateToken(token.mint, token.traderPublicKey);
    if (!rugCheck.isSafe) {
      console.log(chalk.yellow(`[RugCheck Rejected] ⚠️ ${token.symbol}: ${rugCheck.risks.join(', ')}`));
      this.webServer.broadcastLog(`RugCheck rejected ${token.symbol}: ${rugCheck.risks.join(', ')}`);
      return;
    }

    const aiDecision = await this.aiBrain.evaluateOpportunity(
      token,
      research,
      this.strategyCoordinator.getActiveStrategy(),
      0,
      rugCheck.score / 100
    );

    await this.sqliteMemory.recordAIDecision(
      token.mint,
      token.symbol,
      aiDecision.shouldBuy ? 'BUY' : 'SKIP',
      aiDecision.confidenceScore,
      aiDecision.reasoning,
      aiDecision.tags
    );

    if (!aiDecision.shouldBuy || aiDecision.confidenceScore < this.config.minAiConfidence) {
      return;
    }

    const stratDecision = this.strategyManager.evaluateNewToken(token, aiDecision.confidenceScore);
    if (!stratDecision.shouldBuy) return;

    // Dynamic Sizing with Sandwich Guard & Reinvestment Engine
    const currentBal = this.config.tradingMode === 'live' ? await this.solanaService.getBalance() : (this.paperTrader?.getBalance() || 1.0);
    const recoveryMultiplier = this.lossRecovery.getRecoveryMultiplier(aiDecision.confidenceScore);
    const devRepScore = Math.max(0, 100 - rugCheck.score);
    const baseDynamicSizeSol = this.positionSizer.calculateTradeSize(
      aiDecision.confidenceScore,
      this.journal.getAnalytics().winRate,
      devRepScore,
      currentBal
    );

    const stats = this.config.tradingMode === 'live' ? await this.liveTrader!.getStats() : this.paperTrader!.getStats();
    const compoundedSizeSol = this.reinvestmentEngine.calculateCompoundedTradeSize(stats.realizedPnlSol, currentBal);
    const finalSizeSol = Number((Math.max(baseDynamicSizeSol, compoundedSizeSol) * recoveryMultiplier).toFixed(4));

    const sandwich = this.sandwichGuard.evaluateSandwichRisk(finalSizeSol, token.vSolInBondingCurve || 30000000000);
    const effectiveSlippage = sandwich.isHighRisk ? sandwich.maxSafeSlippagePct : this.config.slippagePercent;

    if (this.config.tradingMode === 'live') {
      const optimalFee = await this.gasOptimizer.getOptimalPriorityFee();
      this.config.priorityFeeLamports = optimalFee;
    }

    this.passedTokensCount++;
    console.log(
      chalk.magenta(
        `\n[Research & AI Approved] 🔬 [${research.category}] ${token.symbol} (${token.name})\n` +
        `  • Dynamic Sizing: ${finalSizeSol.toFixed(4)} SOL (Kelly & Reinvestment Adjusted)\n` +
        `  • Virality Tier: ${sentiment.sentimentTier} (${sentiment.viralityScore}/100)\n` +
        `  • AI Confidence: ${aiDecision.confidenceScore}% (${aiDecision.convictionTier || 'STANDARD'})\n` +
        `  • AI Reasoning: "${aiDecision.reasoning}"\n` +
        `  • Mint: ${token.mint}`
      )
    );

    let position: Position | null = null;
    if (this.config.tradingMode === 'live' && this.liveTrader) {
      position = await this.liveTrader.executeBuy(
        token,
        aiDecision.tags,
        this.strategyCoordinator.getActiveStrategy(),
        aiDecision.confidenceScore,
        aiDecision.reasoning,
        finalSizeSol,
        effectiveSlippage
      );
    } else if (this.paperTrader) {
      position = this.paperTrader.simulateBuy(
        token,
        aiDecision.tags,
        this.strategyCoordinator.getActiveStrategy(),
        aiDecision.confidenceScore,
        aiDecision.reasoning,
        finalSizeSol,
        effectiveSlippage
      );
    }

    if (position) {
      position.category = research.category;
      position.researchScore = research.researchScore;
      this.webServer.broadcastLog(`[AI Brain] Bought [${research.category}] ${position.symbol} (${finalSizeSol.toFixed(3)} SOL, ${aiDecision.confidenceScore}% conf)`);
      await this.notificationService.notifyBuy(position, this.config.tradingMode);
      await this.telegramBot.notifyBuy(position, finalSizeSol);
      await this.syncAndRenderDashboard();
    }
  }

  private async handleTokenTrade(trade: TradeEvent): Promise<void> {
    const symbol = this.tokenSymbolMap.get(trade.mint) || 'UNKNOWN';

    const clusterReport = this.clusterDetector.trackEarlyTrade(trade);
    if (clusterReport && clusterReport.isBundled) {
      this.webServer.broadcastLog(`⚠️ Sybil Bundle Trap Rejected: ${trade.mint.substring(0,6)} (${clusterReport.warnings.join(', ')})`);
    }

    const stealthDrain = this.stealthRugDetector.trackTrade(trade);
    if (stealthDrain && stealthDrain.isDraining) {
      const position = this.config.tradingMode === 'live'
        ? this.liveTrader?.getPosition(trade.mint)
        : this.paperTrader?.getPosition(trade.mint);

      if (position && position.status === 'OPEN') {
        this.webServer.broadcastLog(`🚨 Stealth Drain Detected on ${position.symbol}! Executing defensive exit.`);
        const exitSignal: ExitSignal = {
          action: 'SELL',
          mint: position.mint,
          reason: 'CIRCUIT_BREAKER',
          sellRatio: 1.0,
          pnlPercent: position.pnlPercent,
          pnlSol: position.pnlSol
        };
        await this.executeExit(position, exitSignal);
      }
    }

    const whaleAlert = this.whaleTracker.evaluateTrade(trade, symbol);
    if (whaleAlert) {
      this.webServer.broadcastLog(`🐋 Whale Alert: ${whaleAlert.label} ${whaleAlert.action} ${whaleAlert.solAmount.toFixed(2)} SOL on ${whaleAlert.mint}`);
      this.telegramBot.notifyWhaleAlert(whaleAlert.label, whaleAlert.action, whaleAlert.solAmount, whaleAlert.mint);
    }

    if (trade.vSolInBondingCurve) {
      const pred = this.migrationPredictor.trackTick(trade.mint, symbol, trade.vSolInBondingCurve);
      this.latestPredictions.set(trade.mint, pred);
      if (pred.isImminent) {
        this.webServer.broadcastLog(`👑 KOTH Raydium Imminent: ${pred.symbol} (${pred.progressPercent}% - ~${pred.estimatedMinutesToGraduation || '?'} mins left)`);
      }
    }

    const isAlreadyOpen = this.config.tradingMode === 'live'
      ? this.liveTrader?.getPosition(trade.mint)?.status === 'OPEN'
      : this.paperTrader?.getPosition(trade.mint)?.status === 'OPEN';

    if (!isAlreadyOpen && this.copyTrader.shouldCopy(trade)) {
      this.webServer.broadcastLog(`Copy-trade triggered for alpha wallet on ${trade.mint}`);
      const mockToken: TokenCreationEvent = {
        signature: trade.signature,
        mint: trade.mint,
        traderPublicKey: trade.traderPublicKey,
        txType: 'create',
        initialBuy: this.config.solPerTrade,
        name: this.tokenSymbolMap.get(trade.mint) ? `${symbol} Token` : 'Alpha Target',
        symbol: symbol !== 'UNKNOWN' ? symbol : 'ALPHA',
        uri: '',
        timestamp: Date.now()
      };
      await this.handleNewToken(mockToken);
    }

    if (!isAlreadyOpen) {
      const stratDecision = this.strategyManager.evaluateTradeTick(trade);
      if (stratDecision.shouldBuy) {
        const mockToken: TokenCreationEvent = {
          signature: trade.signature,
          mint: trade.mint,
          traderPublicKey: trade.traderPublicKey,
          txType: 'create',
          initialBuy: this.config.solPerTrade,
          bondingCurveKey: trade.bondingCurveKey,
          vTokensInBondingCurve: trade.vTokensInBondingCurve,
          vSolInBondingCurve: trade.vSolInBondingCurve,
          marketCapSol: trade.marketCapSol,
          name: this.tokenSymbolMap.get(trade.mint) ? `${symbol} Token` : 'Breakout Token',
          symbol: symbol !== 'UNKNOWN' ? symbol : 'BREAKOUT',
          uri: '',
          timestamp: Date.now()
        };
        await this.handleNewToken(mockToken);
      }
    }

    const position = this.config.tradingMode === 'live'
      ? this.liveTrader?.getPosition(trade.mint)
      : this.paperTrader?.getPosition(trade.mint);

    if (!position || position.status !== 'OPEN') return;

    let newPriceSol = 0;
    if (trade.vSolInBondingCurve && trade.vTokensInBondingCurve && trade.vTokensInBondingCurve > 0) {
      newPriceSol = BondingCurveCalculator.calculateSpotPriceSol(trade.vSolInBondingCurve, trade.vTokensInBondingCurve);
      position.bondingCurveProgress = BondingCurveCalculator.calculateProgress(trade.vSolInBondingCurve);
    } else if (trade.solAmount && trade.tokenAmount && trade.tokenAmount > 0) {
      const sol = trade.solAmount > 1e6 ? trade.solAmount / 1e9 : trade.solAmount;
      const tokens = trade.tokenAmount > 1e6 ? trade.tokenAmount / 1e6 : trade.tokenAmount;
      newPriceSol = sol / tokens;
    }

    if (newPriceSol <= 0 || isNaN(newPriceSol) || !isFinite(newPriceSol)) return;

    const exitSignal = this.riskManager.updatePositionPrice(position, newPriceSol);
    if (exitSignal) {
      await this.executeExit(position, exitSignal);
    }
  }

  private async evaluateActivePositions(): Promise<void> {
    const positions = this.config.tradingMode === 'live'
      ? (this.liveTrader?.getOpenPositions() || [])
      : (this.paperTrader?.getOpenPositions() || []);

    for (const pos of positions) {
      const exitSignal = this.riskManager.updatePositionPrice(pos, pos.currentPriceSol);
      if (exitSignal) {
        await this.executeExit(pos, exitSignal);
      }
    }
  }

  private async executeExit(position: Position, exitSignal: ExitSignal): Promise<void> {
    const devPubkey = this.devPubkeyMap.get(position.mint);
    if (this.config.tradingMode === 'live' && this.liveTrader) {
      await this.liveTrader.executeSell(exitSignal, devPubkey);
    } else if (this.paperTrader) {
      await this.paperTrader.simulateSell(exitSignal, devPubkey);
    }

    const isWin = exitSignal.pnlSol >= 0;
    this.lossRecovery.recordOutcome(isWin);

    if (position.category) {
      this.researchEngine.recordSectorOutcome(position.category as TokenCategory, isWin, exitSignal.pnlSol);
    }

    this.clusterDetector.cleanup(position.mint);
    this.stealthRugDetector.cleanup(position.mint);

    this.webServer.broadcastLog(`Exited ${position.symbol} (${exitSignal.reason}) PnL: ${exitSignal.pnlPercent.toFixed(2)}%`);
    await this.notificationService.notifySell(position, exitSignal, this.config.tradingMode);
    await this.telegramBot.notifySell(position, exitSignal, this.config.tradingMode);
    await this.syncAndRenderDashboard();
  }

  public async panicSellAll(): Promise<void> {
    console.log(chalk.red.bold('\n[Agent] 🚨 EXECUTING PANIC SELL ALL ON ALL POSITIONS!'));
    const positions = this.config.tradingMode === 'live'
      ? (this.liveTrader?.getOpenPositions() || [])
      : (this.paperTrader?.getOpenPositions() || []);

    for (const pos of positions) {
      const emergencySignal: ExitSignal = {
        action: 'SELL',
        mint: pos.mint,
        reason: 'STOP_LOSS',
        sellRatio: 1.0,
        pnlPercent: pos.pnlPercent,
        pnlSol: pos.pnlSol
      };
      await this.executeExit(pos, emergencySignal);
    }
    this.webServer.broadcastLog('🚨 PANIC SELL ALL completed.');
  }

  public async sellSinglePosition(mint: string, ratio: number = 1.0): Promise<void> {
    const position = this.config.tradingMode === 'live'
      ? this.liveTrader?.getPosition(mint)
      : this.paperTrader?.getPosition(mint);

    if (position && position.status === 'OPEN') {
      const clampedRatio = Math.max(0.1, Math.min(1.0, ratio));
      const manualSignal: ExitSignal = {
        action: 'SELL',
        mint: position.mint,
        reason: clampedRatio >= 1.0 ? 'STOP_LOSS' : 'TAKE_PROFIT_1',
        sellRatio: clampedRatio,
        pnlPercent: position.pnlPercent,
        pnlSol: position.pnlSol
      };
      await this.executeExit(position, manualSignal);
    }
  }

  public async syncAndRenderDashboard(): Promise<void> {
    const stats = this.config.tradingMode === 'live'
      ? await this.liveTrader!.getStats()
      : this.paperTrader!.getStats();

    const openPositions: Position[] = this.config.tradingMode === 'live'
      ? (this.liveTrader?.getOpenPositions() || [])
      : (this.paperTrader?.getOpenPositions() || []);

    const analytics = this.journal.getAnalytics();
    const vaultCycles = await this.profitVault.getHistory();
    const sectorStats = this.researchEngine.getSectorSummary();
    const whaleAlerts = this.whaleTracker.getRecentAlerts();
    const predictions = Array.from(this.latestPredictions.values()).slice(-6);

    const regime = this.strategyCoordinator.evaluateRegime(
      stats.winRate,
      stats.realizedPnlSol,
      predictions.filter(p => p.isImminent).length
    );

    this.webServer.broadcastState({
      config: this.config,
      stats,
      analytics,
      positions: openPositions,
      journalEntries: this.journal.getEntries().slice(-15).reverse(),
      vaultCycles: vaultCycles,
      sectorStats: sectorStats,
      whaleAlerts: whaleAlerts,
      predictions: predictions,
      marketRegime: regime,
      totalVaultedSol: this.profitVault.getTotalVaulted(),
      vaultCycleCount: this.profitVault.getCycleCount(),
      scannedCount: this.processedTokensCount,
      passedCount: this.passedTokensCount,
      activeStrategy: this.strategyCoordinator.getActiveStrategy()
    });

    const pnlColor = stats.realizedPnlSol >= 0 ? chalk.green : chalk.red;

    console.log(chalk.gray('\n---------------- [QUANTUM MATRIX v9.0 DASHBOARD] ----------------'));
    console.log(
      `Mode: ${chalk.bold.yellow(this.config.tradingMode.toUpperCase())} | ` +
      `Strategy: ${chalk.bold.cyan(this.strategyCoordinator.getActiveStrategy())} | ` +
      `Bankroll: ${chalk.bold(stats.currentBalanceSol.toFixed(4))} SOL | ` +
      `Vault: ${chalk.bold.yellow('🔒 ' + this.profitVault.getTotalVaulted().toFixed(4) + ' SOL (Cycle #' + this.profitVault.getCycleCount() + ')')} | ` +
      `Realized PnL: ${pnlColor((stats.realizedPnlSol >= 0 ? '+' : '') + stats.realizedPnlSol.toFixed(4) + ' SOL')}`
    );

    if (openPositions.length > 0) {
      const table = new Table({
        head: ['Token', 'Sector', 'AI Conf', 'Invested', 'Entry', 'Current', 'PnL %', 'PnL (SOL)'],
        style: { head: ['cyan'] }
      });

      for (const pos of openPositions) {
        const itemPnlColor = pos.pnlPercent >= 0 ? chalk.green : chalk.red;
        table.push([
          pos.symbol,
          pos.category || 'TECH_AI',
          pos.aiConfidence ? `${pos.aiConfidence}%` : 'N/A',
          `${pos.investedSol.toFixed(4)} SOL`,
          pos.entryPriceSol.toExponential(2),
          pos.currentPriceSol.toExponential(2),
          itemPnlColor(`${pos.pnlPercent >= 0 ? '+' : ''}${pos.pnlPercent.toFixed(2)}%`),
          itemPnlColor(`${pos.pnlSol >= 0 ? '+' : ''}${pos.pnlSol.toFixed(4)}`)
        ]);
      }
      console.log(table.toString());
    } else {
      console.log(chalk.gray('  (Quantum Matrix monitoring Bonding Curves, Telegram Bot & Sandwich Guard...)'));
    }
    console.log(chalk.gray('-------------------------------------------------------------------\n'));
  }

  public stop(): void {
    this.isRunning = false;
    if (this.monitorInterval) clearInterval(this.monitorInterval);
    if (this.dashboardInterval) clearInterval(this.dashboardInterval);
    this.telegramBot.stop();
    this.rpcFailover.stop();
    this.pumpPortal.disconnect();
    this.webServer.stop();
    console.log(chalk.yellow('[Agent] Stopped cleanly. All positions and memory persisted in SQLite.'));
  }
}
