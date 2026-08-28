import { BondingCurveCalculator } from './bondingCurve';

export interface MigrationPrediction {
  mint: string;
  symbol: string;
  progressPercent: number;
  currentSolInCurve: number;
  solRemainingToGraduation: number;
  solVelocityPerMinute: number;
  estimatedMinutesToGraduation: number | null; // null if velocity is zero
  isImminent: boolean; // >= 75% progress or < 5 mins to graduation
  recommendation: 'ACCUMULATE_FOR_RAYDIUM' | 'TAKE_PRE_MIGRATION_PROFIT' | 'MONITOR';
}

export class MigrationPredictor {
  // Track SOL history per mint to calculate velocity: Map<mint, Array<{ timestamp: number; vSol: number }>>
  private curveHistory: Map<string, Array<{ timestamp: number; vSol: number }>> = new Map();

  public trackTick(mint: string, symbol: string, vSolLamports: number): MigrationPrediction {
    const now = Date.now();
    let history = this.curveHistory.get(mint);
    if (!history) {
      history = [];
      this.curveHistory.set(mint, history);
    }

    history.push({ timestamp: now, vSol: vSolLamports });
    // Keep last 3 minutes of history
    const cutoff = now - 180000;
    while (history.length > 0 && history[0].timestamp < cutoff) {
      history.shift();
    }

    const currentVSol = vSolLamports;
    const progress = BondingCurveCalculator.calculateProgress(currentVSol);
    const realSol = Math.max(0, (currentVSol - BondingCurveCalculator.INITIAL_VIRTUAL_SOL) / 1e9);
    const targetRealSol = BondingCurveCalculator.GRADUATION_SOL_THRESHOLD / 1e9;
    const solRemaining = Math.max(0, targetRealSol - realSol);

    // Calculate SOL velocity per minute
    let solVelocityPerMinute = 0;
    if (history.length >= 2) {
      const oldest = history[0];
      const timeDeltaMinutes = (now - oldest.timestamp) / 60000;
      if (timeDeltaMinutes > 0.05) {
        const solDelta = Math.max(0, (currentVSol - oldest.vSol) / 1e9);
        solVelocityPerMinute = solDelta / timeDeltaMinutes;
      }
    }

    let estimatedMinutesToGraduation: number | null = null;
    if (solVelocityPerMinute > 0.1 && solRemaining > 0) {
      estimatedMinutesToGraduation = Number((solRemaining / solVelocityPerMinute).toFixed(1));
    }

    const isImminent = progress >= 75 || (estimatedMinutesToGraduation !== null && estimatedMinutesToGraduation <= 5);

    let recommendation: 'ACCUMULATE_FOR_RAYDIUM' | 'TAKE_PRE_MIGRATION_PROFIT' | 'MONITOR' = 'MONITOR';
    if (progress >= 92) {
      recommendation = 'TAKE_PRE_MIGRATION_PROFIT'; // Lock in before Raydium pool creation dump
    } else if (isImminent) {
      recommendation = 'ACCUMULATE_FOR_RAYDIUM';
    }

    return {
      mint,
      symbol,
      progressPercent: Number(progress.toFixed(1)),
      currentSolInCurve: Number(realSol.toFixed(2)),
      solRemainingToGraduation: Number(solRemaining.toFixed(2)),
      solVelocityPerMinute: Number(solVelocityPerMinute.toFixed(2)),
      estimatedMinutesToGraduation,
      isImminent,
      recommendation
    };
  }

  public cleanup(mint: string): void {
    this.curveHistory.delete(mint);
  }
}
