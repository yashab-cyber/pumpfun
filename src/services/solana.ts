import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import chalk from 'chalk';

export class SolanaService {
  private connection: Connection;
  private keypair?: Keypair;

  constructor(rpcUrl: string, privateKey?: string) {
    this.connection = new Connection(rpcUrl, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 30000
    });

    if (privateKey && privateKey.trim().length > 0) {
      try {
        const trimmed = privateKey.trim();
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
          const secretKey = Uint8Array.from(JSON.parse(trimmed));
          this.keypair = Keypair.fromSecretKey(secretKey);
        } else {
          const secretKey = bs58.decode(trimmed);
          this.keypair = Keypair.fromSecretKey(secretKey);
        }
        console.log(chalk.green(`[Solana] Loaded wallet: ${this.keypair.publicKey.toBase58()}`));
      } catch (err: any) {
        console.error(chalk.red(`[Solana] Error loading private key: ${err.message}`));
      }
    }
  }

  public getConnection(): Connection {
    return this.connection;
  }

  public getKeypair(): Keypair | undefined {
    return this.keypair;
  }

  public getPublicKey(): PublicKey | undefined {
    return this.keypair?.publicKey;
  }

  public async getBalance(): Promise<number> {
    if (!this.keypair) return 0;
    try {
      const lamports = await this.connection.getBalance(this.keypair.publicKey);
      return lamports / LAMPORTS_PER_SOL;
    } catch (err: any) {
      console.error(chalk.yellow(`[Solana] Failed to fetch wallet balance: ${err.message}`));
      return 0;
    }
  }

  public async getBalanceForPubkey(pubkey: PublicKey): Promise<number> {
    try {
      const lamports = await this.connection.getBalance(pubkey);
      return lamports / LAMPORTS_PER_SOL;
    } catch {
      return 0;
    }
  }
}
