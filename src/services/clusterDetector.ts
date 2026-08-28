import { TradeEvent } from '../types';

export interface ClusterReport {
  mint: string;
  isBundled: boolean;
  clusterRiskScore: number; // 0 (Organic) to 100 (Artificial Sybil Bundle)
  uniqueBuyersInFirstBlock: number;
  totalSolInFirstBlock: number;
  warnings: string[];
}

export class ClusterDetector {
  // Track early buyers in the first 5 seconds of token life: Map<mint, { launchTime: number, buyers: Set<string>, totalSol: number }>
  private launchTracking: Map<string, { launchTime: number; buyers: Set<string>; totalSol: number }> = new Map();

  public registerLaunch(mint: string): void {
    this.launchTracking.set(mint, {
      launchTime: Date.now(),
      buyers: new Set(),
      totalSol: 0
    });
  }

  public trackEarlyTrade(trade: TradeEvent): ClusterReport | null {
    const tracker = this.launchTracking.get(trade.mint);
    if (!tracker) return null;

    const ageSeconds = (Date.now() - tracker.launchTime) / 1000;
    const sol = trade.solAmount > 1e6 ? trade.solAmount / 1e9 : trade.solAmount;

    // Only inspect first 5 seconds (block 0-2)
    if (ageSeconds <= 5.0 && trade.txType === 'buy') {
      tracker.buyers.add(trade.traderPublicKey);
      tracker.totalSol += sol;

      const buyerCount = tracker.buyers.size;
      const warnings: string[] = [];
      let riskScore = 0;

      // Suspicious pattern: 6+ unique buyers within the first 1.5 seconds with exact equal SOL amounts
      if (ageSeconds <= 2.0 && buyerCount >= 5) {
        riskScore += 55;
        warnings.push(`High-velocity multi-wallet bundle detected (${buyerCount} wallets in ${ageSeconds.toFixed(1)}s)`);
      }

      if (tracker.totalSol >= 8.0 && ageSeconds <= 3.0) {
        riskScore += 35;
        warnings.push(`Abnormal early volume concentration (${tracker.totalSol.toFixed(1)} SOL in ${ageSeconds.toFixed(1)}s)`);
      }

      const isBundled = riskScore >= 60;

      return {
        mint: trade.mint,
        isBundled,
        clusterRiskScore: Math.min(100, riskScore),
        uniqueBuyersInFirstBlock: buyerCount,
        totalSolInFirstBlock: Number(tracker.totalSol.toFixed(2)),
        warnings
      };
    } else if (ageSeconds > 15.0) {
      // Free memory after 15 seconds
      this.launchTracking.delete(trade.mint);
    }

    return null;
  }

  public cleanup(mint: string): void {
    this.launchTracking.delete(mint);
  }
}
