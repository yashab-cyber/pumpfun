import chalk from 'chalk';
import { AgentConfig, Position, TokenCreationEvent } from '../types';
import { PumpPortalService } from './pumpPortal';
import { SolanaService } from './solana';
import { ExitSignal } from './riskManager';
import { TradeJournal } from './db';
import { SQLiteMemory } from './sqliteMemory';
import { ProfitVault } from './profitVault';

export class LiveTrader {
  private config: AgentConfig;
  private pumpPortal: PumpPortalService;
  private solanaService: SolanaService;
  private positions: Map<string, Position> = new Map();
  private isExecutingTrade: boolean = false;
  private startingBalanceSol: number = 0;
  private journal?: TradeJournal;
  private sqlite?: SQLiteMemory;
  private profitVault?: ProfitVault;

  constructor(
    config: AgentConfig,
    pumpPortal: PumpPortalService,
    solanaService: SolanaService,
    journal?: TradeJournal,
    sqlite?: SQLiteMemory,
    profitVault?: ProfitVault
  ) {
    this.config = config;
    this.pumpPortal = pumpPortal;
    this.solanaService = solanaService;
    this.journal = journal;
    this.sqlite = sqlite;
    this.profitVault = profitVault;
  }

  public async init(): Promise<void> {
    this.startingBalanceSol = await this.solanaService.getBalance();
    console.log(chalk.cyan(`[LiveTrader] Initialized. Live wallet balance: ${this.startingBalanceSol.toFixed(4)} SOL`));
  }

  public async restoreFromMemory(): Promise<void> {
    if (this.sqlite) {
      const savedPositions = await this.sqlite.loadActivePositions();
      for (const pos of savedPositions) {
        this.positions.set(pos.mint, pos);
        this.pumpPortal.subscribeTokenTrades([pos.mint]);
      }
      if (savedPositions.length > 0) {
        console.log(chalk.green.bold(`[LiveTrader] 🔄 Crash Recovery: Successfully restored ${savedPositions.length} active live position(s) from SQLite memory!`));
      }
    }
  }

  public getPositions(): Position[] {
    return Array.from(this.positions.values());
  }

  public getOpenPositions(): Position[] {
    return Array.from(this.positions.values()).filter(p => p.status === 'OPEN');
  }

  public getPosition(mint: string): Position | undefined {
    return this.positions.get(mint);
  }

  public async canOpenPosition(): Promise<boolean> {
    const openCount = this.getOpenPositions().length;
    if (openCount >= this.config.maxActivePositions) {
      return false;
    }
    const currentBalance = await this.solanaService.getBalance();
    const minRequired = this.config.solPerTrade + (this.config.priorityFeeLamports / 1e9) + 0.005; // 0.005 SOL cushion for gas & rent
    return currentBalance >= minRequired;
  }

  public async executeBuy(
    token: TokenCreationEvent,
    tags: string[] = [],
    strategyName: string = 'SNIPER',
    aiConfidence?: number,
    aiReasoning?: string
  ): Promise<Position | null> {
    if (this.isExecutingTrade) return null;
    const canBuy = await this.canOpenPosition();
    if (!canBuy) return null;

    this.isExecutingTrade = true;
    try {
      console.log(chalk.yellow(`[LiveTrader] Sending on-chain BUY for ${token.symbol} (${token.mint}) [${strategyName}]...`));
      const res = await this.pumpPortal.executeLiveTrade({
        action: 'buy',
        mint: token.mint,
        amount: this.config.solPerTrade,
        denominatedInSol: true,
        slippagePercent: this.config.slippagePercent,
        priorityFeeSol: this.config.priorityFeeLamports / 1e9
      });

      if (!res.success || !res.signature) {
        console.error(chalk.red(`[LiveTrader] Buy failed: ${res.error}`));
        return null;
      }

      let estimatedPriceSol = 0.00000003;
      if (token.vSolInBondingCurve && token.vTokensInBondingCurve && token.vTokensInBondingCurve > 0) {
        estimatedPriceSol = (token.vSolInBondingCurve / 1e9) / (token.vTokensInBondingCurve / 1e6);
      }
      const fillPriceSol = estimatedPriceSol * (1 + (this.config.slippagePercent / 100));
      const tokenAmount = this.config.solPerTrade / fillPriceSol;

      const position: Position = {
        mint: token.mint,
        symbol: token.symbol,
        name: token.name,
        strategy: strategyName,
        tags: tags,
        entryPriceSol: fillPriceSol,
        currentPriceSol: fillPriceSol,
        tokenAmount: tokenAmount,
        originalTokenAmount: tokenAmount,
        investedSol: this.config.solPerTrade,
        highestPriceSol: fillPriceSol,
        buyTimestamp: Date.now(),
        pnlPercent: 0,
        pnlSol: 0,
        tp1Triggered: false,
        tp2Triggered: false,
        status: 'OPEN',
        txSignature: res.signature,
        aiConfidence: aiConfidence,
        aiReasoning: aiReasoning
      };

      this.positions.set(token.mint, position);
      this.pumpPortal.subscribeTokenTrades([token.mint]);

      // Persist in SQLite
      if (this.sqlite) {
        await this.sqlite.saveActivePosition(position);
      }

      console.log(
        chalk.green.bold(
          `\n[LIVE TRADING] 🟢 BOUGHT ${token.symbol}!\n` +
          `  • Mint: ${token.mint}\n` +
          `  • Invested: ${this.config.solPerTrade.toFixed(4)} SOL\n` +
          `  • AI Confidence: ${aiConfidence ? `${aiConfidence}%` : 'N/A'}\n` +
          `  • Tx Signature: https://solscan.io/tx/${res.signature}`
        )
      );

      return position;
    } catch (err: any) {
      console.error(chalk.red(`[LiveTrader] Exception in executeBuy: ${err.message}`));
      return null;
    } finally {
      this.isExecutingTrade = false;
    }
  }

  public async executeSell(signal: ExitSignal, devPubkey?: string): Promise<void> {
    const position = this.positions.get(signal.mint);
    if (!position || position.status !== 'OPEN') return;

    position.status = 'CLOSING';
    try {
      console.log(chalk.yellow(`[LiveTrader] Sending on-chain SELL for ${position.symbol} (${signal.reason})...`));

      const res = await this.pumpPortal.executeLiveTrade({
        action: 'sell',
        mint: position.mint,
        amount: signal.sellRatio >= 1.0 ? 100 : Math.floor(signal.sellRatio * 100),
        denominatedInSol: false,
        slippagePercent: this.config.slippagePercent,
        priorityFeeSol: this.config.priorityFeeLamports / 1e9
      });

      if (!res.success || !res.signature) {
        console.error(chalk.red(`[LiveTrader] Sell failed: ${res.error}`));
        position.status = 'OPEN';
        return;
      }

      const clampedRatio = Math.max(0.01, Math.min(1.0, signal.sellRatio));
      const portionInvested = position.investedSol * clampedRatio;
      const fillPriceSol = position.currentPriceSol * (1 - (this.config.slippagePercent / 100));
      const tokensToSell = position.tokenAmount * clampedRatio;
      const solReturned = tokensToSell * fillPriceSol;

      if (clampedRatio >= 1.0) {
        position.status = 'CLOSED';
        position.closeReason = signal.reason;
        this.pumpPortal.unsubscribeTokenTrades([position.mint]);
        if (this.sqlite) {
          await this.sqlite.removeActivePosition(position.mint);
        }
      } else {
        position.status = 'OPEN';
        position.tokenAmount *= (1 - clampedRatio);
        position.investedSol *= (1 - clampedRatio);
        if (this.sqlite) {
          await this.sqlite.saveActivePosition(position);
        }
      }

      console.log(
        chalk.green.bold(
          `\n[LIVE TRADING] 🔴 EXITED ${position.symbol} (${signal.reason})!\n` +
          `  • Tx Signature: https://solscan.io/tx/${res.signature}\n` +
          `  • Reason: ${signal.reason}\n` +
          `  • Est. PnL: ${signal.pnlPercent.toFixed(2)}% (${signal.pnlSol.toFixed(4)} SOL)`
        )
      );

      // Auto-Vault Check on Live Wallet
      if (this.profitVault) {
        const liveBal = await this.solanaService.getBalance();
        await this.profitVault.checkAndVaultProfits(liveBal);
      }

      const tradeId = `${position.mint.substring(0, 6)}_${Date.now()}`;
      const holdSecs = Math.floor((Date.now() - position.buyTimestamp) / 1000);
      const isWin = signal.pnlSol >= 0;

      // Record in SQLite Memory & Journal
      if (this.sqlite) {
        await this.sqlite.recordTrade({
          id: tradeId,
          mint: position.mint,
          symbol: position.symbol,
          name: position.name,
          strategy: position.strategy || 'SNIPER',
          entryPriceSol: position.entryPriceSol,
          exitPriceSol: fillPriceSol,
          investedSol: portionInvested,
          returnedSol: solReturned,
          pnlSol: signal.pnlSol,
          pnlPercent: signal.pnlPercent,
          reason: signal.reason,
          aiConfidence: position.aiConfidence,
          aiReasoning: position.aiReasoning,
          holdSeconds: holdSecs,
          timestamp: Date.now()
        });

        if (devPubkey) {
          const isRug = signal.reason === 'STOP_LOSS' && signal.pnlPercent <= -15;
          await this.sqlite.updateDevReputation(devPubkey, isWin, isRug);
        }
      }

      if (this.journal) {
        this.journal.recordTrade({
          id: tradeId,
          mint: position.mint,
          symbol: position.symbol,
          name: position.name,
          strategy: position.strategy || 'SNIPER',
          tags: position.tags || [],
          entryPriceSol: position.entryPriceSol,
          exitPriceSol: fillPriceSol,
          investedSol: portionInvested,
          returnedSol: solReturned,
          pnlSol: signal.pnlSol,
          pnlPercent: signal.pnlPercent,
          reason: signal.reason,
          entryTimestamp: position.buyTimestamp,
          exitTimestamp: Date.now(),
          holdDurationSeconds: holdSecs,
          txSignature: res.signature
        });
      }
    } catch (err: any) {
      console.error(chalk.red(`[LiveTrader] Exception in executeSell: ${err.message}`));
      position.status = 'OPEN';
    }
  }

  public async getStats() {
    const currentBalance = await this.solanaService.getBalance();
    const totalVaulted = this.profitVault ? this.profitVault.getTotalVaulted() : 0;
    const vaultCycles = this.profitVault ? this.profitVault.getCycleCount() : 0;

    if (this.journal) {
      const a = this.journal.getAnalytics();
      return {
        startingBalanceSol: this.startingBalanceSol,
        currentBalanceSol: currentBalance,
        vaultedBalanceSol: totalVaulted,
        vaultCyclesCompleted: vaultCycles,
        totalTrades: a.totalTrades,
        winningTrades: a.winningTrades,
        losingTrades: a.losingTrades,
        realizedPnlSol: currentBalance - this.startingBalanceSol,
        totalVolumeSol: a.totalTrades * this.config.solPerTrade,
        winRate: a.winRate,
        profitFactor: a.profitFactor,
        expectancySol: a.expectancySol,
        equityCurve: a.equityCurve
      };
    }

    return {
      startingBalanceSol: this.startingBalanceSol,
      currentBalanceSol: currentBalance,
      vaultedBalanceSol: totalVaulted,
      vaultCyclesCompleted: vaultCycles,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      realizedPnlSol: currentBalance - this.startingBalanceSol,
      totalVolumeSol: 0,
      winRate: 0,
      profitFactor: 0,
      expectancySol: 0,
      equityCurve: []
    };
  }
}
