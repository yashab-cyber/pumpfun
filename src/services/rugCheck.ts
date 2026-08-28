import { Connection, PublicKey } from '@solana/web3.js';
import chalk from 'chalk';
import { SolanaService } from './solana';

export interface RugCheckResult {
  isSafe: boolean;
  score: number; // 0 (Safe) to 100 (Extremely Risky)
  risks: string[];
}

export class RugCheckService {
  private connection: Connection;
  private devHistoryMap: Map<string, { count: number; lastSeen: number }> = new Map();

  constructor(solanaService: SolanaService) {
    this.connection = solanaService.getConnection();
  }

  public async evaluateToken(mint: string, creatorPubkey: string): Promise<RugCheckResult> {
    const risks: string[] = [];
    let riskScore = 0;

    // 1. Dev Deployment Frequency Check
    const now = Date.now();
    const devData = this.devHistoryMap.get(creatorPubkey) || { count: 0, lastSeen: now };
    if (now - devData.lastSeen < 600000) { // within last 10 minutes
      devData.count += 1;
    } else {
      devData.count = 1;
    }
    devData.lastSeen = now;
    this.devHistoryMap.set(creatorPubkey, devData);

    if (devData.count > 3) {
      risks.push(`Dev is spam creating tokens (${devData.count} launches recently)`);
      riskScore += 40;
    }

    // 2. Holder Concentration Check
    try {
      const mintPubkey = new PublicKey(mint);
      const largestAccounts = await this.connection.getTokenLargestAccounts(mintPubkey);
      
      if (largestAccounts && largestAccounts.value && largestAccounts.value.length > 0) {
        // Exclude the largest account which is the pump.fun bonding curve pool
        const nonPoolHolders = largestAccounts.value.slice(1);
        let topHoldersSum = 0;
        for (const h of nonPoolHolders.slice(0, 5)) {
          topHoldersSum += Number(h.amount);
        }

        const topHoldersRatio = topHoldersSum / 1e15; // 1B tokens with 6 decimals = 1e15 units
        if (topHoldersRatio > 0.25) {
          risks.push(`Top 5 non-pool holders control ${(topHoldersRatio * 100).toFixed(1)}% of total supply`);
          riskScore += 35;
        }
      }
    } catch {
      // If RPC rate limits, continue with standard checks
    }

    const isSafe = riskScore < 50;
    return {
      isSafe,
      score: riskScore,
      risks
    };
  }
}
