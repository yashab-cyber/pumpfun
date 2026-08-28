export class BondingCurveCalculator {
  // Pump.fun Curve Constants
  public static readonly INITIAL_VIRTUAL_SOL = 30 * 1e9; // 30 SOL in lamports
  public static readonly INITIAL_VIRTUAL_TOKENS = 1073000000 * 1e6; // 1.073 Billion tokens
  public static readonly TOTAL_SUPPLY = 1000000000 * 1e6; // 1 Billion tokens
  public static readonly GRADUATION_SOL_THRESHOLD = 85 * 1e9; // ~85 SOL real needed for Raydium migration

  /**
   * Calculate tokens received for a given SOL amount on the bonding curve using AMM invariant k = vSol * vTokens
   */
  public static getTokensForSol(
    solLamports: number,
    vSolLamports: number = BondingCurveCalculator.INITIAL_VIRTUAL_SOL,
    vTokenUnits: number = BondingCurveCalculator.INITIAL_VIRTUAL_TOKENS
  ): { tokensReceived: number; priceImpactPercent: number } {
    if (solLamports <= 0 || vSolLamports <= 0 || vTokenUnits <= 0) {
      return { tokensReceived: 0, priceImpactPercent: 0 };
    }

    try {
      const k = BigInt(Math.floor(vSolLamports)) * BigInt(Math.floor(vTokenUnits));
      const newVSol = BigInt(Math.floor(vSolLamports + solLamports));
      const newVTokens = k / newVSol;
      const tokensOut = Number(BigInt(Math.floor(vTokenUnits)) - newVTokens);

      if (tokensOut <= 0) {
        return { tokensReceived: 0, priceImpactPercent: 0 };
      }

      const initialPrice = vSolLamports / vTokenUnits;
      const executionPrice = solLamports / tokensOut;
      const priceImpactPercent = initialPrice > 0 ? ((executionPrice - initialPrice) / initialPrice) * 100 : 0;

      return {
        tokensReceived: Math.max(0, tokensOut),
        priceImpactPercent: Math.max(0, Math.min(100, priceImpactPercent))
      };
    } catch {
      return { tokensReceived: 0, priceImpactPercent: 0 };
    }
  }

  /**
   * Calculate SOL received for selling a given token amount on the bonding curve
   */
  public static getSolForTokens(
    tokenUnits: number,
    vSolLamports: number,
    vTokenUnits: number
  ): { solReceivedLamports: number; priceImpactPercent: number } {
    if (tokenUnits <= 0 || vSolLamports <= 0 || vTokenUnits <= 0) {
      return { solReceivedLamports: 0, priceImpactPercent: 0 };
    }

    try {
      const k = BigInt(Math.floor(vSolLamports)) * BigInt(Math.floor(vTokenUnits));
      const newVTokens = BigInt(Math.floor(vTokenUnits + tokenUnits));
      const newVSol = k / newVTokens;
      const solOut = Number(BigInt(Math.floor(vSolLamports)) - newVSol);

      if (solOut <= 0) {
        return { solReceivedLamports: 0, priceImpactPercent: 0 };
      }

      const initialPrice = vSolLamports / vTokenUnits;
      const executionPrice = solOut / tokenUnits;
      const priceImpactPercent = initialPrice > 0 ? ((initialPrice - executionPrice) / initialPrice) * 100 : 0;

      return {
        solReceivedLamports: Math.max(0, solOut),
        priceImpactPercent: Math.max(0, Math.min(100, priceImpactPercent))
      };
    } catch {
      return { solReceivedLamports: 0, priceImpactPercent: 0 };
    }
  }

  /**
   * Calculate percentage progress towards Raydium graduation (0% to 100%)
   */
  public static calculateProgress(vSolLamports: number): number {
    if (!vSolLamports || vSolLamports <= 0 || isNaN(vSolLamports)) return 0;
    const realSol = Math.max(0, vSolLamports - BondingCurveCalculator.INITIAL_VIRTUAL_SOL);
    const progress = (realSol / BondingCurveCalculator.GRADUATION_SOL_THRESHOLD) * 100;
    return Math.min(100, Math.max(0, progress));
  }

  /**
   * Calculate current spot price in SOL from curve reserves
   */
  public static calculateSpotPriceSol(vSolLamports: number, vTokenUnits: number): number {
    if (!vSolLamports || !vTokenUnits || vTokenUnits <= 0) return 0.00000003;
    const sol = vSolLamports / 1e9;
    const tokens = vTokenUnits / 1e6;
    return sol / tokens;
  }

  /**
   * Estimate Market Cap in USD given current price in SOL and SOL/USD rate
   */
  public static calculateMarketCapUsd(priceInSol: number, solUsdPrice: number = 200): number {
    if (!priceInSol || priceInSol <= 0 || isNaN(priceInSol)) return 0;
    const totalTokens = 1000000000;
    return priceInSol * totalTokens * solUsdPrice;
  }
}
