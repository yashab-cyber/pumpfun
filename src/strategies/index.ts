import { TokenCreationEvent, TradeEvent } from '../types';
import { BondingCurveCalculator } from '../services/bondingCurve';

export type StrategyType = 'SNIPER' | 'MIGRATION_KOTH' | 'MOMENTUM_SCALP' | 'COPY_WHALE';

export interface StrategyDecision {
  shouldBuy: boolean;
  reason: string;
  suggestedSizeMultiplier: number;
}

export class StrategyManager {
  private activeStrategy: StrategyType = 'SNIPER';
  private tradeWindowMap: Map<string, { count: number; firstSeen: number; buyVolumeSol: number }> = new Map();

  constructor(defaultStrategy: StrategyType = 'SNIPER') {
    this.activeStrategy = defaultStrategy;
  }

  public getActiveStrategy(): StrategyType {
    return this.activeStrategy;
  }

  public setActiveStrategy(strat: StrategyType): void {
    this.activeStrategy = strat;
  }

  public evaluateNewToken(token: TokenCreationEvent, viralityScore: number): StrategyDecision {
    switch (this.activeStrategy) {
      case 'SNIPER':
        return {
          shouldBuy: viralityScore >= 45,
          reason: `Sniper triggered (Virality: ${viralityScore}/100)`,
          suggestedSizeMultiplier: 1.0
        };

      case 'MIGRATION_KOTH':
        return {
          shouldBuy: false,
          reason: 'Migration strategy waits for bonding curve graduation threshold (65%+)',
          suggestedSizeMultiplier: 1.0
        };

      case 'MOMENTUM_SCALP':
        return {
          shouldBuy: false,
          reason: 'Momentum strategy waits for trade velocity flow',
          suggestedSizeMultiplier: 1.0
        };

      case 'COPY_WHALE':
        return {
          shouldBuy: false,
          reason: 'Copy Whale strategy only follows target wallet trades',
          suggestedSizeMultiplier: 1.0
        };
    }
  }

  public evaluateTradeTick(trade: TradeEvent): StrategyDecision {
    const now = Date.now();
    const window = this.tradeWindowMap.get(trade.mint) || { count: 0, firstSeen: now, buyVolumeSol: 0 };

    if (now - window.firstSeen < 30000) { // 30-second rolling window
      window.count++;
      if (trade.txType === 'buy') {
        const sol = trade.solAmount > 1e6 ? trade.solAmount / 1e9 : trade.solAmount;
        window.buyVolumeSol += sol;
      }
    } else {
      window.count = 1;
      window.firstSeen = now;
      const sol = trade.solAmount > 1e6 ? trade.solAmount / 1e9 : trade.solAmount;
      window.buyVolumeSol = trade.txType === 'buy' ? sol : 0;
    }
    this.tradeWindowMap.set(trade.mint, window);

    // Periodic map garbage collection to prevent memory leaks
    if (this.tradeWindowMap.size > 2000) {
      for (const [mint, data] of this.tradeWindowMap.entries()) {
        if (now - data.firstSeen > 120000) {
          this.tradeWindowMap.delete(mint);
        }
      }
    }

    // Strategy 1: Migration / KOTH
    if (this.activeStrategy === 'MIGRATION_KOTH') {
      if (trade.vSolInBondingCurve) {
        const progress = BondingCurveCalculator.calculateProgress(trade.vSolInBondingCurve);
        if (progress >= 65 && progress <= 95 && window.buyVolumeSol > 1.5) {
          return {
            shouldBuy: true,
            reason: `Raydium Migration breakout detected! Progress: ${progress.toFixed(1)}% | 30s Buy Vol: ${window.buyVolumeSol.toFixed(2)} SOL`,
            suggestedSizeMultiplier: 1.2
          };
        }
      }
    }

    // Strategy 2: Momentum Scalper
    if (this.activeStrategy === 'MOMENTUM_SCALP') {
      if (window.count >= 6 && window.buyVolumeSol >= 2.0) {
        return {
          shouldBuy: true,
          reason: `Momentum Surge detected! ${window.count} trades with ${window.buyVolumeSol.toFixed(2)} SOL volume in 30s`,
          suggestedSizeMultiplier: 1.0
        };
      }
    }

    return { shouldBuy: false, reason: 'Conditions not met', suggestedSizeMultiplier: 1.0 };
  }
}
