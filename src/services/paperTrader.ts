import chalk from 'chalk';
import { AgentConfig, Position, TokenCreationEvent } from '../types';
import { ExitSignal } from './riskManager';
import { TradeJournal } from './db';
import { SQLiteMemory } from './sqliteMemory';
import { ProfitVault } from './profitVault';

export class PaperTrader {
  private config: AgentConfig;
  private virtualSolBalance: number;
  private initialSolBalance: number;
  private positions: Map<string, Position> = new Map();
  private journal?: TradeJournal;
  private sqlite?: SQLiteMemory;
  private profitVault?: ProfitVault;

  constructor(
    config: AgentConfig,
    startingBalanceSol: number = 1.0,
    journal?: TradeJournal,
    sqlite?: SQLiteMemory,
    profitVault?: ProfitVault
  ) {
    this.config = config;
    this.virtualSolBalance = Math.max(0, startingBalanceSol);
    this.initialSolBalance = Math.max(0, startingBalanceSol);
    this.journal = journal;
    this.sqlite = sqlite;
    this.profitVault = profitVault;
  }

  public async restoreFromMemory(): Promise<void> {
    if (this.sqlite) {
      const savedBalance = await this.sqlite.loadState<number>('paper_virtual_balance', this.virtualSolBalance);
      this.virtualSolBalance = Number(savedBalance) || this.virtualSolBalance;

      const savedPositions = await this.sqlite.loadActivePositions();
      for (const pos of savedPositions) {
        this.positions.set(pos.mint, pos);
      }
      if (savedPositions.length > 0) {
        console.log(chalk.green.bold(`[PaperTrader] 🔄 Crash Recovery: Successfully restored ${savedPositions.length} active position(s) from SQLite!`));
      }
    }
  }

  public getBalance(): number {
    return this.virtualSolBalance;
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

  public canOpenPosition(): boolean {
    const openCount = this.getOpenPositions().length;
    return openCount < this.config.maxActivePositions && this.virtualSolBalance >= this.config.solPerTrade;
  }

  public simulateBuy(
    token: TokenCreationEvent,
    tags: string[] = [],
    strategyName: string = 'SNIPER',
    aiConfidence?: number,
    aiReasoning?: string
  ): Position | null {
    if (!this.canOpenPosition()) return null;

    const solAmount = Math.max(0.001, this.config.solPerTrade);
    let estimatedPriceSol = 0.00000003;
    if (token.vSolInBondingCurve && token.vTokensInBondingCurve && token.vTokensInBondingCurve > 0) {
      estimatedPriceSol = (token.vSolInBondingCurve / 1e9) / (token.vTokensInBondingCurve / 1e6);
    }

    const slippageMultiplier = 1 + (Math.max(0, this.config.slippagePercent) / 100);
    const fillPriceSol = Math.max(0.00000001, estimatedPriceSol * slippageMultiplier);
    const tokenAmount = solAmount / fillPriceSol;

    this.virtualSolBalance = Math.max(0, this.virtualSolBalance - solAmount);

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
      investedSol: solAmount,
      highestPriceSol: fillPriceSol,
      buyTimestamp: Date.now(),
      pnlPercent: 0,
      pnlSol: 0,
      tp1Triggered: false,
      tp2Triggered: false,
      status: 'OPEN',
      aiConfidence: aiConfidence,
      aiReasoning: aiReasoning
    };

    this.positions.set(token.mint, position);

    if (this.sqlite) {
      this.sqlite.saveActivePosition(position);
      this.sqlite.saveState('paper_virtual_balance', this.virtualSolBalance);
    }

    console.log(
      chalk.green.bold(
        `\n[PAPER TRADING] 🟢 BOUGHT ${token.symbol} (${token.name}) [${strategyName}]\n` +
        `  • Mint: ${token.mint}\n` +
        `  • Invested: ${solAmount.toFixed(4)} SOL\n` +
        `  • Entry Price: ${fillPriceSol.toExponential(4)} SOL\n` +
        `  • AI Confidence: ${aiConfidence ? `${aiConfidence}%` : 'N/A'}\n` +
        `  • Remaining Paper Balance: ${this.virtualSolBalance.toFixed(4)} SOL`
      )
    );

    return position;
  }

  public async simulateSell(signal: ExitSignal, devPubkey?: string): Promise<void> {
    const position = this.positions.get(signal.mint);
    if (!position || position.status !== 'OPEN') return;

    const clampedRatio = Math.max(0.01, Math.min(1.0, signal.sellRatio));
    const tokensToSell = position.tokenAmount * clampedRatio;
    const slippageMultiplier = Math.max(0.1, 1 - (Math.max(0, this.config.slippagePercent) / 100));
    const fillPriceSol = Math.max(0.00000001, position.currentPriceSol * slippageMultiplier);
    const solReturned = tokensToSell * fillPriceSol;

    const portionInvested = position.investedSol * clampedRatio;
    const realizedPnlSol = solReturned - portionInvested;
    const realizedPnlPercent = position.entryPriceSol > 0 ? ((fillPriceSol - position.entryPriceSol) / position.entryPriceSol) * 100 : 0;

    this.virtualSolBalance += solReturned;
    position.tokenAmount = Math.max(0, position.tokenAmount - tokensToSell);
    position.investedSol = Math.max(0, position.investedSol - portionInvested);

    if (clampedRatio >= 1.0 || position.tokenAmount <= 0) {
      position.status = 'CLOSED';
      position.closeReason = signal.reason;
      if (this.sqlite) {
        await this.sqlite.removeActivePosition(position.mint);
      }
    } else {
      if (this.sqlite) {
        await this.sqlite.saveActivePosition(position);
      }
    }

    const isWin = realizedPnlSol >= 0;
    const pnlColor = isWin ? chalk.green.bold : chalk.red.bold;
    const prefix = isWin ? '🟢 PROFIT' : '🔴 LOSS';

    console.log(
      pnlColor(
        `\n[PAPER TRADING] ${prefix} EXITED ${position.symbol} (${signal.reason})\n` +
        `  • Sold: ${(clampedRatio * 100).toFixed(0)}%\n` +
        `  • Exit Price: ${fillPriceSol.toExponential(4)} SOL\n` +
        `  • Returned: ${solReturned.toFixed(4)} SOL\n` +
        `  • Realized PnL: ${realizedPnlPercent >= 0 ? '+' : ''}${realizedPnlPercent.toFixed(2)}% (${realizedPnlSol >= 0 ? '+' : ''}${realizedPnlSol.toFixed(4)} SOL)\n` +
        `  • New Balance: ${this.virtualSolBalance.toFixed(4)} SOL`
      )
    );

    if (this.profitVault) {
      const vaultRes = await this.profitVault.checkAndVaultProfits(this.virtualSolBalance);
      if (vaultRes.triggered) {
        this.virtualSolBalance = vaultRes.newTradingBalanceSol;
      }
    }

    const tradeId = `${position.mint.substring(0, 6)}_${Date.now()}`;
    const holdSecs = Math.max(0, Math.floor((Date.now() - position.buyTimestamp) / 1000));

    if (this.sqlite) {
      await this.sqlite.saveState('paper_virtual_balance', this.virtualSolBalance);
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
        pnlSol: realizedPnlSol,
        pnlPercent: realizedPnlPercent,
        reason: signal.reason,
        aiConfidence: position.aiConfidence,
        aiReasoning: position.aiReasoning,
        holdSeconds: holdSecs,
        timestamp: Date.now()
      });

      if (devPubkey) {
        const isRug = signal.reason === 'STOP_LOSS' && realizedPnlPercent <= -15;
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
        pnlSol: realizedPnlSol,
        pnlPercent: realizedPnlPercent,
        reason: signal.reason,
        entryTimestamp: position.buyTimestamp,
        exitTimestamp: Date.now(),
        holdDurationSeconds: holdSecs
      });
    }
  }

  public getStats() {
    const totalVaulted = this.profitVault ? this.profitVault.getTotalVaulted() : 0;
    const vaultCycles = this.profitVault ? this.profitVault.getCycleCount() : 0;

    if (this.journal) {
      const a = this.journal.getAnalytics();
      return {
        startingBalanceSol: this.initialSolBalance,
        currentBalanceSol: this.virtualSolBalance,
        vaultedBalanceSol: totalVaulted,
        vaultCyclesCompleted: vaultCycles,
        totalTrades: a.totalTrades,
        winningTrades: a.winningTrades,
        losingTrades: a.losingTrades,
        realizedPnlSol: a.netRealizedPnlSol,
        totalVolumeSol: a.totalTrades * this.config.solPerTrade,
        winRate: a.winRate,
        profitFactor: a.profitFactor,
        expectancySol: a.expectancySol,
        equityCurve: a.equityCurve
      };
    }

    return {
      startingBalanceSol: this.initialSolBalance,
      currentBalanceSol: this.virtualSolBalance,
      vaultedBalanceSol: totalVaulted,
      vaultCyclesCompleted: vaultCycles,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      realizedPnlSol: 0,
      totalVolumeSol: 0,
      winRate: 0,
      profitFactor: 0,
      expectancySol: 0,
      equityCurve: []
    };
  }
}
