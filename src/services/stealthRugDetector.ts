import { TradeEvent } from '../types';

export interface StealthDrainAlert {
  mint: string;
  isDraining: boolean;
  sellVolumeSol: number;
  buyVolumeSol: number;
  netDrainSol: number;
  stealthSellCount: number;
  reason: string;
}

export class StealthRugDetector {
  // Track trades per token in rolling 60s windows: Map<mint, Array<{ isBuy: boolean, sol: number, timestamp: number }>>
  private tradeHistory: Map<string, Array<{ isBuy: boolean; sol: number; timestamp: number }>> = new Map();

  public trackTrade(trade: TradeEvent): StealthDrainAlert | null {
    const now = Date.now();
    const sol = trade.solAmount > 1e6 ? trade.solAmount / 1e9 : trade.solAmount;
    const isBuy = trade.txType === 'buy';

    if (!this.tradeHistory.has(trade.mint)) {
      this.tradeHistory.set(trade.mint, []);
    }

    const history = this.tradeHistory.get(trade.mint)!;
    history.push({ isBuy, sol, timestamp: now });

    // Prune trades older than 60 seconds
    const cutoff = now - 60000;
    while (history.length > 0 && history[0].timestamp < cutoff) {
      history.shift();
    }

    // Evaluate rolling metrics
    let buyVol = 0;
    let sellVol = 0;
    let smallBuys = 0;
    let stealthSells = 0;
    let totalBuys = 0;
    let totalSells = 0;

    for (const t of history) {
      if (t.isBuy) {
        buyVol += t.sol;
        totalBuys++;
        if (t.sol < 0.05) smallBuys++;
      } else {
        sellVol += t.sol;
        totalSells++;
        if (t.sol >= 0.5) stealthSells++;
      }
    }

    const netDrain = sellVol - buyVol;
    const avgBuySize = totalBuys > 0 ? buyVol / totalBuys : 0;
    const avgSellSize = totalSells > 0 ? sellVol / totalSells : 0;
    const isAsymmetricDump = avgSellSize > 0 && avgBuySize > 0 && (avgSellSize / avgBuySize) >= 5.0 && sellVol >= 2.0;

    // Detect stealth drain pattern:
    // Heavy sell volume (>3 SOL) paired with continuous micro-buys (<0.05 SOL) OR extreme asymmetric size ratio
    if ((sellVol >= 2.5 && netDrain >= 1.8 && smallBuys >= 3 && stealthSells >= 2) || isAsymmetricDump) {
      return {
        mint: trade.mint,
        isDraining: true,
        sellVolumeSol: Number(sellVol.toFixed(2)),
        buyVolumeSol: Number(buyVol.toFixed(2)),
        netDrainSol: Number(netDrain.toFixed(2)),
        stealthSellCount: stealthSells,
        reason: isAsymmetricDump 
          ? `Asymmetric Dump Ratio: Avg sell (${avgSellSize.toFixed(2)} SOL) is ${(avgSellSize/avgBuySize).toFixed(1)}x larger than avg buy`
          : `Stealth Ladder Dump: ${sellVol.toFixed(1)} SOL dumped against ${smallBuys} artificial micro-buys`
      };
    }

    // Memory garbage collector
    if (this.tradeHistory.size > 2000) {
      for (const [k, v] of this.tradeHistory.entries()) {
        if (v.length === 0 || (now - v[v.length - 1].timestamp) > 300000) {
          this.tradeHistory.delete(k);
        }
      }
    }

    return null;
  }

  public cleanup(mint: string): void {
    this.tradeHistory.delete(mint);
  }
}
