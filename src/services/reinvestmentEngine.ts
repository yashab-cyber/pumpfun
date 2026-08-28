export class ReinvestmentEngine {
  private baseTradeSizeSol: number = 0.01;
  private reinvestFraction: number = 0.05; // Reinvest 5% of net session profit

  constructor(baseTradeSizeSol: number = 0.01, reinvestFraction: number = 0.05) {
    this.baseTradeSizeSol = baseTradeSizeSol;
    this.reinvestFraction = reinvestFraction;
  }

  public calculateCompoundedTradeSize(sessionPnlSol: number, availableBankrollSol: number): number {
    if (sessionPnlSol <= 0) {
      return this.baseTradeSizeSol;
    }

    // Add 5% of session profits to trade size
    const profitBonus = sessionPnlSol * this.reinvestFraction;
    const compounded = this.baseTradeSizeSol + profitBonus;

    // Strict safety bound: never allocate more than 30% of available bankroll or 2.5x base size
    const maxBound = Math.min(this.baseTradeSizeSol * 2.5, availableBankrollSol * 0.3);
    const finalSize = Math.max(this.baseTradeSizeSol, Math.min(compounded, maxBound));

    return Number(finalSize.toFixed(4));
  }
}
