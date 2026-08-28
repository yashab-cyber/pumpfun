export interface SentimentAnalysis {
  score: number; // 0 to 100
  passed: boolean;
  tags: string[];
  reason: string;
}

export class AISentimentAnalyzer {
  private static readonly HIGH_VIRALITY_KEYWORDS = [
    'ai', 'agent', 'bot', 'gpt', 'trump', 'elon', 'doge', 'pepe', 'cat', 'wojak',
    'giga', 'chad', 'based', 'sol', 'moon', 'alpha', 'cult', 'maga', 'fart',
    'shib', 'inu', 'bonk', 'wif', 'popcat', 'goat', 'terminal', 'claude', 'deep'
  ];

  private static readonly PENALTY_KEYWORDS = [
    'test', 'null', 'temp', 'delete', 'airdrop', 'fairlaunch', 'presale', 'whitelist',
    'reward', 'claim', 'refund', 'fake', 'clone', 'copy', 'drainer'
  ];

  public static analyze(name: string, symbol: string, description: string = ''): SentimentAnalysis {
    const text = `${name} ${symbol} ${description}`.toLowerCase();
    const tags: string[] = [];
    let score = 50; // Neutral baseline

    // Check penalty keywords
    for (const bad of this.PENALTY_KEYWORDS) {
      if (text.includes(bad)) {
        return {
          score: 10,
          passed: false,
          tags: ['Suspicious'],
          reason: `Contains high-risk low-effort term: "${bad}"`
        };
      }
    }

    // Check for random gibberish (e.g. "asdfghjkl", "qweqwe", random hashes)
    if (/^[b-df-hj-np-tv-z]{6,}$/i.test(symbol) || symbol.length > 10) {
      score -= 25;
      tags.push('Gibberish Ticker');
    }

    // Reward viral meme tags
    let viralityMatches = 0;
    for (const viral of this.HIGH_VIRALITY_KEYWORDS) {
      if (text.includes(viral)) {
        viralityMatches++;
        tags.push(viral.toUpperCase());
      }
    }

    if (viralityMatches > 0) {
      score += Math.min(40, viralityMatches * 15);
    }

    // Check formatting quality
    if (name.length >= 3 && name.length <= 25 && symbol.length >= 2 && symbol.length <= 6) {
      score += 10;
      tags.push('Clean Formatting');
    }

    const finalScore = Math.min(100, Math.max(0, score));
    const passed = finalScore >= 45;

    return {
      score: finalScore,
      passed,
      tags: Array.from(new Set(tags)),
      reason: passed ? `Strong meme virality score: ${finalScore}/100` : `Low virality score: ${finalScore}/100`
    };
  }
}
