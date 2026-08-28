import axios from 'axios';
import chalk from 'chalk';
import { Keypair, PublicKey, SystemProgram, Transaction, VersionedTransaction } from '@solana/web3.js';

export interface JitoBundleResult {
  success: boolean;
  bundleId?: string;
  error?: string;
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
    const endpoint = JitoBundler.JITO_ENDPOINTS[0];
    try {
      const response = await axios.post(
        endpoint,
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'sendBundle',
          params: [serializedTransactions]
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 4000
        }
      );

      if (response.data && response.data.result) {
        return { success: true, bundleId: response.data.result };
      }
      return { success: false, error: JSON.stringify(response.data.error || 'Bundle dropped') };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}
