import { SQLiteMemory, DBTrade } from './sqliteMemory';

export interface BacktestResult {
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  netPnlSol: number;
  sharpeRatio: number;
  maxDrawdownPercent: number;
  optimalTp1Percent: number;
  optimalStopLossPercent: number;
  equityCurve: Array<{ tradeIndex: number; balance: number }>;
}

export class Backtester {
  private memory: SQLiteMemory;

  constructor(memory: SQLiteMemory) {
    this.memory = memory;
  }

  public async runBacktest(
    initialBalanceSol: number = 1.0,
    tradeSizeSol: number = 0.01,
    tp1Percent: number = 50,
    stopLossPercent: number = -20
  ): Promise<BacktestResult> {
    const safeInitial = Math.max(0.001, initialBalanceSol);
    const safeTradeSize = Math.max(0.0005, tradeSizeSol);

    const trades: DBTrade[] = await this.memory.getAllTrades();
    if (!trades || trades.length === 0) {
      return {
        totalTrades: 0,
        winRate: 0,
        profitFactor: 0,
        netPnlSol: 0,
        sharpeRatio: 0,
        maxDrawdownPercent: 0,
        optimalTp1Percent: tp1Percent,
        optimalStopLossPercent: stopLossPercent,
        equityCurve: [{ tradeIndex: 0, balance: safeInitial }]
      };
    }

    let balance = safeInitial;
    let peakBalance = safeInitial;
    let maxDrawdown = 0;
    let grossProfit = 0;
    let grossLoss = 0;
    let wins = 0;
    const equityCurve: Array<{ tradeIndex: number; balance: number }> = [{ tradeIndex: 0, balance }];
    const returns: number[] = [];

    const safeStopLoss = stopLossPercent > 0 ? -stopLossPercent : stopLossPercent;
    const safeTp1 = Math.max(1, tp1Percent);

    trades.forEach((t: DBTrade, i: number) => {
      // Simulate trade with parameter sensitivity
      let simulatedPnlPct = t.pnlPercent;
      if (t.pnlPercent >= safeTp1) {
        simulatedPnlPct = safeTp1;
      } else if (t.pnlPercent <= safeStopLoss) {
        simulatedPnlPct = safeStopLoss;
      }

      const normalizedPnlSol = (simulatedPnlPct / 100) * safeTradeSize;
      balance = Math.max(0, balance + normalizedPnlSol);
      returns.push(normalizedPnlSol);

      if (normalizedPnlSol > 0) {
        wins++;
        grossProfit += normalizedPnlSol;
      } else {
        grossLoss += Math.abs(normalizedPnlSol);
      }

      if (balance > peakBalance) peakBalance = balance;
      const dd = peakBalance > 0 ? ((peakBalance - balance) / peakBalance) * 100 : 0;
      if (dd > maxDrawdown) maxDrawdown = dd;

      equityCurve.push({ tradeIndex: i + 1, balance: Number(balance.toFixed(4)) });
    });

    const winRate = trades.length > 0 ? (wins / trades.length) * 100 : 0;
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 10 : 0;
    const netPnlSol = balance - safeInitial;

    const avgReturn = returns.reduce((a, b) => a + b, 0) / (returns.length || 1);
    const variance = returns.reduce((a, b) => a + Math.pow(b - avgReturn, 2), 0) / (returns.length || 1);
    const stdDev = Math.sqrt(variance);
    const sharpeRatio = stdDev > 0 ? Number(((avgReturn / stdDev) * Math.sqrt(365)).toFixed(2)) : 0;

    return {
      totalTrades: trades.length,
      winRate: Number(winRate.toFixed(1)),
      profitFactor: Number(profitFactor.toFixed(2)),
      netPnlSol: Number(netPnlSol.toFixed(4)),
      sharpeRatio,
      maxDrawdownPercent: Number(maxDrawdown.toFixed(1)),
      optimalTp1Percent: tp1Percent,
      optimalStopLossPercent: stopLossPercent,
      equityCurve
    };
  }
}
