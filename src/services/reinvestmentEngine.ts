export class ReinvestmentEngine {
  private baseTradeSizeSol: number = 0.01;
  private reinvestFraction: number = 0.05; // Reinvest 5% of net session profit

  constructor(baseTradeSizeSol: number = 0.01, reinvestFraction: number = 0.05) {
    this.baseTradeSizeSol = Math.max(0.001, baseTradeSizeSol);
    this.reinvestFraction = Math.max(0.01, Math.min(0.25, reinvestFraction));
  }

  public calculateCompoundedTradeSize(sessionPnlSol: number, availableBankrollSol: number): number {
    const validBankroll = Math.max(0.001, availableBankrollSol || 1.0);
    const maxSafeBankrollAllocation = validBankroll * 0.35;

    if (sessionPnlSol <= 0) {
      return Number(Math.min(this.baseTradeSizeSol, maxSafeBankrollAllocation).toFixed(4));
    }

    // Add 5% of session profits to trade size
    const profitBonus = sessionPnlSol * this.reinvestFraction;
    const compounded = this.baseTradeSizeSol + profitBonus;

    // Strict safety bound: never allocate more than 35% of available bankroll or 2.5x base size
    const maxBound = Math.min(this.baseTradeSizeSol * 2.5, maxSafeBankrollAllocation);
    const finalSize = Math.min(compounded, maxBound);

    return Number(Math.max(0.001, finalSize).toFixed(4));
  }
}
