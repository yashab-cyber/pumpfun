import chalk from 'chalk';
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { SQLiteMemory } from './sqliteMemory';
import { AgentConfig, VaultCycle } from '../types';
import { SolanaService } from './solana';

export interface VaultEventResult {
  triggered: boolean;
  amountVaultedSol: number;
  totalVaultedSol: number;
  cycleNumber: number;
  newTradingBalanceSol: number;
  txSignature?: string;
}

export class ProfitVault {
  private config: AgentConfig;
  private memory: SQLiteMemory;
  private solanaService?: SolanaService;
  private totalVaultedSol: number = 0;
  private cycleCount: number = 0;

  constructor(config: AgentConfig, memory: SQLiteMemory, solanaService?: SolanaService) {
    this.config = config;
    this.memory = memory;
    this.solanaService = solanaService;
  }

  public async init(): Promise<void> {
    const rawVaulted = await this.memory.loadState<number>('total_vaulted_sol', 0);
    const rawCycle = await this.memory.loadState<number>('vault_cycle_count', 0);
    this.totalVaultedSol = Number(rawVaulted) || 0;
    this.cycleCount = Number(rawCycle) || 0;

    console.log(
      chalk.yellow.bold(
        `[Profit Vault] 🏦 Vault Engine online | Base Bankroll: ${this.config.baseBankrollSol} SOL | Milestone: +${this.config.profitVaultThresholdSol} SOL | Total Vaulted: ${this.totalVaultedSol.toFixed(4)} SOL (Cycle #${this.cycleCount})`
      )
    );
  }

  public getTotalVaulted(): number {
    return this.totalVaultedSol;
  }

  public getCycleCount(): number {
    return this.cycleCount;
  }

  /**
   * Evaluates if current active balance has crossed the profit milestone
   */
  public async checkAndVaultProfits(currentBalanceSol: number): Promise<VaultEventResult> {
    if (!this.config.enableProfitVault || currentBalanceSol <= 0 || isNaN(currentBalanceSol)) {
      return { triggered: false, amountVaultedSol: 0, totalVaultedSol: this.totalVaultedSol, cycleNumber: this.cycleCount, newTradingBalanceSol: currentBalanceSol };
    }

    const milestoneTarget = this.config.baseBankrollSol + this.config.profitVaultThresholdSol;

    if (currentBalanceSol >= milestoneTarget) {
      const amountToVault = Math.max(0, currentBalanceSol - this.config.baseBankrollSol);
      if (amountToVault <= 0) {
        return { triggered: false, amountVaultedSol: 0, totalVaultedSol: this.totalVaultedSol, cycleNumber: this.cycleCount, newTradingBalanceSol: currentBalanceSol };
      }

      this.totalVaultedSol = Number(this.totalVaultedSol) + amountToVault;
      this.cycleCount = Number(this.cycleCount) + 1;

      let txSignature: string | undefined;

      if (this.config.tradingMode === 'live' && this.config.vaultDestinationWallet && this.solanaService) {
        try {
          const keypair = this.solanaService.getKeypair();
          if (keypair) {
            const destPubkey = new PublicKey(this.config.vaultDestinationWallet);
            const lamports = Math.floor(amountToVault * 1e9);
            const connection = this.solanaService.getConnection();

            const tx = new Transaction().add(
              SystemProgram.transfer({
                fromPubkey: keypair.publicKey,
                toPubkey: destPubkey,
                lamports: lamports
              })
            );

            txSignature = await connection.sendTransaction(tx, [keypair]);
            console.log(chalk.green.bold(`[Profit Vault] ⚡ On-Chain Transfer of ${amountToVault.toFixed(4)} SOL sent to cold vault: ${txSignature}`));
          }
        } catch (err: any) {
          console.error(chalk.red(`[Profit Vault] Failed to transfer SOL to cold vault wallet: ${err.message}`));
        }
      }

      // Persist in SQLite Memory
      await this.memory.saveState('total_vaulted_sol', this.totalVaultedSol);
      await this.memory.saveState('vault_cycle_count', this.cycleCount);
      await this.memory.recordVaultCycle(this.cycleCount, amountToVault, this.totalVaultedSol, txSignature);

      console.log(
        chalk.yellow.bold(
          `\n========================================================================\n` +
          ` 🏦 [PROFIT VAULT MILESTONE REACHED] Cycle #${this.cycleCount} COMPLETED!\n` +
          `   • Locked into Vault: +${amountToVault.toFixed(4)} SOL (~$100 safe profit secured)\n` +
          `   • Total Cumulative Vaulted: ${this.totalVaultedSol.toFixed(4)} SOL\n` +
          `   • Trading Bankroll Reset To: ${this.config.baseBankrollSol.toFixed(4)} SOL ($1 starting seed)\n` +
          `========================================================================\n`
        )
      );

      return {
        triggered: true,
        amountVaultedSol: amountToVault,
        totalVaultedSol: this.totalVaultedSol,
        cycleNumber: this.cycleCount,
        newTradingBalanceSol: this.config.baseBankrollSol,
        txSignature
      };
    }

    return {
      triggered: false,
      amountVaultedSol: 0,
      totalVaultedSol: this.totalVaultedSol,
      cycleNumber: this.cycleCount,
      newTradingBalanceSol: currentBalanceSol
    };
  }

  public async getHistory(): Promise<VaultCycle[]> {
    return await this.memory.getVaultCycles();
  }
}
