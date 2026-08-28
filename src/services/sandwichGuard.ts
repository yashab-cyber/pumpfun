export interface SandwichRiskAssessment {
  isHighRisk: boolean;
  estimatedPriceImpactPct: number;
  maxSafeSlippagePct: number;
  recommendedSubOrders: number;
  reason: string;
}

export class SandwichGuard {
  /**
   * Evaluates if a trade is vulnerable to MEV sandwich bots
   * @param solAmount The trade size in SOL
   * @param vSolInCurve Virtual SOL in bonding curve (usually 30 to 115 SOL)
   */
  public evaluateSandwichRisk(solAmount: number, vSolInCurve: number = 30000000000): SandwichRiskAssessment {
    const vSol = vSolInCurve > 1e6 ? vSolInCurve / 1e9 : vSolInCurve;
    const impact = (solAmount / (vSol + solAmount)) * 100;

    let isHighRisk = false;
    let maxSafeSlippage = 15;
    let subOrders = 1;
    let reason = 'Safe price impact within normal MEV tolerance.';

    if (impact >= 4.0) {
      isHighRisk = true;
      maxSafeSlippage = 5;
      subOrders = 2;
      reason = `High MEV sandwich risk: Single trade price impact is ${impact.toFixed(1)}% (Threshold: 4%).`;
    } else if (impact >= 2.0) {
      maxSafeSlippage = 8;
      reason = `Moderate price impact (${impact.toFixed(1)}%). Tightened slippage recommended.`;
    }

    return {
      isHighRisk,
      estimatedPriceImpactPct: Number(impact.toFixed(2)),
      maxSafeSlippagePct: maxSafeSlippage,
      recommendedSubOrders: subOrders,
      reason
    };
  }
}
