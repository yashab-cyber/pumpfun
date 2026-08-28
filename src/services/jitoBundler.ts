import axios from 'axios';
import chalk from 'chalk';
import { PublicKey, SystemProgram } from '@solana/web3.js';

export interface JitoBundleResult {
  success: boolean;
  bundleId?: string;
  error?: string;
  endpointUsed?: string;
}

export class JitoBundler {
  private static readonly JITO_TIP_ACCOUNTS = [
    '96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5',
    'HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe',
    'Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY',
    'ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49',
    'DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh',
    'ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt',
    'DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL',
    '3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT'
  ];

  private static readonly JITO_ENDPOINTS = [
    'https://mainnet.block-engine.jito.wtf/api/v1/bundles',
    'https://amsterdam.mainnet.block-engine.jito.wtf/api/v1/bundles',
    'https://frankfurt.mainnet.block-engine.jito.wtf/api/v1/bundles',
    'https://ny.mainnet.block-engine.jito.wtf/api/v1/bundles',
    'https://tokyo.mainnet.block-engine.jito.wtf/api/v1/bundles'
  ];

  public static getRandomTipAccount(): PublicKey {
    const random = JitoBundler.JITO_TIP_ACCOUNTS[Math.floor(Math.random() * JitoBundler.JITO_TIP_ACCOUNTS.length)];
    return new PublicKey(random);
  }

  public static createTipInstruction(payer: PublicKey, tipLamports: number) {
    return SystemProgram.transfer({
      fromPubkey: payer,
      toPubkey: JitoBundler.getRandomTipAccount(),
      lamports: Math.max(10000, tipLamports) // Min 0.00001 SOL tip
    });
  }

  public static async submitBundle(serializedTransactions: string[]): Promise<JitoBundleResult> {
    const payload = {
      jsonrpc: '2.0',
      id: 1,
      method: 'sendBundle',
      params: [serializedTransactions]
    };

    // Parallel broadcast across multi-region Jito Block Engines for lowest latency inclusion
    const requests = JitoBundler.JITO_ENDPOINTS.map(endpoint =>
      axios.post(endpoint, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 3500
      }).then(res => ({ endpoint, data: res.data }))
    );

    try {
      const fastest = await Promise.any(requests);
      if (fastest.data && fastest.data.result) {
        return { success: true, bundleId: fastest.data.result, endpointUsed: fastest.endpoint };
      }
      return { success: false, error: JSON.stringify(fastest.data?.error || 'Bundle dropped') };
    } catch (err: any) {
      return { success: false, error: err.message || 'All Jito endpoints timed out' };
    }
  }
}
