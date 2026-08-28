import { TokenCreationEvent } from '../types';

export interface SentimentAnalysis {
  viralityScore: number; // 0 to 100
  sentimentTier: 'HYPER_VIRAL' | 'MODERATE' | 'NEUTRAL' | 'LOW_EFFORT';
  detectedKeywords: string[];
  hasCommunityChannels: boolean;
  reachMultiplier: number;
}

export class SocialSentimentAnalyzer {
  private static readonly VIRAL_TRIGGER_WORDS = [
    'pepe', 'doge', 'wojak', 'chad', 'trump', 'elon', 'cult',
    'giga', 'shib', 'inu', 'moon', 'sol', 'ai', 'agent', 'brainrot'
  ];

  public analyzeToken(token: TokenCreationEvent): SentimentAnalysis {
    const text = `${token.name} ${token.symbol} ${token.uri}`.toLowerCase();
    const detected: string[] = [];

    for (const word of SocialSentimentAnalyzer.VIRAL_TRIGGER_WORDS) {
      if (text.includes(word)) {
        detected.push(word);
      }
    }

    let score = 25; // Base score
    const hasSocials = Boolean(token.twitter || token.telegram || token.website);

    if (hasSocials) score += 30;
    if (token.twitter && token.telegram) score += 15;
    score += Math.min(30, detected.length * 10);

    let tier: 'HYPER_VIRAL' | 'MODERATE' | 'NEUTRAL' | 'LOW_EFFORT' = 'NEUTRAL';
    let reachMultiplier = 1.0;

    if (score >= 80) {
      tier = 'HYPER_VIRAL';
      reachMultiplier = 1.4;
    } else if (score >= 60) {
      tier = 'MODERATE';
      reachMultiplier = 1.15;
    } else if (score < 40) {
      tier = 'LOW_EFFORT';
      reachMultiplier = 0.7;
    }

    return {
      viralityScore: Math.min(100, score),
      sentimentTier: tier,
      detectedKeywords: detected,
      hasCommunityChannels: hasSocials,
      reachMultiplier
    };
  }
}
