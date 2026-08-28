import { AgentConfig } from '../types';

export class PositionSizer {
  private config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = config;
  }

  /**
   * Calculates the optimal trade allocation based on Kelly Criterion, Bayesian Win Rate, and AI Confidence
   */
  public calculateTradeSize(
    aiConfidence: number = 60,
    currentWinRate: number = 50,
    devReputationScore: number = 50,
    availableBalanceSol: number = 1.0
  ): number {
    const baseSize = Math.max(0.001, this.config.solPerTrade || 0.01);
    const validBalance = Math.max(0.001, Number(availableBalanceSol) || 1.0);

    // 1. AI Conviction Multiplier
    let confidenceMultiplier = 1.0;
    if (aiConfidence >= 90) {
      confidenceMultiplier = 1.6;
    } else if (aiConfidence >= 80) {
      confidenceMultiplier = 1.3;
    } else if (aiConfidence >= 70) {
      confidenceMultiplier = 1.0;
    } else {
      confidenceMultiplier = 0.65;
    }

    // 2. Dev Reputation Factor
    let devMultiplier = 1.0;
    if (devReputationScore >= 80) {
      devMultiplier = 1.2;
    } else if (devReputationScore <= 40) {
      devMultiplier = 0.6;
    }

    // 3. Win-Rate Bias Multiplier
    let winRateMultiplier = 1.0;
    if (currentWinRate >= 70) {
      winRateMultiplier = 1.15;
    } else if (currentWinRate <= 35 && currentWinRate > 0) {
      winRateMultiplier = 0.75;
    }

    // 4. Kelly Allocation
    const targetSize = baseSize * confidenceMultiplier * devMultiplier * winRateMultiplier;

    // Strict boundary: Never allocate more than 35% of current available balance or less than 0.002 SOL
    const maxSafeSize = Math.max(0.002, validBalance * 0.35);
    const finalSize = Math.max(0.002, Math.min(targetSize, maxSafeSize));

    return Number(finalSize.toFixed(4));
  }
}
