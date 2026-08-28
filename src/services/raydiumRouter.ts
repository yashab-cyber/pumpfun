import axios from 'axios';
import chalk from 'chalk';
import { Connection } from '@solana/web3.js';

export interface RaydiumPoolInfo {
  mint: string;
  isMigrated: boolean;
  raydiumPoolId?: string;
  baseVault?: string;
  quoteVault?: string;
  lpMint?: string;
}

export class RaydiumRouter {
  private jupiterQuoteApi: string = 'https://quote-api.jup.ag/v6';
  private connection: Connection;
  private quoteCache: Map<string, { data: any; timestamp: number }> = new Map();

  constructor(connection: Connection) {
    this.connection = connection;
  }

  /**
   * Check if token has completed graduation and is tradeable on Raydium/Jupiter
   */
  public async checkRaydiumGraduation(mint: string): Promise<RaydiumPoolInfo> {
    const cached = this.quoteCache.get(`grad_${mint}`);
    if (cached && (Date.now() - cached.timestamp) < 5000) {
      return cached.data;
    }

    try {
      const response = await axios.get(`${this.jupiterQuoteApi}/quote`, {
        params: {
          inputMint: 'So11111111111111111111111111111111111111112', // SOL
          outputMint: mint,
          amount: 10000000, // 0.01 SOL
          slippageBps: 1500
        },
        timeout: 3500
      });

      if (response.data && response.data.outAmount) {
        const result: RaydiumPoolInfo = {
          mint,
          isMigrated: true,
          raydiumPoolId: response.data.routePlan?.[0]?.swapInfo?.ammKey
        };
        this.quoteCache.set(`grad_${mint}`, { data: result, timestamp: Date.now() });
        return result;
      }
      return { mint, isMigrated: false };
    } catch {
      return { mint, isMigrated: false };
    }
  }

  /**
   * Get dynamic exit route for post-migration tokens
   */
  public async getRaydiumSellQuote(mint: string, tokenAmountRaw: number): Promise<{ outSolLamports: number; priceImpactPct: number } | null> {
    if (!tokenAmountRaw || tokenAmountRaw <= 0) return null;

    try {
      const response = await axios.get(`${this.jupiterQuoteApi}/quote`, {
        params: {
          inputMint: mint,
          outputMint: 'So11111111111111111111111111111111111111112',
          amount: Math.floor(tokenAmountRaw),
          slippageBps: 1500
        },
        timeout: 3500
      });

      if (response.data && response.data.outAmount) {
        return {
          outSolLamports: Number(response.data.outAmount),
          priceImpactPct: Number(response.data.priceImpactPct || 0)
        };
      }
      return null;
    } catch {
      return null;
    }
  }
}
