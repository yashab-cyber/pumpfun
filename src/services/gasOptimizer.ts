import { Connection, PublicKey } from '@solana/web3.js';
import chalk from 'chalk';

export class GasOptimizer {
  private static readonly PUMP_PROGRAM_ID = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');
  private connection: Connection;
  private cachedFeeMicroLamports: number = 50000;
  private lastFetchTime: number = 0;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  public async getOptimalPriorityFee(multiplier: number = 1.2): Promise<number> {
    const now = Date.now();
    // Cache for 15 seconds to avoid RPC throttling
    if (now - this.lastFetchTime < 15000) {
      return Math.floor(this.cachedFeeMicroLamports * multiplier);
    }

    try {
      const fees = await this.connection.getRecentPrioritizationFees({
        lockedWritableAccounts: [GasOptimizer.PUMP_PROGRAM_ID]
      });

      if (fees && fees.length > 0) {
        const nonZero = fees.map(f => f.prioritizationFee).filter(f => f > 0);
        if (nonZero.length > 0) {
          nonZero.sort((a, b) => a - b);
          // Pick 75th percentile for rapid block inclusion
          const p75Idx = Math.floor(nonZero.length * 0.75);
          const rawP75 = nonZero[p75Idx];

          // Clamp between safe bounds (10,000 to 1,500,000 micro-lamports)
          this.cachedFeeMicroLamports = Math.max(10000, Math.min(1500000, rawP75));
          this.lastFetchTime = now;
        }
      }
    } catch {
      // Fall back safely to cached fee
    }

    const calculated = Math.floor(this.cachedFeeMicroLamports * multiplier);
    return Math.max(10000, Math.min(2000000, calculated));
  }
}
