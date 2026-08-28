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
  // Track early buyers in first 5 seconds: Map<mint, { launchTime: number, buyers: Set<string>, amounts: number[], totalSol: number }>
  private launchTracking: Map<string, { launchTime: number; buyers: Set<string>; amounts: number[]; totalSol: number }> = new Map();

  public registerLaunch(mint: string): void {
    const now = Date.now();
    this.launchTracking.set(mint, {
      launchTime: now,
      buyers: new Set(),
      amounts: [],
      totalSol: 0
    });

    // Automatic pruning of dead launches older than 60s
    if (this.launchTracking.size > 1000) {
      for (const [k, v] of this.launchTracking.entries()) {
        if (now - v.launchTime > 60000) {
          this.launchTracking.delete(k);
        }
      }
    }
  }

  public trackEarlyTrade(trade: TradeEvent): ClusterReport | null {
    const tracker = this.launchTracking.get(trade.mint);
    if (!tracker) return null;

    const ageSeconds = (Date.now() - tracker.launchTime) / 1000;
    const sol = trade.solAmount > 1e6 ? trade.solAmount / 1e9 : trade.solAmount;

    // Only inspect first 5 seconds (block 0-2)
    if (ageSeconds <= 5.0 && trade.txType === 'buy') {
      tracker.buyers.add(trade.traderPublicKey);
      tracker.amounts.push(Number(sol.toFixed(3)));
      tracker.totalSol += sol;

      const buyerCount = tracker.buyers.size;
      const warnings: string[] = [];
      let riskScore = 0;

      // 1. High-velocity multi-wallet burst
      if (ageSeconds <= 2.0 && buyerCount >= 5) {
        riskScore += 55;
        warnings.push(`High-velocity multi-wallet bundle (${buyerCount} wallets in ${ageSeconds.toFixed(1)}s)`);
      }

      // 2. Identical clone amounts across multiple wallets (e.g. 5 wallets all buying exactly 0.250 SOL)
      if (tracker.amounts.length >= 4) {
        const freqMap: Record<number, number> = {};
        for (const amt of tracker.amounts) {
          freqMap[amt] = (freqMap[amt] || 0) + 1;
        }
        for (const count of Object.values(freqMap)) {
          if (count >= 4) {
            riskScore += 45;
            warnings.push(`Identical multi-wallet buy amount symmetry (${count} wallets with identical SOL)`);
            break;
          }
        }
      }

      // 3. Excessive early SOL injection
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
      this.launchTracking.delete(trade.mint);
    }

    return null;
  }

  public cleanup(mint: string): void {
    this.launchTracking.delete(mint);
  }
}
