import axios from 'axios';
import { PublicKey, SystemProgram, TransactionInstruction } from '@solana/web3.js';
import chalk from 'chalk';

export class JitoService {
  // Official Jito MEV Tip Accounts
  public static readonly TIP_ACCOUNTS = [
    '96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5',
    'HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe',
    'Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY',
    'ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49',
    'DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh',
    'ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt',
    'DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL',
    '3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT'
  ];

  public static readonly BLOCK_ENGINES = [
    'https://mainnet.block-engine.jito.wtf/api/v1/bundles',
    'https://amsterdam.mainnet.block-engine.jito.wtf/api/v1/bundles',
    'https://frankfurt.mainnet.block-engine.jito.wtf/api/v1/bundles',
    'https://ny.mainnet.block-engine.jito.wtf/api/v1/bundles',
    'https://tokyo.mainnet.block-engine.jito.wtf/api/v1/bundles'
  ];

  public static getRandomTipAccount(): PublicKey {
    const idx = Math.floor(Math.random() * this.TIP_ACCOUNTS.length);
    return new PublicKey(this.TIP_ACCOUNTS[idx]);
  }

  public static createTipInstruction(payerPubkey: PublicKey, tipLamports: number): TransactionInstruction {
    const tipAccount = this.getRandomTipAccount();
    return SystemProgram.transfer({
      fromPubkey: payerPubkey,
      toPubkey: tipAccount,
      lamports: tipLamports
    });
  }

  public static async sendBundle(encodedTransactions: string[]): Promise<{ success: boolean; bundleId?: string; error?: string }> {
    const engineUrl = this.BLOCK_ENGINES[0];
    try {
      const response = await axios.post(
        engineUrl,
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'sendBundle',
          params: [encodedTransactions]
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 5000
        }
      );

      if (response.data.error) {
        return { success: false, error: response.data.error.message || JSON.stringify(response.data.error) };
      }

      const bundleId = response.data.result;
      console.log(chalk.green(`[Jito MEV] ⚡ Bundle submitted successfully! ID: ${bundleId}`));
      return { success: true, bundleId };
    } catch (err: any) {
      const msg = err.response?.data ? JSON.stringify(err.response.data) : err.message;
      return { success: false, error: msg };
    }
  }
}
