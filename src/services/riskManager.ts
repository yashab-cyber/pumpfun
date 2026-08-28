import chalk from 'chalk';
import { AgentConfig, Position } from '../types';

export interface ExitSignal {
  action: 'SELL';
  mint: string;
  reason: 'STOP_LOSS' | 'TAKE_PROFIT_1' | 'TAKE_PROFIT_2' | 'TAKE_PROFIT_3' | 'TRAILING_STOP' | 'MAX_HOLD_TIMEOUT' | 'CIRCUIT_BREAKER' | 'BREAKEVEN_STOP';
  sellRatio: number;
  pnlPercent: number;
  pnlSol: number;
}

export class RiskManager {
  private config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = config;
  }

  public updatePositionPrice(position: Position, newPriceSol: number): ExitSignal | null {
    if (position.status !== 'OPEN' || newPriceSol <= 0 || !isFinite(newPriceSol) || isNaN(newPriceSol)) {
      return null;
    }

    if (!position.entryPriceSol || position.entryPriceSol <= 0 || !isFinite(position.entryPriceSol)) {
      position.entryPriceSol = 0.00000003;
    }

    position.currentPriceSol = newPriceSol;
    if (!position.highestPriceSol || newPriceSol > position.highestPriceSol) {
      position.highestPriceSol = newPriceSol;
    }

    // Calculate current PnL safely
    const currentEstimatedValue = position.tokenAmount * newPriceSol;
    position.pnlSol = currentEstimatedValue - position.investedSol;
    position.pnlPercent = ((newPriceSol - position.entryPriceSol) / position.entryPriceSol) * 100;

    const now = Date.now();
    const holdTimeSeconds = Math.max(0, (now - position.buyTimestamp) / 1000);

    // 1. Dynamic Breakeven Stop Ladder (Protects winners from turning into losers)
    if (position.tp2Triggered && position.pnlPercent <= 30) {
      return {
        action: 'SELL',
        mint: position.mint,
        reason: 'BREAKEVEN_STOP',
        sellRatio: 1.0,
        pnlPercent: position.pnlPercent,
        pnlSol: position.pnlSol
      };
    } else if (position.tp1Triggered && position.pnlPercent <= 5) {
      return {
        action: 'SELL',
        mint: position.mint,
        reason: 'BREAKEVEN_STOP',
        sellRatio: 1.0,
        pnlPercent: position.pnlPercent,
        pnlSol: position.pnlSol
      };
    }

    // 2. Hard Stop-Loss Check
    if (position.pnlPercent <= this.config.stopLossPercent) {
      return {
        action: 'SELL',
        mint: position.mint,
        reason: 'STOP_LOSS',
        sellRatio: 1.0,
        pnlPercent: position.pnlPercent,
        pnlSol: position.pnlSol
      };
    }

    // 3. Trailing Stop Check
    const peakPnlPercent = ((position.highestPriceSol - position.entryPriceSol) / position.entryPriceSol) * 100;
    if (peakPnlPercent >= this.config.trailingStopTriggerPercent && position.highestPriceSol > 0) {
      const dropFromPeakPercent = ((position.highestPriceSol - newPriceSol) / position.highestPriceSol) * 100;
      if (dropFromPeakPercent >= this.config.trailingStopDistancePercent) {
        return {
          action: 'SELL',
          mint: position.mint,
          reason: 'TRAILING_STOP',
          sellRatio: 1.0,
          pnlPercent: position.pnlPercent,
          pnlSol: position.pnlSol
        };
      }
    }

    // 4. Take-Profit 3 (Moonbag exit)
    if (position.pnlPercent >= this.config.takeProfit3Percent) {
      return {
        action: 'SELL',
        mint: position.mint,
        reason: 'TAKE_PROFIT_3',
        sellRatio: 1.0,
        pnlPercent: position.pnlPercent,
        pnlSol: position.pnlSol
      };
    }

    // 5. Take-Profit 2 (+100%)
    if (!position.tp2Triggered && position.pnlPercent >= this.config.takeProfit2Percent) {
      position.tp2Triggered = true;
      return {
        action: 'SELL',
        mint: position.mint,
        reason: 'TAKE_PROFIT_2',
        sellRatio: this.config.takeProfit2SellRatio,
        pnlPercent: position.pnlPercent,
        pnlSol: position.pnlSol
      };
    }

    // 6. Take-Profit 1 (+50%)
    if (!position.tp1Triggered && position.pnlPercent >= this.config.takeProfit1Percent) {
      position.tp1Triggered = true;
      return {
        action: 'SELL',
        mint: position.mint,
        reason: 'TAKE_PROFIT_1',
        sellRatio: this.config.takeProfit1SellRatio,
        pnlPercent: position.pnlPercent,
        pnlSol: position.pnlSol
      };
    }

    // 7. Max Hold Time Limit
    if (holdTimeSeconds >= this.config.maxHoldTimeSeconds) {
      return {
        action: 'SELL',
        mint: position.mint,
        reason: 'MAX_HOLD_TIMEOUT',
        sellRatio: 1.0,
        pnlPercent: position.pnlPercent,
        pnlSol: position.pnlSol
      };
    }

    return null;
  }

  public checkCircuitBreaker(realizedPnlSol: number): boolean {
    if (realizedPnlSol < -this.config.maxDailyLossSol) {
      console.log(chalk.red.bold(`\n[RiskManager] ⚠️ CIRCUIT BREAKER TRIGGERED! Cumulative Loss (${realizedPnlSol.toFixed(4)} SOL) exceeded limit (-${this.config.maxDailyLossSol} SOL). Pausing new entries.`));
      return true;
    }
    return false;
  }
}
