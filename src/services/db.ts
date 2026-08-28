import fs from 'fs';
import path from 'path';

export interface JournalEntry {
  id: string;
  mint: string;
  symbol: string;
  name: string;
  strategy: string;
  tags: string[];
  entryPriceSol: number;
  exitPriceSol: number;
  investedSol: number;
  returnedSol: number;
  pnlSol: number;
  pnlPercent: number;
  reason: string;
  entryTimestamp: number;
  exitTimestamp: number;
  holdDurationSeconds: number;
  txSignature?: string;
}

export interface PortfolioAnalytics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  grossProfitSol: number;
  grossLossSol: number;
  profitFactor: number;
  netRealizedPnlSol: number;
  avgWinSol: number;
  avgLossSol: number;
  winLossRatio: number;
  expectancySol: number;
  maxDrawdownPercent: number;
  equityCurve: { timestamp: number; pnl: number; balance: number }[];
}

export class TradeJournal {
  private filePath: string = path.join(__dirname, '../../data/journal.json');
  private entries: JournalEntry[] = [];
  private initialBalance: number = 1.0;

  constructor(initialBalance: number = 1.0) {
    this.initialBalance = Math.max(0.001, initialBalance);
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        this.entries = JSON.parse(raw);
      }
    } catch {
      this.entries = [];
    }
  }

  private save(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.entries, null, 2), 'utf-8');
    } catch {
      // Ignore write errors in simulation
    }
  }

  public recordTrade(entry: JournalEntry): void {
    this.entries.push(entry);
    this.save();
  }

  public getEntries(): JournalEntry[] {
    return this.entries;
  }

  public getAnalytics(): PortfolioAnalytics {
    let grossProfit = 0;
    let grossLoss = 0;
    let wins = 0;
    let losses = 0;

    let cumulativePnl = 0;
    let peakBalance = this.initialBalance;
    let maxDrawdownPct = 0;

    const equityCurve: { timestamp: number; pnl: number; balance: number }[] = [
      { timestamp: Date.now() - 3600000, pnl: 0, balance: this.initialBalance }
    ];

    for (const trade of this.entries) {
      cumulativePnl += trade.pnlSol;
      const currentBal = this.initialBalance + cumulativePnl;
      if (currentBal > peakBalance) peakBalance = currentBal;

      const drawdown = peakBalance > 0 ? ((peakBalance - currentBal) / peakBalance) * 100 : 0;
      if (drawdown > maxDrawdownPct) maxDrawdownPct = drawdown;

      equityCurve.push({
        timestamp: trade.exitTimestamp,
        pnl: Number(cumulativePnl.toFixed(4)),
        balance: Number(currentBal.toFixed(4))
      });

      if (trade.pnlSol > 0) {
        grossProfit += trade.pnlSol;
        wins++;
      } else {
        grossLoss += Math.abs(trade.pnlSol);
        losses++;
      }
    }

    const totalTrades = this.entries.length;
    const winRate = totalTrades > 0 ? Number(((wins / totalTrades) * 100).toFixed(1)) : 0;
    const avgWin = wins > 0 ? Number((grossProfit / wins).toFixed(4)) : 0;
    const avgLoss = losses > 0 ? Number((grossLoss / losses).toFixed(4)) : 0;
    const profitFactor = grossLoss > 0 ? Number((grossProfit / grossLoss).toFixed(2)) : grossProfit > 0 ? 999 : 0;
    const winLossRatio = avgLoss > 0 ? Number((avgWin / avgLoss).toFixed(2)) : 0;
    const expectancy = totalTrades > 0 ? Number((cumulativePnl / totalTrades).toFixed(4)) : 0;

    return {
      totalTrades,
      winningTrades: wins,
      losingTrades: losses,
      winRate,
      grossProfitSol: Number(grossProfit.toFixed(4)),
      grossLossSol: Number(grossLoss.toFixed(4)),
      profitFactor,
      netRealizedPnlSol: Number(cumulativePnl.toFixed(4)),
      avgWinSol: avgWin,
      avgLossSol: avgLoss,
      winLossRatio,
      expectancySol: expectancy,
      maxDrawdownPercent: Number(maxDrawdownPct.toFixed(1)),
      equityCurve
    };
  }

  public exportCsv(): string {
    const headers = [
      'ID', 'Symbol', 'Name', 'Mint', 'Strategy', 'Invested SOL',
      'Returned SOL', 'PnL SOL', 'PnL %', 'Reason', 'Duration (s)', 'Exit Time'
    ];
    const rows = this.entries.map(e => [
      e.id,
      `"${e.symbol}"`,
      `"${e.name}"`,
      e.mint,
      e.strategy,
      e.investedSol.toFixed(4),
      e.returnedSol.toFixed(4),
      e.pnlSol.toFixed(4),
      e.pnlPercent.toFixed(2),
      e.reason,
      e.holdDurationSeconds,
      new Date(e.exitTimestamp).toISOString()
    ]);
    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }
}
