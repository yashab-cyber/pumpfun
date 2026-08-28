import chalk from 'chalk';
import { AgentConfig, TokenCreationEvent } from '../types';

export interface FilterResult {
  passed: boolean;
  reason?: string;
}

export class FilterEngine {
  private config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = config;
  }

  public evaluateToken(token: TokenCreationEvent): FilterResult {
    // 1. Check mint length and basic validity
    if (!token.mint || token.mint.length < 32 || token.mint.length > 44) {
      return { passed: false, reason: 'Invalid mint address' };
    }

    // 2. Blacklist check on name and symbol
    const textToCheck = `${token.name} ${token.symbol}`.toLowerCase();
    for (const badWord of this.config.blacklistedWords) {
      if (textToCheck.includes(badWord)) {
        return { passed: false, reason: `Contains blacklisted keyword: "${badWord}"` };
      }
    }

    // 3. Dev Initial Buy Filter
    // In pump.fun, initialBuy is in SOL (or lamports converted to SOL)
    const initialBuySol = token.initialBuy > 1000000 ? token.initialBuy / 1e9 : token.initialBuy;

    if (initialBuySol < this.config.minDevInitialBuySol) {
      return {
        passed: false,
        reason: `Dev initial buy too low: ${initialBuySol.toFixed(3)} SOL (Min: ${this.config.minDevInitialBuySol} SOL)`
      };
    }

    if (initialBuySol > this.config.maxDevInitialBuySol) {
      return {
        passed: false,
        reason: `Dev initial buy too high (dump risk): ${initialBuySol.toFixed(3)} SOL (Max: ${this.config.maxDevInitialBuySol} SOL)`
      };
    }

    // 4. Social Links Check
    if (this.config.requireSocials) {
      const hasTwitter = Boolean(token.twitter && token.twitter.trim().length > 0);
      const hasTelegram = Boolean(token.telegram && token.telegram.trim().length > 0);
      const hasWebsite = Boolean(token.website && token.website.trim().length > 0);

      if (!hasTwitter && !hasTelegram && !hasWebsite) {
        return { passed: false, reason: 'No social links provided (requireSocials=true)' };
      }
    }

    return { passed: true };
  }
}
