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

    // 4. Blacklist check on name and symbol (word-boundary match to prevent false positives like 'greatest' matching 'test')
    const textToCheck = `${token.name || ''} ${token.symbol || ''}`.toLowerCase();
    if (this.config.blacklistedWords && this.config.blacklistedWords.length > 0) {
      for (const badWord of this.config.blacklistedWords) {
        if (!badWord) continue;
        const escaped = badWord.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i');
        if (regex.test(textToCheck)) {
          return { passed: false, reason: `Contains blacklisted keyword: "${badWord}"` };
        }
      }
    }

    // 5. Dev Initial Buy Filter
    const rawInitialBuy = (token.initialBuy && !isNaN(token.initialBuy) && token.initialBuy > 0) ? token.initialBuy : 0;
    const initialBuySol = rawInitialBuy > 1000000 ? rawInitialBuy / 1e9 : rawInitialBuy;

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
