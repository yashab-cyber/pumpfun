import { BondingCurveCalculator } from './bondingCurve';

export interface MigrationPrediction {
  mint: string;
  symbol: string;
  progressPercent: number;
  currentSolInCurve: number;
  solRemainingToGraduation: number;
  solVelocityPerMinute: number;
  estimatedMinutesToGraduation: number | null;
  isImminent: boolean;
  accelerationTrend: 'ACCELERATING' | 'STEADY' | 'DECELERATING';
  recommendation: 'ACCUMULATE_FOR_RAYDIUM' | 'TAKE_PRE_MIGRATION_PROFIT' | 'MONITOR';
}

export class MigrationPredictor {
  // Track SOL history per mint: Map<mint, Array<{ timestamp: number; vSol: number }>>
  private curveHistory: Map<string, Array<{ timestamp: number; vSol: number }>> = new Map();
  private emaVelocityMap: Map<string, number> = new Map();

  public trackTick(mint: string, symbol: string, vSolLamports: number): MigrationPrediction {
    const now = Date.now();
    let history = this.curveHistory.get(mint);
    if (!history) {
      history = [];
      this.curveHistory.set(mint, history);
    }

    history.push({ timestamp: now, vSol: vSolLamports });
    // Keep last 3 minutes of tick history
    const cutoff = now - 180000;
    while (history.length > 0 && history[0].timestamp < cutoff) {
      history.shift();
    }

    // Periodic memory cleanup of inactive tokens
    if (this.curveHistory.size > 1000) {
      for (const [m, h] of this.curveHistory.entries()) {
        if (h.length === 0 || (now - h[h.length - 1].timestamp) > 300000) {
          this.curveHistory.delete(m);
          this.emaVelocityMap.delete(m);
        }
      }
    }

    const currentVSol = vSolLamports;
    const progress = BondingCurveCalculator.calculateProgress(currentVSol);
    const realSol = Math.max(0, (currentVSol - BondingCurveCalculator.INITIAL_VIRTUAL_SOL) / 1e9);
    const targetRealSol = BondingCurveCalculator.GRADUATION_SOL_THRESHOLD / 1e9;
    const solRemaining = Math.max(0, targetRealSol - realSol);

    // Calculate raw instantaneous velocity per minute
    let instantVelocity = 0;
    if (history.length >= 2) {
      const oldest = history[0];
      const timeDeltaMinutes = (now - oldest.timestamp) / 60000;
      if (timeDeltaMinutes > 0.03) {
        const solDelta = Math.max(0, (currentVSol - oldest.vSol) / 1e9);
        instantVelocity = solDelta / timeDeltaMinutes;
      }
    }

    // Apply Exponential Moving Average (EMA) smoothing: EMA = Price(t) * k + EMA(y) * (1 – k)
    const prevEma = this.emaVelocityMap.get(mint) || instantVelocity;
    const alpha = 0.35; // 35% weight to newest tick
    const emaVelocity = instantVelocity * alpha + prevEma * (1 - alpha);
    this.emaVelocityMap.set(mint, emaVelocity);

    let accelerationTrend: 'ACCELERATING' | 'STEADY' | 'DECELERATING' = 'STEADY';
    if (instantVelocity > emaVelocity * 1.25) {
      accelerationTrend = 'ACCELERATING';
    } else if (instantVelocity < emaVelocity * 0.75) {
      accelerationTrend = 'DECELERATING';
    }

    let estimatedMinutesToGraduation: number | null = null;
    if (emaVelocity > 0.05 && solRemaining > 0) {
      estimatedMinutesToGraduation = Number((solRemaining / emaVelocity).toFixed(1));
    }

    const isImminent = progress >= 75 || (estimatedMinutesToGraduation !== null && estimatedMinutesToGraduation <= 5);

    let recommendation: 'ACCUMULATE_FOR_RAYDIUM' | 'TAKE_PRE_MIGRATION_PROFIT' | 'MONITOR' = 'MONITOR';
    if (progress >= 92) {
      recommendation = 'TAKE_PRE_MIGRATION_PROFIT'; // Secure peak profit before Raydium pool seeding
    } else if (isImminent && accelerationTrend !== 'DECELERATING') {
      recommendation = 'ACCUMULATE_FOR_RAYDIUM';
    }

    return {
      mint,
      symbol,
      progressPercent: Number(progress.toFixed(1)),
      currentSolInCurve: Number(realSol.toFixed(2)),
      solRemainingToGraduation: Number(solRemaining.toFixed(2)),
      solVelocityPerMinute: Number(emaVelocity.toFixed(2)),
      estimatedMinutesToGraduation,
      isImminent,
      accelerationTrend,
      recommendation
    };
  }

  public cleanup(mint: string): void {
    this.curveHistory.delete(mint);
    this.emaVelocityMap.delete(mint);
  }
}
