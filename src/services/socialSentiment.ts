import { TokenCreationEvent } from '../types';

export interface SentimentAnalysis {
  viralityScore: number; // 0 to 100
  sentimentTier: 'HYPER_VIRAL' | 'MODERATE' | 'NEUTRAL' | 'LOW_EFFORT';
  detectedKeywords: string[];
  hasCommunityChannels: boolean;
  hasVerifiedTwitterUrl: boolean;
  hasVerifiedTelegramUrl: boolean;
  reachMultiplier: number;
}

export class SocialSentimentAnalyzer {
  private static readonly VIRAL_TRIGGER_WORDS = [
    'pepe', 'doge', 'wojak', 'chad', 'trump', 'elon', 'cult',
    'giga', 'shib', 'inu', 'moon', 'sol', 'ai', 'agent', 'brainrot',
    'pnut', 'chill', 'moodeng', 'fart', 'goat', 'deepseek', 'terminal'
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

    // Syntactic URL verification
    const twitterRaw = (token.twitter || '').trim();
    const telegramRaw = (token.telegram || '').trim();
    const websiteRaw = (token.website || '').trim();

    const hasVerifiedTwitterUrl = Boolean(
      twitterRaw.length >= 8 &&
      (twitterRaw.includes('twitter.com/') || twitterRaw.includes('x.com/')) &&
      !twitterRaw.endsWith('/x.com') && !twitterRaw.endsWith('/twitter.com')
    );

    const hasVerifiedTelegramUrl = Boolean(
      telegramRaw.length >= 6 &&
      (telegramRaw.includes('t.me/') || telegramRaw.includes('telegram.me/')) &&
      !telegramRaw.endsWith('/t.me')
    );

    const hasWebsite = Boolean(websiteRaw.length >= 8 && websiteRaw.startsWith('http'));
    const hasCommunityChannels = hasVerifiedTwitterUrl || hasVerifiedTelegramUrl || hasWebsite;

    if (hasCommunityChannels) score += 25;
    if (hasVerifiedTwitterUrl) score += 15;
    if (hasVerifiedTelegramUrl) score += 15;
    if (hasVerifiedTwitterUrl && hasVerifiedTelegramUrl) score += 10;
    
    score += Math.min(30, detected.length * 8);

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
      hasCommunityChannels,
      hasVerifiedTwitterUrl,
      hasVerifiedTelegramUrl,
      reachMultiplier
    };
  }
}
