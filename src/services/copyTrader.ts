import chalk from 'chalk';
import { TradeEvent } from '../types';

export class CopyTrader {
  private trackedWallets: Set<string> = new Set();
  private minCopySolAmount: number = 0.05;
  private enabled: boolean = false;

  constructor() {
    const raw = process.env.TRACKED_WALLETS || '';
    const wallets = raw.split(',').map(w => w.trim()).filter(Boolean);
    for (const w of wallets) {
      this.trackedWallets.add(w);
    }
    this.enabled = this.trackedWallets.size > 0;
    if (this.enabled) {
      console.log(chalk.cyan(`[CopyTrader] 🕵️ Tracking ${this.trackedWallets.size} target alpha wallet(s) (Min Size: ${this.minCopySolAmount} SOL)...`));
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public shouldCopy(trade: TradeEvent): boolean {
    if (!this.enabled) return false;
    if (trade.txType !== 'buy') return false;

    const solAmount = trade.solAmount ? (trade.solAmount > 1e6 ? trade.solAmount / 1e9 : trade.solAmount) : 0;
    if (solAmount < this.minCopySolAmount) {
      return false; // Skip dust/micro buys
    }

    if (this.trackedWallets.has(trade.traderPublicKey)) {
      console.log(
        chalk.magenta.bold(
          `[CopyTrader] 🎯 Alpha Wallet ${trade.traderPublicKey.substring(0, 6)}... bought ${solAmount.toFixed(2)} SOL of ${trade.mint}!`
        )
      );
      return true;
    }
    return false;
  }
}
