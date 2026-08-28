import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import chalk from 'chalk';

export class SolanaService {
  private connection: Connection;
  private keypair?: Keypair;
  private cachedPubkeyString?: string;

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
        this.cachedPubkeyString = this.keypair.publicKey.toBase58();
        console.log(chalk.green(`[Solana] Loaded wallet: ${this.cachedPubkeyString}`));
      } catch (err: any) {
        console.error(chalk.red(`[Solana] Error loading private key: ${err.message}`));
      }
    }
  }

  public getConnection(): Connection {
    return this.connection;
  }

  public updateConnection(newConnection: Connection): void {
    this.connection = newConnection;
  }

  public updateRpcUrl(rpcUrl: string): void {
    this.connection = new Connection(rpcUrl, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 30000
    });
  }

  public getKeypair(): Keypair | undefined {
    return this.keypair;
  }

  public getPublicKey(): PublicKey | undefined {
    return this.keypair?.publicKey;
  }

  public getPublicKeyString(): string {
    return this.cachedPubkeyString || '';
  }

  public async getBalance(): Promise<number> {
    if (!this.keypair) return 0;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const lamports = await this.connection.getBalance(this.keypair.publicKey);
        return lamports / LAMPORTS_PER_SOL;
      } catch (err: any) {
        if (attempt === 3) {
          console.error(chalk.yellow(`[Solana] Failed to fetch wallet balance after 3 attempts: ${err.message}`));
          return 0;
        }
        await new Promise(r => setTimeout(r, 400 * attempt));
      }
    }
    return 0;
  }

  public async getBalanceForPubkey(pubkey: PublicKey): Promise<number> {
    try {
      const lamports = await this.connection.getBalance(pubkey);
      return lamports / LAMPORTS_PER_SOL;
    } catch {
      return 0;
    }
  }

  public async isRpcReachable(): Promise<boolean> {
    try {
      await this.connection.getSlot();
      return true;
    } catch {
      return false;
    }
  }
}
