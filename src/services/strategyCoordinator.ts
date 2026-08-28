import chalk from 'chalk';
import { StrategyType } from '../strategies';

export interface MarketRegime {
  currentStrategy: StrategyType;
  marketSpeedTokensPerMin: number;
  averageHoldDurationSec: number;
  overallWinRate: number;
  recommendedStrategy: StrategyType;
  regimeReason: string;
}

export class StrategyCoordinator {
  private activeStrategy: StrategyType = 'SNIPER';
  private autoSwitchEnabled: boolean = true;
  private tokenLaunchesTimestamps: number[] = [];
  private pendingRecommendation: StrategyType | null = null;
  private pendingRecommendationCount: number = 0;

  constructor(initialStrategy: StrategyType = 'SNIPER', autoSwitch: boolean = true) {
    this.activeStrategy = initialStrategy;
    this.autoSwitchEnabled = autoSwitch;
  }

  public recordTokenLaunch(): void {
    const now = Date.now();
    this.tokenLaunchesTimestamps.push(now);
    const cutoff = now - 300000; // 5 min window
    while (this.tokenLaunchesTimestamps.length > 0 && this.tokenLaunchesTimestamps[0] < cutoff) {
      this.tokenLaunchesTimestamps.shift();
    }
  }

  public evaluateRegime(winRate: number, recentPnlSol: number, kothCount: number): MarketRegime {
    const launchesIn5Min = this.tokenLaunchesTimestamps.length;
    const tokensPerMin = launchesIn5Min / 5;

    let recommended: StrategyType = 'SNIPER';
    let reason = 'High launch rate with standard volatility favors early Sniper entries.';

    if (kothCount >= 3) {
      recommended = 'MIGRATION_KOTH';
      reason = 'Strong bonding curve graduation momentum detected. Raydium migration strategy active.';
    } else if (tokensPerMin > 15 && winRate < 45) {
      recommended = 'MOMENTUM_SCALP';
      reason = 'High noise/spam regime. Momentum breakout confirmation required to reduce false breakouts.';
    } else if (winRate >= 70 && recentPnlSol > 0.2) {
      recommended = 'SNIPER';
      reason = 'High-performing sniper regime with favorable dev quality.';
    }

    // Hysteresis filter: Require 3 consecutive recommendation ticks before auto-switching
    if (recommended === this.pendingRecommendation) {
      this.pendingRecommendationCount++;
    } else {
      this.pendingRecommendation = recommended;
      this.pendingRecommendationCount = 1;
    }

    if (this.autoSwitchEnabled && recommended !== this.activeStrategy && this.pendingRecommendationCount >= 3) {
      console.log(
        chalk.cyan.bold(
          `\n[Strategy Coordinator] 🔄 AUTO-SWITCHING STRATEGY: ${this.activeStrategy} ➔ ${recommended}\n` +
          `  • Reason: ${reason}\n`
        )
      );
      this.activeStrategy = recommended;
      this.pendingRecommendationCount = 0;
    }

    return {
      currentStrategy: this.activeStrategy,
      marketSpeedTokensPerMin: Number(tokensPerMin.toFixed(1)),
      averageHoldDurationSec: 45,
      overallWinRate: Number(winRate.toFixed(1)),
      recommendedStrategy: recommended,
      regimeReason: reason
    };
  }

  public getActiveStrategy(): StrategyType {
    return this.activeStrategy;
  }

  public setActiveStrategy(strat: StrategyType): void {
    this.activeStrategy = strat;
    this.pendingRecommendationCount = 0;
  }

  public toggleAutoSwitch(enabled: boolean): void {
    this.autoSwitchEnabled = enabled;
  }
}
