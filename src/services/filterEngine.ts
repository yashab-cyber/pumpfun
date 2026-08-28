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
    // 1. Check mint address length and validity
    if (!token.mint || token.mint.length < 32 || token.mint.length > 44) {
      return { passed: false, reason: 'Invalid mint address' };
    }

    // 2. Validate symbol and name length
    const symbol = (token.symbol || '').trim();
    if (symbol.length < 2 || symbol.length > 12) {
      return { passed: false, reason: `Invalid symbol length (${symbol.length})` };
    }

    // 3. Reject unpronounceable gibberish consonant strings (e.g. "XDFRTHQW")
    if (symbol.length >= 6 && !/[aeiouy0-9]/i.test(symbol)) {
      return { passed: false, reason: 'Unpronounceable spam ticker pattern detected' };
    }

    // 4. Blacklist check on name and symbol
    const textToCheck = `${token.name} ${token.symbol}`.toLowerCase();
    for (const badWord of this.config.blacklistedWords) {
      if (textToCheck.includes(badWord)) {
        return { passed: false, reason: `Contains blacklisted keyword: "${badWord}"` };
      }
    }

    // 5. Dev Initial Buy Filter
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

    // 6. Social Links Check
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
