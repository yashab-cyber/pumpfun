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

    for (const t of history) {
      if (t.isBuy) {
        buyVol += t.sol;
        if (t.sol < 0.05) smallBuys++;
      } else {
        sellVol += t.sol;
        if (t.sol >= 0.5) stealthSells++;
      }
    }

    const netDrain = sellVol - buyVol;

    // Detect stealth drain pattern:
    // Heavy sell volume (>3 SOL) paired with continuous micro-buys (<0.05 SOL) designed to disguise dumping
    if (sellVol >= 3.0 && netDrain >= 2.0 && smallBuys >= 4 && stealthSells >= 3) {
      return {
        mint: trade.mint,
        isDraining: true,
        sellVolumeSol: Number(sellVol.toFixed(2)),
        buyVolumeSol: Number(buyVol.toFixed(2)),
        netDrainSol: Number(netDrain.toFixed(2)),
        stealthSellCount: stealthSells,
        reason: `Stealth Ladder Dump: ${sellVol.toFixed(1)} SOL dumped against ${smallBuys} artificial micro-buys`
      };
    }

    return null;
  }

  public cleanup(mint: string): void {
    this.tradeHistory.delete(mint);
  }
}
