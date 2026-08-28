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
  equityCurve: { timestamp: number; pnl: number; balance: number }[];
}

export class TradeJournal {
  private filePath: string = path.join(__dirname, '../../data/journal.json');
  private entries: JournalEntry[] = [];
  private initialBalance: number = 1.0;

  constructor(initialBalance: number = 1.0) {
    this.initialBalance = initialBalance;
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
    const equityCurve: { timestamp: number; pnl: number; balance: number }[] = [
      { timestamp: Date.now() - 3600000, pnl: 0, balance: this.initialBalance }
    ];

    for (const trade of this.entries) {
      cumulativePnl += trade.pnlSol;
      equityCurve.push({
        timestamp: trade.exitTimestamp,
        pnl: cumulativePnl,
        balance: this.initialBalance + cumulativePnl
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
    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
    const avgWin = wins > 0 ? grossProfit / wins : 0;
    const avgLoss = losses > 0 ? grossLoss / losses : 0;
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;
    const winLossRatio = avgLoss > 0 ? avgWin / avgLoss : 0;
    const expectancy = totalTrades > 0 ? cumulativePnl / totalTrades : 0;

    return {
      totalTrades,
      winningTrades: wins,
      losingTrades: losses,
      winRate,
      grossProfitSol: grossProfit,
      grossLossSol: grossLoss,
      profitFactor,
      netRealizedPnlSol: cumulativePnl,
      avgWinSol: avgWin,
      avgLossSol: avgLoss,
      winLossRatio,
      expectancySol: expectancy,
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
