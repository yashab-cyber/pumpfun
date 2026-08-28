import chalk from 'chalk';

export class LossRecoveryManager {
  private consecutiveLosses: number = 0;
  private maxConsecutiveLossMultiplier: number = 1.35; // Maximum 1.35x recovery bump
  private maxDailyLossLimitSol: number = 0.25;

  public recordOutcome(isWin: boolean): void {
    if (isWin) {
      this.consecutiveLosses = 0;
    } else {
      this.consecutiveLosses++;
      if (this.consecutiveLosses >= 3) {
        console.log(chalk.yellow(`[Loss Recovery] ⚠️ 3 consecutive losses detected. Activating defensive cooling mode.`));
      }
    }
  }

  public getRecoveryMultiplier(aiConfidence: number): number {
    // Only apply recovery boost if consecutive losses <= 2 AND AI confidence is extremely high (>=85%)
    if (this.consecutiveLosses === 1 && aiConfidence >= 85) {
      return 1.25;
    } else if (this.consecutiveLosses >= 3) {
      return 0.7; // Defensive dampening
    }
    return 1.0;
  }

  public getConsecutiveLossCount(): number {
    return this.consecutiveLosses;
  }
}
