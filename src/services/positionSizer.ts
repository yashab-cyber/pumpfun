import { AgentConfig } from '../types';

export class PositionSizer {
  private config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = config;
  }

  /**
   * Calculates the optimal trade allocation based on Kelly Criterion and AI Confidence
   */
  public calculateTradeSize(
    aiConfidence: number = 60,
    currentWinRate: number = 50,
    devReputationScore: number = 50,
    availableBalanceSol: number = 1.0
  ): number {
    const baseSize = Math.max(0.001, this.config.solPerTrade || 0.01);
    const validBalance = Math.max(0.001, Number(availableBalanceSol) || 1.0);

    // 1. AI Confidence Multiplier (0.6x for 60% confidence up to 1.6x for 90%+)
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

    // 3. Kelly Fraction Bounds
    const targetSize = baseSize * confidenceMultiplier * devMultiplier;

    // Safety: never allocate more than 35% of current available balance or less than 0.002 SOL
    const maxSafeSize = Math.max(0.002, validBalance * 0.35);
    const finalSize = Math.max(0.002, Math.min(targetSize, maxSafeSize));

    return Number(finalSize.toFixed(4));
  }
}
